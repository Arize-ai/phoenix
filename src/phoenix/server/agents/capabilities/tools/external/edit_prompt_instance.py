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

NAME = "edit_prompt_instance"

MESSAGE_ROLE_ENUM = ["system", "user", "ai", "tool"]

DESCRIPTION = (
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

OPERATION_SCHEMA: dict[str, Any] = {
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
            "enum": MESSAGE_ROLE_ENUM,
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

PARAMETERS: dict[str, Any] = {
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
            "items": OPERATION_SCHEMA,
            "minItems": 1,
        },
    },
    "required": ["instanceId", "expectedRevision", "operations"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class EditPromptInstanceCapability(AbstractDynamicCapability[AgentDependencies]):
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
