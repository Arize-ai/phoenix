from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_appended_messages_path"

DESCRIPTION = """\
Set the dataset message-list path appended to playground runs for the currently mounted playground. Use this when the user asks to append, set, change, or clear the conversational message history used for message-based dataset re-runs, or wants playground runs to include a list of messages drawn from a dataset example.
The `path` is dot-notation resolved relative to a dataset example's `input` object, not the example as a whole. So if an example stores its messages at `input.messages`, use `messages` (not `input.messages`); only nest deeper (e.g. `payload.messages`) when the list lives under a sub-key of `input`.
Pass an empty string or null for `path` to disable appending.
This only updates browser UI state; it does not edit prompt messages or run the playground.
The setting applies to the loaded dataset. If no dataset is loaded, call `load_dataset` first."""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "path": {
            "type": ["string", "null"],
            "description": (
                "Dataset message-list path to append to playground runs. Pass an empty "
                "string or null to disable appending."
            ),
        },
    },
    "required": ["path"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetAppendedMessagesPathCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
