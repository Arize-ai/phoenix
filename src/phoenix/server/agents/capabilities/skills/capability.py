"""Capability integration for pydantic-ai-skills.

This module provides [`SkillsCapability`][pydantic_ai_skills.SkillsCapability],
the preferred integration path for Pydantic AI users via the `capabilities=[...]` API.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from pydantic_ai.agent.abstract import AgentInstructions
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import AgentDepsT

from .directory import SkillsDirectory
from .toolset import SkillsToolset
from .types import Skill


class SkillsCapability(AbstractCapability[Any]):
    """Capability wrapper for `SkillsToolset`.

    Use this class with the agent `capabilities=[...]` API.

    Example:
        ```python
        from pydantic_ai import Agent
        from phoenix.server.agents.capabilities.skills import SkillsCapability

        agent = Agent(
            model='openai:gpt-5.2',
            capabilities=[SkillsCapability(directories=['./skills'])],
        )
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
    ) -> None:
        """Initialize a skills capability.

        Args:
            skills: Pre-loaded skills.
            directories: Skill directories to discover.
            validate: Validate skill structure during discovery.
            max_depth: Maximum discovery depth.
            id: Optional toolset id.
            instruction_template: Optional custom instructions template.
            exclude_tools: Tool names to exclude.
            auto_reload: Re-scan directories before each run.
        """
        self._toolset = SkillsToolset(
            skills=skills,
            directories=directories,
            validate=validate,
            max_depth=max_depth,
            id=id,
            instruction_template=instruction_template,
            exclude_tools=exclude_tools,
            auto_reload=auto_reload,
        )

    def get_toolset(self) -> SkillsToolset | None:
        """Return the underlying skills toolset."""
        return self._toolset

    def get_instructions(self) -> AgentInstructions[AgentDepsT] | None:  # type: ignore[valid-type]
        """Return None — instructions are pulled natively from the toolset by the agent."""
        return None

    @property
    def toolset(self) -> SkillsToolset:
        """Expose the underlying `SkillsToolset` instance."""
        return self._toolset
