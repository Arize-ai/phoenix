#!/bin/sh
# Extract the public skills at a git ref into evals/harbor/.cache/skills-<name>/skills, so a
# job condition can load the skills exactly as they were at that commit.
#
# Usage: evals/harbor/scripts/snapshot_skills.sh <git-ref> <name>
set -eu
REF=$1
NAME=$2
ROOT=$(git rev-parse --show-toplevel)
OUT="$ROOT/evals/harbor/.cache/skills-$NAME"
rm -rf "$OUT"
mkdir -p "$OUT"
git -C "$ROOT" archive "$REF" skills | tar -x -C "$OUT"
git -C "$ROOT" rev-parse "$REF" > "$OUT/REF"
echo "Extracted skills at $(cat "$OUT/REF") to $OUT/skills"
