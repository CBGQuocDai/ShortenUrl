// lib/runner.js — common driver for all scenarios.
// A pool of N workers, each running request() in a tight loop until duration expires.
// Shared `samples` array — pushes are O(1), no contention.

async function runPool({ concurrency, durationSec, samples, requester }) {
  const start = Date.now();
  const end = start + durationSec * 1000;
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (Date.now() < end) {
      const myIdx = idx++;
      await requester(myIdx, samples);
    }
  });
  await Promise.all(workers);
  return { startedAt: start, endedAt: Date.now(), totalIdx: idx };
}

module.exports = { runPool };
