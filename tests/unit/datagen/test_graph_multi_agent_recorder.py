import json
from base64 import b64decode
from pathlib import Path
from typing import Any

from scripts.datagen.graph_multi_agent import record
from scripts.datagen.recording import fixtures_for


def test_graph_fixture_records_named_framework_nodes(tmp_path: Path) -> None:
    fixture = fixtures_for("graph_multi_agent")[0]

    fragments = record(tmp_path, fixtures=(fixture,))

    assert fragments[0]["fragment_id"] == fixture.fragment_id
    spans = _spans(tmp_path / "traces.jsonl")
    assert {span["name"] for span in spans} >= {
        "supervisor_agent",
        "research_agent",
        "writer_agent",
    }
    assert {b64decode(span["traceId"]).hex() for span in spans} == set(fragments[0]["trace_ids"])


def _spans(path: Path) -> list[dict[str, Any]]:
    return [
        span
        for line in path.read_text().splitlines()
        for resource in json.loads(line)["resourceSpans"]
        for scope in resource["scopeSpans"]
        for span in scope["spans"]
    ]
