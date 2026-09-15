"""Convert a Phoenix agent-session transcript into a Harbor ATIF trajectory.

The chat route returns Vercel AI SDK UI messages: each message has a ``role`` and a
list of ``parts``. An assistant message holds one ``step-start`` part per LLM call,
followed by that call's ``reasoning``, ``text``, and ``tool-<name>`` parts, so each
run of parts between two ``step-start`` markers becomes one ATIF agent step.
"""

from __future__ import annotations

import json
from typing import Any

from harbor.models.trajectories.agent import Agent
from harbor.models.trajectories.final_metrics import FinalMetrics
from harbor.models.trajectories.metrics import Metrics
from harbor.models.trajectories.observation import Observation
from harbor.models.trajectories.observation_result import ObservationResult
from harbor.models.trajectories.step import Step
from harbor.models.trajectories.tool_call import ToolCall
from harbor.models.trajectories.trajectory import Trajectory

Message = dict[str, Any]
Part = dict[str, Any]

_TOOL_PREFIX = "tool-"
_RESULT_STATES = {"output-available", "output-error", "output-denied"}


def trajectory_from_ui_messages(
    messages: list[Message],
    *,
    session_id: str | None,
    agent_name: str,
    agent_version: str,
    model_name: str | None,
) -> Trajectory:
    steps: list[Step] = []
    for message in messages:
        role = message.get("role")
        if role == "user":
            steps.append(
                Step(
                    step_id=len(steps) + 1,
                    source="user",
                    message=_text(message["parts"]),
                    timestamp=_timestamp(message),
                )
            )
        elif role == "assistant":
            steps.extend(_assistant_steps(message, first_step_id=len(steps) + 1))
    if not steps:
        raise ValueError("the transcript holds no user or assistant messages")
    return Trajectory(
        session_id=session_id,
        agent=Agent(name=agent_name, version=agent_version, model_name=model_name),
        steps=steps,
        final_metrics=_final_metrics(steps),
    )


def final_reply(trajectory: Trajectory) -> str:
    """The text of the last agent step that said anything."""
    for step in reversed(trajectory.steps):
        if step.source == "agent" and isinstance(step.message, str) and step.message:
            return step.message
    return ""


def _assistant_steps(message: Message, *, first_step_id: int) -> list[Step]:
    timestamp = _timestamp(message)
    steps: list[Step] = []
    for segment in _llm_call_segments(message["parts"]):
        tool_parts = [part for part in segment if _is_tool_part(part)]
        text = _text(segment)
        reasoning = _reasoning(segment)
        if not (text or reasoning or tool_parts):
            continue
        steps.append(
            Step(
                step_id=first_step_id + len(steps),
                source="agent",
                message=text,
                reasoning_content=reasoning or None,
                tool_calls=[_tool_call(part) for part in tool_parts] or None,
                observation=_observation(tool_parts),
                timestamp=timestamp,
            )
        )
    if steps and (metrics := _metrics(message)) is not None:
        steps[-1].metrics = metrics
        steps[-1].llm_call_count = len(steps)
    return steps


def _llm_call_segments(parts: list[Part]) -> list[list[Part]]:
    segments: list[list[Part]] = [[]]
    for part in parts:
        if part.get("type") == "step-start":
            segments.append([])
        else:
            segments[-1].append(part)
    return segments


def _is_tool_part(part: Part) -> bool:
    part_type = str(part.get("type", ""))
    return part_type.startswith(_TOOL_PREFIX) or part_type == "dynamic-tool"


def _tool_name(part: Part) -> str:
    part_type = str(part["type"])
    if part_type == "dynamic-tool":
        return str(part.get("toolName", ""))
    return part_type[len(_TOOL_PREFIX) :]


def _tool_call(part: Part) -> ToolCall:
    arguments = part.get("input")
    return ToolCall(
        tool_call_id=str(part["toolCallId"]),
        function_name=_tool_name(part),
        arguments=arguments if isinstance(arguments, dict) else {"input": arguments},
    )


def _observation(tool_parts: list[Part]) -> Observation | None:
    results = [
        _observation_result(part) for part in tool_parts if part.get("state") in _RESULT_STATES
    ]
    return Observation(results=results) if results else None


def _observation_result(part: Part) -> ObservationResult:
    state = str(part["state"])
    if state == "output-available":
        output = part.get("output")
        content = output if isinstance(output, str) else json.dumps(output)
        extra = None
    else:
        content = str(part.get("errorText") or state)
        extra = {"is_error": True, "state": state}
    return ObservationResult(source_call_id=str(part["toolCallId"]), content=content, extra=extra)


def _text(parts: list[Part]) -> str:
    return "".join(str(part.get("text", "")) for part in parts if part.get("type") == "text")


def _reasoning(parts: list[Part]) -> str:
    return "\n\n".join(
        text
        for part in parts
        if part.get("type") == "reasoning" and (text := str(part.get("text", "")))
    )


def _timestamp(message: Message) -> str | None:
    metadata = message.get("metadata") or {}
    timestamp = (metadata.get("pydantic_ai") or {}).get("timestamp")
    return str(timestamp) if timestamp else None


def _metrics(message: Message) -> Metrics | None:
    metadata = message.get("metadata") or {}
    usage = (metadata.get("phoenix") or {}).get("usage")
    if not isinstance(usage, dict):
        return None
    tokens = usage.get("tokens") or {}
    prompt_details = usage.get("promptDetails") or {}
    cache_write = prompt_details.get("cacheWrite")
    return Metrics(
        prompt_tokens=tokens.get("prompt"),
        completion_tokens=tokens.get("completion"),
        cached_tokens=prompt_details.get("cacheRead"),
        extra={"cache_write_tokens": cache_write} if cache_write is not None else None,
    )


def _final_metrics(steps: list[Step]) -> FinalMetrics:
    metrics = [step.metrics for step in steps if step.metrics is not None]

    def total(values: list[int | None]) -> int | None:
        present = [value for value in values if value is not None]
        return sum(present) if present else None

    return FinalMetrics(
        total_prompt_tokens=total([m.prompt_tokens for m in metrics]),
        total_completion_tokens=total([m.completion_tokens for m in metrics]),
        total_cached_tokens=total([m.cached_tokens for m in metrics]),
        total_steps=len(steps),
    )
