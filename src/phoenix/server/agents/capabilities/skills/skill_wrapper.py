from __future__ import annotations

import inspect
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, Generic, TypeVar

from pydantic.json_schema import GenerateJsonSchema
from pydantic_ai import _function_schema
from pydantic_ai.tools import DocstringFormat, GenerateToolJsonSchema

from phoenix.server.agents.capabilities.skills.skill import Skill
from phoenix.server.agents.capabilities.skills.skill_resource import SkillResource

# Generic type variable for dependencies
DepsT = TypeVar("DepsT")


class SkillWrapper(Generic[DepsT]):
    """Generic wrapper for decorator-based skill creation with type-safe dependencies."""

    def __init__(
        self,
        function: Callable[[], str],
        name: str,
        description: str | None,
        metadata: dict[str, Any] | None,
        resources: list[SkillResource],
    ) -> None:
        """Initialize the skill wrapper.

        Args:
            function: Function that returns skill content.
            name: Skill name (already normalized).
            description: Skill description.
            metadata: Additional metadata fields.
            resources: Initial list of resources.
        """
        self.function = function
        self.name = name
        self.description = description
        self.metadata = metadata
        self.resources = list(resources)

    def resource(
        self,
        func: Callable[..., object | Awaitable[object]] | None = None,
        *,
        name: str | None = None,
        description: str | None = None,
        docstring_format: DocstringFormat = "auto",
        schema_generator: type[GenerateJsonSchema] | None = None,
    ) -> (
        Callable[..., object | Awaitable[object]]
        | Callable[
            [Callable[..., object | Awaitable[object]]],
            Callable[..., object | Awaitable[object]],
        ]
    ):
        """Decorator to attach a callable resource to the skill.

        The decorated function can optionally take RunContext as its first argument
        for accessing dependencies. This is auto-detected if not specified.

        Example:
            ```python
            @my_skill.resource
            def get_context() -> str:
                return "Static context"

            @my_skill.resource
            async def get_data(ctx: RunContext[MyDeps]) -> str:
                return await ctx.deps.fetch_data()

            @my_skill.resource(name="custom_name", description="Custom description")
            async def my_resource(ctx: RunContext[MyDeps], param: str) -> dict:
                return {"result": param}
            ```

        Args:
            func: The function to register as a resource.
            name: Resource name (defaults to function name).
            description: Resource description (inferred from docstring if not provided).
            docstring_format: Format of the docstring ('auto', 'google', 'numpy', 'sphinx').
            schema_generator: Custom JSON schema generator class.

        Returns:
            The original function (allows use as decorator).
        """

        def decorator(
            f: Callable[..., object | Awaitable[object]],
        ) -> Callable[..., object | Awaitable[object]]:
            resource_name = name or f.__name__
            gen = schema_generator or GenerateToolJsonSchema
            func_schema = _function_schema.function_schema(
                f,
                schema_generator=gen,
                takes_ctx=None,
                docstring_format=docstring_format,
                require_parameter_descriptions=False,
            )
            resource = SkillResource(
                name=resource_name,
                description=description or func_schema.description,
                function=f,
                takes_ctx=func_schema.takes_ctx,
                function_schema=func_schema,
            )
            self.resources.append(resource)
            return f

        if func is None:
            # Called with arguments: @my_skill.resource(name="custom")
            return decorator
        else:
            # Called without arguments: @my_skill.resource
            return decorator(func)

    def to_skill(self) -> Skill:
        """Convert the wrapper to a Skill dataclass.

        Returns:
            Skill instance with all metadata and attached resources.
        """
        content = self.function()
        return Skill(
            name=self.name,
            description=self.description or "",
            content=content,
            resources=self.resources,
            path=Path(inspect.getfile(self.function)),
            metadata=self.metadata,
        )
