#!/bin/bash
# Seed the Phoenix tool benchmark database from the TRAIL rows, once per checkout.
#
# Downloads the gated rows with HF_TOKEN into evals/harbor/.cache (skipped when
# already there), builds a throwaway image that starts Phoenix from this
# checkout's wheel and loads the rows through the repository's TRAIL loader,
# and copies the finished database out to evals/harbor/environment/data/ for
# scripts/stage_harbor_environments.sh. Nothing TRAIL-derived leaves this
# machine: the rows and the database are gitignored and the image is never
# pushed. RESEED=1 rebuilds a database that already exists.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
HERE="$ROOT/evals/harbor"
ROWS="$HERE/.cache/trail-gaia.json"
BUILD="$HERE/.cache/seed"
DATABASE="$HERE/environment/data/phoenix.db"
SUMMARY="$HERE/.cache/seed-summary.json"

if [ -f "$DATABASE" ] && [ "${RESEED:-0}" != 1 ]; then
  echo "Seeded database already at $DATABASE (RESEED=1 to rebuild)."
  exit 0
fi
if [ ! -f "$ROWS" ]; then
  uv run --script "$HERE/scripts/download_trail.py" --output "$ROWS"
fi

rm -rf "$BUILD"
mkdir -p "$BUILD/seed" "$BUILD/wheels"
echo "Building the Phoenix wheel from $ROOT"
(cd "$ROOT" && uv build --wheel --out-dir "$BUILD/wheels" >/dev/null)
cp "$ROWS" "$ROOT/scripts/load_patronus_trail.py" "$HERE/scripts/seed.py" "$BUILD/seed/"
echo "Seeding the database from the TRAIL rows"
docker build -q -f "$HERE/scripts/seed.Dockerfile" -t phoenix-tools-seed:local "$BUILD" >/dev/null
container=$(docker create phoenix-tools-seed:local)
mkdir -p "$(dirname "$DATABASE")"
docker cp "$container:/data/phoenix.db" "$DATABASE"
docker cp "$container:/seed/summary.json" "$SUMMARY"
docker rm "$container" >/dev/null
rm -rf "$BUILD"
cat "$SUMMARY"
echo "Seeded $DATABASE; run 'make harbor-stage' to stage it into the tasks."
