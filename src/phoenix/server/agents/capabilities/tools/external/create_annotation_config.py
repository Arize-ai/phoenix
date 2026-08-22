from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "create_annotation_config"

DESCRIPTION = """\
Create a new annotation config — the project's codified rubric for one dimension (a stable name, a type, and its allowed outcomes) — and, when a `projectId` is given, associate it with that project in the same approved action. Use this to codify a new annotation category before annotating against it. To change an existing config, use update_annotation_config instead.
Pull the project's existing configs first (see the annotate-spans skill) and reuse a config that already fits rather than creating a near-duplicate under a different name. Config names are global, so a same-named config may belong to another project with different semantics — only create for the project in context.
Choose `type`: `categorical` for label sets (requires a non-empty `values` array, each a `label` with an optional `score`), `continuous` for a bounded numeric scale (`lowerBound`/`upperBound`), or `freeform` for free text. Continuous and freeform configs ignore `values`.
Resolve the project's GraphQL node id (see the phoenix-graphql skill) and pass it as `projectId` so the config is associated with this project. Omit `projectId` only when no project is in scope.
Propose the config by calling this tool directly. In manual approval mode the browser renders an inline accept/reject card and writes only when the user accepts; in bypass mode it is written immediately. The card is the approval surface — do not ask a separate yes/no question (or call ask_user) to confirm before calling it.
Tell the user when you created a new config versus reused one, and why — naming a rubric is a decision they may want to weigh in on."""

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
    defer_loading=True,
)


@dataclass
class CreateAnnotationConfigCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return not ctx.deps.is_viewer
