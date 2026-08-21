from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import AgentDepsT


@dataclass
class AbstractStaticCapability(AbstractCapability[AgentDepsT], ABC):
    """A capability whose instruction is a fixed string.

    Use this when the instruction text is identical across every run. Static
    instructions are emitted as part of the prefix the model provider can cache,
    so they sit *inside* the prompt-cache boundary and do not invalidate the
    cache between runs. Prefer this subclass whenever the instruction does not
    depend on per-run state.
    """

    @abstractmethod
    def get_static_instructions(self) -> str: ...

    def get_instructions(self) -> str:
        return self.get_static_instructions()
