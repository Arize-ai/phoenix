from dataclasses import dataclass
from typing import TypeAlias

from pydantic_ai import DeferredToolRequests
from pydantic_ai.mcp import MCPServerStreamableHTTP

from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.context import ResolvedContexts


@dataclass
class ChatDependencies:
    contexts: ResolvedContexts
    capabilities: AgentCapabilities
    docs_mcp_toolset: MCPServerStreamableHTTP | None


ChatOutput: TypeAlias = str | DeferredToolRequests
