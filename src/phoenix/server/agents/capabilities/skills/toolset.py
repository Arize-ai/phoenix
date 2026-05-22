from __future__ import annotations

from typing import Any

from jinja2 import Template
from pydantic_ai import ModelRetry
from pydantic_ai._run_context import RunContext
from pydantic_ai.toolsets import FunctionToolset

from phoenix.server.agents.capabilities.skills.skill import Skill
from phoenix.server.agents.capabilities.skills.skill_resource import SkillResource
from phoenix.server.agents.types import AgentDependencies


class SkillsToolset(FunctionToolset[AgentDependencies]):
    """Pydantic AI toolset for automatic skill discovery and integration.

    Provides the following tools to agents:
    - load_skill(skill_name): Load a specific skill's instructions
    - read_skill_resource(skill_name, resource_name): Read a skill resource file
    """

    def __init__(
        self,
        *,
        skills: list[Skill],
        load_skill_template: Template,
    ) -> None:
        if not skills:
            raise ValueError("SkillsToolset requires at least one skill")

        self._load_skill_template = load_skill_template
        self._skills: dict[str, Skill] = {}
        for skill in skills:
            if skill.name in self._skills:
                raise ValueError(f"Duplicate skill '{skill.name}'")
            self._skills[skill.name] = skill

        async def load_skill(ctx: RunContext[AgentDependencies], skill_name: str) -> str:
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
                    "Try again with an exact name from the list."
                )
            return self._load_skill_template.render(skill=self._skills[skill_name])

        async def read_skill_resource(
            ctx: RunContext[AgentDependencies],
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
                    "Try again with an exact name from the list."
                )
            skill = self._skills[skill_name]
            resource = _find_skill_resource(skill, resource_name)
            if resource is None:
                available_resources = [r.name for r in skill.resources] if skill.resources else []
                raise ModelRetry(
                    f"Resource '{resource_name}' not found in skill '{skill_name}'. "
                    f"Available resources: {available_resources}. "
                    "Use the exact name from load_skill output."
                )
            return await resource.load(ctx=ctx, args=args)

        super().__init__(tools=[load_skill, read_skill_resource])

    @property
    def skills(self) -> list[Skill]:
        """Get the list of loaded skills."""
        return list(self._skills.values())


def _find_skill_resource(skill: Skill, resource_name: str) -> SkillResource | None:
    if not skill.resources:
        return None
    for r in skill.resources:
        if r.name == resource_name:
            return r
    return None
