from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "update_annotation_config"

DESCRIPTION = """\
Update an existing annotation config. Use this to extend a config that is close but missing a label (or bound), or to revise its scheme, rather than growing a second differently-named rubric for the same thing. To create a brand-new config, use create_annotation_config instead.
Read the current config first (see the annotate-spans skill) so you have its id and its existing scheme, and pass the config's GraphQL node id as `id`.
This is a FULL REPLACE, not a patch. Pass the complete config as it should be afterward: keep the same `name`, the same `type`, and include every value you want to keep plus any new ones. Omitting an existing value deletes it.
Keep the `name` stable so existing annotations stay attached to the same dimension.
Propose the change by calling this tool directly. In manual approval mode the browser renders an inline accept/reject card and writes only when the user accepts; in bypass mode it is written immediately. The card is the approval surface — do not ask a separate yes/no question (or call ask_user) to confirm before calling it.
Tell the user what you changed and why — changing a rubric is a decision they may want to weigh in on."""

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
class UpdateAnnotationConfigCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return not ctx.deps.is_viewer
