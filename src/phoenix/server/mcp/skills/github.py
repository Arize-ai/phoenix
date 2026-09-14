"""Skills hosted on GitHub, materialized to a local cache at startup.

A ``github:`` entry in :data:`~phoenix.config.ENV_PHOENIX_SKILLS_PATHS` names a
directory in a GitHub repository at a branch, tag, or commit. Phoenix resolves
the ref to a commit, downloads that commit's tarball once into a cache keyed by
the commit SHA, and from then on treats the directory like any local skills
root: the same ``SKILL.md`` parsing, ``references/`` scanning, visibility rules,
and tools apply. A commit's contents never change, so a cached commit is reused
without touching the network; a branch or tag is re-resolved on every start.
"""

from __future__ import annotations

import logging
import re
import shutil
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Optional
from urllib.parse import quote

import httpx

from phoenix.config import get_env_skills_github_token

logger = logging.getLogger(__name__)

GITHUB_SOURCE_PREFIX = "github:"
GITHUB_API_URL = "https://api.github.com"

_DEFAULT_REF = "HEAD"
_OWNER_PATTERN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$")
_REPO_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")
_FULL_SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")
_TIMEOUT_SECONDS = 30.0


@dataclass(frozen=True)
class GitHubSkillSource:
    """A directory of a GitHub repository at a ref, from a ``github:`` entry.

    ``path`` is relative to the repository root, ``""`` for the root itself.
    ``ref`` is a branch, tag, or commit SHA; ``HEAD`` means the default branch.
    """

    owner: str
    repo: str
    path: str = ""
    ref: str = _DEFAULT_REF

    @classmethod
    def parse(cls, entry: str) -> GitHubSkillSource:
        """Parse ``github:owner/repo[/path/in/repo][@ref]``.

        The ref follows the first ``@``, so a ref may itself contain ``@`` but
        a path may not.

        >>> GitHubSkillSource.parse("github:acme/skills")
        GitHubSkillSource(owner='acme', repo='skills', path='', ref='HEAD')
        >>> GitHubSkillSource.parse("github:acme/skills/skills/triage@v1.4.0")
        GitHubSkillSource(owner='acme', repo='skills', path='skills/triage', ref='v1.4.0')
        """
        if not entry.startswith(GITHUB_SOURCE_PREFIX):
            raise ValueError(f"{entry!r} is not a {GITHUB_SOURCE_PREFIX} skills source")
        locator, sep, ref = entry[len(GITHUB_SOURCE_PREFIX) :].partition("@")
        if sep and not ref.strip():
            raise ValueError(f"{entry!r}: the ref after '@' is empty")
        if ref.startswith("-"):
            raise ValueError(f"{entry!r}: ref {ref!r} may not start with '-'")
        segments = locator.strip("/").split("/")
        if len(segments) < 2 or not all(segments):
            raise ValueError(f"{entry!r}: expected {GITHUB_SOURCE_PREFIX}owner/repo[/path][@ref]")
        owner, repo, *path_segments = segments
        if not _OWNER_PATTERN.match(owner):
            raise ValueError(f"{entry!r}: {owner!r} is not a valid GitHub owner")
        if not _REPO_PATTERN.match(repo) or repo in (".", ".."):
            raise ValueError(f"{entry!r}: {repo!r} is not a valid GitHub repository name")
        if any(segment in (".", "..") for segment in path_segments):
            raise ValueError(f"{entry!r}: path may not contain '.' or '..' segments")
        return cls(
            owner=owner,
            repo=repo,
            path="/".join(path_segments),
            ref=ref.strip() if sep else _DEFAULT_REF,
        )

    def __str__(self) -> str:
        text = f"{GITHUB_SOURCE_PREFIX}{self.owner}/{self.repo}"
        if self.path:
            text += f"/{self.path}"
        if self.ref != _DEFAULT_REF:
            text += f"@{self.ref}"
        return text

    @property
    def pins_a_commit(self) -> bool:
        """Whether ``ref`` is a full commit SHA, which needs no resolution."""
        return bool(_FULL_SHA_PATTERN.match(self.ref))


def is_github_source(entry: str) -> bool:
    return entry.startswith(GITHUB_SOURCE_PREFIX)


def create_github_client(token: Optional[str] = None) -> httpx.Client:
    """An HTTP client for the GitHub REST API, authenticated when a token is set.

    The tarball endpoint redirects to ``codeload.github.com``; httpx drops the
    ``Authorization`` header on that cross-origin hop, as the redirect carries
    its own credentials.
    """
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "arize-phoenix",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return httpx.Client(
        base_url=GITHUB_API_URL,
        headers=headers,
        timeout=_TIMEOUT_SECONDS,
        follow_redirects=True,
    )


