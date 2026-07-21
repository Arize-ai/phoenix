"""Regression tests over a sanitized real ``pxi_dev`` turn trace.

The fixture is a real July-2026 ``pxi.turn`` trace topology (18 spans: AGENT
root, 9 LLM spans, 8 top-level TOOL spans including one ERROR) with every
piece of free text replaced by short synthetic equivalents. It captures the
current tracing format end to end: flattened dotted message attributes,
tool_call/tool-result pairing, a two-human-turn conversation history in the
last LLM span, and a failed-then-retried tool call.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest import mock

from phoenix.client.__generated__ import v1

from evals.pxi.online_evals.conversation import segment_turns, transcript
from evals.pxi.online_evals.evaluators import user_friction
from evals.pxi.online_evals.evaluators.tool_count_per_turn import evaluate_tool_count_per_turn

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "pxi_turn_trace.json"


def _load_trace() -> tuple[v1.Span, list[v1.Span]]:
    spans: list[v1.Span] = json.loads(FIXTURE_PATH.read_text())
    return spans[0], spans


def test_fixture_topology() -> None:
    root, spans = _load_trace()
    assert root["name"] == "pxi.turn"
    assert root["span_kind"] == "AGENT"
    assert root.get("parent_id") is None
    assert len(spans) == 18
    assert all(span["parent_id"] == "s01" for span in spans[1:])


def test_tool_count_per_turn_on_real_trace() -> None:
    root, spans = _load_trace()
    result = asyncio.run(evaluate_tool_count_per_turn(root, spans))
    assert result.score == 8.0
    assert result.metadata["tool_names"] == [
        "list_datasets",
        "list_datasets",
        "ask_user",
        "create_dataset",
        "add_spans_to_dataset",
        "bash",
        "add_spans_to_dataset",
        "get_route_info",
    ]


def test_transcript_reconstruction_on_real_trace() -> None:
    _, spans = _load_trace()
    turns = segment_turns(transcript(spans))
    assert [turn.user_message for turn in turns] == [
        "what happened in this trace?",
        "can you save this trace to a dataset?",
    ]
    # The target turn pairs each assistant tool_call with a role="tool" result.
    target = turns[-1]
    assert [call["name"] for call in target.tool_calls] == [
        "list_datasets",
        "list_datasets",
        "ask_user",
        "create_dataset",
        "add_spans_to_dataset",
        "bash",
        "add_spans_to_dataset",
        "get_route_info",
    ]
    tool_results = [msg for msg in target.messages if msg.role == "tool"]
    assert len(tool_results) == len(target.tool_calls)


def test_user_friction_on_real_trace() -> None:
    root, spans = _load_trace()
    assert user_friction._judge_inputs(root, spans) is not None

    score = mock.Mock(score=0.0, label="no_friction", explanation="ok")
    judge = mock.Mock()
    judge.async_evaluate = mock.AsyncMock(return_value=[score])
    with mock.patch.object(user_friction, "_judge", return_value=judge):
        result = asyncio.run(user_friction.evaluate_user_friction(root, spans))
    assert result is score
    judge.async_evaluate.assert_awaited_once()
    eval_input = judge.async_evaluate.call_args.args[0]
    assert eval_input["user_message"] == "can you save this trace to a dataset?"
    conversation = eval_input["conversation"]
    assert "### User" in conversation
    assert "> Tool:" in conversation  # detailed tier for the turn being reacted to
