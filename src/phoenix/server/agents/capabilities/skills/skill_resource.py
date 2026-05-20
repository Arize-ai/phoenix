from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, TypeAlias

from pydantic_ai import RunContext, _function_schema

from phoenix.server.agents.types import AgentDependencies

ResourceFunction: TypeAlias = Callable[..., Any | Awaitable[Any]]
"""A resource function: any callable, sync or async, returning anything."""


@dataclass(kw_only=True)
class SkillResource(ABC):
    """Abstract base for skill resources."""

    name: str
    description: str | None = None

    @abstractmethod
    async def load(
        self,
        ctx: RunContext[AgentDependencies],
        args: dict[str, Any] | None = None,
    ) -> Any:
        """Load and return the resource's value.

        Args:
            ctx: RunContext for accessing dependencies (unused for static resources).
            args: Named arguments for callable resources.

        Returns:
            Resource content (any type).
        """


@dataclass(kw_only=True)
class ContentSkillResource(SkillResource):
    """A skill resource that returns static content."""

    content: str

    async def load(
        self,
        ctx: RunContext[AgentDependencies],
        args: dict[str, Any] | None = None,
    ) -> Any:
        return self.content


@dataclass(kw_only=True)
class FunctionSkillResource(SkillResource):
    """A skill resource backed by a callable.

    Attributes:
        function: Callable that generates the resource content.
        function_schema: Function schema describing ``function``'s parameters.
    """

    function: ResourceFunction
    function_schema: _function_schema.FunctionSchema

    async def load(
        self,
        ctx: RunContext[AgentDependencies],
        args: dict[str, Any] | None = None,
    ) -> Any:
        return await self.function_schema.call(args or {}, ctx)
