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
    """Whether the registry has a manifest for the tag, in one request to ghcr.io.

    Anonymous for a public package; a private one is reached with the workflow's token,
    which GHCR accepts as the password of a token exchange. Any trouble reads as absent,
    so the worst case is a build that was not needed.
    """
    import urllib.error
    import urllib.request

    owner, package = ghcr_package(image)
    repository = f"{owner}/{package}"
    try:
        token_request = urllib.request.Request(
            f"https://ghcr.io/token?scope=repository:{repository}:pull&service=ghcr.io"
        )
        if github_token := os.environ.get("GH_TOKEN"):
            import base64

            credentials = base64.b64encode(f"x:{github_token}".encode()).decode()
            token_request.add_header("Authorization", f"Basic {credentials}")
        with urllib.request.urlopen(token_request, timeout=30) as response:
            bearer = json.load(response)["token"]
        manifest_request = urllib.request.Request(
            f"https://ghcr.io/v2/{repository}/manifests/{tag}",
            method="HEAD",
            headers={
                "Authorization": f"Bearer {bearer}",
                "Accept": ", ".join(
                    (
                        "application/vnd.oci.image.manifest.v1+json",
                        "application/vnd.oci.image.index.v1+json",
                        "application/vnd.docker.distribution.manifest.v2+json",
                        "application/vnd.docker.distribution.manifest.list.v2+json",
                    )
                ),
            },
        )
        with urllib.request.urlopen(manifest_request, timeout=30) as response:
            return bool(200 <= response.status < 300)
    except urllib.error.HTTPError as failure:
        if failure.code not in (401, 403, 404):
            warn(f"GHCR returned {failure.code} checking {repository}:{tag}")
        return False
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as failure:
        warn(f"Could not check GHCR for {repository}:{tag}: {failure}")
        return False
