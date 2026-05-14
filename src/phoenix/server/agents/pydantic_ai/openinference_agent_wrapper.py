from __future__ import annotations

from collections.abc import AsyncIterator, Iterator, Sequence
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
from typing import Any, Callable, TypeAlias

from openinference.instrumentation import (
    OITracer,
    TraceConfig,
    get_input_attributes,
    get_output_attributes,
    get_span_kind_attributes,
    safe_json_dumps,
)
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    SpanAttributes,
    ToolCallAttributes,
)
from opentelemetry.trace import Status, StatusCode, Tracer, TracerProvider
from pydantic_ai.agent.abstract import AbstractAgent
from pydantic_ai.agent.wrapper import WrapperAgent
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    ToolCallPart,
    ToolReturnPart,
    UserContent,
)
from pydantic_ai.output import OutputDataT
from pydantic_ai.run import AgentRun, AgentRunResult
from pydantic_ai.tools import AgentDepsT

from phoenix.server.agents.toolsets.external.tools import get_external_tool_definition

ToolCallId: TypeAlias = str


@dataclass(init=False)
class OpenInferenceAgentWrapper(WrapperAgent[AgentDepsT, OutputDataT]):
    """Pydantic-ai ``Agent`` wrapper that emits a single OpenInference ``AGENT`` span per turn.

    Overrides ``iter`` only — every other agent run entry point (``run``,
    ``run_sync``, ``run_stream``, ``run_stream_events``) ultimately delegates
    through ``iter`` in ``AbstractAgent``, so a single seam captures all
    execution paths.
    """

    _tracer: Tracer

    def __init__(
        self,
        wrapped: AbstractAgent[AgentDepsT, OutputDataT],
        *,
        tracer_provider: TracerProvider,
    ) -> None:
        super().__init__(wrapped)
        self._tracer = OITracer(
            tracer_provider.get_tracer(__name__),
            config=TraceConfig(),
        )

    @asynccontextmanager
    async def iter(
        self,
        user_prompt: str | Sequence[UserContent] | None = None,
        *,
        message_history: Sequence[ModelMessage] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[AgentRun[AgentDepsT, Any]]:
        with self._span(
            user_prompt=user_prompt,
            message_history=message_history,
            kwargs=kwargs,
        ) as set_result:
            # TODO(https://github.com/Arize-ai/phoenix/issues/13173): remove
            # once the frontend emits TOOL spans for external tools at
            # execution time. Until then, backfill TOOL spans for the
            # previous turn's external tool calls by replaying the trailing
            # tool returns in the inbound history.
            self._emit_resolved_external_tool_spans(message_history=message_history)
            async with super().iter(
                user_prompt, message_history=message_history, **kwargs
            ) as agent_run:
                yield agent_run
                set_result(agent_run.result)

    def _emit_resolved_external_tool_spans(
        self,
        *,
        message_history: Sequence[ModelMessage] | None,
    ) -> None:
        """Emit TOOL spans for external tools resolved since the previous turn.

        External tools are not instrumented at execution time. Their results
        arrive on trailing ``ModelRequest`` messages as ``ToolReturnPart``s —
        possibly alongside a fresh ``UserPromptPart`` when the user submits a
        new turn in the same request. Replay each such ``ToolReturnPart`` as
        a synthetic TOOL span parented to the current AGENT span.
        """
        if not message_history:
            return
        messages = list(message_history)
        trailing_tool_return_parts, first_trailing_request_index = (
            _collect_trailing_tool_return_parts(messages)
        )
        if not trailing_tool_return_parts:
            return
        tool_call_parts_by_call_id = _get_tool_call_parts_by_id(
            messages[:first_trailing_request_index]
        )
        for tool_return_part in trailing_tool_return_parts:
            matching_tool_call_part = tool_call_parts_by_call_id.get(tool_return_part.tool_call_id)
            self._emit_tool_span(
                tool_return_part=tool_return_part,
                tool_call_part=matching_tool_call_part,
            )

    def _emit_tool_span(
        self,
        *,
        tool_return_part: ToolReturnPart,
        tool_call_part: ToolCallPart | None,
    ) -> None:
        tool_arguments = tool_call_part.args_as_dict() if tool_call_part is not None else {}
        tool_name = tool_return_part.tool_name
        attributes: dict[str, Any] = {
            **get_span_kind_attributes("tool"),
            SpanAttributes.TOOL_NAME: tool_name,
            **get_input_attributes(tool_arguments, mime_type=OpenInferenceMimeTypeValues.JSON),
            **get_output_attributes(tool_return_part.content),
            ToolCallAttributes.TOOL_CALL_ID: tool_return_part.tool_call_id,
        }
        tool_def = get_external_tool_definition(tool_name)
        if tool_def is not None:
            attributes[SpanAttributes.TOOL_PARAMETERS] = safe_json_dumps(
                tool_def.parameters_json_schema
            )
            if tool_def.description is not None:
                attributes[SpanAttributes.TOOL_DESCRIPTION] = tool_def.description
        with self._tracer.start_as_current_span(name=tool_name, attributes=attributes) as span:
            outcome = tool_return_part.outcome
            if outcome == "success":
                span.set_status(Status(StatusCode.OK))
            else:
                error_message = (
                    str(tool_return_part.content)
                    if tool_return_part.content is not None
                    else outcome
                )
                span.record_exception(Exception(error_message))
                span.set_status(Status(StatusCode.ERROR, f"tool {outcome}: {error_message}"))

    @contextmanager
    def _span(
        self,
        *,
        user_prompt: str | Sequence[UserContent] | None,
        message_history: Sequence[ModelMessage] | None,
        kwargs: dict[str, Any],
    ) -> Iterator[Callable[[AgentRunResult[Any] | None], None]]:
        input_value: dict[str, Any] = {
            "user_prompt": user_prompt,
            **{k: v for k, v in kwargs.items() if v is not None},
        }
        if message_history is not None:
            input_value["message_history"] = list(message_history)
        attributes = {
            **get_span_kind_attributes("agent"),
            **get_input_attributes(input_value, mime_type=OpenInferenceMimeTypeValues.JSON),
        }
        span_name = f"{self.name or type(self.wrapped).__name__}.iter"
        with self._tracer.start_as_current_span(
            name=span_name,
            attributes=attributes,
        ) as span:

            def set_result(result: AgentRunResult[Any] | None) -> None:
                if result is None:
                    return
                span.set_attributes(get_output_attributes(result.output))

            yield set_result
            span.set_status(Status(StatusCode.OK))


def _collect_trailing_tool_return_parts(
    messages: Sequence[ModelMessage],
) -> tuple[list[ToolReturnPart], int]:
    """Collect ``ToolReturnPart``s from the trailing run of ``ModelRequest``s.

    A trailing ``ModelRequest`` may mix ``ToolReturnPart``s with other parts
    (e.g. a ``UserPromptPart`` when the user submits a new turn alongside
    the external tool results); the returns are still collected. The walk
    stops at the first non-``ModelRequest`` message or at the first
    ``ModelRequest`` carrying no ``ToolReturnPart``s. Returns the collected
    tool returns alongside the index of the earliest message in that
    trailing block (or ``len(messages)`` when none are found).
    """
    trailing_tool_return_parts: list[ToolReturnPart] = []
    first_trailing_request_index = len(messages)
    for index, message in reversed(list(enumerate(messages))):
        if not isinstance(message, ModelRequest):
            break
        return_parts_in_message = [p for p in message.parts if isinstance(p, ToolReturnPart)]
        if not return_parts_in_message:
            break
        trailing_tool_return_parts.extend(return_parts_in_message)
        first_trailing_request_index = index
    return trailing_tool_return_parts, first_trailing_request_index


def _get_tool_call_parts_by_id(
    messages: Sequence[ModelMessage],
) -> dict[ToolCallId, ToolCallPart]:
    tool_calls_by_call_id: dict[ToolCallId, ToolCallPart] = {}
    for model_response in reversed(messages):
        if not isinstance(model_response, ModelResponse):
            break
        for part in model_response.parts:
            if isinstance(part, ToolCallPart):
                tool_calls_by_call_id[part.tool_call_id] = part
    return tool_calls_by_call_id
