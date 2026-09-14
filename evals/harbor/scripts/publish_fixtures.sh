#!/bin/bash
# Generate every Harbor task's fixtures and publish them to
# gs://arize-phoenix-assets/evals/harbor/<task-name>/, where each task's
# container_assets/fetch_fixtures.py downloads them at the start of the first step.
#
# Clears each regenerated task's prefix before uploading it. Tasks without a
# generator (hand-prepared fixtures such as error-analysis) keep what was
# uploaded by hand.
set -euo pipefail

GCS_PREFIX="gs://arize-phoenix-assets/evals/harbor"

if ! command -v gcloud >/dev/null; then
  echo "error: the gcloud CLI is required (https://cloud.google.com/sdk)" >&2
  exit 1
fi

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
TASKS_DIR="$ROOT/evals/harbor/tasks"
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

generated=0
for generator in "$TASKS_DIR"/*/environment/generate_fixture_data.py; do
  [ -f "$generator" ] || continue
  task=$(basename "$(dirname "$(dirname "$generator")")")
  out="$STAGING/$task"
  mkdir -p "$out"
  echo "Generating fixtures for $task..."
  uv run --project "$ROOT" python "$generator" \
    --db-path "$out/phoenix.db" \
    --ground-truth-out "$out/ground_truth.json"
  printf '{"commit": "%s", "generated_at": "%s"}\n' \
    "$(git -C "$ROOT" rev-parse HEAD)" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$out/metadata.json"
  generated=$((generated + 1))
done

if [ "$generated" -eq 0 ]; then
  echo "error: no tasks with environment/generate_fixture_data.py found under $TASKS_DIR" >&2
  exit 1
fi

for out in "$STAGING"/*/; do
  task=$(basename "$out")
  if gcloud storage ls "$GCS_PREFIX/$task/**" >/dev/null 2>&1; then
    echo "Clearing $GCS_PREFIX/$task..."
    gcloud storage rm -r "$GCS_PREFIX/$task"
  fi
  echo "Uploading $task..."
  gcloud storage cp --cache-control=no-store "$out"* "$GCS_PREFIX/$task/"
done

echo "Published $generated task(s) to $GCS_PREFIX"
