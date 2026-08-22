from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "remove_prompt_instance"

DESCRIPTION = """\
Remove one playground prompt instance. Use this only when the user asks to delete, remove, or close a comparison instance, or when the playground has reached the comparison limit and the user chooses which instance should be removed.
Pass the numeric `instanceId`; use alphabetic labels (A, B, C, D) only when discussing instances with the user.
The playground must keep at least one prompt instance, so this tool is rejected when only one instance remains; explain that the playground must keep one prompt.
In manual approval mode the browser asks the user to accept or reject the removal; in bypass mode it removes immediately. Do not assume the removal landed until the tool output reports an accepted or removed status."""

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
    defer_loading=True,
)


@dataclass
class RemovePromptInstanceCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
