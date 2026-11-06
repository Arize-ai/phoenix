"""The one `gh` wrapper for the preview scripts, which run where `gh` is authenticated."""

import functools
import json
import os
import subprocess
import sys
from typing import Any, Optional

PREVIEW_PACKAGE = "phoenix-preview"


def warn(message: str) -> None:
    """A workflow warning, on stderr: a script's stdout may be the step's outputs file."""
    print(f"::warning::{message}", file=sys.stderr, flush=True)


def error(message: str) -> None:
    print(f"::error::{message}", file=sys.stderr, flush=True)


def set_output(name: str, value: str) -> None:
    """A step output, when running under Actions."""
    if path := os.environ.get("GITHUB_OUTPUT"):
        with open(path, "a") as outputs:
            outputs.write(f"{name}={value}\n")


def run_gh(*args: str, input_text: Optional[str] = None) -> str:
    """Run a gh command and return its stdout, raising CalledProcessError on failure."""
    return subprocess.run(
        ["gh", *args], capture_output=True, text=True, check=True, input=input_text
    ).stdout


def gh_api(path: str, *args: str) -> Any:
    """GET an API path and return the parsed JSON."""
    return json.loads(run_gh("api", path, *args))


def preview_image() -> str:
    """The GHCR image previews are pushed to, from the GH_REPO the workflow sets."""
    owner = os.environ["GH_REPO"].partition("/")[0].lower()
    return f"ghcr.io/{owner}/{PREVIEW_PACKAGE}"


def ghcr_package(image: str) -> tuple[str, str]:
    """(owner, package name) of a ghcr.io image reference, with or without a tag."""
    owner, _, package = image.removeprefix("ghcr.io/").partition("/")
    return owner, package.partition(":")[0]


@functools.cache
def packages_api_root(owner: str) -> str:
    """The packages API lives under orgs/ or users/ depending on who owns the repo."""
    try:
        owner_type = run_gh("api", f"users/{owner}", "--jq", ".type").strip()
    except subprocess.CalledProcessError:
        owner_type = "Organization"
    return f"{'orgs' if owner_type == 'Organization' else 'users'}/{owner}/packages/container"


def image_tag_exists(image: str, tag: str) -> bool:
    """Whether the GHCR package behind `image` has a version carrying `tag`."""
    owner, package = ghcr_package(image)
    try:
        found = run_gh(
            "api",
            "--paginate",
            f"{packages_api_root(owner)}/{package}/versions?per_page=100",
            "--jq",
            f"[.[] | .metadata.container.tags[]? | select(. == {json.dumps(tag)})] | length",
        )
    except subprocess.CalledProcessError:
        return False  # no package yet, or GHCR unavailable: build to be safe
    return any(int(count or 0) > 0 for count in found.split())
