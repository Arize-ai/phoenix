from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.toolsets import AgentToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability

_MINTLIFY_DOCS_MCP_URL = "https://arizeai-433a7140.mintlify.app/mcp"


class MintlifyDocsMCPServer(MCPToolset[Any]):
    """Long-lived MCP toolset connected to Phoenix's Mintlify docs server."""

    def __init__(self) -> None:
        super().__init__(_MINTLIFY_DOCS_MCP_URL)


@dataclass
class MintlifyDocsMCPCapability(AbstractStaticCapability[Any]):
    """Pairs the Mintlify docs MCP toolset with its cacheable, session-stable
    guidance text."""

    mcp_server: MCPToolset[Any]
    instructions: Template

    def get_toolset(self) -> AgentToolset[Any] | None:
        return self.mcp_server

    def get_static_instructions(self) -> str:
        return self.instructions.render()
