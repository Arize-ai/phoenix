# Ported from Vercel AI SDK ai@7.0.31. The corresponding upstream sources are:
# - packages/ai/src/ui/process-ui-message-stream.ts
# - packages/ai/src/ui-message-stream/read-ui-message-stream.ts
# - packages/ai/src/util/{fix-json,merge-objects,parse-partial-json}.ts
# https://github.com/vercel/ai/tree/ai%407.0.31/packages/ai/src
# Copyright 2023 Vercel, Inc.
# SPDX-License-Identifier: Apache-2.0

"""Python ports of Vercel AI SDK UI-message stream reduction.

The ports use Phoenix's pydantic UI-part models while preserving the upstream
state transitions and observable write cadence.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel
from pydantic_ai.ui.vercel_ai.response_types import (
    BaseChunk,
    DataChunk,
    DoneChunk,
    ErrorChunk,
    FileChunk,
    FinishChunk,
    FinishStepChunk,
    MessageMetadataChunk,
    ReasoningDeltaChunk,
    ReasoningEndChunk,
    ReasoningStartChunk,
    SourceDocumentChunk,
    SourceUrlChunk,
    StartChunk,
    StartStepChunk,
    TextDeltaChunk,
    TextEndChunk,
    TextStartChunk,
    ToolInputAvailableChunk,
    ToolInputDeltaChunk,
    ToolInputErrorChunk,
    ToolInputStartChunk,
    ToolOutputAvailableChunk,
    ToolOutputErrorChunk,
)

from phoenix.db.types.data_stream_protocol import (
    DataUIPart,
    DynamicToolApprovalRequestedPart,
    DynamicToolApprovalRespondedPart,
    DynamicToolInputAvailablePart,
    DynamicToolInputStreamingPart,
    DynamicToolOutputAvailablePart,
    DynamicToolOutputDeniedPart,
    DynamicToolOutputErrorPart,
    DynamicToolUIPart,
    FileUIPart,
    ProviderMetadata,
    ReasoningUIPart,
    SourceDocumentUIPart,
    SourceUrlUIPart,
    StepStartUIPart,
    TextUIPart,
    ToolApproval,
    ToolApprovalRequestedPart,
    ToolApprovalRespondedPart,
    ToolInputAvailablePart,
    ToolInputStreamingPart,
    ToolOutputAvailablePart,
    ToolOutputDeniedPart,
    ToolOutputErrorPart,
    ToolUIPart,
    UIMessage,
    UIMessagePart,
)

_STATIC_TOOL_PART_TYPES = (
    ToolInputStreamingPart,
    ToolInputAvailablePart,
    ToolOutputAvailablePart,
    ToolOutputErrorPart,
    ToolApprovalRequestedPart,
    ToolApprovalRespondedPart,
    ToolOutputDeniedPart,
)
_DYNAMIC_TOOL_PART_TYPES = (
    DynamicToolInputStreamingPart,
    DynamicToolInputAvailablePart,
    DynamicToolOutputAvailablePart,
    DynamicToolOutputErrorPart,
    DynamicToolApprovalRequestedPart,
    DynamicToolApprovalRespondedPart,
    DynamicToolOutputDeniedPart,
)
_TOOL_PART_TYPES = (*_STATIC_TOOL_PART_TYPES, *_DYNAMIC_TOOL_PART_TYPES)


class UIMessageStreamError(Exception):
    """Raised when a stream chunk refers to protocol state that does not exist."""

    def __init__(self, *, chunk_type: str, chunk_id: str, message: str) -> None:
        super().__init__(message)
        self.chunk_type = chunk_type
        self.chunk_id = chunk_id


@dataclass
class PartialToolCall:
    text: str
    tool_name: str
    dynamic: bool = False


@dataclass
class StreamingUIMessageState:
    message: UIMessage
    active_text_parts: dict[str, TextUIPart]
    active_reasoning_parts: dict[str, ReasoningUIPart]
    partial_tool_calls: dict[str, PartialToolCall]
    finish_reason: str | None = None


def create_streaming_ui_message_state(
    *,
    message_id: str,
    last_message: UIMessage | None,
) -> StreamingUIMessageState:
    """Create the mutable state used while reducing a UI message stream."""
    message = (
        UIMessage.model_validate(
            last_message.model_dump(
                mode="json",
                by_alias=True,
                exclude_none=True,
            )
        )
        if last_message is not None and last_message.role == "assistant"
        else UIMessage(id=message_id, role="assistant", parts=[])
    )
    return StreamingUIMessageState(
        message=message,
        active_text_parts={},
        active_reasoning_parts={},
        partial_tool_calls={},
    )


def _noop_write() -> None:
    pass


async def process_ui_message_stream(
    *,
    stream: AsyncIterator[BaseChunk],
    state: StreamingUIMessageState,
    write: Callable[[], None],
    on_error: Callable[[Exception], None] | None = None,
    on_data: Callable[[DataUIPart], None] | None = None,
) -> AsyncIterator[BaseChunk]:
    """Reduce UI-message chunks into ``state`` while yielding them unchanged."""
    async for chunk in stream:
        reduce_ui_message_chunk(
            chunk=chunk,
            state=state,
            write=write,
            on_error=on_error,
            on_data=on_data,
        )
        yield chunk


def reduce_ui_message_chunk(
    *,
    chunk: BaseChunk,
    state: StreamingUIMessageState,
    write: Callable[[], None] = _noop_write,
    on_error: Callable[[Exception], None] | None = None,
    on_data: Callable[[DataUIPart], None] | None = None,
) -> None:
    """Reduce a single UI-message chunk into ``state``."""
    if isinstance(chunk, TextStartChunk):
        text_part = TextUIPart(
            text="",
            provider_metadata=chunk.provider_metadata,
            state="streaming",
        )
        state.active_text_parts[chunk.id] = text_part
        state.message.parts.append(text_part)
        write()
    elif isinstance(chunk, TextDeltaChunk):
        active_text_part = state.active_text_parts.get(chunk.id)
        if active_text_part is None:
            raise UIMessageStreamError(
                chunk_type="text-delta",
                chunk_id=chunk.id,
                message=(
                    f'Received text-delta for missing text part with ID "{chunk.id}". '
                    'Ensure a "text-start" chunk is sent before any "text-delta" chunks.'
                ),
            )
        active_text_part.text += chunk.delta
        if chunk.provider_metadata is not None:
            active_text_part.provider_metadata = chunk.provider_metadata
        write()
    elif isinstance(chunk, TextEndChunk):
        ending_text_part = state.active_text_parts.get(chunk.id)
        if ending_text_part is None:
            raise UIMessageStreamError(
                chunk_type="text-end",
                chunk_id=chunk.id,
                message=(
                    f'Received text-end for missing text part with ID "{chunk.id}". '
                    'Ensure a "text-start" chunk is sent before any "text-end" chunks.'
                ),
            )
        ending_text_part.state = "done"
        if chunk.provider_metadata is not None:
            ending_text_part.provider_metadata = chunk.provider_metadata
        del state.active_text_parts[chunk.id]
        write()
    elif isinstance(chunk, ReasoningStartChunk):
        reasoning_part = ReasoningUIPart(
            text="",
            provider_metadata=chunk.provider_metadata,
            state="streaming",
        )
        state.active_reasoning_parts[chunk.id] = reasoning_part
        state.message.parts.append(reasoning_part)
        write()
    elif isinstance(chunk, ReasoningDeltaChunk):
        active_reasoning_part = state.active_reasoning_parts.get(chunk.id)
        if active_reasoning_part is None:
            raise UIMessageStreamError(
                chunk_type="reasoning-delta",
                chunk_id=chunk.id,
                message=(
                    "Received reasoning-delta for missing reasoning part with ID "
                    f'"{chunk.id}". Ensure a "reasoning-start" chunk is sent before any '
                    '"reasoning-delta" chunks.'
                ),
            )
        active_reasoning_part.text += chunk.delta
        if chunk.provider_metadata is not None:
            active_reasoning_part.provider_metadata = chunk.provider_metadata
        write()
    elif isinstance(chunk, ReasoningEndChunk):
        ending_reasoning_part = state.active_reasoning_parts.get(chunk.id)
        if ending_reasoning_part is None:
            raise UIMessageStreamError(
                chunk_type="reasoning-end",
                chunk_id=chunk.id,
                message=(
                    "Received reasoning-end for missing reasoning part with ID "
                    f'"{chunk.id}". Ensure a "reasoning-start" chunk is sent before any '
                    '"reasoning-end" chunks.'
                ),
            )
        if chunk.provider_metadata is not None:
            ending_reasoning_part.provider_metadata = chunk.provider_metadata
        ending_reasoning_part.state = "done"
        del state.active_reasoning_parts[chunk.id]
        write()
    elif isinstance(chunk, FileChunk):
        state.message.parts.append(FileUIPart(url=chunk.url, media_type=chunk.media_type))
        write()
    elif isinstance(chunk, SourceUrlChunk):
        state.message.parts.append(
            SourceUrlUIPart(
                source_id=chunk.source_id,
                url=chunk.url,
                title=chunk.title,
                provider_metadata=chunk.provider_metadata,
            )
        )
        write()
    elif isinstance(chunk, SourceDocumentChunk):
        state.message.parts.append(
            SourceDocumentUIPart(
                source_id=chunk.source_id,
                media_type=chunk.media_type,
                title=chunk.title,
                filename=chunk.filename,
                provider_metadata=chunk.provider_metadata,
            )
        )
        write()
    elif isinstance(chunk, ToolInputStartChunk):
        state.partial_tool_calls[chunk.tool_call_id] = PartialToolCall(
            text="",
            tool_name=chunk.tool_name,
            dynamic=chunk.dynamic is True,
        )
        _update_tool_part(
            message=state.message,
            tool_call_id=chunk.tool_call_id,
            tool_name=chunk.tool_name,
            part_state="input-streaming",
            input_value=None,
            provider_executed=chunk.provider_executed,
            provider_metadata=chunk.provider_metadata,
            dynamic=chunk.dynamic is True,
        )
        write()
    elif isinstance(chunk, ToolInputDeltaChunk):
        partial_tool_call = state.partial_tool_calls.get(chunk.tool_call_id)
        if partial_tool_call is None:
            raise UIMessageStreamError(
                chunk_type="tool-input-delta",
                chunk_id=chunk.tool_call_id,
                message=(
                    "Received tool-input-delta for missing tool call with ID "
                    f'"{chunk.tool_call_id}". Ensure a "tool-input-start" chunk is sent '
                    'before any "tool-input-delta" chunks.'
                ),
            )
        partial_tool_call.text += chunk.input_text_delta
        _update_tool_part(
            message=state.message,
            tool_call_id=chunk.tool_call_id,
            tool_name=partial_tool_call.tool_name,
            part_state="input-streaming",
            input_value=_parse_partial_json(partial_tool_call.text),
            dynamic=partial_tool_call.dynamic,
        )
        write()
    elif isinstance(chunk, ToolInputAvailableChunk):
        _update_tool_part(
            message=state.message,
            tool_call_id=chunk.tool_call_id,
            tool_name=chunk.tool_name,
            part_state="input-available",
            input_value=chunk.input,
            provider_executed=chunk.provider_executed,
            provider_metadata=chunk.provider_metadata,
            dynamic=chunk.dynamic is True,
        )
        write()
    elif isinstance(chunk, ToolInputErrorChunk):
        existing_part = _find_tool_part(
            message=state.message,
            tool_call_id=chunk.tool_call_id,
        )
        is_dynamic = (
            isinstance(existing_part, _DYNAMIC_TOOL_PART_TYPES)
            if existing_part is not None
            else chunk.dynamic is True
        )
        _update_tool_part(
            message=state.message,
            tool_call_id=chunk.tool_call_id,
            tool_name=chunk.tool_name,
            part_state="output-error",
            input_value=chunk.input if is_dynamic else None,
            raw_input=None if is_dynamic else chunk.input,
            error_text=chunk.error_text,
            provider_executed=chunk.provider_executed,
            provider_metadata=chunk.provider_metadata,
            dynamic=is_dynamic,
        )
        write()
    elif isinstance(chunk, ToolOutputAvailableChunk):
        tool_part = _get_tool_invocation(
            message=state.message,
            tool_call_id=chunk.tool_call_id,
        )
        _update_tool_part(
            message=state.message,
            tool_call_id=chunk.tool_call_id,
            tool_name=_get_tool_name(tool_part),
            part_state="output-available",
            input_value=tool_part.input,
            output=chunk.output,
            provider_executed=chunk.provider_executed,
            preliminary=chunk.preliminary,
            dynamic=isinstance(tool_part, _DYNAMIC_TOOL_PART_TYPES),
            title=tool_part.title,
        )
        write()
    elif isinstance(chunk, ToolOutputErrorChunk):
        tool_part = _get_tool_invocation(
            message=state.message,
            tool_call_id=chunk.tool_call_id,
        )
        _update_tool_part(
            message=state.message,
            tool_call_id=chunk.tool_call_id,
            tool_name=_get_tool_name(tool_part),
            part_state="output-error",
            input_value=tool_part.input,
            raw_input=(tool_part.raw_input if isinstance(tool_part, ToolOutputErrorPart) else None),
            error_text=chunk.error_text,
            provider_executed=chunk.provider_executed,
            dynamic=isinstance(tool_part, _DYNAMIC_TOOL_PART_TYPES),
            title=tool_part.title,
        )
        write()
    elif isinstance(chunk, StartStepChunk):
        state.message.parts.append(StepStartUIPart())
    elif isinstance(chunk, FinishStepChunk):
        state.active_text_parts = {}
        state.active_reasoning_parts = {}
    elif isinstance(chunk, StartChunk):
        if chunk.message_id is not None:
            state.message.id = chunk.message_id
        _update_message_metadata(
            message=state.message,
            metadata=chunk.message_metadata,
        )
        if chunk.message_id is not None or chunk.message_metadata is not None:
            write()
    elif isinstance(chunk, FinishChunk):
        if chunk.finish_reason is not None:
            state.finish_reason = chunk.finish_reason
        _update_message_metadata(
            message=state.message,
            metadata=chunk.message_metadata,
        )
        if chunk.message_metadata is not None:
            write()
    elif isinstance(chunk, MessageMetadataChunk):
        _update_message_metadata(
            message=state.message,
            metadata=chunk.message_metadata,
        )
        if chunk.message_metadata is not None:
            write()
    elif isinstance(chunk, ErrorChunk):
        if on_error is not None:
            on_error(Exception(chunk.error_text))
    elif isinstance(chunk, DataChunk):
        data_part = DataUIPart(
            type=chunk.type,
            id=chunk.id,
            data=_to_json_value(chunk.data),
        )
        if chunk.transient is True:
            if on_data is not None:
                on_data(data_part)
        else:
            existing_data_part = (
                next(
                    (
                        part
                        for part in state.message.parts
                        if isinstance(part, DataUIPart)
                        and part.type == chunk.type
                        and part.id == chunk.id
                    ),
                    None,
                )
                if chunk.id is not None
                else None
            )
            if existing_data_part is not None:
                existing_data_part.data = data_part.data
            else:
                state.message.parts.append(data_part)
            if on_data is not None:
                on_data(data_part)
            write()
    elif isinstance(chunk, DoneChunk):
        pass


async def read_ui_message_stream(
    *,
    stream: AsyncIterator[BaseChunk],
    message: UIMessage | None = None,
    on_error: Callable[[Exception], None] | None = None,
    terminate_on_error: bool = False,
) -> AsyncIterator[UIMessage]:
    """Yield a deep-copied message snapshot for every reducer write."""
    state = create_streaming_ui_message_state(
        message_id=message.id if message is not None else str(uuid4()),
        last_message=message,
    )
    pending_writes: list[UIMessage] = []
    handled_error: Exception | None = None

    def write() -> None:
        pending_writes.append(state.message.model_copy(deep=True))

    def handle_error(error: Exception) -> None:
        nonlocal handled_error
        handled_error = error
        if on_error is not None:
            on_error(error)
        if terminate_on_error:
            raise error

    try:
        async for _ in process_ui_message_stream(
            stream=stream,
            state=state,
            write=write,
            on_error=handle_error,
        ):
            while pending_writes:
                yield pending_writes.pop(0)
    except Exception as error:
        if error is not handled_error and on_error is not None:
            on_error(error)
        if terminate_on_error:
            raise


def _find_tool_part(
    *,
    message: UIMessage,
    tool_call_id: str,
    dynamic: bool | None = None,
) -> ToolUIPart | DynamicToolUIPart | None:
    for part in message.parts:
        if not isinstance(part, _TOOL_PART_TYPES):
            continue
        if part.tool_call_id != tool_call_id:
            continue
        if dynamic is None:
            return part
        if dynamic and isinstance(part, _DYNAMIC_TOOL_PART_TYPES):
            return part
        if not dynamic and isinstance(part, _STATIC_TOOL_PART_TYPES):
            return part
    return None


def _get_tool_invocation(
    *,
    message: UIMessage,
    tool_call_id: str,
) -> ToolUIPart | DynamicToolUIPart:
    part = _find_tool_part(message=message, tool_call_id=tool_call_id)
    if part is None:
        raise UIMessageStreamError(
            chunk_type="tool-invocation",
            chunk_id=tool_call_id,
            message=f'No tool invocation found for tool call ID "{tool_call_id}".',
        )
    return part


def _update_tool_part(
    *,
    message: UIMessage,
    tool_call_id: str,
    tool_name: str,
    part_state: Literal[
        "input-streaming",
        "input-available",
        "output-available",
        "output-error",
    ],
    input_value: Any,
    dynamic: bool,
    output: Any = None,
    raw_input: Any = None,
    error_text: str | None = None,
    provider_executed: bool | None = None,
    provider_metadata: ProviderMetadata | None = None,
    preliminary: bool | None = None,
    title: str | None = None,
) -> None:
    existing_part = _find_tool_part(
        message=message,
        tool_call_id=tool_call_id,
        dynamic=dynamic,
    )
    existing_call_metadata = (
        existing_part.call_provider_metadata
        if isinstance(existing_part, _TOOL_PART_TYPES)
        else None
    )
    existing_result_metadata = (
        existing_part.result_provider_metadata
        if isinstance(
            existing_part,
            (
                ToolOutputAvailablePart,
                ToolOutputErrorPart,
                DynamicToolOutputAvailablePart,
                DynamicToolOutputErrorPart,
            ),
        )
        else None
    )
    call_provider_metadata = existing_call_metadata
    result_provider_metadata = existing_result_metadata
    if provider_metadata is not None:
        if part_state in ("output-available", "output-error"):
            result_provider_metadata = provider_metadata
        else:
            call_provider_metadata = provider_metadata
    resolved_provider_executed = (
        provider_executed
        if provider_executed is not None
        else (
            existing_part.provider_executed if isinstance(existing_part, _TOOL_PART_TYPES) else None
        )
    )
    resolved_title = (
        title
        if title is not None
        else (existing_part.title if isinstance(existing_part, _TOOL_PART_TYPES) else None)
    )
    approval: ToolApproval | None = (
        existing_part.approval if isinstance(existing_part, _TOOL_PART_TYPES) else None
    )
    static_type = (
        existing_part.type
        if isinstance(existing_part, _STATIC_TOOL_PART_TYPES)
        else f"tool-{tool_name}"
    )

    if dynamic:
        if part_state == "input-streaming":
            replacement: UIMessagePart = DynamicToolInputStreamingPart(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                title=resolved_title,
                input=input_value,
                provider_executed=resolved_provider_executed,
                call_provider_metadata=call_provider_metadata,
                approval=approval,
            )
        elif part_state == "input-available":
            replacement = DynamicToolInputAvailablePart(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                title=resolved_title,
                input=input_value,
                provider_executed=resolved_provider_executed,
                call_provider_metadata=call_provider_metadata,
                approval=approval,
            )
        elif part_state == "output-available":
            replacement = DynamicToolOutputAvailablePart(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                title=resolved_title,
                input=input_value,
                output=output,
                provider_executed=resolved_provider_executed,
                call_provider_metadata=call_provider_metadata,
                result_provider_metadata=result_provider_metadata,
                preliminary=preliminary,
                approval=approval,
            )
        else:
            assert error_text is not None
            replacement = DynamicToolOutputErrorPart(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                title=resolved_title,
                input=input_value,
                error_text=error_text,
                provider_executed=resolved_provider_executed,
                call_provider_metadata=call_provider_metadata,
                result_provider_metadata=result_provider_metadata,
                approval=approval,
            )
    elif part_state == "input-streaming":
        replacement = ToolInputStreamingPart(
            type=static_type,
            tool_call_id=tool_call_id,
            title=resolved_title,
            input=input_value,
            provider_executed=resolved_provider_executed,
            call_provider_metadata=call_provider_metadata,
            approval=approval,
        )
    elif part_state == "input-available":
        replacement = ToolInputAvailablePart(
            type=static_type,
            tool_call_id=tool_call_id,
            title=resolved_title,
            input=input_value,
            provider_executed=resolved_provider_executed,
            call_provider_metadata=call_provider_metadata,
            approval=approval,
        )
    elif part_state == "output-available":
        replacement = ToolOutputAvailablePart(
            type=static_type,
            tool_call_id=tool_call_id,
            title=resolved_title,
            input=input_value,
            output=output,
            provider_executed=resolved_provider_executed,
            call_provider_metadata=call_provider_metadata,
            result_provider_metadata=result_provider_metadata,
            preliminary=preliminary,
            approval=approval,
        )
    else:
        assert error_text is not None
        replacement = ToolOutputErrorPart(
            type=static_type,
            tool_call_id=tool_call_id,
            title=resolved_title,
            input=input_value,
            raw_input=raw_input,
            error_text=error_text,
            provider_executed=resolved_provider_executed,
            call_provider_metadata=call_provider_metadata,
            result_provider_metadata=result_provider_metadata,
            approval=approval,
        )

    if existing_part is None:
        message.parts.append(replacement)
        return
    message.parts[message.parts.index(existing_part)] = replacement


def _get_tool_name(part: ToolUIPart | DynamicToolUIPart) -> str:
    if isinstance(part, _DYNAMIC_TOOL_PART_TYPES):
        return part.tool_name
    if isinstance(part, _STATIC_TOOL_PART_TYPES):
        return part.type.removeprefix("tool-")
    raise TypeError(f"Expected a tool part, got {type(part).__name__}")


def _update_message_metadata(*, message: UIMessage, metadata: Any) -> None:
    if metadata is None:
        return
    message.metadata = _merge_objects(message.metadata, metadata)


def _merge_objects(base: Any, overrides: Any) -> Any:
    base = _to_json_value(base)
    overrides = _to_json_value(overrides)
    if not isinstance(base, dict) or not isinstance(overrides, dict):
        return overrides
    result = dict(base)
    for key, overrides_value in overrides.items():
        if key in {"__proto__", "constructor", "prototype"}:
            continue
        base_value = base.get(key)
        result[key] = (
            _merge_objects(base_value, overrides_value)
            if isinstance(base_value, dict) and isinstance(overrides_value, dict)
            else overrides_value
        )
    return result


def _to_json_value(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json", by_alias=True, exclude_none=True)
    return value


def _parse_partial_json(value: str) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        try:
            return json.loads(_fix_json(value))
        except json.JSONDecodeError:
            return None


def _fix_json(value: str) -> str:
    stack = ["ROOT"]
    last_valid_index = -1
    literal_start: int | None = None
    unicode_escape_digits = 0

    def process_value_start(character: str, index: int, next_state: str) -> None:
        nonlocal last_valid_index, literal_start
        if character == '"':
            last_valid_index = index
            stack.pop()
            stack.extend((next_state, "INSIDE_STRING"))
        elif character in {"f", "t", "n"}:
            last_valid_index = index
            literal_start = index
            stack.pop()
            stack.extend((next_state, "INSIDE_LITERAL"))
        elif character == "-":
            stack.pop()
            stack.extend((next_state, "INSIDE_NUMBER"))
        elif character.isdigit():
            last_valid_index = index
            stack.pop()
            stack.extend((next_state, "INSIDE_NUMBER"))
        elif character == "{":
            last_valid_index = index
            stack.pop()
            stack.extend((next_state, "INSIDE_OBJECT_START"))
        elif character == "[":
            last_valid_index = index
            stack.pop()
            stack.extend((next_state, "INSIDE_ARRAY_START"))

    def process_after_object_value(character: str, index: int) -> None:
        nonlocal last_valid_index
        if character == ",":
            stack.pop()
            stack.append("INSIDE_OBJECT_AFTER_COMMA")
        elif character == "}":
            last_valid_index = index
            stack.pop()

    def process_after_array_value(character: str, index: int) -> None:
        nonlocal last_valid_index
        if character == ",":
            stack.pop()
            stack.append("INSIDE_ARRAY_AFTER_COMMA")
        elif character == "]":
            last_valid_index = index
            stack.pop()

    for index, character in enumerate(value):
        current_state = stack[-1]
        if current_state == "ROOT":
            process_value_start(character, index, "FINISH")
        elif current_state == "INSIDE_OBJECT_START":
            if character == '"':
                stack.pop()
                stack.append("INSIDE_OBJECT_KEY")
            elif character == "}":
                last_valid_index = index
                stack.pop()
        elif current_state == "INSIDE_OBJECT_AFTER_COMMA":
            if character == '"':
                stack.pop()
                stack.append("INSIDE_OBJECT_KEY")
        elif current_state == "INSIDE_OBJECT_KEY":
            if character == '"':
                stack.pop()
                stack.append("INSIDE_OBJECT_AFTER_KEY")
        elif current_state == "INSIDE_OBJECT_AFTER_KEY":
            if character == ":":
                stack.pop()
                stack.append("INSIDE_OBJECT_BEFORE_VALUE")
        elif current_state == "INSIDE_OBJECT_BEFORE_VALUE":
            process_value_start(character, index, "INSIDE_OBJECT_AFTER_VALUE")
        elif current_state == "INSIDE_OBJECT_AFTER_VALUE":
            process_after_object_value(character, index)
        elif current_state == "INSIDE_STRING":
            if character == '"':
                stack.pop()
                last_valid_index = index
            elif character == "\\":
                stack.append("INSIDE_STRING_ESCAPE")
            else:
                last_valid_index = index
        elif current_state == "INSIDE_ARRAY_START":
            if character == "]":
                last_valid_index = index
                stack.pop()
            else:
                last_valid_index = index
                process_value_start(character, index, "INSIDE_ARRAY_AFTER_VALUE")
        elif current_state == "INSIDE_ARRAY_AFTER_VALUE":
            if character == ",":
                stack.pop()
                stack.append("INSIDE_ARRAY_AFTER_COMMA")
            elif character == "]":
                last_valid_index = index
                stack.pop()
            else:
                last_valid_index = index
        elif current_state == "INSIDE_ARRAY_AFTER_COMMA":
            process_value_start(character, index, "INSIDE_ARRAY_AFTER_VALUE")
        elif current_state == "INSIDE_STRING_ESCAPE":
            stack.pop()
            if character == "u":
                unicode_escape_digits = 0
                stack.append("INSIDE_STRING_UNICODE_ESCAPE")
            else:
                last_valid_index = index
        elif current_state == "INSIDE_STRING_UNICODE_ESCAPE":
            if character in "0123456789abcdefABCDEF":
                unicode_escape_digits += 1
                if unicode_escape_digits == 4:
                    stack.pop()
                    last_valid_index = index
        elif current_state == "INSIDE_NUMBER":
            if character.isdigit():
                last_valid_index = index
            elif character in {"e", "E", "-", "."}:
                pass
            elif character == ",":
                stack.pop()
                if stack[-1] == "INSIDE_ARRAY_AFTER_VALUE":
                    process_after_array_value(character, index)
                elif stack[-1] == "INSIDE_OBJECT_AFTER_VALUE":
                    process_after_object_value(character, index)
            elif character == "}":
                stack.pop()
                if stack[-1] == "INSIDE_OBJECT_AFTER_VALUE":
                    process_after_object_value(character, index)
            elif character == "]":
                stack.pop()
                if stack[-1] == "INSIDE_ARRAY_AFTER_VALUE":
                    process_after_array_value(character, index)
            else:
                stack.pop()
        elif current_state == "INSIDE_LITERAL":
            assert literal_start is not None
            partial_literal = value[literal_start : index + 1]
            if not any(
                literal.startswith(partial_literal) for literal in ("false", "true", "null")
            ):
                stack.pop()
                if stack[-1] == "INSIDE_OBJECT_AFTER_VALUE":
                    process_after_object_value(character, index)
                elif stack[-1] == "INSIDE_ARRAY_AFTER_VALUE":
                    process_after_array_value(character, index)
            else:
                last_valid_index = index

    result = value[: last_valid_index + 1]
    for current_state in reversed(stack):
        if current_state == "INSIDE_STRING":
            result += '"'
        elif current_state in {
            "INSIDE_OBJECT_KEY",
            "INSIDE_OBJECT_AFTER_KEY",
            "INSIDE_OBJECT_AFTER_COMMA",
            "INSIDE_OBJECT_START",
            "INSIDE_OBJECT_BEFORE_VALUE",
            "INSIDE_OBJECT_AFTER_VALUE",
        }:
            result += "}"
        elif current_state in {
            "INSIDE_ARRAY_START",
            "INSIDE_ARRAY_AFTER_COMMA",
            "INSIDE_ARRAY_AFTER_VALUE",
        }:
            result += "]"
        elif current_state == "INSIDE_LITERAL":
            assert literal_start is not None
            partial_literal = value[literal_start:]
            for literal in ("true", "false", "null"):
                if literal.startswith(partial_literal):
                    result += literal[len(partial_literal) :]
                    break
    return result
