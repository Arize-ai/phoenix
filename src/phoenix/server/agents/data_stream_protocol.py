from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from pydantic_ai.ui.vercel_ai.request_types import (
    DataUIPart,
    DynamicToolApprovalRequestedPart,
    DynamicToolInputAvailablePart,
    DynamicToolInputStreamingPart,
    DynamicToolOutputAvailablePart,
    DynamicToolOutputDeniedPart,
    DynamicToolOutputErrorPart,
    FileUIPart,
    ProviderMetadata,
    ReasoningUIPart,
    SourceDocumentUIPart,
    SourceUrlUIPart,
    StepStartUIPart,
    TextUIPart,
    ToolApprovalRequested,
    ToolApprovalRequestedPart,
    ToolInputAvailablePart,
    ToolInputStreamingPart,
    ToolOutputAvailablePart,
    ToolOutputDeniedPart,
    ToolOutputErrorPart,
    UIMessage,
    UIMessagePart,
)
from pydantic_ai.ui.vercel_ai.response_types import (
    AbortChunk,
    BaseChunk,
    DataChunk,
    ErrorChunk,
    FileChunk,
    FinishChunk,
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
    ToolApprovalRequestChunk,
    ToolInputAvailableChunk,
    ToolInputDeltaChunk,
    ToolInputErrorChunk,
    ToolInputStartChunk,
    ToolOutputAvailableChunk,
    ToolOutputDeniedChunk,
    ToolOutputErrorChunk,
)

_DEFAULT_MESSAGE_ID = "subagent-message"
_UNKNOWN_TOOL_NAME = "unknown"

_STATIC_TOOL_PART_TYPES = (
    ToolInputStreamingPart,
    ToolInputAvailablePart,
    ToolOutputAvailablePart,
    ToolOutputErrorPart,
    ToolApprovalRequestedPart,
    ToolOutputDeniedPart,
)
_DYNAMIC_TOOL_PART_TYPES = (
    DynamicToolInputStreamingPart,
    DynamicToolInputAvailablePart,
    DynamicToolOutputAvailablePart,
    DynamicToolOutputErrorPart,
    DynamicToolApprovalRequestedPart,
    DynamicToolOutputDeniedPart,
)
_TOOL_PART_TYPES = (*_STATIC_TOOL_PART_TYPES, *_DYNAMIC_TOOL_PART_TYPES)


