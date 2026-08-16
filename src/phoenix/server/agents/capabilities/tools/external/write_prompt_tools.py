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

NAME = "write_prompt_tools"

DESCRIPTION = (
    "Create, update, and/or delete function/tool definitions on a playground prompt "
    "instance in a single atomic batch. "
    "Always call `read_prompt_tools` first and pass its `revision` as `expectedRevision`; "
    "the whole batch is rejected if the tool list changed since that read. "
    "Within each entry of `tools`, pass `id` to update an existing function tool (patch — "
    "only fields present in the entry change); omit `id` or pass null to create a new one "
    "(the runtime assigns the id). Each entry's `name` is always required. `parameters` is "
    "a JSON Schema object describing the function arguments. "
    "`deleteToolIds` is a list of tool ids to remove; unlike writes, deletes may target "
    "either function tools or vendor passthrough (raw) tools, since removing a tool needs "
    "no knowledge of its shape. Provide at least one of `tools` or `deleteToolIds`. "
    "The batch is all-or-nothing: if any entry references a missing id, a raw tool on the "
    "write path, or the same id in both `tools` and `deleteToolIds`, nothing is applied and "
    "the error explains which. Deleting the tool that is the forced tool choice succeeds: the "
    "tool choice is reset to auto (zero-or-more) and the result reports `resetToolChoiceFrom` "
    "with that tool's name — surface this to the user. "
    "Common valid examples: "
    'create two: {"instanceId":1,"expectedRevision":"prompt-tools-abc","tools":['
    '{"name":"get_weather","description":"Look up the current weather for a city",'
    '"parameters":{"type":"object","properties":{"city":{"type":"string"}},'
    '"required":["city"]}},'
    '{"name":"get_forecast","parameters":{"type":"object","properties":'
    '{"city":{"type":"string"},"days":{"type":"integer"}},"required":["city","days"]}}]}; '
    'create one and update another: {"instanceId":1,"expectedRevision":"prompt-tools-abc",'
    '"tools":[{"name":"get_time","parameters":{"type":"object","properties":'
    '{"timezone":{"type":"string"}},"required":["timezone"]}},'
    '{"id":3,"name":"get_weather","parameters":{"type":"object","properties":'
    '{"city":{"type":"string"},"units":{"type":"string","enum":["c","f"]}},'
    '"required":["city"]}}]}; '
    'delete one and add another in one batch: {"instanceId":1,'
    '"expectedRevision":"prompt-tools-abc","deleteToolIds":[3],'
    '"tools":[{"name":"get_forecast","parameters":{"type":"object","properties":'
    '{"city":{"type":"string"}},"required":["city"]}}]}; '
    'delete only: {"instanceId":1,"expectedRevision":"prompt-tools-abc","deleteToolIds":[3,4]}. '
    "This tool only writes function tools; it does not author vendor passthrough tools "
    '(those appear in `read_prompt_tools` with `kind: "raw"`), though it can delete them.'
)

TOOL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "A function tool to create or update. Omit `id` (or pass null) to create a new "
        "tool; pass an existing `id` from `read_prompt_tools` to update one."
    ),
    "properties": {
        "id": {
            "type": ["integer", "null"],
            "description": (
                "Existing function tool id from `read_prompt_tools`. Omit or null to create "
                "a new tool."
            ),
        },
        "name": {
            "type": "string",
            "description": "Function tool name. Required for both create and update.",
        },
        "description": {
            "type": ["string", "null"],
            "description": "Human-readable description of what the function does.",
        },
        "parameters": {
            "type": ["object", "null"],
            "description": (
                "JSON Schema object describing the function arguments. Typical shape: "
                '`{"type":"object","properties":{...},"required":[...]}`.'
            ),
            "additionalProperties": True,
        },
        "strict": {
            "type": ["boolean", "null"],
            "description": (
                "Provider strict-mode flag. Leave unset unless the user asks for it; "
                "some providers reject schemas with optional/loose fields when strict."
            ),
        },
    },
    "required": ["name"],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "instanceId": {
            "type": "integer",
            "description": "The playground instance ID whose tools list will be updated.",
        },
        "expectedRevision": {
            "type": "string",
            "description": ("The exact revision returned by the latest `read_prompt_tools` call."),
        },
        "tools": {
            "type": "array",
            "items": TOOL_SCHEMA,
            "description": (
                "Function tools to create or update, applied atomically in the order given. "
                "Each entry shares the single `expectedRevision` check. Provide at least one "
                "of `tools` or `deleteToolIds`."
            ),
        },
        "deleteToolIds": {
            "type": "array",
            "items": {"type": "integer"},
            "description": (
                "Ids of tools to delete (function or raw), from the latest `read_prompt_tools` "
                "snapshot. Applied atomically with any `tools` writes. Provide at least one of "
                "`tools` or `deleteToolIds`."
            ),
        },
    },
    "required": ["instanceId", "expectedRevision"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class WritePromptToolsCapability(AbstractDynamicCapability[AgentDependencies]):
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
