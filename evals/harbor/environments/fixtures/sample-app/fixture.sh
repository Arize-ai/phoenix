#!/bin/bash
# Create $1/phoenix.db with the sample support bot's traces, datasets, and judge experiment.
# The seed calls no model provider, so it needs no keys.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../../../.." && pwd)
OUT="$1"
mkdir -p "$OUT"
(cd "$ROOT" && uv run python "$HERE/seed.py" --output "$OUT/phoenix.db")
