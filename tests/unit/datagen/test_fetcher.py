import io
import json
import shutil
import tarfile
from hashlib import sha256
from pathlib import Path

import pytest

from phoenix.datagen import load_scenario
from phoenix.datagen.fetcher import AssetFetchError, fetch_scenario


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

    with pytest.raises(AssetFetchError, match="checksum mismatch"):
        fetch_scenario(
            "remote-bank",
            cache_dir=tmp_path / "cache",
            index_path=index,
            downloader=lambda _url, destination: shutil.copyfile(archive, destination),
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
            downloader=lambda _url, destination: shutil.copyfile(archive, destination),
        )

    assert not (tmp_path / "outside").exists()


def test_load_scenario_lazily_resolves_an_indexed_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixture = Path(__file__).parent / "fixtures" / "fragment_bank"

    monkeypatch.setattr("phoenix.datagen.fetcher.fetch_scenario", lambda _scenario: fixture)

    scenario = load_scenario("remote-bank")

    assert scenario.schema_version == 2
    assert scenario.source == str(fixture)


def _build_archive(tmp_path: Path, scenario: str, unsafe_member: str | None = None) -> Path:
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
