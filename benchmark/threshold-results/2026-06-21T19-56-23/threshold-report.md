# System Threshold & Resource Report — 2026-06-21T13:05:37.718Z

Open-loop rps ramp: offered load controlled by the client, measured at each step.
Failure criteria: p99 ≥ 500ms, errors ≥ 1%, or achieved < 70% of target.

Resource snapshots are taken at the **end of each step** (during-load), capturing the JVM (backend), PostgreSQL, node load-generators, and host load avg / free memory.

## TL;DR — Where the system breaks

| Path | Healthy ceiling | Knee (p99 doubles) | Peak achieved | Verdict |
|---|---:|---:|---:|---|
| mixed | 1700 rps | 1100 rps | 1205 rps | breaks between 1700 and 2000 rps |
| read | 3000 rps | — rps | 2365 rps | breaks between 3000 and 3500 rps |
| write | 1100 rps | 800 rps | 921 rps | breaks between 1100 and 1400 rps |

## TL;DR — Resource pressure at peak

| Path | Peak rps | JVM RSS | JVM CPU | JVM threads | PG conns | PG active | Load avg (1m) | Free RAM |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| mixed | 1205 | 589MB | 0.0% | 171 | 21 | 1 | 30.30 | 5.8GB |
| read | 2365 | 581MB | 0.0% | 107 | 21 | 1 | 15.24 | 5.8GB |
| write | 921 | 589MB | 0.0% | 170 | 21 | 1 | 28.47 | 5.8GB |

## MIXED — Step-by-step (with resources)

Range: 200 → 2600 rps, step 300 rps, 20s per step.

| Target | Achieved | % | p50 | p95 | p99 | max | Errors | JVM RSS | JVM CPU | Threads | PG conns (active) | Load1 | Free RAM |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 200 | 206 | 103% | 14.3ms | 33.8ms | 64.8ms | 84.9ms | 0.00% | 589MB | 0.0% | 171 | 21 (1) | 21.10 | 5.8GB |
| 500 | 506 | 101% | 14.4ms | 27.4ms | 43.8ms | 70.7ms | 0.00% | 589MB | 0.0% | 171 | 21 (1) | 17.13 | 5.9GB |
| 800 | 806 | 101% | 20.8ms | 45.3ms | 63.0ms | 107ms | 0.00% | 589MB | 0.0% | 171 | 21 (1) | 14.71 | 5.8GB |
| 1100 | 1101 | 100% | 54.6ms | 194ms | 293ms | 575ms | 0.00% | 589MB | 0.2% | 171 | 21 (1) | 19.12 | 5.8GB |
| 1400 | 1203 | 86% | 87.6ms | 263ms | 352ms | 752ms | 0.00% | 589MB | 0.0% | 171 | 21 (1) | 23.51 | 5.8GB |
| 1700 | 1197 | 70% | 89.6ms | 266ms | 354ms | 662ms | 0.00% | 589MB | 0.3% | 171 | 21 (1) | 26.83 | 5.8GB |
| 2000 | 1188 | 59% | 90.1ms | 265ms | 355ms | 684ms | 0.00% | 589MB | 0.0% | 171 | 21 (1) | 29.65 | 5.8GB |
| 2300 | 1153 | 50% | 91.7ms | 274ms | 377ms | 766ms | 0.00% | 589MB | 0.2% | 171 | 21 (1) | 29.70 | 5.8GB |
| 2600 | 1205 | 46% | 89.1ms | 263ms | 359ms | 662ms | 0.00% | 589MB | 0.0% | 171 | 21 (1) | 30.30 | 5.8GB |

**Peak step (2600 rps, achieved 1205):**

- JVM: RSS=589MB, CPU=0.0%, threads=171, fds=301
- PostgreSQL: 21 connections ({"active":1,"idle":20}), DB size=4.4GB, table sizes: users=2MB, shorten_url=4.4GB
- Host: load avg 30.30 / 22.89 / 18.14 on 8 cores, free RAM=5.8GB / total=15.3GB
- Load generators (1):
  - pid 232860: 111MB RSS, 30.1% CPU (threshold-mixed)

## READ — Step-by-step (with resources)

Range: 500 → 4500 rps, step 500 rps, 20s per step.

