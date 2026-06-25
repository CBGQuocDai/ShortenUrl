# Performance Test - ShortenUrl

## Tool

This project uses Grafana k6 to test the public gateway flow:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/v1/shorten/create`
- `GET /api/v1/shorten/:shortCode`
- `GET /api/v1/shorten/list`

The k6 script is at `benchmark/k6_shorten_url.js`. It creates a test user, logs in, seeds short URLs, then runs an 80% resolve, 15% list, 5% create workload.

## Run

If k6 is installed locally:

```bash
PROFILE=smoke k6 run benchmark/k6_shorten_url.js
PROFILE=load k6 run benchmark/k6_shorten_url.js
PROFILE=stress k6 run benchmark/k6_shorten_url.js
```

If k6 is not installed, run it with Docker from the repo root:

```bash
docker run --rm --network host \
  -e PROFILE=smoke \
  -e BASE_URL=http://localhost:3000 \
  -v "$PWD/benchmark:/scripts" \
  grafana/k6 run /scripts/k6_shorten_url.js
```

Useful variables:

- `BASE_URL`: gateway URL, default `http://localhost:3000`
- `PROFILE`: `smoke`, `load`, or `stress`
- `SEED_URLS`: number of short URLs created in setup, default `24`
- `SLEEP`: per-iteration sleep in seconds, default `0.1`

## Latest Local Result

Run time: 2026-06-25, local Docker Compose stack, gateway `http://localhost:3000`.

Command:

```bash
docker run --rm --network host \
  -e PROFILE=load \
  -e BASE_URL=http://localhost:3000 \
  -v "$PWD/benchmark:/scripts" \
  grafana/k6 run /scripts/k6_shorten_url.js
```

Profile:

- Ramp up to 25 VUs for 20 seconds
- Hold 25 VUs for 1 minute
- Ramp down for 20 seconds
- Workload mix: 80% resolve, 15% list, 5% create

Result:

| Metric | Value |
| --- | ---: |
| Total HTTP requests | 19,439 |
| Throughput | 192.78 req/s |
| Failure rate | 0.00% |
| Checks passed | 36,023 / 36,023 |
| HTTP avg latency | 2.91 ms |
| HTTP p95 latency | 16.53 ms |
| HTTP p99 latency | 26.64 ms |
| Resolve p95 latency | 5.64 ms |
| Created URLs during run | 1,019 |

Conclusion: the current local stack handles the mixed gateway workload at 25 VUs cleanly, with no failed requests and low p95 latency. For capacity limits, run the `stress` profile next and watch CPU, MySQL connections, Redis ops, and Nginx upstream errors.

## Redirect Capacity Result

Run time: 2026-06-25, redirect-only workload through gateway `http://localhost:3000`.

Command pattern:

```bash
docker run --rm --network host \
  -e PROFILE=redirect_rate \
  -e MODE=redirect \
  -e SLEEP=0 \
  -e RATE=500 \
  -e DURATION=45s \
  -e BASE_URL=http://localhost:3000 \
  -v "$PWD/benchmark:/scripts" \
  grafana/k6 run /scripts/k6_shorten_url.js
```

Fixed-rate results:

| Target rate | Actual HTTP req/s | Failure rate | Dropped iterations | p95 latency | Result |
| ---: | ---: | ---: | ---: | ---: | --- |
| 500 req/s | 492.40 req/s | 0.00% | 0 | 14.73 ms | Clean |
| 550 req/s | 535.92 req/s | 0.00% | 110 | 448.59 ms | Pass, latency rising |
| 600 req/s | 428.02 req/s | 0.00% | 5,241 | 4.74 s | Cannot sustain rate |
| 700 req/s | 580.01 req/s | 22.77% | 3,491 | 2.89 s | Fails |

Ramp result:

- Ramp 100 -> 250 -> 500 VUs produced 127,703 HTTP requests over 2m50s.
- Average throughput was 747.68 req/s, but failure rate was 40.71%.
- p95 latency was 947.67 ms and p99 latency was 3.57 s.

Capacity conclusion:

- Safe redirect throughput for this local single-host Docker Compose setup is about 500 req/s with low latency.
- 550 req/s still returns 100% HTTP 200 in this short test, but latency rises sharply and k6 starts dropping scheduled iterations.
- The system starts falling behind at around 600 req/s.
- 700 req/s is beyond capacity for the current setup.

Observed bottleneck:

- `go-shorten-service` logs show many slow `UPDATE access_count` queries during redirect pressure, around 200-800 ms each.
- Redirect reads are cached by Redis, but each redirect still schedules a MySQL access-count update, so MySQL write pressure becomes the limiting factor.

## 10k Redirect Optimization Result

Run time: 2026-06-25, after redirect-path optimization.

Changes applied:

- `go-shorten-service`: disabled Gin request logging on the hot path.
- `go-shorten-service`: changed `access_count` from one MySQL update per redirect to an in-memory queue with 1-second batch flushes.
- `go-shorten-service`: added local `shortCode -> id` cache to avoid a second Redis lookup for click counting.
- `web` Nginx: disabled API access logs.
- `web` Nginx: added upstream keepalive for `go-shorten-service` and `sso-service`.
- k6: added `FAST_CHECK=true` mode to discard response bodies and avoid making the load generator the bottleneck.

Command:

