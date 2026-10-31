from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse
from urllib.request import urlopen

_CORPUS_BASE_URL = "https://storage.googleapis.com/arize-phoenix-assets/datagen"


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
    """Fetch the published corpus and return its content-addressed archive path."""
    cache_root = cache_dir or default_cache_dir()
    pointer = load_corpus_pointer(pointer_path, cache_dir=cache_root)
    return fetch_file(
        pointer.url,
        pointer.sha256,
        cache_dir=cache_root,
        downloader=downloader,
    )


def _validate_https_and_sha256(
    url: Any,
    checksum: Any,
    *,
    url_error: str,
    checksum_error: str,
) -> CorpusPointer:
    if not isinstance(url, str) or urlparse(url).scheme != "https":
        raise CorpusFetchError(url_error)
    if not isinstance(checksum, str) or re.fullmatch(r"[0-9a-f]{64}", checksum) is None:
        raise CorpusFetchError(checksum_error)
    return CorpusPointer(url=url, sha256=checksum)


def fetch_file(
    url: str,
    checksum: str,
    *,
    cache_dir: Path,
    downloader: Downloader | None = None,
) -> Path:
    """Cache a pinned HTTPS file, verifying its SHA-256 even on cache hits."""
    pointer = _validate_https_and_sha256(
        url,
        checksum,
        url_error="Dataset source URL must use HTTPS",
        checksum_error="Dataset checksum must be a lowercase SHA-256 digest",
    )
    destination = cache_dir / checksum
    if destination.is_file() and _file_sha256(destination) == checksum:
        return destination
    _ensure_cache_dir(cache_dir)
    return _download_and_publish(
        pointer,
        cache_dir,
        destination,
        downloader or _download_file,
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
                "or pass a local corpus archive."
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
    return _validate_https_and_sha256(
        value.get("url"),
        value.get("sha256"),
        url_error=f"Datagen corpus pointer {pointer_path} field 'url' must use HTTPS",
        checksum_error=f"Datagen corpus pointer {pointer_path} field 'sha256' is invalid",
    )


def _download_and_publish(
    pointer: CorpusPointer,
    cache_root: Path,
    destination: Path,
    downloader: Downloader,
) -> Path:
    archive_fd, archive_name = tempfile.mkstemp(prefix=".corpus-", suffix=".tar.gz", dir=cache_root)
    os.close(archive_fd)
    archive_path = Path(archive_name)
    try:
        try:
            downloader(pointer.url, archive_path)
        except (OSError, ValueError) as error:
            raise CorpusFetchError(f"Unable to download {pointer.url}: {error}") from error
        actual_digest = _file_sha256(archive_path)
        if actual_digest != pointer.sha256:
            raise CorpusFetchError(
                f"Downloaded file checksum mismatch: expected {pointer.sha256}, "
                f"downloaded {actual_digest}"
            )
        os.replace(archive_path, destination)
        return destination
    finally:
        archive_path.unlink(missing_ok=True)


def _download_file(url: str, destination: Path) -> None:
    with urlopen(url, timeout=60) as response, destination.open("wb") as output:  # noqa: S310
        shutil.copyfileobj(response, output)


def _file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
