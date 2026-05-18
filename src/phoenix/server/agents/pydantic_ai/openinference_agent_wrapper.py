from __future__ import annotations

from collections.abc import AsyncIterator, Iterator, Sequence
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
from inspect import Signature, signature
from typing import Any, Callable, Literal, TypeAlias

import pydantic
from openinference.instrumentation import (
    get_input_attributes,
    get_metadata_attributes,
    get_output_attributes,
    get_span_kind_attributes,
    safe_json_dumps,
)
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    SpanAttributes,
    ToolCallAttributes,
)
from opentelemetry.trace import Status, StatusCode, Tracer
from opentelemetry.util.types import AttributeValue
from pydantic_ai.agent.abstract import AbstractAgent
from pydantic_ai.agent.wrapper import WrapperAgent
from pydantic_ai.messages import (
    AudioUrl,
    BinaryContent,
    CachePoint,
    CompactionPart,
    DocumentUrl,
    FilePart,
    ImageUrl,
    ModelMessage,
    ModelRequest,
    ModelRequestPart,
    ModelResponse,
    ModelResponsePart,
    NativeToolCallPart,
    NativeToolReturnPart,
    RetryPromptPart,
    SystemPromptPart,
    TextContent,
    TextPart,
    ThinkingPart,
    ToolCallPart,
    ToolReturnPart,
    UploadedFile,
    UserContent,
    UserPromptPart,
    VideoUrl,
)
from pydantic_ai.output import OutputDataT
from pydantic_ai.run import AgentRun
from pydantic_ai.tools import AgentDepsT
from typing_extensions import assert_never

from phoenix.server.agents.capabilities.tools.external import get_external_tool_definition

ToolCallId: TypeAlias = str

_MODEL_MESSAGE_ADAPTER: pydantic.TypeAdapter[ModelMessage] = pydantic.TypeAdapter(
    ModelMessage,
    config=pydantic.ConfigDict(ser_json_bytes="base64"),
)


@dataclass(init=False)
class OpenInferenceAgentWrapper(WrapperAgent[AgentDepsT, OutputDataT]):
    """Pydantic-ai ``Agent`` wrapper that emits a single OpenInference ``AGENT`` span per turn.

    Overrides ``iter`` only — every other agent run entry point (``run``,
    ``run_sync``, ``run_stream``, ``run_stream_events``) ultimately delegates
    through ``iter`` in ``AbstractAgent``, so a single seam captures all
    execution paths.
    """

    tracer: Tracer

    def __init__(
        self,
        wrapped: AbstractAgent[AgentDepsT, OutputDataT],
        *,
        tracer: Tracer,
    ) -> None:
        super().__init__(wrapped)
        self.tracer = tracer

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
                set_result(agent_run)

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
        with self.tracer.start_as_current_span(name=tool_name, attributes=attributes) as span:
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
    ) -> Iterator[Callable[[AgentRun[AgentDepsT, OutputDataT]], None]]:
        attributes: dict[str, AttributeValue] = {**get_span_kind_attributes("agent")}
        input_message = _get_last_input_message(
            user_prompt=user_prompt, message_history=message_history
        )
        if input_message is not None:
            attributes.update(_get_message_io_attributes(message=input_message, role="input"))
        iter_method_arguments = _get_iter_method_arguments(
            iter_signature=signature(self.wrapped.iter),
            user_prompt=user_prompt,
            message_history=message_history,
            kwargs=kwargs,
        )
        metadata: dict[str, Any] = {"input": iter_method_arguments}
        attributes.update(get_metadata_attributes(metadata=metadata))
        span_name = f"{self.name or type(self.wrapped).__name__}.iter"
        with self.tracer.start_as_current_span(
            name=span_name,
            attributes=attributes,
        ) as span:

            def set_result(agent_run: AgentRun[AgentDepsT, OutputDataT]) -> None:
                response = _get_last_model_response(agent_run.new_messages())
                if response is not None:
                    span.set_attributes(_get_message_io_attributes(message=response, role="output"))
                if agent_run.result is not None:
                    metadata["output"] = agent_run.result.output
                    span.set_attributes(get_metadata_attributes(metadata=metadata))

            yield set_result
            span.set_status(Status(StatusCode.OK))


