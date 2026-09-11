from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import AgentDepsT


@dataclass
class SubagentCapability(AbstractCapability[AgentDepsT]):
    instructions: str

    def get_instructions(self) -> str:
        return self.instructions
