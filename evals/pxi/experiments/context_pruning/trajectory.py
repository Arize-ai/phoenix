from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, Callable, Mapping

from evals.pxi.harness.agent_task import run_pxi_example

ToolReturnFactory = Callable[[dict[str, Any]], str]


@dataclass(frozen=True)
class FixtureToolExecutor:
    """Canned executor for PXI deferred tool calls in Type-C harness runs."""

    returns_by_tool: Mapping[str, str | ToolReturnFactory]
    default_return: str = "Fixture tool execution completed."

    def execute(self, call: dict[str, Any]) -> str:
        tool_name = str(call.get("tool_name") or call.get("name") or "")
        value = self.returns_by_tool.get(tool_name, self.default_return)
        return value(call) if callable(value) else value


def _tool_calls_from_output(output: dict[str, Any]) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    for message in output.get("messages") or []:
        if not isinstance(message, dict):
            continue
        for part in message.get("parts") or []:
            if isinstance(part, dict) and part.get("part_kind") == "tool-call":
                calls.append(part)
    return calls


def _assistant_turn_from_output(output: dict[str, Any]) -> dict[str, Any] | None:
    content_parts: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    for message in output.get("messages") or []:
        if not isinstance(message, dict):
            continue
        for part in message.get("parts") or []:
            if not isinstance(part, dict):
                continue
            if part.get("part_kind") == "text" and isinstance(part.get("content"), str):
                content_parts.append(str(part["content"]))
            if part.get("part_kind") == "tool-call":
                tool_calls.append(
                    {
                        "id": str(part["tool_call_id"]),
                        "name": str(part["tool_name"]),
                        "args": part.get("args", {}),
                    }
                )
    if not content_parts and not tool_calls:
        return None
    turn: dict[str, Any] = {"role": "assistant"}
    if content_parts:
        turn["content"] = "\n".join(content_parts)
    if tool_calls:
        turn["tool_calls"] = tool_calls
    return turn


def _append_tool_continuation(
    messages: list[dict[str, Any]],
    output: dict[str, Any],
    executor: FixtureToolExecutor,
) -> bool:
    assistant_turn = _assistant_turn_from_output(output)
    if assistant_turn is None:
        return False
    calls = assistant_turn.get("tool_calls")
    if not isinstance(calls, list) or not calls:
        return False
    messages.append(assistant_turn)
    for call in calls:
        messages.append(
            {
                "role": "tool",
                "tool_call_id": call["id"],
                "name": call["name"],
                "content": executor.execute(
                    {
                        "tool_call_id": call["id"],
                        "tool_name": call["name"],
                        "args": call.get("args", {}),
                    }
                ),
            }
        )
    return True


def _add_usage(left: dict[str, int], right: Mapping[str, Any] | None) -> dict[str, int]:
    totals = dict(left)
    for key in ("input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens"):
        totals[key] = int(totals.get(key, 0)) + int((right or {}).get(key, 0) or 0)
    return totals


async def run_fixture_trajectory(
    input_value: dict[str, Any],
    *,
    executor: FixtureToolExecutor,
    max_steps: int = 6,
    stable_example_id: str | None = None,
) -> dict[str, Any]:
    """Run a PXI trajectory by satisfying deferred tool calls with fixtures.

    The first step uses the supplied dataset input. If PXI emits deferred
    tool calls, the calls are appended to the transcript with fixture-backed
    tool returns and the same task path is resumed with a trailing tool turn.
    """

    if max_steps < 1:
        raise ValueError("max_steps must be >= 1")
    messages = copy.deepcopy(input_value.get("messages"))
    if not isinstance(messages, list) or not messages:
        raise ValueError("trajectory input.messages must be a non-empty list")

    steps: list[dict[str, Any]] = []
    usage = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_write_tokens": 0,
    }
    policy_usage = dict(usage)
    latency_ms = 0
    final_output: dict[str, Any] | None = None

    for step_index in range(max_steps):
        step_output = await run_pxi_example(
            {**input_value, "messages": messages},
            stable_example_id=stable_example_id,
        )
        steps.append(step_output)
        usage = _add_usage(usage, step_output.get("usage"))
        policy_usage = _add_usage(policy_usage, step_output.get("policy_usage"))
        latency_ms += int(step_output.get("latency_ms", 0) or 0)
        if step_output.get("error"):
            final_output = step_output
            break
        if not _append_tool_continuation(messages, step_output, executor):
            final_output = step_output
            break
    else:
        final_output = steps[-1]

    assert final_output is not None
    return {
        **final_output,
        "trajectory_steps": steps,
        "trajectory_step_count": len(steps),
        "trajectory_completed": not _tool_calls_from_output(final_output),
        "usage": usage,
        "policy_usage": policy_usage,
        "latency_ms": latency_ms,
    }
