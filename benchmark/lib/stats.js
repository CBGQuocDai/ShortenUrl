// lib/stats.js — percentile aggregation over latency samples.
// Nearest-rank percentile (no interpolation) to keep it deterministic + dep-free.

function pct(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

function summarize(samples) {
  // samples: [{ status, latencyMs, ts, kind }]
  const count = samples.length;
  const latencies = samples.map((s) => s.latencyMs).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);

  const statusHist = {};
  let okCount = 0;
  let errCount = 0;
  for (const s of samples) {
    const k = String(s.status);
    statusHist[k] = (statusHist[k] || 0) + 1;
    if (s.status >= 200 && s.status < 400) okCount += 1;
    else errCount += 1;
  }

  let mean = 0;
  let stddev = 0;
  if (latencies.length > 0) {
    mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const variance = latencies.reduce((a, b) => a + (b - mean) ** 2, 0) / latencies.length;
    stddev = Math.sqrt(variance);
  }

  const tsSorted = samples.map((s) => s.ts).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const elapsedSec = tsSorted.length > 1 ? (tsSorted[tsSorted.length - 1] - tsSorted[0]) / 1000 : 0;
  const rps = elapsedSec > 0 ? count / elapsedSec : 0;

  return {
    count,
    ok: okCount,
    errors: errCount,
    errorRate: count > 0 ? errCount / count : 0,
    elapsedSec,
    rps,
    latencyMs: {
      min: latencies[0] ?? 0,
      max: latencies[latencies.length - 1] ?? 0,
      mean,
      stddev,
      p50: pct(latencies, 50),
      p90: pct(latencies, 90),
      p95: pct(latencies, 95),
      p99: pct(latencies, 99),
    },
    statusHistogram: statusHist,
  };
}

module.exports = { summarize };
