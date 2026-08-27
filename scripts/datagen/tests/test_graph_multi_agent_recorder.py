import json
from base64 import b64decode
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import pytest

pytest.importorskip("langchain_core")

from scripts.datagen.graph_multi_agent import record  # noqa: E402
from scripts.datagen.recording import fixtures_for


def test_graph_fixture_records_named_framework_nodes(tmp_path: Path) -> None:
    fixture = fixtures_for("graph_multi_agent")[0]

    fragments = record(tmp_path, fixtures=(fixture,))

    assert fragments[0]["fragment_id"] == fixture.fragment_id
    spans = _spans(tmp_path / "traces.jsonl")
    assert {span["name"] for span in spans} >= {
        "coordinate_research_request",
        "supervisor_agent",
        "research_agent",
        "writer_agent",
    }
    assert {b64decode(span["traceId"]).hex() for span in spans} == set(fragments[0]["trace_ids"])
    roots = [span for span in spans if not span.get("parentSpanId")]
    assert len(roots) == 1
    root = roots[0]
    assert root["name"] == "coordinate_research_request"
    assert _attribute(root, "openinference.span.kind") == "AGENT"
    assert _attribute(root, "input.mime_type") == "text/plain"
    assert _attribute(root, "output.mime_type") == "text/plain"
    assert _attribute(root, "input.value")
    assert _attribute(root, "output.value")


def _spans(path: Path) -> list[dict[str, Any]]:
    return [
        span
        for line in path.read_text().splitlines()
        for resource in json.loads(line)["resourceSpans"]
        for scope in resource["scopeSpans"]
        for span in scope["spans"]
    ]


def _attribute(span: Mapping[str, Any], key: str) -> Any:
    return next(
        (
            next(iter(attribute["value"].values()), None)
            for attribute in span.get("attributes", [])
            if attribute.get("key") == key
        ),
        None,
    )