| Target | Achieved | % | p50 | p95 | p99 | max | Errors | JVM RSS | JVM CPU | Threads | PG conns (active) | Load1 | Free RAM |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 500 | 503 | 101% | 12.1ms | 24.7ms | 35.4ms | 53.7ms | 0.00% | 581MB | 0.0% | 108 | 21 (1) | 12.23 | 5.8GB |
| 1000 | 1002 | 100% | 18.3ms | 35.6ms | 40.2ms | 46.5ms | 0.00% | 581MB | 0.0% | 108 | 21 (1) | 9.26 | 5.8GB |
| 1500 | 1503 | 100% | 16.8ms | 30.1ms | 37.7ms | 62.3ms | 0.00% | 581MB | 0.0% | 108 | 21 (1) | 9.74 | 5.8GB |
| 2000 | 1998 | 100% | 17.7ms | 35.0ms | 49.0ms | 89.7ms | 0.00% | 581MB | 0.0% | 107 | 21 (1) | 13.12 | 5.8GB |
| 2500 | 2365 | 95% | 24.1ms | 53.4ms | 69.1ms | 129ms | 0.00% | 581MB | 0.0% | 107 | 21 (1) | 15.24 | 5.8GB |
| 3000 | 2313 | 77% | 24.4ms | 55.3ms | 72.8ms | 139ms | 0.00% | 581MB | 0.0% | 107 | 21 (1) | 16.57 | 5.9GB |
| 3500 | 2304 | 66% | 24.9ms | 55.3ms | 71.1ms | 125ms | 0.00% | 581MB | 0.0% | 107 | 21 (1) | 21.09 | 5.9GB |
| 4000 | 2127 | 53% | 26.9ms | 59.3ms | 76.6ms | 150ms | 0.00% | 581MB | 0.0% | 107 | 21 (1) | 21.61 | 5.9GB |
| 4500 | 2003 | 45% | 28.7ms | 62.9ms | 80.4ms | 145ms | 0.00% | 581MB | 0.0% | 107 | 21 (1) | 23.24 | 5.9GB |

**Peak step (2500 rps, achieved 2365):**

- JVM: RSS=581MB, CPU=0.0%, threads=107, fds=238
- PostgreSQL: 21 connections ({"active":1,"idle":20}), DB size=4.3GB, table sizes: users=2MB, shorten_url=4.3GB
- Host: load avg 15.24 / 13.68 / 14.14 on 8 cores, free RAM=5.8GB / total=15.3GB
- Load generators (1):
  - pid 228083: 114MB RSS, 22.7% CPU (threshold-read)

## WRITE — Step-by-step (with resources)

Range: 200 → 2000 rps, step 300 rps, 20s per step.

| Target | Achieved | % | p50 | p95 | p99 | max | Errors | JVM RSS | JVM CPU | Threads | PG conns (active) | Load1 | Free RAM |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 200 | 206 | 103% | 16.2ms | 31.7ms | 75.0ms | 96.5ms | 0.00% | 585MB | 0.0% | 139 | 21 (1) | 16.79 | 5.9GB |
| 500 | 504 | 101% | 29.7ms | 50.2ms | 68.0ms | 91.8ms | 0.00% | 587MB | 0.0% | 150 | 21 (1) | 14.12 | 5.9GB |
| 800 | 806 | 101% | 71.8ms | 177ms | 299ms | 594ms | 0.00% | 589MB | 0.2% | 170 | 21 (1) | 18.90 | 5.9GB |
| 1100 | 919 | 84% | 131ms | 293ms | 383ms | 645ms | 0.00% | 589MB | 0.0% | 170 | 21 (1) | 22.67 | 5.9GB |
| 1400 | 921 | 66% | 131ms | 293ms | 375ms | 772ms | 0.00% | 589MB | 0.0% | 170 | 21 (1) | 28.47 | 5.8GB |
| 1700 | 918 | 54% | 131ms | 295ms | 385ms | 567ms | 0.00% | 589MB | 0.0% | 171 | 21 (1) | 32.15 | 5.8GB |
| 2000 | 893 | 45% | 133ms | 305ms | 393ms | 606ms | 0.01% | 589MB | 0.0% | 171 | 21 (1) | 30.21 | 5.8GB |

**Peak step (1400 rps, achieved 921):**

- JVM: RSS=589MB, CPU=0.0%, threads=170, fds=303
- PostgreSQL: 21 connections ({"active":1,"idle":20}), DB size=4.4GB, table sizes: users=2MB, shorten_url=4.4GB
- Host: load avg 28.47 / 18.89 / 15.99 on 8 cores, free RAM=5.8GB / total=15.3GB
- Load generators (1):
  - pid 230541: 110MB RSS, 23.2% CPU (threshold-write)

## Environment summary

Captured at the start of the first run:

- **Host**: 8 CPU cores, 15.3GB RAM
- **Backend JVM**: pid 32209, RSS=589MB, threads=171, fds=175
- **PostgreSQL**: 8,707 users, 23,322,172 urls, DB size=4.4GB, connections=21

## How to read this

- **Healthy ceiling**: highest target rps where p99 < 500ms, errors < 1%, achieved ≥ 70% of target.
- **Knee**: first target rps where p99 doubles vs the lowest tested step (or ≥100ms).
- **Peak achieved**: raw throughput the server delivered, regardless of target.
- **JVM RSS / CPU / threads**: read from `/proc/<pid>/{status,stat}`. CPU% is a 200ms delta sample per step.
- **PG conns (active)**: from `pg_stat_activity`. HikariCP `maximum-pool-size` in this app is **20** — if active saturates near that, the bottleneck is the connection pool.
- **Load1**: 1-minute load average from the host. A number ≈ cores means the host is busy; >> cores means a queue is forming.

---

Generated by `benchmark/lib/threshold-reporter.js`.