import json
from pathlib import Path
from typing import Any

from scripts.datagen.recording import fixtures_for
from scripts.datagen.structured_extraction import record


def test_structured_extraction_fixture_records_a_function_call(tmp_path: Path) -> None:
    fixture = fixtures_for("structured_extraction")[0]

    fragments = record(tmp_path, fixtures=(fixture,))

    assert fragments[0]["fragment_id"] == fixture.fragment_id
    assert fragments[0]["trace_ids"]
    spans = _spans(tmp_path / "traces.jsonl")
    output = next(
        attribute["value"]["stringValue"]
        for span in spans
        for attribute in span["attributes"]
        if attribute["key"] == "output.value"
    )
    assert "extract_analysis_request" in output


def _spans(path: Path) -> list[dict[str, Any]]:
    return [
        span
        for line in path.read_text().splitlines()
        for resource in json.loads(line)["resourceSpans"]
        for scope in resource["scopeSpans"]
        for span in scope["spans"]
    ]
