import json
import shutil
import tarfile
from hashlib import sha256
from pathlib import Path
from typing import Callable

import pytest

from phoenix.datagen import load_corpus
from phoenix.datagen.fetcher import (
    CorpusFetchError,
    fetch_corpus,
    load_corpus_pointer,
)


def test_fetch_corpus_caches_a_checksum_verified_archive(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path)
    pointer = _write_pointer(tmp_path, archive)
    downloads = 0

    def download(_url: str, destination: Path) -> None:
        nonlocal downloads
        downloads += 1
        shutil.copyfile(archive, destination)

    cached = fetch_corpus(
        cache_dir=tmp_path / "cache",
        pointer_path=pointer,
        downloader=download,
    )
    corpus = load_corpus(cached)
    cached_again = fetch_corpus(
        cache_dir=tmp_path / "cache",
        pointer_path=pointer,
        downloader=download,
    )

    assert cached_again == cached
    assert corpus.manifest["scenario_name"] == "fragment-bank"
    assert cached.parent.name == "cache"
    assert downloads == 1


def test_fetch_corpus_refuses_a_checksum_mismatch(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path)
    pointer = _write_pointer(tmp_path, archive, digest="0" * 64)

    with pytest.raises(CorpusFetchError, match="checksum mismatch"):
        fetch_corpus(
            cache_dir=tmp_path / "cache",
            pointer_path=pointer,
            downloader=_copy_downloader(archive),
        )

    assert not any((tmp_path / "cache").iterdir())


def test_fetch_corpus_refuses_archive_traversal(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path, unsafe_member="../outside")
    pointer = _write_pointer(tmp_path, archive)

    with pytest.raises(CorpusFetchError, match="unsafe member"):
        fetch_corpus(
            cache_dir=tmp_path / "cache",
            pointer_path=pointer,
            downloader=_copy_downloader(archive),
        )

    assert not (tmp_path / "outside").exists()


def test_load_corpus_pointer_uses_a_cached_copy_when_offline(tmp_path: Path) -> None:
    archive = _build_archive(tmp_path)
    source_pointer = _write_pointer(tmp_path, archive)
    downloads = 0

    def download(_url: str, destination: Path) -> None:
        nonlocal downloads
        downloads += 1
        if downloads == 1:
            shutil.copyfile(source_pointer, destination)
        else:
            raise OSError("offline")

    first = load_corpus_pointer(cache_dir=tmp_path / "cache", downloader=download)
    second = load_corpus_pointer(cache_dir=tmp_path / "cache", downloader=download)

    assert first == second


def test_load_corpus_pointer_explains_how_to_recover_when_offline(
    tmp_path: Path,
) -> None:
    def offline(_url: str, _destination: Path) -> None:
        raise OSError("offline")

    with pytest.raises(CorpusFetchError, match="phoenix datagen pull"):
        load_corpus_pointer(cache_dir=tmp_path / "cache", downloader=offline)


def _build_archive(tmp_path: Path, *, unsafe_member: str | None = None) -> Path:
    source = Path(__file__).parent / "fixtures" / "fragment_bank"
    archive = tmp_path / "corpus.tar.gz"
    with tarfile.open(archive, "w:gz") as contents:
        for filename in ("manifest.json", "fragments.jsonl", "traces.jsonl"):
            contents.add(source / filename, arcname=f"recorded-traces/{filename}")
        if unsafe_member is not None:
            payload = tmp_path / "payload"
            payload.write_text("unsafe")
            contents.add(payload, arcname=unsafe_member)
    return archive


def _write_pointer(tmp_path: Path, archive: Path, *, digest: str | None = None) -> Path:
    pointer = tmp_path / "corpus.json"
    pointer.write_text(
        json.dumps(
            {
                "schema_version": 2,
                "url": "https://assets.example/datagen/corpus.tar.gz",
                "sha256": digest or sha256(archive.read_bytes()).hexdigest(),
            }
        )
    )
    return pointer


def _copy_downloader(source: Path) -> Callable[[str, Path], None]:
    def download(_url: str, destination: Path) -> None:
        shutil.copyfile(source, destination)

    return download
