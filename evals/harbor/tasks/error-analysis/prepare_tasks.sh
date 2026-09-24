#!/bin/bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
HARBOR=$(cd "$HERE/../.." && pwd)

"$HARBOR/scripts/lib/prepare_tasks.sh" "$HARBOR/.cache/environment" "$HERE/task.toml"
