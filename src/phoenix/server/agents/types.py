from dataclasses import dataclass
from typing import TypeAlias

from pydantic_ai import DeferredToolRequests

from phoenix.server.agents.context import ResolvedContexts

AgentOutput: TypeAlias = str | DeferredToolRequests


@dataclass
class AgentDependencies:
    contexts: ResolvedContexts
