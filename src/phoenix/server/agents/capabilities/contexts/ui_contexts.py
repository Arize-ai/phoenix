from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai.capabilities import AbstractCapability

from phoenix.server.agents.types import AgentDependencies


@dataclass
class UIContextsCapability(AbstractCapability[AgentDependencies]):
    """Documents every UI surface the agent can be looking at."""

    instructions: str

    def get_instructions(self) -> str:
        return self.instructions