def materialize_github_source(
    source: GitHubSkillSource,
    *,
    cache_dir: Path,
    client: Optional[httpx.Client] = None,
) -> Path:
    """Return a local directory holding ``source``'s contents, fetching if needed.

    The commit is cached at ``<cache_dir>/github/<owner>/<repo>/<sha>/<repo>``,
    so the directory's own name is the repository's: a repository that *is* a
    single skill therefore passes the name-matches-directory check when it is
    named after the skill, and a ``path`` keeps its last segment as the name.

    When GitHub cannot be reached, a branch or tag that resolved on an earlier
    start resolves to that same commit again, with a warning; one that never
    resolved fails the start.
    """
    if client is not None:
        return _materialize(source, cache_dir=cache_dir, client=client)
    with create_github_client(get_env_skills_github_token()) as owned:
        return _materialize(source, cache_dir=cache_dir, client=owned)


def _materialize(source: GitHubSkillSource, *, cache_dir: Path, client: httpx.Client) -> Path:
    sha = _resolve_commit(source, cache_dir=cache_dir, client=client)
    checkout = cache_dir / "github" / source.owner / source.repo / sha
    if not checkout.is_dir():
        _download_commit(source, sha, checkout=checkout, client=client)
    root = checkout / source.repo
    if source.path:
        root = root / source.path
    if not root.is_dir():
        raise ValueError(
            f"{source}: {source.path or '/'!r} is not a directory in "
            f"{source.owner}/{source.repo} at {sha[:12]}"
        )
    return root


def _resolve_commit(source: GitHubSkillSource, *, cache_dir: Path, client: httpx.Client) -> str:
    if source.pins_a_commit:
        return source.ref
    memo = cache_dir / "github" / source.owner / source.repo / "refs" / quote(source.ref, safe="")
    try:
        response = client.get(
            f"/repos/{source.owner}/{source.repo}/commits/{quote(source.ref, safe='')}"
        )
        response.raise_for_status()
        sha = response.json().get("sha")
    except httpx.HTTPError as error:
        if memo.is_file():
            sha = memo.read_text(encoding="utf-8").strip()
            logger.warning(
                "Could not resolve %s on GitHub (%s); using the commit it last resolved to, %s",
                source,
                error,
                sha[:12],
            )
            return sha
        raise ValueError(
            f"{source}: could not resolve ref {source.ref!r} on GitHub: {error}"
        ) from error
    if not isinstance(sha, str) or not _FULL_SHA_PATTERN.match(sha):
        raise ValueError(f"{source}: GitHub returned no commit for ref {source.ref!r}")
    memo.parent.mkdir(parents=True, exist_ok=True)
    memo.write_text(sha, encoding="utf-8")
    logger.info("Resolved skills source %s to commit %s", source, sha[:12])
    return sha


def _download_commit(
    source: GitHubSkillSource, sha: str, *, checkout: Path, client: httpx.Client
) -> None:
    """Download the commit's tarball and extract its files under ``checkout/<repo>``.

    Extraction lands in a temporary sibling that is renamed into place at the
    end, so a crash mid-way never leaves a half-populated commit directory to
    be mistaken for a cache hit.
    """
    checkout.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{sha[:12]}-", dir=checkout.parent))
    try:
        with tempfile.TemporaryFile(dir=staging) as archive:
            try:
                with client.stream(
                    "GET", f"/repos/{source.owner}/{source.repo}/tarball/{sha}"
                ) as response:
                    response.raise_for_status()
                    for chunk in response.iter_bytes():
                        archive.write(chunk)
            except httpx.HTTPError as error:
                raise ValueError(
                    f"{source}: could not download commit {sha[:12]} from GitHub: {error}"
                ) from error
            archive.seek(0)
            with tarfile.open(fileobj=archive, mode="r:gz") as tar:
                _extract_files(tar, into=staging / source.repo)
        try:
            staging.rename(checkout)
        except OSError:
            if not checkout.is_dir():
                raise
    finally:
        if staging.is_dir():
            shutil.rmtree(staging, ignore_errors=True)


def _extract_files(tar: tarfile.TarFile, *, into: Path) -> None:
    """Write the archive's regular files under ``into``, minus the top-level directory.

    GitHub wraps a tarball in one ``<owner>-<repo>-<short sha>/`` directory.
    Only regular files with a plain relative path are written: symlinks,
    devices, absolute paths, and ``..`` segments are skipped, so an archive
    can never write outside ``into``.
    """
    into.mkdir(parents=True, exist_ok=True)
    root = into.resolve()
    for member in tar:
        if not member.isfile():
            continue
        if member.name.startswith("/"):
            continue
        parts = PurePosixPath(member.name).parts[1:]
        if not parts or any(part in ("", ".", "..") for part in parts):
            continue
        target = root.joinpath(*parts)
        if root not in target.parents:
            continue
        source = tar.extractfile(member)
        if source is None:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with source, target.open("wb") as destination:
            shutil.copyfileobj(source, destination)


__all__ = [
    "GITHUB_SOURCE_PREFIX",
    "GitHubSkillSource",
    "create_github_client",
    "is_github_source",
    "materialize_github_source",
]
