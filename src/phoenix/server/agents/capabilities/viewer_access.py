from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import AgentDepsT


@dataclass
class ViewerAccessCapability(AbstractCapability[AgentDepsT]):
    """Tells a view-only user's agent not to offer writes."""

    instructions: str

    def get_instructions(self) -> str:
        return self.instructions
