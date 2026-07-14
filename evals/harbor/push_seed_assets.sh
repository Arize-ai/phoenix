#!/bin/bash
# Generate every Harbor task's seed artifacts and publish them to
# gs://arize-phoenix-assets/evals/harbor/<task-name>/, where each task's
# environment/bootstrap_data.sh downloads them at the start of the first step.
#
# Clears everything under the evals/harbor prefix before uploading, so the
# bucket always mirrors the tasks in this checkout.
set -euo pipefail

GCS_PREFIX="gs://arize-phoenix-assets/evals/harbor"

if ! command -v gcloud >/dev/null; then
  echo "error: the gcloud CLI is required (https://cloud.google.com/sdk)" >&2
  exit 1
fi

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TASKS_DIR="$ROOT/evals/harbor/tasks"
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

generated=0
for seeder in "$TASKS_DIR"/*/environment/seed_db.py; do
  [ -f "$seeder" ] || continue
  task=$(basename "$(dirname "$(dirname "$seeder")")")
  out="$STAGING/$task"
  mkdir -p "$out"
  echo "Seeding $task..."
  uv run --project "$ROOT" python "$seeder" \
    --db-path "$out/phoenix.db" \
    --ground-truth-out "$out/ground_truth.json"
  printf '{"commit": "%s", "generated_at": "%s"}\n' \
    "$(git -C "$ROOT" rev-parse HEAD)" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$out/metadata.json"
  generated=$((generated + 1))
done

if [ "$generated" -eq 0 ]; then
  echo "error: no tasks with environment/seed_db.py found under $TASKS_DIR" >&2
  exit 1
fi

echo "Clearing $GCS_PREFIX..."
if gcloud storage ls "$GCS_PREFIX/**" >/dev/null 2>&1; then
  gcloud storage rm -r "$GCS_PREFIX"
fi

for out in "$STAGING"/*/; do
  task=$(basename "$out")
  echo "Uploading $task..."
  gcloud storage cp --cache-control=no-store "$out"* "$GCS_PREFIX/$task/"
done

echo "Published $generated task(s) to $GCS_PREFIX"
