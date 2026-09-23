"""The ``phoenix`` and ``pydantic_ai`` namespaces of part-level Vercel AI
``providerMetadata``, validated at persist time by ``PhoenixUIMessage``."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, JsonValue

from ._models import CamelBaseModel

ToolExecutionEnvironment = Literal["client", "server"]


class PhoenixToolCallProviderMetadata(CamelBaseModel):
    """Payload Phoenix stamps under the ``phoenix`` namespace of Vercel AI
    ``providerMetadata`` on tool-call chunks (``tool-input-start`` and
    ``tool-input-available``)."""

    tool_execution_environment: ToolExecutionEnvironment
    """Whether the tool is executed on the client (external toolset) or on the
    Phoenix server (everything else, e.g. MCP tools and function tools)."""

    tool_input_emitted_at: str | None = None
    """RFC3339 server timestamp for a client tool-call chunk."""


class PhoenixToolCallCallbackProviderMetadata(PhoenixToolCallProviderMetadata):
    """Shape of the ``phoenix`` namespace the browser returns in
    ``callProviderMetadata`` on resolved tool parts: the server-stamped fields
    plus browser-recorded execution timings."""

    client_started_at: str | None = None
    """RFC3339 browser timestamp taken when client tool execution started."""

    client_ended_at: str | None = None
    """RFC3339 browser timestamp taken when client tool execution ended."""

    outcome: Literal["interrupted"] | None = None
    """The call was closed out by a lifecycle cleanup (user stop, surface
    teardown, server-side repair) rather than a real result."""


PydanticAIToolPartKind = Literal["tool-search", "capability-load"]
"""Local pin of pydantic-ai's ``ToolPartKind``."""


class PydanticAIMessageMetadata(BaseModel):
    """Local pin of pydantic-ai's message-level ``pydantic_ai`` metadata
    namespace (its private ``_PydanticAIMessageMetadata``), merged into the
    assistant metadata by the stream's metadata chunk."""

    model_config = ConfigDict(extra="forbid")

    timestamp: datetime | None = None
    """Round-trip channel for ``ModelResponse.timestamp`` — the only field
    upstream dumps and restores."""


class _BasePydanticAIProviderMetadata(BaseModel):
    """Common keys of the ``pydantic_ai`` namespace of part-level
    ``providerMetadata`` — pydantic-ai's unversioned round-trip channel for
    ``ModelMessage`` fields the Vercel part shapes can't express"""

    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    """Provider part id of the originating ``ModelResponsePart``."""

    provider_name: str | None = None
    """Producing provider; Anthropic replays thinking blocks only when this
    matches the requesting model."""

    provider_details: dict[str, JsonValue] | None = None
    """Opaque provider details restored verbatim."""


class PydanticAITextProviderMetadata(_BasePydanticAIProviderMetadata):
    """The ``pydantic_ai`` namespace on a persisted text part."""


class PydanticAIReasoningProviderMetadata(_BasePydanticAIProviderMetadata):
    """The ``pydantic_ai`` namespace on a persisted reasoning part."""

    signature: str | None = None
    """Thinking signature, required to replay Anthropic extended thinking on
    tool-use turns; redacted thinking is stored here in its entirety."""


class PydanticAIToolCallProviderMetadata(_BasePydanticAIProviderMetadata):
    """The ``pydantic_ai`` namespace in a persisted tool part's
    ``callProviderMetadata``."""

    tool_kind: PydanticAIToolPartKind | None = None
    """pydantic-ai's typed-subclass discriminator for the tool part."""

    outcome: Literal["interrupted"] | None = None
    """The one tool outcome the Vercel part states can't express."""
