import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import pytest

pytest.importorskip("langchain_core")

from scripts.datagen.fake_tools import local_tools
from scripts.datagen.recording import load_fixtures
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
    roots = [span for span in spans if not span.get("parentSpanId")]
    assert len(roots) == 1
    root = roots[0]
    assert root["name"] == "handle_support_request"
    assert _attribute(root, "openinference.span.kind") == "AGENT"
    assert _attribute(root, "input.mime_type") == "text/plain"
    assert _attribute(root, "output.mime_type") == "text/plain"
    assert _attribute(root, "input.value")
    assert _attribute(root, "output.value")


def test_coding_agent_records_stateful_failure_edit_and_passing_rerun(
    tmp_path: Path,
) -> None:
    edited_tools = local_tools("coding_agent")
    edited_tools.invoke(
        "edit_file",
        {"path": "README.md", "old": "Router.dispatch", "new": "Router.route"},
    )
    assert edited_tools.invoke("run_tests", {"test": "tests/test_readme.py"})["passed"] is True
    fresh_tools = local_tools("coding_agent")
    assert fresh_tools.invoke("run_tests", {"test": "tests/test_readme.py"})["passed"] is False

    fixtures = tuple(fixture for fixture in load_fixtures() if fixture.domain == "coding_agent")

    fragments = record(tmp_path, fixtures=fixtures)

    assert {fragment["fragment_id"] for fragment in fragments} == {
        "coding-router-api-tools",
        "coding-retry-policy-tools",
    }
    spans = _spans(tmp_path / "traces.jsonl")
    tool_spans = [span for span in spans if _attribute(span, "openinference.span.kind") == "TOOL"]
    assert len(tool_spans) == 24
    assert {_attribute(span, "session.id") for span in tool_spans} == {
        "coding-router-api-tools",
        "coding-retry-policy-tools",
    }
    assert {span["name"] for span in tool_spans} == {
        "edit_file",
        "read_file",
        "record_lookup",
        "repository_search",
        "run_tests",
    }
    assert (
        sum(span.get("status", {}).get("code") == "STATUS_CODE_ERROR" for span in tool_spans) == 2
    )
    outputs = [str(_attribute(span, "output.value")) for span in tool_spans]
    assert sum('"passed": false' in output for output in outputs) == 2
    assert sum('"passed": true' in output for output in outputs) == 2
    assert sum('"changed": true' in output for output in outputs) == 2
    assert sum('"has_more": true' in output for output in outputs) >= 4


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
