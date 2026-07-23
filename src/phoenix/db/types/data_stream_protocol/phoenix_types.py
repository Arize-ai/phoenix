"""Phoenix-specific UI message types persisted by agent sessions."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import ConfigDict, Field, StringConstraints, TypeAdapter, model_validator

from ._models import CamelBaseModel
from ._ui_messages import UIMessage
from .provider_metadata import ToolCallCallbackProviderMetadata

_PHOENIX_PROVIDER_METADATA_KEY = "phoenix"
_ToolCallCallbackProviderMetadataAdapter = TypeAdapter(ToolCallCallbackProviderMetadata)


class AssistantMessageMetadataUsageTokens(CamelBaseModel):
    prompt: int
    completion: int
    total: int


class AssistantMessageMetadataUsageTokenDetails(CamelBaseModel):
    cache_read: int
    cache_write: int


class AssistantMessageMetadataUsage(CamelBaseModel):
    tokens: AssistantMessageMetadataUsageTokens
    prompt_details: AssistantMessageMetadataUsageTokenDetails | None = None


class AssistantMessageMetadataTraceIds(CamelBaseModel):
    trace_id: str
    root_span_id: str


class TurnTraceContext(CamelBaseModel):
    trace_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    root_span_id: str = Field(pattern=r"^[0-9a-f]{16}$")
    started_at: datetime


class AssistantMessageMetadata(CamelBaseModel):
    """Wire schema for the chat stream's ``message_metadata`` payload."""

    model_config = ConfigDict(extra="allow")

    type: Literal["assistant"] = "assistant"
    session_id: str
    trace: AssistantMessageMetadataTraceIds | None = None
    turn_trace_context: TurnTraceContext | None = None
    usage: AssistantMessageMetadataUsage | None = None


class UserMessageMetadata(CamelBaseModel):
    """Wire schema for metadata the browser attaches to outgoing user messages."""

    type: Literal["user"] = "user"
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
