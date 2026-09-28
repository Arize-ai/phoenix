#!/bin/bash
# Download Codex with its Linux binary into dist/codex/codex-<version>-linux-<arch>.tar.gz
# for the x64 and arm64 architectures.
#
# Usage: build_codex_archive.sh <version>
#
# The Codex agents upload the archive for the sandbox's architecture at install time.
# Harbor's own installer fetches nvm and Node from hosts that the job allowlist blocks,
# so the archive keeps the sandbox sealed. The version must match `kwargs.version` on the
# Codex agents in the job file, which Harbor checks before it skips its installer.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
VERSION="${1:?usage: build_codex_archive.sh <version>}"
OUTPUT_DIR="$ROOT/dist/codex"

mkdir -p "$OUTPUT_DIR"
# npm selects the platform package for the container's architecture, so each archive is
# built in a container of that architecture.
for arch in x64 arm64; do
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
