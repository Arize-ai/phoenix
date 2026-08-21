from __future__ import annotations

from dataclasses import dataclass

from mcp import types as mcp_types
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets import AgentToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability


class MintlifyDocsMCPServer(MCPToolset[AgentDepsT]):
    """Long-lived MCP transport to Phoenix's Mintlify docs server."""

    URL = "https://arizeai-433a7140.mintlify.app/mcp"

    def __init__(self) -> None:
        super().__init__(self.URL)
        self._pinned_tools: list[mcp_types.Tool] | None = None

    async def list_tools(self) -> list[mcp_types.Tool]:
        """Return the docs tool list, pinned to the first response of this process.

        These are the only tool definitions in the request we do not own, and
        tool definitions sit at the very front of the prompt — ahead of the
        system prompt and every message. ``MCPToolset`` would otherwise drop its
        cache on a ``notifications/tools/list_changed`` push, so a docs deploy
        could rewrite the front of the prefix in the middle of a user's
        conversation and discard the cached work behind it, with nothing on our
        side having changed.

        Pinning trades freshness for stability: a docs-side tool change is
        picked up on the next Phoenix restart rather than immediately. Their
        tool surface (search plus a filesystem query) is far more stable than
        their content, which these tools fetch live and which pinning does not
        affect.
        """
        if self._pinned_tools is None:
            self._pinned_tools = await super().list_tools()
        return self._pinned_tools


@dataclass
class MintlifyDocsMCPCapability(AbstractStaticCapability[AgentDepsT]):
    """Pairs the Mintlify docs MCP toolset with its cacheable, session-stable
    guidance text."""

    mcp_server: MCPToolset[AgentDepsT]
    instructions: str

    def get_toolset(self) -> AgentToolset[AgentDepsT] | None:
        return self.mcp_server

    def get_static_instructions(self) -> str:
        return self.instructions
