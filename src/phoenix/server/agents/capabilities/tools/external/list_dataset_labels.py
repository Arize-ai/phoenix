from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "list_dataset_labels"

DESCRIPTION = """\
List the labels applied to the dataset the user is viewing, returning each label's id, name, \
description, and color. Read-only. A label is a tag attached to datasets to organize and find \
them. Prefer this over hand-writing GraphQL.
Call this before set_dataset_labels to see what is already applied — that tool replaces the \
dataset's labels, so include the current ones you want to keep.
This shows only the labels on this dataset. To see every label that exists in the instance (e.g. \
to apply one that is not yet on this dataset), use list_labels.\
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
class ListDatasetLabelsCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.dataset is not None
