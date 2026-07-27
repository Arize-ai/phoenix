"""Download a task's fixtures (Phoenix database and ground truth) into /data.

The assets are published by evals/harbor/publish_fixtures.sh. Idempotent
across steps: files already present are left untouched.
"""

import argparse
import os
import urllib.request
from pathlib import Path

GCS_PREFIX = "https://storage.googleapis.com/arize-phoenix-assets/evals/harbor"
DATA_DIR = Path("/data")
ASSETS = ("ground_truth.json", "phoenix.db")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True, help="task directory name under the GCS prefix")
    args = parser.parse_args()
    base_url = f"{GCS_PREFIX}/{args.task}"
    if all((DATA_DIR / name).is_file() for name in ASSETS):
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        for name in ASSETS:
            tmp = DATA_DIR / f"{name}.tmp"
            urllib.request.urlretrieve(f"{base_url}/{name}", tmp)
            os.replace(tmp, DATA_DIR / name)
    except Exception as exc:
        raise SystemExit(
            f"error: failed to download fixtures from {base_url}: {exc}; "
            "publish them with evals/harbor/publish_fixtures.sh"
        )


if __name__ == "__main__":
    main()
