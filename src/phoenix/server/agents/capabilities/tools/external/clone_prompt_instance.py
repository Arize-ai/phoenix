from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "clone_prompt_instance"

DESCRIPTION = """\
Clone an existing playground prompt instance into a new comparison instance. Use this before proposing prompt edits when the user wants to compare a variant against the original. If there is exactly one playground instance, `instanceId` may be omitted. If there are multiple comparison instances, pass the specific `instanceId` to clone. Use the alphabetic labels (A, B, C, D) when discussing instances with the user, but pass numeric instance IDs when calling tools.
The playground supports at most 4 comparison instances; this tool is rejected when 4 instances already exist. If the limit is reached, ask the user which instance to remove (or whether to overwrite an existing instance instead) before retrying.
The cloned instance receives fresh message IDs; call `read_prompt_instance` on the cloned instance to obtain its message IDs and revision before calling `edit_prompt_instance`."""

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
    defer_loading=True,
)


@dataclass
class ClonePromptInstanceCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
