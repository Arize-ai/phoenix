#!/bin/bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
HERE="$ROOT/evals/harbor"
ENVIRONMENTS="$HERE/environments"
FIXTURES="$HERE/.cache/fixtures"
TASKS_DIR="$HERE/tasks"
CONTEXT="$1"
shift

if [ ! -f "$CONTEXT/Dockerfile" ]; then
  echo "Missing shared environment: run make harbor-prepare first." >&2
  exit 1
fi

prepared=""
unavailable=""
# Return 0 for an available fixture and 1 when its script reports that it is unavailable.
# Exit on any other fixture error.
ensure_fixture() {
  local name=$1 dir="$FIXTURES/$1" script="$ENVIRONMENTS/fixtures/$1/fixture.sh"
  case " $unavailable " in *" $name "*) return 1 ;; esac
  case " $prepared " in *" $name "*) return 0 ;; esac
  if [ "${RESEED:-0}" = 1 ]; then
    rm -f "$dir/phoenix.db"
  fi
  prepared="$prepared $name"
  [ -f "$dir/phoenix.db" ] && return 0
  if [ ! -x "$script" ]; then
    echo "No fixture script at $script" >&2
    exit 1
  fi
  echo "Producing the $name fixture..."
  local status=0
  "$script" "$dir" || status=$?
  if [ "$status" = 0 ]; then
    return 0
  elif [ "$status" = 2 ]; then
    unavailable="$unavailable $name"
    return 1
  fi
  echo "$script failed with exit code $status" >&2
  exit "$status"
}

prepared_count=0
skipped=""
for config in "$@"; do
  [ -f "$config" ] || continue
  task=$(dirname "$config")
  fixture=$(sed -n 's/^fixture = "\(.*\)"$/\1/p' "$config")
  if [ -z "$fixture" ]; then
    echo "$config names no fixture: add [metadata] fixture = \"<name>\"" >&2
    exit 1
  fi
  if ! ensure_fixture "$fixture"; then
    skipped="$skipped ${task#"$TASKS_DIR/"}"
    continue
  fi
  # Hard links keep a dozen copies of the wheel and the database from costing a dozen
  # times the disk; Docker and Daytona read them as ordinary files.
  rsync -a --delete --link-dest="$CONTEXT/" "$CONTEXT/" "$task/environment/"
  mkdir -p "$task/environment/data"
  ln -f "$FIXTURES/$fixture/phoenix.db" "$task/environment/data/phoenix.db" 2>/dev/null \
    || cp "$FIXTURES/$fixture/phoenix.db" "$task/environment/data/phoenix.db"
  prepared_count=$((prepared_count + 1))
done
echo "Prepared $prepared_count task(s)."
if [ -n "$skipped" ]; then
  echo "Skipped (fixture unavailable:$unavailable):$skipped"
fi
