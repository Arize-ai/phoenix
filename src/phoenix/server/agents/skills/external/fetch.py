"""Fetching remote skill sources into a local cache.

Fetching happens once at startup and never blocks it: on timeout or any network error
the previously cached copy is used, and if there is none the source is skipped with a
diagnostic. A Phoenix instance with no network reachable still starts.

Each fetch is pinned by resolved ref and content digest in a lockfile, so an operator can
see exactly what a running server loaded.
"""

from __future__ import annotations

import hashlib
import json
import logging
import shutil
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from phoenix.server.agents.skills.external.diagnostics import (
    SkillDiagnostic,
    SkillDiagnosticCode,
)
from phoenix.server.agents.skills.external.sources import RemoteSkillSource

logger = logging.getLogger(__name__)

LOCKFILE_NAME = "agent-skills-lock.json"
"""Records what was fetched. Unrelated to the repo-root ``skills-lock.json``, which is
build-time vendoring for this repo's own dev tooling."""

DEFAULT_FETCH_TIMEOUT_SECONDS = 30.0
MAX_ARCHIVE_BYTES = 32 * 1024 * 1024


@dataclass(frozen=True)
class FetchedSource:
    """A remote source materialized on disk.

    Attributes:
        source: The source that was fetched.
        path: Directory holding the extracted contents.
        digest: SHA-256 of the fetched archive, or of the cache that was reused.
        from_cache: Whether the network fetch was skipped or failed and the cache used.
    """

    source: RemoteSkillSource
    path: Path
    digest: str | None
    from_cache: bool


def fetch_remote_source(
    source: RemoteSkillSource,
    *,
    cache_dir: Path,
    timeout_seconds: float = DEFAULT_FETCH_TIMEOUT_SECONDS,
) -> tuple[FetchedSource | None, list[SkillDiagnostic]]:
    """Fetch ``source`` into ``cache_dir``, falling back to any cached copy.

    Args:
        source: Repository to fetch.
        cache_dir: Root of the skills cache.
        timeout_seconds: Per-request timeout.

    Returns:
        The materialized source (``None`` if neither the network nor a cache produced
        one) and any diagnostics.
    """
    diagnostics: list[SkillDiagnostic] = []
    target = cache_dir / source.cache_key

    try:
        archive, digest = _download(source, timeout_seconds=timeout_seconds)
    except Exception as error:  # noqa: BLE001 — startup must survive any client failure
        if target.is_dir():
            diagnostics.append(
                SkillDiagnostic(
                    code=SkillDiagnosticCode.FETCH_FAILED,
                    message=f"could not fetch {source.slug}: {error}; using cached copy",
                    source=source.raw,
                )
            )
            return FetchedSource(source, target, digest=None, from_cache=True), diagnostics
        diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.FETCH_FAILED,
                message=f"could not fetch {source.slug}: {error}; no cached copy, skipping",
                source=source.raw,
            )
        )
        return None, diagnostics

    try:
        _replace_with_archive(target, archive)
    except Exception as error:  # noqa: BLE001 — a bad archive must not stop startup
        diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.FETCH_FAILED,
                message=f"could not unpack {source.slug}: {error}",
                source=source.raw,
            )
        )
        return (
            (FetchedSource(source, target, digest=None, from_cache=True), diagnostics)
            if target.is_dir()
            else (None, diagnostics)
        )
    finally:
        archive.unlink(missing_ok=True)

    _record_in_lockfile(cache_dir, source=source, digest=digest)
    return FetchedSource(source, target, digest=digest, from_cache=False), diagnostics


