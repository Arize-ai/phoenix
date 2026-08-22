from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "create_dataset_split"

DESCRIPTION = """\
Create a new split, optionally seeded with examples from the dataset the user is viewing. A split is a named slice of dataset examples (e.g. train/validation/test). To put existing examples into a split that already exists, use set_dataset_example_splits instead.
Pick a clear, unique name (deciding the name is a content question and is fine to ask about). Split names are unique instance-wide, so check existing splits with list_splits first; if one already exists, assign examples to it with set_dataset_example_splits rather than creating a duplicate. If creation fails because the name is already taken, choose a different name.
To seed the split with examples, pass their example ids (obtained from list_dataset_examples). A split with no examples will not show up under the dataset until examples are assigned to it.
`color` is optional (a hex value like #33c5e8); omit it for a default.
Propose the split by calling this tool directly. In manual approval mode the browser renders an inline accept/reject card and creates the split only when the user accepts; in bypass mode it is created immediately. The card is the approval surface — do not ask a separate yes/no question (or call ask_user) to confirm before calling it."""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "minLength": 1,
            "description": "A unique name for the new split.",
        },
        "description": {
            "type": ["string", "null"],
            "description": "An optional description of the split.",
        },
        "color": {
            "type": ["string", "null"],
            "description": (
                "An optional hex color for the split (e.g. #33c5e8). Omit for a default."
            ),
        },
        "exampleIds": {
            "type": "array",
            "items": {"type": "string", "minLength": 1},
            "description": (
                "Optional example ids (from list_dataset_examples) to put in the new split. "
                "Omit to create an empty split."
            ),
        },
    },
    "required": ["name"],
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
class CreateDatasetSplitCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
