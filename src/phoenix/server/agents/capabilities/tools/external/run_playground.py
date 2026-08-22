from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "run_playground"

DESCRIPTION = """\
Run the currently mounted playground using the browser UI state. This starts the same run the user would start with the playground Run button, so it uses the current prompt instances, model settings, inputs, dataset selection, tools, and streaming preferences visible in the UI.
This tool has no arguments, and it runs all currently visible comparison instances together. If the user asks for only one instance, explain that the current UI action runs all visible instances.
If the user asks to record, persist, or not record a dataset-backed run, or to name, describe, or attach metadata to the next experiment, call `set_playground_experiment_recording` before this tool — but only when the current `recordExperiments` value and `nextExperimentScaffold` do not already match the request.
Do not call this while a playground run is already active; wait for the current run to finish or ask the user whether to stop it, and call `cancel_playground_run` if they want it stopped.
After the run finishes, call `read_playground_output` to inspect the raw output and retrieve traceId values."""

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
    defer_loading=True,
)


@dataclass
class RunPlaygroundCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
