#!/bin/bash
# Build Phoenix and stage every task's build context: the shared image definition from
# evals/harbor/environments plus the fixture the task names in its task.toml.
#
# The shared context (Dockerfile, the wheel, the verifiers, the container assets) is
# assembled once under evals/harbor/.cache/environment. Each fixture is produced once by
# evals/harbor/environments/fixtures/<name>/fixture.sh into
# evals/harbor/.cache/fixtures/<name>/phoenix.db (RESEED=1 rebuilds it). A fixture script
# that exits 2 cannot run on this machine (the trail fixture without HF_TOKEN), and the
# tasks that need it are skipped and listed. Every task then gets the context copied into
# its environment/ with hard links, plus its fixture as environment/data/phoenix.db; the
# task's .gitignore keeps that directory out of git and out of the task digest.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
HERE="$ROOT/evals/harbor"
ENVIRONMENTS="$HERE/environments"
CONTEXT="$HERE/.cache/environment"
FIXTURES="$HERE/.cache/fixtures"
TASKS_DIR="$HERE/tasks"

# Clear stale wheels first: `uv pip install /wheels/*.whl` in the Dockerfile would
# otherwise see the previous version alongside the new one.
rm -f "$ROOT"/dist/arize_phoenix-*.whl
(cd "$ROOT" && uv build --wheel)

rm -rf "$CONTEXT"
mkdir -p "$CONTEXT/wheels" "$CONTEXT/verifier/evals/harbor"
cp "$ENVIRONMENTS/Dockerfile" "$CONTEXT/Dockerfile"
cp "$ROOT"/dist/arize_phoenix-*.whl "$CONTEXT/wheels/"
cp "$ROOT/evals/__init__.py" "$CONTEXT/verifier/evals/"
cp "$HERE/__init__.py" "$CONTEXT/verifier/evals/harbor/"
rsync -a --exclude __pycache__ "$HERE/verifiers/" "$CONTEXT/verifier/evals/harbor/verifiers/"
rsync -a --exclude __pycache__ "$ENVIRONMENTS/container_assets/" "$CONTEXT/container_assets/"

unavailable=""
# Produce a fixture once; prints nothing and returns 0 when it is available, 1 when its
# script declined (exit 2), and exits on any other failure.
ensure_fixture() {
  local name=$1 dir="$FIXTURES/$1" script="$ENVIRONMENTS/fixtures/$1/fixture.sh"
  case " $unavailable " in *" $name "*) return 1 ;; esac
  if [ "${RESEED:-0}" = 1 ] && [ ! -f "$dir/.reseeded" ]; then
    rm -f "$dir/phoenix.db"
    mkdir -p "$dir" && touch "$dir/.reseeded"
  fi
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

staged=0
skipped=""
for config in "$TASKS_DIR"/*/task.toml "$TASKS_DIR"/*/*/task.toml; do
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
  staged=$((staged + 1))
done
rm -f "$FIXTURES"/*/.reseeded
echo "Staged $staged task(s)."
if [ -n "$skipped" ]; then
  echo "Skipped (fixture unavailable:$unavailable):$skipped"
fi
