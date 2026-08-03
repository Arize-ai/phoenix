from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "create_dataset_label"

DESCRIPTION = """\
Create a new dataset label and, by default, attach it to the dataset the user is viewing. A label \
is a tag used to organize and find datasets. To attach a label that already exists, use \
set_dataset_labels instead.
Check existing labels with list_labels first; if the label already exists, attach it with \
set_dataset_labels rather than creating a duplicate.
Pick a clear, unique name (deciding the name is a content question and is fine to ask about). \
Label names are unique across this Phoenix instance; if creation fails because the name is already \
taken, choose a different name.
`color` is optional (a hex value like #33c5e8); omit it for a default. Set `attachToDataset` to \
false to create the label without tagging the current dataset.
Propose the label by calling this tool directly. In manual approval mode the browser renders an \
inline accept/reject card and creates it only when the user accepts; in bypass mode it is created \
immediately. The card is the approval surface — do not ask a separate yes/no question (or call \
ask_user) to confirm before calling it.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "minLength": 1,
            "description": "A unique name for the new label.",
        },
        "description": {
            "type": ["string", "null"],
            "description": "An optional description of the label.",
        },
        "color": {
            "type": ["string", "null"],
            "description": (
                "An optional hex color for the label (e.g. #33c5e8). Omit for a default."
            ),
        },
        "attachToDataset": {
            "type": "boolean",
            "description": (
                "Whether to attach the new label to the dataset in view. Defaults to true."
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
)


@dataclass
class CreateDatasetLabelCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
