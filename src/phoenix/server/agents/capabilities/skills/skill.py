from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic.json_schema import GenerateJsonSchema
from pydantic_ai import _function_schema
from pydantic_ai.tools import DocstringFormat, GenerateToolJsonSchema

from phoenix.server.agents.capabilities.skills.parsing import parse_skill_md
from phoenix.server.agents.capabilities.skills.skill_resource import SkillResource


@dataclass
class Skill:
    """A skill instance with metadata, content, and resources."""

    name: str
    description: str
    content: str
    resources: list[SkillResource] = field(default_factory=list)
    path: str | None = None
    metadata: dict[str, Any] | None = None

    @classmethod
    def from_file(
        cls,
        path: str | Path,
        *,
        resources: list[SkillResource] | None = None,
        validate: bool = True,
    ) -> Skill:
        """Load a :class:`Skill` from a SKILL.md file.

        Args:
            path: Path to a ``SKILL.md`` file. Must be named exactly ``SKILL.md``.
            resources: Optional pre-built resources to attach to the skill.
            validate: When ``True`` (default), raises :exc:`ValueError` for
                structural problems (YAML errors, absent ``name`` field).

        Returns:
            A :class:`Skill` instance.

        Raises:
            ValueError: For structural problems: wrong filename, invalid YAML
                frontmatter, or (when *validate* is ``True``) a missing ``name``
                field.
            FileNotFoundError: When ``SKILL.md`` does not exist at the expected path.
            OSError: Propagated directly for unreadable files, permission errors, or
                I/O failures.
        """
        skill_file = Path(path).expanduser().resolve()
        if skill_file.name != "SKILL.md":
            raise ValueError(f"Expected a SKILL.md file, got '{skill_file.name}'")

        if not skill_file.exists():
            raise FileNotFoundError(f"SKILL.md not found at {skill_file}")

        skill_folder = skill_file.parent
        raw = skill_file.read_text(encoding="utf-8")
        frontmatter, instructions = parse_skill_md(raw)

        # Coerce before the empty check so YAML scalars like `name: 0` load as '0'
        # rather than being treated as missing.  Only None/empty-string falls back.
        raw_name = frontmatter.get("name")
        name = str(raw_name) if raw_name is not None else ""
        if not name:
            if validate:
                raise ValueError(f'Skill at {skill_file} is missing the required "name" field')
            name = skill_folder.name

        # Coerce YAML scalar fields to str — YAML may return int/float/None
        description = str(frontmatter.get("description") or "")
        metadata = {k: v for k, v in frontmatter.items() if k not in ("name", "description")}

        return cls(
            name=name,
            description=description,
            content=instructions,
            path=str(skill_folder),
            resources=list(resources) if resources else [],
            metadata=metadata if metadata else None,
        )

    def resource(
        self,
        func: Callable[..., Any] | None = None,
        *,
        name: str | None = None,
        description: str | None = None,
        takes_ctx: bool | None = None,
        docstring_format: DocstringFormat = "auto",
        schema_generator: type[GenerateJsonSchema] | None = None,
    ) -> Callable[..., Any] | Callable[[Callable[..., Any]], Callable[..., Any]]:
        """Decorator to register a callable as a skill resource.

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
            ```

        Args:
            func: The function to register as a resource.
            name: Resource name (defaults to function name).
            description: Resource description (inferred from docstring if not provided).
            takes_ctx: Whether function takes RunContext (auto-detected if None).
            docstring_format: Format of the docstring ('auto', 'google', 'numpy', 'sphinx').
            schema_generator: Custom JSON schema generator class.

        Returns:
            The original function (allows use as decorator).
        """

        def decorator(f: Callable[..., Any]) -> Callable[..., Any]:
            resource_name = name or f.__name__
            gen = schema_generator or GenerateToolJsonSchema
            func_schema = _function_schema.function_schema(
                f,
                schema_generator=gen,
                takes_ctx=takes_ctx,
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
