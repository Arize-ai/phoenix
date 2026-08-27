import json
from pathlib import Path
from typing import Any

from scripts.datagen.tool_agent import record


def test_conditioned_tool_agent_records_framework_tool_and_authored_results(
    tmp_path: Path,
) -> None:
    fragments = record(tmp_path, condition="support-stale-delivery-status")

    assert fragments[0]["fragment_id"] == "support-order-and-status-tools-stale"
    assert fragments[0]["trace_ids"]
    spans = _spans(tmp_path / "traces.jsonl")
    kinds = {
        attribute["value"]["stringValue"]
        for span in spans
        for attribute in span["attributes"]
        if attribute["key"] == "openinference.span.kind"
    }
    outputs = {
        attribute["value"].get("stringValue", "")
        for span in spans
        for attribute in span["attributes"]
        if attribute["key"] == "output.value"
    }

    assert {"AGENT", "TOOL", "LLM"}.issubset(kinds)
    assert any("exception_review" in output for output in outputs)


def _spans(path: Path) -> list[dict[str, Any]]:
    return [
        span
        for line in path.read_text().splitlines()
        for resource in json.loads(line)["resourceSpans"]
        for scope in resource["scopeSpans"]
        for span in scope["spans"]
    ]
