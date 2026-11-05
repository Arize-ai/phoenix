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
FRONTEND_PATTERN = re.compile(r"^(js|schemas)/")
SEED_PATTERN = re.compile(
    r"^##+\s*Preview seed\s*$.*?^```python\s*$(.*?)^```\s*$",
    re.MULTILINE | re.DOTALL | re.IGNORECASE,
)
MAX_BASE_CANDIDATES = 30


def gh_api(path: str) -> object:
    output = subprocess.run(["gh", "api", path], capture_output=True, text=True, check=True).stdout
    return json.loads(output)


def changed_paths(*, base_sha: str, head_sha: str) -> list[str]:
    """Every path that differs between two commits; the compare API pages its file list."""
    output = subprocess.run(
        [
            "gh",
            "api",
            "--paginate",
            f"repos/{{owner}}/{{repo}}/compare/{base_sha}...{head_sha}?per_page=100",
            "--jq",
            ".files[].filename",
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return output.split()


def blob_shas(*, ref: str) -> tuple[str, ...]:
    shas = []
    for path in DEPENDENCY_FILES:
        contents = gh_api(f"repos/{{owner}}/{{repo}}/contents/{path}?ref={ref}")
        assert isinstance(contents, dict)
        shas.append(str(contents["sha"]))
    return tuple(shas)


def image_is_published(*, sha: str) -> bool:
    try:
        with urllib.request.urlopen(f"{DOCKER_HUB_TAGS_URL}/commit-{sha[:7]}", timeout=30):
            return True
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return False
        raise


def find_base_commit(*, head_sha: str, base_ref: str) -> str:
    """The newest base-branch commit with a published image and the PR's dependency files.

    Empty when none of the last MAX_BASE_CANDIDATES commits qualifies.
    """
    compare = gh_api(f"repos/{{owner}}/{{repo}}/compare/{base_ref}...{head_sha}")
    assert isinstance(compare, dict)
    merge_base_sha = str(compare["merge_base_commit"]["sha"])
    wanted = blob_shas(ref=head_sha)
    commits = gh_api(
        f"repos/{{owner}}/{{repo}}/commits?sha={merge_base_sha}&per_page={MAX_BASE_CANDIDATES}"
    )
    assert isinstance(commits, list)
    for commit in commits:
        sha = str(commit["sha"])
        if blob_shas(ref=sha) != wanted:
            # Older commits can't match either: the PR's files came from this history.
            return ""
        if image_is_published(sha=sha):
            return sha
    return ""


def extract_seed(*, body: str) -> str:
    match = SEED_PATTERN.search(body)
    return match.group(1).strip() + "\n" if match else ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pr", type=int, required=True)
    parser.add_argument("--seed-dir", type=Path, required=True)
    args = parser.parse_args()

    pr = json.loads(
        subprocess.run(
            ["gh", "pr", "view", str(args.pr), "--json", "headRefOid,baseRefName,body"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    )
    head_sha = str(pr["headRefOid"])
    base_sha = find_base_commit(head_sha=head_sha, base_ref=str(pr["baseRefName"]))
    base_image = f"{PUBLISHED_IMAGE}:commit-{base_sha[:7]}" if base_sha else ""
    # The base image's frontend is as old as its commit, so the diff that matters runs from
    # that commit, not from the merge base. A full build makes the PR's own frontend.
    frontend = bool(base_sha) and any(
        FRONTEND_PATTERN.match(path) for path in changed_paths(base_sha=base_sha, head_sha=head_sha)
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
