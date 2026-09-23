import json
import tarfile
from pathlib import Path

from phoenix.experimental.datagen import load_corpus


def test_load_corpus_reads_fragment_and_trace_members(tmp_path: Path) -> None:
    source = Path(__file__).parent / "fixtures" / "fragment_bank"
    fragments = tmp_path / "fragments.jsonl"
    rows = [json.loads(line) for line in (source / "fragments.jsonl").read_text().splitlines()]
    fragments.write_text(
        "".join(
            json.dumps(
                {field: row[field] for field in ("fragment_id", "archetype", "domain", "trace_ids")}
            )
            + "\n"
            for row in rows
        )
    )
    archive = tmp_path / "corpus.tar.gz"
    with tarfile.open(archive, "w:gz") as contents:
        contents.add(fragments, arcname="fragments.jsonl")
        contents.add(source / "traces.jsonl", arcname="traces.jsonl")

    corpus = load_corpus(archive)

    assert [fragment.archetype for fragment in corpus.fragments] == ["plain_chat", "rag"]
    assert set(corpus.requests_by_trace_id) == {
        "01010101010101010101010101010101",
        "02020202020202020202020202020202",
        "03030303030303030303030303030303",
    }
