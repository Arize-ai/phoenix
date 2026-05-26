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

NAME = "create_code_evaluator"

LANGUAGE_ENUM = ["PYTHON", "TYPESCRIPT"]

IDENTIFIER_PATTERN = r"^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$"

DESCRIPTION = (
    "Create a standalone code evaluator persisted via the `createCodeEvaluator` "
    "GraphQL mutation. Use this when the user wants to author a new code "
    "evaluator outside of an open code-evaluator form. The authored `source_code` "
    "must define a function named `evaluate` whose parameters are drawn from "
    "{output, reference, input, metadata}; Python uses positional parameters and "
    "TypeScript uses a single destructured object. `input_mapping` is always "
    "sent (default `{literalMapping:{}, pathMapping:{}}`). The server validates "
    "the `evaluate()` signature and the `name` identifier and surfaces failures "
    "as `BadRequest`; relay those messages back to the user verbatim."
)

INPUT_MAPPING_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "Per-parameter input wiring for `evaluate`. `pathMapping` resolves "
        "field-path lookups against upstream data; `literalMapping` passes "
        "literal scalar values. Defaults to empty mappings."
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
}

OUTPUT_CONFIG_DRAFT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "One output config the evaluator produces. Discriminated by `kind`: "
        "`classification` uses `values`; `continuous` uses `lowerBound`/`upperBound`; "
        "`freeform` uses `threshold` and optional bounds. The evaluator's "
        "`name` is used as the annotation surface name unless overridden."
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

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "pattern": IDENTIFIER_PATTERN,
            "description": (
                "Lowercase identifier matching "
                "`^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$`. Hyphens and underscores are "
                "allowed in the middle."
            ),
        },
        "source_code": {
            "type": "string",
            "description": (
                "Full source defining a function named `evaluate`. Parameters "
                "must be drawn from {output, reference, input, metadata}. "
                "Python uses positional parameters; TypeScript uses one "
                "destructured object."
            ),
        },
        "language": {
            "type": "string",
            "enum": LANGUAGE_ENUM,
            "description": "Evaluator runtime language.",
        },
        "description": {
            "type": "string",
            "description": "Optional human-readable evaluator description.",
        },
        "sandbox_config_id": {
            "type": "string",
            "description": (
                "Required Relay node ID of a sandbox configuration whose "
                "`language` matches `language`. Discover candidates via "
                "`query { sandboxProviders { configs { id name language } } }`; "
                "there is no top-level `sandboxConfigs` query. If no "
                "compatible sandbox config exists, tell the user to configure "
                "one at /settings/sandboxes instead of guessing an ID."
            ),
        },
        "input_mapping": {
            **INPUT_MAPPING_SCHEMA,
            "default": {"literalMapping": {}, "pathMapping": {}},
        },
        "output_configs": {
            "type": "array",
            "description": (
                "Optional list of output configs the evaluator produces. Each "
                "entry follows the kind-discriminated OutputConfigDraft shape. "
                "Omit when the user has not described the annotation surface."
            ),
            "items": OUTPUT_CONFIG_DRAFT_SCHEMA,
            "default": [],
        },
    },
    "required": ["name", "source_code", "language", "sandbox_config_id"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class CreateCodeEvaluatorCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return (
            ctx.deps.contexts.code_evaluator is None
            and not ctx.deps.is_viewer
            and ctx.deps.sandbox_availability.has_usable
        )
