// lib/env-sampler.js — resource snapshot helpers for the benchmark report.
// Captures: JVM (backend), PostgreSQL, node clients, system load.
// Pure /proc + ps + pg_stat_activity — no extra deps.

const fs = require('fs');
const { execSync } = require('child_process');
const { Client } = require('pg');

const DB_URL = process.env.DB_URL || 'postgresql://postgres:12345@localhost:5432/shorten_url';

function shell(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim(); }
  catch { return null; }
}

// Find Java process for the backend (matches classpath containing BackendApplication).
function findBackendPid() {
  try {
    const out = shell("ps -eo pid,cmd --no-headers");
    for (const line of out.split('\n')) {
      if (/com\.backend\.BackendApplication/.test(line) && /java/.test(line)) {
        const m = line.match(/^\s*(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
    }
  } catch {}
  return null;
}

// Read /proc/<pid>/status for VmRSS, VmSize, Threads, etc.
function readProcStatus(pid) {
  if (!pid) return null;
  try {
    const txt = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    const out = {};
    for (const line of txt.split('\n')) {
      const m = line.match(/^(\w+):\s+(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
    return out;
  } catch { return null; }
}

function parseKb(str) {
  if (!str) return 0;
  const m = String(str).match(/^(\d+)\s*kB/);
  return m ? parseInt(m[1], 10) : 0;
}

// CPU% via /proc/<pid>/stat deltas across two samples.
// Uses a long interval (800ms) for a stable reading under bursty load.
async function cpuPercent(pid, intervalMs = 800) {
  if (!pid) return 0;
  function read() {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      // field 14 = utime, 15 = stime (1-based; after comm which is in parens)
      const m = stat.match(/^(\d+) \((.+)\) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)/);
      if (!m) return null;
      return { utime: parseInt(m[14], 10), stime: parseInt(m[15], 10), t: Date.now() };
    } catch { return null; }
  }
  const a = read();
  await new Promise((r) => setTimeout(r, intervalMs));
  const b = read();
  if (!a || !b) return 0;
  const dCpu = (b.utime + b.stime) - (a.utime + a.stime);
  const dT = (b.t - a.t) / 1000;
  const cores = require('os').cpus().length || 1;
  return cores > 0 ? (dCpu / dT / 100 / cores) * 100 : 0;
}

// FD count.
function fdCount(pid) {
  if (!pid) return 0;
  try {
    return fs.readdirSync(`/proc/${pid}/fd`).length;
  } catch { return 0; }
}

async function sampleJvm() {
  const pid = findBackendPid();
  if (!pid) return { found: false };
  const st = readProcStatus(pid);
  if (!st) return { found: false };
  const cpuPct = await cpuPercent(pid);
  return {
    found: true,
    pid,
    rssKb: parseKb(st.VmRSS),
    vszKb: parseKb(st.VmSize),
    threads: parseInt(st.Threads || '0', 10),
    fds: fdCount(pid),
    cpuPct: Number(cpuPct.toFixed(2)),
    state: st.State,
  };
}

async function samplePg() {
  const client = new Client({ connectionString: DB_URL, statement_timeout: 5000 });
  let result = { ok: false };
  try {
    await client.connect();
    const conns = await client.query(`
      SELECT state, count(*)::int AS n
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state
    `);
    const connTotal = conns.rows.reduce((a, r) => a + r.n, 0);
    const connByState = {};
    for (const r of conns.rows) connByState[r.state || 'unknown'] = r.n;
    const sizes = await client.query(`
      SELECT
        pg_database_size(current_database()) AS db_bytes,
        pg_total_relation_size('users') AS users_bytes,
        pg_total_relation_size('shorten_url') AS shorten_url_bytes
    `);
    const s = sizes.rows[0];
    const counts = await client.query(`
      SELECT
        (SELECT count(*) FROM users)::bigint AS users,
        (SELECT count(*) FROM shorten_url)::bigint AS urls
    `);
    const c = counts.rows[0];
    result = {
      ok: true,
      connections: { total: connTotal, byState: connByState },
      sizes: {
        dbBytes: parseInt(s.db_bytes, 10),
        usersBytes: parseInt(s.users_bytes, 10),
        shortenUrlBytes: parseInt(s.shorten_url_bytes, 10),
      },
      counts: { users: parseInt(c.users, 10), urls: parseInt(c.urls, 10) },
    };
  } catch (e) {
    result = { ok: false, error: e.message };
  } finally {
    try { await client.end(); } catch {}
  }
  return result;
}

function sampleSystem() {
  const cpus = require('os').cpus();
  const loadAvg = require('os').loadavg();
  const totalMem = require('os').totalmem();
  const freeMem = require('os').freemem();
  // CPU usage via /proc/stat delta (cheap).
  function readStat() {
    const txt = fs.readFileSync('/proc/stat', 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith('cpu '));
    const parts = line.split(/\s+/).slice(1).map(Number);
    const idle = parts[3] + (parts[4] || 0);
    const total = parts.reduce((a, b) => a + b, 0);
    return { idle, total };
  }
  const a = readStat();
  const usedPct = (() => {
    // We can't easily synchronously wait — return load-based heuristic plus 1-shot snapshot.
    return null;
  })();
  return {
    cores: cpus.length,
    loadAvg: { '1m': loadAvg[0], '5m': loadAvg[1], '15m': loadAvg[2] },
    mem: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: totalMem - freeMem,
      freePct: totalMem > 0 ? (freeMem / totalMem) * 100 : 0,
    },
  };
}

// Aggregate Node client stats — find all node processes running scenarios/*.js
async function sampleNodeClients() {
  try {
    const out = shell("ps -eo pid,rss,vsz,pcpu,cmd --no-headers");
    if (!out) return [];
    const result = [];
    for (const line of out.split('\n')) {
      if (/scenarios\/(threshold|read-only|write-only|mixed)/.test(line)) {
        const parts = line.trim().split(/\s+/);
        result.push({
          pid: parseInt(parts[0], 10),
          rssKb: parseInt(parts[1], 10),
          vszKb: parseInt(parts[2], 10),
          cpuPct: parseFloat(parts[3] || '0'),
          kind: (line.match(/scenarios\/(\S+)\.js/) || [])[1] || 'unknown',
        });
      }
    }
    return result;
  } catch { return []; }
}

async function snapshot({ includePg = true } = {}) {
  const [jvm, pg, nodeClients] = await Promise.all([
    sampleJvm(),
    includePg ? samplePg() : Promise.resolve(null),
    sampleNodeClients(),
  ]);
  return {
    ts: new Date().toISOString(),
    jvm,
    pg,
    system: sampleSystem(),
    nodeClients,
  };
}

module.exports = { snapshot, sampleJvm, samplePg, sampleNodeClients, sampleSystem };
