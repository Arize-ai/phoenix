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

NAME = "edit_annotation_config_draft"

ANNOTATION_TYPE_ENUM = ["CATEGORICAL", "CONTINUOUS", "FREEFORM"]
OPTIMIZATION_DIRECTION_ENUM = ["MAXIMIZE", "MINIMIZE", "NONE"]

DESCRIPTION = (
    "Edit the open annotation-config draft. The edit applies to the form "
    "immediately; the user still creates or updates the config with the form's "
    "own Create/Update action. Call `read_annotation_config_draft` first to see "
    "the current draft. Use camelCase field names exactly as shown. Common valid "
    "examples: "
    '{"type":"set_name","name":"correctness"}; '
    '{"type":"set_annotation_type","annotationType":"CATEGORICAL"}; '
    '{"type":"set_optimization_direction","optimizationDirection":"MAXIMIZE"}; '
    '{"type":"set_values","values":[{"label":"correct","score":1},'
    '{"label":"incorrect","score":0}]}; '
    '{"type":"set_lower_bound","lowerBound":0}; '
    '{"type":"set_upper_bound","upperBound":1}. '
    "`set_annotation_type` is rejected in `edit` mode (the type is immutable once "
    "a config exists). Use `set_values` for CATEGORICAL configs and "
    "`set_lower_bound`/`set_upper_bound` for CONTINUOUS configs."
)

OPERATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "One annotation-config draft edit operation. Required fields by type: "
        "set_name requires name; set_description requires description (may be "
        "null to clear); set_annotation_type requires annotationType (rejected "
        "in edit mode); set_optimization_direction requires optimizationDirection; "
        "set_lower_bound requires lowerBound; set_upper_bound requires upperBound; "
        "set_values requires values (whole-list replace of categorical values)."
    ),
    "properties": {
        "type": {
            "type": "string",
            "enum": [
                "set_name",
                "set_description",
                "set_annotation_type",
                "set_optimization_direction",
                "set_lower_bound",
                "set_upper_bound",
                "set_values",
            ],
            "description": "The operation kind.",
        },
        "name": {
            "type": "string",
            "description": "Replacement annotation name (e.g. `correctness`).",
        },
        "description": {
            "type": ["string", "null"],
            "description": "Replacement description; pass null to clear it.",
        },
        "annotationType": {
            "type": "string",
            "enum": ANNOTATION_TYPE_ENUM,
            "description": (
                "Annotation type. Only valid in `create` mode; rejected in `edit` "
                "mode since the type is immutable post-create."
            ),
        },
        "optimizationDirection": {
            "type": "string",
            "enum": OPTIMIZATION_DIRECTION_ENUM,
            "description": "Whether a higher score is better, worse, or neither.",
        },
        "lowerBound": {
            "type": ["number", "null"],
            "description": "Minimum score for a CONTINUOUS config.",
        },
        "upperBound": {
            "type": ["number", "null"],
            "description": "Maximum score for a CONTINUOUS config.",
        },
        "values": {
            "type": "array",
            "description": (
                "Whole-list replacement of the CATEGORICAL config's categories. "
                "Each entry has a label and an optional numeric score."
            ),
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
    },
    "required": ["type"],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "operations": {
            "type": "array",
            "description": "Ordered edit operations to apply to the draft.",
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
class EditAnnotationConfigDraftCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.annotation_config is not None and not ctx.deps.is_viewer
