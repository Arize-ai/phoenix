#!/bin/bash
# Build the Phoenix, base-agent, and CLI-agent images from this checkout.
# TAG defaults to "local". IMAGES selects "all", "phoenix", or "agent".
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
HERE="$ROOT/evals/harbor"
TAG=${TAG:-local}
IMAGES=${IMAGES:-all}
ROWS="$HERE/.cache/trail-gaia.json"
BUILD="$HERE/.cache/build"

case "$IMAGES" in
  all|phoenix|agent) ;;
  *) echo "error: IMAGES must be all, phoenix, or agent (got '$IMAGES')" >&2; exit 2 ;;
esac

rm -rf "$BUILD"

if [ "$IMAGES" = all ] || [ "$IMAGES" = phoenix ]; then
  if [ ! -f "$ROWS" ]; then
    echo "error: missing $ROWS — run 'make harbor-seed' first" >&2
    exit 1
  fi
  mkdir -p "$BUILD/phoenix/seed"
  echo "Building Phoenix wheel from $ROOT"
  (cd "$ROOT" && uv build --wheel --out-dir "$BUILD/phoenix/wheels" >/dev/null)
  cp "$ROWS" "$BUILD/phoenix/seed/"
  cp "$ROOT/scripts/load_patronus_trail.py" "$HERE/environment/seed.py" "$BUILD/phoenix/seed/"
  docker build -f "$HERE/environment/phoenix.Dockerfile" -t "phoenix-bench-phoenix:$TAG" "$BUILD/phoenix"
  docker run --rm "phoenix-bench-phoenix:$TAG" cat /seed/summary.json
  echo "Built phoenix-bench-phoenix:$TAG"
fi

if [ "$IMAGES" = all ] || [ "$IMAGES" = agent ]; then
  mkdir -p "$BUILD/agent/evals/harbor"
  cp "$ROOT/evals/__init__.py" "$BUILD/agent/evals/"
  cp "$HERE/__init__.py" "$BUILD/agent/evals/harbor/"
  cp -R "$HERE/lib" "$BUILD/agent/evals/harbor/lib"
  find "$BUILD/agent" -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null || true
  docker build -f "$HERE/environment/agent.Dockerfile" --target agent -t "phoenix-bench-agent:$TAG" "$BUILD/agent"
  docker build -f "$HERE/environment/agent.Dockerfile" --target agent-cli -t "phoenix-bench-agent-cli:$TAG" "$BUILD/agent"
  echo "Built phoenix-bench-agent:$TAG and phoenix-bench-agent-cli:$TAG"
fi
