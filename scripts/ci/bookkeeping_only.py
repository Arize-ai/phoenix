#!/usr/bin/env python3
"""Decide whether a pull request contains nothing but release bookkeeping.

Answered from the diff, never from a branch name or label: the CI Required
aggregators report success when their jobs skip, so an author-chosen signal
would let arbitrary code merge untested. Writes `only=true` to $GITHUB_OUTPUT
when the PR is bookkeeping-only; every other outcome, errors included, runs.

On a pull request the checked-out HEAD is the merge commit, so its first parent
is the base GitHub diffed against and `git diff HEAD^1 HEAD` is the pull
request. That needs `fetch-depth: 2`, which the calling workflows document.

The workflows run the base branch's copy of this file, not the pull request's, so
a PR that rewrites the detector is judged by the one it is trying to replace.

Two version-file shapes are matched below because the root keeps its literal in
version.py while the subpackages keep theirs in pyproject.toml. Do not try to
normalize that away: release-please rewrites every `version.py` it finds under a
package's configured path, and the root's path is the repo, so a subpackage
version.py would be overwritten with the root's version on each root release.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

BASE = "HEAD^1"
MANIFEST = ".release-please-manifest.json"

# A release PR is small. Past this, stop looking and run everything.
MAX_FILES = 60

VERSION_PY = re.compile(r'^__version__ = "([^"]+)"$')
VERSION_LINE = re.compile(r'^version = "([^"]+)"$')
LOCK_EDITABLE = re.compile(r'^source = \{ editable = "([^"]+)" \}$')
# \Z, not $, so a filename with a trailing newline cannot match.
PACKAGE_CHANGELOG = re.compile(r"^(packages/[^/]+)/CHANGELOG\.md\Z")
PACKAGE_PYPROJECT = re.compile(r"^(packages/[^/]+)/pyproject\.toml\Z")

# The root distribution is versioned out of this file, so its pyproject.toml and
# uv.lock entry hold no version; subpackages are the reverse and bump both.
ROOT_VERSION_FILE = "src/phoenix/version.py"

Bumps = dict[str, tuple[str, str]]
Hunk = tuple[list[str], list[str], list[str]]


class NotBookkeeping(Exception):
    """The PR changes something the release suites need to exercise."""


def git(*args: str) -> str:
    done = subprocess.run(["git", *args], capture_output=True, text=True)
    if done.returncode:
        raise NotBookkeeping(f"git {args[0]} failed: {done.stderr.strip()}")
    return done.stdout


STATUS = {"A": "added", "D": "removed", "M": "modified"}
# Without this a rename is one record of three fields instead of two; with it the
# rename arrives as the deletion that patch_of already rejects.
NO_RENAMES = "--no-renames"


def changed_files() -> list[dict[str, object]]:
    """Every file the merge commit adds to its base, with its status and patch."""
    if len(git("rev-list", "--parents", "-n", "1", "HEAD").split()) != 3:
        raise NotBookkeeping("HEAD is not a two-parent merge commit")
    fields = git("diff", NO_RENAMES, "--name-status", "-z", BASE, "HEAD").split("\0")
    files: list[dict[str, object]] = []
    for code, name in zip(fields[::2], fields[1::2]):
        files.append({"filename": name, "status": STATUS.get(code[0], code)})
        # Bounds the per-file diffs below; classify rejects on content anyway.
        if len(files) > MAX_FILES:
            raise NotBookkeeping(f"more than {MAX_FILES} files changed")
    for entry in files:
        if entry["status"] in {"modified", "added"}:
            entry["patch"] = git("diff", NO_RENAMES, BASE, "HEAD", "--", str(entry["filename"]))
    return files


def hunk_lines(patch: str) -> list[list[tuple[str, str]]]:
    """Each hunk as its (marker, text) lines in order; markers are ' ', '-', '+'."""
    out: list[list[tuple[str, str]]] = []
    for line in patch.splitlines():
        if line.startswith("@@"):
            out.append([])
        elif out:
            out[-1].append((line[:1] or " ", line[1:]))
    return out


def hunks(patch: str) -> list[Hunk]:
    """Split a unified diff into per-hunk (context, removed, added) lines."""
    return [
        (
            [text for marker, text in lines if marker == " "],
            [text for marker, text in lines if marker == "-"],
            [text for marker, text in lines if marker == "+"],
        )
        for lines in hunk_lines(patch)
    ]


def patch_of(entry: dict[str, object], *, allow_added: bool = False) -> str:
    """The file's diff, rejecting renames, deletions and unreadable patches."""
    name = entry.get("filename")
    status = entry.get("status")
    allowed = {"modified", "added"} if allow_added else {"modified"}
    if status not in allowed:
        raise NotBookkeeping(f"{name} has status {status!r}")
    patch = entry.get("patch")
    if not isinstance(patch, str):
        raise NotBookkeeping(f"{name} has no readable patch")
    # A binary or mode-only change carries no hunk, which would let the
    # reject-on-violation checks below pass by having nothing to inspect.
    if not any(line.startswith("@@") for line in patch.splitlines()):
        raise NotBookkeeping(f"{name} has no textual diff")
    return patch


