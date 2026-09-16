#!/bin/bash
# Build Phoenix and stage the generated build-context artifacts into every
# task's environment/ directory: the wheel, the container assets, and the
# task's fixture database.
#
# A task with its own environment/Dockerfile gets its fixture from cloud
# storage. The Phoenix tool benchmark tasks under tasks/phoenix-tools-*/ share
# the image in evals/harbor/environment, whose database `make harbor-seed`
# seeds locally (TRAIL is gated, so it is never published): that directory is
# copied into each of them with hard links, and they are skipped until the
# seeded database exists.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
HERE="$ROOT/evals/harbor"
CONTAINER_ASSETS="$HERE/container_assets"
TASKS_DIR="$HERE/tasks"
SHARED="$HERE/environment"
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
echo "Staged build-context artifacts for $staged task(s)."

if [ ! -f "$SHARED/data/phoenix.db" ]; then
  echo "Skipped the Phoenix tool benchmark tasks: no seeded database at $SHARED/data/phoenix.db (run 'make harbor-seed')."
  exit 0
fi
rm -rf "$SHARED/wheels" "$SHARED/lib" "$SHARED/container_assets"
mkdir -p "$SHARED/wheels" "$SHARED/lib/evals/harbor"
cp "$ROOT"/dist/arize_phoenix-*.whl "$SHARED/wheels/"
cp "$ROOT/evals/__init__.py" "$SHARED/lib/evals/"
cp "$HERE/__init__.py" "$SHARED/lib/evals/harbor/"
rsync -a --exclude __pycache__ "$HERE/lib/" "$SHARED/lib/evals/harbor/lib/"
rsync -a --exclude __pycache__ "$CONTAINER_ASSETS/" "$SHARED/container_assets/"
tools=0
for task in "$TASKS_DIR"/phoenix-tools-*/*/; do
  [ -f "$task/task.toml" ] || continue
  # Hard links keep ten copies of the database from costing ten times the disk;
  # Docker and Daytona read them as ordinary files.
  rsync -a --delete --link-dest="$SHARED/" "$SHARED/" "$task/environment/"
  tools=$((tools + 1))
done
echo "Staged the shared tool benchmark environment into $tools task(s)."
