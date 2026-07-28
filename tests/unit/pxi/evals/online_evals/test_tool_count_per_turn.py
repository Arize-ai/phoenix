from __future__ import annotations

import asyncio
from typing import Any

import pytest

from evals.pxi.online_evals.evaluators.tool_count_per_turn import (
    TOOL_COUNT_PER_TURN,
    evaluate_tool_count_per_turn,
)
from evals.pxi.online_evals.topology import InvalidTurnTrace, classify_tool_spans
from phoenix.client.__generated__ import v1


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


def test_counts_subagent_tools() -> None:
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

    assert result.score == 5.0
    assert result.metadata == {
        "tool_names": [
            "set_spans_filter",
            "bash",
            "read_skill_resource",
            "call_subagent",
            "query_phoenix",
        ],
        "top_level_tool_names": [
            "set_spans_filter",
            "bash",
            "read_skill_resource",
            "call_subagent",
        ],
        "nested_tool_names": ["query_phoenix"],
        "nested_tool_count": 1,
        "subagent_call_count": 1,
    }
    assert result.explanation == "5 tool calls in this turn (4 top-level, 1 nested)"
    assert TOOL_COUNT_PER_TURN.annotator_kind == "CODE"
    assert TOOL_COUNT_PER_TURN.sample_rate == 1.0
    assert TOOL_COUNT_PER_TURN.identifier == "pxi-online-evals:tool-count-per-turn:v2"


def test_counts_tools_from_sibling_subagents() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)
    first_call = _span("first-call", name="call_subagent", kind="TOOL", parent_id="root", start=1)
    first_agent = _span("first-agent", name="agent", kind="AGENT", parent_id="first-call", start=2)
    first_tool = _span("first-tool", name="bash", kind="TOOL", parent_id="first-agent", start=3)
    second_call = _span("second-call", name="call_subagent", kind="TOOL", parent_id="root", start=4)
    second_agent = _span(
        "second-agent", name="agent", kind="AGENT", parent_id="second-call", start=5
    )
    second_tool = _span(
        "second-tool", name="query_phoenix", kind="TOOL", parent_id="second-agent", start=6
    )

    result = _evaluate(
        root,
        [root, first_call, first_agent, first_tool, second_call, second_agent, second_tool],
    )

    assert result.score == 4.0
    assert result.metadata == {
        "tool_names": ["call_subagent", "bash", "call_subagent", "query_phoenix"],
        "top_level_tool_names": ["call_subagent", "call_subagent"],
        "nested_tool_names": ["bash", "query_phoenix"],
        "nested_tool_count": 2,
        "subagent_call_count": 2,
    }


def test_counts_tools_nested_multiple_levels_deep() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)
    outer_tool = _span("outer", name="delegate", kind="TOOL", parent_id="root", start=1)
    outer_agent = _span("outer-agent", name="agent", kind="AGENT", parent_id="outer", start=2)
    inner_tool = _span("inner", name="delegate", kind="TOOL", parent_id="outer-agent", start=3)
    inner_agent = _span("inner-agent", name="agent", kind="AGENT", parent_id="inner", start=4)
    leaf_tool = _span("leaf", name="bash", kind="TOOL", parent_id="inner-agent", start=5)

    result = _evaluate(
        root,
        [root, outer_tool, outer_agent, inner_tool, inner_agent, leaf_tool],
    )

    assert result.score == 3.0
    assert result.metadata["top_level_tool_names"] == ["delegate"]
    assert result.metadata["nested_tool_names"] == ["delegate", "bash"]
    assert result.metadata["subagent_call_count"] == 0


def test_counts_subagent_call_without_nested_tools() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)
    call = _span("call", name="call_subagent", kind="TOOL", parent_id="root", start=1)
    agent = _span("agent", name="agent", kind="AGENT", parent_id="call", start=2)

    result = _evaluate(root, [root, call, agent])

    assert result.score == 1.0
    assert result.explanation == "1 tool call in this turn"
    assert result.metadata["nested_tool_count"] == 0
    assert result.metadata["subagent_call_count"] == 1


def test_counts_nested_error_status_tool() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)
    call = _span("call", name="call_subagent", kind="TOOL", parent_id="root", start=1)
    nested = _span(
        "nested", name="query_phoenix", kind="TOOL", parent_id="call", start=2, status="ERROR"
    )

    result = _evaluate(root, [root, call, nested])

    assert result.score == 2.0
    assert result.metadata["nested_tool_names"] == ["query_phoenix"]


def test_tool_names_are_chronologically_interleaved() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)
    call = _span("call", name="call_subagent", kind="TOOL", parent_id="root", start=1)
    nested = _span("nested", name="nested", kind="TOOL", parent_id="call", start=2)
    later_top_level = _span("later", name="later_top_level", kind="TOOL", parent_id="root", start=3)

    result = _evaluate(root, [later_top_level, nested, root, call])

    assert result.metadata["tool_names"] == ["call_subagent", "nested", "later_top_level"]


def test_classifies_tool_span_partition() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)
    top_level = _span("top", name="call_subagent", kind="TOOL", parent_id="root", start=1)
    agent = _span("agent", name="agent", kind="AGENT", parent_id="top", start=2)
    nested = _span("nested", name="bash", kind="TOOL", parent_id="agent", start=3)
    sibling = _span("sibling", name="ask_user", kind="TOOL", parent_id="root", start=4)

    breakdown = classify_tool_spans(root, [sibling, nested, agent, root, top_level])

    assert [span["name"] for span in breakdown.all_tools] == [
        "call_subagent",
        "bash",
        "ask_user",
    ]
    assert [span["name"] for span in breakdown.top_level] == ["call_subagent", "ask_user"]
    assert [span["name"] for span in breakdown.nested] == ["bash"]
    assert len(breakdown.all_tools) == len(breakdown.top_level) + len(breakdown.nested)
    assert {id(span) for span in breakdown.top_level}.isdisjoint(
        id(span) for span in breakdown.nested
    )


def test_rejects_incomplete_parent_chain() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)
    tool = _span("tool", name="bash", kind="TOOL", parent_id="missing", start=1)

    with pytest.raises(InvalidTurnTrace, match="missing ancestor"):
        _evaluate(root, [root, tool])


def test_zero_tool_trace_has_zero_score() -> None:
    root = _span("root", name="pxi.turn", kind="AGENT", parent_id=None, start=0)

    result = _evaluate(root, [root])

    assert result.score == 0.0
    assert result.metadata == {
        "tool_names": [],
        "top_level_tool_names": [],
        "nested_tool_names": [],
        "nested_tool_count": 0,
        "subagent_call_count": 0,
    }
    assert result.explanation == "0 tool calls in this turn"


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
