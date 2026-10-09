#!/bin/bash
# Build Phoenix and the verifiers wheel, then stage the build context for every Harbor task.
#
# The script builds the shared files once under evals/harbor/.cache/environment and each
# fixture once under evals/harbor/.cache/fixtures, rebuilding it when its scripts change.
# Set RESEED=1 to rebuild fixtures anyway. Exit code 2 marks a fixture as unavailable, so
# the script skips its tasks. Each staged task receives hard links to the shared files and
# its fixture at environment/data/phoenix.db.
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
mkdir -p "$CONTEXT/wheels"
cp "$ENVIRONMENTS/Dockerfile" "$CONTEXT/Dockerfile"
cp "$ROOT"/dist/arize_phoenix-*.whl "$CONTEXT/wheels/"
(cd "$ROOT" && uv build --wheel --out-dir "$CONTEXT/wheels" "$HERE/verifiers")
rsync -a --exclude __pycache__ "$ENVIRONMENTS/container_assets/" "$CONTEXT/container_assets/"

if [ "${RESEED:-0}" = 1 ]; then
  rm -f "$FIXTURES"/*/phoenix.db
fi

unavailable=""
# Print a digest of the files that produce a fixture: its own directory, plus the repository
# paths listed one per line in its optional `inputs` file. A cached fixture whose digest
# differs was produced by an older script and is rebuilt.
fixture_digest() {
  local source="$ENVIRONMENTS/fixtures/$1" paths=()
  if [ -f "$source/inputs" ]; then
    # `|| [ -n "$path" ]` keeps a last line that has no trailing newline.
    while IFS= read -r path || [ -n "$path" ]; do
      [ -n "$path" ] || continue
      if [ ! -e "$ROOT/$path" ]; then
        echo "$source/inputs lists $path, which does not exist" >&2
        exit 1
      fi
      paths+=("$ROOT/$path")
    done <"$source/inputs"
  fi
  find "$source" ${paths[@]+"${paths[@]}"} -type f ! -name '*.pyc' -print0 | LC_ALL=C sort -z \
    | xargs -0 shasum -a 256 | sed "s|$ROOT/||" | shasum -a 256 | cut -d' ' -f1
}

# Return 0 for an available fixture and 1 when it is unavailable: its script exits 2, or a
# cached copy is stale and cannot be rebuilt. A stale copy is never staged, because it grades
# tasks against data the current scripts would not produce. Exit on any other error.
ensure_fixture() {
  local name=$1 dir="$FIXTURES/$1" script="$ENVIRONMENTS/fixtures/$1/fixture.sh"
  case " $unavailable " in *" $name "*) return 1 ;; esac
  local digest stale=0
  # `|| exit`: the caller's `if` suspends `set -e` here, and the digest runs in a subshell.
  digest=$(fixture_digest "$name") || exit 1
  if [ -f "$dir/phoenix.db" ]; then
    [ "$(cat "$dir/digest" 2>/dev/null)" = "$digest" ] && return 0
    echo "The $name fixture predates its current scripts; rebuilding it."
    stale=1
    rm -f "$dir/phoenix.db" "$dir/digest"
  fi
  if [ ! -x "$script" ]; then
    echo "No fixture script at $script" >&2
    exit 1
  fi
  echo "Producing the $name fixture..."
  local status=0
  "$script" "$dir" || status=$?
  if [ "$status" = 0 ]; then
    echo "$digest" >"$dir/digest"
    return 0
  fi
  if [ "$status" = 2 ] || [ "$stale" = 1 ]; then
    if [ "$stale" = 1 ]; then
      echo "WARNING: could not rebuild the stale $name fixture (exit $status); skipping its tasks." >&2
    fi
    rm -f "$dir/phoenix.db"
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
    # Unstage any earlier copy, so the run check reports the task instead of using it.
    rm -f "$task/environment/data/phoenix.db"
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
