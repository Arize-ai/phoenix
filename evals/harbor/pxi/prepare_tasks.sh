#!/bin/bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
HARBOR=$(cd "$HERE/.." && pwd)
ROOT=$(cd "$HARBOR/../.." && pwd)
CONTEXT="$HARBOR/.cache/pxi-environment"

# HARBOR_PXI_ARGS narrows generation, e.g. "--datasets set_spans_filter --limit 4".
# shellcheck disable=SC2086
(cd "$ROOT" && uv run python -m evals.harbor.pxi.compile_tasks --out "$HARBOR/tasks/pxi" ${HARBOR_PXI_ARGS:-})

rsync -a --delete --link-dest="$HARBOR/.cache/environment/" "$HARBOR/.cache/environment/" "$CONTEXT/"
rsync -a --exclude __pycache__ --exclude datasets --exclude prepare_tasks.sh "$HERE/" "$CONTEXT/verifier/evals/harbor/pxi/"
"$HARBOR/scripts/lib/prepare_tasks.sh" "$CONTEXT" "$HARBOR/tasks/pxi"/*/task.toml