def _download(source: RemoteSkillSource, *, timeout_seconds: float) -> tuple[Path, str]:
    """Download ``source`` as a tarball, returning the file and its SHA-256."""
    import httpx

    url = f"https://api.github.com/repos/{source.owner}/{source.repo}/tarball"
    if source.ref:
        url = f"{url}/{source.ref}"

    digest = hashlib.sha256()
    handle = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False)
    total = 0
    try:
        with handle:
            with httpx.stream(
                "GET",
                url,
                timeout=timeout_seconds,
                follow_redirects=True,
                headers={"Accept": "application/vnd.github+json"},
            ) as response:
                response.raise_for_status()
                for chunk in response.iter_bytes():
                    total += len(chunk)
                    if total > MAX_ARCHIVE_BYTES:
                        raise ValueError(
                            f"archive exceeds {MAX_ARCHIVE_BYTES} bytes; refusing to unpack"
                        )
                    digest.update(chunk)
                    handle.write(chunk)
    except BaseException:
        Path(handle.name).unlink(missing_ok=True)
        raise
    return Path(handle.name), digest.hexdigest()


def _replace_with_archive(target: Path, archive: Path) -> None:
    """Extract ``archive`` over ``target`` atomically enough to survive a crash.

    Extracts to a sibling directory first and swaps, so an interrupted unpack leaves the
    previous cache intact rather than a half-written tree.
    """
    staging = target.with_name(f"{target.name}.incoming")
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True, exist_ok=True)
    try:
        with tarfile.open(archive, mode="r:gz") as tar:
            _extract_stripped(tar, staging)
        previous = target.with_name(f"{target.name}.previous")
        shutil.rmtree(previous, ignore_errors=True)
        if target.exists():
            target.rename(previous)
        staging.rename(target)
        shutil.rmtree(previous, ignore_errors=True)
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def _extract_stripped(tar: tarfile.TarFile, destination: Path) -> None:
    """Extract ``tar`` into ``destination``, dropping GitHub's top-level directory.

    Members are validated individually rather than relying on ``TarFile.extractall``,
    which on this Python does not reject absolute paths, ``..`` traversal, or links
    pointing outside the destination.
    """
    resolved_destination = destination.resolve()
    for member in tar.getmembers():
        if member.islnk() or member.issym():
            # A link inside the archive could point anywhere on the host.
            continue
        if not (member.isfile() or member.isdir()):
            continue
        relative = _strip_leading_component(member.name)
        if relative is None:
            continue
        candidate = (resolved_destination / relative).resolve()
        if candidate != resolved_destination and resolved_destination not in candidate.parents:
            continue
        if member.isdir():
            candidate.mkdir(parents=True, exist_ok=True)
            continue
        extracted = tar.extractfile(member)
        if extracted is None:
            continue
        candidate.parent.mkdir(parents=True, exist_ok=True)
        with extracted, open(candidate, "wb") as out:
            shutil.copyfileobj(extracted, out)


def _strip_leading_component(name: str) -> str | None:
    """Drop the archive's top-level directory, rejecting unsafe names.

    >>> _strip_leading_component("owner-repo-abc123/skills/demo/SKILL.md")
    'skills/demo/SKILL.md'
    >>> _strip_leading_component("owner-repo-abc123")
    >>> _strip_leading_component("/etc/passwd")
    >>> _strip_leading_component("owner-repo/../../etc/passwd")
    """
    if name.startswith("/") or "\x00" in name:
        return None
    parts = [part for part in name.split("/") if part and part != "."]
    if any(part == ".." for part in parts):
        return None
    if len(parts) <= 1:
        return None
    return "/".join(parts[1:])


def _record_in_lockfile(cache_dir: Path, *, source: RemoteSkillSource, digest: str) -> None:
    """Record what was fetched for ``source``, leaving other entries untouched."""
    lockfile = cache_dir / LOCKFILE_NAME
    entries: dict[str, Any] = {}
    if lockfile.is_file():
        try:
            loaded = json.loads(lockfile.read_text(encoding="utf-8"))
            if isinstance(loaded, dict) and isinstance(loaded.get("sources"), dict):
                entries = loaded["sources"]
        except (OSError, ValueError):
            # A corrupt lockfile is informational only; rewrite it rather than fail.
            entries = {}
    entries[source.slug] = {
        "ref": source.ref,
        "digest": digest,
        "cache_key": source.cache_key,
    }
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        lockfile.write_text(
            json.dumps({"version": 1, "sources": entries}, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    except OSError as error:
        logger.warning("Could not write skills lockfile %s: %s", lockfile, error)
