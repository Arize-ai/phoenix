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

NAME = "clone_prompt_instance"

DESCRIPTION = (
    "Clone an existing playground prompt instance into a new comparison instance. "
    "Use this before proposing prompt edits when the user wants to compare a variant "
    "against the original. If there is exactly one playground instance, `instanceId` "
    "may be omitted. If there are multiple comparison instances, pass the specific "
    "`instanceId` to clone. Use the alphabetic labels (A, B, C, D) when discussing "
    "instances with the user, but pass numeric instance IDs when calling tools. The "
    "playground supports at most 4 comparison instances; this tool is rejected when "
    "4 instances already exist. The cloned instance receives fresh message IDs; call "
    "`read_prompt_instance` on the cloned instance before editing it."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "instanceId": {
            "type": "integer",
            "description": (
                "The playground instance ID to clone. Omit only when there is exactly one "
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
class ClonePromptInstanceCapability(AbstractDynamicCapability[AgentDependencies]):
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
