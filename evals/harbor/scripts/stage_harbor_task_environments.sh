#!/bin/bash
# Build Phoenix and stage the generated build-context artifacts into every
# task's environment/ directory: the wheel, the container assets, and the
# task's fixture database from cloud storage. Also assemble the px CLI and its
# production dependencies from source into dist/phoenix-cli/, outside the build
# contexts: the claude-code-cli agent uploads them into its own sandbox at
# install time, so the other agents never see the CLI.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
CONTAINER_ASSETS="$ROOT/evals/harbor/container_assets"
TASKS_DIR="$ROOT/evals/harbor/tasks"
FIXTURES_URL="https://storage.googleapis.com/arize-phoenix-assets/evals/harbor"
CLI_TARBALLS_DIR="$ROOT/dist/phoenix-cli"
CLI_PLATFORM="${HARBOR_CLI_PLATFORM:-linux/amd64}"
# @arizeai/phoenix-cli plus the workspace packages it depends on at runtime, transitively.
# The build below also covers build-time-only workspace packages (phoenix-client's types
# import phoenix-evals), which are not packed.
CLI_PACKAGES="phoenix-config phoenix-otel phoenix-client phoenix-cli"

# Clear stale wheels first: `uv pip install /wheels/*.whl` in the task Dockerfile
# would otherwise see the previous version alongside the new one.
rm -f "$ROOT"/dist/arize_phoenix-*.whl
uv build --wheel

rm -rf "$CLI_TARBALLS_DIR"
mkdir -p "$CLI_TARBALLS_DIR"
# `pkg...` selects the package and its workspace dependencies, dev ones included, and
# builds them in topological order.
(cd "$ROOT/js" && pnpm --filter "@arizeai/phoenix-cli..." run build >/dev/null)
for package in $CLI_PACKAGES; do
  (cd "$ROOT/js" && pnpm --filter "@arizeai/$package" pack --pack-destination "$CLI_TARBALLS_DIR" >/dev/null)
done

docker run --rm --platform "$CLI_PLATFORM" \
  -v "$CLI_TARBALLS_DIR:/tarballs:ro" \
  -v "$CLI_TARBALLS_DIR:/output" \
  -v "$ROOT/evals/harbor/scripts/prepare_phoenix_cli.sh:/prepare.sh:ro" \
  node:22-bookworm-slim sh -ec '
    sh /prepare.sh /tarballs /bundle /tmp/bin
    /tmp/bin/px --version
    tar -czf /output/phoenix-cli.tar.gz -C /bundle .
  '

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

echo "Staged build-context artifacts for $staged task(s) and assembled dist/phoenix-cli/phoenix-cli.tar.gz ($CLI_PLATFORM)."
