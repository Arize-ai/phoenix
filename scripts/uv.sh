#!/usr/bin/env bash
# Run the uv that writes uv.lock (the lower bound of [tool.uv] required-version)
# without changing the system uv.
#
# uv.lock is written by whichever uv runs `uv lock`, `uv add`, `uv sync` or a
# `uv run` that notices a stale lock, and different uv versions can serialize
# the same lock differently. Routing the Makefile and pnpm scripts through this
# wrapper keeps the committed lock coming from one version. Any installed uv
# works: if it isn't the pinned version, `uv tool run` fetches the pinned one
# into uv's cache.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pin="$(grep -E '^required-version\s*=' "$root/pyproject.toml" \
  | grep -oE '>=[0-9]+\.[0-9]+\.[0-9]+' | head -1 | cut -c3-)"
if [ -z "$pin" ]; then
  echo "error: no uv lower bound found in [tool.uv] required-version in $root/pyproject.toml" >&2
  exit 1
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "error: uv is not installed. Install it from https://docs.astral.sh/uv/getting-started/installation/" >&2
  exit 1
fi

if [ "$(uv --version | awk '{ print $2 }')" = "$pin" ]; then
  exec uv "$@"
fi
exec uv tool run --quiet "uv@$pin" "$@"
