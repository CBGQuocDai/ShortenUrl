# System Threshold & Resource Report — 2026-06-22T01:38:02.700Z

Open-loop rps ramp: offered load controlled by the client, measured at each step.
Failure criteria: p99 ≥ 500ms, errors ≥ 1%, or achieved < 70% of target.

Resource snapshots are taken at the **end of each step** (during-load), capturing the JVM (backend), PostgreSQL, node load-generators, and host load avg / free memory.

## TL;DR — Where the system breaks

| Path | Healthy ceiling | Knee (p99 doubles) | Peak achieved | Verdict |
|---|---:|---:|---:|---|
| mixed | 3200 rps | — rps | 2389 rps | breaks between 3200 and 3500 rps |
| read | 8000 rps | — rps | 5894 rps | breaks between 8000 and 9000 rps |
| write | 1700 rps | — rps | 1356 rps | breaks between 1700 and 2000 rps |

## TL;DR — Resource pressure at peak

| Path | Peak rps | JVM RSS | JVM CPU | JVM threads | PG conns | PG active | Load avg (1m) | Free RAM |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| mixed | 2389 | 605MB | 0.2% | 173 | 81 | 1 | 28.09 | 6.3GB |
| read | 5894 | 564MB | 0.2% | 141 | 22 | 1 | 26.08 | 6.0GB |
| write | 1356 | 598MB | 0.2% | 173 | 81 | 1 | 53.99 | 6.2GB |

## MIXED — Step-by-step (with resources)

Range: 200 → 3800 rps, step 300 rps, 20s per step.

| Target | Achieved | % | p50 | p95 | p99 | max | Errors | JVM RSS | JVM CPU | Threads | PG conns (active) | Load1 | Free RAM |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 200 | 206 | 103% | 6.08ms | 38.4ms | 119ms | 134ms | 0.00% | 553MB | 0.0% | 172 | 81 (1) | 38.80 | 6.3GB |
| 500 | 506 | 101% | 1.43ms | 14.7ms | 52.5ms | 77.6ms | 0.00% | 553MB | 0.0% | 172 | 81 (1) | 26.18 | 6.2GB |
| 800 | 806 | 101% | 1.25ms | 15.5ms | 46.3ms | 65.5ms | 0.00% | 553MB | 0.0% | 172 | 81 (1) | 19.08 | 6.2GB |
| 1100 | 1106 | 101% | 1.49ms | 7.86ms | 28.0ms | 60.6ms | 0.00% | 553MB | 0.0% | 172 | 81 (1) | 14.07 | 6.3GB |
| 1400 | 1406 | 100% | 1.86ms | 9.66ms | 30.3ms | 52.9ms | 0.00% | 553MB | 0.2% | 172 | 81 (1) | 11.58 | 6.2GB |
| 1700 | 1706 | 100% | 2.57ms | 11.6ms | 25.8ms | 70.8ms | 0.00% | 553MB | 0.0% | 172 | 81 (1) | 12.34 | 6.4GB |
| 2000 | 2006 | 100% | 7.09ms | 28.0ms | 61.2ms | 192ms | 0.00% | 553MB | 0.0% | 173 | 81 (1) | 13.91 | 6.3GB |
| 2300 | 2304 | 100% | 22.0ms | 63.1ms | 100ms | 259ms | 0.00% | 553MB | 0.0% | 173 | 81 (1) | 18.39 | 6.4GB |
| 2600 | 2389 | 92% | 44.8ms | 92.2ms | 132ms | 318ms | 0.00% | 605MB | 0.2% | 173 | 81 (1) | 28.09 | 6.3GB |
| 2900 | 2316 | 80% | 50.3ms | 98.9ms | 142ms | 316ms | 0.00% | 605MB | 0.0% | 173 | 81 (1) | 36.64 | 6.3GB |
| 3200 | 2312 | 72% | 50.7ms | 97.4ms | 137ms | 286ms | 0.00% | 605MB | 0.3% | 173 | 81 (1) | 40.82 | 6.3GB |
| 3500 | 2319 | 66% | 50.1ms | 97.1ms | 149ms | 378ms | 0.00% | 605MB | 0.0% | 172 | 81 (1) | 43.41 | 6.3GB |
| 3800 | 2295 | 60% | 51.3ms | 95.8ms | 137ms | 278ms | 0.00% | 606MB | 0.0% | 173 | 81 (1) | 48.56 | 6.3GB |

