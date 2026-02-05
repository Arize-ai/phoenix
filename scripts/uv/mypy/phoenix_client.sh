#!/usr/bin/env bash
set -euo pipefail

# Type check phoenix-client package
cd "$(dirname "$0")/../../.."
cd packages/phoenix-client
MYPYPATH=src uv run mypy --strict --explicit-package-bases -p phoenix.client
