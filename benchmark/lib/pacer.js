// lib/pacer.js — open-loop rps pacer.
// Caller says "send N requests at target R rps"; pacer spaces them out evenly.
// Workers await pacer.next() before each request, so we control OFFERED load,
// not concurrency — this is what makes saturation curves meaningful.

class Pacer {
  constructor(targetRps) {
    this.targetRps = targetRps;
    this.intervalMs = 1000 / targetRps;
    this.startedAt = null;
    this.sent = 0;
  }
  start() {
    this.startedAt = Date.now();
  }
  async next() {
    if (this.startedAt === null) this.start();
    const target = this.startedAt + this.sent * this.intervalMs;
    const now = Date.now();
    if (now >= target) {
      this.sent++;
      return;
    }
    const sleep = target - now;
    await new Promise((r) => setTimeout(r, sleep));
    this.sent++;
  }
  elapsedSec() {
    return (Date.now() - this.startedAt) / 1000;
  }
  achievedRps() {
    const sec = this.elapsedSec();
    return sec > 0 ? this.sent / sec : 0;
  }
}

module.exports = { Pacer };