**Peak step (2600 rps, achieved 2389):**

- JVM: RSS=605MB, CPU=0.2%, threads=173, fds=363
- PostgreSQL: 81 connections ({"active":1,"idle":80}), DB size=4.5GB, table sizes: users=2MB, shorten_url=4.5GB
- Host: load avg 28.09 / 22.87 / 13.79 on 8 cores, free RAM=6.3GB / total=15.3GB
- Load generators (1):
  - pid 33395: 111MB RSS, 30.3% CPU (threshold-mixed)

## READ — Step-by-step (with resources)

Range: 1000 → 11000 rps, step 1000 rps, 20s per step.

| Target | Achieved | % | p50 | p95 | p99 | max | Errors | JVM RSS | JVM CPU | Threads | PG conns (active) | Load1 | Free RAM |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1000 | 1003 | 100% | 0.78ms | 8.55ms | 84.0ms | 322ms | 0.00% | 514MB | 0.0% | 142 | 22 (1) | 1.72 | 6.0GB |
| 2000 | 2003 | 100% | 0.90ms | 1.95ms | 5.82ms | 18.2ms | 0.00% | 514MB | 0.0% | 142 | 22 (1) | 1.38 | 6.0GB |
| 3000 | 3003 | 100% | 1.31ms | 3.87ms | 9.38ms | 45.6ms | 0.00% | 514MB | 0.0% | 141 | 22 (1) | 3.21 | 6.0GB |
| 4000 | 4003 | 100% | 1.81ms | 5.12ms | 9.87ms | 80.5ms | 0.00% | 514MB | 0.0% | 141 | 22 (1) | 4.48 | 5.9GB |
| 5000 | 5002 | 100% | 4.51ms | 11.4ms | 19.0ms | 62.8ms | 0.00% | 515MB | 0.2% | 141 | 22 (1) | 9.00 | 5.9GB |
| 6000 | 5846 | 97% | 9.61ms | 17.2ms | 23.9ms | 103ms | 0.00% | 563MB | 0.2% | 141 | 22 (1) | 16.93 | 5.9GB |
| 7000 | 5891 | 84% | 10.1ms | 17.7ms | 24.9ms | 112ms | 0.00% | 563MB | 0.0% | 141 | 22 (1) | 21.52 | 5.9GB |
| 8000 | 5894 | 74% | 10.2ms | 17.7ms | 24.7ms | 68.2ms | 0.00% | 564MB | 0.2% | 141 | 22 (1) | 26.08 | 6.0GB |
| 9000 | 5800 | 64% | 10.3ms | 18.0ms | 25.4ms | 94.1ms | 0.00% | 564MB | 0.0% | 141 | 22 (1) | 27.41 | 5.9GB |
| 10000 | 5208 | 52% | 11.4ms | 20.2ms | 28.2ms | 73.2ms | 0.00% | 564MB | 0.2% | 141 | 22 (1) | 29.29 | 6.0GB |
| 11000 | 4807 | 44% | 12.3ms | 22.2ms | 31.4ms | 79.0ms | 0.00% | 564MB | 0.2% | 141 | 22 (1) | 30.56 | 5.9GB |

**Peak step (8000 rps, achieved 5894):**

- JVM: RSS=564MB, CPU=0.2%, threads=141, fds=242
- PostgreSQL: 22 connections ({"active":1,"idle":21}), DB size=4.4GB, table sizes: users=2MB, shorten_url=4.4GB
- Host: load avg 26.08 / 9.87 / 4.88 on 8 cores, free RAM=6.0GB / total=15.3GB
- Load generators (1):
  - pid 31588: 170MB RSS, 40.6% CPU (threshold-read)

