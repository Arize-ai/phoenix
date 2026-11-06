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
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

PUBLISHED_IMAGE = "arizephoenix/phoenix"
DOCKER_HUB_TAGS_URL = f"https://hub.docker.com/v2/repositories/{PUBLISHED_IMAGE}/tags"
DEPENDENCY_FILES = ("pyproject.toml", "uv.lock", "Dockerfile")
# The Dockerfile's frontend stage copies exactly these two trees.
FRONTEND_TREES = ("js", "schemas")
SEED_HEADING_PATTERN = re.compile(r"^#+\s*Preview seed\s*$", re.IGNORECASE)
HEADING_PATTERN = re.compile(r"^#+\s")
# A fence may be indented up to three spaces, use backticks or tildes, and name the
# language as python, python3 or py in any case.
FENCE_PATTERN = re.compile(r"^ {0,3}(```|~~~)")
PYTHON_FENCE_PATTERN = re.compile(r"^ {0,3}(```|~~~)\s*(python3?|py)\s*$", re.IGNORECASE)
MAX_BASE_CANDIDATES = 30


def warn(message: str) -> None:
    # stdout is the step's $GITHUB_OUTPUT, so everything but outputs goes to stderr.
    print(f"::warning::{message}", file=sys.stderr)


def gh_api(path: str) -> object:
    output = subprocess.run(["gh", "api", path], capture_output=True, text=True, check=True).stdout
    return json.loads(output)


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


def published_commit_shas() -> set[str]:
    """Short SHAs with a published commit image, from one listing of the newest tags.

    The fallback for an unpublished image is a full build, so a rate limit or outage at
    Docker Hub costs build time rather than the preview.
    """
    url = f"{DOCKER_HUB_TAGS_URL}?page_size=100&name=commit-"
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            tags = json.load(response)["results"]
    except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as error:
        warn(f"Could not list Docker Hub tags, so the preview builds in full: {error}")
        return set()
    return {str(tag["name"]).removeprefix("commit-") for tag in tags}


def find_base_commit(*, head_sha: str, base_ref: str) -> str:
    """The newest base-branch commit with a published image and the PR's dependency files.

    Empty when none of the last MAX_BASE_CANDIDATES commits qualifies.
    """
    compare = gh_api(f"repos/{{owner}}/{{repo}}/compare/{base_ref}...{head_sha}")
    assert isinstance(compare, dict)
    merge_base_sha = str(compare["merge_base_commit"]["sha"])
    wanted = dependency_shas(root_tree_shas(ref=head_sha))
    commits = gh_api(
        f"repos/{{owner}}/{{repo}}/commits?sha={merge_base_sha}&per_page={MAX_BASE_CANDIDATES}"
    )
    assert isinstance(commits, list)
    published = published_commit_shas()
    for commit in commits:
        sha = str(commit["sha"])
        # A reverted bump makes older commits match again, so a mismatch is not the end.
        if sha[:7] in published and dependency_shas(root_tree_shas(ref=sha)) == wanted:
            return sha
    return ""


def extract_seed(*, body: str) -> str:
    """The first python block of the body's Preview seed section, and only that section's.

    Scans lines and tracks every fence, so a `## ...` line inside any fenced block is not
    taken for the next heading.
    """
    lines = body.splitlines()
    try:
        start = next(i for i, line in enumerate(lines) if SEED_HEADING_PATTERN.match(line))
    except StopIteration:
        return ""
    block: list[str] = []
    in_fence = False
    in_python = False
    for line in lines[start + 1 :]:
        if in_fence:
            if FENCE_PATTERN.match(line):
                if in_python:
                    return "\n".join(block).strip() + "\n" if block else ""
                in_fence = False
            elif in_python:
                block.append(line)
        elif FENCE_PATTERN.match(line):
            in_fence = True
            in_python = bool(PYTHON_FENCE_PATTERN.match(line))
        elif HEADING_PATTERN.match(line):
            return ""
    return ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pr", type=int, required=True)
    parser.add_argument("--head-sha", required=True, help="the commit the workflow checked out")
    parser.add_argument("--seed-dir", type=Path, required=True)
    args = parser.parse_args()

    pr = json.loads(
        subprocess.run(
            ["gh", "pr", "view", str(args.pr), "--json", "baseRefName,body"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    )
    head_sha = str(args.head_sha)
    base_sha = find_base_commit(head_sha=head_sha, base_ref=str(pr["baseRefName"]))
    base_image = f"{PUBLISHED_IMAGE}:commit-{base_sha[:7]}" if base_sha else ""
    # The base image's frontend is as old as its commit, so the comparison that matters is
    # with that commit, not the merge base. A full build makes the PR's own frontend.
    frontend = bool(base_sha) and frontend_shas(root_tree_shas(ref=base_sha)) != frontend_shas(
        root_tree_shas(ref=head_sha)
    )

    seed = extract_seed(body=str(pr["body"] or ""))
    args.seed_dir.mkdir(parents=True, exist_ok=True)
    (args.seed_dir / "seed.py").write_text(seed)
    seed_summary = (
        f"{seed.count(chr(10))} lines from the PR body"
        if seed
        else "none in the PR body, so the instance is empty"
    )

    for name, value in {
        "base-image": base_image,
        "frontend": str(frontend).lower(),
        "short-sha": head_sha[:7],
        "seed-summary": seed_summary,
    }.items():
        print(f"{name}={value}")
    print(f"base-image={base_image or '(full build)'} frontend={frontend}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
