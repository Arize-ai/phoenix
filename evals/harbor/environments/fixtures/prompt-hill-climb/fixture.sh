#!/bin/bash
# Download the published prompt-hill-climb fixture to $1/phoenix.db.
set -euo pipefail
OUT="$1"
mkdir -p "$OUT"
curl -fsSL https://storage.googleapis.com/arize-phoenix-assets/evals/harbor/prompt-hill-climb/phoenix.db \
  -o "$OUT/phoenix.db"
