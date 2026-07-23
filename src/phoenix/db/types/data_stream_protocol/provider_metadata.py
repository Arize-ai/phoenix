"""Phoenix-specific payloads carried under the ``phoenix`` namespace of Vercel
AI ``providerMetadata`` on tool-call parts.

These live in ``phoenix.db.types`` (not the router) because the ``phoenix``
namespace they describe is persisted inside every tool part of a
``PhoenixUIMessage`` and is validated there — see ``PhoenixUIMessage``'s model
validator in ``phoenix_types``.
"""

from typing import Any, Literal

from ._models import CamelBaseModel

ProviderMetadata = dict[str, Any]
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
