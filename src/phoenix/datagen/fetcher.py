from __future__ import annotations

import json
import os
import shutil
import tarfile
import tempfile
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path, PurePosixPath
from typing import Any, Callable
from urllib.parse import urlparse
from urllib.request import urlopen

_CORPUS_BASE_URL = "https://storage.googleapis.com/arize-phoenix-assets/datagen"
_CACHE_CHECKSUMS_FILENAME = ".checksums.json"


class CorpusFetchError(ValueError):
    """Raised when the datagen corpus cannot be resolved or safely cached."""


@dataclass(frozen=True)
class CorpusPointer:
    url: str
    sha256: str


Downloader = Callable[[str, Path], None]


def fetch_corpus(
    *,
    cache_dir: Path | None = None,
    pointer_path: Path | None = None,
    downloader: Downloader | None = None,
) -> Path:
    """Fetch the published corpus and return its content-addressed cache directory."""
    cache_root = cache_dir or default_cache_dir()
    pointer = load_corpus_pointer(pointer_path, cache_dir=cache_root)
    destination = cache_root / pointer.sha256
    if _is_cached_corpus(destination):
        return destination

    _ensure_cache_dir(cache_root)
    return _download_and_publish(
        pointer,
        cache_root,
        destination,
        downloader or _download_archive,
    )


def load_corpus_pointer(
    pointer_path: Path | None = None,
    *,
    cache_dir: Path | None = None,
    pointer_url: str | None = None,
    downloader: Downloader | None = None,
) -> CorpusPointer:
    """Load an explicit pointer or refresh the cached pointer from object storage."""
    path = pointer_path
    if path is None:
        cache_root = cache_dir or default_cache_dir()
        path = _acquire_pointer(
            cache_root,
            pointer_url or f"{_CORPUS_BASE_URL}/corpus.json",
            downloader or _download_file,
        )
    return _read_corpus_pointer(path)


def _read_corpus_pointer(path: Path) -> CorpusPointer:
    try:
        value = json.loads(path.read_bytes())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise CorpusFetchError(f"Unable to read datagen corpus pointer {path}: {error}") from error
    if not isinstance(value, dict) or value.get("schema_version") != 2:
        raise CorpusFetchError(f"Datagen corpus pointer {path} must have schema_version 2")
    return _parse_corpus_pointer(value, path)


def _acquire_pointer(cache_root: Path, url: str, downloader: Downloader) -> Path:
    _ensure_cache_dir(cache_root)
    destination = cache_root / "corpus.json"
    descriptor, temporary_name = tempfile.mkstemp(prefix=".corpus-", dir=cache_root)
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    try:
        try:
            downloader(url, temporary_path)
            _read_corpus_pointer(temporary_path)
        except (CorpusFetchError, OSError, ValueError) as error:
            if destination.is_file():
                try:
                    _read_corpus_pointer(destination)
                except CorpusFetchError:
                    pass
                else:
                    return destination
            raise CorpusFetchError(
                f"Unable to download the datagen corpus pointer from {url}: {error}. "
                "Run 'phoenix datagen pull' while online to prime the cache, "
                "or pass a local corpus directory."
            ) from error
        os.replace(temporary_path, destination)
        return destination
    finally:
        temporary_path.unlink(missing_ok=True)


def default_cache_dir() -> Path:
    root = os.environ.get("XDG_CACHE_HOME")
    return (
        (Path(root).expanduser() if root else Path.home() / ".cache")
        / "phoenix"
        / "datagen"
        / "corpus"
    )


def _ensure_cache_dir(path: Path) -> None:
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise CorpusFetchError(
            f"Unable to create the datagen corpus cache at {path}: {error}. "
            "Set XDG_CACHE_HOME to a writable directory."
        ) from error


def _parse_corpus_pointer(value: Any, pointer_path: Path) -> CorpusPointer:
    if not isinstance(value, dict):
        raise CorpusFetchError(f"Datagen corpus pointer {pointer_path} must be an object")
    url = value.get("url")
    digest = value.get("sha256")
    if not isinstance(url, str) or urlparse(url).scheme != "https":
        raise CorpusFetchError(f"Datagen corpus pointer {pointer_path} field 'url' must use HTTPS")
    if (
        not isinstance(digest, str)
        or len(digest) != 64
        or any(character not in "0123456789abcdef" for character in digest)
    ):
        raise CorpusFetchError(f"Datagen corpus pointer {pointer_path} field 'sha256' is invalid")
    return CorpusPointer(url=url, sha256=digest)


