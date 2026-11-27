#!/bin/bash
# Download the published error-analysis fixture to $1/phoenix.db.
set -euo pipefail
OUT="$1"
mkdir -p "$OUT"
curl -fsSL https://storage.googleapis.com/arize-phoenix-assets/evals/harbor/error-analysis/phoenix.db \
  -o "$OUT/phoenix.db"
