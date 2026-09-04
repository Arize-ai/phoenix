from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets import AgentToolset


class MintlifyDocsMCPServer(MCPToolset[AgentDepsT]):
    """Long-lived MCP transport to Phoenix's Mintlify docs server."""

    URL = "https://arizeai-433a7140.mintlify.app/mcp"

    def __init__(self) -> None:
        super().__init__(self.URL)


@dataclass
class MintlifyDocsMCPCapability(AbstractCapability[AgentDepsT]):
    """Pairs the Mintlify docs MCP toolset with its guidance text."""

    mcp_server: MCPToolset[AgentDepsT]
    instructions: str

    def get_toolset(self) -> AgentToolset[AgentDepsT] | None:
        return self.mcp_server

    def get_instructions(self) -> str:
        return self.instructions
