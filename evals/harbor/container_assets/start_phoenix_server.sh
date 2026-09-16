#!/bin/sh
# Start Phoenix against the fixture database unless it is already serving.
set -eu
LOG=/var/lib/phoenix-eval/server.log
HEALTH_URL=http://127.0.0.1:6006/healthz

is_healthy() {
  curl -fsS -o /dev/null "$HEALTH_URL"
}

if is_healthy; then
  exit 0
fi
mkdir -p "$(dirname "$LOG")"
PHOENIX_SQL_DATABASE_URL=sqlite:////data/phoenix.db setsid phoenix serve >"$LOG" 2>&1 &
for _ in $(seq 1 120); do
  if is_healthy; then
    exit 0
  fi
  sleep 1
done
echo "Phoenix did not become healthy at $HEALTH_URL; last server log lines:" >&2
tail -n 50 "$LOG" >&2
exit 1
