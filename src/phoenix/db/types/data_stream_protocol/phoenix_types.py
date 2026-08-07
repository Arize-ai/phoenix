"""Phoenix-specific UI message types persisted by agent sessions."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import ConfigDict, Field, StringConstraints, TypeAdapter, model_validator
from typing_extensions import assert_never

from ._models import CamelBaseModel
from .provider_metadata import (
    PydanticAIReasoningProviderMetadata,
    PydanticAITextProviderMetadata,
    PydanticAIToolCallProviderMetadata,
    ToolCallCallbackProviderMetadata,
)
from .request_types import (
    DataUIPart,
    DynamicToolOutputAvailablePart,
    DynamicToolOutputErrorPart,
    DynamicToolUIPart,
    FileUIPart,
    ProviderMetadata,
    ReasoningUIPart,
    SourceDocumentUIPart,
    SourceUrlUIPart,
    StepStartUIPart,
    TextUIPart,
    ToolOutputAvailablePart,
    ToolOutputErrorPart,
    ToolUIPart,
    UIMessage,
)

_PHOENIX_PROVIDER_METADATA_KEY = "phoenix"
_PYDANTIC_AI_PROVIDER_METADATA_KEY = "pydantic_ai"
_ToolCallCallbackProviderMetadataAdapter = TypeAdapter(ToolCallCallbackProviderMetadata)
_PydanticAITextProviderMetadataAdapter = TypeAdapter(PydanticAITextProviderMetadata)
_PydanticAIReasoningProviderMetadataAdapter = TypeAdapter(PydanticAIReasoningProviderMetadata)
_PydanticAIToolCallProviderMetadataAdapter = TypeAdapter(PydanticAIToolCallProviderMetadata)


_TOOL_RESULT_METADATA_PART_TYPES = (
    ToolOutputAvailablePart
    | ToolOutputErrorPart
    | DynamicToolOutputAvailablePart
    | DynamicToolOutputErrorPart
)
"""Tool part states carrying Phoenix's added ``result_provider_metadata``."""


def _pydantic_ai_metadata(provider_metadata: object) -> object | None:
    """The ``pydantic_ai`` namespace of a part's ``providerMetadata``, if any."""
    if not isinstance(provider_metadata, dict):
        return None
    return provider_metadata.get(_PYDANTIC_AI_PROVIDER_METADATA_KEY)


class AgentErrorData(CamelBaseModel):
    """Payload of the durable ``data-error`` part persisted for protocol errors."""

    error_text: str


_DATA_PART_PAYLOAD_TYPES: dict[str, type[CamelBaseModel]] = {
    "data-error": AgentErrorData,
}
"""Payload schemas for the data part types allowed in persisted messages."""


class AssistantMessageMetadataUsageTokens(CamelBaseModel):
    prompt: int
    completion: int
    total: int


class AssistantMessageMetadataUsageCacheTokenDetails(CamelBaseModel):
    """Prompt-cache token counts, mounted as the usage payload's
    ``prompt_details`` because cached tokens are a breakdown of the prompt."""

    cache_read: int
    cache_write: int


class AssistantMessageMetadataUsage(CamelBaseModel):
    tokens: AssistantMessageMetadataUsageTokens
    prompt_details: AssistantMessageMetadataUsageCacheTokenDetails | None = None


class TurnTraceContext(CamelBaseModel):
    """The trace identity a turn's spans are parented to."""

    trace_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    root_span_id: str = Field(pattern=r"^[0-9a-f]{16}$")
    started_at: datetime


class AssistantMessageMetadata(CamelBaseModel):
    """Wire schema for the chat stream's ``message_metadata`` payload."""

    model_config = ConfigDict(extra="allow")

    type: Literal["assistant"]
    session_id: str
    turn_trace_context: TurnTraceContext | None = None
    usage: AssistantMessageMetadataUsage | None = None
    interrupted: bool = False


class UserMessageMetadata(CamelBaseModel):
    """Wire schema for metadata the browser attaches to outgoing user messages."""

    type: Literal["user"]
    current_date_time: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)]
    time_zone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)]
    is_compaction_message: bool = False


MessageMetadata = Annotated[
    AssistantMessageMetadata | UserMessageMetadata,
    Field(discriminator="type"),
]


class PhoenixUIMessage(UIMessage):
    """``UIMessage`` with metadata narrowed to the Phoenix wire shapes."""

    metadata: MessageMetadata | None = None

    @model_validator(mode="after")
    def _validate_metadata_matches_role(self) -> "PhoenixUIMessage":
        if self.metadata is not None and self.metadata.type != self.role:
            raise ValueError(f"{self.role}-role message cannot carry {self.metadata.type} metadata")
        return self

    @model_validator(mode="after")
    def _validate_phoenix_tool_call_metadata(self) -> "PhoenixUIMessage":
        for part in self.parts:
            call_provider_metadata = getattr(part, "call_provider_metadata", None)
            if not isinstance(call_provider_metadata, dict):
                continue
            phoenix_metadata = call_provider_metadata.get(_PHOENIX_PROVIDER_METADATA_KEY)
            if phoenix_metadata is None:
                continue
            _ToolCallCallbackProviderMetadataAdapter.validate_python(phoenix_metadata)
        return self

    @model_validator(mode="after")
    def _validate_pydantic_ai_provider_metadata(self) -> "PhoenixUIMessage":
        """Strictly validate the ``pydantic_ai`` namespace wherever it appears."""
        for part in self.parts:
            if isinstance(part, ToolUIPart | DynamicToolUIPart):
                provider_metadata_values: list[ProviderMetadata | None] = [
                    part.call_provider_metadata
                ]
                if isinstance(part, _TOOL_RESULT_METADATA_PART_TYPES):
                    provider_metadata_values.append(part.result_provider_metadata)
                for provider_metadata in provider_metadata_values:
                    metadata = _pydantic_ai_metadata(provider_metadata)
                    if metadata is not None:
                        _PydanticAIToolCallProviderMetadataAdapter.validate_python(metadata)
            elif isinstance(part, TextUIPart):
                metadata = _pydantic_ai_metadata(part.provider_metadata)
                if metadata is not None:
                    _PydanticAITextProviderMetadataAdapter.validate_python(metadata)
            elif isinstance(part, ReasoningUIPart):
                metadata = _pydantic_ai_metadata(part.provider_metadata)
                if metadata is not None:
                    _PydanticAIReasoningProviderMetadataAdapter.validate_python(metadata)
            elif isinstance(part, FileUIPart | SourceUrlUIPart | SourceDocumentUIPart):
                if _pydantic_ai_metadata(part.provider_metadata) is not None:
                    raise ValueError(
                        f"{part.type!r} parts have no schema for the "
                        f"{_PYDANTIC_AI_PROVIDER_METADATA_KEY!r} provider-metadata namespace"
                    )
            elif isinstance(part, StepStartUIPart | DataUIPart):
                pass
            else:
                assert_never(part)
        return self

    @model_validator(mode="after")
    def _validate_data_parts(self) -> "PhoenixUIMessage":
        for part in self.parts:
            if not isinstance(part, DataUIPart):
                continue
            payload_type = _DATA_PART_PAYLOAD_TYPES.get(part.type)
            if payload_type is None:
                raise ValueError(f"Unsupported data part type: {part.type!r}")
            payload_type.model_validate(part.data)
        return self
