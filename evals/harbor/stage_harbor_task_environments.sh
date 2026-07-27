#!/bin/bash
# Build Phoenix and stage the generated build-context artifacts into every
# task's environment/ directory: the wheel, the ServerAgent runner, and the
# fixture-download script. These are gitignored; the canonical copies live
# under evals/harbor/runner/.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
RUNNER="$ROOT/evals/harbor/runner"
TASKS_DIR="$ROOT/evals/harbor/tasks"

uv build --wheel

staged=0
for environment in "$TASKS_DIR"/*/environment; do
  [ -d "$environment" ] || continue
  mkdir -p "$environment/wheels"
  cp "$ROOT"/dist/arize_phoenix-*.whl "$environment/wheels/"
  cp "$RUNNER/run_server_agent.py" "$RUNNER/fetch_fixtures.py" "$environment/"
  staged=$((staged + 1))
done

if [ "$staged" -eq 0 ]; then
  echo "error: no tasks with an environment/ directory found under $TASKS_DIR" >&2
  exit 1
fi

echo "Staged build-context artifacts for $staged task(s)."
