from __future__ import annotations

from typing import Any

from jinja2 import Template
from pydantic_ai import ModelRetry, Tool
from pydantic_ai._run_context import RunContext
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets import FunctionToolset

from phoenix.server.agents.capabilities.skills.skill import Skill
from phoenix.server.agents.capabilities.skills.skill_resource import SkillResource


class SkillsToolset(FunctionToolset[AgentDepsT]):
    """Pydantic AI toolset for automatic skill discovery and integration."""

    def __init__(
        self,
        *,
        skills: list[Skill],
        load_skill_template: Template,
        load_skill_tool_template: Template,
        read_skill_resource_tool_template: Template,
    ) -> None:
        if not skills:
            raise ValueError("SkillsToolset requires at least one skill")

        self._load_skill_template = load_skill_template
        self._skills: dict[str, Skill] = {}
        for skill in skills:
            if skill.name in self._skills:
                raise ValueError(f"Duplicate skill '{skill.name}'")
            self._skills[skill.name] = skill

        def load_skill(skill_name: str) -> str:
            if skill_name not in self._skills:
                available = ", ".join(sorted(self._skills.keys())) or "none"
                raise ModelRetry(
                    f"Skill '{skill_name}' not found. Available skills: {available}. "
                    "Try again with an exact name from the list."
                )
            return self._load_skill_template.render(skill=self._skills[skill_name])

        async def read_skill_resource(
            ctx: RunContext[AgentDepsT],
            skill_name: str,
            resource_name: str,
            args: dict[str, Any] | None = None,
        ) -> Any:
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

        super().__init__(
            tools=[
                Tool(
                    load_skill,
                    takes_ctx=False,
                    description=load_skill_tool_template.render(),
                ),
                Tool(
                    read_skill_resource,
                    takes_ctx=True,
                    description=read_skill_resource_tool_template.render(),
                ),
            ]
        )

    @property
    def skills(self) -> list[Skill]:
        """Get the list of loaded skills."""
        return list(self._skills.values())


def _find_skill_resource(skill: Skill, resource_name: str) -> SkillResource[Any] | None:
    if not skill.resources:
        return None
    for resource in skill.resources:
        if resource.name == resource_name:
            return resource
    return None
