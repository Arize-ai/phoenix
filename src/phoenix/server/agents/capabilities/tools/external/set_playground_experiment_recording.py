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
    "unrecorded runs, and optionally stage a name, description, and metadata for the "
    "experiments the next run produces. Use this before running when the user asks to "
    "record, persist, save the run as an experiment, run without recording, or label "
    "the next experiment with notes such as a hypothesis."
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
        "experimentName": {
            "type": "string",
            "description": (
                "Optional name for the experiments the next dataset-backed run "
                "produces. Omit to use the default generated name."
            ),
        },
        "experimentDescription": {
            "type": "string",
            "description": (
                "Optional description for the experiments the next dataset-backed run "
                "produces. Omit to leave the description empty."
            ),
        },
        "experimentMetadata": {
            "type": "object",
            "description": (
                "Optional metadata object stored on the experiments the next "
                "dataset-backed run produces (for example a hypothesis or the variable "
                "being changed). Omit to leave metadata empty."
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
