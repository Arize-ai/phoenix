"""Parsing of the ``PHOENIX_AGENTS_SKILLS_SOURCES`` setting.

A source is either a local directory or a remote GitHub repository. Remote sources are
fetched into a cache directory and from then on are treated exactly like a local one, so
everything downstream of here only ever sees a filesystem path.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Union
from urllib.parse import urlparse

_OWNER_REPO_PATTERN = re.compile(r"^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$")


@dataclass(frozen=True)
class LocalSkillSource:
    """A directory on the Phoenix host to load skills from.

    Attributes:
        raw: The value as configured, for diagnostics.
        path: The directory to scan.
    """

    raw: str
    path: Path


@dataclass(frozen=True)
class RemoteSkillSource:
    """A GitHub repository to fetch skills from.

    Attributes:
        raw: The value as configured, for diagnostics.
        owner: Repository owner.
        repo: Repository name.
        ref: Branch, tag, or commit to pin to, if given.
        subdirectory: Path within the repository to scan, if the skills do not sit at
            the repository root. Public skill repositories commonly collect them under
            a ``skills/`` directory.
    """

    raw: str
    owner: str
    repo: str
    ref: str | None = None
    subdirectory: str | None = None

    @property
    def slug(self) -> str:
        """Return ``owner/repo``."""
        return f"{self.owner}/{self.repo}"

    @property
    def cache_key(self) -> str:
        """Return a filesystem-safe directory name for this source's cache."""
        parts = [self.owner, self.repo] + ([self.ref] if self.ref else [])
        return "-".join(re.sub(r"[^A-Za-z0-9._-]", "_", part) for part in parts)


SkillSource = Union[LocalSkillSource, RemoteSkillSource]


class SkillSourceError(ValueError):
    """A configured source could not be understood."""


def parse_skill_sources(value: str | None) -> list[SkillSource]:
    """Parse a comma-separated ``PHOENIX_AGENTS_SKILLS_SOURCES`` value.

    Discriminates on the value itself: a leading ``/``, ``./``, ``../``, ``~`` or a
    ``file://`` URL is a local directory; ``https://github.com/...`` or bare
    ``owner/repo`` is a remote repository. A remote may be pinned with ``@ref``.

    Unset or empty yields no sources, which is exactly today's behavior.

    Args:
        value: Raw setting value.

    Returns:
        Parsed sources, in configured order.

    Raises:
        SkillSourceError: If an entry matches neither form.

    >>> parse_skill_sources(None)
    []
    >>> parse_skill_sources("  ")
    []
    >>> parse_skill_sources("/etc/phoenix/skills")[0].path
    PosixPath('/etc/phoenix/skills')
    >>> source = parse_skill_sources("https://github.com/owner/repo@v1.2.0")[0]
    >>> (source.owner, source.repo, source.ref)
    ('owner', 'repo', 'v1.2.0')
    >>> parse_skill_sources("owner/repo")[0].slug
    'owner/repo'
    """
    if not value or not value.strip():
        return []
    sources: list[SkillSource] = []
    for entry in (part.strip() for part in value.split(",")):
        if entry:
            sources.append(_parse_source(entry))
    return sources


def _parse_source(entry: str) -> SkillSource:
    if entry.startswith("file://"):
        parsed = urlparse(entry)
        return LocalSkillSource(raw=entry, path=Path(parsed.path))
    if entry.startswith(("/", "./", "../", "~")):
        return LocalSkillSource(raw=entry, path=Path(entry).expanduser())
    if entry.startswith(("http://", "https://")):
        return _parse_remote_url(entry)
    location, ref = _split_ref(entry)
    if _OWNER_REPO_PATTERN.match(location):
        owner, repo = location.split("/")
        return RemoteSkillSource(raw=entry, owner=owner, repo=_strip_git_suffix(repo), ref=ref)
    raise SkillSourceError(
        f"Cannot interpret skills source {entry!r}. Expected a directory path "
        "(/path, ./path, file:///path) or a GitHub repository "
        "(https://github.com/owner/repo[@ref] or owner/repo[@ref])."
    )


def _parse_remote_url(entry: str) -> RemoteSkillSource:
    location, ref = _split_ref(entry)
    parsed = urlparse(location)
    if parsed.netloc.lower() not in ("github.com", "www.github.com"):
        raise SkillSourceError(
            f"Cannot interpret skills source {entry!r}: only github.com repositories are "
            f"supported, got host {parsed.netloc!r}."
        )
    segments = [segment for segment in parsed.path.split("/") if segment]
    # A "tree" URL is what GitHub's UI gives you when browsing a folder, so accept it
    # as-is: it carries the ref and the subdirectory alongside the repository.
    subdirectory: str | None = None
    if len(segments) > 2:
        if len(segments) < 4 or segments[2] != "tree":
            raise SkillSourceError(
                f"Cannot interpret skills source {entry!r}: expected a repository URL of "
                "the form https://github.com/owner/repo, optionally with "
                "/tree/<ref>/<subdirectory>."
            )
        ref = ref or segments[3]
        subdirectory = "/".join(segments[4:]) or None
        segments = segments[:2]
    if len(segments) != 2:
        raise SkillSourceError(
            f"Cannot interpret skills source {entry!r}: expected a repository URL of the "
            "form https://github.com/owner/repo."
        )
    owner, repo = segments
    return RemoteSkillSource(
        raw=entry,
        owner=owner,
        repo=_strip_git_suffix(repo),
        ref=ref,
        subdirectory=subdirectory,
    )


def _split_ref(entry: str) -> tuple[str, str | None]:
    """Split a trailing ``@ref`` off ``entry``.

    Splits on the last ``@`` so a scheme or userinfo earlier in a URL is not mistaken
    for the pin.
    """
    scheme_end = entry.find("://")
    search_from = scheme_end + 3 if scheme_end != -1 else 0
    at_index = entry.rfind("@")
    if at_index > search_from:
        return entry[:at_index], entry[at_index + 1 :] or None
    return entry, None


def _strip_git_suffix(repo: str) -> str:
    return repo[: -len(".git")] if repo.endswith(".git") else repo
