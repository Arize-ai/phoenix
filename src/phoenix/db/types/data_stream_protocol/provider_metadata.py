"""Payloads carried inside part-level Vercel AI ``providerMetadata`` in
persisted messages: the Phoenix-owned ``phoenix`` namespace and pydantic-ai's
``pydantic_ai`` namespace.

These live in ``phoenix.db.types`` (not the router) because the namespaces they
describe are persisted inside the parts of a ``PhoenixUIMessage`` and are
validated there — see ``PhoenixUIMessage``'s model validators in
``phoenix_types``.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from ._models import CamelBaseModel

ToolExecutionEnvironment = Literal["client", "server"]


class ToolCallProviderMetadata(CamelBaseModel):
    """Payload Phoenix stamps under the ``phoenix`` namespace of Vercel AI
    ``providerMetadata`` on tool-call chunks (``tool-input-start`` and
    ``tool-input-available``)."""

    tool_execution_environment: ToolExecutionEnvironment
    """Whether the tool is executed on the client (external toolset) or on the
    Phoenix server (everything else, e.g. MCP tools and function tools)."""

    tool_input_emitted_at: str | None = None
    """RFC3339 server timestamp for a client tool-call chunk."""


class ToolCallCallbackProviderMetadata(ToolCallProviderMetadata):
    """Shape of the ``phoenix`` namespace the browser returns in
    ``callProviderMetadata`` on resolved tool parts: the server-stamped fields
    plus browser-recorded execution timings."""

    client_started_at: str | None = None
    """RFC3339 browser timestamp taken when client tool execution started."""

    client_ended_at: str | None = None
    """RFC3339 browser timestamp taken when client tool execution ended."""


PydanticAIToolPartKind = Literal["tool-search", "capability-load"]
"""Local pin of pydantic-ai's ``ToolPartKind``; a canary test holds it equal
to the installed package's."""


class _BasePydanticAIProviderMetadata(BaseModel):
    """Common keys of the ``pydantic_ai`` namespace of part-level
    ``providerMetadata`` — pydantic-ai's unversioned round-trip channel for
    ``ModelMessage`` fields the Vercel part shapes can't express — typed with
    ``extra="forbid"`` so upstream drift fails validation instead of
    corrupting replays."""

    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    """Provider part id of the originating ``ModelResponsePart``."""

    provider_name: str | None = None
    """Producing provider; Anthropic replays thinking blocks only when this
    matches the requesting model."""

    provider_details: dict[str, Any] | None = None
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
    """The one tool outcome the Vercel part states can't express;
    ``load_messages`` restores ``ToolReturnPart(outcome='interrupted')`` from
    it. Written here only by Phoenix's interrupted-turn repair — the live
    event stream never emits the key."""
