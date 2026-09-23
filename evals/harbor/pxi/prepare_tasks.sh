#!/bin/bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
HARBOR=$(cd "$HERE/.." && pwd)
ROOT=$(cd "$HARBOR/../.." && pwd)
CONTEXT="$HARBOR/.cache/pxi-environment"

# The compiler comes from Harbor, which needs a newer Python than the Phoenix development
# environment, so it runs in Harbor's own environment. Keep the defaults in step with the
# Makefile. HARBOR_PXI_ARGS narrows generation, e.g. "--datasets set_spans_filter --limit 4".
# shellcheck disable=SC2086
(cd "$ROOT" && uvx --python "${HARBOR_PYTHON:-3.13}" --from "harbor==${HARBOR_VERSION:-0.21.0}" \
  --with pyyaml python -m evals.harbor.pxi.compile_tasks --out "$HARBOR/tasks/pxi" ${HARBOR_PXI_ARGS:-})

rsync -a --delete --link-dest="$HARBOR/.cache/environment/" "$HARBOR/.cache/environment/" "$CONTEXT/"
rsync -a --exclude __pycache__ --exclude datasets --exclude tests --exclude task_template \
  --exclude '*.sh' "$HERE/" "$CONTEXT/verifier/evals/harbor/pxi/"
"$HARBOR/scripts/lib/prepare_tasks.sh" "$CONTEXT" "$HARBOR/tasks/pxi"/*/task.toml
