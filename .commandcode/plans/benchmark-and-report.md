# Benchmark & Report Plan

## Context

The system is now seeded with **8,705 users** and **22,317,518 short URLs** in PostgreSQL. The backend is a Spring Boot 4.1.0 / Java 21 monolithic service on `localhost:8080` (context-path `/api`). Redis is configured but **not used as a cache** (current branch: `monolithic_no_cache`).

No benchmark tooling exists in the repo. We need a self-contained load harness that:
- Hits the **public read path** (`GET /shorten/{code}` → 308 redirect, no auth, hits DB and bumps `access_count` atomically).
- Hits the **authenticated write path** (`POST /shorten/create`, requires JWT).
- Runs at increasing concurrency to find the breaking point.
- Produces a human-readable report + raw data for analysis.

**API surface** (confirmed via exploration):
- `POST /api/auth/login` → `{ data: { token: "<jwt>" } }`
- `POST /api/auth/register` → empty `ApiResponse`
- `POST /api/shorten/create` (Bearer JWT) → 201, body `{ data: { id, url, shortCode, ... } }`
- `GET /api/shorten/{code}` → 308 redirect to original URL (no auth, public)

**Auth for the load test**: Login as the first seeded user (`user000001` / `Passw0rd!` — BCrypt hash in the SQL seeder). Reuse one JWT for all writers (login is not what we're benchmarking).

---

## Deliverables

```
benchmark/
├── README.md                    # how to run
├── package.json                 # zero runtime deps — uses Node core + built-in fetch
├── run.sh                       # one-shot runner: warmup + scenarios + report
├── lib/
│   ├── http.js                  # tiny HTTP client w/ latency tracking
│   ├── stats.js                 # percentile calc (p50/p90/p95/p99/min/max/mean)
│   ├── login.js                 # one-time login helper
│   └── reporter.js              # writes markdown + json + csv
├── scenarios/
│   ├── read-only.js             # GET /shorten/{code} at N concurrency
│   ├── write-only.js            # POST /shorten/create at N concurrency
│   └── mixed.js                 # 80% read / 20% write
├── results/                     # gitignored, populated by run.sh
│   ├── 2026-06-21T15-30-00/
│   │   ├── summary.md
│   │   ├── results.json
│   │   ├── requests.csv
│   │   └── per-scenario/
│   │       ├── read-c0100.json
│   │       ├── write-c0100.json
│   │       └── mixed-c0100.json
└── .gitignore
```

---

## Implementation

### 1. `benchmark/lib/http.js` — minimal HTTP client with timing

Pure Node `http` module (already in use in `backend/seed.js`). Mirrors the seeder's `postJson` pattern.

Key API:
```js
async function request({ method, path, body, token }) → { status, latencyMs, body, error }
```
- Returns `status: 0` and `error` for network failures (don't throw — we want to count them as failed requests).
- Records wall-clock latency from `req.write()` start to `res.on('end')`.
- Reads response body but truncates to 1KB (redirects have no body; create responses are small).

### 2. `benchmark/lib/stats.js` — percentile aggregation

Pure function over a numeric array:
```js
function summarize(samples) → {
  count, ok, errors, errorRate,
  rps,                        # computed from elapsed seconds
  latencyMs: { min, max, mean, p50, p90, p95, p99, stddev }
}
```
- `p99` uses nearest-rank method (no external dep).
- `stddev` is sample stddev.
- Status code histogram (`{ "200": 1234, "308": 5678, "401": 2, "500": 0, "0": 1 }`).

### 3. `benchmark/lib/login.js` — get a JWT

```js
async function login(baseUrl, username, password) → token
```
Hits `POST /api/auth/login`. Used once at the start of `run.sh`. User `user000001` exists in the seeded data with the known BCrypt hash for `Passw0rd!`.

### 4. Scenarios (`benchmark/scenarios/*.js`)

Each scenario exports:
```js
module.exports = {
  name: 'read-c0100',
  kind: 'read' | 'write' | 'mixed',
  concurrency: 100,
  durationSec: 30,
  run: async ({ baseUrl, token, samples }) => { ... }
}
```

Internals:
- Spawn N worker promises sharing an index counter (same pattern as `backend/seed.js` `runPool`).
- Each worker:
  - **read**: pick a random short code from a preloaded list of real short codes (loaded once at start of `read` scenarios by reading 1k rows from the DB — see "short code sampling" below).
  - **write**: build a valid `CreateRequest` (random `https://example.com/...` URL, omit `shortCode` to let the backend generate one).
  - **mixed**: 80% reads / 20% writes (per request).
- Push a sample `{ status, latencyMs, ts }` into the shared `samples` array (pre-allocated, `samples.length` is the only sync point per worker).
- Workers terminate when `Date.now() - start >= durationSec * 1000`.

**Short code sampling** (read scenarios):
- One Node process talks directly to Postgres via `pg` (installed in `benchmark/node_modules`).
- On first read scenario, run `SELECT short_code FROM shorten_url TABLESAMPLE BERNOULLI(0.01) LIMIT 1000` to get a stable working set.
- Cache the list in memory; each read worker picks uniformly at random.
- This avoids hot-spotting one row and gives realistic cache-miss behavior on the DB side.

**Warmup**: each scenario starts with a 5-second warmup pass (results discarded) so JIT/connection pools stabilize.

### 5. `benchmark/run.sh` — orchestrator

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# 1. health check
curl -fsS http://localhost:8080/api/actuator/health || { echo "backend down"; exit 1; }

# 2. login → write token to .token file
BASE_URL=http://localhost:8080/api node lib/login.js > .token

# 3. for each (scenario, concurrency) in the matrix:
#      read   × 10 50 100 200 500
#      write  × 10 50 100 200
#      mixed  × 50 100 200
#    run scenarios/<kind>.js → JSON to results/<run>/per-scenario/<name>.json

# 4. node lib/reporter.js results/<run> → summary.md + results.json + requests.csv
```

**Concurrency matrix** (ramp):
- Reads: 10, 50, 100, 200, 500
- Writes: 10, 50, 100, 200
- Mixed: 50, 100, 200
- 30s per scenario, 5s warmup. Total runtime ≈ 14 × 35s = ~8 min.

### 6. `benchmark/lib/reporter.js` — output

Reads all `per-scenario/*.json` files. Produces:

**`summary.md`** with:
- Header (when, what, seed size)
- Verdict (auto-detected: where things break)
- Results table: `| scenario | concurrency | rps | p50 | p95 | p99 | error % |`
- Observations (auto-generated bullet list calling out inflection points)

**`results.json`**: full structured data, one entry per scenario, includes status histogram.

**`requests.csv`**: long-form `(timestamp, scenario, status, latencyMs, kind)` for post-hoc analysis in pandas/Excel.

---

## Key Files to Create

| Path | Purpose |
|---|---|
| `benchmark/package.json` | name + scripts (no deps; uses Node 18+) |
| `benchmark/.gitignore` | ignores `results/`, `.token`, `node_modules` |
| `benchmark/README.md` | how to run, what the matrix is, how to read the report |
| `benchmark/run.sh` | one-shot orchestrator |
| `benchmark/lib/http.js` | HTTP client with timing |
| `benchmark/lib/stats.js` | percentile summarization |
| `benchmark/lib/login.js` | one-time JWT fetch |
| `benchmark/lib/pg-client.js` | thin `pg` wrapper for short-code sampling |
| `benchmark/lib/reporter.js` | markdown + json + csv writer |
| `benchmark/scenarios/read-only.js` | read load generator |
| `benchmark/scenarios/write-only.js` | write load generator |
| `benchmark/scenarios/mixed.js` | 80/20 mix |

## Reused Patterns (from `backend/seed.js`)

- `runPool` promise-pool pattern for concurrency (lines 138–151).
- `postJson` shape for HTTP requests (lines 31–53).
- Username/password generation (skipped — we use a known seeded user).

## Verification

1. **Smoke test**: `node benchmark/scenarios/read-only.js --concurrency 5 --duration 5` should produce a JSON file with >0 successful 308s.
2. **Login check**: `node benchmark/lib/login.js` should print a JWT.
3. **Full run**: `bash benchmark/run.sh` should produce `benchmark/results/<timestamp>/summary.md` with a populated results table.
4. **Sanity check the report**: p50 on reads at c10 should be <50ms (DB hit only, no cache).
5. **Stop cleanly on failure**: if any scenario has error rate >50% mid-run, abort and report — don't waste time on a broken setup.

## Out of Scope (intentionally)

- **No k6/wrk/autocannon** — keeping zero deps makes it portable to any machine with Node 18+.
- **No Prometheus/Grafana** — actuator metrics exist but we don't scrape them; the script measures client-side latency + status codes, which is the user-facing truth.
- **No `monolithic_with_cache` run** — current branch is `monolithic_no_cache`; caching side is a separate task.
- **No k8s/docker orchestration** — the backend already runs locally; we test what's there.
