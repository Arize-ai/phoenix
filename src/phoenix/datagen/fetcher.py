from __future__ import annotations

import json
import os
import shutil
import tarfile
import tempfile
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Mapping
from urllib.parse import urlparse
from urllib.request import urlopen

_SCENARIO_BASE_URL = "https://storage.googleapis.com/arize-phoenix-assets/datagen"
_CACHE_CHECKSUMS_FILENAME = ".checksums.json"


class ScenarioFetchError(ValueError):
    """Raised when a datagen scenario cannot be resolved or safely cached."""


@dataclass(frozen=True)
class ScenarioEntry:
    url: str
    sha256: str


Downloader = Callable[[str, Path], None]


def fetch_scenario(
    scenario: str | None = None,
    *,
    cache_dir: Path | None = None,
    index_path: Path | None = None,
    downloader: Downloader | None = None,
) -> Path:
    """Fetch a scenario from the published index and return its cached directory."""
    cache_root = cache_dir or default_cache_dir()
    index = load_scenario_index(index_path, cache_dir=cache_root)
    if scenario is None:
        if not index:
            raise ScenarioFetchError("The datagen scenario index does not contain any scenarios")
        if len(index) > 1:
            raise ScenarioFetchError(
                f"The datagen scenario index contains several scenarios {sorted(index)!r}; "
                "pass --scenario to choose one"
            )
        (scenario,) = index
    entry = index.get(scenario)
    if entry is None:
        raise ScenarioFetchError(
            f"Scenario {scenario!r} is not present in the datagen scenario index"
        )

    destination = cache_root / scenario / entry.sha256
    if _is_cached_scenario(destination):
        return destination

    _ensure_cache_dir(cache_root)
    return _download_and_publish(
        scenario,
        entry,
        cache_root,
        destination,
        downloader or _download_archive,
    )


def load_scenario_index(
    index_path: Path | None = None,
    *,
    cache_dir: Path | None = None,
    index_url: str | None = None,
    downloader: Downloader | None = None,
) -> Mapping[str, ScenarioEntry]:
    """Load an explicit index or refresh the cached index from object storage."""
    path = index_path
    if path is None:
        cache_root = cache_dir or default_cache_dir()
        path = _acquire_index(
            cache_root,
            index_url or f"{_SCENARIO_BASE_URL}/index.json",
            downloader or _download_file,
        )
    return _read_scenario_index(path)


def _read_scenario_index(path: Path) -> Mapping[str, ScenarioEntry]:
    try:
        value = json.loads(path.read_bytes())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ScenarioFetchError(
            f"Unable to read datagen scenario index {path}: {error}"
        ) from error
    if not isinstance(value, dict) or value.get("schema_version") != 2:
        raise ScenarioFetchError(f"Datagen scenario index {path} must have schema_version 2")
    scenarios = value.get("scenarios")
    if not isinstance(scenarios, dict):
        raise ScenarioFetchError(
            f"Datagen scenario index {path} field 'scenarios' must be an object"
        )
    return {
        scenario: _parse_scenario_entry(scenario, raw_entry, path)
        for scenario, raw_entry in scenarios.items()
    }


def _acquire_index(cache_root: Path, url: str, downloader: Downloader) -> Path:
    _ensure_cache_dir(cache_root)
    destination = cache_root / "index.json"
    descriptor, temporary_name = tempfile.mkstemp(prefix=".index-", dir=cache_root)
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    try:
        try:
            downloader(url, temporary_path)
            _read_scenario_index(temporary_path)
        except (ScenarioFetchError, OSError, ValueError) as error:
            if destination.is_file():
                try:
                    _read_scenario_index(destination)
                except ScenarioFetchError:
                    pass
                else:
                    return destination
            raise ScenarioFetchError(
                f"Unable to download the datagen scenario index from {url}: {error}. "
                "Run 'phoenix datagen pull <scenario>' while online to prime the cache, "
                "or pass a local scenario directory."
            ) from error
        os.replace(temporary_path, destination)
        return destination
    finally:
        temporary_path.unlink(missing_ok=True)


def default_cache_dir() -> Path:
    root = os.environ.get("XDG_CACHE_HOME")
    return (Path(root).expanduser() if root else Path.home() / ".cache") / "phoenix" / "datagen"


