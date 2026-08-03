from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "patch_dataset_split"

DESCRIPTION = """\
Edit an existing split of the dataset the user is viewing — its name, description, and/or color — \
identified by its current name. Only the fields you pass are changed. Pass description: null to \
clear the description; name and color cannot be cleared, only replaced with a new non-empty value. \
Does not change which rows are in the split (use set_dataset_example_splits for that).
Get the split's current name from list_splits (splits are global, so any existing split can be \
edited by name). Split names are unique instance-wide; a duplicate new name fails.
Propose the edit by calling this tool directly. In manual approval mode the browser renders an \
inline accept/reject card and applies it only when the user accepts; in bypass mode it is applied \
immediately. The card is the approval surface — do not ask a separate yes/no question (or call \
ask_user) to confirm before calling it.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "splitName": {
            "type": "string",
            "minLength": 1,
            "description": "The current name of the split to edit (from list_dataset_splits).",
        },
        "name": {
            "type": "string",
            "minLength": 1,
            "description": "A new unique name for the split.",
        },
        "description": {
            "type": ["string", "null"],
            "description": "A new description for the split, or null to clear it.",
        },
        "color": {
            "type": "string",
            "minLength": 1,
            "description": "A new hex color for the split (e.g. #33c5e8).",
        },
    },
    "required": ["splitName"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class PatchDatasetSplitCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
