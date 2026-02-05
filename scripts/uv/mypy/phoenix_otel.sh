#!/usr/bin/env bash
set -euo pipefail

# Type check phoenix-otel package
cd "$(dirname "$0")/../../.."
cd packages/phoenix-otel
MYPYPATH=src uv run mypy --explicit-package-bases -p phoenix.otel
