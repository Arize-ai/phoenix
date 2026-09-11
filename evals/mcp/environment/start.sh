#!/bin/sh
set -eu
python -m evals.mcp.environment.server &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM
python -m evals.mcp.environment.seed
wait "$server_pid"
