from pathlib import Path

from scripts.datagen.llama_index_rag import record
from scripts.datagen.recording import fixtures_for


def test_rag_fixture_records_with_scripted_defaults(tmp_path: Path) -> None:
    fixture = fixtures_for("rag")[0]

    fragments = record(tmp_path, fixtures=(fixture,))

    assert fragments[0]["fragment_id"] == fixture.fragment_id
    assert fragments[0]["trace_ids"]
