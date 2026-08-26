import io
import json
import tarfile
from pathlib import Path

from phoenix.datagen import load_corpus
from scripts.datagen.publish import command as publish_command
from scripts.datagen.scenario import command as corpus_command


def test_package_and_prepare_publication(tmp_path: Path) -> None:
    source = Path(__file__).parent / "fixtures" / "fragment_bank"
    archive = tmp_path / "corpus.tar.gz"
    package_output = io.StringIO()

    assert (
        corpus_command(
            [str(source), "--archive", str(archive)],
            stdout=package_output,
        )
        == 0
    )
    package = json.loads(package_output.getvalue())

    with tarfile.open(archive, "r:gz") as contents:
        assert [member.name for member in contents.getmembers()] == [
            "fragments.jsonl",
            "traces.jsonl",
        ]
        fragment_rows = contents.extractfile("fragments.jsonl")
        assert fragment_rows is not None
        assert all(
            set(json.loads(line)) == {"fragment_id", "archetype", "domain", "trace_ids"}
            for line in fragment_rows.read().decode().splitlines()
        )

    publication_output = io.StringIO()
    publication_dir = tmp_path / "publication"
    assert (
        publish_command(
            [
                "prepare-archive",
                "--archive",
                str(archive),
                "--output-dir",
                str(publication_dir),
            ],
            stdout=publication_output,
        )
        == 0
    )
    publication = json.loads(publication_output.getvalue())
    corpus = load_corpus(archive)
    pointer = json.loads((publication_dir / "corpus.json").read_text())

    assert package["sha256"] == publication["sha256"] == pointer["sha256"]
    assert package["fragment_count"] == len(corpus.fragments) == 2
    assert publication["archetypes"] == ["plain_chat", "rag"]
