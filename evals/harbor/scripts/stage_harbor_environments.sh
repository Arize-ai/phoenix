#!/bin/bash
# Prepare only the tasks selected by HARBOR_JOB, as harbor-run does.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
cd "$ROOT"
exec uv run --script evals/harbor/scripts/stage_harbor_environments.py \
  "${HARBOR_JOB:-evals/harbor/jobs/regression.yaml}" "$@"
