import json
from pathlib import Path
from typing import Any

from scripts.datagen.recording import fixtures_for
from scripts.datagen.tool_agent import record


def test_tool_agent_fixture_records_framework_and_tool_spans(tmp_path: Path) -> None:
    fixture = fixtures_for("tool_agent")[0]

    fragments = record(tmp_path, fixtures=(fixture,))

    assert fragments[0]["fragment_id"] == fixture.fragment_id
    assert fragments[0]["trace_ids"]
    spans = _spans(tmp_path / "traces.jsonl")
    kinds = {
        attribute["value"]["stringValue"]
        for span in spans
        for attribute in span["attributes"]
        if attribute["key"] == "openinference.span.kind"
    }
    assert {"AGENT", "TOOL", "LLM"}.issubset(kinds)


def _spans(path: Path) -> list[dict[str, Any]]:
    return [
        span
        for line in path.read_text().splitlines()
        for resource in json.loads(line)["resourceSpans"]
        for scope in resource["scopeSpans"]
        for span in scope["spans"]
    ]
