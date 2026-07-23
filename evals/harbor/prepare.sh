#!/bin/bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ENVIRONMENT="$ROOT/evals/harbor/tasks/regression-triage/environment"
mkdir -p "$ENVIRONMENT/wheels"
uv build --wheel
cp "$ROOT"/dist/arize_phoenix-*.whl "$ENVIRONMENT/wheels/"
cp "$ROOT/evals/harbor/runner/run_server_agent.py" "$ENVIRONMENT/run_server_agent.py"
