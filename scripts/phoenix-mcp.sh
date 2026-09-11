#!/usr/bin/env bash
# Bridges Claude Code (stdio) to the Phoenix MCP server running on this checkout's port.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f js/app/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source js/app/.env
  set +a
fi
exec npx -y mcp-remote@0.13.5 "http://localhost:${PHOENIX_PORT:-6006}/mcp"
