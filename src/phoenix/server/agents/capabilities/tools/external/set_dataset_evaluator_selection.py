from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_dataset_evaluator_selection"

DESCRIPTION = """\
Set which existing dataset evaluators are applied to the mounted playground so they run in the next experiment. Use this when the user asks to choose, add, remove, or clear which existing evaluators score the dataset.
Pass `datasetEvaluatorIds` as the complete desired set of ids from the playground roster (`existing_dataset_evaluators`); it replaces the current selection wholesale, so include every evaluator that should stay applied. To add to or remove from the current set, compute the new full set from the roster's `applied` flags rather than passing only the delta.
This tool only toggles which evaluators run. It does not create, edit, or delete evaluators; to change an evaluator's configuration use `open_dataset_evaluator_for_edit`."""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "datasetEvaluatorIds": {
            "type": "array",
            "description": (
                "Complete desired set of dataset evaluator ids to apply, taken "
                "from the playground roster. Pass an empty array to clear the "
                "selection so no evaluators run."
            ),
            "items": {"type": "string", "minLength": 1},
        },
    },
    "required": ["datasetEvaluatorIds"],
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
class SetDatasetEvaluatorSelectionCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Empty roster is intentionally gated out: the applied set is already filtered to
        # roster membership at run time (PlaygroundDatasetSection), so empty-array "clear"
        # is moot here.
        playground = ctx.deps.contexts.playground
        return (
            playground is not None
            and ctx.deps.contexts.dataset is not None
            and bool(playground.evaluators)
            and not ctx.deps.is_viewer
        )