async def accumulate_ui_message_chunks_to_ui_messages(
    chunks: AsyncIterator[BaseChunk],
) -> AsyncIterator[UIMessage]:
    """Accumulate Vercel UI message stream chunks into progressive messages."""
    message = UIMessage(id=_DEFAULT_MESSAGE_ID, role="assistant", parts=[])
    text_part_indices_by_id: dict[str, int] = {}
    reasoning_part_indices_by_id: dict[str, int] = {}
    tool_part_indices_by_call_id: dict[str, int] = {}
    tool_input_text_by_call_id: dict[str, str] = {}

    async for chunk in chunks:
        changed = False
        if isinstance(chunk, StartChunk):
            if chunk.message_id is not None:
                message.id = chunk.message_id
                changed = True
            if chunk.message_metadata is not None:
                message.metadata = _merge_metadata(message.metadata, chunk.message_metadata)
                changed = True
        elif isinstance(chunk, MessageMetadataChunk):
            message.metadata = _merge_metadata(message.metadata, chunk.message_metadata)
            changed = True
        elif isinstance(chunk, FinishChunk):
            if chunk.message_metadata is not None:
                message.metadata = _merge_metadata(message.metadata, chunk.message_metadata)
                changed = True
        elif isinstance(chunk, StartStepChunk):
            message.parts.append(StepStartUIPart())
            changed = True
        elif isinstance(chunk, TextStartChunk):
            text_part_indices_by_id[chunk.id] = len(message.parts)
            message.parts.append(
                TextUIPart(
                    text="",
                    state="streaming",
                    provider_metadata=chunk.provider_metadata,
                )
            )
            changed = True
        elif isinstance(chunk, TextDeltaChunk):
            index = _ensure_text_part(message, text_part_indices_by_id, chunk.id)
            part = message.parts[index]
            assert isinstance(part, TextUIPart)
            part.text += chunk.delta
            part.provider_metadata = _merge_provider_metadata(
                part.provider_metadata,
                chunk.provider_metadata,
            )
            changed = True
        elif isinstance(chunk, TextEndChunk):
            index = _ensure_text_part(message, text_part_indices_by_id, chunk.id)
            part = message.parts[index]
            assert isinstance(part, TextUIPart)
            part.state = "done"
            part.provider_metadata = _merge_provider_metadata(
                part.provider_metadata,
                chunk.provider_metadata,
            )
            changed = True
        elif isinstance(chunk, ReasoningStartChunk):
            reasoning_part_indices_by_id[chunk.id] = len(message.parts)
            message.parts.append(
                ReasoningUIPart(
                    text="",
                    state="streaming",
                    provider_metadata=chunk.provider_metadata,
                )
            )
            changed = True
        elif isinstance(chunk, ReasoningDeltaChunk):
            index = _ensure_reasoning_part(message, reasoning_part_indices_by_id, chunk.id)
            part = message.parts[index]
            assert isinstance(part, ReasoningUIPart)
            part.text += chunk.delta
            part.provider_metadata = _merge_provider_metadata(
                part.provider_metadata,
                chunk.provider_metadata,
            )
            changed = True
        elif isinstance(chunk, ReasoningEndChunk):
            index = _ensure_reasoning_part(message, reasoning_part_indices_by_id, chunk.id)
            part = message.parts[index]
            assert isinstance(part, ReasoningUIPart)
            part.state = "done"
            part.provider_metadata = _merge_provider_metadata(
                part.provider_metadata,
                chunk.provider_metadata,
            )
            changed = True
        elif isinstance(chunk, ToolInputStartChunk):
            _upsert_tool_part(
                message=message,
                indices_by_call_id=tool_part_indices_by_call_id,
                tool_call_id=chunk.tool_call_id,
                part=_build_tool_input_streaming_part(
                    tool_call_id=chunk.tool_call_id,
                    tool_name=chunk.tool_name,
                    input_value=None,
                    provider_executed=chunk.provider_executed,
                    provider_metadata=chunk.provider_metadata,
                    dynamic=chunk.dynamic is True,
                ),
            )
            changed = True
        elif isinstance(chunk, ToolInputDeltaChunk):
            existing_part = _get_tool_part(
                message,
                tool_part_indices_by_call_id,
                chunk.tool_call_id,
            )
            input_text = (
                tool_input_text_by_call_id.get(chunk.tool_call_id, "") + chunk.input_text_delta
            )
            tool_input_text_by_call_id[chunk.tool_call_id] = input_text
            _upsert_tool_part(
                message=message,
                indices_by_call_id=tool_part_indices_by_call_id,
                tool_call_id=chunk.tool_call_id,
                part=_build_tool_input_streaming_part(
                    tool_call_id=chunk.tool_call_id,
                    tool_name=_get_tool_name(existing_part),
                    input_value=input_text,
                    provider_executed=_get_provider_executed(existing_part),
                    provider_metadata=_get_call_provider_metadata(existing_part),
                    dynamic=_is_dynamic_tool_part(existing_part),
                ),
            )
            changed = True
        elif isinstance(chunk, ToolInputAvailableChunk):
            existing_part = _get_tool_part(
                message,
                tool_part_indices_by_call_id,
                chunk.tool_call_id,
            )
            _upsert_tool_part(
                message=message,
                indices_by_call_id=tool_part_indices_by_call_id,
                tool_call_id=chunk.tool_call_id,
                part=_build_tool_input_available_part(
                    tool_call_id=chunk.tool_call_id,
                    tool_name=chunk.tool_name,
                    input_value=chunk.input,
                    provider_executed=chunk.provider_executed,
                    provider_metadata=chunk.provider_metadata
                    or _get_call_provider_metadata(existing_part),
                    dynamic=chunk.dynamic is True,
                ),
            )
            changed = True
        elif isinstance(chunk, ToolInputErrorChunk):
            _upsert_tool_part(
                message=message,
                indices_by_call_id=tool_part_indices_by_call_id,
                tool_call_id=chunk.tool_call_id,
                part=_build_tool_output_error_part(
                    tool_call_id=chunk.tool_call_id,
                    tool_name=chunk.tool_name,
                    input_value=chunk.input,
                    error_text=chunk.error_text,
                    provider_executed=chunk.provider_executed,
                    provider_metadata=chunk.provider_metadata,
                    dynamic=chunk.dynamic is True,
                    raw_input=chunk.input,
                ),
            )
            changed = True
        elif isinstance(chunk, ToolOutputAvailableChunk):
            existing_part = _get_tool_part(
                message,
                tool_part_indices_by_call_id,
                chunk.tool_call_id,
            )
            _upsert_tool_part(
                message=message,
                indices_by_call_id=tool_part_indices_by_call_id,
                tool_call_id=chunk.tool_call_id,
                part=_build_tool_output_available_part(
                    tool_call_id=chunk.tool_call_id,
                    tool_name=_get_tool_name(existing_part),
                    input_value=_get_tool_input(existing_part),
                    output=chunk.output,
                    provider_executed=chunk.provider_executed
                    if chunk.provider_executed is not None
                    else _get_provider_executed(existing_part),
                    provider_metadata=_get_call_provider_metadata(existing_part),
                    dynamic=chunk.dynamic is True or _is_dynamic_tool_part(existing_part),
                    preliminary=chunk.preliminary,
                    existing_type=_get_static_tool_type(existing_part),
                ),
            )
            changed = True
        elif isinstance(chunk, ToolOutputErrorChunk):
            existing_part = _get_tool_part(
                message,
                tool_part_indices_by_call_id,
                chunk.tool_call_id,
            )
            _upsert_tool_part(
                message=message,
                indices_by_call_id=tool_part_indices_by_call_id,
                tool_call_id=chunk.tool_call_id,
                part=_build_tool_output_error_part(
                    tool_call_id=chunk.tool_call_id,
                    tool_name=_get_tool_name(existing_part),
                    input_value=_get_tool_input(existing_part),
                    error_text=chunk.error_text,
                    provider_executed=chunk.provider_executed
                    if chunk.provider_executed is not None
                    else _get_provider_executed(existing_part),
                    provider_metadata=_get_call_provider_metadata(existing_part),
                    dynamic=chunk.dynamic is True or _is_dynamic_tool_part(existing_part),
                    existing_type=_get_static_tool_type(existing_part),
                ),
            )
            changed = True
        elif isinstance(chunk, ToolApprovalRequestChunk):
            existing_part = _get_tool_part(
                message,
                tool_part_indices_by_call_id,
                chunk.tool_call_id,
            )
            _upsert_tool_part(
                message=message,
                indices_by_call_id=tool_part_indices_by_call_id,
                tool_call_id=chunk.tool_call_id,
                part=_build_tool_approval_requested_part(
                    tool_call_id=chunk.tool_call_id,
                    tool_name=_get_tool_name(existing_part),
                    input_value=_get_tool_input(existing_part),
                    provider_executed=_get_provider_executed(existing_part),
                    provider_metadata=_get_call_provider_metadata(existing_part),
                    dynamic=_is_dynamic_tool_part(existing_part),
                    approval_id=chunk.approval_id,
                    existing_type=_get_static_tool_type(existing_part),
                ),
            )
            changed = True
        elif isinstance(chunk, ToolOutputDeniedChunk):
            existing_part = _get_tool_part(
                message,
                tool_part_indices_by_call_id,
                chunk.tool_call_id,
            )
            _upsert_tool_part(
                message=message,
                indices_by_call_id=tool_part_indices_by_call_id,
                tool_call_id=chunk.tool_call_id,
                part=_build_tool_output_denied_part(
                    tool_call_id=chunk.tool_call_id,
                    tool_name=_get_tool_name(existing_part),
                    input_value=_get_tool_input(existing_part),
                    provider_executed=_get_provider_executed(existing_part),
                    provider_metadata=_get_call_provider_metadata(existing_part),
                    dynamic=_is_dynamic_tool_part(existing_part),
                    existing_type=_get_static_tool_type(existing_part),
                ),
            )
            changed = True
        elif isinstance(chunk, SourceUrlChunk):
            message.parts.append(
                SourceUrlUIPart(
                    source_id=chunk.source_id,
                    url=chunk.url,
                    title=chunk.title,
                    provider_metadata=chunk.provider_metadata,
                )
            )
            changed = True
        elif isinstance(chunk, SourceDocumentChunk):
            message.parts.append(
                SourceDocumentUIPart(
                    source_id=chunk.source_id,
                    media_type=chunk.media_type,
                    title=chunk.title,
                    filename=chunk.filename,
                    provider_metadata=chunk.provider_metadata,
                )
            )
            changed = True
        elif isinstance(chunk, FileChunk):
            message.parts.append(FileUIPart(url=chunk.url, media_type=chunk.media_type))
            changed = True
        elif isinstance(chunk, DataChunk):
            message.parts.append(DataUIPart(type=chunk.type, id=chunk.id, data=chunk.data))
            changed = True
        elif isinstance(chunk, ErrorChunk):
            message.parts.append(
                DataUIPart(type="data-error", data={"errorText": chunk.error_text})
            )
            changed = True
        elif isinstance(chunk, AbortChunk):
            message.parts.append(DataUIPart(type="data-abort", data={"reason": chunk.reason}))
            changed = True

        if changed:
            yield message.model_copy(deep=True)


