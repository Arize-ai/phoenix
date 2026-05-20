from __future__ import annotations

import json
import warnings
from collections.abc import Callable
from inspect import signature as get_signature
from typing import Any

from pydantic_ai import ModelRetry
from pydantic_ai._griffe import doc_descriptions
from pydantic_ai._run_context import RunContext
from pydantic_ai.toolsets import FunctionToolset

from phoenix.server.agents.capabilities.skills.types import (
    Skill,
    SkillResource,
    SkillWrapper,
    normalize_skill_name,
)

# Template used by load_skill
LOAD_SKILL_TEMPLATE = """<skill>
<name>{skill_name}</name>
<description>{description}</description>
<uri>{uri}</uri>

<resources>
{resources_list}
</resources>

<instructions>
{content}
</instructions>
</skill>
"""


class SkillsToolset(FunctionToolset[Any]):
    """Pydantic AI toolset for automatic skill discovery and integration.

    See [skills docs](../creating-skills.md) for more information.

    This is the primary interface for integrating skills with Pydantic AI agents.
    It manages skills directly and provides tools for skill interaction.

    Provides the following tools to agents:
    - list_skills(): List all available skills
    - load_skill(skill_name): Load a specific skill's instructions
    - read_skill_resource(skill_name, resource_name): Read a skill resource file

    Example:
        ```python
        from pydantic_ai import Agent, SkillsToolset

        # Default: uses ./skills directory
        agent = Agent(
            model='openai:gpt-5.2',
            instructions="You are a helpful assistant.",
            toolsets=[SkillsToolset()]
        )

        # Multiple directories
        agent = Agent(
            model='openai:gpt-5.2',
            toolsets=[SkillsToolset(directories=["./skills", "./more-skills"])]
        )

        # Programmatic skills
        from pydantic_ai.toolsets.skills import Skill, SkillMetadata

        custom_skill = Skill(
            name="my-skill",
            uri="./custom",
            metadata=SkillMetadata(name="my-skill", description="Custom skill"),
            content="Instructions here",
        )
        agent = Agent(
            model='openai:gpt-5.2',
            toolsets=[SkillsToolset(skills=[custom_skill])]
        )

        # Combined mode: both programmatic skills and directories
        agent = Agent(
            model='openai:gpt-5.2',
            toolsets=[SkillsToolset(
                skills=[custom_skill],
                directories=["./skills"]
            )]
        )

        # Using SkillsDirectory instances directly
        from pydantic_ai.toolsets.skills import SkillsDirectory

        dir1 = SkillsDirectory(path="./skills")
        agent = Agent(
            model='openai:gpt-5.2',
            toolsets=[SkillsToolset(directories=[dir1, "./more-skills"])]
        )
        # Skills instructions are automatically injected via get_instructions()
        ```
    """

    def __init__(
        self,
        *,
        skills: list[Skill] | None = None,
        id: str | None = None,
        exclude_tools: set[str] | list[str] | None = None,
        max_retries: int = 1,
    ) -> None:
        """Initialize the skills toolset.

        Args:
            skills: List of pre-loaded Skill objects.
            id: Unique identifier for this toolset.
            exclude_tools: Set or list of tool names to exclude from registration
                (e.g., ['list_skills']). Valid tool names:
                'list_skills', 'load_skill', 'read_skill_resource'.
            max_retries: Maximum number of times the model is allowed to retry a tool call when
                the tool raises ``ModelRetry`` (e.g. when the LLM passes an unknown
                ``skill_name`` or ``resource_name``). Forwarded to
                :class:`pydantic_ai.toolsets.FunctionToolset` so every registered tool inherits
                this retry budget. Defaults to 1 (matching Pydantic AI's default).

        Example:
            ```python
            from phoenix.server.agents.capabilities.skills import Skill, SkillsToolset

            toolset = SkillsToolset(skills=[skill_one, skill_two])

            # Excluding specific tools
            toolset = SkillsToolset(skills=[...], exclude_tools=['list_skills'])
            ```
        """
        super().__init__(id=id, max_retries=max_retries)

        # Validate and initialize exclude_tools
        valid_tools = {"list_skills", "load_skill", "read_skill_resource"}
        self._exclude_tools: set[str] = set(exclude_tools or [])
        invalid = self._exclude_tools - valid_tools
        if invalid:
            raise ValueError(f"Unknown tools: {invalid}. Valid: {valid_tools}")

        if "load_skill" in self._exclude_tools:
            warnings.warn(
                "'load_skill' is a critical tool for skills usage and has been "
                "excluded. Agents will not be able to load skill instructions, which "
                "severely limits skill functionality.",
                UserWarning,
                stacklevel=2,
            )

        self._skills: dict[str, Skill] = {}
        self._programmatic_skills: list[Skill] = []

        if skills is not None:
            for skill in skills:
                self._programmatic_skills.append(skill)
                self._register_skill(skill)

        # Register tools
        self._register_tools()

    @property
    def skills(self) -> dict[str, Skill]:
        """Get the dictionary of loaded skills.

        Returns:
            Dictionary mapping skill names to Skill objects.
        """
        return self._skills

    def get_skill(self, name: str) -> Skill:
        """Get a specific skill by name.

        Args:
            name: Name of the skill to get.

        Returns:
            The requested Skill object.

        Raises:
            KeyError: If skill is not found.
        """
        if name not in self._skills:
            available = ", ".join(sorted(self._skills.keys())) or "none"
            raise KeyError(f"Skill '{name}' not found. Available: {available}")
        return self._skills[name]

    def _build_resource_xml(self, resource: SkillResource) -> str:
        """Build XML representation of a resource.

        Args:
            resource: The resource to format.

        Returns:
            XML string representation of the resource.
        """
        res_xml = f'<resource name="{resource.name}"'
        if resource.description:
            res_xml += f' description="{resource.description}"'
        if resource.function and resource.function_schema:
            params_json = json.dumps(resource.function_schema.json_schema)
            res_xml += f" parameters={json.dumps(params_json)}"
        res_xml += " />"
        return res_xml

    def _find_skill_resource(self, skill: Skill, resource_name: str) -> SkillResource | None:
        """Find a resource in a skill by name.

        Args:
            skill: The skill to search in.
            resource_name: The resource name to find.

        Returns:
            The resource if found, None otherwise.
        """
        if not skill.resources:
            return None
        for r in skill.resources:
            if r.name == resource_name:
                return r
        return None

    def _register_tools(self) -> None:
        """Register skill management tools with the toolset.

        This method registers skill management tools, excluding any specified in exclude_tools.
        Available tools: list_skills, load_skill, read_skill_resource.
        """
        if "list_skills" not in self._exclude_tools:
            self._register_list_skills()
        if "load_skill" not in self._exclude_tools:
            self._register_load_skill()
        if "read_skill_resource" not in self._exclude_tools:
            self._register_read_skill_resource()

    def _register_list_skills(self) -> None:
        """Register the list_skills tool."""

        @self.tool
        async def list_skills(_ctx: RunContext[Any]) -> dict[str, str]:  # pyright: ignore[reportUnusedFunction]
            """Get an overview of all available skills and what they do.

            Use this when you need to discover what skills exist or refresh your knowledge
            of available capabilities. Skills provide domain-specific knowledge and instructions
            for specialized tasks.

            Returns:
                Dictionary mapping skill names to their descriptions.
                Empty dictionary if no skills are available.
            """
            return {name: skill.description for name, skill in self._skills.items()}

    def _register_load_skill(self) -> None:
        """Register the load_skill tool."""

        @self.tool
        async def load_skill(ctx: RunContext[Any], skill_name: str) -> str:  # pyright: ignore[reportUnusedFunction]  # noqa: D417
            """Load complete instructions and capabilities for a specific skill.

            A skill contains detailed instructions and supplementary resources (like templates
            or reference docs). Load a skill when you need to perform a task within its domain.

            Args:
                skill_name: Exact name from your available skills list.
                    Must match exactly (e.g., "data-analysis" not "data analysis").

            Returns:
                Structured documentation containing:
                - Skill name, description, and source location
                - Available resources: supplementary files with their parameters
                - Detailed instructions: step-by-step guidance for using the skill

            Important:
            - Read the entire instructions section before taking action
            - Call this before using `read_skill_resource` for this skill
            - Resource names are authoritative - use exact names from the output
            - Do NOT infer or guess resource names
            - Check parameter schemas if resources require arguments
            """
            _ = ctx  # Required by Pydantic AI toolset protocol
            if skill_name not in self._skills:
                available = ", ".join(sorted(self._skills.keys())) or "none"
                raise ModelRetry(
                    f"Skill '{skill_name}' not found. Available skills: {available}. "
                    "Call list_skills to see options and try again with an exact name."
                )

            skill = self._skills[skill_name]

            # Build resources list with schemas for callable resources
            resources_parts: list[str] = []
            if skill.resources:
                for res in skill.resources:
                    resources_parts.append(self._build_resource_xml(res))
            resources_list = (
                "\n".join(resources_parts) if resources_parts else "<!-- No resources -->"
            )

            # Format response
            return LOAD_SKILL_TEMPLATE.format(
                skill_name=skill.name,
                description=skill.description,
                uri=skill.uri or "N/A",
                resources_list=resources_list,
                content=skill.content,
            )

    def _register_read_skill_resource(self) -> None:
        """Register the read_skill_resource tool."""

        @self.tool
        async def read_skill_resource(  # pyright: ignore[reportUnusedFunction]  # noqa: D417
            ctx: RunContext[Any],
            skill_name: str,
            resource_name: str,
            args: dict[str, Any] | None = None,
        ) -> str:
            """Access supplementary documentation, templates, or data from a skill.

            Resources are additional files that support skill execution. They can be static
            content (markdown docs, templates, schemas) or dynamic callables (functions that
            generate content based on parameters).

            When to use this:
            - When a skill's instructions reference a specific resource
            - To access form templates, reference documentation, or data schemas
            - When you need supplementary information beyond the skill instructions

            Args:
                skill_name: Name of the skill containing the resource.
                resource_name: Exact name of the resource as listed in the skill.
                    Examples: "FORMS.md", "REFERENCE.md", "get_schema"
                    Must match exactly - do not infer or guess.
                args: Arguments for callable resources (optional for static files).
                    Keys must match the parameter names in the resource's schema.

            Returns:
                The resource content as a string.

            Important:
            - Always call `load_skill(skill_name)` first in this run
            - Get resource names from the skill's documentation first
            - Use exact resource names - do not modify or guess
            - Check if the resource requires arguments (check its schema)
            - Static files don't need args; callables may require them
            """
            if skill_name not in self._skills:
                available = ", ".join(sorted(self._skills.keys())) or "none"
                raise ModelRetry(
                    f"Skill '{skill_name}' not found. Available skills: {available}. "
                    "Call list_skills first and try again with an exact name."
                )

            skill = self._skills[skill_name]

            # Find the resource
            resource = self._find_skill_resource(skill, resource_name)

            if resource is None:
                available_resources = [r.name for r in skill.resources] if skill.resources else []
                raise ModelRetry(
                    f"Resource '{resource_name}' not found in skill '{skill_name}'. "
                    f"Available resources: {available_resources}. "
                    "Use the exact name from load_skill output."
                )

            # Use resource.load() interface - implementation handles the details
            return await resource.load(ctx=ctx, args=args)  # type: ignore[no-any-return]

    def skill(
        self,
        func: Callable[[], str] | None = None,
        *,
        name: str | None = None,
        description: str | None = None,
        license: str | None = None,
        compatibility: str | None = None,
        metadata: dict[str, Any] | None = None,
        resources: list[SkillResource] | None = None,
    ) -> Any:
        """Decorator to define a skill using a function.

        The decorated function should return a string containing the skill's instructions/content.
        The skill name is derived from the function name (underscores replaced with hyphens)
        unless explicitly provided via the `name` parameter.

        Example:
            ```python
            from pydantic_ai import RunContext
            from pydantic_ai.toolsets.skills import SkillsToolset

            skills = SkillsToolset()

            @skills.skill(resources=[], metadata={'version': '1.0'})
            def data_analyzer() -> str:
                '''Analyze data from various sources.'''
                return '''
                Use this skill for data analysis tasks.
                The skill provides tools for querying and analyzing data.
                '''

            @data_analyzer.resource
            async def get_schema(ctx: RunContext[MyDeps]) -> str:
                return await ctx.deps.database.get_schema()
            ```

        Args:
            func: The function that returns skill content (must return str).
            name: Skill name (defaults to normalized function name: underscores → hyphens).
            description: Skill description (inferred from docstring if not provided).
            license: Optional license information (e.g., "Apache-2.0").
            compatibility: Optional environment requirements (e.g., "Requires Python 3.10+").
            metadata: Additional metadata fields as a dictionary.
            resources: Initial list of resources to attach to the skill.

        Returns:
            A SkillWrapper instance that can be used to attach resources.
        """

        def decorator(f: Callable[[], str]) -> SkillWrapper[Any]:
            # Derive name from function name if not provided
            if name is not None:
                # Explicit name provided - validate length only
                skill_name = name
                if len(skill_name) > 64:
                    raise ValueError(
                        f"Skill name '{skill_name}' exceeds 64 characters "
                        f"({len(skill_name)} chars)."
                    )
            else:
                # Derive and normalize from function name
                skill_name = normalize_skill_name(f.__name__)

            # Extract description from docstring if not provided
            skill_description = description
            if skill_description is None:
                sig = get_signature(f)
                desc, _ = doc_descriptions(f, sig, docstring_format="auto")
                skill_description = desc

            # Create the skill wrapper
            wrapper: SkillWrapper[Any] = SkillWrapper(
                function=f,
                name=skill_name,
                description=skill_description,
                license=license,
                compatibility=compatibility,
                metadata=metadata,
                resources=list(resources) if resources else [],
            )

            # Convert to Skill once to avoid calling the function twice
            skill = wrapper.to_skill()
            self._register_skill(skill)

            # Track as programmatic so it survives reload()
            self._programmatic_skills.append(skill)

            # Return the wrapper so resources can be attached
            return wrapper

        if func is None:
            # Called with arguments: @skills.skill(name="custom")
            return decorator
        else:
            # Called without arguments: @skills.skill
            return decorator(func)

    def _register_skill(self, skill: Skill | SkillWrapper[Any]) -> None:
        """Register a skill with the toolset.

        Converts SkillWrapper instances to Skill dataclasses before registering.
        Warns about duplicate skill names (last occurrence wins).

        Args:
            skill: Skill or SkillWrapper instance to register.
        """
        # Convert SkillWrapper to Skill if needed
        if isinstance(skill, SkillWrapper):
            skill = skill.to_skill()

        # Warn about duplicates
        if skill.name in self._skills:
            warnings.warn(
                f"Duplicate skill '{skill.name}' found. Overriding previous occurrence.",
                UserWarning,
                stacklevel=3,
            )

        # Register the skill
        self._skills[skill.name] = skill
