from __future__ import annotations

from dataclasses import dataclass, field

from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.toolsets import AgentToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.pydantic_ai import OpenInferenceToolsetWrapper
from phoenix.server.agents.types import AgentDependencies


class MintlifyDocsMCPServer(MCPServerStreamableHTTP):
    """Long-lived MCP transport to Phoenix's Mintlify docs server."""

    URL = "https://arizeai-433a7140.mintlify.app/mcp"

    def __init__(self) -> None:
        super().__init__(url=self.URL)


@dataclass
class MintlifyDocsMCPCapability(AbstractStaticCapability[AgentDependencies]):
    """Pairs the Mintlify docs MCP toolset with its cacheable, session-stable
    guidance text."""

    mcp_server: MCPServerStreamableHTTP
    instructions: str
    tracer_provider: TracerProvider = field(default_factory=NoOpTracerProvider)

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return OpenInferenceToolsetWrapper(
            self.mcp_server,
            tracer_provider=self.tracer_provider,
        )

    def get_static_instructions(self) -> str:
        return self.instructions
