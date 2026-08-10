# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "packaging",
# ]
# ///
"""Check that every consumer's declared arize-phoenix-executors range admits the version we ship.

The declared range binds people who `pip install` the published wheels, and nothing inside this
repo notices when it goes wrong: uv resolves workspace siblings by path and drops the specifier
entirely, so `uv.lock` records no constraint to violate and every test keeps passing against a
range that excludes the version on PyPI. This is the job that notices.

Run with `uv run --no-project scripts/check_phoenix_executors_compat.py`.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterator

import tomllib
from packaging.requirements import Requirement

PACKAGE = "arize-phoenix-executors"
REPO_ROOT = Path(__file__).resolve().parent.parent
PROVIDER = REPO_ROOT / "packages" / "phoenix-executors" / "pyproject.toml"
CONSUMERS = (
    REPO_ROOT / "packages" / "phoenix-client" / "pyproject.toml",
    REPO_ROOT / "packages" / "phoenix-evals" / "pyproject.toml",
)


def declared_requirements(manifest: Path) -> Iterator[Requirement]:
    project = tomllib.loads(manifest.read_text())["project"]
    groups = [project.get("dependencies", [])]
    groups.extend(project.get("optional-dependencies", {}).values())
    for group in groups:
        for entry in group:
            requirement = Requirement(entry)
            if requirement.name == PACKAGE:
                yield requirement


def main() -> int:
    version = tomllib.loads(PROVIDER.read_text())["project"]["version"]
    failures = []
    checked = 0

    for manifest in CONSUMERS:
        relative = manifest.relative_to(REPO_ROOT)
        for requirement in declared_requirements(manifest):
            checked += 1
            if requirement.specifier.contains(version, prereleases=True):
                print(f"ok  {relative}: {requirement} admits {version}")
            else:
                failures.append(f"{relative} declares '{requirement}', which excludes {version}")

    if not checked:
        print(
            f"::error::No consumer declares {PACKAGE}. Either a declaration was dropped or this "
            f"check is looking at the wrong manifests: {[str(c) for c in CONSUMERS]}"
        )
        return 1

    for failure in failures:
        print(f"::error::{failure}")
    if failures:
        print(
            f"Raise the range in the pull request that needs the new {PACKAGE}, and say in the "
            f"comment beside it why the cap is where it is."
        )
        return 1

    print(f"\n{checked} declared range(s) checked against {PACKAGE} {version}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
