from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_playground_experiment_recording"

DESCRIPTION = (
    "Set whether future dataset-backed playground runs in the currently mounted "
    "playground are recorded as persistent experiments or created as temporary "
    "unrecorded runs. Use this before running when the user asks to record, persist, "
    "save the run as an experiment, or explicitly run without recording."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "recordExperiments": {
            "type": "boolean",
            "description": (
                "True to persist future dataset-backed playground runs as experiments; "
                "false to make future dataset-backed runs temporary and unrecorded."
            ),
        },
    },
    "required": ["recordExperiments"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetPlaygroundExperimentRecordingCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
