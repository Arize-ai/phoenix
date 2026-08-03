"""Download a task's fixtures into /data.

Fetches every object published under the task's GCS prefix by
evals/harbor/scripts/publish_fixtures.sh. Idempotent across steps: files already
present are left untouched.
"""

import argparse
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

BUCKET = "arize-phoenix-assets"
PREFIX = "evals/harbor"
DATA_DIR = Path("/data")


def list_fixtures(task: str) -> list[str]:
    """Return the object names published under the task's prefix."""
    prefix = f"{PREFIX}/{task}/"
    names: list[str] = []
    page_token = ""
    while True:
        query = urllib.parse.urlencode({"prefix": prefix, "pageToken": page_token})
        url = f"https://storage.googleapis.com/storage/v1/b/{BUCKET}/o?{query}"
        with urllib.request.urlopen(url) as response:
            listing = json.load(response)
        names.extend(
            name for item in listing.get("items", []) if (name := item["name"].removeprefix(prefix))
        )
        page_token = listing.get("nextPageToken", "")
        if not page_token:
            return names


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True, help="task directory name under the GCS prefix")
    args = parser.parse_args()
    base_url = f"https://storage.googleapis.com/{BUCKET}/{PREFIX}/{args.task}"
    try:
        fixtures = list_fixtures(args.task)
        if not fixtures:
            raise RuntimeError("no objects found under the task prefix")
        for name in fixtures:
            target = DATA_DIR / name
            if target.is_file():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_name(f"{target.name}.tmp")
            urllib.request.urlretrieve(f"{base_url}/{name}", tmp)
            os.replace(tmp, target)
    except Exception as exc:
        raise SystemExit(
            f"error: failed to download fixtures from {base_url}: {exc}; "
            "publish them with evals/harbor/scripts/publish_fixtures.sh"
        )


if __name__ == "__main__":
    main()
