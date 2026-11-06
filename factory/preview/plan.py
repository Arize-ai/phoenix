# /// script
# requires-python = ">=3.12"
# ///
"""Decide how to build one PR's preview image, and pull the seed script out of its body.

Prints GitHub Actions outputs. The base image is the newest commit on the PR's base branch
that has a published `arizephoenix/phoenix:commit-<sha>` image and the same `pyproject.toml`,
`uv.lock` and `Dockerfile` as the PR, so the PR's source can be laid over an environment that
already has its dependencies. A PR whose dependencies match no published commit gets an empty
base-image output, and the workflow builds the Dockerfile in full instead.
"""

import argparse
import functools
import hashlib
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from gh import gh_api, preview_image, run_gh

PUBLISHED_IMAGE = "arizephoenix/phoenix"
DOCKER_HUB_TAGS_URL = f"https://hub.docker.com/v2/repositories/{PUBLISHED_IMAGE}/tags"
DEPENDENCY_FILES = ("pyproject.toml", "uv.lock", "Dockerfile")
# The Dockerfile's frontend stage copies exactly these two trees.
FRONTEND_TREES = ("js", "schemas")
# Up to three leading spaces, an optional colon and optional closing hashes, as CommonMark
# and habit allow.
SEED_HEADING_PATTERN = re.compile(r"^ {0,3}(#+)\s*Preview seed\s*:?\s*#*\s*$", re.IGNORECASE)
HEADING_PATTERN = re.compile(r"^ {0,3}(#+)(\s|$)")
# A fence may be indented, as inside a list item, use three or more backticks or tildes,
# and name the language as python, python3 or py in any case, with anything after it.
FENCE_PATTERN = re.compile(r"^\s*(`{3,}|~{3,})(.*)$")
PYTHON_INFO_PATTERN = re.compile(r"^\s*(python3?|py)\b", re.IGNORECASE)
MAX_TAG_PAGES = 5
MAX_BASE_CANDIDATES = 30


def warn(message: str) -> None:
    # stdout is the step's $GITHUB_OUTPUT, so everything but outputs goes to stderr.
    print(f"::warning::{message}", file=sys.stderr)


@functools.cache
def root_tree_shas(*, ref: str) -> dict[str, str]:
    """SHA of each root-level dependency file and frontend tree at a commit, in one request."""
    tree = gh_api(f"repos/{{owner}}/{{repo}}/git/trees/{ref}")
    assert isinstance(tree, dict)
    by_path = {entry["path"]: str(entry["sha"]) for entry in tree["tree"]}
    return {path: by_path.get(path, "") for path in DEPENDENCY_FILES + FRONTEND_TREES}


def dependency_shas(shas: dict[str, str]) -> tuple[str, ...]:
    return tuple(shas[path] for path in DEPENDENCY_FILES)


def frontend_shas(shas: dict[str, str]) -> tuple[str, ...]:
    return tuple(shas[path] for path in FRONTEND_TREES)


class PublishedCommits:
    """Which commits have a published image, read lazily from Docker Hub's newest tags.

    The nightly workflow tags commits on `version-*` branches too, so a release burst can
    push main's recent commits past the first page; pages are fetched only as a lookup
    needs them. The fallback for an unpublished image is a full build, so a rate limit or
    outage at Docker Hub costs build time rather than the preview.
    """

    def __init__(self) -> None:
        self._shas: set[str] = set()
        self._next_url: Optional[str] = f"{DOCKER_HUB_TAGS_URL}?page_size=100&name=commit-"
        self._pages_fetched = 0

    def __contains__(self, sha: str) -> bool:
        while sha[:7] not in self._shas and self._fetch_page():
            pass
        return sha[:7] in self._shas

    def _fetch_page(self) -> bool:
        if not self._next_url or self._pages_fetched >= MAX_TAG_PAGES:
            return False
        try:
            with urllib.request.urlopen(self._next_url, timeout=30) as response:
                page = json.load(response)
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            warn(f"Could not list Docker Hub tags past {len(self._shas)} commits: {error}")
            self._next_url = None
            return False
        self._pages_fetched += 1
        self._shas |= {str(tag["name"]).removeprefix("commit-") for tag in page.get("results", [])}
        self._next_url = page.get("next")
        return True


def find_base_commit(*, head_sha: str, base_ref: str) -> str:
    """The newest base-branch commit with a published image and the PR's dependency files.

    Empty when none of the last MAX_BASE_CANDIDATES commits qualifies.
    """
    compare = gh_api(f"repos/{{owner}}/{{repo}}/compare/{quote(base_ref, safe='')}...{head_sha}")
    assert isinstance(compare, dict)
    merge_base_sha = str(compare["merge_base_commit"]["sha"])
    wanted = dependency_shas(root_tree_shas(ref=head_sha))
    commits = gh_api(
        f"repos/{{owner}}/{{repo}}/commits?sha={merge_base_sha}&per_page={MAX_BASE_CANDIDATES}"
    )
    assert isinstance(commits, list)
    published = PublishedCommits()
    for commit in commits:
        sha = str(commit["sha"])
        # A reverted bump makes older commits match again, so a mismatch is not the end.
        if sha in published and dependency_shas(root_tree_shas(ref=sha)) == wanted:
            return sha
    return ""


