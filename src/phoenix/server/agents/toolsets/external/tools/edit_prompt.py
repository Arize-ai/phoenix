from __future__ import annotations

from typing import Any

from pydantic_ai import RunContext

from phoenix.server.agents.dependencies import ChatDependencies
from phoenix.server.agents.toolsets.external.external_tool_definitions import (
    DynamicExternalToolDefinition,
)

_EDIT_PROMPT_TOOL_NAME = "edit_prompt_instance"

_MESSAGE_ROLE_ENUM = ["system", "user", "ai", "tool"]

_EDIT_PROMPT_TOOL_DESCRIPTION = (
    "Propose edits to one playground prompt instance. This tool does not change the "
    "prompt immediately: the browser renders an inline diff and the user must accept "
    "or reject it. Always call `read_prompt_instance` first, then pass its `revision` as "
    "`expectedRevision`. Edits are rejected if the prompt changed since that read. "
    "Use the alphabetic label from `read_prompt_instance` (A, B, C, D) when telling the user "
    "which instance is being edited, but pass the numeric `instanceId` when calling "
    "this tool. "
    "Use message IDs from `read_prompt_instance` for updates, deletes, insertion anchors, and "
    "reorders. `operations` must always be an array, even for one edit. Use camelCase "
    "field names exactly as shown. Common valid examples: "
    '{"type":"update_message","messageId":1,"content":"new text"}; '
    '{"type":"insert_message","afterMessageId":1,"role":"user",'
    '"content":"new text"}; '
    '{"type":"delete_message","messageId":1}; '
    '{"type":"reorder_messages","messageIds":[1,2,3]}.'
)

_EDIT_PROMPT_OPERATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "One prompt edit operation. Required fields by type: update_message requires "
        "messageId and at least one of role/content/toolCalls; insert_message requires "
        "role and optionally afterMessageId/content/toolCalls; delete_message requires "
        "messageId; reorder_messages requires messageIds."
    ),
    "properties": {
        "type": {
            "type": "string",
            "enum": ["update_message", "insert_message", "delete_message", "reorder_messages"],
            "description": "The operation kind.",
        },
        "messageId": {
            "type": "integer",
            "description": (
                "Message ID from read_prompt_instance. Required for update_message and "
                "delete_message."
            ),
        },
        "afterMessageId": {
            "type": ["integer", "null"],
            "description": (
                "For insert_message, insert after this message ID. Use null or omit to insert "
                "at the beginning."
            ),
        },
        "role": {
            "type": "string",
            "enum": _MESSAGE_ROLE_ENUM,
            "description": (
                "Message role. Required for insert_message; optional for update_message."
            ),
        },
        "content": {
            "type": "string",
            "description": "Message text content for insert_message or update_message.",
        },
        "toolCalls": {
            "type": "array",
            "items": {},
            "description": "Assistant tool call payloads for insert_message or update_message.",
        },
        "messageIds": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "The full desired message order. Required for reorder_messages.",
        },
    },
    "required": ["type"],
    "additionalProperties": False,
}

_EDIT_PROMPT_TOOL_PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "instanceId": {
            "type": "integer",
            "description": "The playground instance ID to edit.",
        },
        "expectedRevision": {
            "type": "string",
            "description": "The exact revision returned by the latest `read_prompt_instance` call.",
        },
        "operations": {
            "type": "array",
            "description": "Ordered edit operations to propose for this prompt.",
            "items": _EDIT_PROMPT_OPERATION_SCHEMA,
            "minItems": 1,
        },
    },
    "required": ["instanceId", "expectedRevision", "operations"],
    "additionalProperties": False,
}


def build_edit_prompt_tool(instructions: str) -> DynamicExternalToolDefinition:
    tool = DynamicExternalToolDefinition(
        name=_EDIT_PROMPT_TOOL_NAME,
        description=_EDIT_PROMPT_TOOL_DESCRIPTION,
        parameters_json_schema=_EDIT_PROMPT_TOOL_PARAMETERS,
        instructions=instructions,
    )

    @tool.include
    def _include(ctx: RunContext[ChatDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None

    return tool
