from __future__ import annotations

import inspect
from collections.abc import Callable
from pathlib import Path
from typing import Any, TypeVar, overload

from pydantic_ai import _function_schema
from pydantic_ai.tools import DocstringFormat, GenerateToolJsonSchema

from phoenix.server.agents.capabilities.skills.skill import Skill
from phoenix.server.agents.capabilities.skills.skill_resource import (
    ResourceFunction,
    SkillResource,
)

ResourceFunctionType = TypeVar("ResourceFunctionType", bound=ResourceFunction)


class SkillWrapper:
    """Wrapper for decorator-based skill creation."""

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

    @overload
    def resource(self, decorated_fn: ResourceFunctionType) -> ResourceFunctionType: ...

    @overload
    def resource(
        self,
        decorated_fn: None = None,
        *,
        name: str | None = None,
        description: str | None = None,
        docstring_format: DocstringFormat = "auto",
    ) -> Callable[[ResourceFunctionType], ResourceFunctionType]: ...

    def resource(
        self,
        decorated_fn: ResourceFunctionType | None = None,
        *,
        name: str | None = None,
        description: str | None = None,
        docstring_format: DocstringFormat = "auto",
    ) -> ResourceFunctionType | Callable[[ResourceFunctionType], ResourceFunctionType]:
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

        Returns:
            The original function (allows use as decorator).
        """

        def decorator(resource_fn: ResourceFunctionType) -> ResourceFunctionType:
            resource_name = name or resource_fn.__name__
            fn_schema = _function_schema.function_schema(
                resource_fn,
                schema_generator=GenerateToolJsonSchema,
                takes_ctx=None,
                docstring_format=docstring_format,
                require_parameter_descriptions=False,
            )
            resource = SkillResource(
                name=resource_name,
                description=description or fn_schema.description,
                function=resource_fn,
                takes_ctx=fn_schema.takes_ctx,
                function_schema=fn_schema,
            )
            self.resources.append(resource)
            return resource_fn

        if decorated_fn is None:
            # Called with arguments: @my_skill.resource(name="custom")
            return decorator
        else:
            # Called without arguments: @my_skill.resource
            return decorator(decorated_fn)

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
