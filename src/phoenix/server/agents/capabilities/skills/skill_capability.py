from __future__ import annotations

from dataclasses import dataclass

from jinja2 import Template
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets import AgentToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.capabilities.skills.toolset import SkillsToolset


@dataclass
class SkillsCapability(AbstractStaticCapability[AgentDepsT]):
    """Capability that wraps a skills toolset with a static instructions template."""

    toolset: SkillsToolset[AgentDepsT]
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDepsT] | None:
        return self.toolset

    def get_static_instructions(self) -> str:
        return self.instructions.render(skills=self.toolset.skills)
