// lib/reporter.js — reads per-scenario/*.json + *.ndjson from a run dir, writes summary.md + results.json + requests.csv.

const fs = require('fs');
const path = require('path');
const { analyzeNdjson } = require('./tail');

function ms(n) {
  if (!Number.isFinite(n)) return '-';
  if (n >= 100) return `${n.toFixed(0)}ms`;
  if (n >= 10) return `${n.toFixed(1)}ms`;
  return `${n.toFixed(2)}ms`;
}

async function detectBottleneck(scenarios) {
  const lines = [];
  for (const kind of ['read', 'write', 'mixed']) {
    const series = scenarios.filter((s) => s.kind === kind).sort((a, b) => a.concurrency - b.concurrency);
    if (series.length < 2) continue;
    const baseline = series[0].stats.latencyMs.p99 || 1;
    const knee = series.find((s) => s.stats.latencyMs.p99 >= baseline * 4 && s.stats.latencyMs.p99 >= 200);
    const maxRps = Math.max(...series.map((s) => s.stats.rps));
    const peak = series.find((s) => s.stats.rps === maxRps);
    if (knee) {
      lines.push(`- **${kind}**: p99 latency breaks ≥4× baseline at concurrency **${knee.concurrency}** (peak ${maxRps.toFixed(0)} rps @ c=${peak.concurrency}).`);
    } else {
      lines.push(`- **${kind}**: no clear latency knee — peak ${maxRps.toFixed(0)} rps @ c=${peak.concurrency}.`);
    }
    const errSpike = series.find((s) => s.stats.errorRate >= 0.01);
    if (errSpike) {
      lines.push(`  - Error rate ≥1% starting at c=${errSpike.concurrency} (${(errSpike.stats.errorRate * 100).toFixed(2)}%).`);
    }
    // Long-tail signal: any scenario with p99.9 > 1s?
    const tailSpike = series.find((s) => s.tail && s.tail.latencyMs.p99_9 >= 1000);
    if (tailSpike) {
      lines.push(`  - **Long tail**: p99.9 latency ≥1s at c=${tailSpike.concurrency} (p99.9=${ms(tailSpike.tail.latencyMs.p99_9)}, max=${ms(tailSpike.tail.latencyMs.p100)}).`);
    }
  }
  return lines.length ? lines : ['- No clear bottleneck signal; latency stays roughly linear across concurrency.'];
}

