#!/usr/bin/env bash
set -euo pipefail

# Type check main Phoenix source code
cd "$(dirname "$0")/../../.."
uv run mypy --strict src/phoenix/
