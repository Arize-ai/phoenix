#!/usr/bin/env bash

set -euo pipefail

source "${PHOENIX_DEV_ENV_FILE:?}"

case "${1:-}" in
  api)
    exec pnpm exec portless --name "${PHOENIX_DEV_API_NAME:?}" bash -c '
      export PHOENIX_PORT="$PORT"
      export PHOENIX_ALLOWED_ORIGINS="${PHOENIX_ALLOWED_ORIGINS:+$PHOENIX_ALLOWED_ORIGINS,}$PORTLESS_URL"
      exec uv run python -Xfrozen_modules=off -m phoenix.server.main serve --dev --debug
    '
    ;;
  frontend)
    exec pnpm exec portless --name "${PHOENIX_DEV_FRONTEND_NAME:?}" bash -c '
      export VITE_PORT="$PORT" VITE_HOST="$HOST"
      pnpm run build:static
      pnpm run build:relay
      exec vite
    '
    ;;
  *)
    echo "Usage: dev-process.sh api|frontend" >&2
    exit 2
    ;;
esac
