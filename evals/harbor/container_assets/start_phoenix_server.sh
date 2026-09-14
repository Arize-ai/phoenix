#!/bin/sh
# Start Phoenix against the fixture database unless it is already serving.
# Idempotent so the agent can run it before every step.
set -eu
PORT="${PHOENIX_PORT:-6006}"
STATE_DIR=/var/lib/phoenix-eval
HEALTH_URL="http://127.0.0.1:${PORT}/healthz"

is_healthy() {
  python -c "import sys, urllib.request; urllib.request.urlopen('$HEALTH_URL', timeout=2)" >/dev/null 2>&1
}

if is_healthy; then
  exit 0
fi
mkdir -p "$STATE_DIR"
# The fixture is /data/phoenix.db, which is the default database under this working dir.
PHOENIX_WORKING_DIR=/data PHOENIX_HOST=0.0.0.0 PHOENIX_PORT="$PORT" \
  setsid nohup phoenix serve >"$STATE_DIR/server.log" 2>&1 &
for _ in $(seq 1 120); do
  if is_healthy; then
    exit 0
  fi
  sleep 1
done
echo "Phoenix did not become healthy at $HEALTH_URL; last server log lines:" >&2
tail -n 50 "$STATE_DIR/server.log" >&2
exit 1
