# Adapted from ai v0.3.0: https://github.com/vercel-labs/ai-python
# Copyright 2026 Vercel, Inc.
# SPDX-License-Identifier: Apache-2.0
#
# Phoenix patches:
# - Replace the ai.types ID generator with a local, Python 3.10-compatible factory.
# - Forbid unknown fields so persisted messages fail closed.
# - Accept arbitrary tool inputs to preserve compatibility with existing rows.
# - Raise on unknown UI part types instead of silently dropping persisted data.

"""Pydantic models for parsing AI SDK v6 UI messages.

Reference: https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message

These can be used directly with FastAPI for automatic request body parsing.
AI SDK v6 uses a `parts` array instead of legacy `content` string.
"""

from __future__ import annotations

from typing import Any, Literal, cast

import pydantic

_UI_MODEL_CONFIG = pydantic.ConfigDict(populate_by_name=True, extra="forbid")


def _generate_message_id() -> str:
    import secrets  # Avoid importing the Python 3.12-only ai SDK for ID generation.

    return f"msg_{secrets.token_hex(6)}"


class UITextPart(pydantic.BaseModel):
    """Text content part in AI SDK v6 format."""

    model_config = _UI_MODEL_CONFIG

    type: Literal["text"]
    text: str
    state: Literal["streaming", "done"] | None = None
    provider_metadata: dict[str, Any] | None = pydantic.Field(
        default=None, alias="providerMetadata"
    )


class UIReasoningPart(pydantic.BaseModel):
    """Reasoning/thinking content part in AI SDK v6 format.

    Wire shape from the AI SDK frontend is
    ``{type: "reasoning", text, state}``.  ``state`` is
    ``"streaming"`` while the block is open and ``"done"`` once closed;
    we accept it but don't currently route on it.
    """

    model_config = _UI_MODEL_CONFIG

    type: Literal["reasoning"]
    text: str
    state: Literal["streaming", "done"] | None = None
    provider_metadata: dict[str, Any] | None = pydantic.Field(
        default=None, alias="providerMetadata"
    )


class UICustomPart(pydantic.BaseModel):
    """Provider-specific content that does not fit standard UI parts."""

    model_config = _UI_MODEL_CONFIG

    type: Literal["custom"]
    kind: str
    provider_metadata: dict[str, Any] | None = pydantic.Field(
        default=None, alias="providerMetadata"
    )


# Tool invocation states in AI SDK v6:
# - "input-streaming": Tool arguments are being streamed
# - "input-available": Tool arguments are complete, ready for execution
# - "approval-requested": Tool requires user approval before execution
# - "approval-responded": User has responded to approval request
# - "output-available": Tool has been executed, result is available
# - "output-error": Tool execution failed
# - "output-denied": Tool execution was denied by user
UIToolInvocationState = Literal[
    "input-streaming",
    "input-available",
    "approval-requested",
    "approval-responded",
    "output-available",
    "output-error",
    "output-denied",
]


class UIToolInvocationPart(pydantic.BaseModel):
    """Tool invocation part in AI SDK v6 format.

    Note: The AI SDK frontend typically sends tool-{toolName} format instead.
    The legacy type is ``tool-invocation``.
    This model is kept for backwards compatibility.

    Reference: https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message
    """

    model_config = _UI_MODEL_CONFIG

    type: Literal["tool-invocation"]
    tool_invocation_id: str = pydantic.Field(alias="toolInvocationId")
    tool_name: str = pydantic.Field(alias="toolName")
    args: dict[str, Any] = pydantic.Field(default_factory=dict)
    state: UIToolInvocationState = "input-available"
    result: Any | None = None
    provider_executed: bool | None = pydantic.Field(default=None, alias="providerExecuted")


class UIStepStartPart(pydantic.BaseModel):
    """Step boundary marker. Skipped during conversion to internal format."""

    model_config = _UI_MODEL_CONFIG

    type: Literal["step-start"]


