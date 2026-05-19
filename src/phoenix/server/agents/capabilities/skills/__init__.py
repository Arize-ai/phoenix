"""pydantic-ai-skills: A tool-calling-based agent skills implementation for Pydantic AI.

This package provides a standardized, composable framework for building and managing
Agent Skills within the Pydantic AI ecosystem. Agent Skills are modular collections
of instructions, scripts, tools, and resources that enable AI agents to progressively
discover, load, and execute specialized capabilities for domain-specific tasks.

Key components:
- `SkillsToolset`: Main toolset for integrating skills with agents
- `Skill`: Data class representing a skill with resources and scripts
- `SkillsDirectory`: Filesystem-based skill discovery and management
- `LocalSkillScriptExecutor`: Execute scripts via subprocess
- `CallableSkillScriptExecutor`: Wrap callables as script executors

Example:
    ```python
    from pydantic_ai import Agent
    from phoenix.server.agents.capabilities.skills import SkillsToolset

    # Initialize Skills Toolset with skill directories
    skills_toolset = SkillsToolset(directories=["./skills"])

    # Create agent with skills as a toolset
    # Skills instructions are automatically injected via get_instructions()
    agent = Agent(
        model='openai:gpt-5.2',
        instructions="You are a helpful research assistant.",
        toolsets=[skills_toolset]
    )

    # Use agent - skills tools are available for the agent to call
    result = await agent.run(
        "What are the last 3 papers on arXiv about machine learning?"
    )
    print(result.output)
    ```
"""

from phoenix.server.agents.capabilities.skills.capability import SkillsCapability
from phoenix.server.agents.capabilities.skills.directory import (
    SkillsDirectory,
    discover_skills,
    parse_skill_md,
)
from phoenix.server.agents.capabilities.skills.local import (
    CallableSkillScriptExecutor,
    LocalSkillScriptExecutor,
)
from phoenix.server.agents.capabilities.skills.toolset import SkillsToolset
from phoenix.server.agents.capabilities.skills.types import Skill, SkillResource, SkillScript

__all__ = [
    # Main toolset
    "SkillsToolset",
    "SkillsCapability",
    # Directory discovery
    "SkillsDirectory",
    # Executors
    "LocalSkillScriptExecutor",
    "CallableSkillScriptExecutor",
    # Types
    "Skill",
    "SkillResource",
    "SkillScript",
    # Utility functions
    "discover_skills",
    "parse_skill_md",
]
