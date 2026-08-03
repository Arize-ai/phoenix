from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "add_prompt_instance"

DESCRIPTION = """\
Add a fresh chat prompt instance to the mounted playground for comparison. Use this when the user \
wants a new prompt variant that starts from the default chat prompt messages instead of copying \
existing prompt messages; use `clone_prompt_instance` instead when they want to keep the existing \
prompt content as the starting point. The new instance gets the playground default chat messages, \
fresh message IDs, and no saved prompt association, while inheriting runnable model and tool \
configuration from the playground.
The playground supports at most 4 comparison instances; this tool is rejected when 4 instances \
already exist. If the limit is reached, ask the user which instance to remove before retrying.
The output includes an `addedInstance` snapshot with the instance ID, message IDs, and revision \
needed by `edit_prompt_instance`.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class AddPromptInstanceCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
