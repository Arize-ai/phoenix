from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "add_spans_to_dataset"

DESCRIPTION = """\
Add the span the user is viewing (or specific spans by id) to a dataset, identified by dataset name. Each span becomes a new dataset example built from the span's input, output, and metadata. By default the span in view is added; pass `spanIds` to add other spans, such as ids you obtained from a spans query.
The dataset must already exist. Resolve it by name with list_datasets when you are unsure it exists or which one the user means; if it does not exist, create it with create_dataset first. If the name does not resolve to exactly one dataset the call fails — disambiguate or create rather than retrying.
Propose the addition by calling this tool directly. In manual approval mode the browser renders an inline accept/reject card and adds the span(s) only when the user accepts; in bypass mode it is applied immediately. The card is the approval surface — do not ask a separate yes/no question (or call ask_user) to confirm before calling it."""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "datasetName": {
            "type": "string",
            "minLength": 1,
            "description": (
                "The name of the existing dataset to add the span(s) to. Must resolve to exactly "
                "one dataset."
            ),
        },
        "spanIds": {
            "type": "array",
            "items": {"type": "string", "minLength": 1},
            "description": (
                "Optional span ids to add. Omit to add the span the user is currently viewing."
            ),
        },
    },
    "required": ["datasetName"],
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
class AddSpansToDatasetCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Needs a span in view to add; writes are blocked server-side for viewers.
        return ctx.deps.contexts.span is not None and not ctx.deps.is_viewer
