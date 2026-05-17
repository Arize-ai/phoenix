from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic_ai import RunContext
from pydantic_ai._instructions import AgentInstructions as PydanticAIAgentInstructions
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import AgentDepsT, SystemPromptFunc


@dataclass
class AbstractStaticCapability(AbstractCapability[AgentDepsT], ABC):
    """A capability whose instruction is a fixed string."""

    @abstractmethod
    def get_static_instructions(self) -> str: ...

    def get_instructions(self) -> PydanticAIAgentInstructions[AgentDepsT] | None:
        return self.get_static_instructions()


@dataclass
class AbstractDynamicCapability(AbstractCapability[AgentDepsT], ABC):
    """A capability whose instruction is produced per-run via a callable."""

    @abstractmethod
    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDepsT]: ...

    @abstractmethod
    def include_for_run(self, ctx: RunContext[AgentDepsT]) -> bool: ...

    def get_instructions(self) -> PydanticAIAgentInstructions[AgentDepsT] | None:
        return self.get_dynamic_instructions()
