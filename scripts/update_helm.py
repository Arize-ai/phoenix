"""
Updates the Helm chart for a new Phoenix release version.

Usage:
    python scripts/update_helm.py <new_phoenix_version>

Example:
    python scripts/update_helm.py 13.0.0
"""

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HELM_VALUES_PATH = REPO_ROOT / "helm" / "values.yaml"
HELM_CHART_PATH = REPO_ROOT / "helm" / "Chart.yaml"

SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def parse_semver(version: str) -> tuple[int, int, int]:
    match = SEMVER_RE.match(version)
    if not match:
        raise ValueError(f"Invalid semver: {version!r}")
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def update_helm_values(new_version: str) -> None:
    text = HELM_VALUES_PATH.read_text()
    updated = re.sub(
        r"tag:\s*version-\S+",
        f"tag: version-{new_version}-nonroot",
        text,
    )
    HELM_VALUES_PATH.write_text(updated)
    print(f"Updated {HELM_VALUES_PATH}")


def update_helm_chart(new_version: str) -> None:
    text = HELM_CHART_PATH.read_text()

    # Parse the current appVersion from Chart.yaml.
    app_version_match = re.search(r'appVersion:\s*"([^"]+)"', text)
    if not app_version_match:
        print("Error: could not find appVersion in Chart.yaml", file=sys.stderr)
        sys.exit(1)
    old_app_version = app_version_match.group(1)

    # Parse the current chart version from Chart.yaml.
    chart_version_match = re.search(r"version:\s*(\d+\.\d+\.\d+)", text)
    if not chart_version_match:
        print("Error: could not find chart version in Chart.yaml", file=sys.stderr)
        sys.exit(1)
    old_chart_version = chart_version_match.group(1)

    old_app_major, _, _ = parse_semver(old_app_version)
    new_app_major, _, _ = parse_semver(new_version)
    helm_major, helm_minor, helm_patch = parse_semver(old_chart_version)

    # Bump the helm chart major version when the Phoenix major version increases;
    # otherwise, bump the patch version.
    if new_app_major > old_app_major:
        new_chart_version = f"{helm_major + 1}.0.0"
    else:
        new_chart_version = f"{helm_major}.{helm_minor}.{helm_patch + 1}"

    updated = text.replace(
        f"version: {old_chart_version}",
        f"version: {new_chart_version}",
        1,
    )
    updated = re.sub(
        r'appVersion:\s*"[^"]*"',
        f'appVersion: "{new_version}"',
        updated,
    )
    HELM_CHART_PATH.write_text(updated)
    print(
        f"Updated {HELM_CHART_PATH} "
        f"(chart version {old_chart_version} -> {new_chart_version}, "
        f"appVersion {old_app_version} -> {new_version})"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Update the Helm chart for a new Phoenix version.",
    )
    parser.add_argument(
        "version",
        help="New Phoenix version (e.g. 13.0.0)",
    )
    args = parser.parse_args()

    try:
        parse_semver(args.version)
    except ValueError:
        parser.error(f"Invalid version format: {args.version!r} (expected MAJOR.MINOR.PATCH)")

    update_helm_values(args.version)
    update_helm_chart(args.version)


if __name__ == "__main__":
    main()
