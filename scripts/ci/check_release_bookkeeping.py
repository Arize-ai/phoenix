"""Recognize release metadata changes without skipping dependency or code changes."""

import os
import re
import subprocess
import tomllib
from pathlib import Path

STABLE_VERSION = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+")
CHANGELOG = re.compile(
    r"(?:\.release-please-manifest\.json|CHANGELOG\.md|packages/[^/]+/CHANGELOG\.md)"
)
PACKAGE_PROJECT = re.compile(r"packages/[^/]+/pyproject\.toml")


def is_bookkeeping(changes: dict[str, tuple[str, str]]) -> bool:
    """Accept only release versions, matching workspace lock versions, and changelogs."""
    if not changes:
        return False
    # Editable source path -> (distribution name, old version, new version).
    releases: dict[str, tuple[str, str, str]] = {}
    root_bump = False
    try:
        for path, (before, after) in changes.items():
            # Check the lockfile after collecting all permitted version bumps.
            if CHANGELOG.fullmatch(path) or path == "uv.lock":
                continue
            if path == "src/phoenix/version.py":
                # Match the whole file so added or removed Python code runs CI.
                pattern = r'__version__ = "([0-9]+\.[0-9]+\.[0-9]+)"\n?'
                old_match = re.fullmatch(pattern, before)
                new_match = re.fullmatch(pattern, after)
                if not old_match or not new_match or old_match[1] == new_match[1]:
                    return False
                # The root has a dynamic version: its lock entry has no version field.
                root_bump = True
            elif PACKAGE_PROJECT.fullmatch(path):
                old, new = tomllib.loads(before), tomllib.loads(after)
                # Remove only the version; every other project setting must match.
                old_version = old["project"].pop("version")
                new_version = new["project"].pop("version")
                if (
                    not isinstance(old_version, str)
                    or not isinstance(new_version, str)
                    or not STABLE_VERSION.fullmatch(old_version)
                    or not STABLE_VERSION.fullmatch(new_version)
                    or old_version == new_version
                    or old != new
                ):
                    return False
                releases[str(Path(path).parent)] = (
                    old["project"]["name"],
                    old_version,
                    new_version,
                )
            else:
                return False
        if "uv.lock" in changes:
            # A lockfile-only formatting change is not a release version bump.
            if not root_bump and not releases:
                return False
            locks = [tomllib.loads(text) for text in changes["uv.lock"]]
            for index, lock in enumerate(locks):
                for package in lock.get("package", []):
                    source = package.get("source", {})
                    # Registry dependencies never qualify for the version exemption.
                    release = releases.get(source.get("editable"))
                    if release is None:
                        continue
                    name, old_version, new_version = release
                    if (
                        source != {"editable": source["editable"]}
                        or package["name"] != name
                        or package["version"] != (old_version, new_version)[index]
                    ):
                        return False
                    # All other fields, including dependencies and hashes, must match.
                    del package["version"]
            if locks[0] != locks[1]:
                return False
        return True
    except (KeyError, TypeError, ValueError, AttributeError):
        # Malformed metadata must run the normal suites.
        return False


def read_changes() -> dict[str, tuple[str, str]]:
    # PR checkouts use a merge commit; its first parent is the base branch.
    # Disabling rename detection treats moves as deletions plus additions.
    fields = (
        subprocess.check_output(
            ["git", "diff", "--no-renames", "--name-status", "-z", "HEAD^1", "HEAD"],
            stderr=subprocess.DEVNULL,
        )
        .decode()
        .split("\0")[:-1]
    )
    entries = list(zip(fields[::2], fields[1::2]))
    # Reject unrelated paths and unsupported file statuses before reading any blobs.
    if len(entries) > 60 or any(
        not (
            (CHANGELOG.fullmatch(path) and status in {"A", "M"})
            or (
                status == "M"
                and (
                    path in {"src/phoenix/version.py", "uv.lock"} or PACKAGE_PROJECT.fullmatch(path)
                )
            )
        )
        for status, path in entries
    ):
        return {}
    changes: dict[str, tuple[str, str]] = {}
    for _, path in entries:
        if CHANGELOG.fullmatch(path):
            # These paths need no content comparison, including newly added changelogs.
            changes[path] = ("", "")
            continue
        before = subprocess.check_output(
            ["git", "show", f"HEAD^1:{path}"], stderr=subprocess.DEVNULL
        ).decode()
        after = subprocess.check_output(
            ["git", "show", f"HEAD:{path}"], stderr=subprocess.DEVNULL
        ).decode()
        changes[path] = (before, after)
    return changes


def main() -> None:
    try:
        only = is_bookkeeping(read_changes())
    except (subprocess.CalledProcessError, UnicodeDecodeError, OSError):
        # Unreadable diffs lose the optimization rather than skipping tests.
        only = False
    print(f"Release bookkeeping only: {only}")
    if only:
        with open(os.environ["GITHUB_OUTPUT"], "a") as output:
            output.write("only=true\n")


if __name__ == "__main__":
    main()
