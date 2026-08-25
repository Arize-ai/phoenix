import io
import json
import shutil
import tarfile
from hashlib import sha256
from pathlib import Path
from typing import Callable

import pytest

from phoenix.datagen import load_scenario
from phoenix.datagen.fetcher import ScenarioFetchError, fetch_scenario, load_scenario_index


def test_fetch_scenario_caches_a_checksum_verified_bank(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path, "remote-bank")
    index = _write_index(tmp_path, "remote-bank", archive)
    downloads = 0

    def download(_url: str, destination: Path) -> None:
        nonlocal downloads
        downloads += 1
        shutil.copyfile(archive, destination)

    cached = fetch_scenario(
        "remote-bank",
        cache_dir=tmp_path / "cache",
        index_path=index,
        downloader=download,
    )
    scenario = load_scenario(cached)
    cached_again = fetch_scenario(
        "remote-bank",
        cache_dir=tmp_path / "cache",
        index_path=index,
        downloader=download,
    )

    assert cached_again == cached
    assert scenario.manifest["scenario_name"] == "fragment-bank"
    assert downloads == 1


def test_fetch_scenario_refuses_a_checksum_mismatch(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path, "remote-bank")
    index = _write_index(tmp_path, "remote-bank", archive, digest="0" * 64)

    with pytest.raises(ScenarioFetchError, match="checksum mismatch"):
        fetch_scenario(
            "remote-bank",
            cache_dir=tmp_path / "cache",
            index_path=index,
            downloader=_copy_downloader(archive),
        )

    assert not any((tmp_path / "cache").glob("remote-bank/*"))


def test_fetch_scenario_refuses_archive_traversal(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path, "remote-bank", unsafe_member="../outside")
    index = _write_index(tmp_path, "remote-bank", archive)

    with pytest.raises(ScenarioFetchError, match="unsafe member"):
        fetch_scenario(
            "remote-bank",
            cache_dir=tmp_path / "cache",
            index_path=index,
            downloader=_copy_downloader(archive),
        )

    assert not (tmp_path / "outside").exists()


def test_load_scenario_index_uses_a_cached_copy_when_offline(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path, "remote-bank")
    source_index = _write_index(tmp_path, "remote-bank", archive)
    downloads = 0

    def download(_url: str, destination: Path) -> None:
        nonlocal downloads
        downloads += 1
        if downloads == 1:
            shutil.copyfile(source_index, destination)
        else:
            raise OSError("offline")

    first = load_scenario_index(cache_dir=tmp_path / "cache", downloader=download)
    second = load_scenario_index(cache_dir=tmp_path / "cache", downloader=download)

    assert first == second
    assert set(second) == {"remote-bank"}


def test_load_scenario_index_explains_how_to_recover_when_offline(tmp_path: Path) -> None:
    def offline(_url: str, _destination: Path) -> None:
        raise OSError("offline")

    with pytest.raises(ScenarioFetchError, match="phoenix datagen pull"):
        load_scenario_index(cache_dir=tmp_path / "cache", downloader=offline)


def test_fetch_scenario_resolves_an_implicit_name_only_when_unambiguous(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path, "remote-bank")
    index = _write_index(tmp_path, "remote-bank", archive)

    cached = fetch_scenario(
        cache_dir=tmp_path / "cache",
        index_path=index,
        downloader=_copy_downloader(archive),
    )

    assert cached.parent.parent.name == "cache"
    assert (cached / "manifest.json").is_file()
    index_path = tmp_path / "multi-index.json"
    entry = json.loads(index.read_text())
    entry["scenarios"]["second-bank"] = dict(entry["scenarios"]["remote-bank"])
    index_path.write_text(json.dumps(entry))

    with pytest.raises(ScenarioFetchError, match="pass --scenario"):
        fetch_scenario(cache_dir=tmp_path / "cache", index_path=index_path)


def _build_archive(
    tmp_path: Path,
    scenario: str,
    unsafe_member: str | None = None,
) -> Path:
    fixture = Path(__file__).parent / "fixtures" / "fragment_bank"
    archive = tmp_path / f"{scenario}.tar.gz"
    with tarfile.open(archive, "w:gz") as output:
        for filename in ("manifest.json", "fragments.jsonl", "traces.jsonl"):
            output.add(fixture / filename, arcname=f"{scenario}/{filename}")
        if unsafe_member is not None:
            member = tarfile.TarInfo(unsafe_member)
            member.size = 1
            output.addfile(member, io.BytesIO(b"x"))
    return archive


def _write_index(
    tmp_path: Path,
    scenario: str,
    archive: Path,
    *,
    digest: str | None = None,
) -> Path:
    index = tmp_path / "index.json"
    content = archive.read_bytes()
    index.write_text(
        json.dumps(
            {
                "schema_version": 2,
                "scenarios": {
                    scenario: {
                        "url": f"https://assets.example/{archive.name}",
                        "sha256": digest or sha256(content).hexdigest(),
                    }
                },
            }
        )
    )
    return index


def _copy_downloader(source: Path) -> Callable[[str, Path], None]:
    def download(_url: str, destination: Path) -> None:
        shutil.copyfile(source, destination)

    return download
