# /// script
# requires-python = ">=3.10"
# dependencies = ["datasets>=4.0"]
# ///
"""Download the TRAIL rows that seed the trail fixture.

TRAIL is gated on Hugging Face and its terms forbid resharing outside the hub,
so every developer downloads it with their own token. `fixture.sh` runs this
through `uv run --script`; the output is cached under evals/harbor/.cache and
never committed, and the seeded database stays local.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

DATASET = "PatronusAI/TRAIL"
REVISION = "b424ce63d5973d5dcd7169b1bc3c07ccdee276d1"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", default="gaia")
    parser.add_argument("--revision", default=REVISION, help="immutable dataset commit")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    token = os.environ.get("HF_TOKEN")
    if not token:
        sys.exit("HF_TOKEN is required: accept the TRAIL terms on Hugging Face and export a token")
    from datasets import load_dataset  # type: ignore[import-not-found]

    dataset = load_dataset(DATASET, split=args.split, revision=args.revision, token=token)
    rows = [{"trace": row["trace"], "labels": row["labels"]} for row in dataset]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(rows))
    print(f"Saved {len(rows)} TRAIL rows to {args.output}")


if __name__ == "__main__":
    main()
