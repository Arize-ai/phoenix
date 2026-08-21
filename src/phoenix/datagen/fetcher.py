from __future__ import annotations

import json
import os
import shutil
import tarfile
import tempfile
import time
from contextlib import contextmanager
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Iterator, Mapping
from urllib.parse import urlparse
from urllib.request import urlopen


class AssetFetchError(ValueError):
    """Raised when a datagen asset cannot be resolved or safely cached."""


@dataclass(frozen=True)
class AssetEntry:
    url: str
    sha256: str
    size_bytes: int
    asset_schema_version: int
    fragment_count: int
    archetypes: tuple[str, ...]


Downloader = Callable[[str, Path], None]


def fetch_scenario(
    scenario: str,
    *,
    cache_dir: Path | None = None,
    index_path: Path | None = None,
    downloader: Downloader | None = None,
) -> Path:
    """Fetch a scenario from the release index and return its cached directory."""
    entry = load_asset_index(index_path).get(scenario)
    if entry is None:
        raise AssetFetchError(f"Scenario {scenario!r} is not present in the datagen asset index")

    cache_root = cache_dir or default_cache_dir()
    destination = cache_root / scenario / entry.sha256
    if _is_scenario_directory(destination):
        return destination

    cache_root.mkdir(parents=True, exist_ok=True)
    with _scenario_lock(cache_root, scenario):
        if _is_scenario_directory(destination):
            return destination
        return _download_and_publish(
            scenario,
            entry,
            cache_root,
            destination,
            downloader or _download_archive,
        )


def load_asset_index(index_path: Path | None = None) -> Mapping[str, AssetEntry]:
    path = index_path or Path(__file__).with_name("assets") / "index.json"
    try:
        value = json.loads(path.read_bytes())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AssetFetchError(f"Unable to read datagen asset index {path}: {error}") from error
    if not isinstance(value, dict) or value.get("schema_version") != 2:
        raise AssetFetchError(f"Datagen asset index {path} must have schema_version 2")
    scenarios = value.get("scenarios")
    if not isinstance(scenarios, dict):
        raise AssetFetchError(f"Datagen asset index {path} field 'scenarios' must be an object")
    return {
        scenario: _parse_asset_entry(scenario, raw_entry, path)
        for scenario, raw_entry in scenarios.items()
    }


def default_cache_dir() -> Path:
    root = os.environ.get("XDG_CACHE_HOME")
    return (Path(root).expanduser() if root else Path.home() / ".cache") / "phoenix" / "datagen"


def _parse_asset_entry(scenario: Any, value: Any, index_path: Path) -> AssetEntry:
    if (
        not isinstance(scenario, str)
        or not scenario
        or scenario in {".", ".."}
        or "/" in scenario
        or "\\" in scenario
    ):
        raise AssetFetchError(f"Datagen asset index {index_path} has an invalid scenario name")
    if not isinstance(value, dict):
        raise AssetFetchError(
            f"Datagen asset index {index_path} scenario {scenario!r} must be an object"
        )

    url = value.get("url")
    digest = value.get("sha256")
    size_bytes = value.get("size_bytes")
    asset_schema_version = value.get("asset_schema_version")
    fragment_count = value.get("fragment_count")
    archetypes = value.get("archetypes")
    if not isinstance(url, str) or urlparse(url).scheme != "https":
        raise AssetFetchError(
            f"Datagen asset index {index_path} scenario {scenario!r} field 'url' must use HTTPS"
        )
    if (
        not isinstance(digest, str)
        or len(digest) != 64
        or any(character not in "0123456789abcdef" for character in digest)
    ):
        raise AssetFetchError(
            f"Datagen asset index {index_path} scenario {scenario!r} field 'sha256' is invalid"
        )
    if type(size_bytes) is not int or size_bytes < 0:
        raise AssetFetchError(
            f"Datagen asset index {index_path} scenario {scenario!r} field 'size_bytes' is invalid"
        )
    if asset_schema_version != 2:
        raise AssetFetchError(
            f"Datagen asset index {index_path} scenario {scenario!r} field "
            "'asset_schema_version' must be 2"
        )
    if type(fragment_count) is not int or fragment_count < 0:
        raise AssetFetchError(
            f"Datagen asset index {index_path} scenario {scenario!r} field 'fragment_count' "
            "is invalid"
        )
    if not isinstance(archetypes, list) or not all(
        isinstance(archetype, str) and archetype for archetype in archetypes
    ):
        raise AssetFetchError(
            f"Datagen asset index {index_path} scenario {scenario!r} field 'archetypes' is invalid"
        )
    return AssetEntry(
        url=url,
        sha256=digest,
        size_bytes=size_bytes,
        asset_schema_version=asset_schema_version,
        fragment_count=fragment_count,
        archetypes=tuple(archetypes),
    )


