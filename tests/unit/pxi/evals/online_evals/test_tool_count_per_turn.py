from __future__ import annotations

import asyncio
from typing import Any

import pytest
from phoenix.client.__generated__ import v1

from evals.pxi.online_evals.evaluators.tool_count_per_turn import (
    TOOL_COUNT_PER_TURN,
    evaluate_tool_count_per_turn,
)
from evals.pxi.online_evals.topology import InvalidTurnTrace


def _evaluate(root: v1.Span, spans: list[v1.Span]) -> Any:
    return asyncio.run(evaluate_tool_count_per_turn(root, spans))


def _span(
    span_id: str,
    *,
    name: str,
    kind: str,
    parent_id: str | None,
    start: int,
    status: str = "OK",
    attributes: dict[str, Any] | None = None,
) -> v1.Span:
    span: v1.Span = {
        "name": name,
        "context": {"trace_id": "trace-1", "span_id": span_id},
        "span_kind": kind,
        "start_time": f"2026-07-09T00:00:{start:02d}+00:00",
        "end_time": f"2026-07-09T00:00:{start + 1:02d}+00:00",
        "status_code": status,
    }
    if parent_id is not None:
        span["parent_id"] = parent_id
    if attributes is not None:
        span["attributes"] = attributes
    return span


def test_counts_browser_and_server_tools_but_not_subagent_tools() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)
    model = _span("model", name="model", kind="LLM", parent_id="root", start=1)
    browser_tool = _span(
        "browser-tool",
        name="set_spans_filter",
        kind="TOOL",
        parent_id="root",
        start=2,
        attributes={"tool.name": "set_spans_filter"},
    )
    server_tool = _span("server-tool", name="bash", kind="TOOL", parent_id="model", start=3)
    errored_tool = _span(
        "errored-tool",
        name="read_skill_resource",
        kind="TOOL",
        parent_id="root",
        start=4,
        status="ERROR",
    )
    call_subagent = _span(
        "call-subagent", name="call_subagent", kind="TOOL", parent_id="root", start=5
    )
    subagent = _span(
        "subagent", name="ServerAgent.iter", kind="AGENT", parent_id="call-subagent", start=6
    )
    nested_tool = _span(
        "nested-tool", name="query_phoenix", kind="TOOL", parent_id="subagent", start=7
    )

    result = _evaluate(
        root,
        [
            root,
            model,
            browser_tool,
            server_tool,
            errored_tool,
            call_subagent,
            subagent,
            nested_tool,
        ],
    )

    assert result.score == 4.0
    assert result.metadata == {
        "tool_names": ["set_spans_filter", "bash", "read_skill_resource", "call_subagent"]
    }
    assert TOOL_COUNT_PER_TURN.annotator_kind == "CODE"
    assert TOOL_COUNT_PER_TURN.sample_rate == 1.0


def test_rejects_incomplete_parent_chain() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)
    tool = _span("tool", name="bash", kind="TOOL", parent_id="missing", start=1)

    with pytest.raises(InvalidTurnTrace, match="missing ancestor"):
        _evaluate(root, [root, tool])


def test_zero_tool_trace_has_zero_score() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)

    result = _evaluate(root, [root])

    assert result.score == 0.0
    assert result.metadata == {"tool_names": []}
    assert result.explanation == "0 top-level PXI tool calls in this turn"


def test_rejects_a_non_root_turn_span() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id="parent", start=0)

    with pytest.raises(InvalidTurnTrace, match="span root is not a 'pxi.turn' root"):
        _evaluate(root, [root])


def test_rejects_a_trace_that_omits_the_turn_root() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)

    with pytest.raises(InvalidTurnTrace, match="trace does not contain turn root root"):
        _evaluate(root, [])


def test_rejects_a_detached_tool() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)
    tool = _span("tool", name="bash", kind="TOOL", parent_id=None, start=1)

    with pytest.raises(
        InvalidTurnTrace,
        match="tool span tool does not descend from turn root root",
    ):
        _evaluate(root, [root, tool])


def test_rejects_an_ancestor_cycle() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)
    first = _span("first", name="agent", kind="AGENT", parent_id="second", start=1)
    second = _span("second", name="model", kind="LLM", parent_id="first", start=2)
    tool = _span("tool", name="bash", kind="TOOL", parent_id="first", start=3)

    with pytest.raises(InvalidTurnTrace, match="cycle found above tool span tool"):
        _evaluate(root, [root, first, second, tool])
