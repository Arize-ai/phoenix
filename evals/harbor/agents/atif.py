"""Convert a PXI turn's UI messages, timed and metered by its spans, into an ATIF trajectory."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
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
TurnSpan = dict[str, Any]
"""One trimmed span record as ``chat_client.py`` saves it: ``span_id``, ``parent_id``,
``name``, ``kind``, ``start_time``, ``end_time``, ``tool_call_id`` (tool spans),
``output_tool_call_ids`` (LLM spans), and ``token_counts``."""

LLM_LATENCY_MS_KEY = "llm_latency_ms"

_TOOL_PREFIX = "tool-"
_RESULT_STATES = {"output-available", "output-error", "output-denied"}


def trajectory_from_ui_messages(
    messages: list[Message],
    *,
    session_id: str | None,
    agent_name: str,
    agent_version: str,
    model_name: str | None,
    spans: list[TurnSpan] | None = None,
) -> Trajectory:
    index = _SpanIndex.build(spans or [])
    steps: list[Step] = []
    for position, message in enumerate(messages):
        role = message.get("role")
        if role == "user":
            steps.append(
                Step(
                    step_id=len(steps) + 1,
                    source="user",
                    message=_text(message["parts"]),
                    timestamp=_turn_started_at(messages, position) or _timestamp(message),
                )
            )
        elif role == "assistant":
            steps.extend(_assistant_steps(message, first_step_id=len(steps) + 1, index=index))
    if not steps:
        raise ValueError("the transcript holds no user or assistant messages")
    return Trajectory(
        session_id=session_id,
        agent=Agent(name=agent_name, version=agent_version, model_name=model_name),
        steps=steps,
        final_metrics=_final_metrics(steps),
    )


def final_reply(trajectory: Trajectory) -> str:
    for step in reversed(trajectory.steps):
        if step.source == "agent" and isinstance(step.message, str) and step.message:
            return step.message
    return ""


def llm_latencies_ms(trajectory: Trajectory) -> list[float] | None:
    """The matched LLM latency of every agent step, in order, or ``None`` if any is missing.

    The Phoenix Harbor plugin applies the list positionally to the trajectory's LLM
    steps and ignores it when the counts differ, so a partial list is worth nothing.
    """
    latencies: list[float] = []
    for step in trajectory.steps:
        if step.source != "agent":
            continue
        value = (step.extra or {}).get(LLM_LATENCY_MS_KEY)
        if not isinstance(value, (int, float)):
            return None
        latencies.append(float(value))
    return latencies or None


@dataclass
class _SpanIndex:
    tool_spans: dict[str, TurnSpan] = field(default_factory=dict)
    llm_by_output_tool_id: dict[str, TurnSpan] = field(default_factory=dict)
    text_only_llm_spans: list[TurnSpan] = field(default_factory=list)
    _next_text_only: int = 0

    @classmethod
    def build(cls, spans: list[TurnSpan]) -> _SpanIndex:
        index = cls()
        for span in sorted(spans, key=lambda s: str(s.get("start_time") or "")):
            kind = span.get("kind")
            if kind == "TOOL" and span.get("tool_call_id"):
                index.tool_spans[str(span["tool_call_id"])] = span
            elif kind == "LLM":
                output_ids = [str(i) for i in span.get("output_tool_call_ids") or []]
                if output_ids:
                    for tool_call_id in output_ids:
                        index.llm_by_output_tool_id[tool_call_id] = span
                else:
                    index.text_only_llm_spans.append(span)
        return index

    def llm_span_for(self, tool_calls: list[ToolCall]) -> TurnSpan | None:
        if tool_calls:
            for call in tool_calls:
                if (span := self.llm_by_output_tool_id.get(call.tool_call_id)) is not None:
                    return span
            return None
        if self._next_text_only < len(self.text_only_llm_spans):
            span = self.text_only_llm_spans[self._next_text_only]
            self._next_text_only += 1
            return span
        return None


def _assistant_steps(message: Message, *, first_step_id: int, index: _SpanIndex) -> list[Step]:
    message_timestamp = _timestamp(message)
    steps: list[Step] = []
    for segment in _llm_call_segments(message["parts"]):
        tool_parts = [part for part in segment if _is_tool_part(part)]
        text = _text(segment)
        reasoning = _reasoning(segment)
        if not (text or reasoning or tool_parts):
            continue
        tool_calls = [_tool_call(part) for part in tool_parts]
        step = Step(
            step_id=first_step_id + len(steps),
            source="agent",
            message=text,
            reasoning_content=reasoning or None,
            tool_calls=tool_calls or None,
            observation=_observation(tool_parts),
            timestamp=message_timestamp,
            llm_call_count=1,
        )
        _apply_spans(step, index)
        steps.append(step)
    if steps and steps[-1].metrics is None and (metrics := _message_metrics(message)) is not None:
        steps[-1].metrics = metrics
    return steps


def _apply_spans(step: Step, index: _SpanIndex) -> None:
    """A step happened when its tool results were observed, or when the LLM call
    finished if it called no tool."""
    llm_span = index.llm_span_for(step.tool_calls or [])
    tool_spans = [
        span
        for call in step.tool_calls or []
        if (span := index.tool_spans.get(call.tool_call_id)) is not None
    ]
    ends = [str(span["end_time"]) for span in tool_spans if span.get("end_time")]
    if llm_span is not None and llm_span.get("end_time"):
        ends.append(str(llm_span["end_time"]))
    if ends:
        step.timestamp = max(ends, key=_parse_timestamp)
    if llm_span is None:
        return
    step.metrics = _span_metrics(llm_span)
    if (latency_ms := _duration_ms(llm_span)) is not None:
        step.extra = {**(step.extra or {}), LLM_LATENCY_MS_KEY: latency_ms}


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


def _turn_started_at(messages: list[Message], user_position: int) -> str | None:
    """When the turn a user message opened started serving, from the reply's metadata."""
    for message in messages[user_position + 1 :]:
        if message.get("role") == "user":
            return None
        if message.get("role") == "assistant":
            context = ((message.get("metadata") or {}).get("phoenix") or {}).get(
                "turnTraceContext"
            ) or {}
            started_at = context.get("startedAt")
            return str(started_at) if started_at else None
    return None


