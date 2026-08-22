from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "delete_dataset_labels"

DESCRIPTION = """\
Delete dataset labels, identified by name. This removes each label entirely (across the instance), detaching it from every dataset it was on; the datasets themselves are not deleted. To remove a label from this dataset without deleting the label itself, use set_dataset_labels instead.
Get the label names from list_labels (or list_dataset_labels for the ones on this dataset). Do not guess names.
Propose the deletion by calling this tool directly. In manual approval mode the browser renders an inline accept/reject card and deletes only when the user accepts; in bypass mode it is applied immediately. The card is the approval surface — do not ask a separate yes/no question (or call ask_user) to confirm before calling it."""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "labelNames": {
            "type": "array",
            "minItems": 1,
            "items": {"type": "string", "minLength": 1},
            "description": "The names of the labels to delete (from list_dataset_labels).",
        },
    },
    "required": ["labelNames"],
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
class DeleteDatasetLabelsCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
