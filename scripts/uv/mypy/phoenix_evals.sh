#!/usr/bin/env bash
set -euo pipefail

# Type check phoenix-evals package
cd "$(dirname "$0")/../../.."
cd packages/phoenix-evals
MYPYPATH=src uv run mypy --explicit-package-bases -p phoenix.evals
