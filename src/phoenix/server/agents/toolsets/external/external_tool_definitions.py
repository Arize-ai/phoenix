from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field

from pydantic_ai import RunContext
from pydantic_ai.messages import InstructionPart
from pydantic_ai.tools import ToolDefinition, ToolKind

from phoenix.server.agents.dependencies import ChatDependencies

IncludePredicate = Callable[[RunContext[ChatDependencies]], bool]
InstructionFn = Callable[[RunContext[ChatDependencies]], str]


@dataclass(repr=False, kw_only=True)
class ExternalToolDefinition(ToolDefinition, ABC):
    """ToolDefinition whose instruction text and inclusion gate are supplied
    per-request by callables registered via the ``@TOOL.instruction`` and
    ``@TOOL.include`` decorators. Routing through ``ctx`` lets callers override
    instructions via ``ChatDependencies.instructions`` at runtime."""

    kind: ToolKind = "external"

    _instruction_fn: InstructionFn | None = field(default=None, init=False, repr=False)

    def instruction(self, fn: InstructionFn) -> InstructionFn:
        """Decorator: register the function returning this tool's instruction text."""
        self._instruction_fn = fn
        return fn

    def _resolve_instruction(self, ctx: RunContext[ChatDependencies]) -> str:
        if self._instruction_fn is None:
            raise RuntimeError(
                f"ExternalToolDefinition {self.name!r} has no instruction "
                f"function registered. Use @<TOOL>.instruction to register one."
            )
        return self._instruction_fn(ctx)

    @abstractmethod
    def should_include(self, ctx: RunContext[ChatDependencies]) -> bool: ...

    @abstractmethod
    def get_instruction_part(self, ctx: RunContext[ChatDependencies]) -> InstructionPart: ...


@dataclass(repr=False, kw_only=True)
class StaticExternalToolDefinition(ExternalToolDefinition):
    """Always included. Emits a cacheable (`dynamic=False`) instruction part
    so the instruction can sit inside Anthropic's cache breakpoint."""

    def should_include(self, ctx: RunContext[ChatDependencies]) -> bool:
        return True

    def get_instruction_part(self, ctx: RunContext[ChatDependencies]) -> InstructionPart:
        return InstructionPart(content=self._resolve_instruction(ctx), dynamic=False)


@dataclass(repr=False, kw_only=True)
class DynamicExternalToolDefinition(ExternalToolDefinition):
    """Conditionally included based on the per-turn run context. Register the
    gate predicate with the ``@TOOL.include`` decorator at module scope, next
    to the tool definition. Emits a ``dynamic=True`` instruction part since
    the tool's presence varies across turns and must stay outside the cached
    prefix."""

    _include_fn: IncludePredicate | None = field(default=None, init=False, repr=False)

    def include(self, fn: IncludePredicate) -> IncludePredicate:
        """Decorator: register the predicate that gates this tool per turn."""
        self._include_fn = fn
        return fn

    def should_include(self, ctx: RunContext[ChatDependencies]) -> bool:
        if self._include_fn is None:
            raise RuntimeError(
                f"DynamicExternalToolDefinition {self.name!r} has no include "
                f"function registered. Use @<TOOL>.include to register one."
            )
        return self._include_fn(ctx)

    def get_instruction_part(self, ctx: RunContext[ChatDependencies]) -> InstructionPart:
        return InstructionPart(content=self._resolve_instruction(ctx), dynamic=True)
