#!/usr/bin/env python3
"""Create an ephemeral Phoenix system API key for the integration docs run."""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-file", type=Path, required=True)
    args = parser.parse_args()

    endpoint = os.environ.get("PHOENIX_ENDPOINT", "http://127.0.0.1:6006").rstrip("/")
    admin_secret = os.environ["PHOENIX_ADMIN_SECRET"]
    request = urllib.request.Request(
        f"{endpoint}/v1/system/api_keys",
        data=json.dumps(
            {
                "data": {
                    "name": "integration-docs-harness",
                    "description": "Ephemeral key for the integration docs CI run",
                    "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                }
            }
        ).encode(),
        headers={
            "Authorization": f"Bearer {admin_secret}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            api_key = json.load(response)["data"]["key"]
    except (urllib.error.URLError, KeyError, json.JSONDecodeError) as error:
        raise SystemExit(f"Could not create Phoenix API key: {error}") from error

    args.output_file.write_text(api_key)
    args.output_file.chmod(0o600)
    # Mask the ephemeral credential in subsequent GitHub Actions log output.
    print(f"::add-mask::{api_key}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
