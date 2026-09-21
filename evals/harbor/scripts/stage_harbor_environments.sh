#!/bin/bash
# Build Phoenix and stage the build context for every Harbor task.
#
# The script builds the shared files once under evals/harbor/.cache/environment and each
# fixture once under evals/harbor/.cache/fixtures. Set RESEED=1 to rebuild fixtures. Exit
# code 2 marks a fixture as unavailable, so the script skips its tasks. Each staged task
# receives hard links to the shared files and its fixture at environment/data/phoenix.db.
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
# The PXI tasks seed and verify with the harness compiler and evaluators from evals/pxi.
rsync -a --exclude __pycache__ "$HERE/pxi/" "$CONTEXT/verifier/evals/harbor/pxi/"
mkdir -p "$CONTEXT/verifier/evals/pxi"
cp "$ROOT/evals/pxi/__init__.py" "$CONTEXT/verifier/evals/pxi/"
rsync -a --exclude __pycache__ "$ROOT/evals/pxi/harness/" "$CONTEXT/verifier/evals/pxi/harness/"
rsync -a --exclude __pycache__ "$ROOT/evals/pxi/evaluators/" "$CONTEXT/verifier/evals/pxi/evaluators/"
rsync -a --exclude __pycache__ "$ENVIRONMENTS/container_assets/" "$CONTEXT/container_assets/"

if [ "${RESEED:-0}" = 1 ]; then
  rm -f "$FIXTURES"/*/phoenix.db
fi

unavailable=""
# Return 0 for an available fixture and 1 when its script reports that it is unavailable.
# Exit on any other fixture error.
ensure_fixture() {
  local name=$1 dir="$FIXTURES/$1" script="$ENVIRONMENTS/fixtures/$1/fixture.sh"
  case " $unavailable " in *" $name "*) return 1 ;; esac
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

# Generate the PXI tasks from the datasets in evals/pxi/datasets before staging them.
# HARBOR_PXI_ARGS narrows the generation, e.g. "--datasets set_spans_filter --limit 4".
# shellcheck disable=SC2086
(cd "$ROOT" && uv run python -m evals.harbor.pxi.generate_tasks --out "$TASKS_DIR/pxi" ${HARBOR_PXI_ARGS:-})

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
echo "Staged $staged task(s)."
if [ -n "$skipped" ]; then
  echo "Skipped (fixture unavailable:$unavailable):$skipped"
fi
