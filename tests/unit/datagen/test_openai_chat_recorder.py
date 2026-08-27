import json
from pathlib import Path
from typing import Any

from scripts.datagen.openai_chat_sessions import record
from scripts.datagen.recording import fixtures_for


def test_plain_chat_fixture_records_a_fragment(tmp_path: Path) -> None:
    fixture = fixtures_for("plain_chat")[0]

    fragments = record(tmp_path, fixtures=(fixture,))

    assert fragments[0]["fragment_id"] == fixture.fragment_id
    assert fragments[0]["trace_ids"]
    assert json.loads((tmp_path / "fragments.jsonl").read_text()) == fragments[0]
    spans = _spans(tmp_path / "traces.jsonl")
    assert {
        attribute["value"]["stringValue"]
        for span in spans
        for attribute in span["attributes"]
        if attribute["key"] == "session.id"
    } == {fixture.fragment_id}
    assert {
        attribute["value"]["stringValue"]
        for span in spans
        for attribute in span["attributes"]
        if attribute["key"] == "openinference.span.kind"
    } == {"LLM"}


def _spans(path: Path) -> list[dict[str, Any]]:
    return [
        span
        for line in path.read_text().splitlines()
        for resource in json.loads(line)["resourceSpans"]
        for scope in resource["scopeSpans"]
        for span in scope["spans"]
    ]
