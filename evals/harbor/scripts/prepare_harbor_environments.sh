#!/bin/bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")/.." && pwd)

"$HERE/scripts/build_harbor_environment.sh"
"$HERE/tasks/error-analysis/prepare_tasks.sh"
"$HERE/tasks/trail-benchmark-dev/prepare_tasks.sh"
"$HERE/pxi/prepare_tasks.sh"