def _message_metrics(message: Message) -> Metrics | None:
    """The turn's usage as the server reports it on the message: the last LLM call's."""
    metadata = message.get("metadata") or {}
    usage = (metadata.get("phoenix") or {}).get("usage")
    if not isinstance(usage, dict):
        return None
    tokens = usage.get("tokens") or {}
    prompt_details = usage.get("promptDetails") or {}
    return _metrics(
        prompt=tokens.get("prompt"),
        completion=tokens.get("completion"),
        cache_read=prompt_details.get("cacheRead"),
        cache_write=prompt_details.get("cacheWrite"),
    )


def _span_metrics(span: TurnSpan) -> Metrics | None:
    counts = span.get("token_counts") or {}
    if not isinstance(counts, dict):
        return None
    return _metrics(
        prompt=counts.get("prompt"),
        completion=counts.get("completion"),
        cache_read=counts.get("cache_read"),
        cache_write=counts.get("cache_write"),
    )


def _metrics(*, prompt: Any, completion: Any, cache_read: Any, cache_write: Any) -> Metrics | None:
    if not any(isinstance(v, int) for v in (prompt, completion, cache_read, cache_write)):
        return None
    return Metrics(
        prompt_tokens=prompt if isinstance(prompt, int) else None,
        completion_tokens=completion if isinstance(completion, int) else None,
        cached_tokens=cache_read if isinstance(cache_read, int) else None,
        extra={"cache_write_tokens": cache_write} if isinstance(cache_write, int) else None,
    )


def _duration_ms(span: TurnSpan) -> float | None:
    start, end = span.get("start_time"), span.get("end_time")
    if not start or not end:
        return None
    seconds = (_parse_timestamp(str(end)) - _parse_timestamp(str(start))).total_seconds()
    return max(0.0, seconds * 1000.0)


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


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
