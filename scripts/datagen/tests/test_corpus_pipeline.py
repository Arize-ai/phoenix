import io
import json
import tarfile
from pathlib import Path

from phoenix.experimental.datagen import load_corpus
from scripts.datagen.corpus import command as corpus_command
from scripts.datagen.publish import command as publish_command


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
    assert {
        key: package[key]
        for key in (
            "span_count",
            "span_kind_counts",
            "span_kind_shares",
            "spans_per_trace",
            "tool_span_count",
            "tool_span_share",
            "llm_turns_by_session",
            "llm_turns_per_session",
        )
    } == {
        "span_count": 4,
        "span_kind_counts": {"CHAIN": 1, "LLM": 3, "TOOL": 0},
        "span_kind_shares": {"CHAIN": 0.25, "LLM": 0.75, "TOOL": 0.0},
        "spans_per_trace": {"min": 1, "median": 1, "mean": 4 / 3, "max": 2},
        "tool_span_count": 0,
        "tool_span_share": 0.0,
        "llm_turns_by_session": {"session-a": 2, "session-b": 1},
        "llm_turns_per_session": {"min": 1, "median": 1.5, "mean": 1.5, "max": 2},
    }

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
