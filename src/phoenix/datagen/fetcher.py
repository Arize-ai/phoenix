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

_DEFAULT_SCENARIO_BASE_URL = "https://storage.googleapis.com/arize-phoenix-assets/datagen"
_SCENARIO_BASE_URL_ENV = "PHOENIX_DATAGEN_SCENARIO_BASE_URL"
_CACHE_CHECKSUMS_FILENAME = ".checksums.json"


class ScenarioFetchError(ValueError):
    """Raised when a datagen scenario cannot be resolved or safely cached."""


@dataclass(frozen=True)
class ScenarioEntry:
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
    """Fetch a scenario from the published index and return its cached directory."""
    cache_root = cache_dir or default_cache_dir()
    index = load_scenario_index(index_path, cache_dir=cache_root)
    if scenario == "default" and scenario not in index:
        if not index:
            raise ScenarioFetchError("The datagen scenario index does not contain any scenarios")
        scenario = min(index)
    entry = index.get(scenario)
    if entry is None:
        raise ScenarioFetchError(
            f"Scenario {scenario!r} is not present in the datagen scenario index"
        )

    destination = cache_root / scenario / entry.sha256
    if _is_cached_scenario(destination, entry):
        return destination

    _ensure_cache_dir(cache_root)
    with _scenario_lock(cache_root, scenario):
        if _is_cached_scenario(destination, entry):
            return destination
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
            index_url or f"{scenario_base_url()}/index.json",
            downloader or _download_file,
        )
    return _read_scenario_index(path)


