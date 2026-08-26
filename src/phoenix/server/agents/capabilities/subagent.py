from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import AgentDepsT


@dataclass
class SubagentCapability(AbstractCapability[AgentDepsT]):
    """Tells an agent invoked by another agent that its reply is a return value.

    The shared assistant prompt frames replies as messages to a human; this
    restores the contract the parent's ``call_subagent`` tool depends on.
    """

    instructions: str

    def get_instructions(self) -> str:
        return self.instructions
