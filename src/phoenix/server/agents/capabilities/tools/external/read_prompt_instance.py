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

NAME = "read_prompt_instance"

DESCRIPTION = (
    "Read the current playground prompt for one instance. Use this before editing a "
    "playground prompt so you have stable message IDs and the latest revision token. "
    "The result includes both the numeric `instanceId` for tool calls and the alphabetic "
    "`label` (A, B, C, D) shown to the user; use labels when discussing instances with "
    "the user. "
    "If there is exactly one playground instance, `instanceId` may be omitted. If "
    "there are multiple comparison instances, pass the specific `instanceId`."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "instanceId": {
            "type": "integer",
            "description": (
                "The playground instance ID to read. Omit only when there is exactly one "
                "playground instance."
            ),
        },
    },
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class ReadPromptInstanceCapability(AbstractDynamicCapability[AgentDependencies]):
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
