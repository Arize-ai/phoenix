#!/bin/sh
# Download the task's seed database and ground truth (published by
# evals/harbor/push_seed_assets.sh) into /data. Idempotent across steps.
set -eu
if [ ! -f /data/phoenix.db ] || [ ! -f /data/ground_truth.json ]; then
  mkdir -p /data
  python - <<'EOF'
import os
import urllib.request

BASE_URL = "https://storage.googleapis.com/arize-phoenix-assets/evals/harbor/regression-triage"
try:
    for name in ("ground_truth.json", "phoenix.db"):
        tmp = f"/data/{name}.tmp"
        urllib.request.urlretrieve(f"{BASE_URL}/{name}", tmp)
        os.replace(tmp, f"/data/{name}")
except Exception as exc:
    raise SystemExit(
        f"error: failed to download seed assets from {BASE_URL}: {exc}; "
        "publish them with evals/harbor/push_seed_assets.sh"
    )
EOF
fi