def _download_and_publish(
    scenario: str,
    entry: AssetEntry,
    cache_root: Path,
    destination: Path,
    downloader: Downloader,
) -> Path:
    archive_fd, archive_name = tempfile.mkstemp(
        prefix=f".{scenario}-", suffix=".tar.gz", dir=cache_root
    )
    os.close(archive_fd)
    archive_path = Path(archive_name)
    staging_path = Path(tempfile.mkdtemp(prefix=f".{scenario}-", dir=cache_root))
    try:
        try:
            downloader(entry.url, archive_path)
        except (OSError, ValueError) as error:
            raise AssetFetchError(
                f"Unable to download datagen scenario {scenario!r}: {error}"
            ) from error
        actual_size = archive_path.stat().st_size
        if actual_size != entry.size_bytes:
            raise AssetFetchError(
                f"Datagen scenario {scenario!r} expected {entry.size_bytes} archive bytes, "
                f"downloaded {actual_size}"
            )
        actual_digest = _file_sha256(archive_path)
        if actual_digest != entry.sha256:
            raise AssetFetchError(
                f"Datagen scenario {scenario!r} checksum mismatch: expected {entry.sha256}, "
                f"downloaded {actual_digest}"
            )
        extracted = _extract_scenario_archive(archive_path, staging_path, scenario)
        destination.parent.mkdir(parents=True, exist_ok=True)
        os.replace(extracted, destination)
        return destination
    finally:
        archive_path.unlink(missing_ok=True)
        shutil.rmtree(staging_path, ignore_errors=True)


def _download_archive(url: str, destination: Path) -> None:
    with urlopen(url, timeout=60) as response, destination.open("wb") as output:  # noqa: S310
        shutil.copyfileobj(response, output)


def _file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _extract_scenario_archive(archive_path: Path, staging_path: Path, scenario: str) -> Path:
    seen: set[PurePosixPath] = set()
    required = {"manifest.json", "fragments.jsonl", "traces.jsonl"}
    extracted_files: set[str] = set()
    try:
        with tarfile.open(archive_path, mode="r:gz") as archive:
            for member in archive.getmembers():
                relative_path = _safe_member_path(member, scenario)
                if relative_path in seen:
                    raise AssetFetchError(
                        f"Datagen scenario {scenario!r} archive contains duplicate member "
                        f"{member.name!r}"
                    )
                seen.add(relative_path)
                output_path = staging_path.joinpath(*relative_path.parts)
                if member.isdir():
                    output_path.mkdir(parents=True, exist_ok=True)
                    continue
                output_path.parent.mkdir(parents=True, exist_ok=True)
                source = archive.extractfile(member)
                if source is None:
                    raise AssetFetchError(
                        f"Datagen scenario {scenario!r} archive member {member.name!r} "
                        "could not be read"
                    )
                with source, output_path.open("xb") as output:
                    shutil.copyfileobj(source, output)
                if len(relative_path.parts) == 2:
                    extracted_files.add(relative_path.name)
    except (OSError, tarfile.TarError) as error:
        raise AssetFetchError(
            f"Datagen scenario {scenario!r} is not a readable gzip tar archive: {error}"
        ) from error

    missing = sorted(required - extracted_files)
    if missing:
        raise AssetFetchError(
            f"Datagen scenario {scenario!r} archive is missing required files {missing!r}"
        )
    return staging_path / scenario


def _safe_member_path(member: tarfile.TarInfo, scenario: str) -> PurePosixPath:
    path = PurePosixPath(member.name)
    if (
        not member.name
        or "\\" in member.name
        or path.is_absolute()
        or ".." in path.parts
        or path.parts[0] != scenario
    ):
        raise AssetFetchError(
            f"Datagen scenario {scenario!r} archive has unsafe member {member.name!r}"
        )
    if not (member.isdir() or member.isfile()):
        raise AssetFetchError(
            f"Datagen scenario {scenario!r} archive member {member.name!r} "
            "must be a regular file or directory"
        )
    return path


@contextmanager
def _scenario_lock(cache_root: Path, scenario: str) -> Iterator[None]:
    lock_path = cache_root / f".{scenario}.lock"
    deadline = time.monotonic() + 120
    while True:
        try:
            descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            if _lock_owner_has_exited(lock_path):
                try:
                    lock_path.unlink()
                except FileNotFoundError:
                    pass
                continue
            if time.monotonic() >= deadline:
                raise AssetFetchError(
                    f"Timed out waiting for datagen scenario {scenario!r} cache lock"
                )
            time.sleep(0.05)
        else:
            break
    try:
        os.write(descriptor, str(os.getpid()).encode())
        yield
    finally:
        os.close(descriptor)
        lock_path.unlink(missing_ok=True)


def _lock_owner_has_exited(lock_path: Path) -> bool:
    try:
        owner = int(lock_path.read_text())
    except (OSError, ValueError):
        return False
    try:
        os.kill(owner, 0)
    except ProcessLookupError:
        return True
    except PermissionError:
        return False
    return False


def _is_scenario_directory(path: Path) -> bool:
    return all(
        (path / filename).is_file()
        for filename in ("manifest.json", "fragments.jsonl", "traces.jsonl")
    )
