#!/usr/bin/env bash
set -euo pipefail

# Type check unit tests
cd "$(dirname "$0")/../../.."
cd tests
uv run mypy --strict unit/
