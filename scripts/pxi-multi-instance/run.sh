#!/usr/bin/env bash
# Multi-instance PXI smoke test.
#
# Builds the Phoenix docker image from the current working tree, starts two
# Phoenix containers sharing one Postgres database (ports 16006/16007/15432 so
# nothing collides with a local dev instance), then runs the Playwright spec
# app/tests/pxi/multi-instance.spec.ts against both instances with a real LLM.
#
# Requirements:
#   - docker (with compose v2)
#   - OPENAI_API_KEY, read from app/.env (or already exported)
#
# Usage:
#   scripts/pxi-multi-instance/run.sh            # build, test, tear down
#   KEEP_STACK=1 scripts/pxi-multi-instance/run.sh  # leave the stack running
#   SKIP_BUILD=1 scripts/pxi-multi-instance/run.sh  # reuse the existing image

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
COMPOSE=(docker compose -f "${COMPOSE_FILE}")

BASE_URL_A="http://localhost:16006"
BASE_URL_B="http://localhost:16007"
ASSISTANT_MODEL="${PXI_E2E_ASSISTANT_MODEL:-gpt-5.4-mini}"

log() { printf '\n[pxi-multi-instance] %s\n' "$*"; }

# --- Credentials -------------------------------------------------------------
if [[ -z "${OPENAI_API_KEY:-}" && -f "${REPO_ROOT}/app/.env" ]]; then
  # app/.env is a list of `export KEY=value` lines; source it in a subshell and
  # extract only the key we need so dev-instance settings don't leak in.
  OPENAI_API_KEY="$(
    # shellcheck disable=SC1091
    source "${REPO_ROOT}/app/.env" >/dev/null 2>&1
    printf '%s' "${OPENAI_API_KEY:-}"
  )"
fi
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "OPENAI_API_KEY not set and not found in app/.env" >&2
  exit 1
fi
export OPENAI_API_KEY

# --- Build -------------------------------------------------------------------
if [[ "$(uname -m)" == "arm64" || "$(uname -m)" == "aarch64" ]]; then
  export PHOENIX_MI_BASE_IMAGE="gcr.io/distroless/python3-debian13:nonroot-arm64"
fi

if [[ -z "${SKIP_BUILD:-}" ]]; then
  log "Building the Phoenix image from the working tree (this can take a while)…"
  "${COMPOSE[@]}" build phoenix-a
fi

# --- Startup -----------------------------------------------------------------
teardown() {
  if [[ -n "${KEEP_STACK:-}" ]]; then
    log "KEEP_STACK set; leaving the stack running:"
    log "  A: ${BASE_URL_A}  B: ${BASE_URL_B}  postgres: localhost:15432"
    return
  fi
  log "Tearing down the stack…"
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap teardown EXIT

wait_for_healthz() {
  local url="$1" name="$2" deadline=$((SECONDS + 180))
  until curl -fsS "${url}/healthz" >/dev/null 2>&1; do
    if ((SECONDS > deadline)); then
      log "${name} did not become healthy; recent logs:"
      "${COMPOSE[@]}" logs --tail 50 "${name}" || true
      exit 1
    fi
    sleep 2
  done
  log "${name} is healthy at ${url}"
}

log "Starting postgres + phoenix-a…"
"${COMPOSE[@]}" up -d db phoenix-a
wait_for_healthz "${BASE_URL_A}" phoenix-a

# phoenix-a has finished migrations by the time it serves /healthz, so
# phoenix-b can start without racing them.
log "Starting phoenix-b…"
"${COMPOSE[@]}" up -d phoenix-b
wait_for_healthz "${BASE_URL_B}" phoenix-b

# --- Test --------------------------------------------------------------------
log "Running the multi-instance Playwright spec (assistant model: ${ASSISTANT_MODEL})…"
cd "${REPO_ROOT}/app"
PXI_MI_BASE_URL_A="${BASE_URL_A}" \
PXI_MI_BASE_URL_B="${BASE_URL_B}" \
PXI_E2E_ASSISTANT_MODEL="${ASSISTANT_MODEL}" \
pnpm exec playwright test --config=playwright.multi-instance.config.ts "$@"

log "Multi-instance PXI smoke test passed."
