from __future__ import annotations

from dataclasses import dataclass, field

from jinja2 import Template
from pydantic_ai.toolsets import AgentToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.capabilities.skills.toolset import SkillsToolset
from phoenix.server.agents.types import AgentDependencies


@dataclass
class SkillsCapability(AbstractStaticCapability[AgentDependencies]):
    """Capability that wraps a skills toolset with a static instructions template.

    The template must reference a ``skills_list`` variable; it is rendered once
    at construction time using the toolset's loaded skills.
    """

    toolset: SkillsToolset
    instructions: Template
    _rendered: str = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._rendered = self.instructions.render(skills_list=_skills_list_xml(self.toolset))

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return self.toolset

    def get_static_instructions(self) -> str:
        return self._rendered


def _skills_list_xml(toolset: SkillsToolset) -> str:
    lines: list[str] = []
    for skill in sorted(toolset.skills.values(), key=lambda s: s.name):
        lines.append("<skill>")
        lines.append(f"<name>{skill.name}</name>")
        lines.append(f"<description>{skill.description}</description>")
        if skill.uri:
            lines.append(f"<uri>{skill.uri}</uri>")
        lines.append("</skill>")
    return "\n".join(lines)
