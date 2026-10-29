#!/usr/bin/env bash
# Run the phoenix-client canary tests for one third-party SDK against the
# SDK's latest release. These intentionally resolve fresh from PyPI rather
# than from uv.lock: the point is to catch upstream SDK changes early.
#
# Usage: scripts/ci/canary_sdk_tests.sh <sdk> <module> [pytest args...]
#   e.g. scripts/ci/canary_sdk_tests.sh openai chat -ra -x
set -euo pipefail

SDK="$1"
MOD="$2"
shift 2

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLIENT_DIR="$REPO_ROOT/packages/phoenix-client"
SDK_REQ="$REPO_ROOT/requirements/canary/sdk/$SDK.txt"
HELPERS="src/phoenix/client/helpers/sdk"
TESTS="tests/canary/sdk"

cd "$CLIENT_DIR"

export VIRTUAL_ENV="$CLIENT_DIR/.venv-canary-$SDK"
export PATH="$VIRTUAL_ENV/bin:$PATH"
uv venv --quiet "$VIRTUAL_ENV"

uv pip install --strict -U --reinstall-package arize-phoenix-client .
# The helper module must import without the SDK installed.
uv pip uninstall -r "$SDK_REQ"
uv pip list -v
python -c "import phoenix.client.helpers.sdk.$SDK.$MOD"

uv pip install --strict -U -r "$SDK_REQ"
uv pip list -v
pyright -p "$HELPERS/pyrightconfig.json" "$HELPERS/$SDK"
pyright -p "$TESTS/pyrightconfig.json" "$TESTS/$SDK"
mypy --strict --follow-untyped-imports "$HELPERS/$SDK/$MOD.py"
mypy --strict --follow-untyped-imports "$TESTS/$SDK/test_$MOD.py"
pytest --disable-socket "$@" "$TESTS/$SDK"
