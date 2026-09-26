#!/bin/bash
# Create an empty database for the PXI eval tasks at $1/phoenix.db.
# Phoenix treats a zero-byte SQLite file as an empty database and migrates it on start.
set -euo pipefail
OUT="$1"
mkdir -p "$OUT"
: > "$OUT/phoenix.db"