class UIToolApproval(pydantic.BaseModel):
    """Approval state on a tool part (AI SDK v6 protocol).

    Present when a tool requires user approval before execution.
    ``id`` matches the hook label used by the ToolApproval hook.
    ``approved`` is None while awaiting a response, True/False after.
    """

    model_config = _UI_MODEL_CONFIG

    id: str
    approved: bool | None = None
    reason: str | None = None
    is_automatic: bool | None = pydantic.Field(default=None, alias="isAutomatic")


class UIToolPart(pydantic.BaseModel):
    """Tool part with dynamic type pattern: tool-{toolName}.

    The AI SDK frontend sends tool parts with type like "tool-get_weather"
    where the tool name is embedded in the type string.
    """

    model_config = _UI_MODEL_CONFIG

    # The actual type string (e.g., "tool-talk_to_mothership")
    # We store this to extract the tool name
    type: str
    tool_call_id: str = pydantic.Field(alias="toolCallId")
    state: UIToolInvocationState
    input: Any = None
    output: Any | None = None
    raw_input: Any | None = pydantic.Field(default=None, alias="rawInput")
    error_text: str | None = pydantic.Field(default=None, alias="errorText")
    approval: UIToolApproval | None = None
    provider_executed: bool | None = pydantic.Field(default=None, alias="providerExecuted")
    call_provider_metadata: dict[str, Any] | None = pydantic.Field(
        default=None, alias="callProviderMetadata"
    )
    result_provider_metadata: dict[str, Any] | None = pydantic.Field(
        default=None, alias="resultProviderMetadata"
    )
    tool_metadata: dict[str, Any] | None = pydantic.Field(default=None, alias="toolMetadata")
    preliminary: bool | None = None
    title: str | None = None

    @property
    def tool_name(self) -> str:
        """Extract tool name from the type string.

        E.g., 'tool-get_weather' -> 'get_weather'.
        """
        if self.type.startswith("tool-"):
            return self.type[5:]
        return self.type


class UIDynamicToolPart(pydantic.BaseModel):
    """Dynamic tool part where the tool name is a field, not the type suffix."""

    model_config = _UI_MODEL_CONFIG

    type: Literal["dynamic-tool"]
    tool_name: str = pydantic.Field(alias="toolName")
    tool_call_id: str = pydantic.Field(alias="toolCallId")
    state: UIToolInvocationState
    input: Any | None = None
    output: Any | None = None
    raw_input: Any | None = pydantic.Field(default=None, alias="rawInput")
    error_text: str | None = pydantic.Field(default=None, alias="errorText")
    approval: UIToolApproval | None = None
    provider_executed: bool | None = pydantic.Field(default=None, alias="providerExecuted")
    call_provider_metadata: dict[str, Any] | None = pydantic.Field(
        default=None, alias="callProviderMetadata"
    )
    result_provider_metadata: dict[str, Any] | None = pydantic.Field(
        default=None, alias="resultProviderMetadata"
    )
    tool_metadata: dict[str, Any] | None = pydantic.Field(default=None, alias="toolMetadata")
    preliminary: bool | None = None
    title: str | None = None


class UIFilePart(pydantic.BaseModel):
    """File part. TODO: FilePart not yet supported in core messages."""

    model_config = _UI_MODEL_CONFIG

    type: Literal["file"]
    media_type: str = pydantic.Field(alias="mediaType")
    url: str
    filename: str | None = None
    provider_reference: dict[str, Any] | None = pydantic.Field(
        default=None, alias="providerReference"
    )
    provider_metadata: dict[str, Any] | None = pydantic.Field(
        default=None, alias="providerMetadata"
    )


class UIReasoningFilePart(pydantic.BaseModel):
    """Reasoning file part generated as part of model reasoning."""

    model_config = _UI_MODEL_CONFIG

    type: Literal["reasoning-file"]
    media_type: str = pydantic.Field(alias="mediaType")
    url: str
    provider_metadata: dict[str, Any] | None = pydantic.Field(
        default=None, alias="providerMetadata"
    )


