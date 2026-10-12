#!/bin/bash
# Create $1/phoenix.db from one project of PatronusAI/TRAIL traces and annotations.
#
# TRAIL is gated on Hugging Face and cannot be redistributed outside the hub. Set
# HF_TOKEN to a token for an account that has accepted the dataset terms. Without a
# token, this script exits with status 2 so staging can skip the TRAIL tasks.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../../../.." && pwd)
OUT="$1"
mkdir -p "$OUT"
if [ -z "${HF_TOKEN:-}" ]; then
  echo "trail: HF_TOKEN is unset; accept the TRAIL terms on Hugging Face and pass a token to seed it" >&2
  exit 2
fi
if [ ! -f "$OUT/rows.json" ]; then
  uv run --script "$HERE/download_trail.py" --output "$OUT/rows.json"
fi
(cd "$ROOT" && uv run python "$HERE/seed.py" --rows "$OUT/rows.json" --output "$OUT/phoenix.db" --project research-assistant)
