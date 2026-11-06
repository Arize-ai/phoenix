"""The one `gh` wrapper for the preview scripts, which run where `gh` is authenticated."""

import json
import os
import subprocess
from typing import Any, Optional

PREVIEW_PACKAGE = "phoenix-preview"


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
