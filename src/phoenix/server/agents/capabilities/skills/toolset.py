"""Skills toolset implementation.

This module provides the main [`SkillsToolset`][pydantic_ai_skills.SkillsToolset]
class that integrates skill discovery and management with Pydantic AI agents.

The toolset provides four main tools for agents:
- list_skills: List all available skills
- load_skill: Load full instructions for a specific skill
- read_skill_resource: Read skill resource files or invoke callable resources
- run_skill_script: Execute skill scripts
"""

from __future__ import annotations

import json
import warnings
from collections.abc import Callable
from inspect import signature as get_signature
from pathlib import Path
from typing import Annotated, Any

from pydantic import BeforeValidator
from pydantic_ai import ModelRetry
from pydantic_ai._griffe import doc_descriptions
from pydantic_ai._run_context import RunContext
from pydantic_ai.toolsets import FunctionToolset

from ._parsing import SKILL_NAME_PATTERN
from .directory import SkillsDirectory
from .types import (
    Skill,
    SkillResource,
    SkillScript,
    SkillWrapper,
    normalize_skill_name,
)

# Default instruction template for skills system prompt
_INSTRUCTION_SKILLS_HEADER = """\
You have access to a collection of skills containing domain-specific knowledge and capabilities.
Each skill provides specialized instructions, resources, and scripts for specific tasks.

<available_skills>
{skills_list}
</available_skills>

When a task falls within a skill's domain:
1. Use `load_skill` first to read the complete skill instructions for that skill
2. Only after `load_skill` succeeds, follow the skill's guidance to complete the task
3. Call `read_skill_resource` or `run_skill_script` only for skills already loaded with `load_skill`
4. Never guess resource or script names; use the exact names listed by `load_skill`

Use progressive disclosure: load only what you need, when you need it."""

# Template used by load_skill
LOAD_SKILL_TEMPLATE = """<skill>
<name>{skill_name}</name>
<description>{description}</description>
<uri>{uri}</uri>

<resources>
{resources_list}
</resources>

<scripts>
{scripts_list}
</scripts>

<instructions>
{content}
</instructions>
</skill>
"""


def _coerce_to_dict(v: Any) -> Any:
    """Convert JSON string to dict if needed, pass through non-string values unchanged."""
    if isinstance(v, str):
        try:
            parsed = json.loads(v)
        except json.JSONDecodeError as e:
            # Catch JSON parsing errors and throw a more intuitive error message
            raise ValueError(
                f"Invalid JSON string. Error: {e.msg} at line {e.lineno} "
                f"col {e.colno}. Input snippet: {v[:100]}"
            ) from e
        if not isinstance(parsed, dict):
            raise ValueError(f"args must be a JSON object, got {type(parsed).__name__}")
        return parsed
    return v


