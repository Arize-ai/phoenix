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
    "accept or reject it. Call `read_code_evaluator_draft` first to see the "
    "current draft before proposing edits. "
    "Use camelCase field names exactly as shown. Common valid examples: "
    '{"type":"set_source_code","sourceCode":"def evaluate(output):\\n    return 1.0"}; '
    '{"type":"set_language","language":"PYTHON"}; '
    '{"type":"set_sandbox_config","sandboxConfigId":"U2FuZGJveENvbmZpZzox"}; '
    '{"type":"set_input_mapping","inputMapping":{"pathMapping":{},"literalMapping":{}}}; '
    '{"type":"set_test_payload","testPayload":{"input":{},'
    '"output":{"messages":[{"role":"assistant","content":"ok"}]},'
    '"reference":{},"metadata":{}}}. '
    "Do not emit `set_sandbox_config` when the read draft already has a compatible "
    "sandbox and the user did not ask to change it."
)

JSON_RECORD_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": "JSON object with arbitrary JSON-safe values.",
    "additionalProperties": True,
}

TEST_PAYLOAD_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "Replacement evaluator preview payload. The shape matches the form "
        "mapping source: input, output, reference, and metadata JSON objects."
    ),
    "properties": {
        "input": JSON_RECORD_SCHEMA,
        "output": JSON_RECORD_SCHEMA,
        "reference": JSON_RECORD_SCHEMA,
        "metadata": JSON_RECORD_SCHEMA,
    },
    "required": ["input", "output", "reference", "metadata"],
    "additionalProperties": False,
}

OUTPUT_CONFIG_DRAFT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "One output config the evaluator produces. Discriminated by `kind`: "
        "`classification` uses `values`; `continuous` uses `lowerBound`/`upperBound`; "
        "`freeform` uses `threshold` and optional bounds."
    ),
    "properties": {
        "kind": {
            "type": "string",
            "enum": ["classification", "continuous", "freeform"],
        },
        "name": {"type": "string"},
        "optimizationDirection": {
            "type": "string",
            "enum": ["MINIMIZE", "MAXIMIZE", "NONE"],
        },
        "values": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "score": {"type": ["number", "null"]},
                },
                "required": ["label"],
                "additionalProperties": False,
            },
        },
        "threshold": {"type": ["number", "null"]},
        "lowerBound": {"type": ["number", "null"]},
        "upperBound": {"type": ["number", "null"]},
    },
    "required": ["kind", "name", "optimizationDirection"],
    "additionalProperties": False,
}

OPERATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "One code-evaluator draft edit operation. Required fields by type: "
        "set_source_code requires sourceCode; set_language requires language "
        "(rejected in edit mode); set_sandbox_config requires sandboxConfigId "
        "(must be non-null in create mode; may be null only in edit mode to clear); "
        "set_input_mapping requires inputMapping; "
        "set_description requires description; set_name requires name; "
        "set_output_configs requires outputConfigs (whole-list replace); "
        "set_test_payload requires testPayload."
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
                "set_output_configs",
                "set_test_payload",
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
                "draft language. Create-mode drafts require a non-null value; "
                "pass null only in edit mode to clear the selection."
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
        "outputConfigs": {
            "type": "array",
            "description": (
                "Whole-list replacement of the evaluator's output configs. "
                "Each entry follows the kind-discriminated OutputConfigDraft."
            ),
            "items": OUTPUT_CONFIG_DRAFT_SCHEMA,
        },
        "testPayload": {
            **TEST_PAYLOAD_SCHEMA,
            "description": (
                "Replacement mapping source used by the evaluator preview/test section. "
                "For dataset-backed evaluators, shape `output` like a representative "
                "future experiment run output; relational evaluators can compare it "
                "to `reference`."
            ),
        },
    },
    "required": ["type"],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "operations": {
            "type": "array",
            "description": "Ordered edit operations to propose for the draft.",
            "items": OPERATION_SCHEMA,
            "minItems": 1,
        },
    },
    "required": ["operations"],
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
        code_evaluator = ctx.deps.contexts.code_evaluator
        if code_evaluator is None or ctx.deps.is_viewer:
            return False
        return (
            code_evaluator.evaluator_node_id is not None or ctx.deps.sandbox_availability.has_usable
        )
