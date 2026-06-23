"""Collect git provenance for the reserved ``metadata.repo_info`` experiment key.

The block is Braintrust-shaped and emitted by both ecosystem runners; the server reads only
``repo_info.commit`` for baseline resolution. Collection degrades gracefully: any git failure
yields a partial or empty block rather than raising.
"""

from __future__ import annotations

import subprocess
from typing import Any, Optional
from urllib.parse import urlsplit, urlunsplit

REPO_INFO_METADATA_KEY = "repo_info"


def _git(*args: str) -> Optional[str]:
    try:
        result = subprocess.run(
            ["git", *args],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    out = result.stdout.strip()
    return out or None


def _sanitize_remote_url(url: Optional[str]) -> Optional[str]:
    """Strip credentials from a remote URL. Returns None if it cannot be safely sanitized."""
    if not url:
        return None
    # scp-style git remotes (git@host:org/repo.git) carry no inline credentials.
    if "://" not in url:
        return url
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    if parts.username or parts.password:
        host = parts.hostname or ""
        if parts.port:
            host = f"{host}:{parts.port}"
        return urlunsplit((parts.scheme, host, parts.path, parts.query, parts.fragment))
    return url


def collect_repo_info() -> dict[str, Any]:
    """Collect git provenance. Returns ``{}`` when not in a git repo or git is unavailable."""
    commit = _git("rev-parse", "HEAD")
    if commit is None:
        return {}

    info: dict[str, Any] = {"commit": commit}

    branch = _git("rev-parse", "--abbrev-ref", "HEAD")
    if branch and branch != "HEAD":
        info["branch"] = branch

    status = _git("status", "--porcelain")
    info["dirty"] = bool(status)

    author_name = _git("log", "-1", "--pretty=%an")
    if author_name:
        info["author_name"] = author_name
    author_email = _git("log", "-1", "--pretty=%ae")
    if author_email:
        info["author_email"] = author_email
    commit_message = _git("log", "-1", "--pretty=%s")
    if commit_message:
        info["commit_message"] = commit_message
    commit_time = _git("log", "-1", "--pretty=%cI")
    if commit_time:
        info["commit_time"] = commit_time

    remote_url = _sanitize_remote_url(_git("config", "--get", "remote.origin.url"))
    if remote_url:
        info["remote_url"] = remote_url

    tag = _git("describe", "--tags", "--exact-match")
    if tag:
        info["tag"] = tag

    return info