def _ensure_text_part(
    message: UIMessage,
    indices_by_id: dict[str, int],
    part_id: str,
) -> int:
    index = indices_by_id.get(part_id)
    if index is None:
        index = len(message.parts)
        indices_by_id[part_id] = index
        message.parts.append(TextUIPart(text="", state="streaming"))
    return index


def _ensure_reasoning_part(
    message: UIMessage,
    indices_by_id: dict[str, int],
    part_id: str,
) -> int:
    index = indices_by_id.get(part_id)
    if index is None:
        index = len(message.parts)
        indices_by_id[part_id] = index
        message.parts.append(ReasoningUIPart(text="", state="streaming"))
    return index


def _get_tool_part(
    message: UIMessage,
    indices_by_call_id: dict[str, int],
    tool_call_id: str,
) -> UIMessagePart | None:
    index = indices_by_call_id.get(tool_call_id)
    if index is None:
        return None
    part = message.parts[index]
    return part if isinstance(part, _TOOL_PART_TYPES) else None


def _upsert_tool_part(
    *,
    message: UIMessage,
    indices_by_call_id: dict[str, int],
    tool_call_id: str,
    part: UIMessagePart,
) -> None:
    index = indices_by_call_id.get(tool_call_id)
    if index is None:
        indices_by_call_id[tool_call_id] = len(message.parts)
        message.parts.append(part)
    else:
        message.parts[index] = part


