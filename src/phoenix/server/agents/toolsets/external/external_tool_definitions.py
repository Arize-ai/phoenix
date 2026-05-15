from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field

from pydantic_ai import RunContext
from pydantic_ai.messages import InstructionPart
from pydantic_ai.tools import ToolDefinition, ToolKind

from phoenix.server.agents.types import AgentDependencies

IncludePredicate = Callable[[RunContext[AgentDependencies]], bool]


@dataclass(repr=False, kw_only=True)
class ExternalToolDefinition(ToolDefinition, ABC):
    """ToolDefinition whose instructions are bound at agent build time."""

    kind: ToolKind = "external"
    instructions: str

    @abstractmethod
    def should_include(self, ctx: RunContext[AgentDependencies]) -> bool: ...

    @abstractmethod
    def get_instruction_part(self, ctx: RunContext[AgentDependencies]) -> InstructionPart: ...


@dataclass(repr=False, kw_only=True)
class StaticExternalToolDefinition(ExternalToolDefinition):
    """Always included. Emits a cacheable (`dynamic=False`) instruction part
    so the instruction can sit inside Anthropic's cache breakpoint."""

    def should_include(self, ctx: RunContext[AgentDependencies]) -> bool:
        return True

    def get_instruction_part(self, ctx: RunContext[AgentDependencies]) -> InstructionPart:
        return InstructionPart(content=self.instructions, dynamic=False)


@dataclass(repr=False, kw_only=True)
class DynamicExternalToolDefinition(ExternalToolDefinition):
    """Conditionally included tools based on the per-turn run context."""

    _include_fn: IncludePredicate | None = field(default=None, init=False, repr=False)

    def include(self, fn: IncludePredicate) -> IncludePredicate:
        """Decorator: register the predicate that gates this tool per turn."""
        self._include_fn = fn
        return fn

    def should_include(self, ctx: RunContext[AgentDependencies]) -> bool:
        if self._include_fn is None:
            raise RuntimeError(
                f"DynamicExternalToolDefinition {self.name!r} has no include "
                f"function registered. Use @<tool>.include."
            )
        return self._include_fn(ctx)

    def get_instruction_part(self, ctx: RunContext[AgentDependencies]) -> InstructionPart:
        return InstructionPart(content=self.instructions, dynamic=True)
