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
"""Phoenix's pin of pydantic-ai's ``ToolPartKind`` vocabulary.

Defined locally so persisted rows validate without importing pydantic-ai, and
held equal to the installed package's ``ToolPartKind`` by a canary test — a
vocabulary change at a dependency bump fails that test, not a production
persist.
"""


class _BasePydanticAIProviderMetadata(BaseModel):
    """Common keys of the ``pydantic_ai`` namespace of part-level Vercel AI
    ``providerMetadata`` in persisted messages.

    The namespace is pydantic-ai's round-trip channel for ``ModelMessage``
    fields the Vercel part shapes cannot express: its event stream stamps these
    keys while streaming a response, Phoenix persists them verbatim, and
    ``VercelAIAdapter.load_messages`` reads them back to rebuild the
    model-facing history. The keys are an unversioned wire convention of the
    installed pydantic-ai release, not a public API. Unlike the camelCase
    ``phoenix`` namespace above, this dialect is snake_case on the wire.

    ``extra="forbid"`` makes drift loud: a key this schema doesn't know cannot
    be persisted, so an upstream rename or addition fails at the dependency
    bump (via the canary tests, which stream through the installed writer)
    instead of silently corrupting replays.
    """

    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    """The originating ``ModelResponsePart``'s provider part id, restored for
    replay fidelity (e.g. provider caching and citation matching)."""

    provider_name: str | None = None
    """Which provider produced the part. Anthropic thinking blocks are only
    replayed as thinking when this matches the requesting model's system."""

    provider_details: dict[str, Any] | None = None
    """Opaque provider-specific details restored verbatim onto the part."""


class PydanticAITextProviderMetadata(_BasePydanticAIProviderMetadata):
    """The ``pydantic_ai`` namespace on a persisted text part."""


class PydanticAIReasoningProviderMetadata(_BasePydanticAIProviderMetadata):
    """The ``pydantic_ai`` namespace on a persisted reasoning part."""

    signature: str | None = None
    """The provider's thinking signature, required to replay Anthropic
    extended thinking: without it the thinking block is inlined as plain text,
    which the API rejects on tool-use turns. Redacted thinking is stored here
    in its entirety."""


class PydanticAIToolCallProviderMetadata(_BasePydanticAIProviderMetadata):
    """The ``pydantic_ai`` namespace in a persisted tool part's
    ``callProviderMetadata``."""

    tool_kind: PydanticAIToolPartKind | None = None
    """pydantic-ai's typed-subclass discriminator for the tool part, restored
    so e.g. tool-search calls replay as their typed part classes."""

    outcome: Literal["interrupted"] | None = None
    """Marks a tool call that was cut off before producing a result. The
    Vercel part states cannot express an interrupted outcome, so pydantic-ai's
    ``dump_messages`` rides it here and ``load_messages`` restores
    ``ToolReturnPart(outcome='interrupted')`` instead of a success. In
    Phoenix's pipeline the only writer is the interrupted-turn repair
    (mimicking that dump convention): persisted rows come from the live event
    stream, which never emits the key — an interrupted run has no return part
    to dump."""
