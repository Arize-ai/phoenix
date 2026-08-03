from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import AgentDepsT


@dataclass
class AbstractToolCapability(AbstractCapability[AgentDepsT], ABC):
    """A capability that contributes tools and no system-prompt instructions.

    Everything the model needs to know about a tool — when to reach for it, its
    preflight steps, its invariants, and how its result should be reported — belongs in
    that tool's ``description``. Keeping the guidance there gives it a single source of
    truth, ships it alongside the tool wherever the tool is advertised, and lets it
    disappear from the request entirely when the tool is gated out or deferred behind
    tool search. Restating it in the system prompt only duplicates tokens and lets the
    two copies drift apart.
    """


@dataclass
class AbstractGatedToolCapability(AbstractToolCapability[AgentDepsT], ABC):
    """A tool capability that is only advertised on runs whose context supports it.

    ``include_for_run`` is consulted by the per-run capability builder, which drops the
    capability — and therefore its tools — from runs that return False.
    """

    @abstractmethod
    def include_for_run(self, ctx: RunContext[AgentDepsT]) -> bool: ...
