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

NAME = "edit_code_evaluator_draft"

LANGUAGE_ENUM = ["PYTHON", "TYPESCRIPT"]

DESCRIPTION = (
    "Propose edits to the open code-evaluator draft. This tool does not change "
    "the form immediately: the browser renders an inline diff and the user must "
    "accept or reject it. Always call `read_code_evaluator_draft` first, then "
    "pass its `revision` as `expectedRevision`. Edits are rejected if the draft "
    "changed since that read. "
    "Use camelCase field names exactly as shown. Common valid examples: "
    '{"type":"set_source_code","sourceCode":"def evaluate(output):\\n    return 1.0"}; '
    '{"type":"set_language","language":"PYTHON"}; '
    '{"type":"set_sandbox_config","sandboxConfigId":"U2FuZGJveENvbmZpZzox"}; '
    '{"type":"set_input_mapping","inputMapping":{"pathMapping":{},"literalMapping":{}}}.'
)

OPERATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "One code-evaluator draft edit operation. Required fields by type: "
        "set_source_code requires sourceCode; set_language requires language "
        "(rejected in edit mode); set_sandbox_config requires sandboxConfigId "
        "(may be null to clear); set_input_mapping requires inputMapping; "
        "set_description requires description; set_name requires name."
    ),
    "properties": {
        "type": {
            "type": "string",
            "enum": [
                "set_source_code",
                "set_language",
                "set_sandbox_config",
                "set_input_mapping",
                "set_description",
                "set_name",
            ],
            "description": "The operation kind.",
        },
        "sourceCode": {
            "type": "string",
            "description": (
                "Full replacement source for the evaluator. Must still define a "
                "function named `evaluate` whose parameters are a subset of "
                "{input, output, reference, metadata}."
            ),
        },
        "language": {
            "type": "string",
            "enum": LANGUAGE_ENUM,
            "description": (
                "Evaluator language. Only valid in `create` mode; rejected in "
                "`edit` mode since language is immutable post-create."
            ),
        },
        "sandboxConfigId": {
            "type": ["string", "null"],
            "description": (
                "Relay node ID of the sandbox configuration. Must match the "
                "draft language. Pass null to clear the selection."
            ),
        },
        "inputMapping": {
            "type": "object",
            "description": (
                "Replacement input mapping. The form treats `pathMapping` as "
                "field-path lookups and `literalMapping` as literal values "
                "passed to the evaluator's parameters."
            ),
            "properties": {
                "pathMapping": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                },
                "literalMapping": {
                    "type": "object",
                    "additionalProperties": True,
                },
            },
            "additionalProperties": False,
        },
        "description": {
            "type": "string",
            "description": "Replacement evaluator description.",
        },
        "name": {
            "type": "string",
            "description": "Replacement user-facing evaluator name.",
        },
    },
    "required": ["type"],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "expectedRevision": {
            "type": "string",
            "description": (
                "The exact revision returned by the latest `read_code_evaluator_draft` call."
            ),
        },
        "operations": {
            "type": "array",
            "description": "Ordered edit operations to propose for the draft.",
            "items": OPERATION_SCHEMA,
            "minItems": 1,
        },
    },
    "required": ["expectedRevision", "operations"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class EditCodeEvaluatorDraftCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.code_evaluator is not None
