"""Type definitions for skills toolset.

This module contains dataclass-based type definitions for skills,
their resources, and scripts.

Data classes:
- `Skill`: A skill instance with metadata, content, resources, and scripts
- `SkillResource`: A resource file or callable within a skill
- `SkillScript`: An executable script within a skill
- `SkillWrapper`: Generic wrapper for decorator-based skill creation
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any, Generic, TypeVar

from pydantic.json_schema import GenerateJsonSchema
from pydantic_ai import _function_schema
from pydantic_ai.tools import DocstringFormat, GenerateToolJsonSchema

from ._parsing import SKILL_NAME_PATTERN, parse_skill_md, validate_skill_metadata

if TYPE_CHECKING:
    from .local import CallableSkillScriptExecutor, LocalSkillScriptExecutor

# Generic type variable for dependencies
DepsT = TypeVar("DepsT")


def normalize_skill_name(func_name: str) -> str:
    """Normalize a function name to a valid skill name.

    Converts underscores to hyphens and validates against the skill naming pattern.

    Args:
        func_name: The function name to normalize.

    Returns:
        Normalized skill name (lowercase, underscores replaced with hyphens).

    Raises:
        ValueError: If the name contains invalid characters after normalization.

    Example:
        ```python
        normalize_skill_name('data_analyzer')  # Returns 'data-analyzer'
        normalize_skill_name('my_cool_skill')  # Returns 'my-cool-skill'
        normalize_skill_name('InvalidName')  # Raises ValueError
        ```
    """
    # Replace underscores with hyphens and convert to lowercase
    normalized = func_name.replace("_", "-").lower()

    # Validate against pattern
    if not SKILL_NAME_PATTERN.match(normalized):
        raise ValueError(
            f"Skill name '{normalized}' (derived from function '{func_name}') is invalid. "
            "Skill names must contain only lowercase letters, numbers, and hyphens "
            "(no consecutive hyphens)."
        )

    # Check length
    if len(normalized) > 64:
        raise ValueError(
            f"Skill name '{normalized}' exceeds 64 characters ({len(normalized)} chars)."
        )

    return normalized


@dataclass
class SkillResource:
    """A skill resource: static content or callable that generates content.

    Attributes:
        name: Resource name (e.g., "FORMS.md" or "get_samples").
        description: Description of what the resource provides.
        content: Static content string.
        function: Callable that generates content dynamically.
        takes_ctx: Whether the function takes RunContext as first argument.
        function_schema: Function schema for callable resources (auto-generated).
        uri: Optional URI string for file-based resources (internal use).
    """

    name: str
    description: str | None = None
    content: str | None = None
    function: Callable[..., Any | Awaitable[Any]] | None = None
    takes_ctx: bool = False
    function_schema: _function_schema.FunctionSchema | None = None
    uri: str | None = None

    def __post_init__(self) -> None:
        """Validate that resource has either content, function, or uri.

        For programmatic resources, content or function is required.
        For file-based resources (subclasses), uri is sufficient.
        """
        if self.content is None and self.function is None and self.uri is None:
            raise ValueError(f"Resource '{self.name}' must have either content, function, or uri")
        if self.function is not None and self.function_schema is None:
            raise ValueError(f"Resource '{self.name}' with function must have function_schema")

    async def load(self, ctx: Any, args: dict[str, Any] | None = None) -> Any:
        """Load resource content.

        File-based subclasses override to load from disk.

        Args:
            ctx: RunContext for accessing dependencies.
            args: Named arguments for callable resources.

        Returns:
            Resource content (any type).

        Raises:
            ValueError: If resource has no content or function.
        """
        if self.function and self.function_schema:
            return await self.function_schema.call(args or {}, ctx)
        elif self.content:
            return self.content
        else:
            raise ValueError(f"Resource '{self.name}' has no content or function")


@dataclass
class SkillScript:
    """An executable script within a skill.

    Can be programmatic (function) or file-based (executed via subprocess).

    Attributes:
        name: Script name (includes .py extension for file-based).
        description: Description of what the script does.
        function: Callable that implements the script (programmatic).
        takes_ctx: Whether the function takes RunContext as first argument.
        function_schema: Function schema for callable scripts (auto-generated).
        uri: Optional URI for file-based scripts (internal use).
        skill_name: Optional parent skill name (internal use).
    """

    name: str
    description: str | None = None
    function: Callable[..., Any] | None = None
    takes_ctx: bool = False
    function_schema: _function_schema.FunctionSchema | None = None
    uri: str | None = None
    skill_name: str | None = None

    def __post_init__(self) -> None:
        """Validate that script has either function or uri.

        For programmatic scripts, function is required.
        For file-based scripts (subclasses), uri is sufficient.
        """
        if self.function is None and self.uri is None:
            raise ValueError(f"Script '{self.name}' must have either function or uri")
        if self.function is not None and self.function_schema is None:
            raise ValueError(f"Script '{self.name}' with function must have function_schema")

    async def run(self, ctx: Any, args: dict[str, Any] | None = None) -> Any:
        """Execute the script.

        File-based subclasses override to execute via subprocess.

        Args:
            ctx: RunContext for accessing dependencies.
            args: Named arguments for the script.

        Returns:
            Script output (any type).

        Raises:
            ValueError: If script has no function.
        """
        if self.function and self.function_schema:
            return await self.function_schema.call(args or {}, ctx)
        else:
            raise ValueError(f"Script '{self.name}' has no function")


@dataclass
class Skill:
    """A skill instance with metadata, content, resources, and scripts.

    Can be created programmatically or loaded from filesystem directories.

    Example - Programmatic skill with decorators:
        ```python
        from pydantic_ai import RunContext
        from pydantic_ai.toolsets.skills import Skill, SkillResource

        # Create a skill (uri is optional and only for file-based skills)
        my_skill = Skill(
            name='hr-analytics-skill',
            description='Skill for HR analytics',
            content='Use this skill for HR data analysis...',
            resources=[
                SkillResource(name='table-schemas', content='Schema definitions...')
            ]
        )

        # Add callable resources
        @my_skill.resource
        def get_db_context() -> str:
            return "Dynamic database context."

        @my_skill.resource
        async def get_samples(ctx: RunContext[MyDeps]) -> str:
            return await ctx.deps.get_samples()

        # Add callable scripts
        @my_skill.script
        async def load_dataset(ctx: RunContext[MyDeps]) -> str:
            await ctx.deps.load_data()
            return 'Dataset loaded.'

        @my_skill.script
        async def run_query(ctx: RunContext[MyDeps], query: str) -> str:
            result = await ctx.deps.db.execute(query)
            return str(result)
        ```

    Attributes:
        name: Skill name.
        description: Brief description of what the skill does.
        content: Main instructional content.
        license: Optional license information.
        compatibility: Optional environment requirements (max 500 chars).
        resources: List of resources (files or callables).
        scripts: List of scripts (functions or file-based).
        uri: URI for the skill's base location. When not provided, a ``skill://{name}``
            (scheme-based URI) is automatically assigned for internal reference. For
            filesystem-based skills, this is explicitly set by the filesystem
            discovery/loading utilities to the resolved directory path; it can also be
            overridden explicitly when constructing a ``Skill``.
        metadata: Additional metadata fields.
    """

    name: str
    description: str
    content: str
    license: str | None = None
    compatibility: str | None = None
    resources: list[SkillResource] = field(default_factory=list)
    scripts: list[SkillScript] = field(default_factory=list)
    uri: str | None = None
    metadata: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        """Auto-assign a skill:// URI for any Skill instantiated with no URI.

        This fires for any ``Skill`` where ``uri=None`` at construction time, including
        programmatic skills. Filesystem-based skills have their ``uri`` set explicitly
        by the filesystem discovery/loading utilities (overwriting this default), so the
        auto-assigned value is effectively a transient default for those cases.
        The resulting URI follows the convention: ``skill://{name}``.
        """
        if self.uri is None:
            self.uri = f"skill://{self.name}"

    @classmethod
    def from_file(
        cls,
        path: str | Path,
        validate: bool = True,
        script_executor: LocalSkillScriptExecutor | CallableSkillScriptExecutor | None = None,
    ) -> Skill:
        """Load a :class:`Skill` from a SKILL.md file or its parent directory.

        Args:
            path: Path to a ``SKILL.md`` file or to the directory that contains one.
                When a file path is given it must be named exactly ``SKILL.md``.
            validate: When ``True`` (default), raises :exc:`ValueError` for
                structural problems (missing ``SKILL.md``, YAML errors, absent ``name``
                field).  Metadata quality issues (bad name format, missing description,
                overlong body) emit :class:`UserWarning` regardless of this flag.
            script_executor: Optional custom script executor for file-based scripts.

        Returns:
            A :class:`Skill` instance.

        Raises:
            ValueError: For structural problems: wrong filename, invalid YAML
                frontmatter, or (when *validate* is ``True``) a missing ``name``
                field.
            FileNotFoundError: When ``SKILL.md`` does not exist at the expected path.
            OSError: Propagated directly for unreadable files, permission errors, or
                I/O failures.  :func:`discover_skills` catches this and re-raises it
                as :exc:`ValueError`, so direct callers should handle both.
        """
        from .directory import (
            _discover_resources,
            _discover_scripts,
        )  # lazy: transitive circular via local.py
        from .local import LocalSkillScriptExecutor as _LocalExecutor

        skill_path = Path(path).expanduser().resolve()
        if skill_path.is_dir():
            skill_file = skill_path / "SKILL.md"
        else:
            if skill_path.name != "SKILL.md":
                raise ValueError(
                    f"Expected a SKILL.md file or its parent directory, got '{skill_path.name}'"
                )
            skill_file = skill_path

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
        license_field = frontmatter.get("license")
        license_field = str(license_field) if license_field is not None else None
        compatibility_field = frontmatter.get("compatibility")
        compatibility_field = str(compatibility_field) if compatibility_field is not None else None
        metadata = {
            k: v
            for k, v in frontmatter.items()
            if k not in ("name", "description", "license", "compatibility")
        }

        if validate:
            validate_skill_metadata(frontmatter, instructions, uri=str(skill_folder))

        executor = script_executor or _LocalExecutor()
        resources = _discover_resources(skill_folder)
        scripts = _discover_scripts(skill_folder, name, executor)

        return cls(
            name=name,
            description=description,
            content=instructions,
            license=license_field,
            compatibility=compatibility_field,
            uri=str(skill_folder),
            resources=resources,
            scripts=scripts,
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

    def script(
        self,
        func: Callable[..., Any] | None = None,
        *,
        name: str | None = None,
        description: str | None = None,
        takes_ctx: bool | None = None,
        docstring_format: DocstringFormat = "auto",
        schema_generator: type[GenerateJsonSchema] | None = None,
    ) -> Callable[..., Any]:
        """Decorator to register a callable as a skill script.

        The decorated function can optionally take RunContext as its first argument
        for accessing dependencies. This is auto-detected if not specified.

        Scripts accept named arguments (kwargs) matching their function signature.

        Example:
            ```python
            @my_skill.script
            async def load_data(ctx: RunContext[MyDeps]) -> str:
                await ctx.deps.load()
                return 'Loaded'

            @my_skill.script
            async def run_query(ctx: RunContext[MyDeps], query: str, limit: int = 10) -> str:
                result = await ctx.deps.db.execute(query, limit)
                return str(result)
            ```

        Args:
            func: The function to register as a script.
            name: Script name (defaults to function name).
            description: Script description (inferred from docstring if not provided).
            takes_ctx: Whether function takes RunContext (auto-detected if None).
            docstring_format: Format of the docstring ('auto', 'google', 'numpy', 'sphinx').
            schema_generator: Custom JSON schema generator class.

        Returns:
            The original function (allows use as decorator).
        """

        def decorator(f: Callable[..., Any]) -> Callable[..., Any]:
            script_name = name or f.__name__
            gen = schema_generator or GenerateToolJsonSchema
            func_schema = _function_schema.function_schema(
                f,
                schema_generator=gen,
                takes_ctx=takes_ctx,
                docstring_format=docstring_format,
                require_parameter_descriptions=False,
            )
            script = SkillScript(
                name=script_name,
                description=description or func_schema.description,
                function=f,
                takes_ctx=func_schema.takes_ctx,
                function_schema=func_schema,
                skill_name=self.name,
            )
            self.scripts.append(script)
            return f

        if func is None:
            # Called with arguments: @my_skill.script(name="custom")
            return decorator
        else:
            # Called without arguments: @my_skill.script
            return decorator(func)


class SkillWrapper(Generic[DepsT]):
    """Generic wrapper for decorator-based skill creation with type-safe dependencies.

    Typically created via `@skills.skill` decorator on a SkillsToolset instance.

    Example:
        ```python
        from dataclasses import dataclass
        from pydantic_ai import RunContext
        from pydantic_ai.toolsets.skills import SkillsToolset

        @dataclass
        class MyDeps:
            database: DatabaseConn

        skills = SkillsToolset[MyDeps]()

        @skills.skill(resources=[], metadata={'version': '1.0'})
        def data_analyzer(ctx: RunContext[MyDeps]) -> str:
            '''Analyze data from the database.'''
            return 'Use this skill for data analysis...'

        @data_analyzer.resource
        async def get_schema(ctx: RunContext[MyDeps]) -> str:
            return await ctx.deps.database.get_schema()

        @data_analyzer.script
        async def run_analysis(ctx: RunContext[MyDeps], query: str) -> str:
            result = await ctx.deps.database.execute(query)
            return str(result)
        ```

    Attributes:
        function: Function that returns skill content.
        name: Skill name (normalized from function name).
        description: Brief description (from docstring if not provided).
        license: Optional license information.
        compatibility: Optional environment requirements.
        metadata: Additional metadata fields.
        resources: List of resources attached to the skill.
        scripts: List of scripts attached to the skill.
    """

    def __init__(
        self,
        function: Callable[[], str],
        name: str,
        description: str | None,
        license: str | None,
        compatibility: str | None,
        metadata: dict[str, Any] | None,
        resources: list[SkillResource],
        scripts: list[SkillScript],
    ) -> None:
        """Initialize the skill wrapper.

        Args:
            function: Function that returns skill content.
            name: Skill name (already normalized).
            description: Skill description.
            license: Optional license information.
            compatibility: Optional environment requirements.
            metadata: Additional metadata fields.
            resources: Initial list of resources.
            scripts: Initial list of scripts.
        """
        self.function = function
        self.name = name
        self.description = description
        self.license = license
        self.compatibility = compatibility
        self.metadata = metadata
        self.resources = list(resources)
        self.scripts = list(scripts)

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

    def script(
        self,
        func: Callable[..., Any] | None = None,
        *,
        name: str | None = None,
        description: str | None = None,
        takes_ctx: bool | None = None,
        docstring_format: DocstringFormat = "auto",
        schema_generator: type[GenerateJsonSchema] | None = None,
    ) -> Callable[..., Any] | Callable[[Callable[..., Any]], Callable[..., Any]]:
        """Decorator to attach a callable script to the skill.

        The decorated function can optionally take RunContext as its first argument
        for accessing dependencies. This is auto-detected if not specified.

        Scripts accept named arguments (kwargs) matching their function signature.

        Example:
            ```python
            @my_skill.script
            async def load_data(ctx: RunContext[MyDeps]) -> str:
                await ctx.deps.load()
                return 'Loaded'

            @my_skill.script
            async def run_query(ctx: RunContext[MyDeps], query: str, limit: int = 10) -> str:
                result = await ctx.deps.db.execute(query, limit)
                return str(result)
            ```

        Args:
            func: The function to register as a script.
            name: Script name (defaults to function name).
            description: Script description (inferred from docstring if not provided).
            takes_ctx: Whether function takes RunContext (auto-detected if None).
            docstring_format: Format of the docstring ('auto', 'google', 'numpy', 'sphinx').
            schema_generator: Custom JSON schema generator class.

        Returns:
            The original function (allows use as decorator).
        """

        def decorator(f: Callable[..., Any]) -> Callable[..., Any]:
            script_name = name or f.__name__
            gen = schema_generator or GenerateToolJsonSchema
            func_schema = _function_schema.function_schema(
                f,
                schema_generator=gen,
                takes_ctx=takes_ctx,
                docstring_format=docstring_format,
                require_parameter_descriptions=False,
            )
            script = SkillScript(
                name=script_name,
                description=description or func_schema.description,
                function=f,
                takes_ctx=func_schema.takes_ctx,
                function_schema=func_schema,
                skill_name=self.name,
            )
            self.scripts.append(script)
            return f

        if func is None:
            # Called with arguments: @my_skill.script(name="custom")
            return decorator
        else:
            # Called without arguments: @my_skill.script
            return decorator(func)

    def to_skill(self) -> Skill:
        """Convert the wrapper to a Skill dataclass.

        Returns:
            Skill instance with all metadata and attached resources/scripts.
        """
        content = self.function()
        return Skill(
            name=self.name,
            description=self.description or "",
            content=content,
            license=self.license,
            compatibility=self.compatibility,
            resources=self.resources,
            scripts=self.scripts,
            uri=None,  # __post_init__ will assign skill://{name}
            metadata=self.metadata,
        )
