import json
import shutil
from hashlib import sha256
from pathlib import Path

from phoenix.datagen import load_corpus
from phoenix.datagen.fetcher import fetch_corpus
from scripts.datagen.corpus import package_corpus


def test_fetch_corpus_caches_digest_addressed_archive(tmp_path: Path) -> None:
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
    assert cached.name == sha256(archive.read_bytes()).hexdigest()
    assert cached.read_bytes() == archive.read_bytes()
    assert len(corpus.fragments) == 2
    assert downloads == 1


def _build_archive(tmp_path: Path) -> Path:
    source = Path(__file__).parent / "fixtures" / "fragment_bank"
    archive = tmp_path / "corpus.tar.gz"
    package_corpus(source, archive)
    return archive


def _write_pointer(tmp_path: Path, archive: Path) -> Path:
    pointer = tmp_path / "corpus.json"
    pointer.write_text(
        json.dumps(
            {
                "schema_version": 2,
                "url": "https://assets.example/datagen/corpus.tar.gz",
                "sha256": sha256(archive.read_bytes()).hexdigest(),
            }
        )
    )
    return pointer
