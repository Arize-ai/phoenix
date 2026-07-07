from __future__ import annotations

from collections.abc import AsyncIterator, Iterator, Sequence
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
from inspect import Signature, signature
from typing import Any, Callable, Literal, overload

import pydantic
from openinference.instrumentation import (
    get_input_attributes,
    get_metadata_attributes,
    get_output_attributes,
    get_span_kind_attributes,
    safe_json_dumps,
)
from openinference.semconv.trace import OpenInferenceMimeTypeValues
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

_MODEL_REQUEST_PARTS_ADAPTER: pydantic.TypeAdapter[list[ModelRequestPart]] = pydantic.TypeAdapter(
    list[ModelRequestPart],
    config=pydantic.ConfigDict(ser_json_bytes="base64"),
)
_MODEL_RESPONSE_PARTS_ADAPTER: pydantic.TypeAdapter[list[ModelResponsePart]] = pydantic.TypeAdapter(
    list[ModelResponsePart],
    config=pydantic.ConfigDict(ser_json_bytes="base64"),
)


@dataclass(init=False)
class OpenInferenceAgentWrapper(WrapperAgent[AgentDepsT, OutputDataT]):
    """Pydantic-ai ``Agent`` wrapper that emits a single OpenInference ``AGENT`` span per turn.

    Overrides ``iter`` only — every other agent run entry point (``run``,
    ``run_sync``, ``run_stream``, ``run_stream_events``) ultimately delegates
    through ``iter`` in ``AbstractAgent``, so a single seam captures all
    execution paths.

    ``span_name`` overrides the default ``{agent name}.iter`` span name.
    """

    tracer: Tracer
    span_name: str | None

    def __init__(
        self,
        wrapped: AbstractAgent[AgentDepsT, OutputDataT],
        *,
        tracer: Tracer,
        span_name: str | None = None,
    ) -> None:
        super().__init__(wrapped)
        self.tracer = tracer
        self.span_name = span_name

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
            async with super().iter(
                user_prompt, message_history=message_history, **kwargs
            ) as agent_run:
                yield agent_run
                set_result(agent_run)

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
        span_name = self.span_name or f"{self.name or type(self.wrapped).__name__}.iter"
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
    value, mime_type = _get_message_io_value(message)
    if role == "input":
        return get_input_attributes(value, mime_type=mime_type)
    elif role == "output":
        return get_output_attributes(value, mime_type=mime_type)
    assert_never(role)


def _get_message_io_value(message: ModelMessage) -> tuple[str, OpenInferenceMimeTypeValues]:
    """Return the display value and MIME type for a turn-level message."""
    if isinstance(message, ModelRequest):
        request_parts = _get_parts_with_non_empty_content(message)
        text = _get_single_text_content(request_parts)
        if text is not None:
            return text, OpenInferenceMimeTypeValues.TEXT
        return _dump_model_request_parts_json(request_parts), OpenInferenceMimeTypeValues.JSON
    if isinstance(message, ModelResponse):
        response_parts = _get_parts_with_non_empty_content(message)
        text = _get_single_text_content(response_parts)
        if text is not None:
            return text, OpenInferenceMimeTypeValues.TEXT
        return _dump_model_response_parts_json(response_parts), OpenInferenceMimeTypeValues.JSON
    assert_never(message)


@overload
def _get_parts_with_non_empty_content(message: ModelRequest) -> list[ModelRequestPart]: ...


@overload
def _get_parts_with_non_empty_content(message: ModelResponse) -> list[ModelResponsePart]: ...


def _get_parts_with_non_empty_content(
    message: ModelMessage,
) -> list[ModelRequestPart] | list[ModelResponsePart]:
    """Return message parts worth displaying in turn-level input/output."""
    if isinstance(message, ModelRequest):
        return list(message.parts)
    if isinstance(message, ModelResponse):
        return [
            part
            for part in message.parts
            if not (isinstance(part, ThinkingPart) and not part.has_content())
        ]
    assert_never(message)


def _get_single_text_content(parts: Sequence[ModelRequestPart | ModelResponsePart]) -> str | None:
    """Return plain text only when exactly one text-bearing part remains."""
    if len(parts) != 1:
        return None
    (part,) = parts
    if isinstance(part, TextPart):
        return part.content
    if isinstance(part, (SystemPromptPart, UserPromptPart, ToolReturnPart, RetryPromptPart)):
        return _get_text_content_from_model_request_part(part)
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


def _dump_model_request_parts_json(parts: list[ModelRequestPart]) -> str:
    """Serialize request parts as a top-level JSON array without null-valued fields."""
    payload = _MODEL_REQUEST_PARTS_ADAPTER.dump_python(parts, mode="json")
    return safe_json_dumps(_drop_none_fields(payload))


def _dump_model_response_parts_json(parts: list[ModelResponsePart]) -> str:
    """Serialize response parts as a top-level JSON array without null-valued fields."""
    payload = _MODEL_RESPONSE_PARTS_ADAPTER.dump_python(parts, mode="json")
    return safe_json_dumps(_drop_none_fields(payload))


def _drop_none_fields(value: Any) -> Any:
    """Recursively remove mapping entries whose value is ``None``."""
    if isinstance(value, dict):
        return {key: _drop_none_fields(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [_drop_none_fields(item) for item in value]
    return value
