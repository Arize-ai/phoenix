import io
import json
import shutil
import tarfile
from hashlib import sha256
from pathlib import Path
from typing import Callable

import pytest

from phoenix.datagen import load_scenario
from phoenix.datagen.fetcher import AssetFetchError, fetch_scenario, load_asset_index


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


def test_fetch_scenario_preserves_a_v1_starter_asset(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path, "legacy-starter", asset_schema_version=1)
    index = _write_index(tmp_path, "legacy-starter", archive, asset_schema_version=1)

    cached = fetch_scenario(
        "legacy-starter",
        cache_dir=tmp_path / "cache",
        index_path=index,
        downloader=_copy_downloader(archive),
    )

    assert load_scenario(cached).schema_version == 1


def test_fetch_scenario_refuses_a_checksum_mismatch(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path, "remote-bank")
    index = _write_index(tmp_path, "remote-bank", archive, digest="0" * 64)

    with pytest.raises(AssetFetchError, match="checksum mismatch"):
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

    with pytest.raises(AssetFetchError, match="unsafe member"):
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

    with pytest.raises(AssetFetchError, match="file metadata"):
        fetch_scenario(
            "remote-bank",
            cache_dir=tmp_path / "cache",
            index_path=index,
            downloader=_copy_downloader(archive),
        )


def test_load_asset_index_uses_a_cached_copy_when_offline(tmp_path: Path) -> None:
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

    first = load_asset_index(cache_dir=tmp_path / "cache", downloader=download)
    second = load_asset_index(cache_dir=tmp_path / "cache", downloader=download)

    assert first == second
    assert set(second) == {"remote-bank"}


def test_load_asset_index_explains_how_to_recover_when_offline(tmp_path: Path) -> None:
    def offline(_url: str, _destination: Path) -> None:
        raise OSError("offline")

    with pytest.raises(AssetFetchError, match="PHOENIX_DATAGEN_ASSETS_BASE_URL"):
        load_asset_index(cache_dir=tmp_path / "cache", downloader=offline)


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
    asset_schema_version: int = 2,
) -> Path:
    fixture_name = "fragment_bank" if asset_schema_version == 2 else "scenario"
    fixture = Path(__file__).parent / "fixtures" / fixture_name
    archive = tmp_path / f"{scenario}.tar.gz"
    with tarfile.open(archive, "w:gz") as output:
        filenames = ["manifest.json", "traces.jsonl"]
        if asset_schema_version == 2:
            filenames.insert(1, "fragments.jsonl")
        for filename in filenames:
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
    asset_schema_version: int = 2,
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
                        "asset_schema_version": asset_schema_version,
                        "fragment_count": 2 if asset_schema_version == 2 else 0,
                        "archetypes": ["plain_chat", "rag"] if asset_schema_version == 2 else [],
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
