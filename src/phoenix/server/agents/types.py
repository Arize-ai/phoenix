from dataclasses import dataclass
from typing import Literal, TypeAlias

from pydantic_ai import DeferredToolRequests

from phoenix.server.agents.context import ResolvedContexts

AgentOutput: TypeAlias = str | DeferredToolRequests


@dataclass
class AgentDependencies:
    contexts: ResolvedContexts
    edit_permission: Literal["manual", "bypass"] = "manual"
