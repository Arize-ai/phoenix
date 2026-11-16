# /// script
# requires-python = ">=3.12"
# ///
"""Print GitHub Actions build outputs and extract the PR's preview seed."""

import argparse
import functools
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

from gh import gh_api, run_gh

PUBLISHED_IMAGE = "arizephoenix/phoenix"
DOCKER_HUB_TAGS_URL = f"https://hub.docker.com/v2/repositories/{PUBLISHED_IMAGE}/tags"
DEPENDENCY_FILES = ("pyproject.toml", "uv.lock", "Dockerfile")
FRONTEND_TREES = ("js", "schemas")
SEED_HEADING_PATTERN = re.compile(r"^(#+)\s*Preview seed\s*$", re.IGNORECASE)
HEADING_PATTERN = re.compile(r"^(#+)\s")
FENCE_PATTERN = re.compile(r"^\s*(`{3,}|~{3,})(.*)$")
PYTHON_INFO_PATTERN = re.compile(r"^\s*(python3?|py)\b", re.IGNORECASE)
CLOSING_FENCE_MAX_EXTRA_INDENT = 3  # CommonMark
MAX_TAG_PAGES = 5
MAX_BASE_CANDIDATES = 30


def warn(message: str) -> None:
    """Keep stdout reserved for GitHub Actions outputs."""
    print(f"::warning::{message}", file=sys.stderr)


@functools.cache
def root_tree_shas(*, ref: str) -> dict[str, str]:
    tree = gh_api(f"repos/{{owner}}/{{repo}}/git/trees/{ref}")
    assert isinstance(tree, dict)
    by_path = {entry["path"]: str(entry["sha"]) for entry in tree["tree"]}
    return {path: by_path.get(path, "") for path in DEPENDENCY_FILES + FRONTEND_TREES}


def dependency_shas(shas: dict[str, str]) -> tuple[str, ...]:
    return tuple(shas[path] for path in DEPENDENCY_FILES)


def frontend_shas(shas: dict[str, str]) -> tuple[str, ...]:
    return tuple(shas[path] for path in FRONTEND_TREES)


class PublishedCommits:
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
    """Find a published base-branch image matching the PR's dependency files."""
    compare = gh_api(f"repos/{{owner}}/{{repo}}/compare/{base_ref}...{head_sha}")
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
        if sha in published and dependency_shas(root_tree_shas(ref=sha)) == wanted:
            return sha
    return ""


def extract_seed(*, body: str) -> str:
    """Extract the first nonempty Python block in the Preview seed section."""

    def finish(block: list[str]) -> str:
        return "\n".join(block).strip() + "\n" if any(line.strip() for line in block) else ""

    in_section = False
    section_level = 0
    block: list[str] = []
    opening_fence = ""
    indent = 0
    in_python = False
    for line in body.splitlines():
        fence = FENCE_PATTERN.match(line)
        leading = len(line) - len(line.lstrip(" "))
        if opening_fence:
            closes = (
                fence is not None
                and fence.group(1)[0] == opening_fence[0]
                and len(fence.group(1)) >= len(opening_fence)
                and not fence.group(2).strip()
                and leading <= indent + CLOSING_FENCE_MAX_EXTRA_INDENT
            )
            if closes:
                if in_python and (seed := finish(block)):
                    return seed
                opening_fence, in_python, block = "", False, []
            elif in_python:
                block.append(line[min(leading, indent) :])
        elif fence is not None:
            opening_fence = fence.group(1)
            indent = leading
            in_python = in_section and PYTHON_INFO_PATTERN.match(fence.group(2)) is not None
        elif (seed_heading := SEED_HEADING_PATTERN.match(line)) is not None:
            in_section = True
            section_level = len(seed_heading.group(1))
        elif (heading := HEADING_PATTERN.match(line)) is not None and in_section:
            if len(heading.group(1)) <= section_level:
                return ""
    return finish(block) if opening_fence and in_python else ""


def frontend_changed(*, base_sha: str, head_sha: str) -> bool:
    return frontend_shas(root_tree_shas(ref=base_sha)) != frontend_shas(
        root_tree_shas(ref=head_sha)
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pr", type=int, required=True)
    parser.add_argument("--head-sha", required=True, help="the commit the workflow checked out")
    parser.add_argument("--seed-dir", type=Path, required=True)
    args = parser.parse_args()

    pr = json.loads(run_gh("pr", "view", str(args.pr), "--json", "baseRefName,body"))
    head_sha = str(args.head_sha)
    try:
        base_sha = find_base_commit(head_sha=head_sha, base_ref=str(pr["baseRefName"]))
        frontend = bool(base_sha) and frontend_changed(base_sha=base_sha, head_sha=head_sha)
    except subprocess.CalledProcessError as error:
        warn(f"GitHub API trouble choosing a base, so the preview builds in full: {error.stderr}")
        base_sha, frontend = "", False
    base_image = f"{PUBLISHED_IMAGE}:commit-{base_sha[:7]}" if base_sha else ""

    seed = extract_seed(body=str(pr["body"] or ""))
    args.seed_dir.mkdir(parents=True, exist_ok=True)
    (args.seed_dir / "seed.py").write_text(seed)
    seed_summary = (
        f"{seed.count(chr(10))} lines from the PR body" if seed else "none in the PR body"
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
