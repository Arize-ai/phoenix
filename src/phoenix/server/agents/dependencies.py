from dataclasses import dataclass

from pydantic_ai.mcp import MCPServerStreamableHTTP

from phoenix.server.agents.agent_capabilities import AgentCapabilities
from phoenix.server.agents.context import ResolvedContexts


@dataclass
class ChatDependencies:
    contexts: ResolvedContexts
    capabilities: AgentCapabilities
    docs_mcp_toolset: MCPServerStreamableHTTP | None