```bash
docker run --rm --network host \
  -e PROFILE=redirect_rate \
  -e MODE=redirect \
  -e SLEEP=0 \
  -e FAST_CHECK=true \
  -e RATE=10000 \
  -e DURATION=45s \
  -e PRE_ALLOCATED_VUS=1000 \
  -e MAX_VUS=5000 \
  -e BASE_URL=http://localhost:3000 \
  -v "$PWD/benchmark:/scripts" \
  grafana/k6 run /scripts/k6_shorten_url.js
```

Result:

| Metric | Value |
| --- | ---: |
| Target rate | 10,000 req/s |
| Total HTTP requests | 450,027 |
| Completed redirects | 450,001 |
| Actual throughput | 9,842.36 req/s |
| Failure rate | 0.00% |
| Checks passed | 450,052 / 450,052 |
| Dropped iterations | 2 |
| HTTP avg latency | 2.67 ms |
| HTTP p90 latency | 7.51 ms |
| HTTP p95 latency | 15.57 ms |
| HTTP p99 latency | 37.66 ms |
| Max latency | 260.31 ms |

Conclusion:

- The optimized local Docker Compose stack sustained the 10k redirect target with 0% HTTP failures.
- The measured throughput is 9,842 req/s because k6 reported 2 dropped scheduled iterations and includes setup/teardown time in the overall rate.
- Access counts are now eventually consistent: redirects enqueue click IDs in memory and the worker flushes aggregate increments to MySQL every second.

Trade-off:

- This implementation is suitable for high-throughput local testing and short-lived process restarts, but a production-grade counter should use Redis `INCR` or a durable queue to avoid losing in-memory counts if the process crashes before the next flush.

## Upper-Bound Redirect Probe

Run time: 2026-06-25, same optimized stack, redirect-only through gateway.

Commands used the same `PROFILE=redirect_rate`, `MODE=redirect`, `SLEEP=0`, and `FAST_CHECK=true` settings, changing only `RATE` and VU allocation.

| Target rate | Actual HTTP req/s | Failure rate | Dropped iterations | p95 latency | Result |
| ---: | ---: | ---: | ---: | ---: | --- |
| 14,000 req/s | 13,610.38 req/s | 0.00% | 7,809 | 60.94 ms | Near sustainable, slight scheduling loss |
| 15,000 req/s | 14,321.19 req/s | 0.00% | 20,278 | 80.41 ms | Does not fully sustain target |
| 16,000 req/s | 14,940.46 req/s | 0.00% | 35,088 | 105.75 ms | Does not fully sustain target |
| 20,000 req/s | 15,732.85 req/s | 0.00% | 179,281 | 188.00 ms | Beyond current capacity |

Upper-bound conclusion:

- The system keeps returning HTTP 200 up to a 20k target in this short test, but it cannot schedule or complete 20k req/s.
- Practical sustained redirect throughput on this local machine is around 13.5k-14k req/s.
- The clean operating point remains 10k req/s: almost no dropped iterations, low latency, and 0% failures.

## GCloud 2 vCPU / 4 GB Redirect Probe

Run time: 2026-06-25, public endpoint `https://shortenurl.daidq.io.vn`.

Environment notes:

- Target host is a GCloud VM with 2 vCPU and 4 GB RAM.
- The public domain is behind Cloudflare, so results include client network, TLS, Cloudflare edge, and the VM stack.
- Workload is redirect-only: `GET /api/v1/shorten/:shortCode`.
- k6 uses `FAST_CHECK=true`, so response bodies are discarded and only status code is checked.

Command pattern:

```bash
docker run --rm --network host \
  -e PROFILE=redirect_rate \
  -e MODE=redirect \
  -e SLEEP=0 \
  -e FAST_CHECK=true \
  -e RATE=800 \
  -e DURATION=45s \
  -e PRE_ALLOCATED_VUS=800 \
  -e MAX_VUS=4000 \
  -e BASE_URL=https://shortenurl.daidq.io.vn \
  -v "$PWD/benchmark:/scripts" \
  grafana/k6 run /scripts/k6_shorten_url.js
```

Results:

| Target rate | Completed redirects | Failed redirects | Dropped iterations | p95 latency | p99 latency | Result |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 req/s | 4,499 / 4,500 | 1 | 0 | 290.42 ms | 622.66 ms | Pass |
| 200 req/s | 8,999 / 9,000 | 1 | 0 | 271.13 ms | 343.31 ms | Pass |
| 400 req/s | 18,000 / 18,000 | 0 | 0 | 282.78 ms | 386.05 ms | Clean |
| 800 req/s | 35,998 / 36,000 | 2 | 0 | 370.92 ms | 745.31 ms | Pass, near practical limit |
| 900 req/s | 40,470 / 40,497 | 27 | 4 | 311.27 ms | 512.36 ms | Edge, intermittent timeouts |
| 1,000 req/s | 44,022 / 44,044 | 22 | 957 | 747.12 ms | 2.21 s | Not clean |
| 1,200 req/s | 52,321 / 52,395 | 74 | 1,606 | 1.65 s | 5.75 s | Fails latency target |

GCloud capacity conclusion:

- Safe public redirect capacity is about 800 req/s.
- 900 req/s is close to the edge: the run mostly completes, but timeout bursts appear.
- 1,000 req/s and above should not be considered stable for this VM/public path.
- Compared with local testing, public latency is much higher, around 230-300 ms baseline per redirect.
