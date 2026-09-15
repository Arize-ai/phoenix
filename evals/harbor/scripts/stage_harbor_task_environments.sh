#!/bin/bash
# Build Phoenix and stage the generated build-context artifacts into every
# task's environment/ directory: the wheel, the container assets, and the
# task's fixture database from cloud storage.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
CONTAINER_ASSETS="$ROOT/evals/harbor/container_assets"
TASKS_DIR="$ROOT/evals/harbor/tasks"
FIXTURES_URL="https://storage.googleapis.com/arize-phoenix-assets/evals/harbor"

# Clear stale wheels first: `uv pip install /wheels/*.whl` in the task Dockerfile
# would otherwise see the previous version alongside the new one.
rm -f "$ROOT"/dist/arize_phoenix-*.whl
uv build --wheel

staged=0
for environment in "$TASKS_DIR"/*/environment; do
  [ -d "$environment" ] || continue
  task=$(basename "$(dirname "$environment")")
  rm -rf "$environment/wheels" "$environment/container_assets" "$environment/data"
  mkdir -p "$environment/wheels" "$environment/data"
  cp "$ROOT"/dist/arize_phoenix-*.whl "$environment/wheels/"
  rsync -a --exclude __pycache__ "$CONTAINER_ASSETS/" "$environment/container_assets/"
  curl -fsSL "$FIXTURES_URL/$task/phoenix.db" -o "$environment/data/phoenix.db"
  staged=$((staged + 1))
done

if [ "$staged" -eq 0 ]; then
  echo "error: no tasks with an environment/ directory found under $TASKS_DIR" >&2
  exit 1
fi

echo "Staged build-context artifacts for $staged task(s)."
