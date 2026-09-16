#!/bin/bash
# Build the px CLI from source and assemble it with its production dependencies
# into dist/phoenix-cli/phoenix-cli.tar.gz, outside every task's build context:
# the claude-code-cli agent uploads the archive into its own sandbox at install
# time, so the other agents never see the CLI.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
CLI_TARBALLS_DIR="$ROOT/dist/phoenix-cli"
CLI_PLATFORM="${HARBOR_CLI_PLATFORM:-linux/amd64}"
# @arizeai/phoenix-cli plus the workspace packages it depends on at runtime, transitively.
# The build below also covers build-time-only workspace packages (phoenix-client's types
# import phoenix-evals), which are not packed.
CLI_PACKAGES="phoenix-config phoenix-otel phoenix-client phoenix-cli"

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

echo "Assembled dist/phoenix-cli/phoenix-cli.tar.gz ($CLI_PLATFORM)."
