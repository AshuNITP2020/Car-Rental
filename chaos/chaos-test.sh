#!/usr/bin/env bash
# Chaos test (Task #44): kill dependencies while the app is serving traffic and
# confirm it degrades GRACEFULLY rather than crashing.
#
#   Redis down    -> search still returns 200 (cache falls through to the DB via
#                    the CacheErrorHandler; the rate limiter fails open) — a
#                    performance hit, not an outage.
#   Postgres down -> a search that MUST hit the DB (a cache-missing query) returns
#                    a clean 5xx, the app stays up, and recovers once Postgres is
#                    back. (A cached query would still return 200 from Redis — a DB
#                    outage doesn't take down reads that are already cached.)
#
# Prereqs: infra up (docker compose up -d) and the backend running with DEFAULTS
# (so Redis-backed cache + rate limiter are active):  cd backend && ./gradlew bootRun
#
# Usage:  bash chaos/chaos-test.sh        (from the repo root)

set -uo pipefail
BASE="${BASE_URL:-http://localhost:8080}"
PASS=0
FAIL=0

say()   { printf '\n=== %s ===\n' "$1"; }
check() { # $1 = ok|no, $2 = description
  if [ "$1" = "ok" ]; then echo "  PASS: $2"; PASS=$((PASS + 1));
  else echo "  FAIL: $2"; FAIL=$((FAIL + 1)); fi
}

# HTTP status of an authenticated search for query string $1 (000 on no response).
search_code() {
  local c
  c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 45 \
    -H "Authorization: Bearer ${TOKEN}" \
    "${BASE}/api/cars/search?${1}" 2>/dev/null)
  echo "${c:-000}"
}
COMMON="city=Mumbai&size=5"                       # cache-friendly (may be served from Redis)
uniq() { echo "city=Chaos-${RANDOM}-${RANDOM}&size=5"; }   # unique -> cache miss -> must hit the DB
is2xx() { case "$1" in 2??) return 0;; *) return 1;; esac; }
is5xx() { case "$1" in 5??) return 0;; *) return 1;; esac; }

say "Preflight — backend healthy + get a token"
health=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/actuator/health" 2>/dev/null || echo 000)
if [ "$health" != "200" ]; then
  echo "Backend not healthy ($health) at ${BASE}. Start it: (cd backend && ./gradlew bootRun)"; exit 1
fi
EMAIL="chaos-$(date +%s)@chaos.local"
TOKEN=$(curl -s -X POST "${BASE}/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Chaos\",\"email\":\"${EMAIL}\",\"phone\":\"+919800000000\",\"password\":\"password123\"}" \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || { echo "Could not obtain a token"; exit 1; }
base=$(search_code "$COMMON"); is2xx "$base" && check ok "baseline search -> $base" || check no "baseline search -> $base (expected 200)"

say "Experiment 1 — Redis DOWN (expect graceful: search stays 200)"
docker compose stop redis >/dev/null 2>&1
a=$(search_code "$COMMON"); b=$(search_code "$COMMON")
{ is2xx "$a" && is2xx "$b"; } && check ok "search with Redis down -> $a,$b" \
                             || check no "search with Redis down -> $a,$b (expected 200 — cache/limiter should fail open fast)"
docker compose start redis >/dev/null 2>&1
for _ in $(seq 1 30); do docker exec carrental-redis redis-cli ping 2>/dev/null | grep -q PONG && break; sleep 1; done
r=$(search_code "$COMMON"); is2xx "$r" && check ok "search after Redis recovery -> $r" || check no "search after Redis recovery -> $r (expected 200)"

say "Experiment 2 — Postgres DOWN (expect graceful failure on a DB-bound query: 5xx, app stays up)"
docker compose stop postgres >/dev/null 2>&1
p=$(search_code "$(uniq)")
is5xx "$p" && check ok "cache-missing search with Postgres down -> $p (clean error, no crash)" \
           || check no "cache-missing search with Postgres down -> $p (expected a 5xx response)"
docker compose start postgres >/dev/null 2>&1
rec=000
for _ in $(seq 1 40); do rec=$(search_code "$(uniq)"); is2xx "$rec" && break; sleep 2; done
is2xx "$rec" && check ok "search after Postgres recovery -> $rec" || check no "search after Postgres recovery -> $rec (expected 200)"

say "Summary"
echo "  PASS=$PASS  FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
