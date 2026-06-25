# Benchmark

Zero-dep Node.js load harness for the URL shortener backend on `http://localhost:8080/api`.

## What it does

Runs three load scenarios at increasing concurrency, then writes a Markdown report + raw JSON + CSV.

| Scenario | Endpoint | Concurrency levels |
|---|---|---|
| `read`  | `GET  /shorten/{code}` (public, no auth) | 10 / 50 / 100 / 200 / 500 |
| `write` | `POST /shorten/create` (JWT required)   | 10 / 50 / 100 / 200       |
| `mixed` | 80% read + 20% write                    | 50 / 100 / 200             |

Each scenario: 5s warmup (discarded) + 30s measured.

## Run it

```bash
cd benchmark
npm install                # one-time, installs only `pg`
bash run.sh                # ~8 min
```

Output: `benchmark/results/<timestamp>/`
- `summary.md` — human-readable report
- `results.json` — structured per-scenario stats
- `requests.csv` — long-form `(timestamp, scenario, status, latencyMs, kind)`
- `per-scenario/<name>.json` — raw per-request samples (1 row = 1 sample)

## Configuration (env vars)

| Var | Default | Notes |
|---|---|---|
| `BASE_URL` | `http://localhost:8080/api` | backend root |
| `DB_URL` | `postgresql://postgres:12345@localhost:5432/shorten_url` | for short-code sampling |
| `BENCH_USER` | `user000001` | seeded user for login |
| `BENCH_PASS` | `Passw0rd!` | password for that user (matches SQL seeder BCrypt hash) |
| `WARMUP_SEC` | `5` | warmup duration per scenario |
| `DURATION_SEC` | `30` | measured duration per scenario |

## Files

```
benchmark/
├── lib/
│   ├── http.js        # HTTP client with per-request timing
│   ├── stats.js       # percentile aggregation
│   ├── login.js       # one-time JWT fetch
│   ├── pg-client.js   # short-code sampling
│   └── reporter.js    # md/json/csv writer
├── scenarios/
│   ├── read-only.js
│   ├── write-only.js
│   └── mixed.js
└── run.sh             # orchestrator
```

## How to read the report

- **rps** — measured throughput (req/s) over the 30s window.
- **p50/p95/p99** — latency percentiles in ms. p99 is the most useful for spotting tail-latency regressions.
- **Error %** — non-2xx / non-3xx responses (4xx + 5xx + network failures).
- **Status histogram** — counts per status code. Look for spikes in `5xx` or `0` (network error).

**Saturation signal**: rps plateaus or drops as concurrency increases, while p99 climbs sharply. That's your ceiling.
