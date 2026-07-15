"""Phoenix-specific UI message types persisted by agent sessions."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import ConfigDict, Field, StringConstraints

from ._models import CamelBaseModel
from .request_types import UIMessage


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


MessageMetadata = Annotated[
    AssistantMessageMetadata | UserMessageMetadata,
    Field(discriminator="type"),
]


class PhoenixUIMessage(UIMessage):
    """``UIMessage`` with metadata narrowed to the Phoenix wire shapes."""

    metadata: MessageMetadata | None = None
