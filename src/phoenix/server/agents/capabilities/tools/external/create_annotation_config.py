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

NAME = "create_annotation_config"

DESCRIPTION = (
    "Create a new annotation config — the project's codified rubric for one dimension (a stable "
    "name, a type, and its allowed outcomes) — and, when a projectId is given, associate it with "
    "that project in the same approved action. Use this to codify a new annotation category before "
    "annotating against it. To change an existing config, use update_annotation_config instead."
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
        "type": {
            "type": "string",
            "enum": ["categorical", "continuous", "freeform"],
            "description": "The annotation config type.",
        },
        "name": {
            "type": "string",
            "minLength": 1,
            "description": (
                "Stable annotation name, e.g. 'tool_selection'. Reuse the same name across runs so "
                "annotations stay filterable and aggregatable."
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
                "Allowed labels for a categorical config. Required when type is 'categorical'."
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
        "projectId": {
            "type": ["string", "null"],
            "description": (
                "Phoenix GraphQL project node id to associate the new config with. Resolve it as "
                "described in the phoenix-graphql skill. Omit only when no project is in scope."
            ),
        },
    },
    "required": ["type", "name"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class CreateAnnotationConfigCapability(AbstractDynamicCapability[AgentDependencies]):
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
