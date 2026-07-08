# Chaos testing (Task #44)

Kill dependencies while the app is serving traffic and confirm it **degrades
gracefully** — the difference between "slower / clean errors" and "crashed".

## What we assert

| Failure injected | Expected behaviour | Why |
|---|---|---|
| **Redis down** | search still returns **200** | the cache falls through to the DB (`LoggingCacheErrorHandler`) and the rate limiter **fails open** (`RateLimitFilter`) — a perf hit, not an outage |
| **Postgres down** | search returns a clean **5xx**, app stays up, then **recovers** | the DB is the source of truth; there's no serving without it, but the app must not crash and must reconnect when it returns |

## Run it

```bash
docker compose up -d                                   # infra
cd backend && ./gradlew bootRun                        # app with DEFAULTS (Redis cache + limiter on)
# in another shell, from the repo root:
bash chaos/chaos-test.sh
```

The script registers a user, then stops/starts the `redis` and `postgres`
containers around live search requests, printing PASS/FAIL per experiment and
exiting non-zero if any fail. (The Postgres-down request can take ~30s — that's
Hikari's connection timeout expiring before it returns the 5xx.)

## The resilience this proves (and the fix it drove)

Chaos testing surfaced a real gap: the rate limiter already **failed open** on a
Redis outage (#35), but `@Cacheable` search would have thrown **500** because
Spring Cache doesn't swallow backend errors by default. #44 added a
`CacheErrorHandler` (`LoggingCacheErrorHandler`) so a Redis failure becomes a
cache *miss* → the query runs against the database. Net effect: **a Redis outage
degrades performance, never correctness.**

## Advanced: latency injection with Toxiproxy

Killing a dependency tests the on/off case; injecting **latency/jitter** tests the
partial-failure case. [Toxiproxy](https://github.com/Shopify/toxiproxy) sits
between the app and a dependency and adds controllable "toxics":

```bash
# 1. run toxiproxy (host networking so it can reach the host-published deps)
docker run -d --name toxiproxy --network host ghcr.io/shopify/toxiproxy
# 2. create a proxy in front of Postgres (app -> 56432 -> real 55432)
docker exec toxiproxy /toxiproxy-cli create -l 0.0.0.0:56432 -u localhost:55432 pg
# 3. add 800ms latency
docker exec toxiproxy /toxiproxy-cli toxic add -t latency -a latency=800 pg
# 4. point the backend at the proxy and observe p95 climb in Grafana:
#    DB_URL=jdbc:postgresql://localhost:56432/carrental ./gradlew bootRun
```
Remove the toxic (`toxic remove -n latency_downstream pg`) and watch latency recover.
