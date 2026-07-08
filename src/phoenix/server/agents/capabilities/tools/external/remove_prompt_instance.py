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

NAME = "remove_prompt_instance"

DESCRIPTION = (
    "Remove one playground prompt instance. Use this only when the user asks to "
    "delete or remove a comparison instance. Pass the numeric `instanceId`; use "
    "alphabetic labels (A, B, C, D) only when discussing instances with the user. "
    "The playground must keep at least one prompt instance, so this tool is rejected "
    "when only one instance remains. In manual approval mode the browser asks the "
    "user to accept or reject the removal; in bypass mode it removes immediately."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "instanceId": {
            "type": "integer",
            "description": "The numeric playground instance ID to remove.",
        },
    },
    "required": ["instanceId"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class RemovePromptInstanceCapability(AbstractDynamicCapability[AgentDependencies]):
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