def _build_tool_input_streaming_part(
    *,
    tool_call_id: str,
    tool_name: str,
    input_value: Any,
    provider_executed: bool | None,
    provider_metadata: ProviderMetadata | None,
    dynamic: bool,
) -> UIMessagePart:
    if dynamic:
        return DynamicToolInputStreamingPart(
            tool_name=tool_name,
            tool_call_id=tool_call_id,
            input=input_value,
            provider_executed=provider_executed,
            call_provider_metadata=provider_metadata,
        )
    return ToolInputStreamingPart(
        type=_get_tool_type(tool_name),
        tool_call_id=tool_call_id,
        input=input_value,
        provider_executed=provider_executed,
        call_provider_metadata=provider_metadata,
    )


def _build_tool_input_available_part(
    *,
    tool_call_id: str,
    tool_name: str,
    input_value: Any,
    provider_executed: bool | None,
    provider_metadata: ProviderMetadata | None,
    dynamic: bool,
) -> UIMessagePart:
    if dynamic:
        return DynamicToolInputAvailablePart(
            tool_name=tool_name,
            tool_call_id=tool_call_id,
            input=input_value,
            provider_executed=provider_executed,
            call_provider_metadata=provider_metadata,
        )
    return ToolInputAvailablePart(
        type=_get_tool_type(tool_name),
        tool_call_id=tool_call_id,
        input=input_value,
        provider_executed=provider_executed,
        call_provider_metadata=provider_metadata,
    )


def _build_tool_output_available_part(
    *,
    tool_call_id: str,
    tool_name: str,
    input_value: Any,
    output: Any,
    provider_executed: bool | None,
    provider_metadata: ProviderMetadata | None,
    dynamic: bool,
    preliminary: bool | None,
    existing_type: str | None = None,
) -> UIMessagePart:
    if dynamic:
        return DynamicToolOutputAvailablePart(
            tool_name=tool_name,
            tool_call_id=tool_call_id,
            input=input_value,
            output=output,
            provider_executed=provider_executed,
            call_provider_metadata=provider_metadata,
            preliminary=preliminary,
        )
    return ToolOutputAvailablePart(
        type=existing_type or _get_tool_type(tool_name),
        tool_call_id=tool_call_id,
        input=input_value,
        output=output,
        provider_executed=provider_executed,
        call_provider_metadata=provider_metadata,
        preliminary=preliminary,
    )


