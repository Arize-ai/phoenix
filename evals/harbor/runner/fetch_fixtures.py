"""Download the task's fixtures (Phoenix database and ground truth) into /data.

The assets are published by evals/harbor/publish_fixtures.sh. Idempotent
across steps: files already present are left untouched.

This file is a template: stage_harbor_task_environments.sh substitutes __HARBOR_TASK_NAME__ with the
task directory name when staging it into each task's environment/. Do not edit
the staged copies; edit this canonical version under evals/harbor/runner/.
"""

import os
import urllib.request
from pathlib import Path

BASE_URL = "https://storage.googleapis.com/arize-phoenix-assets/evals/harbor/__HARBOR_TASK_NAME__"
DATA_DIR = Path("/data")
ASSETS = ("ground_truth.json", "phoenix.db")


def main() -> None:
    if all((DATA_DIR / name).is_file() for name in ASSETS):
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        for name in ASSETS:
            tmp = DATA_DIR / f"{name}.tmp"
            urllib.request.urlretrieve(f"{BASE_URL}/{name}", tmp)
            os.replace(tmp, DATA_DIR / name)
    except Exception as exc:
        raise SystemExit(
            f"error: failed to download fixtures from {BASE_URL}: {exc}; "
            "publish them with evals/harbor/publish_fixtures.sh"
        )


if __name__ == "__main__":
    main()
