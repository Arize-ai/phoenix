from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest

pytest.importorskip("harbor")

from evals.harbor.agents.atif import (  # noqa: E402
    LLM_LATENCY_MS_KEY,
    final_reply,
    llm_latencies_ms,
    trajectory_from_ui_messages,
)

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def messages() -> list[dict[str, Any]]:
    return list(json.loads((FIXTURES / "pxi_open_coding_turn_messages.json").read_text()))


@pytest.fixture(scope="module")
def spans() -> list[dict[str, Any]]:
    return list(json.loads((FIXTURES / "pxi_open_coding_turn_spans.json").read_text()))


def _parse(value: str | None) -> datetime:
    assert value is not None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _build(messages: list[dict[str, Any]], spans: list[dict[str, Any]] | None) -> Any:
    return trajectory_from_ui_messages(
        messages,
        session_id="QWdlbnRTZXNzaW9uOjE=",
        agent_name="phoenix-chat-agent",
        agent_version="20.12.0",
        model_name="anthropic/claude-fable-5-1",
        spans=spans,
    )


def test_steps_follow_the_llm_calls(messages: list[dict[str, Any]]) -> None:
    trajectory = _build(messages, None)
    agent_steps = [step for step in trajectory.steps if step.source == "agent"]

    assert trajectory.steps[0].source == "user"
    assert trajectory.steps[0].message.startswith("Help me find issues in the project")
    assert len(agent_steps) == 16
    assert all(step.llm_call_count == 1 for step in agent_steps)
    assert sum(len(step.tool_calls or []) for step in agent_steps) == 16
    assert agent_steps[-1].tool_calls is None
    assert final_reply(trajectory).startswith("I read all 11 traces")


def test_without_spans_every_step_shares_the_message_timestamp(
    messages: list[dict[str, Any]],
) -> None:
    trajectory = _build(messages, None)
    agent_steps = [step for step in trajectory.steps if step.source == "agent"]

    assert trajectory.steps[0].timestamp == "2026-09-16T00:17:57.928705Z"
    assert {step.timestamp for step in agent_steps} == {"2026-09-16T00:20:50.981841Z"}
    assert [step.metrics for step in agent_steps[:-1]] == [None] * 15
    assert agent_steps[-1].metrics is not None
    assert agent_steps[-1].metrics.prompt_tokens == 57056
    assert llm_latencies_ms(trajectory) is None


def test_spans_time_each_step_from_its_tool_and_llm_spans(
    messages: list[dict[str, Any]], spans: list[dict[str, Any]]
) -> None:
    trajectory = _build(messages, spans)
    agent_steps = [step for step in trajectory.steps if step.source == "agent"]
    tool_end_by_call = {
        span["tool_call_id"]: span["end_time"] for span in spans if span["kind"] == "TOOL"
    }

    timestamps = [_parse(step.timestamp) for step in trajectory.steps]
    assert timestamps == sorted(timestamps)
    assert len({step.timestamp for step in agent_steps}) == 16
    for step in agent_steps[:-1]:
        assert step.tool_calls
        assert step.timestamp == max(
            (tool_end_by_call[call.tool_call_id] for call in step.tool_calls),
            key=_parse,
        )
    # The text-only final step ends when its LLM call did.
    assert agent_steps[-1].timestamp == "2026-09-16T00:21:20.409207+00:00"
    assert _parse(trajectory.steps[0].timestamp) < _parse(agent_steps[0].timestamp)


def test_spans_meter_each_step_and_the_turn(
    messages: list[dict[str, Any]], spans: list[dict[str, Any]]
) -> None:
    trajectory = _build(messages, spans)
    agent_steps = [step for step in trajectory.steps if step.source == "agent"]
    llm_spans = [span for span in spans if span["kind"] == "LLM"]

    assert all(step.metrics is not None for step in agent_steps)
    assert agent_steps[0].metrics is not None
    assert agent_steps[0].metrics.prompt_tokens == 10707
    assert agent_steps[-1].metrics is not None
    assert agent_steps[-1].metrics.completion_tokens == 1834
    assert agent_steps[-1].metrics.extra == {"cache_write_tokens": 1689}

    # The turn's totals sum the 16 matched calls, not the last call's usage, and leave
    # out the side call under pxi.turn that emitted a tool call the transcript never saw.
    transcript_call_ids = {
        call.tool_call_id for step in agent_steps for call in step.tool_calls or []
    }
    matched = [
        span
        for span in llm_spans
        if not span["output_tool_call_ids"]
        or transcript_call_ids.intersection(span["output_tool_call_ids"])
    ]
    assert len(matched) == 16
    assert len(llm_spans) == 17
    assert trajectory.final_metrics is not None
    assert trajectory.final_metrics.total_prompt_tokens == sum(
        span["token_counts"]["prompt"] for span in matched
    )
    assert trajectory.final_metrics.total_completion_tokens == sum(
        span["token_counts"]["completion"] for span in matched
    )
    assert trajectory.final_metrics.total_steps == 17


def test_llm_latencies_line_up_with_the_agent_steps(
    messages: list[dict[str, Any]], spans: list[dict[str, Any]]
) -> None:
    trajectory = _build(messages, spans)
    agent_steps = [step for step in trajectory.steps if step.source == "agent"]

    latencies = llm_latencies_ms(trajectory)
    assert latencies is not None
    assert len(latencies) == 16
    assert all(latency > 0 for latency in latencies)
    assert latencies == [(step.extra or {})[LLM_LATENCY_MS_KEY] for step in agent_steps]
    # The final reply took the longest: a 31.7 s call.
    assert latencies[-1] == pytest.approx(31712.8, abs=1)


def test_unmatched_spans_leave_the_message_timing_in_place(
    messages: list[dict[str, Any]], spans: list[dict[str, Any]]
) -> None:
    foreign = [
        {**span, "tool_call_id": "toolu_other", "output_tool_call_ids": []} for span in spans
    ]
    trajectory = _build(messages, foreign)
    agent_steps = [step for step in trajectory.steps if step.source == "agent"]

    # Every LLM span now looks text-only, so they are consumed in order by the one
    # text-only step and nothing else; tool-calling steps keep the message timestamp.
    assert agent_steps[0].timestamp == "2026-09-16T00:20:50.981841Z"
    assert agent_steps[0].metrics is None
    assert llm_latencies_ms(trajectory) is None


def test_extra_is_kept_at_the_trajectory_root(messages: list[dict[str, Any]]) -> None:
    seed = {"example": {"id": "x"}, "scoring": {"seeded_message_ids": ["m1"]}}
    trajectory = trajectory_from_ui_messages(
        messages,
        session_id="QWdlbnRTZXNzaW9uOjE=",
        agent_name="pxi-eval-agent",
        agent_version="20.12.0",
        model_name="openai/gpt-5.4",
        extra={"pxi": seed},
    )
    assert trajectory.to_json_dict()["extra"] == {"pxi": seed}
