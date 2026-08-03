from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "delete_dataset_splits"

DESCRIPTION = """\
Delete splits, identified by name. This removes each split entirely (across the instance); the \
dataset's rows themselves are not deleted, only their membership in these splits.
Get the split names from list_splits (or list_dataset_splits for the ones this dataset is using). \
Do not guess names.
Propose the deletion by calling this tool directly. In manual approval mode the browser renders an \
inline accept/reject card and deletes only when the user accepts; in bypass mode it is applied \
immediately. The card is the approval surface — do not ask a separate yes/no question (or call \
ask_user) to confirm before calling it.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "splitNames": {
            "type": "array",
            "minItems": 1,
            "items": {"type": "string", "minLength": 1},
            "description": "The names of the splits to delete (from list_dataset_splits).",
        },
    },
    "required": ["splitNames"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class DeleteDatasetSplitsCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
