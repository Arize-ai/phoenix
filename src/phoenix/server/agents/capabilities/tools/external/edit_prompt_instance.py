from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "edit_prompt_instance"

MESSAGE_ROLE_ENUM = ["system", "user", "ai", "tool"]

DESCRIPTION = """\
Propose edits to one playground prompt instance. This tool does not change the prompt immediately: the browser renders an inline diff and the user must accept or reject it.
Always call `read_prompt_instance` first, then pass its `revision` as `expectedRevision`. Edits are rejected if the prompt changed since that read; re-read and retry. Use the alphabetic label from `read_prompt_instance` (A, B, C, D) when telling the user which instance is being edited, but pass the numeric `instanceId` when calling this tool. If the user wants to compare a variant against the original, call `clone_prompt_instance` first and edit the clone.
Use message IDs from `read_prompt_instance` for updates, deletes, insertion anchors, and reorders. `operations` must always be an array, even for one edit, and they apply in order. Use camelCase field names exactly as shown. Common valid examples:
- {"type":"update_message","messageId":1,"content":"new text"}
- {"type":"insert_message","afterMessageId":1,"role":"user","content":"new text"} — omit or null `afterMessageId` to insert at the beginning.
- {"type":"delete_message","messageId":1}
- {"type":"reorder_messages","messageIds":[1,2,3]} — pass the full desired order.
Required fields by operation: `update_message` requires `messageId` and at least one of `role`/`content`/`toolCalls`; `insert_message` requires `role` and optionally `afterMessageId`/`content`/`toolCalls`; `delete_message` requires `messageId`; `reorder_messages` requires `messageIds`.
Message content can reference template variables whose names resolve relative to the active template-variables path (default `input`); a name's first segment must be a key at that path — e.g. `question` under `input`, or `input.question` / `reference.answer` at the example root. To pull a field from a different root, the name and the path must agree; set the root with `set_template_variables_path`.
Keep edits small and focused so the user can read the diff. If the user asked for several conceptually distinct changes, group them by intent rather than dumping every operation at once. After proposing the edit, briefly summarize what the diff will show so the user knows what they are accepting or rejecting."""

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
    defer_loading=True,
)


@dataclass
class EditPromptInstanceCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
