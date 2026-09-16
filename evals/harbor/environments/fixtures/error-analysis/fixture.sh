#!/bin/bash
# The hand-prepared error-analysis fixture, published in the public assets bucket.
# Writes $1/phoenix.db.
set -euo pipefail
OUT="$1"
mkdir -p "$OUT"
curl -fsSL https://storage.googleapis.com/arize-phoenix-assets/evals/harbor/error-analysis/phoenix.db \
  -o "$OUT/phoenix.db"