## WRITE — Step-by-step (with resources)

Range: 200 → 2900 rps, step 300 rps, 20s per step.

| Target | Achieved | % | p50 | p95 | p99 | max | Errors | JVM RSS | JVM CPU | Threads | PG conns (active) | Load1 | Free RAM |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 200 | 206 | 103% | 19.4ms | 83.9ms | 460ms | 492ms | 0.00% | 543MB | 0.0% | 170 | 47 (1) | 22.04 | 6.0GB |
| 500 | 506 | 101% | 17.4ms | 47.0ms | 63.0ms | 95.5ms | 0.00% | 543MB | 0.0% | 170 | 57 (1) | 16.38 | 6.1GB |
| 800 | 806 | 101% | 22.4ms | 60.2ms | 68.0ms | 80.6ms | 0.00% | 545MB | 0.0% | 170 | 64 (1) | 11.91 | 6.2GB |
| 1100 | 1106 | 101% | 41.7ms | 58.6ms | 66.0ms | 86.6ms | 0.00% | 545MB | 0.0% | 170 | 72 (1) | 8.59 | 6.2GB |
| 1400 | 1337 | 95% | 50.3ms | 143ms | 205ms | 427ms | 0.00% | 545MB | 0.0% | 172 | 81 (1) | 21.66 | 6.3GB |
| 1700 | 1300 | 76% | 88.6ms | 184ms | 275ms | 546ms | 0.00% | 598MB | 0.2% | 173 | 81 (1) | 35.76 | 6.2GB |
| 2000 | 1338 | 67% | 88.0ms | 167ms | 243ms | 515ms | 0.00% | 598MB | 0.0% | 173 | 81 (1) | 46.28 | 6.2GB |
| 2300 | 1352 | 59% | 87.0ms | 171ms | 249ms | 632ms | 0.00% | 598MB | 0.0% | 173 | 81 (1) | 53.14 | 6.2GB |
| 2600 | 1348 | 52% | 87.2ms | 168ms | 263ms | 456ms | 0.00% | 598MB | 0.0% | 173 | 81 (1) | 55.29 | 6.2GB |
| 2900 | 1356 | 47% | 85.9ms | 171ms | 260ms | 579ms | 0.00% | 598MB | 0.2% | 173 | 81 (1) | 53.99 | 6.2GB |

**Peak step (2900 rps, achieved 1356):**

- JVM: RSS=598MB, CPU=0.2%, threads=173, fds=363
- PostgreSQL: 81 connections ({"active":1,"idle":80}), DB size=4.5GB, table sizes: users=2MB, shorten_url=4.4GB
- Host: load avg 53.99 / 28.98 / 13.60 on 8 cores, free RAM=6.2GB / total=15.3GB
- Load generators (1):
  - pid 32480: 116MB RSS, 31.6% CPU (threshold-write)

## Environment summary

Captured at the start of the first run:

- **Host**: 8 CPU cores, 15.3GB RAM
- **Backend JVM**: pid 26765, RSS=598MB, threads=173, fds=237
- **PostgreSQL**: 8,708 users, 23,791,830 urls, DB size=4.5GB, connections=81

## How to read this

- **Healthy ceiling**: highest target rps where p99 < 500ms, errors < 1%, achieved ≥ 70% of target.
- **Knee**: first target rps where p99 doubles vs the lowest tested step (or ≥100ms).
- **Peak achieved**: raw throughput the server delivered, regardless of target.
- **JVM RSS / CPU / threads**: read from `/proc/<pid>/{status,stat}`. CPU% is a 200ms delta sample per step.
- **PG conns (active)**: from `pg_stat_activity`. HikariCP `maximum-pool-size` in this app is **20** — if active saturates near that, the bottleneck is the connection pool.
- **Load1**: 1-minute load average from the host. A number ≈ cores means the host is busy; >> cores means a queue is forming.

---

Generated by `benchmark/lib/threshold-reporter.js`.