def _ensure_cache_dir(path: Path) -> None:
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise ScenarioFetchError(
            f"Unable to create the datagen scenario cache at {path}: {error}. "
            "Set XDG_CACHE_HOME to a writable directory."
        ) from error


def _parse_scenario_entry(scenario: Any, value: Any, index_path: Path) -> ScenarioEntry:
    if (
        not isinstance(scenario, str)
        or not scenario
        or scenario in {".", ".."}
        or "/" in scenario
        or "\\" in scenario
    ):
        raise ScenarioFetchError(
            f"Datagen scenario index {index_path} has an invalid scenario name"
        )
    if not isinstance(value, dict):
        raise ScenarioFetchError(
            f"Datagen scenario index {index_path} scenario {scenario!r} must be an object"
        )

    url = value.get("url")
    digest = value.get("sha256")
    if not isinstance(url, str) or urlparse(url).scheme != "https":
        raise ScenarioFetchError(
            f"Datagen scenario index {index_path} scenario {scenario!r} field 'url' must use HTTPS"
        )
    if (
        not isinstance(digest, str)
        or len(digest) != 64
        or any(character not in "0123456789abcdef" for character in digest)
    ):
        raise ScenarioFetchError(
            f"Datagen scenario index {index_path} scenario {scenario!r} field 'sha256' is invalid"
        )
    return ScenarioEntry(url=url, sha256=digest)


def _download_and_publish(
    scenario: str,
    entry: ScenarioEntry,
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
    stale_root: Path | None = None
    try:
        try:
            downloader(entry.url, archive_path)
        except (OSError, ValueError) as error:
            raise ScenarioFetchError(
                f"Unable to download datagen scenario {scenario!r}: {error}"
            ) from error
        actual_digest = _file_sha256(archive_path)
        if actual_digest != entry.sha256:
            raise ScenarioFetchError(
                f"Datagen scenario {scenario!r} checksum mismatch: expected {entry.sha256}, "
                f"downloaded {actual_digest}"
            )
        extracted = _extract_scenario_archive(archive_path, staging_path, scenario)
        _write_cache_sentinel(extracted)
        if _is_cached_scenario(destination):
            return destination
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            stale_root = Path(tempfile.mkdtemp(prefix=f".{scenario}-stale-", dir=cache_root))
            os.replace(destination, stale_root / destination.name)
        try:
            os.replace(extracted, destination)
        except OSError:
            if _is_cached_scenario(destination):
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


def _extract_scenario_archive(archive_path: Path, staging_path: Path, scenario: str) -> Path:
    scenario_path = staging_path / scenario
    scenario_path.mkdir()
    try:
        with tarfile.open(archive_path, mode="r:gz") as archive:
            for member in archive.getmembers():
                relative_path = _safe_member_path(member, scenario)
                output_path = staging_path.joinpath(*relative_path.parts)
                if member.isdir():
                    output_path.mkdir(parents=True, exist_ok=True)
                    continue
                output_path.parent.mkdir(parents=True, exist_ok=True)
                source = archive.extractfile(member)
                if source is None:
                    raise ScenarioFetchError(
                        f"Datagen scenario {scenario!r} archive member {member.name!r} "
                        "could not be read"
                    )
                with source, output_path.open("wb") as output:
                    shutil.copyfileobj(source, output)
    except (OSError, tarfile.TarError) as error:
        raise ScenarioFetchError(
            f"Datagen scenario {scenario!r} is not a readable gzip tar archive: {error}"
        ) from error

    return scenario_path


def _write_cache_sentinel(path: Path) -> None:
    (path / _CACHE_CHECKSUMS_FILENAME).touch()


def _is_cached_scenario(path: Path) -> bool:
    return (path / _CACHE_CHECKSUMS_FILENAME).is_file()


def _safe_member_path(member: tarfile.TarInfo, scenario: str) -> PurePosixPath:
    path = PurePosixPath(member.name)
    if (
        not member.name
        or "\\" in member.name
        or path.is_absolute()
        or ".." in path.parts
        or path.parts[0] != scenario
    ):
        raise ScenarioFetchError(
            f"Datagen scenario {scenario!r} archive has unsafe member {member.name!r}"
        )
    if not (member.isdir() or member.isfile()):
        raise ScenarioFetchError(
            f"Datagen scenario {scenario!r} archive member {member.name!r} "
            "must be a regular file or directory"
        )
    return path
