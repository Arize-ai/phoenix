from __future__ import annotations

from typing import Any

from pydantic_ai import RunContext

from phoenix.server.agents.toolsets.external.external_tool_definitions import (
    DynamicExternalToolDefinition,
)
from phoenix.server.agents.types import AgentDependencies

_READ_PROMPT_TOOL_NAME = "read_prompt_instance"

_READ_PROMPT_TOOL_DESCRIPTION = (
    "Read the current playground prompt for one instance. Use this before editing a "
    "playground prompt so you have stable message IDs and the latest revision token. "
    "The result includes both the numeric `instanceId` for tool calls and the alphabetic "
    "`label` (A, B, C, D) shown to the user; use labels when discussing instances with "
    "the user. "
    "If there is exactly one playground instance, `instanceId` may be omitted. If "
    "there are multiple comparison instances, pass the specific `instanceId`."
)

_READ_PROMPT_TOOL_PARAMETERS: dict[str, Any] = {
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


def build_read_prompt_tool(instructions: str) -> DynamicExternalToolDefinition:
    tool = DynamicExternalToolDefinition(
        name=_READ_PROMPT_TOOL_NAME,
        description=_READ_PROMPT_TOOL_DESCRIPTION,
        parameters_json_schema=_READ_PROMPT_TOOL_PARAMETERS,
        instructions=instructions,
    )

    @tool.include
    def _include(ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None

    return tool