def _build_tool_output_error_part(
    *,
    tool_call_id: str,
    tool_name: str,
    input_value: Any,
    error_text: str,
    provider_executed: bool | None,
    provider_metadata: ProviderMetadata | None,
    dynamic: bool,
    existing_type: str | None = None,
    raw_input: Any | None = None,
) -> UIMessagePart:
    if dynamic:
        return DynamicToolOutputErrorPart(
            tool_name=tool_name,
            tool_call_id=tool_call_id,
            input=input_value,
            error_text=error_text,
            provider_executed=provider_executed,
            call_provider_metadata=provider_metadata,
        )
    return ToolOutputErrorPart(
        type=existing_type or _get_tool_type(tool_name),
        tool_call_id=tool_call_id,
        input=input_value,
        raw_input=raw_input,
        error_text=error_text,
        provider_executed=provider_executed,
        call_provider_metadata=provider_metadata,
    )


def _build_tool_approval_requested_part(
    *,
    tool_call_id: str,
    tool_name: str,
    input_value: Any,
    provider_executed: bool | None,
    provider_metadata: ProviderMetadata | None,
    dynamic: bool,
    approval_id: str,
    existing_type: str | None = None,
) -> UIMessagePart:
    approval = ToolApprovalRequested(id=approval_id)
    if dynamic:
        return DynamicToolApprovalRequestedPart(
            tool_name=tool_name,
            tool_call_id=tool_call_id,
            input=input_value,
            provider_executed=provider_executed,
            call_provider_metadata=provider_metadata,
            approval=approval,
        )
    return ToolApprovalRequestedPart(
        type=existing_type or _get_tool_type(tool_name),
        tool_call_id=tool_call_id,
        input=input_value,
        provider_executed=provider_executed,
        call_provider_metadata=provider_metadata,
        approval=approval,
    )


def _build_tool_output_denied_part(
    *,
    tool_call_id: str,
    tool_name: str,
    input_value: Any,
    provider_executed: bool | None,
    provider_metadata: ProviderMetadata | None,
    dynamic: bool,
    existing_type: str | None = None,
) -> UIMessagePart:
    if dynamic:
        return DynamicToolOutputDeniedPart(
            tool_name=tool_name,
            tool_call_id=tool_call_id,
            input=input_value,
            provider_executed=provider_executed,
            call_provider_metadata=provider_metadata,
        )
    return ToolOutputDeniedPart(
        type=existing_type or _get_tool_type(tool_name),
        tool_call_id=tool_call_id,
        input=input_value,
        provider_executed=provider_executed,
        call_provider_metadata=provider_metadata,
    )


def _get_tool_type(tool_name: str) -> str:
    return f"tool-{tool_name or _UNKNOWN_TOOL_NAME}"


def _get_tool_name(part: UIMessagePart | None) -> str:
    if isinstance(part, _DYNAMIC_TOOL_PART_TYPES):
        return part.tool_name
    if isinstance(part, _STATIC_TOOL_PART_TYPES):
        return part.type.removeprefix("tool-")
    return _UNKNOWN_TOOL_NAME


def _get_static_tool_type(part: UIMessagePart | None) -> str | None:
    return part.type if isinstance(part, _STATIC_TOOL_PART_TYPES) else None


def _is_dynamic_tool_part(part: UIMessagePart | None) -> bool:
    return isinstance(part, _DYNAMIC_TOOL_PART_TYPES)


def _get_tool_input(part: UIMessagePart | None) -> Any:
    if isinstance(part, _TOOL_PART_TYPES):
        return part.input
    return None


def _get_provider_executed(part: UIMessagePart | None) -> bool | None:
    if isinstance(part, _TOOL_PART_TYPES):
        return part.provider_executed
    return None


def _get_call_provider_metadata(part: UIMessagePart | None) -> ProviderMetadata | None:
    if isinstance(part, _TOOL_PART_TYPES):
        return part.call_provider_metadata
    return None


def _merge_metadata(existing: Any, new: Any) -> Any:
    if isinstance(existing, dict) and isinstance(new, dict):
        return {**existing, **new}
    return new


def _merge_provider_metadata(
    existing: ProviderMetadata | None,
    new: ProviderMetadata | None,
) -> ProviderMetadata | None:
    if existing is None:
        return new
    if new is None:
        return existing
    return {**existing, **new}