class UISourceUrlPart(pydantic.BaseModel):
    """Source URL part. TODO: SourceUrlPart not yet supported."""

    model_config = _UI_MODEL_CONFIG

    type: Literal["source-url"]
    source_id: str = pydantic.Field(alias="sourceId")
    url: str
    title: str | None = None
    provider_metadata: dict[str, Any] | None = pydantic.Field(
        default=None, alias="providerMetadata"
    )


class UISourceDocumentPart(pydantic.BaseModel):
    """Source document part. TODO: SourceDocumentPart not yet supported."""

    model_config = _UI_MODEL_CONFIG

    type: Literal["source-document"]
    source_id: str = pydantic.Field(alias="sourceId")
    media_type: str = pydantic.Field(alias="mediaType")
    title: str
    filename: str | None = None
    provider_metadata: dict[str, Any] | None = pydantic.Field(
        default=None, alias="providerMetadata"
    )


class UIDataPart(pydantic.BaseModel):
    """Custom data part with a dynamic ``data-*`` type."""

    model_config = _UI_MODEL_CONFIG

    type: str
    id: str | None = None
    data: Any
    transient: bool | None = None


# Union of all supported part types (used for type hints)
UIMessagePart = (
    UITextPart
    | UIReasoningPart
    | UICustomPart
    | UIToolInvocationPart
    | UIStepStartPart
    | UIToolPart
    | UIDynamicToolPart
    | UIFilePart
    | UIReasoningFilePart
    | UISourceUrlPart
    | UISourceDocumentPart
    | UIDataPart
)


_STATIC_UI_PART_TYPES: dict[str, type[pydantic.BaseModel]] = {
    "text": UITextPart,
    "reasoning": UIReasoningPart,
    "custom": UICustomPart,
    "tool-invocation": UIToolInvocationPart,
    "step-start": UIStepStartPart,
    "file": UIFilePart,
    "reasoning-file": UIReasoningFilePart,
    "source-url": UISourceUrlPart,
    "source-document": UISourceDocumentPart,
    "dynamic-tool": UIDynamicToolPart,
}


def _parse_ui_part(part_data: dict[str, Any]) -> UIMessagePart:
    """Parse a UI part dict, handling dynamic type patterns."""
    part_type = part_data.get("type", "")

    if model_cls := _STATIC_UI_PART_TYPES.get(part_type):
        return cast("UIMessagePart", model_cls.model_validate(part_data))

    match part_type:
        case str() as t if t.startswith("tool-"):
            # Dynamic tool type: tool-{toolName} (e.g., "tool-get_weather")
            return UIToolPart.model_validate(part_data)
        case str() as t if t.startswith("data-"):
            return UIDataPart.model_validate(part_data)
        case _:
            raise ValueError(f"Unsupported UI part type: {part_type!r}")


class UIMessage(pydantic.BaseModel):
    """Message in AI SDK v6 format.

    Reference: https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message
    """

    model_config = _UI_MODEL_CONFIG

    id: str = pydantic.Field(default_factory=_generate_message_id)
    role: Literal["user", "assistant", "system"]
    metadata: Any | None = None
    parts: list[UIMessagePart] = pydantic.Field(default_factory=list)

    @pydantic.field_validator("parts", mode="before")
    @classmethod
    def parse_parts(cls, v: list[dict[str, Any]]) -> list[UIMessagePart]:
        """Parse parts using custom logic to handle dynamic type patterns."""
        if not isinstance(v, list):
            return v
        result: list[UIMessagePart] = []
        for part_data in v:
            if isinstance(part_data, dict):
                result.append(_parse_ui_part(part_data))
            else:
                # Already parsed (e.g., in tests)
                result.append(part_data)
        return result
