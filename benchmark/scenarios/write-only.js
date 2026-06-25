// scenarios/write-only.js — POST /shorten/create at N concurrency for D seconds.
// Writes summary JSON + raw NDJSON.

const fs = require('fs');
const path = require('path');
const { request } = require('../lib/http');
const { runPool } = require('../lib/runner');
const { summarize } = require('../lib/stats');
const { openNdjson, makeSink } = require('../lib/sink');

function parseArgs() {
  const out = { concurrency: 50, durationSec: 30, warmupSec: 5, out: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--concurrency') out.concurrency = parseInt(argv[++i], 10);
    else if (argv[i] === '--duration') out.durationSec = parseInt(argv[++i], 10);
    else if (argv[i] === '--warmup') out.warmupSec = parseInt(argv[++i], 10);
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

(async () => {
  const args = parseArgs();
  const baseUrl = process.env.BASE_URL || 'http://localhost:8080/api';
  const token = process.env.BENCH_TOKEN;
  if (!token) throw new Error('BENCH_TOKEN env not set');
  const name = `write-c${String(args.concurrency).padStart(4, '0')}`;
  console.log(`[${name}] starting: c=${args.concurrency} d=${args.durationSec}s warmup=${args.warmupSec}s`);

  const outDir = process.env.OUT_DIR || path.join('results', 'per-scenario');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = args.out || path.join(outDir, `${name}.json`);
  const ndjsonPath = path.join(outDir, `${name}.ndjson`);
  const fd = openNdjson(ndjsonPath);

  if (args.warmupSec > 0) {
    const warmSamples = [];
    await runPool({
      concurrency: args.concurrency,
      durationSec: args.warmupSec,
      samples: warmSamples,
      requester: async (i) => {
        const res = await request({
          method: 'POST', baseUrl, path: '/shorten/create', token,
          body: { url: makeUrl(i), shortCode: makeShortCode(i) },
        });
        fs.writeSync(fd, JSON.stringify({ s: res.status, t: res.latencyMs, k: 'warmup', ts: Date.now() }) + '\n');
      },
    });
    console.log(`[${name}] warmup done (${warmSamples.length} reqs)`);
  }

  const samples = [];
  const sink = makeSink({ ndjsonFd: fd, samples, kind: 'write' });
  const meta = await runPool({
    concurrency: args.concurrency,
    durationSec: args.durationSec,
    samples,
    requester: async (i) => {
      const res = await request({
        method: 'POST', baseUrl, path: '/shorten/create', token,
        body: { url: makeUrl(i), shortCode: makeShortCode(i) },
      });
      sink(res.status, res.latencyMs, Date.now());
    },
  });

  fs.closeSync(fd);

  const stats = summarize(samples);
  const result = {
    name, kind: 'write',
    concurrency: args.concurrency, durationSec: args.durationSec, warmupSec: args.warmupSec,
    startedAt: new Date(meta.startedAt).toISOString(),
    endedAt: new Date(meta.endedAt).toISOString(),
    sampleCount: samples.length,
    stats,
    ndjsonPath,
  };

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`[${name}] done → rps=${stats.rps.toFixed(1)} p50=${stats.latencyMs.p50.toFixed(1)}ms p99=${stats.latencyMs.p99.toFixed(1)}ms max=${stats.latencyMs.max.toFixed(1)}ms err=${(stats.errorRate * 100).toFixed(2)}%`);
  console.log(`[${name}] wrote ${outPath} + ${ndjsonPath}`);
})().catch((e) => { console.error(`[write] failed:`, e.message); process.exit(1); });
