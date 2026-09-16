#!/bin/bash
# The TRAIL fixture: one project of PatronusAI/TRAIL traces and annotations, seeded
# through this checkout's Phoenix. Writes $1/phoenix.db.
#
# TRAIL is gated on Hugging Face and its terms forbid resharing it outside the hub, so
# every developer seeds it locally with their own HF_TOKEN. The rows are cached beside
# the database and nothing TRAIL-derived is committed, uploaded, or pushed. Without a
# token this exits 2, and staging skips the tasks that need the fixture.
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
