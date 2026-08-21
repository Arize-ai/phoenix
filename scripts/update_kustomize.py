"""
Updates the Kustomize template with a new Phoenix Docker image version.

Usage:
    python scripts/update_kustomize.py <new_phoenix_version>

Example:
    python scripts/update_kustomize.py 13.0.0
"""

import argparse
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
KUSTOMIZE_PATHS = (
    REPO_ROOT / "kustomize" / "base" / "phoenix.yaml",
    REPO_ROOT / "kustomize" / "datagen" / "deployment.yaml",
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Update the Kustomize template with a new Phoenix Docker image version."
        ),
    )
    parser.add_argument(
        "version",
        help="New Phoenix version (e.g. 13.0.0)",
    )
    args = parser.parse_args()

    if not re.match(r"^\d+\.\d+\.\d+$", args.version):
        parser.error(
            f"Invalid version format: {args.version!r} (expected MAJOR.MINOR.PATCH)"
        )

    for path in KUSTOMIZE_PATHS:
        text = path.read_text()
        updated = re.sub(
            r"arizephoenix/phoenix:version-\S+",
            f"arizephoenix/phoenix:version-{args.version}",
            text,
        )
        path.write_text(updated)
        print(f"Updated {path}")


if __name__ == "__main__":
    main()
