from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from pydantic_ai.mcp import MCPServerStreamableHTTP

from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.context import ResolvedContexts

if TYPE_CHECKING:
    from phoenix.server.types import DbSessionFactory


@dataclass
class ChatDependencies:
    user: Any
    db: "DbSessionFactory"
    contexts: ResolvedContexts
    capabilities: AgentCapabilities
    docs_mcp_toolset: MCPServerStreamableHTTP | None
