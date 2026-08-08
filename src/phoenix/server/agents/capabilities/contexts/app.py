from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from jinja2 import Template

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies


@dataclass
class AppContextCapability(AbstractStaticCapability[AgentDependencies]):
    """Renders the user's UI permission settings."""

    instructions: Template
    edit_permission: Literal["manual", "bypass"]

    def get_static_instructions(self) -> str:
        return self.instructions.render(edit_permission=self.edit_permission)
