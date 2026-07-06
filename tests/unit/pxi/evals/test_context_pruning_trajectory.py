from __future__ import annotations

from typing import Any

import pytest

from evals.pxi.experiments.context_pruning import trajectory
from evals.pxi.experiments.context_pruning.trajectory import (
    FixtureToolExecutor,
    run_fixture_trajectory,
)


def _usage(input_tokens: int) -> dict[str, int]:
    return {
        "input_tokens": input_tokens,
        "output_tokens": 1,
        "cache_read_tokens": 2,
        "cache_write_tokens": 3,
    }


@pytest.mark.asyncio
async def test_fixture_trajectory_resumes_after_tool_return(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen_messages: list[list[dict[str, Any]]] = []

    async def fake_run(input_value: dict[str, Any], **_: Any) -> dict[str, Any]:
        seen_messages.append(input_value["messages"])
        if len(seen_messages) == 1:
            return {
                "assistant_text": None,
                "messages": [
                    {
                        "parts": [
                            {
                                "part_kind": "tool-call",
                                "tool_name": "set_spans_filter",
                                "tool_call_id": "call-1",
                                "args": {"condition": "span_kind == 'LLM'"},
                            }
                        ]
                    }
                ],
                "usage": _usage(10),
                "policy_usage": _usage(1),
                "latency_ms": 100,
            }
        return {
            "assistant_text": "done",
            "messages": [{"parts": [{"part_kind": "text", "content": "done"}]}],
            "usage": _usage(20),
            "policy_usage": _usage(2),
            "latency_ms": 200,
        }

    monkeypatch.setattr(trajectory, "run_pxi_example", fake_run)

    output = await run_fixture_trajectory(
        {"messages": [{"role": "user", "content": "show llm spans"}]},
        executor=FixtureToolExecutor({"set_spans_filter": "filter applied"}),
    )

    assert output["trajectory_completed"] is True
    assert output["trajectory_step_count"] == 2
    assert output["usage"]["input_tokens"] == 30
    assert output["policy_usage"]["input_tokens"] == 3
    assert output["latency_ms"] == 300
    assert seen_messages[1][-2:] == [
        {
            "role": "assistant",
            "tool_calls": [
                {
                    "id": "call-1",
                    "name": "set_spans_filter",
                    "args": {"condition": "span_kind == 'LLM'"},
                }
            ],
        },
        {
            "role": "tool",
            "tool_call_id": "call-1",
            "name": "set_spans_filter",
            "content": "filter applied",
        },
    ]


@pytest.mark.asyncio
async def test_fixture_trajectory_stops_at_step_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_run(input_value: dict[str, Any], **_: Any) -> dict[str, Any]:
        step = len(input_value["messages"])
        return {
            "assistant_text": None,
            "messages": [
                {
                    "parts": [
                        {
                            "part_kind": "tool-call",
                            "tool_name": "bash",
                            "tool_call_id": f"call-{step}",
                            "args": {"command": "echo ok"},
                        }
                    ]
                }
            ],
            "usage": _usage(1),
            "policy_usage": _usage(0),
            "latency_ms": 1,
        }

    monkeypatch.setattr(trajectory, "run_pxi_example", fake_run)

    output = await run_fixture_trajectory(
        {"messages": [{"role": "user", "content": "loop"}]},
        executor=FixtureToolExecutor({"bash": "ok"}),
        max_steps=2,
    )

    assert output["trajectory_completed"] is False
    assert output["trajectory_step_count"] == 2


@pytest.mark.asyncio
async def test_fixture_trajectory_rejects_invalid_step_cap() -> None:
    with pytest.raises(ValueError, match="max_steps"):
        await run_fixture_trajectory(
            {"messages": [{"role": "user", "content": "x"}]},
            executor=FixtureToolExecutor({}),
            max_steps=0,
        )