def one_line_swap(patch: str, pattern: re.Pattern[str]) -> tuple[str, str]:
    """The (old, new) value of a diff that replaces exactly one matching line."""
    removed = [line for _, rm, _ in hunks(patch) for line in rm]
    added = [line for _, _, ad in hunks(patch) for line in ad]
    if len(removed) != 1 or len(added) != 1:
        raise NotBookkeeping("expected a single replaced line")
    before, after = pattern.match(removed[0]), pattern.match(added[0])
    if not before or not after:
        raise NotBookkeeping("replaced line is not a version assignment")
    return before.group(1), after.group(1)


def read_manifest(ref: str) -> dict[str, str]:
    parsed = json.loads(git("show", f"{ref}:{MANIFEST}"))
    if not isinstance(parsed, dict) or not all(
        isinstance(k, str) and isinstance(v, str) for k, v in parsed.items()
    ):
        raise NotBookkeeping("manifest is not a flat string map")
    return parsed


def released_versions(base: dict[str, str], head: dict[str, str]) -> Bumps:
    """Which packages the manifest moves, and between which versions."""
    if base.keys() != head.keys():
        raise NotBookkeeping("manifest gained or lost a package")
    bumps = {path: (base[path], head[path]) for path in base if base[path] != head[path]}
    if not bumps:
        raise NotBookkeeping("manifest changes no version")
    return bumps


def check_changelog(entry: dict[str, object], package: str, bumps: Bumps) -> None:
    if package not in bumps:
        raise NotBookkeeping(f"changelog for unreleased {package}")
    patch = patch_of(entry, allow_added=True)
    if any(removed for _, removed, _ in hunks(patch)):
        raise NotBookkeeping("changelog deletes lines")


def check_version_file(entry: dict[str, object], package: str, bumps: Bumps) -> None:
    if package not in bumps:
        raise NotBookkeeping(f"version bump for unreleased {package}")
    pattern = VERSION_PY if entry["filename"] == ROOT_VERSION_FILE else VERSION_LINE
    if one_line_swap(patch_of(entry), pattern) != bumps[package]:
        raise NotBookkeeping(f"{entry['filename']} disagrees with the manifest")


def check_lockfile(entry: dict[str, object], bumps: Bumps) -> None:
    """Every lockfile edit must be one released package's own version line.

    The `source = { editable = ... }` line directly below the bumped version is
    what pins the edit to that workspace member; a third-party block elsewhere
    in the same hunk must not be able to vouch for it.
    """
    for lines in hunk_lines(patch_of(entry)):
        changed = [i for i, (marker, _) in enumerate(lines) if marker != " "]
        if not changed:
            continue
        if len(changed) != 2 or changed[1] != changed[0] + 1:
            raise NotBookkeeping("lockfile hunk is not a single line replacement")
        (removed, added) = (lines[changed[0]], lines[changed[1]])
        if (removed[0], added[0]) != ("-", "+"):
            raise NotBookkeeping("lockfile hunk is not a single line replacement")
        before, after = VERSION_LINE.match(removed[1]), VERSION_LINE.match(added[1])
        if not before or not after:
            raise NotBookkeeping("lockfile edit is not a version line")
        below = lines[changed[1] + 1] if changed[1] + 1 < len(lines) else ("", "")
        editable = LOCK_EDITABLE.match(below[1]) if below[0] == " " else None
        if not editable:
            raise NotBookkeeping("bumped version is not followed by a workspace source")
        if bumps.get(editable.group(1)) != (before.group(1), after.group(1)):
            raise NotBookkeeping(
                f"lockfile edit to {editable.group(1)} disagrees with the manifest"
            )


def classify(files: list[dict[str, object]], bumps: Bumps) -> None:
    for entry in files:
        name = entry.get("filename")
        if not isinstance(name, str):
            raise NotBookkeeping("unnamed file in the diff")
        if name == MANIFEST:
            continue
        if name == "CHANGELOG.md":
            check_changelog(entry, ".", bumps)
        elif match := PACKAGE_CHANGELOG.match(name):
            check_changelog(entry, match.group(1), bumps)
        elif name == ROOT_VERSION_FILE:
            check_version_file(entry, ".", bumps)
        elif match := PACKAGE_PYPROJECT.match(name):
            check_version_file(entry, match.group(1), bumps)
        elif name == "uv.lock":
            check_lockfile(entry, bumps)
        else:
            raise NotBookkeeping(f"{name} is not release bookkeeping")


def decide() -> None:
    files = changed_files()
    if not any(entry.get("filename") == MANIFEST for entry in files):
        raise NotBookkeeping("no release manifest change")
    classify(files, released_versions(read_manifest(BASE), read_manifest("HEAD")))


def main() -> int:
    try:
        event = os.environ.get("GITHUB_EVENT_NAME", "")
        if event != "pull_request":
            raise NotBookkeeping(f"{event or 'this event'} is not a pull request")
        decide()
    except NotBookkeeping as reason:
        print(f"Running the suites: {reason}.")
        return 0
    except Exception as error:
        # Losing the optimization is fine; failing unrelated PRs is not.
        print(f"Running the suites: detector failed ({error!r}).")
        return 0
    print("Release bookkeeping only; the package suites will be skipped.")
    if output := os.environ.get("GITHUB_OUTPUT"):
        with open(output, "a") as file:
            file.write("only=true\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