def extract_seed(*, body: str) -> str:
    """The first python block of the body's Preview seed section, and only that section's.

    Scans lines and tracks every fence throughout, so neither the heading search nor the
    section's end is fooled by a `## ...` line inside a fenced block. The section ends at
    the next heading of the same or a higher level, as in a document outline. As in
    CommonMark, a block closes only on a fence of the same character at least as long as
    the one that opened it, a block still open at the end of the body runs to the end, and
    an indented fence strips that indent from its content lines.
    """

    def finish(block: list[str]) -> str:
        return "\n".join(block).strip() + "\n" if any(line.strip() for line in block) else ""

    in_section = False
    section_level = 0
    block: list[str] = []
    opening = ""  # the fence that opened the current block, empty outside one
    indent = 0
    in_python = False
    for line in body.splitlines():
        fence = FENCE_PATTERN.match(line)
        if fence is not None and fence.group(1)[0] == "`" and "`" in fence.group(2):
            fence = None  # a backtick fence's info string may not contain backticks
        leading = len(line) - len(line.lstrip(" \t"))
        if opening:
            # A closing fence may sit at most three spaces deeper than the opening one;
            # anything deeper is content, as in CommonMark.
            closes = (
                fence is not None
                and fence.group(1)[0] == opening[0]
                and len(fence.group(1)) >= len(opening)
                and not fence.group(2).strip()
                and leading <= indent + 3
            )
            if closes:
                if in_python and (seed := finish(block)):
                    return seed
                # A blank python block is not the seed; a later one may be.
                opening, in_python, block = "", False, []
            elif in_python:
                block.append(line[min(leading, indent) :])
        elif fence is not None:
            opening = fence.group(1)
            indent = leading
            in_python = in_section and PYTHON_INFO_PATTERN.match(fence.group(2)) is not None
        elif (seed_heading := SEED_HEADING_PATTERN.match(line)) is not None:
            in_section = True
            section_level = len(seed_heading.group(1))
        elif (heading := HEADING_PATTERN.match(line)) is not None and in_section:
            if len(heading.group(1)) <= section_level:
                return ""
    return finish(block) if opening and in_python else ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pr", type=int, required=True)
    parser.add_argument("--head-sha", required=True, help="the commit the workflow checked out")
    parser.add_argument("--seed-dir", type=Path, required=True)
    args = parser.parse_args()

    pr = json.loads(run_gh("pr", "view", str(args.pr), "--json", "baseRefName,body"))
    head_sha = str(args.head_sha)
    body = str(pr["body"] or "")
    seed = extract_seed(body=body)
    if not seed and "preview seed" in body.lower():
        warn("The PR body mentions a preview seed, but no `## Preview seed` python block parsed")
    args.seed_dir.mkdir(parents=True, exist_ok=True)
    (args.seed_dir / "seed.py").write_text(seed)
    seed_summary = (
        f"{seed.count(chr(10))} lines from the PR body" if seed else "none in the PR body"
    )

    try:
        base_sha = find_base_commit(head_sha=head_sha, base_ref=str(pr["baseRefName"]))
        # The base image's frontend is as old as its commit, so the comparison that matters
        # is with that commit, not the merge base. A full build makes the PR's own frontend.
        frontend = bool(base_sha) and frontend_shas(root_tree_shas(ref=base_sha)) != frontend_shas(
            root_tree_shas(ref=head_sha)
        )
    except (subprocess.CalledProcessError, ValueError, KeyError, TypeError, AssertionError) as e:
        # The same degradation as Docker Hub trouble: a full build, not a lost preview. An
        # unexpected shape from the API counts the same as a failed call.
        detail = e.stderr if isinstance(e, subprocess.CalledProcessError) else repr(e)
        warn(f"GitHub API trouble choosing a base, so the preview builds in full: {detail}")
        base_sha, frontend = "", False
    base_image = f"{PUBLISHED_IMAGE}:commit-{base_sha[:7]}" if base_sha else ""

    seed_hash = hashlib.sha256(seed.encode()).hexdigest()[:8]
    for name, value in {
        "image": preview_image(),
        "base-image": base_image,
        "frontend": str(frontend).lower(),
        "short-sha": head_sha[:7],
        # The seed is part of the image, so the tag names both the commit and the seed; a
        # body edit that leaves the seed alone then finds its image already built.
        "image-tag": f"pr-{args.pr}-{head_sha[:7]}-{seed_hash}",
        "seed-summary": seed_summary,
    }.items():
        print(f"{name}={value}")
    print(f"base-image={base_image or '(full build)'} frontend={frontend}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
