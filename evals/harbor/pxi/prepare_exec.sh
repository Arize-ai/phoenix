#!/bin/bash
# Stage the shared PXI environment with its fixture and write the harbor exec config.
# Run scripts/build_harbor_environment.sh first. HARBOR_PXI_ARGS narrows the examples,
# e.g. "--datasets set_spans_filter --limit 4"; HARBOR_EXEC_CONFIG names the output.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
HARBOR=$(cd "$HERE/.." && pwd)
ROOT=$(cd "$HARBOR/../.." && pwd)
CONTEXT="$HARBOR/.cache/pxi-environment"
FIXTURE="$HARBOR/.cache/fixtures/pxi"
CONFIG="${HARBOR_EXEC_CONFIG:-$HARBOR/.cache/pxi-exec.yaml}"

if [ ! -f "$HARBOR/.cache/environment/Dockerfile" ]; then
  echo "Missing shared environment: run evals/harbor/scripts/build_harbor_environment.sh first." >&2
  exit 1
fi

rsync -a --delete --link-dest="$HARBOR/.cache/environment/" "$HARBOR/.cache/environment/" "$CONTEXT/"
rsync -a --exclude __pycache__ --exclude datasets --exclude tests --exclude task_template \
  --exclude '*.sh' "$HERE/" "$CONTEXT/verifier/evals/harbor/pxi/"

if [ "${RESEED:-0}" = 1 ]; then
  rm -f "$FIXTURE/phoenix.db"
fi
if [ ! -f "$FIXTURE/phoenix.db" ]; then
  echo "Producing the pxi fixture..."
  "$HARBOR/environments/fixtures/pxi/fixture.sh" "$FIXTURE"
fi
mkdir -p "$CONTEXT/data"
ln -f "$FIXTURE/phoenix.db" "$CONTEXT/data/phoenix.db" 2>/dev/null \
  || cp "$FIXTURE/phoenix.db" "$CONTEXT/data/phoenix.db"

# shellcheck disable=SC2086
(cd "$ROOT" && uv run python -m evals.harbor.pxi.exec_config \
  --out "$CONFIG" --environment-dir "$CONTEXT" ${HARBOR_PXI_ARGS:-})
