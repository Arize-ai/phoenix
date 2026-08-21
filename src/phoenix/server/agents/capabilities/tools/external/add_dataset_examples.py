from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset
from typing_extensions import override

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "add_dataset_examples"

DESCRIPTION = """\
Append one or more new examples to the dataset the user is currently viewing. Each example has an input object and optional output and metadata objects. This adds examples to the dataset in view; it does not create a new dataset (use create_dataset) or edit existing examples (use patch_dataset_examples).
Only a dataset that is in view can be appended to; if no dataset is open, ask the user to open one.
Match the shape of the existing examples: reuse the same field names and structure for `input`, `output`, and `metadata`. If you have not seen the dataset's examples, inspect one with list_dataset_examples first so the new examples are consistent.
Treat an `output` as a reference, not necessarily the correct answer. Only present it as the right answer if it genuinely is; otherwise tell the user it is a baseline.
If these examples will be run through a prompt in the playground, make sure the `input` keys match that prompt's template variables by name (a `customer_message` template variable needs an `input.customer_message` field) so every variable has a source field; otherwise the unmatched variables render empty.
Pass `input` (and `output`/`metadata` when present) as JSON objects, not strings. Omit `output`/`metadata` for an input-only example.
Propose the examples by calling this tool directly. In manual approval mode the browser renders an inline accept/reject card and applies the examples only when the user accepts; in bypass mode they are applied immediately. The card is the approval surface — do not ask the user a separate yes/no question (or call ask_user) to confirm before calling it."""

_EXAMPLE_ITEM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "input": {
            "type": "object",
            "description": (
                "The example's input object — the fields the app or prompt consumes. Match the "
                "field names and shape of the dataset's existing examples."
            ),
        },
        "output": {
            "type": "object",
            "description": (
                "Optional reference output. Omit for an input-only example. Treat this as a reference, "
                "not necessarily the correct answer."
            ),
        },
        "metadata": {
            "type": "object",
            "description": "Optional metadata object for the example.",
        },
    },
    "required": ["input"],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "examples": {
            "type": "array",
            "minItems": 1,
            "description": "The examples to append to the dataset in view.",
            "items": _EXAMPLE_ITEM,
        },
    },
    "required": ["examples"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class AddDatasetExamplesCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    @override
    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
