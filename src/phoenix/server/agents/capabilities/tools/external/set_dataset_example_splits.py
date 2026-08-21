from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_dataset_example_splits"

DESCRIPTION = """\
Assign examples of the dataset the user is viewing to one or more existing splits, by split name. This SETS each example's splits to exactly the named splits — it replaces whatever splits those examples were in. If the user wants to keep an example in its current splits too, include those split names as well.
Get the example ids from list_dataset_examples and valid split names from list_splits (the instance-wide vocabulary — you can assign examples to any existing split, not only ones already on this dataset). Do not guess ids or names. `splitNames` must name splits that already exist; to create a new split, use create_dataset_split first.
Propose the assignment by calling this tool directly. In manual approval mode the browser renders an inline accept/reject card and applies it only when the user accepts; in bypass mode it is applied immediately. The card is the approval surface — do not ask a separate yes/no question (or call ask_user) to confirm before calling it."""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "exampleIds": {
            "type": "array",
            "minItems": 1,
            "items": {"type": "string", "minLength": 1},
            "description": "The ids of the examples to assign (from list_dataset_examples).",
        },
        "splitNames": {
            "type": "array",
            "minItems": 1,
            "items": {"type": "string", "minLength": 1},
            "description": (
                "The names of the existing splits to set the examples to (from list_dataset_splits). "
                "Each example's split membership is replaced with exactly these splits."
            ),
        },
    },
    "required": ["exampleIds", "splitNames"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetDatasetExampleSplitsCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
