from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "read_prompt_instance"

DESCRIPTION = """\
Read the current playground prompt for one instance, including its messages, message IDs, and the revision token required to safely propose edits. Call this before `edit_prompt_instance` on any playground prompt, before `clone_prompt_instance` when you want to summarize the source for the user, and whenever the user asks what a prompt instance currently contains.
The result includes both the numeric `instanceId` for tool calls and the alphabetic `label` (A, B, C, D) shown to the user; use labels when discussing instances with the user.
If there is exactly one playground instance, `instanceId` may be omitted. If there are multiple comparison instances, always pass the specific `instanceId` you want.
Treat the returned `revision` as opaque: pass it back unchanged as `expectedRevision` when calling `edit_prompt_instance`. If the prompt has changed since you read it, the edit is rejected and you should re-read before retrying."""

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
class ReadPromptInstanceCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
