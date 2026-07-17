#!/usr/bin/env bash
# One-command dev launcher: backend (Spring Boot :8080) + frontend (Vite :5173).
#
#   ./dev.sh          start both; Ctrl+C stops both
#
# Infra (Postgres/Redis/Kafka) must already be up:  docker compose up -d
set -uo pipefail
cd "$(dirname "$0")"

cleanup() {
  echo
  echo "Stopping backend + frontend…"
  # Kill our children, then anything still holding the ports (gradle's bootRun
  # app can outlive the wrapper process).
  kill $(jobs -p) 2>/dev/null
  fuser -k 8080/tcp 2>/dev/null
  fuser -k 5173/tcp 2>/dev/null
  wait 2>/dev/null
  echo "Done."
}

# Fail fast if the ports are already taken (stale servers cause confusing bugs).
# Checked BEFORE arming the cleanup trap so we never kill servers we don't own.
for port in 8080 5173; do
  if fuser "$port"/tcp >/dev/null 2>&1; then
    echo "Port $port is already in use — stop that process first (fuser -k $port/tcp)." >&2
    exit 1
  fi
done

trap cleanup EXIT INT TERM

echo "Starting backend (:8080)…"
(cd backend && ./gradlew bootRun --console=plain) &
BACKEND_PID=$!

echo "Waiting for the API to come up…"
until curl -sf http://localhost:8080/api/health >/dev/null 2>&1; do
  sleep 2
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Backend failed to start — see the log above." >&2
    exit 1
  fi
done
echo "Backend is up → starting frontend (:5173)…"

(cd frontend && npm run dev) &

echo
echo "  App:  http://localhost:5173"
echo "  API:  http://localhost:8080/api/health"
echo "  Ctrl+C stops both."
echo

wait
