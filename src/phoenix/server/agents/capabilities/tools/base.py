from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import AgentDepsT


@dataclass
class AbstractGatedToolCapability(AbstractCapability[AgentDepsT], ABC):
    """A tool capability that is only advertised on runs whose context supports it.

    ``include_for_run`` is consulted by the per-run capability builder, which drops the
    capability — and therefore its tools — from runs that return False.
    """

    @abstractmethod
    def include_for_run(self, ctx: RunContext[AgentDepsT]) -> bool: ...
