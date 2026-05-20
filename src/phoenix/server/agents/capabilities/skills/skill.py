from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, TypeVar, overload

from pydantic_ai import _function_schema
from pydantic_ai.tools import DocstringFormat, GenerateToolJsonSchema

from phoenix.server.agents.capabilities.skills.parsing import parse_skill_md
from phoenix.server.agents.capabilities.skills.skill_resource import (
    ResourceFunction,
    SkillResource,
)

ResourceFunctionType = TypeVar("ResourceFunctionType", bound=ResourceFunction)


@dataclass
class Skill:
    """A skill instance with metadata, content, and resources."""

    name: str
    description: str
    content: str
    path: Path
    resources: list[SkillResource] = field(default_factory=list)
    metadata: dict[str, Any] | None = None

    @classmethod
    def from_file(
        cls,
        path: Path,
        *,
        resources: list[SkillResource] | None = None,
    ) -> Skill:
        skill_file = path.expanduser().resolve()
        if skill_file.name != "SKILL.md":
            raise ValueError(f"Expected a SKILL.md file, got '{skill_file.name}'")

        if not skill_file.exists():
            raise FileNotFoundError(f"SKILL.md not found at {skill_file}")

        skill_folder = skill_file.parent
        raw = skill_file.read_text(encoding="utf-8")
        frontmatter, instructions = parse_skill_md(raw)

        name = frontmatter.get("name")
        if not name:
            raise ValueError(f'Skill at {skill_file} is missing the required "name" field')

        description = frontmatter.get("description") or ""
        metadata = {
            key: value for key, value in frontmatter.items() if key not in ("name", "description")
        }

        return cls(
            name=name,
            description=description,
            content=instructions,
            path=skill_folder,
            resources=resources or [],
            metadata=metadata or None,
        )

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
        """Decorator to register a callable as a skill resource.

        The decorated function can optionally take RunContext as its first argument
        for accessing dependencies.

        Example:
            ```python
            @my_skill.resource
            def get_context() -> str:
                return "Static context"

            @my_skill.resource
            async def get_data(ctx: RunContext[MyDeps]) -> str:
                return await ctx.deps.fetch_data()
            ```
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
            return decorator  # called with arguments: @my_skill.resource(name="custom")
        else:
            return decorator(decorated_fn)  # called without arguments: @my_skill.resource
