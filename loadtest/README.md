# Load testing (Task #43)

[k6](https://k6.io) load tests for the hot read path — car **search** — to find where
latency and errors start to break, and to watch the Redis cache (#34) earn its keep.

## Prerequisites

1. **Infra up:** `docker compose up -d postgres redis kafka` (+ `prometheus grafana` if you
   want to watch the dashboards move).
2. **Backend running with seed data and rate limiting off.** The per-user rate limiter
   is an abuse guard, not the capacity we're measuring, so disable it for load runs;
   the seed gives search realistic data (200 agencies, 5 000 cars):
   ```bash
   cd backend
   ./gradlew bootRun --args='--app.seed.enabled=true --app.rate-limit.enabled=false'
   ```
   (Seed once; on later runs the data is already there — drop `--app.seed.enabled=true`.)
3. **k6**, either installed locally, or via Docker (no install). On this machine the Docker
   bridge blocks container↔host, so use **host networking**:
   ```bash
   docker run --rm --network host -v "$PWD/loadtest:/scripts" grafana/k6 run /scripts/search-load.js
   ```
   Local binary equivalent: `k6 run loadtest/search-load.js`.

## Running the staged profiles (100 → 1k → 10k)

The script ramps `VUS` virtual users (default 50). Scale it via env vars:

```bash
# 100 users, hold 1 minute
docker run --rm --network host -e VUS=100 -e HOLD=1m -v "$PWD/loadtest:/scripts" grafana/k6 run /scripts/search-load.js

# 1 000 users
docker run --rm --network host -e VUS=1000 -e RAMP=1m -e HOLD=3m -v "$PWD/loadtest:/scripts" grafana/k6 run /scripts/search-load.js

# 10 000 users (expect to find limits — that's the point)
docker run --rm --network host -e VUS=10000 -e RAMP=2m -e HOLD=5m -v "$PWD/loadtest:/scripts" grafana/k6 run /scripts/search-load.js
```

Knobs: `VUS`, `RAMP`, `HOLD`, `BASE_URL`.

## Thresholds (the pass/fail line)

- `http_req_failed  rate < 0.01`  — under 1% failed requests
- `http_req_duration p(95) < 500` — 95% of requests under 500 ms
- `search_errors     rate < 0.01`

k6 exits non-zero if a threshold is breached — that's your "it broke here" signal.

## The tuning loop

1. Run at increasing `VUS` until a threshold breaks (p95 climbs, errors appear).
2. Watch **Grafana** (`http://localhost:3000`, dashboard "Car Rental — Overview") — request
   rate, p95 latency, JVM heap — while it runs.
3. ~70% of requests hit one common query, so the **Redis search cache (#34)** absorbs most
   of the read load; compare a run with caching vs. `app.cache.type=none` to see the DB
   become the bottleneck. Other levers: Hikari pool size, JVM heap, more search indexes.
4. Fix the bottleneck, re-run, confirm the threshold passes at higher load.
