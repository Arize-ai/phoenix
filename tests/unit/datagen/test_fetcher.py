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


def test_fetch_scenario_refuses_a_version_1_index_entry(tmp_path: Path) -> None:
    index = tmp_path / "index.json"
    index.write_text(
        json.dumps(
            {
                "schema_version": 2,
                "scenarios": {
                    "legacy-starter": {
                        "url": "https://assets.example/legacy-starter.tar.gz",
                        "sha256": "0" * 64,
                        "size_bytes": 1,
                        "asset_schema_version": 1,
                        "fragment_count": 0,
                        "archetypes": [],
                    }
                },
            }
        )
    )

    with pytest.raises(ScenarioFetchError, match="'asset_schema_version' must be 2"):
        fetch_scenario("legacy-starter", cache_dir=tmp_path / "cache", index_path=index)


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


def test_fetch_scenario_refuses_manifest_file_digest_mismatch(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path, "remote-bank", corrupt_traces=True)
    index = _write_index(tmp_path, "remote-bank", archive)

    with pytest.raises(ScenarioFetchError, match="file metadata"):
        fetch_scenario(
            "remote-bank",
            cache_dir=tmp_path / "cache",
            index_path=index,
            downloader=_copy_downloader(archive),
        )


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


def test_fetch_scenario_defaults_to_the_sole_indexed_scenario(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path, "remote-bank")
    index = _write_index(tmp_path, "remote-bank", archive)

    cached = fetch_scenario(
        cache_dir=tmp_path / "cache",
        index_path=index,
        downloader=_copy_downloader(archive),
    )

    assert cached.parent.parent.name == "cache"
    assert (cached / "manifest.json").is_file()


def test_fetch_scenario_requires_a_name_when_the_index_holds_several(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path, "remote-bank")
    index_path = tmp_path / "multi-index.json"
    entry = json.loads(_write_index(tmp_path, "remote-bank", archive).read_text())
    entry["scenarios"]["second-bank"] = dict(entry["scenarios"]["remote-bank"])
    index_path.write_text(json.dumps(entry))

    with pytest.raises(ScenarioFetchError, match="pass --scenario"):
        fetch_scenario(cache_dir=tmp_path / "cache", index_path=index_path)


def test_load_scenario_lazily_resolves_an_indexed_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixture = Path(__file__).parent / "fixtures" / "fragment_bank"

    monkeypatch.setattr("phoenix.datagen.fetcher.fetch_scenario", lambda _scenario: fixture)

    scenario = load_scenario("remote-bank")

    assert scenario.schema_version == 2
    assert scenario.source == str(fixture)


def _build_archive(
    tmp_path: Path,
    scenario: str,
    unsafe_member: str | None = None,
    *,
    corrupt_traces: bool = False,
) -> Path:
    fixture = Path(__file__).parent / "fixtures" / "fragment_bank"
    archive = tmp_path / f"{scenario}.tar.gz"
    with tarfile.open(archive, "w:gz") as output:
        for filename in ("manifest.json", "fragments.jsonl", "traces.jsonl"):
            if filename == "traces.jsonl" and corrupt_traces:
                content = (fixture / filename).read_bytes() + b"\n"
                member = tarfile.TarInfo(f"{scenario}/{filename}")
                member.size = len(content)
                output.addfile(member, io.BytesIO(content))
            else:
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
                        "size_bytes": len(content),
                        "asset_schema_version": 2,
                        "fragment_count": 2,
                        "archetypes": ["plain_chat", "rag"],
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