async function writeMarkdown(runDir, scenarios, meta) {
  // Enrich each scenario with its tail analysis.
  for (const s of scenarios) {
    if (s.ndjsonPath && fs.existsSync(s.ndjsonPath)) {
      s.tail = await analyzeNdjson(s.ndjsonPath);
    }
  }

  const md = [];
  md.push(`# Benchmark Report — ${meta.runId}`);
  md.push('');
  md.push(`- **Started**: ${meta.startedAt}`);
  md.push(`- **Backend**: ${meta.baseUrl}`);
  md.push(`- **DB**: ${meta.dbUrl}`);
  md.push(`- **Branch / mode**: \`${meta.branch}\``);
  md.push(`- **Tool**: custom Node.js (no external deps, uses \`pg\` for short-code sampling only)`);
  md.push(`- **Scenarios**: ${scenarios.length} (read × ${scenarios.filter((s) => s.kind === 'read').length}, write × ${scenarios.filter((s) => s.kind === 'write').length}, mixed × ${scenarios.filter((s) => s.kind === 'mixed').length})`);
  md.push(`- **Each scenario**: ${meta.warmupSec}s warmup + ${meta.durationSec}s measured`);
  md.push('');
  md.push('## Verdict');
  md.push('');
  md.push(...(await detectBottleneck(scenarios)));
  md.push('');
  md.push('## Results');
  md.push('');
  md.push('| Scenario | Kind | Concurrency | RPS | p50 | p95 | p99 | p99.9 | max | Error % |');
  md.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  const sorted = [...scenarios].sort((a, b) => {
    const k = { read: 0, write: 1, mixed: 2 }[a.kind] - { read: 0, write: 1, mixed: 2 }[b.kind];
    return k !== 0 ? k : a.concurrency - b.concurrency;
  });
  for (const s of sorted) {
    const st = s.stats;
    const tail = s.tail ? s.tail.latencyMs : null;
    md.push(`| ${s.name} | ${s.kind} | ${s.concurrency} | ${st.rps.toFixed(1)} | ${ms(st.latencyMs.p50)} | ${ms(st.latencyMs.p95)} | ${ms(st.latencyMs.p99)} | ${ms(tail?.p99_9)} | ${ms(tail?.p100 ?? st.latencyMs.max)} | ${(st.errorRate * 100).toFixed(2)} |`);
  }
  md.push('');
  md.push('## Latency Distribution (per scenario)');
  md.push('');
  md.push('Buckets in ms: `<=1`, `<=5`, `<=10`, `<=25`, `<=50`, `<=100`, `<=250`, `<=500`, `<=1000`, `<=2500`, `<=5000`, `<=10000`, `>10000`.');
  md.push('');
  for (const s of sorted) {
    if (!s.tail) continue;
    md.push(`### ${s.name}`);
    md.push('');
    md.push('| Bucket | Count | % |');
    md.push('|---|---:|---:|');
    for (const b of s.tail.histogram) {
      const label = b.le_ms === null ? '>10000' : `<=${b.le_ms}`;
      md.push(`| ${label} | ${b.count} | ${(b.pct * 100).toFixed(2)} |`);
    }
    md.push('');
  }
  md.push('## Slowest Requests per Scenario');
  md.push('');
  for (const s of sorted) {
    if (!s.tail || s.tail.slowest.length === 0) continue;
    md.push(`### ${s.name}`);
    md.push('');
    md.push('| Time | Latency | Status | Kind |');
    md.push('|---|---:|---|---|');
    for (const r of s.tail.slowest) {
      md.push(`| ${r.ts} | ${ms(r.latencyMs)} | ${r.status} | ${r.kind} |`);
    }
    md.push('');
  }
  md.push('## Per-Scenario Status Histograms');
  md.push('');
  for (const s of sorted) {
    md.push(`### ${s.name}`);
    md.push('');
    md.push('| Status | Count |');
    md.push('|---|---:|');
    for (const [k, v] of Object.entries(s.stats.statusHistogram).sort()) {
      md.push(`| ${k} | ${v} |`);
    }
    md.push('');
  }
  md.push('## Observations');
  md.push('');
  for (const kind of ['read', 'write', 'mixed']) {
    const series = scenarios.filter((s) => s.kind === kind);
    if (series.length === 0) continue;
    const peakRps = Math.max(...series.map((s) => s.stats.rps));
    const peak = series.find((s) => s.stats.rps === peakRps);
    const errs = series.reduce((a, s) => a + s.stats.errors, 0);
    const total = series.reduce((a, s) => a + s.stats.count, 0);
    md.push(`- **${kind}**: ${series.length} runs, ${total.toLocaleString()} total reqs, ${errs.toLocaleString()} errors. Peak ${peakRps.toFixed(0)} rps @ c=${peak.concurrency} (p99=${ms(peak.stats.latencyMs.p99)}).`);
  }
  md.push('');
  md.push('---');
  md.push('');
  md.push(`Generated by \`benchmark/lib/reporter.js\`. Raw per-scenario JSON in \`per-scenario/\`; per-request NDJSON in same dir.`);
  return md.join('\n');
}

async function main() {
  const runDir = process.argv[2];
  if (!runDir) { console.error('usage: reporter.js <run-dir>'); process.exit(1); }
  const perDir = path.join(runDir, 'per-scenario');
  const files = fs.readdirSync(perDir).filter((f) => f.endsWith('.json'));
  const scenarios = files.map((f) => JSON.parse(fs.readFileSync(path.join(perDir, f), 'utf8')));

  const metaFile = path.join(runDir, 'meta.json');
  const meta = fs.existsSync(metaFile)
    ? JSON.parse(fs.readFileSync(metaFile, 'utf8'))
    : { runId: path.basename(runDir), baseUrl: 'unknown', dbUrl: 'unknown', branch: 'unknown', startedAt: new Date().toISOString(), warmupSec: 5, durationSec: 30 };

  // Tail enrichment for the JSON output as well.
  for (const s of scenarios) {
    if (s.ndjsonPath && fs.existsSync(s.ndjsonPath)) {
      s.tail = await analyzeNdjson(s.ndjsonPath);
    }
  }

  fs.writeFileSync(path.join(runDir, 'summary.md'), await writeMarkdown(runDir, scenarios, meta));
  fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify({ meta, scenarios }, null, 2));
  console.log(`[reporter] wrote summary.md + results.json to ${runDir}`);
}

if (require.main === module) main();
module.exports = { writeMarkdown };
