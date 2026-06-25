// lib/threshold-reporter.js — reads threshold-*.json files, finds ceiling + knee, writes report.

const fs = require('fs');
const path = require('path');

function ms(n) {
  if (!Number.isFinite(n)) return '-';
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  if (n >= 100) return `${n.toFixed(0)}ms`;
  if (n >= 10) return `${n.toFixed(1)}ms`;
  return `${n.toFixed(2)}ms`;
}
function mb(n) {
  if (!Number.isFinite(n)) return '-';
  if (n >= 1024) return `${(n / 1024).toFixed(1)}GB`;
  return `${n.toFixed(0)}MB`;
}

const FAIL_CRITERIA = {
  p99: 500,
  errPct: 1.0,
  dropRatio: 0.7,
};

function findCeiling(steps) {
  let lastHealthy = null;
  let firstBroken = null;
  for (const s of steps) {
    const errPct = s.stats.errorRate * 100;
    const achievedRatio = s.targetRps > 0 ? s.achievedRps / s.targetRps : 0;
    const healthy =
      s.stats.latencyMs.p99 < FAIL_CRITERIA.p99 &&
      errPct < FAIL_CRITERIA.errPct &&
      achievedRatio >= FAIL_CRITERIA.dropRatio;
    if (healthy) lastHealthy = s;
    else { firstBroken = s; break; }
  }
  return { lastHealthy, firstBroken };
}

function findKnee(steps) {
  if (steps.length < 2) return null;
  const baseline = steps[0].stats.latencyMs.p99;
  return steps.find((s) => s.stats.latencyMs.p99 >= baseline * 2 && s.stats.latencyMs.p99 >= 100) || null;
}

function findPeakRps(steps) {
  return steps.reduce((best, s) => (s.achievedRps > (best?.achievedRps ?? -1) ? s : best), null);
}

// Per-step env-row formatter.
function envRow(step) {
  const e = step.env?.during;
  if (!e) return { jvm: '-', pg: '-', load: '-' };
  const jvmRss = e.jvm?.rssKb ? mb(e.jvm.rssKb / 1024) : '-';
  const jvmCpu = e.jvm?.cpuPct != null ? `${e.jvm.cpuPct.toFixed(1)}%` : '-';
  const jvmThreads = e.jvm?.threads ?? '-';
  const jvmFds = e.jvm?.fds ?? '-';
  const pgConn = e.pg?.connections?.total ?? '-';
  const pgActive = e.pg?.connections?.byState?.active ?? e.pg?.connections?.byState?.idle_in_transaction ?? 0;
  const pgDbMb = e.pg?.sizes?.dbBytes ? mb(e.pg.sizes.dbBytes / 1024 / 1024) : '-';
  const load1 = e.system?.loadAvg?.['1m']?.toFixed(2) ?? '-';
  const freeMemMb = e.system?.mem?.freeBytes ? mb(e.system.mem.freeBytes / 1024 / 1024) : '-';
  return {
    jvm: `${jvmRss} / cpu ${jvmCpu} / ${jvmThreads}t / ${jvmFds}fd`,
    pg: `${pgConn} conn (${pgActive} active) / db ${pgDbMb}`,
    load: `${load1} / free ${freeMemMb}`,
  };
}

