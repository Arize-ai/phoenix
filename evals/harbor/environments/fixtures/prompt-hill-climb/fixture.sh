#!/bin/bash
# Download the published prompt-hill-climb fixture to $1/phoenix.db.
set -euo pipefail
OUT="$1"
mkdir -p "$OUT"
curl -fsSL https://storage.googleapis.com/arize-phoenix-assets/evals/harbor/prompt-hill-climb/phoenix.db \
  -o "$OUT/phoenix.db.part"
# Renamed only once complete, so a failed download leaves no partial database.
mv "$OUT/phoenix.db.part" "$OUT/phoenix.db"
