// scenarios/threshold-write.js — find the write-path ceiling using open-loop pacing.

const fs = require('fs');
const path = require('path');
const { request } = require('../lib/http');
const { summarize } = require('../lib/stats');
const { Pacer } = require('../lib/pacer');
const { snapshot } = require('../lib/env-sampler');

function parseArgs() {
  const out = {
    startRps: 200,
    endRps: 3000,
    stepRps: 200,
    stepDurationSec: 20,
    concurrency: 128,
    out: null,
  };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--start') out.startRps = parseInt(argv[++i], 10);
    else if (argv[i] === '--end') out.endRps = parseInt(argv[++i], 10);
    else if (argv[i] === '--step') out.stepRps = parseInt(argv[++i], 10);
    else if (argv[i] === '--duration') out.stepDurationSec = parseInt(argv[++i], 10);
    else if (argv[i] === '--workers') out.concurrency = parseInt(argv[++i], 10);
    else if (argv[i] === '--out') out.out = argv[++i];
  }
  return out;
}

function makeUrl(i) {
  return `https://example.com/bench/${process.pid}/${Date.now()}/${i}`;
}
function makeShortCode(i) {
  const r = Math.floor(Math.random() * 1e10).toString(36);
  return (r + i).replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
}

async function runStep({ baseUrl, token, targetRps, durationSec, workers, samples }) {
  const pacer = new Pacer(targetRps);
  pacer.start();
  const endAt = Date.now() + durationSec * 1000;
  const inFlight = new Set();
  for (let i = 0; i < workers; i++) {
    inFlight.add((async () => {
      while (Date.now() < endAt) {
        await pacer.next();
        if (Date.now() >= endAt) break;
        const res = await request({
          method: 'POST', baseUrl, path: '/shorten/create', token,
          body: { url: makeUrl(i), shortCode: makeShortCode(i) },
        });
        samples.push({ status: res.status, latencyMs: res.latencyMs, ts: Date.now(), kind: 'write' });
      }
    })());
  }
  await Promise.all(inFlight);
  return {
    targetRps,
    durationSec,
    achievedRps: pacer.achievedRps(),
    requested: pacer.sent,
    stats: summarize(samples),
  };
}

(async () => {
  const args = parseArgs();
  const baseUrl = process.env.BASE_URL || 'http://localhost:8080/api';
  const token = process.env.BENCH_TOKEN;
  if (!token) throw new Error('BENCH_TOKEN env not set');
  console.log(`[threshold-write] start=${args.startRps} end=${args.endRps} step=${args.stepRps} dur=${args.stepDurationSec}s workers=${args.concurrency}`);

  const steps = [];
  for (let rps = args.startRps; rps <= args.endRps; rps += args.stepRps) {
    const samples = [];
    console.log(`[threshold-write] → ${rps} rps for ${args.stepDurationSec}s`);
    const baselineEnv = await snapshot();
    const step = await runStep({ baseUrl, token, targetRps: rps, durationSec: args.stepDurationSec, workers: args.concurrency, samples });
    const duringEnv = await snapshot();
    step.env = { baseline: baselineEnv, during: duringEnv };
    steps.push(step);
    const jvmRss = duringEnv.jvm?.rssKb ? `${(duringEnv.jvm.rssKb / 1024).toFixed(0)}MB` : '-';
    const pgConn = duringEnv.pg?.connections?.total ?? '-';
    const load1 = duringEnv.system?.loadAvg?.['1m']?.toFixed(2) ?? '-';
    console.log(`[threshold-write]   achieved=${step.achievedRps.toFixed(0)} rps  p50=${step.stats.latencyMs.p50.toFixed(1)}ms  p99=${step.stats.latencyMs.p99.toFixed(1)}ms  max=${step.stats.latencyMs.max.toFixed(1)}ms  err=${(step.stats.errorRate * 100).toFixed(2)}%  jvm=${jvmRss} pgConn=${pgConn} load=${load1}`);

    if (step.stats.errorRate >= 0.05) {
      console.log(`[threshold-write]   ⚠ error rate ≥5% — halting ramp`);
      break;
    }
    if (step.stats.latencyMs.p99 >= 3000) {
      console.log(`[threshold-write]   ⚠ p99 ≥3s — halting ramp`);
      break;
    }
    if (step.achievedRps < rps * 0.5) {
      console.log(`[threshold-write]   ⚠ achieved ${step.achievedRps.toFixed(0)} rps (<50% of target) — halting ramp`);
      break;
    }
  }

  const result = {
    name: 'threshold-write',
    kind: 'threshold',
    target: 'write',
    startRps: args.startRps,
    endRps: args.endRps,
    stepRps: args.stepRps,
    stepDurationSec: args.stepDurationSec,
    concurrency: args.concurrency,
    steps,
    runAt: new Date().toISOString(),
  };

  const outPath = args.out || path.join(process.env.OUT_DIR || 'threshold-results', 'threshold-write.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`[threshold-write] wrote ${outPath}`);
})().catch((e) => { console.error(`[threshold-write] failed:`, e.message); process.exit(1); });