function writeReport(results, outDir) {
  const md = [];
  md.push(`# System Threshold & Resource Report — ${new Date().toISOString()}`);
  md.push('');
  md.push('Open-loop rps ramp: offered load controlled by the client, measured at each step.');
  md.push(`Failure criteria: p99 ≥ ${FAIL_CRITERIA.p99}ms, errors ≥ ${FAIL_CRITERIA.errPct}%, or achieved < ${Math.round(FAIL_CRITERIA.dropRatio * 100)}% of target.`);
  md.push('');
  md.push('Resource snapshots are taken at the **end of each step** (during-load), capturing the JVM (backend), PostgreSQL, node load-generators, and host load avg / free memory.');
  md.push('');

  md.push('## TL;DR — Where the system breaks');
  md.push('');
  md.push('| Path | Healthy ceiling | Knee (p99 doubles) | Peak achieved | Verdict |');
  md.push('|---|---:|---:|---:|---|');
  for (const r of results) {
    const { lastHealthy, firstBroken } = findCeiling(r.steps);
    const knee = findKnee(r.steps);
    const peak = findPeakRps(r.steps);
    const ceiling = lastHealthy ? lastHealthy.targetRps : '—';
    const kneeAt = knee ? knee.targetRps : '—';
    const peakRps = peak ? peak.achievedRps.toFixed(0) : '—';
    let verdict;
    if (!firstBroken && peak) verdict = `stayed healthy up to ${r.steps[r.steps.length - 1].targetRps} rps (max tested)`;
    else if (lastHealthy) verdict = `breaks between ${lastHealthy.targetRps} and ${firstBroken.targetRps} rps`;
    else verdict = `already degraded at ${r.steps[0].targetRps} rps (lowest tested)`;
    md.push(`| ${r.target} | ${ceiling} rps | ${kneeAt} rps | ${peakRps} rps | ${verdict} |`);
  }
  md.push('');

  md.push('## TL;DR — Resource pressure at peak');
  md.push('');
  md.push('| Path | Peak rps | JVM RSS | JVM CPU | JVM threads | PG conns | PG active | Load avg (1m) | Free RAM |');
  md.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of results) {
    const peak = findPeakRps(r.steps);
    if (!peak || !peak.env?.during) continue;
    const e = peak.env.during;
    const jvmRss = e.jvm?.rssKb ? mb(e.jvm.rssKb / 1024) : '-';
    const jvmCpu = e.jvm?.cpuPct != null ? `${e.jvm.cpuPct.toFixed(1)}%` : '-';
    const jvmTh = e.jvm?.threads ?? '-';
    const pgConn = e.pg?.connections?.total ?? '-';
    const pgActive = e.pg?.connections?.byState?.active ?? e.pg?.connections?.byState?.idle_in_transaction ?? 0;
    const load1 = e.system?.loadAvg?.['1m']?.toFixed(2) ?? '-';
    const freeRam = e.system?.mem?.freeBytes ? mb(e.system.mem.freeBytes / 1024 / 1024) : '-';
    md.push(`| ${r.target} | ${peak.achievedRps.toFixed(0)} | ${jvmRss} | ${jvmCpu} | ${jvmTh} | ${pgConn} | ${pgActive} | ${load1} | ${freeRam} |`);
  }
  md.push('');

  for (const r of results) {
    md.push(`## ${r.target.toUpperCase()} — Step-by-step (with resources)`);
    md.push('');
    md.push(`Range: ${r.steps[0].targetRps} → ${r.steps[r.steps.length - 1].targetRps} rps, step ${r.steps[1] ? r.steps[1].targetRps - r.steps[0].targetRps : '?'} rps, ${r.stepDurationSec}s per step.`);
    md.push('');
    md.push('| Target | Achieved | % | p50 | p95 | p99 | max | Errors | JVM RSS | JVM CPU | Threads | PG conns (active) | Load1 | Free RAM |');
    md.push('|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const s of r.steps) {
      const er = envRow(s);
      const e = s.env?.during;
      const pgActive = e?.pg?.connections?.byState?.active ?? e?.pg?.connections?.byState?.idle_in_transaction ?? 0;
      const pgConn = e?.pg?.connections?.total ?? '-';
      const jvmCpu = e?.jvm?.cpuPct != null ? `${e.jvm.cpuPct.toFixed(1)}%` : '-';
      const jvmTh = e?.jvm?.threads ?? '-';
      const jvmRss = e?.jvm?.rssKb ? mb(e.jvm.rssKb / 1024) : '-';
      const load1 = e?.system?.loadAvg?.['1m']?.toFixed(2) ?? '-';
      const freeRam = e?.system?.mem?.freeBytes ? mb(e.system.mem.freeBytes / 1024 / 1024) : '-';
      const pct = s.targetRps > 0 ? (s.achievedRps / s.targetRps * 100).toFixed(0) : '-';
      const err = (s.stats.errorRate * 100).toFixed(2);
      md.push(`| ${s.targetRps} | ${s.achievedRps.toFixed(0)} | ${pct}% | ${ms(s.stats.latencyMs.p50)} | ${ms(s.stats.latencyMs.p95)} | ${ms(s.stats.latencyMs.p99)} | ${ms(s.stats.latencyMs.max)} | ${err}% | ${jvmRss} | ${jvmCpu} | ${jvmTh} | ${pgConn} (${pgActive}) | ${load1} | ${freeRam} |`);
    }
    md.push('');

    // Per-step resource summary callouts.
    const peakStep = findPeakRps(r.steps);
    if (peakStep && peakStep.env?.during) {
      const e = peakStep.env.during;
      md.push(`**Peak step (${peakStep.targetRps} rps, achieved ${peakStep.achievedRps.toFixed(0)}):**`);
      md.push('');
      md.push(`- JVM: RSS=${mb((e.jvm.rssKb || 0) / 1024)}, CPU=${e.jvm.cpuPct?.toFixed(1)}%, threads=${e.jvm.threads}, fds=${e.jvm.fds}`);
      md.push(`- PostgreSQL: ${e.pg.connections.total} connections (${JSON.stringify(e.pg.connections.byState)}), DB size=${mb((e.pg.sizes.dbBytes || 0) / 1024 / 1024)}, table sizes: users=${mb((e.pg.sizes.usersBytes || 0) / 1024 / 1024)}, shorten_url=${mb((e.pg.sizes.shortenUrlBytes || 0) / 1024 / 1024)}`);
      md.push(`- Host: load avg ${e.system.loadAvg['1m'].toFixed(2)} / ${e.system.loadAvg['5m'].toFixed(2)} / ${e.system.loadAvg['15m'].toFixed(2)} on ${e.system.cores} cores, free RAM=${mb(e.system.mem.freeBytes / 1024 / 1024)} / total=${mb(e.system.mem.totalBytes / 1024 / 1024)}`);
      if (e.nodeClients && e.nodeClients.length > 0) {
        md.push(`- Load generators (${e.nodeClients.length}):`);
        for (const c of e.nodeClients) {
          md.push(`  - pid ${c.pid}: ${mb(c.rssKb / 1024)} RSS, ${c.cpuPct}% CPU (${c.kind})`);
        }
      }
      md.push('');
    }
  }

  md.push('## Environment summary');
  md.push('');
  // First-step baseline from first result to characterize the system.
  const baseline = results[0]?.steps[0]?.env?.baseline;
  if (baseline) {
    md.push(`Captured at the start of the first run:`);
    md.push('');
    md.push(`- **Host**: ${baseline.system.cores} CPU cores, ${mb(baseline.system.mem.totalBytes / 1024 / 1024)} RAM`);
    if (baseline.jvm?.found) {
      md.push(`- **Backend JVM**: pid ${baseline.jvm.pid}, RSS=${mb((baseline.jvm.rssKb || 0) / 1024)}, threads=${baseline.jvm.threads}, fds=${baseline.jvm.fds}`);
    }
    if (baseline.pg?.ok) {
      md.push(`- **PostgreSQL**: ${baseline.pg.counts.users.toLocaleString()} users, ${baseline.pg.counts.urls.toLocaleString()} urls, DB size=${mb(baseline.pg.sizes.dbBytes / 1024 / 1024)}, connections=${baseline.pg.connections.total}`);
    }
  }
  md.push('');
  md.push('## How to read this');
  md.push('');
  md.push('- **Healthy ceiling**: highest target rps where p99 < 500ms, errors < 1%, achieved ≥ 70% of target.');
  md.push('- **Knee**: first target rps where p99 doubles vs the lowest tested step (or ≥100ms).');
  md.push('- **Peak achieved**: raw throughput the server delivered, regardless of target.');
  md.push('- **JVM RSS / CPU / threads**: read from `/proc/<pid>/{status,stat}`. CPU% is a 200ms delta sample per step.');
  md.push('- **PG conns (active)**: from `pg_stat_activity`. HikariCP `maximum-pool-size` in this app is **20** — if active saturates near that, the bottleneck is the connection pool.');
  md.push('- **Load1**: 1-minute load average from the host. A number ≈ cores means the host is busy; >> cores means a queue is forming.');
  md.push('');
  md.push('---');
  md.push('');
  md.push(`Generated by \`benchmark/lib/threshold-reporter.js\`.`);
  return md.join('\n');
}

function main() {
  const inDir = process.argv[2] || 'threshold-results';
  const outDir = process.argv[3] || inDir;
  const files = fs.readdirSync(inDir).filter((f) => f.startsWith('threshold-') && f.endsWith('.json'));
  const results = files.map((f) => JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8')));
  const md = writeReport(results, outDir);
  fs.writeFileSync(path.join(outDir, 'threshold-report.md'), md);
  fs.writeFileSync(path.join(outDir, 'threshold-report.json'), JSON.stringify(results, null, 2));
  console.log(`[threshold-reporter] wrote threshold-report.md + threshold-report.json to ${outDir}`);
}

if (require.main === module) main();
module.exports = { writeReport, findCeiling, findKnee, findPeakRps };
