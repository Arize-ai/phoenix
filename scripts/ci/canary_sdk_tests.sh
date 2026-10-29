#!/usr/bin/env bash
# Run the phoenix-client canary tests for one third-party SDK against the
# SDK's latest release. These intentionally resolve fresh from PyPI rather
# than from uv.lock: the point is to catch upstream SDK changes early.
#
# Usage: scripts/ci/canary_sdk_tests.sh <sdk> [pytest args...]
#   e.g. scripts/ci/canary_sdk_tests.sh openai -ra -x
set -euo pipefail

SDK="$1"
shift

case "$SDK" in
  openai) MOD=chat ;;
  anthropic) MOD=messages ;;
  google_genai) MOD=generate_content ;;
  *) echo "unknown SDK: $SDK" >&2; exit 2 ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLIENT_DIR="$REPO_ROOT/packages/phoenix-client"
SDK_REQ="$REPO_ROOT/requirements/canary/sdk/$SDK.txt"
HELPERS="src/phoenix/client/helpers/sdk"
TESTS="tests/canary/sdk"

assert_helper_imports_without_sdk() {
  uv pip uninstall -r "$SDK_REQ"
  uv pip list -v
  python -c "import phoenix.client.helpers.sdk.$SDK.$MOD"
}

cd "$CLIENT_DIR"

export VIRTUAL_ENV="$(mktemp -d)/venv"
export PATH="$VIRTUAL_ENV/bin:$PATH"
uv venv --quiet "$VIRTUAL_ENV"

uv pip install --strict -U --reinstall-package arize-phoenix-client .
assert_helper_imports_without_sdk

uv pip install --strict -U -r "$SDK_REQ"
uv pip list -v
pyright -p "$HELPERS/pyrightconfig.json" "$HELPERS/$SDK"
pyright -p "$TESTS/pyrightconfig.json" "$TESTS/$SDK"
mypy --strict --follow-untyped-imports "$HELPERS/$SDK/$MOD.py"
mypy --strict --follow-untyped-imports "$TESTS/$SDK/test_$MOD.py"
pytest --disable-socket "$@" "$TESTS/$SDK"
