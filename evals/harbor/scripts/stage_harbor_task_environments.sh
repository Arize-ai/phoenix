#!/bin/bash
# Build Phoenix and stage the generated build-context artifacts into every
# task's environment/ directory.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
CONTAINER_ASSETS="$ROOT/evals/harbor/container_assets"
TASKS_DIR="$ROOT/evals/harbor/tasks"

# Clear stale wheels first: `uv pip install /wheels/*.whl` in the task Dockerfile
# would otherwise see the previous version alongside the new one.
rm -f "$ROOT"/dist/arize_phoenix-*.whl
uv build --wheel

staged=0
for environment in "$TASKS_DIR"/*/environment; do
  [ -d "$environment" ] || continue
  rm -rf "$environment/wheels"
  mkdir -p "$environment/wheels"
  cp "$ROOT"/dist/arize_phoenix-*.whl "$environment/wheels/"
  cp "$CONTAINER_ASSETS/run_server_agent.py" "$CONTAINER_ASSETS/fetch_fixtures.py" "$environment/"
  staged=$((staged + 1))
done

if [ "$staged" -eq 0 ]; then
  echo "error: no tasks with an environment/ directory found under $TASKS_DIR" >&2
  exit 1
fi

echo "Staged build-context artifacts for $staged task(s)."
