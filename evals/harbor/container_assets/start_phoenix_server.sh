#!/bin/sh
# Start Phoenix against the fixture database unless it is already serving.
# Idempotent so the agent can run it before every step.
set -eu
PORT="${PHOENIX_PORT:-6006}"
STATE_DIR=/var/lib/phoenix-eval
FIXTURE_DB=/data/phoenix.db
HEALTH_URL="http://127.0.0.1:${PORT}/healthz"

is_healthy() {
  python -c "import sys, urllib.request; urllib.request.urlopen('$HEALTH_URL', timeout=2)" >/dev/null 2>&1
}

if is_healthy; then
  exit 0
fi
mkdir -p "$STATE_DIR"
# HARBOR_PHOENIX_* come from the task's environment.env; the agent requests
# remote trace export whenever the endpoint is set.
# The docs MCP server reaches out to an external host on every turn; the eval
# scores PXI on the fixture data, so it runs without docs tools.
PHOENIX_ALLOW_EXTERNAL_RESOURCES=false \
  PHOENIX_SQL_DATABASE_URL="sqlite:///$FIXTURE_DB" PHOENIX_WORKING_DIR=/data \
  PHOENIX_HOST=0.0.0.0 PHOENIX_PORT="$PORT" \
  PHOENIX_AGENTS_COLLECTOR_ENDPOINT="${HARBOR_PHOENIX_COLLECTOR_ENDPOINT:-}" \
  PHOENIX_AGENTS_COLLECTOR_API_KEY="${HARBOR_PHOENIX_API_KEY:-}" \
  PHOENIX_AGENTS_ASSISTANT_PROJECT_NAME="${HARBOR_PHOENIX_PROJECT_NAME:-harbor-server-agent-evals}" \
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
