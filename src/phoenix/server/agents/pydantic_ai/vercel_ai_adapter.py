"""Vercel AI adapter that stamps Phoenix-specific tool-call metadata.

Extends pydantic-ai's `VercelAIAdapter` / `VercelAIEventStream` to add a
`tool_execution_environment` field under a `phoenix` namespace on the
`providerMetadata` of tool-call chunks. Frontends can use it to distinguish
client-executed (external) tool calls from server-executed ones at render time.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict
from pydantic_ai.messages import BuiltinToolCallPart, ToolCallPart
from pydantic_ai.output import OutputDataT
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.ui import UIEventStream
from pydantic_ai.ui.vercel_ai import VercelAIAdapter, VercelAIEventStream
from pydantic_ai.ui.vercel_ai.request_types import RequestData
from pydantic_ai.ui.vercel_ai.response_types import (
    BaseChunk,
    ProviderMetadata,
    ToolInputAvailableChunk,
    ToolInputStartChunk,
)

from phoenix.server.agents.toolsets.external.tools import get_external_tool_definition

PHOENIX_PROVIDER_METADATA_KEY = "phoenix"

ToolExecutionEnvironment = Literal["client", "server"]


class PhoenixToolCallProviderMetadata(BaseModel):
    """Payload Phoenix stamps under the ``phoenix`` namespace of Vercel AI
    ``providerMetadata`` on tool-call chunks (``tool-input-start`` and
    ``tool-input-available``).
    """

    model_config = ConfigDict(extra="forbid")

    tool_execution_environment: ToolExecutionEnvironment
    """Whether the tool is executed on the client (external toolset) or on the
    Phoenix server (everything else, e.g. MCP tools and function tools)."""


def _classify_tool(tool_name: str) -> ToolExecutionEnvironment:
    """Return ``"client"`` for tools whose results are produced outside the
    agent run (the registered external toolset); ``"server"`` otherwise."""
    return "client" if get_external_tool_definition(tool_name) is not None else "server"


def _with_phoenix_metadata(
    provider_metadata: ProviderMetadata | None, tool_name: str
) -> ProviderMetadata:
    existing_phoenix: dict[str, Any] = (provider_metadata or {}).get(
        PHOENIX_PROVIDER_METADATA_KEY, {}
    )
    payload = PhoenixToolCallProviderMetadata(
        tool_execution_environment=_classify_tool(tool_name),
    )
    return {
        **(provider_metadata or {}),
        PHOENIX_PROVIDER_METADATA_KEY: {**existing_phoenix, **payload.model_dump()},
    }


@dataclass
class PhoenixVercelAIEventStream(VercelAIEventStream[AgentDepsT, OutputDataT]):
    """Vercel AI event stream that stamps the tool execution environment on
    `tool-input-start` and `tool-input-available` chunks."""

    async def _handle_tool_call_start(
        self,
        part: ToolCallPart | BuiltinToolCallPart,
        tool_call_id: str | None = None,
        provider_executed: bool | None = None,
    ) -> AsyncIterator[BaseChunk]:
        async for chunk in super()._handle_tool_call_start(
            part, tool_call_id=tool_call_id, provider_executed=provider_executed
        ):
            if isinstance(chunk, ToolInputStartChunk):
                chunk.provider_metadata = _with_phoenix_metadata(
                    chunk.provider_metadata, part.tool_name
                )
            yield chunk

    async def handle_tool_call_end(self, part: ToolCallPart) -> AsyncIterator[BaseChunk]:
        async for chunk in super().handle_tool_call_end(part):
            if isinstance(chunk, ToolInputAvailableChunk):
                chunk.provider_metadata = _with_phoenix_metadata(
                    chunk.provider_metadata, part.tool_name
                )
            yield chunk


@dataclass
class PhoenixVercelAIAdapter(VercelAIAdapter[AgentDepsT, OutputDataT]):
    """Vercel AI adapter that builds a `PhoenixVercelAIEventStream`."""

    def build_event_stream(self) -> UIEventStream[RequestData, BaseChunk, AgentDepsT, OutputDataT]:
        return PhoenixVercelAIEventStream(
            self.run_input,
            accept=self.accept,
            sdk_version=self.sdk_version,
            server_message_id=self.server_message_id,
        )
