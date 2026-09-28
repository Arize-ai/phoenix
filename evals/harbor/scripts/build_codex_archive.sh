#!/bin/bash
# Download Codex with its Linux binary into dist/codex/codex-<version>-linux-<arch>.tar.gz.
#
# Usage: build_codex_archive.sh <version>
#
# The Codex agents upload this archive at install time because Harbor's own installer
# fetches nvm and Node from hosts that the job allowlist blocks.
#
# Daytona sandboxes are x64, and local Docker uses the host's architecture, so the script
# builds x64 plus arm64 on an arm64 host. HARBOR_CODEX_ARCHES overrides the list.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
VERSION="${1:?usage: build_codex_archive.sh <version>}"
OUTPUT_DIR="$ROOT/dist/codex"
case $(uname -m) in
  arm64 | aarch64) ARCHES="${HARBOR_CODEX_ARCHES:-x64 arm64}" ;;
  *) ARCHES="${HARBOR_CODEX_ARCHES:-x64}" ;;
esac

mkdir -p "$OUTPUT_DIR"
# npm picks the Codex platform package for the container's architecture.
for arch in $ARCHES; do
  case $arch in
    x64) platform=linux/amd64 ;;
    arm64) platform=linux/arm64 ;;
  esac
  archive="codex-$VERSION-linux-$arch.tar.gz"
  docker run --rm --platform "$platform" \
    -v "$OUTPUT_DIR:/output" \
    -e "VERSION=$VERSION" -e "ARCHIVE=$archive" \
    node:22-bookworm-slim sh -ec '
      mkdir -p /bundle
      cd /bundle
      npm install --omit=dev --no-audit --no-fund --loglevel=error "@openai/codex@$VERSION"
      /bundle/node_modules/.bin/codex --version
      tar -czf "/output/$ARCHIVE" -C /bundle node_modules
    '
  echo "Assembled dist/codex/$archive."
done