def scenario_base_url() -> str:
    value = os.environ.get(_SCENARIO_BASE_URL_ENV, _DEFAULT_SCENARIO_BASE_URL).rstrip("/")
    if urlparse(value).scheme != "https":
        raise ScenarioFetchError(f"{_SCENARIO_BASE_URL_ENV} must use HTTPS")
    return value


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
    with _scenario_lock(cache_root, "index"):
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
                    f"Set {_SCENARIO_BASE_URL_ENV} to a published HTTPS scenario prefix, "
                    "run 'phoenix datagen pull <scenario>' while online to prime the cache, "
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
    size_bytes = value.get("size_bytes")
    asset_schema_version = value.get("asset_schema_version")
    fragment_count = value.get("fragment_count")
    archetypes = value.get("archetypes")
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
    if type(size_bytes) is not int or size_bytes < 0:
        raise ScenarioFetchError(
            f"Datagen scenario index {index_path} scenario {scenario!r} field 'size_bytes' "
            "is invalid"
        )
    if type(asset_schema_version) is not int or asset_schema_version != 2:
        raise ScenarioFetchError(
            f"Datagen scenario index {index_path} scenario {scenario!r} field "
            "'asset_schema_version' must be 2"
        )
    if type(fragment_count) is not int or fragment_count < 0:
        raise ScenarioFetchError(
            f"Datagen scenario index {index_path} scenario {scenario!r} field 'fragment_count' "
            "is invalid"
        )
    if not isinstance(archetypes, list) or not all(
        isinstance(archetype, str) and archetype for archetype in archetypes
    ):
        raise ScenarioFetchError(
            f"Datagen scenario index {index_path} scenario {scenario!r} field 'archetypes' "
            "is invalid"
        )
    return ScenarioEntry(
        url=url,
        sha256=digest,
        size_bytes=size_bytes,
        asset_schema_version=asset_schema_version,
        fragment_count=fragment_count,
        archetypes=tuple(archetypes),
    )


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
        actual_size = archive_path.stat().st_size
        if actual_size != entry.size_bytes:
            raise ScenarioFetchError(
                f"Datagen scenario {scenario!r} expected {entry.size_bytes} archive bytes, "
                f"downloaded {actual_size}"
            )
        actual_digest = _file_sha256(archive_path)
        if actual_digest != entry.sha256:
            raise ScenarioFetchError(
                f"Datagen scenario {scenario!r} checksum mismatch: expected {entry.sha256}, "
                f"downloaded {actual_digest}"
            )
        extracted = _extract_scenario_archive(archive_path, staging_path, scenario)
        try:
            checksums = _verify_scenario_directory(extracted, scenario)
        except OSError as error:
            raise ScenarioFetchError(
                f"Unable to verify downloaded datagen scenario {scenario!r}: {error}"
            ) from error
        _write_cache_checksums(extracted, entry.sha256, checksums)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            stale_root = Path(tempfile.mkdtemp(prefix=f".{scenario}-stale-", dir=cache_root))
            os.replace(destination, stale_root / destination.name)
        os.replace(extracted, destination)
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
    seen: set[PurePosixPath] = set()
    required = {"manifest.json", "traces.jsonl", "fragments.jsonl"}
    extracted_files: set[str] = set()
    try:
        with tarfile.open(archive_path, mode="r:gz") as archive:
            for member in archive.getmembers():
                relative_path = _safe_member_path(member, scenario)
                if relative_path in seen:
                    raise ScenarioFetchError(
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
                    raise ScenarioFetchError(
                        f"Datagen scenario {scenario!r} archive member {member.name!r} "
                        "could not be read"
                    )
                with source, output_path.open("xb") as output:
                    shutil.copyfileobj(source, output)
                if len(relative_path.parts) == 2:
                    extracted_files.add(relative_path.name)
    except (OSError, tarfile.TarError) as error:
        raise ScenarioFetchError(
            f"Datagen scenario {scenario!r} is not a readable gzip tar archive: {error}"
        ) from error

    missing = sorted(required - extracted_files)
    if missing:
        raise ScenarioFetchError(
            f"Datagen scenario {scenario!r} archive is missing required files {missing!r}"
        )
    return staging_path / scenario


def _verify_scenario_directory(
    path: Path,
    scenario: str,
) -> Mapping[str, Mapping[str, int | str]]:
    manifest_path = path / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_bytes())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ScenarioFetchError(
            f"Datagen scenario {scenario!r} has an unreadable manifest.json: {error}"
        ) from error
    if not isinstance(manifest, dict):
        raise ScenarioFetchError(
            f"Datagen scenario {scenario!r} manifest.json must contain an object"
        )
    manifest_version = manifest.get("schema_version")
    if manifest_version != 2:
        raise ScenarioFetchError(
            f"Datagen scenario {scenario!r} manifest.json must declare schema_version 2, "
            f"but declares {manifest_version!r}"
        )

    required = {"manifest.json", "traces.jsonl", "fragments.jsonl"}
    declared_files = manifest.get("files")
    if not isinstance(declared_files, dict):
        raise ScenarioFetchError(
            f"Datagen scenario {scenario!r} manifest.json field 'files' must be an object"
        )
    for filename in sorted(required - {"manifest.json"}):
        metadata = declared_files.get(filename)
        if not isinstance(metadata, dict):
            raise ScenarioFetchError(
                f"Datagen scenario {scenario!r} manifest.json is missing file metadata "
                f"for {filename!r}"
            )
        content = (path / filename).read_bytes()
        actual_digest = sha256(content).hexdigest()
        actual_size = len(content)
        if metadata.get("sha256") != actual_digest or metadata.get("size_bytes") != actual_size:
            raise ScenarioFetchError(
                f"Datagen scenario {scenario!r} manifest.json file metadata for "
                f"{filename!r} does not match the downloaded file"
            )

    checksums: dict[str, Mapping[str, int | str]] = {}
    for filename in sorted(required):
        content = (path / filename).read_bytes()
        checksums[filename] = {
            "sha256": sha256(content).hexdigest(),
            "size_bytes": len(content),
        }
    return checksums


def _write_cache_checksums(
    path: Path,
    archive_digest: str,
    checksums: Mapping[str, Mapping[str, int | str]],
) -> None:
    (path / _CACHE_CHECKSUMS_FILENAME).write_text(
        json.dumps(
            {"archive_sha256": archive_digest, "files": checksums},
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )


def _is_cached_scenario(path: Path, entry: ScenarioEntry) -> bool:
    try:
        metadata = json.loads((path / _CACHE_CHECKSUMS_FILENAME).read_bytes())
        if not isinstance(metadata, dict) or metadata.get("archive_sha256") != entry.sha256:
            return False
        files = metadata.get("files")
        if not isinstance(files, dict):
            return False
        for filename, expected in files.items():
            if not isinstance(filename, str) or not isinstance(expected, dict):
                return False
            if expected.get("size_bytes") != (path / filename).stat().st_size:
                return False
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return False
    return True


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


@contextmanager
def _scenario_lock(cache_root: Path, scenario: str) -> Iterator[None]:
    lock_path = cache_root / f".{scenario}.lock"
    deadline = time.monotonic() + 120
    while True:
        try:
            descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise ScenarioFetchError(
                    f"Timed out waiting for the datagen scenario {scenario!r} cache lock. "
                    f"If no other process is fetching it, delete {lock_path} and retry."
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
