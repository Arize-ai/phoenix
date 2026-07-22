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

NAME = "update_annotation_config"

DESCRIPTION = (
    "Update an existing annotation config. This is a full replace: pass the complete config as it "
    "should be afterward (keep the same name and include every value you want to keep, plus any "
    "new ones), not just the changed fields. Use this to add a label to a config that is close but "
    "missing one. To create a brand-new config, use create_annotation_config instead."
)

_VALUE_ITEM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "label": {"type": "string", "description": "A categorical label, e.g. 'incorrect'."},
        "score": {
            "type": ["number", "null"],
            "description": "Optional numeric score paired with the label.",
        },
    },
    "required": ["label"],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "id": {
            "type": "string",
            "minLength": 1,
            "description": "Phoenix GraphQL node id of the annotation config to replace.",
        },
        "type": {
            "type": "string",
            "enum": ["categorical", "continuous", "freeform"],
            "description": "The annotation config type.",
        },
        "name": {
            "type": "string",
            "minLength": 1,
            "description": (
                "Annotation name. Keep it the same as the existing config to update in place."
            ),
        },
        "description": {
            "type": ["string", "null"],
            "description": "Optional description of what this dimension judges.",
        },
        "optimizationDirection": {
            "type": "string",
            "enum": ["MINIMIZE", "MAXIMIZE", "NONE"],
            "description": "Whether higher or lower is better. Defaults to 'NONE'.",
        },
        "values": {
            "type": "array",
            "description": (
                "The full set of allowed labels for a categorical config (existing plus any new "
                "ones). Required when type is 'categorical'."
            ),
            "items": _VALUE_ITEM,
        },
        "lowerBound": {
            "type": ["number", "null"],
            "description": "Lower bound for a continuous or freeform config.",
        },
        "upperBound": {
            "type": ["number", "null"],
            "description": "Upper bound for a continuous or freeform config.",
        },
        "threshold": {
            "type": ["number", "null"],
            "description": "Optional threshold for a freeform config.",
        },
    },
    "required": ["id", "type", "name"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class UpdateAnnotationConfigCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return not ctx.deps.is_viewer
