from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_dataset_labels"

DESCRIPTION = """\
Set the labels on the dataset the user is viewing, by label name. This SETS the dataset's labels \
to exactly the named labels — it replaces whatever labels were on it. To keep the dataset's \
current labels and add another, first read what is applied with list_dataset_labels and include \
those names as well. This tool cannot pass an empty list, so it cannot remove all labels — say so \
to the user.
Get valid label names from list_labels (the instance-wide vocabulary). Do not guess names. \
`labelNames` must name labels that already exist; to create a new label, use create_dataset_label \
first.
Propose the change by calling this tool directly. In manual approval mode the browser renders an \
inline accept/reject card and applies it only when the user accepts; in bypass mode it is applied \
immediately. The card is the approval surface — do not ask a separate yes/no question (or call \
ask_user) to confirm before calling it.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "labelNames": {
            "type": "array",
            "minItems": 1,
            "items": {"type": "string", "minLength": 1},
            "description": (
                "The names of the existing labels to set on the dataset (from "
                "list_dataset_labels). The dataset's labels are replaced with exactly these."
            ),
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
)


@dataclass
class SetDatasetLabelsCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
