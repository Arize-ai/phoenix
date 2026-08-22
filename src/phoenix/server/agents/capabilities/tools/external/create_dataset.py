from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "create_dataset"

DESCRIPTION = """\
Create a new dataset, optionally seeded with starting examples. Each starting example has an input object and optional output and metadata objects. To add examples to a dataset that already exists, use add_dataset_examples instead.
Pick a clear, unique name. If the user did not give one, propose a short descriptive name (deciding the name is a content question and is fine to ask about). Dataset names are unique: check existing names with list_datasets before creating, and if the call fails because the name is already taken, choose a different name rather than retrying the same one.
If the dataset is meant to run a specific prompt in the playground, first read that prompt's template variables and name each example's `input` keys to match them (a `customer_message` template variable needs an `input.customer_message` field), covering every variable. Fields that match no variable go unused, and variables with no matching field render empty — a run over a misaligned dataset finishes with empty output.
Pass example input (and output/metadata when present) as JSON objects, not strings. Omit output/metadata for an input-only example. Treat an output as a reference, not necessarily the correct answer.
Propose the new dataset by calling this tool directly. In manual approval mode the browser renders an inline accept/reject card and creates the dataset only when the user accepts; in bypass mode it is created immediately. The card is the approval surface — do not ask a separate yes/no question (or call ask_user) to confirm before calling it."""

_EXAMPLE_ITEM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "input": {
            "type": "object",
            "description": "The example's input object (the fields the app or prompt consumes).",
        },
        "output": {
            "type": "object",
            "description": (
                "Optional reference output. Omit for an input-only example. Treat this as a reference, "
                "not necessarily the correct answer."
            ),
        },
        "metadata": {"type": "object", "description": "Optional metadata object for the example."},
    },
    "required": ["input"],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "minLength": 1,
            "description": "A unique name for the new dataset.",
        },
        "description": {
            "type": ["string", "null"],
            "description": "An optional description of the dataset.",
        },
        "examples": {
            "type": "array",
            "description": "Optional starting examples to seed the dataset with.",
            "items": _EXAMPLE_ITEM,
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
class CreateDatasetCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Creating a dataset has no context to gate on, but the write is blocked
        # server-side for viewers, so don't advertise it to them.
        return not ctx.deps.is_viewer
