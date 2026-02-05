#!/usr/bin/env bash
set -euo pipefail

# Type check integration tests
cd "$(dirname "$0")/../../.."
cd tests/integration
uv run mypy --strict .
