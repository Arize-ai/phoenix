from __future__ import annotations

from typing import Any

from pydantic_ai.tools import ToolDefinition

READ_PROMPT_TOOL_NAME = "read_prompt"

_READ_PROMPT_TOOL_DESCRIPTION = (
    "Read the current playground prompt for one instance. Use this before editing a "
    "playground prompt so you have stable message IDs and the latest revision token. "
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

READ_PROMPT_TOOL_DEFINITION = ToolDefinition(
    name=READ_PROMPT_TOOL_NAME,
    description=_READ_PROMPT_TOOL_DESCRIPTION,
    parameters_json_schema=_READ_PROMPT_TOOL_PARAMETERS,
    kind="external",
)
