#!/bin/bash
# Produce $1/phoenix.db for the api-selection tasks.
#
# The fixture is a full Phoenix development database (about 840 MB once compacted) whose
# reference answers were computed on 2026-10-01. Download the published copy, or build it
# from a local dump named by PHOENIX_SQL_BENCHMARK_SOURCE_DB. Building compacts the dump
# with VACUUM INTO, which also folds in its write-ahead log, then runs scrub.py to remove
# credentials, tokens, personal emails, home directories, and PXI chat history that the
# tasks never read. Without either source the script exits with status 2 so staging
# skips these tasks.
#
# Both paths work on a temporary file and move it into place only once it is complete,
# because staging treats any existing $1/phoenix.db as a finished fixture.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$1"
mkdir -p "$OUT"
PUBLISHED=https://storage.googleapis.com/arize-phoenix-assets/evals/harbor/sql-benchmark/phoenix.db
SOURCE="${PHOENIX_SQL_BENCHMARK_SOURCE_DB:-}"
FINAL="$OUT/phoenix.db"
TMP="$FINAL.tmp"
trap 'rm -f "$TMP"' EXIT
rm -f "$TMP"

if [ -n "$SOURCE" ]; then
  if [ ! -f "$SOURCE" ]; then
    echo "sql-benchmark: PHOENIX_SQL_BENCHMARK_SOURCE_DB=$SOURCE does not exist" >&2
    exit 1
  fi
  sqlite3 "$SOURCE" "VACUUM INTO '$TMP'"
  python3 "$HERE/scrub.py" "$TMP"
  mv "$TMP" "$FINAL"
  exit 0
fi

if curl -fsSL "$PUBLISHED" -o "$TMP"; then
  mv "$TMP" "$FINAL"
  exit 0
fi
echo "sql-benchmark: no published fixture at $PUBLISHED and PHOENIX_SQL_BENCHMARK_SOURCE_DB is unset" >&2
exit 2
