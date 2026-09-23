from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets import AgentToolset


@dataclass
class AbstractGatedToolCapability(AbstractCapability[AgentDepsT], ABC):
    """A tool capability that is only advertised on runs whose context supports it."""

    @abstractmethod
    def get_toolset(self) -> AgentToolset[AgentDepsT] | None: ...

    @abstractmethod
    def include_for_run(self, ctx: RunContext[AgentDepsT]) -> bool: ...
