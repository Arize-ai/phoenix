from dataclasses import dataclass

from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.context import ResolvedContexts


@dataclass
class ChatDependencies:
    contexts: ResolvedContexts
    capabilities: AgentCapabilities
