from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_playground_repetitions"
MIN_REPETITIONS = 1
MAX_REPETITIONS = 30

DESCRIPTION = (
    "Set the playground-wide repetitions count in the currently mounted playground. "
    "Use this before running when the user wants more confidence across repeated "
    "LLM calls, is investigating flaky outputs, or wants to validate structured "
    "output or tool-call behavior before saving a prompt."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "repetitions": {
            "type": "integer",
            "minimum": MIN_REPETITIONS,
            "maximum": MAX_REPETITIONS,
            "description": "The number of times each playground task should run.",
        },
    },
    "required": ["repetitions"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetPlaygroundRepetitionsCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
