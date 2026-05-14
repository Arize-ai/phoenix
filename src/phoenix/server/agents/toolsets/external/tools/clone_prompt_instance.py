from __future__ import annotations

from typing import Any

from pydantic_ai import RunContext

from phoenix.server.agents.toolsets.external.external_tool_definitions import (
    DynamicExternalToolDefinition,
)
from phoenix.server.agents.types import AgentDependencies

_CLONE_PROMPT_INSTANCE_TOOL_NAME = "clone_prompt_instance"

_CLONE_PROMPT_INSTANCE_TOOL_DESCRIPTION = (
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

_CLONE_PROMPT_INSTANCE_TOOL_PARAMETERS: dict[str, Any] = {
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


def build_clone_prompt_instance_tool(instructions: str) -> DynamicExternalToolDefinition:
    tool = DynamicExternalToolDefinition(
        name=_CLONE_PROMPT_INSTANCE_TOOL_NAME,
        description=_CLONE_PROMPT_INSTANCE_TOOL_DESCRIPTION,
        parameters_json_schema=_CLONE_PROMPT_INSTANCE_TOOL_PARAMETERS,
        instructions=instructions,
    )

    @tool.include
    def _include(ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None

    return tool
