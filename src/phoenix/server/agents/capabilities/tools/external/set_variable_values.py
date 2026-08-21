from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_variable_values"

DESCRIPTION = """\
Set manual input values for template variables in the currently mounted playground. Use this when \
the user asks to fill, provide, set, update, or clear playground variable inputs, or provides \
concrete variable values before asking you to run, test, or compare a playground prompt.
Pass variable keys exactly as they appear in the prompt template, including dots or bracket \
notation if present.
Values are strings. Convert concise scalar user input to strings; do not invent missing values.
This only updates manual variable inputs in browser UI state; it does not edit prompt messages, \
change dataset variable mappings, or run the playground.
If the user wants to run after variables are set, call `run_playground` after this tool succeeds.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "values": {
            "type": "array",
            "description": (
                "Variable key/value pairs to store in the playground. Use the variable "
                "keys exactly as they appear in the prompt template."
            ),
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "minLength": 1,
                        "description": "The template variable key to set.",
                    },
                    "value": {
                        "type": "string",
                        "description": (
                            "The string value to store for the variable. Pass an empty "
                            "string to clear a variable value."
                        ),
                    },
                },
                "required": ["key", "value"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["values"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetVariableValuesCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
