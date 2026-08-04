from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "list_dataset_splits"

DESCRIPTION = """\
List the splits the dataset the user is currently viewing is using (splits with at least one of \
this dataset's rows), returning each split's id, name, description, and color. Read-only. A split \
is a named slice of dataset examples (e.g. train/validation/test). Prefer this over hand-writing \
GraphQL.
Call this before list_dataset_examples with a split filter, to learn the split names this dataset \
actually uses.
A dataset only "has" a split once some of its rows belong to it, so a brand-new empty split will \
not appear here. Splits are global: to see every split that exists in the instance (e.g. to assign \
rows to one not yet on this dataset), use list_splits.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class ListDatasetSplitsCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.dataset is not None
