from dataclasses import dataclass, field

from pydantic_ai.mcp import MCPServerStreamableHTTP

from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.prompts import AgentInstructions


@dataclass
class ChatDependencies:
    contexts: ResolvedContexts
    capabilities: AgentCapabilities
    docs_mcp_toolset: MCPServerStreamableHTTP | None
    instructions: AgentInstructions = field(default_factory=AgentInstructions)
