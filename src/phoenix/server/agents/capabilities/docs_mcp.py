from __future__ import annotations

from dataclasses import dataclass

from jinja2 import Template
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.toolsets import AgentToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
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
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return self.mcp_server

    def get_static_instructions(self) -> str:
        return self.instructions.render()