class SkillsToolset(FunctionToolset[Any]):
    """Pydantic AI toolset for automatic skill discovery and integration.

    See [skills docs](../creating-skills.md) for more information.

    This is the primary interface for integrating skills with Pydantic AI agents.
    It manages skills directly and provides tools for skill interaction.

    Provides the following tools to agents:
    - list_skills(): List all available skills
    - load_skill(skill_name): Load a specific skill's instructions
    - read_skill_resource(skill_name, resource_name): Read a skill resource file
    - run_skill_script(skill_name, script_name, args): Execute a skill script

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
        directories: list[str | Path | SkillsDirectory] | None = None,
        validate: bool = True,
        max_depth: int | None = 3,
        id: str | None = None,
        instruction_template: str | None = None,
        exclude_tools: set[str] | list[str] | None = None,
        auto_reload: bool = False,
        max_retries: int = 1,
    ) -> None:
        """Initialize the skills toolset.

        Args:
            skills: List of pre-loaded Skill objects. Can be combined with `directories`.
            directories: List of directories or SkillsDirectory instances to discover skills from.
                Can be combined with `skills`. If both are None, defaults to ["./skills"].
                String/Path entries are converted to SkillsDirectory instances.
            validate: Validate skill structure during discovery (used when creating
                SkillsDirectory from str/Path).
            max_depth: Maximum depth for skill discovery (None for unlimited, used when
                creating SkillsDirectory from str/Path).
            id: Unique identifier for this toolset.
            instruction_template: Custom instruction template for skills system prompt.
                Must include `{skills_list}` placeholder. If None, uses default template.
                Tool usage guidance is provided in the tool docstrings themselves.
            exclude_tools: Set or list of tool names to exclude from registration
                (e.g., ['run_skill_script']). Useful for security or capability
                restrictions such as disabling script execution. Valid tool names:
                'list_skills', 'load_skill', 'read_skill_resource', 'run_skill_script'.
            auto_reload: If True, automatically re-scan all configured directories before each
                agent run by calling :meth:`reload` inside :meth:`get_instructions`. Useful for
                long-lived servers where skill files may be edited at runtime. Programmatic skills
                defined via ``skills=`` or ``@toolset.skill`` are always preserved. Defaults to
                False.
            max_retries: Maximum number of times the model is allowed to retry a tool call when
                the tool raises ``ModelRetry`` (e.g. when the LLM passes an unknown
                ``skill_name``, ``resource_name``, or ``script_name``). Forwarded to
                :class:`pydantic_ai.toolsets.FunctionToolset` so every registered tool inherits
                this retry budget. Defaults to 1 (matching Pydantic AI's default).

        Example:
            ```python
            # Default: uses ./skills directory
            toolset = SkillsToolset()

            # Multiple directories
            toolset = SkillsToolset(directories=["./skills", "./more-skills"])

            # Programmatic skills
            toolset = SkillsToolset(skills=[skill1, skill2])

            # Combined mode
            toolset = SkillsToolset(
                skills=[skill1, skill2],
                directories=["./skills", skills_dir_instance]
            )

            # Using SkillsDirectory instances directly
            dir1 = SkillsDirectory(path="./skills")
            toolset = SkillsToolset(directories=[dir1])

            # Excluding specific tools (disable script execution with a set)
            toolset = SkillsToolset(exclude_tools=['run_skill_script'])

            # Auto-reload: re-scan directories before every agent run
            toolset = SkillsToolset(directories=['./skills'], auto_reload=True)
            ```
        """
        super().__init__(id=id, max_retries=max_retries)

        self._instruction_template = instruction_template

        # Validate and initialize exclude_tools
        valid_tools = {"list_skills", "load_skill", "read_skill_resource", "run_skill_script"}
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

        self._auto_reload = auto_reload

        # Initialize the skills dict and directories list (for refresh)
        self._skills: dict[str, Skill] = {}
        self._programmatic_skills: list[Skill] = []
        self._skill_directories: list[SkillsDirectory] = []
        self._validate = validate
        self._max_depth = max_depth

        # Load programmatic skills first (highest priority)
        if skills is not None:
            for skill in skills:
                self._programmatic_skills.append(skill)
                self._register_skill(skill)

        # Load directory-based skills (second priority)
        if directories is not None:
            self._load_directory_skills(directories)
        elif skills is None:
            # Default: ./skills directory (only if no skills provided)
            default_dir = Path("./skills")
            if not default_dir.exists():
                warnings.warn(
                    f"Default skills directory '{default_dir}' does not exist. "
                    "No skills will be loaded.",
                    UserWarning,
                    stacklevel=2,
                )
            else:
                self._load_directory_skills([default_dir])

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

    def _load_directory_skills(self, directories: list[str | Path | SkillsDirectory]) -> None:
        """Load skills from configured directories.

        Converts directory specifications to SkillsDirectory instances,
        appends them to ``_skill_directories``, then scans all registered
        directories via :meth:`_collect_dir_skills_into`.

        Args:
            directories: List of directory paths or SkillsDirectory instances.
        """
        for directory in directories:
            if isinstance(directory, SkillsDirectory):
                skill_dir = directory
            else:
                skill_dir = SkillsDirectory(
                    path=directory,
                    validate=self._validate,
                    max_depth=self._max_depth,
                )
            self._skill_directories.append(skill_dir)

        self._collect_dir_skills_into(self._skills)

    def _collect_dir_skills_into(self, target: dict[str, Skill]) -> None:
        """Scan all configured skill directories and populate *target*.

        Programmatic skill names are treated as protected — directory skills
        with the same name are silently skipped so that programmatic skills
        always retain the highest priority.  Within directory-sourced skills,
        later directories override earlier ones (last-directory-wins).

        Args:
            target: Mapping to populate with discovered skills.
        """
        programmatic_names = {s.name for s in self._programmatic_skills}
        for skill_dir in self._skill_directories:
            for skill in skill_dir.get_skills().values():
                if skill.name in programmatic_names:
                    continue  # programmatic always wins
                if skill.name in target:
                    warnings.warn(
                        f"Duplicate skill '{skill.name}' found. Overriding previous occurrence.",
                        UserWarning,
                        stacklevel=3,
                    )
                target[skill.name] = skill

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

    def _build_script_xml(self, script: SkillScript) -> str:
        """Build XML representation of a script.

        Args:
            script: The script to format.

        Returns:
            XML string representation of the script.
        """
        scr_xml = f'<script name="{script.name}"'
        if script.description:
            scr_xml += f' description="{script.description}"'
        if script.function and script.function_schema:
            params_json = json.dumps(script.function_schema.json_schema)
            scr_xml += f" parameters={json.dumps(params_json)}"
        scr_xml += " />"
        return scr_xml

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

    def _find_skill_script(self, skill: Skill, script_name: str) -> SkillScript | None:
        """Find a script in a skill by name.

        Args:
            skill: The skill to search in.
            script_name: The script name to find.

        Returns:
            The script if found, None otherwise.
        """
        if not skill.scripts:
            return None
        for s in skill.scripts:
            if s.name == script_name:
                return s
        return None

    def _register_tools(self) -> None:
        """Register skill management tools with the toolset.

        This method registers skill management tools, excluding any specified in exclude_tools.
        Available tools: list_skills, load_skill, read_skill_resource, run_skill_script.
        """
        if "list_skills" not in self._exclude_tools:
            self._register_list_skills()
        if "load_skill" not in self._exclude_tools:
            self._register_load_skill()
        if "read_skill_resource" not in self._exclude_tools:
            self._register_read_skill_resource()
        if "run_skill_script" not in self._exclude_tools:
            self._register_run_skill_script()

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

            A skill contains detailed instructions, supplementary resources (like templates or
            reference docs), and executable scripts. Load a skill when you need to perform a
            task within its domain.

            Args:
                skill_name: Exact name from your available skills list.
                    Must match exactly (e.g., "data-analysis" not "data analysis").

            Returns:
                Structured documentation containing:
                - Skill name, description, and source location
                - Available resources: supplementary files with their parameters
                - Available scripts: executable programs with their parameters
                - Detailed instructions: step-by-step guidance for using the skill

            Important:
            - Read the entire instructions section before taking action
            - Call this before using `read_skill_resource` or `run_skill_script` for this skill
            - Resource and script names are authoritative - use exact names from the output
            - Do NOT infer or guess resource/script names
            - Check parameter schemas if resources or scripts require arguments
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

            # Build scripts list with schemas for callable scripts
            scripts_parts: list[str] = []
            if skill.scripts:
                for scr in skill.scripts:
                    scripts_parts.append(self._build_script_xml(scr))
            scripts_list = "\n".join(scripts_parts) if scripts_parts else "<!-- No scripts -->"

            # Format response
            return LOAD_SKILL_TEMPLATE.format(
                skill_name=skill.name,
                description=skill.description,
                uri=skill.uri or "N/A",
                resources_list=resources_list,
                scripts_list=scripts_list,
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

    def _register_run_skill_script(self) -> None:
        """Register the run_skill_script tool."""

        @self.tool
        async def run_skill_script(  # pyright: ignore[reportUnusedFunction]  # noqa: D417
            ctx: RunContext[Any],
            skill_name: str,
            script_name: str,
            args: Annotated[dict[str, Any] | None, BeforeValidator(_coerce_to_dict)] = None,
        ) -> str:
            """Execute a skill script that performs actions or computations.

            Scripts are executable programs provided by skills that can perform actions
            (API calls, file operations), process data (transformations, analysis), or
            generate outputs (reports, visualizations).

            When to use this:
            - When a skill's instructions tell you to run a specific script
            - To perform automated tasks that the skill provides
            - For data processing, API interactions, or file operations

            Args:
                skill_name: Name of the skill containing the script.
                script_name: Exact name of the script as listed in the skill.
                    Examples: "analyze.py", "scripts/analyze.py", "scripts/deploy.sh",
                    "scripts/runner". Must match exactly - do not infer or guess.
                args: Arguments required by the script.
                    Keys must match the parameter names in the script's schema.

            Returns:
                Script execution output including stdout and stderr.

            Important:
            - Always call `load_skill(skill_name)` first in this run
            - Get script names from the skill's documentation first
            - Use exact script names - do not modify or guess
            - Check the script's parameter schema for required arguments
            - Review skill instructions before running scripts
            - Scripts may modify external state (files, databases, APIs)
            - Execution errors are included in the output
            """
            if skill_name not in self._skills:
                available = ", ".join(sorted(self._skills.keys())) or "none"
                raise ModelRetry(
                    f"Skill '{skill_name}' not found. Available skills: {available}. "
                    "Call list_skills first and try again with an exact name."
                )

            skill = self._skills[skill_name]

            # Find the script
            script = self._find_skill_script(skill, script_name)

            if script is None:
                available_scripts = [s.name for s in skill.scripts] if skill.scripts else []
                raise ModelRetry(
                    f"Script '{script_name}' not found in skill '{skill_name}'. "
                    f"Available scripts: {available_scripts}. "
                    "Use the exact name from load_skill output."
                )

            # Use script.run() interface - implementation handles the details
            return await script.run(ctx=ctx, args=args)  # type: ignore[no-any-return]

    async def get_instructions(self, ctx: RunContext[Any]) -> str | None:  # type: ignore[override]
        """Return instructions to inject into the agent's system prompt.

        Returns the skills system prompt containing usage guidance and all skill metadata.
        When ``auto_reload=True`` was set, re-discovers skills from disk before building
        the prompt so that any edits made since the last run are immediately visible.

        Args:
            ctx: The run context for this agent run.

        Returns:
            The skills system prompt, or None if no skills are loaded.
        """
        if self._auto_reload:
            self.reload()

        if not self._skills:
            return None

        # Build skills list in XML format
        skills_list_lines: list[str] = []
        for skill in sorted(self._skills.values(), key=lambda s: s.name):
            skills_list_lines.append("<skill>")
            skills_list_lines.append(f"<name>{skill.name}</name>")
            skills_list_lines.append(f"<description>{skill.description}</description>")
            if skill.uri:
                skills_list_lines.append(f"<uri>{skill.uri}</uri>")
            skills_list_lines.append("</skill>")
        skills_list = "\n".join(skills_list_lines)

        # Use custom template if provided, otherwise use default
        if self._instruction_template:
            return self._instruction_template.format(skills_list=skills_list)

        return _INSTRUCTION_SKILLS_HEADER.format(skills_list=skills_list)

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
        scripts: list[SkillScript] | None = None,
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

            @data_analyzer.script
            async def run_analysis(ctx: RunContext[MyDeps], query: str) -> str:
                result = await ctx.deps.database.execute(query)
                return str(result)
            ```

        Args:
            func: The function that returns skill content (must return str).
            name: Skill name (defaults to normalized function name: underscores → hyphens).
            description: Skill description (inferred from docstring if not provided).
            license: Optional license information (e.g., "Apache-2.0").
            compatibility: Optional environment requirements (e.g., "Requires Python 3.10+").
            metadata: Additional metadata fields as a dictionary.
            resources: Initial list of resources to attach to the skill.
            scripts: Initial list of scripts to attach to the skill.

        Returns:
            A SkillWrapper instance that can be used to attach resources and scripts.
        """

        def decorator(f: Callable[[], str]) -> SkillWrapper[Any]:
            # Derive name from function name if not provided
            if name is not None:
                # Explicit name provided - validate it directly without normalization
                skill_name = name
                # Validate the explicit name
                if not SKILL_NAME_PATTERN.match(skill_name):
                    raise ValueError(
                        f"Skill name '{skill_name}' is invalid. "
                        "Skill names must contain only lowercase letters, numbers, and hyphens "
                        "(no consecutive hyphens)."
                    )
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
                scripts=list(scripts) if scripts else [],
            )

            # Convert to Skill once to avoid calling the function twice
            skill = wrapper.to_skill()
            self._register_skill(skill)

            # Track as programmatic so it survives reload()
            self._programmatic_skills.append(skill)

            # Return the wrapper so resources/scripts can be attached
            return wrapper

        if func is None:
            # Called with arguments: @skills.skill(name="custom")
            return decorator
        else:
            # Called without arguments: @skills.skill
            return decorator(func)

    def reload(self) -> None:
        """Re-discover skills from all configured sources.

        Re-scans all configured directories for SKILL.md changes and re-applies
        programmatic skills. Useful for long-lived servers where skill files may be
        edited (by the agent itself, a git-sync job, or a human) without restarting
        the process.

        Priority after reload (same as initial load):

        1. Programmatic skills (``skills=`` param and ``@toolset.skill`` decorated
           functions) — always applied first; directory skills with the same name
           are silently skipped.
        2. Directory skills — fresh filesystem scan via
           :meth:`~pydantic_ai_skills.SkillsDirectory.get_skills`.

        Example:
            ```python
            # Manual reload after an external git-sync
            skills_toolset = SkillsToolset(directories=[WORKSPACE / "skills"])

            async def lifespan(app):
                await git_sync()
                skills_toolset.reload()
                yield

            # Automatic reload before every agent run
            skills_toolset = SkillsToolset(
                directories=[WORKSPACE / "skills"],
                auto_reload=True,
            )
            ```
        """
        # Build a new dict atomically to avoid transient empty/partial state visible
        # to concurrent callers.
        new_skills: dict[str, Skill] = {}

        # 1. Highest priority: programmatic skills (always preserved)
        for skill in self._programmatic_skills:
            new_skills[skill.name] = skill

        # 2. Directory skills — programmatic names are protected inside the helper
        self._collect_dir_skills_into(new_skills)

        # Atomically replace the skills mapping once fully populated
        self._skills = new_skills

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