def _download_and_publish(
    pointer: CorpusPointer,
    cache_root: Path,
    destination: Path,
    downloader: Downloader,
) -> Path:
    archive_fd, archive_name = tempfile.mkstemp(prefix=".corpus-", suffix=".tar.gz", dir=cache_root)
    os.close(archive_fd)
    archive_path = Path(archive_name)
    staging_path = Path(tempfile.mkdtemp(prefix=".corpus-", dir=cache_root))
    stale_root: Path | None = None
    try:
        try:
            downloader(pointer.url, archive_path)
        except (OSError, ValueError) as error:
            raise CorpusFetchError(f"Unable to download the datagen corpus: {error}") from error
        actual_digest = _file_sha256(archive_path)
        if actual_digest != pointer.sha256:
            raise CorpusFetchError(
                f"Datagen corpus checksum mismatch: expected {pointer.sha256}, "
                f"downloaded {actual_digest}"
            )
        extracted = _extract_corpus_archive(archive_path, staging_path)
        _write_cache_sentinel(extracted)
        if _is_cached_corpus(destination):
            return destination
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            stale_root = Path(tempfile.mkdtemp(prefix=".corpus-stale-", dir=cache_root))
            os.replace(destination, stale_root / destination.name)
        try:
            os.replace(extracted, destination)
        except OSError:
            if _is_cached_corpus(destination):
                return destination
            raise
        return destination
    finally:
        archive_path.unlink(missing_ok=True)
        shutil.rmtree(staging_path, ignore_errors=True)
        if stale_root is not None:
            shutil.rmtree(stale_root, ignore_errors=True)


def _download_file(url: str, destination: Path) -> None:
    with urlopen(url, timeout=60) as response, destination.open("wb") as output:  # noqa: S310
        shutil.copyfileobj(response, output)


_download_archive = _download_file


def _file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _extract_corpus_archive(archive_path: Path, staging_path: Path) -> Path:
    roots: set[str] = set()
    try:
        with tarfile.open(archive_path, mode="r:gz") as archive:
            members = archive.getmembers()
            paths = [_safe_member_path(member) for member in members]
            roots.update(path.parts[0] for path in paths)
            if len(roots) != 1 or any(
                len(path.parts) == 1 and not member.isdir() for member, path in zip(members, paths)
            ):
                raise CorpusFetchError(
                    "Datagen corpus archive must contain one top-level directory"
                )
            for member, relative_path in zip(members, paths):
                output_path = staging_path.joinpath(*relative_path.parts)
                if member.isdir():
                    output_path.mkdir(parents=True, exist_ok=True)
                    continue
                output_path.parent.mkdir(parents=True, exist_ok=True)
                source = archive.extractfile(member)
                if source is None:
                    raise CorpusFetchError(
                        f"Datagen corpus archive member {member.name!r} could not be read"
                    )
                with source, output_path.open("wb") as output:
                    shutil.copyfileobj(source, output)
    except (OSError, tarfile.TarError) as error:
        raise CorpusFetchError(
            f"Datagen corpus is not a readable gzip tar archive: {error}"
        ) from error

    return staging_path / roots.pop()


def _write_cache_sentinel(path: Path) -> None:
    (path / _CACHE_CHECKSUMS_FILENAME).touch()


def _is_cached_corpus(path: Path) -> bool:
    return (path / _CACHE_CHECKSUMS_FILENAME).is_file()


def _safe_member_path(member: tarfile.TarInfo) -> PurePosixPath:
    path = PurePosixPath(member.name)
    if not member.name or "\\" in member.name or path.is_absolute() or ".." in path.parts:
        raise CorpusFetchError(f"Datagen corpus archive has unsafe member {member.name!r}")
    if not (member.isdir() or member.isfile()):
        raise CorpusFetchError(
            f"Datagen corpus archive member {member.name!r} must be a regular file or directory"
        )
    return path
