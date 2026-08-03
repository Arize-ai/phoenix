from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "cancel_playground_run"

DESCRIPTION = """\
Cancel the currently active run in the mounted playground. This stops the same run the user would \
stop with the playground Stop button and clears the active run state for all currently visible \
comparison instances.
This tool has no arguments; the browser decides what to cancel from the current playground UI \
state.
Do not call it when no playground run is active — tell the user there is no active run to cancel.
After cancellation, call `run_playground` again only if the user asks to rerun.\
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
class CancelPlaygroundRunCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
