from __future__ import annotations

from dataclasses import dataclass

from jinja2 import Template
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets import AgentToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability


class MintlifyDocsMCPServer(MCPToolset[AgentDepsT]):
    """Long-lived MCP transport to Phoenix's Mintlify docs server."""

    URL = "https://arizeai-433a7140.mintlify.app/mcp"

    def __init__(self) -> None:
        super().__init__(self.URL)


@dataclass
class MintlifyDocsMCPCapability(AbstractStaticCapability[AgentDepsT]):
    """Pairs the Mintlify docs MCP toolset with its cacheable, session-stable
    guidance text."""

    mcp_server: MCPToolset[AgentDepsT]
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDepsT] | None:
        # MCP tools are discovered from the server, so they carry no
        # ``defer_loading`` flag of their own; defer the whole toolset here.
        return self.mcp_server.defer_loading()

    def get_static_instructions(self) -> str:
        return self.instructions.render()
