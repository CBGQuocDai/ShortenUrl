// lib/tail.js — post-process a per-scenario NDJSON to get the actual tail.
// Reads a NDJSON file (one compact JSON per line: {s, t, k, ts}) and returns:
//   - extended percentiles: p99.9, p99.99, max, top-K slowest
//   - a coarse latency histogram in 12 buckets from 1ms to 10s
//   - inter-arrival gap stats (where the long-tail might come from)

const fs = require('fs');
const readline = require('readline');

function pct(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

const BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

function histogram(latencies) {
  const counts = new Array(BUCKETS.length + 1).fill(0); // last bucket = >max
  for (const l of latencies) {
    let placed = false;
    for (let i = 0; i < BUCKETS.length; i++) {
      if (l <= BUCKETS[i]) { counts[i]++; placed = true; break; }
    }
    if (!placed) counts[BUCKETS.length]++;
  }
  const total = latencies.length || 1;
  return BUCKETS.map((b, i) => ({ le_ms: b, count: counts[i], pct: counts[i] / total }))
    .concat([{ le_ms: null, count: counts[BUCKETS.length], pct: counts[BUCKETS.length] / total }]);
}

async function analyzeNdjson(filePath, topK = 10) {
  if (!fs.existsSync(filePath)) return null;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  const measured = []; // {latencyMs, ts, status, kind}
  let lineCount = 0;
  let warmupCount = 0;
  for await (const line of rl) {
    if (!line) continue;
    lineCount++;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    if (r.k === 'warmup') { warmupCount++; continue; }
    measured.push({ latencyMs: r.t, ts: r.ts, status: r.s, kind: r.k });
  }
  if (measured.length === 0) return { lineCount, warmupCount, measured: 0 };

  const lats = measured.map((m) => m.latencyMs).filter(Number.isFinite).sort((a, b) => a - b);
  const ts = measured.map((m) => m.ts).sort((a, b) => a - b);
  const elapsedSec = ts.length > 1 ? (ts[ts.length - 1] - ts[0]) / 1000 : 0;

  const slowest = measured.slice().sort((a, b) => b.latencyMs - a.latencyMs).slice(0, topK);

  return {
    lineCount,
    warmupCount,
    measured: measured.length,
    elapsedSec,
    latencyMs: {
      p99_9: pct(lats, 99.9),
      p99_99: pct(lats, 99.99),
      p100: lats[lats.length - 1] ?? 0,
    },
    histogram: histogram(lats),
    slowest: slowest.map((s) => ({ ts: new Date(s.ts).toISOString(), latencyMs: s.latencyMs, status: s.status, kind: s.kind })),
  };
}

module.exports = { analyzeNdjson, BUCKETS };
