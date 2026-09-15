#!/bin/sh
# Start Phoenix against the fixture database unless it is already serving.
# Idempotent so the step hook can run it before every step.
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
# HARBOR_PHOENIX_* come from the task's environment.env. Remote export must be forced:
# the server otherwise refuses it because the persisted
# agent_trace_recording.allow_remote_export setting defaults to false.
# PXI may read the Phoenix docs (the job allows the docs hosts), but not the web or
# GitHub. Allowing external resources also re-enables telemetry, so that is switched
# off explicitly. The sandbox providers are pinned to the two that need no download;
# the WASM provider would otherwise try to fetch its interpreter at startup.
PHOENIX_ALLOW_EXTERNAL_RESOURCES=true \
  PHOENIX_AGENTS_DISABLE_WEB_ACCESS=true \
  PHOENIX_AGENTS_DISABLE_GITHUB=true \
  PHOENIX_TELEMETRY_ENABLED=false \
  PHOENIX_ALLOWED_SANDBOX_PROVIDERS=MONTY,DENO \
  PHOENIX_SQL_DATABASE_URL="sqlite:///$FIXTURE_DB" PHOENIX_WORKING_DIR=/data \
  PHOENIX_HOST=0.0.0.0 PHOENIX_PORT="$PORT" \
  PHOENIX_AGENTS_COLLECTOR_ENDPOINT="${HARBOR_PHOENIX_COLLECTOR_ENDPOINT:-}" \
  PHOENIX_AGENTS_FORCE_TRACING="${HARBOR_PHOENIX_COLLECTOR_ENDPOINT:+true}" \
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