def _collect_trailing_tool_return_parts(
    messages: Sequence[ModelMessage],
) -> tuple[list[ToolReturnPart], int]:
    """Collect ``ToolReturnPart``s from the trailing run of ``ModelRequest``s."""
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


def _get_last_input_message(
    *,
    user_prompt: str | Sequence[UserContent] | None,
    message_history: Sequence[ModelMessage] | None,
) -> ModelMessage | None:
    if user_prompt is not None:
        return ModelRequest(parts=[UserPromptPart(content=user_prompt)])
    if message_history:
        return message_history[-1]
    return None


def _get_last_model_response(messages: Sequence[ModelMessage]) -> ModelResponse | None:
    for message in reversed(messages):
        if isinstance(message, ModelResponse):
            return message
    return None


def _get_iter_method_arguments(
    *,
    iter_signature: Signature,
    user_prompt: str | Sequence[UserContent] | None,
    message_history: Sequence[ModelMessage] | None,
    kwargs: dict[str, Any],
) -> dict[str, Any]:
    bound = iter_signature.bind_partial(user_prompt, message_history=message_history, **kwargs)
    return dict(bound.arguments)


def _get_message_io_attributes(
    *,
    message: ModelMessage,
    role: Literal["input", "output"],
) -> dict[str, AttributeValue]:
    text = _get_text_content_from_model_message(message)
    if text is not None:
        value: str = text
        mime_type = OpenInferenceMimeTypeValues.TEXT
    else:
        value = _MODEL_MESSAGE_ADAPTER.dump_json(message).decode("utf-8")
        mime_type = OpenInferenceMimeTypeValues.JSON
    if role == "input":
        return get_input_attributes(value, mime_type=mime_type)
    elif role == "output":
        return get_output_attributes(value, mime_type=mime_type)
    assert_never(role)


def _get_text_content_from_model_message(message: ModelMessage) -> str | None:
    """Concatenated text if the message has only text-bearing parts; else ``None``."""
    if isinstance(message, ModelRequest):
        return _get_text_content_from_model_request(message)
    if isinstance(message, ModelResponse):
        return _get_text_content_from_model_response(message)
    assert_never(message)


def _get_text_content_from_model_request(message: ModelRequest) -> str | None:
    texts: list[str] = []
    for part in message.parts:
        text = _get_text_content_from_model_request_part(part)
        if text is None:
            return None
        texts.append(text)
    return "\n".join(texts)


def _get_text_content_from_model_request_part(part: ModelRequestPart) -> str | None:
    if isinstance(part, SystemPromptPart):
        return part.content
    if isinstance(part, UserPromptPart):
        content = part.content
        if isinstance(content, str):
            return content
        texts: list[str] = []
        for item in content:
            if isinstance(item, CachePoint):
                continue
            text = _get_text_content_from_user_content_item(item)
            if text is None:
                return None
            texts.append(text)
        return "\n".join(texts)
    if isinstance(part, (ToolReturnPart, RetryPromptPart)):
        return None
    assert_never(part)


def _get_text_content_from_user_content_item(item: UserContent) -> str | None:
    """The item's text if it is plain text; ``None`` for any non-text content kind."""
    if isinstance(item, str):
        return item
    if isinstance(item, TextContent):
        return item.content
    if isinstance(
        item,
        (ImageUrl, AudioUrl, DocumentUrl, VideoUrl, BinaryContent, UploadedFile, CachePoint),
    ):
        return None
    assert_never(item)


def _get_text_content_from_model_response(message: ModelResponse) -> str | None:
    texts: list[str] = []
    for part in message.parts:
        text = _get_text_content_from_model_response_part(part)
        if text is None:
            return None
        texts.append(text)
    return "\n".join(texts) if texts else None


def _get_text_content_from_model_response_part(part: ModelResponsePart) -> str | None:
    if isinstance(part, TextPart):
        return part.content
    if isinstance(
        part,
        (
            ToolCallPart,
            NativeToolCallPart,
            NativeToolReturnPart,
            ThinkingPart,
            CompactionPart,
            FilePart,
        ),
    ):
        return None
    assert_never(part)
