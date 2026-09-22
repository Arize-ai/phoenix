#!/bin/bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
HERE="$ROOT/evals/harbor"
ENVIRONMENTS="$HERE/environments"
CONTEXT="$HERE/.cache/environment"

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
