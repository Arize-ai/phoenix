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

NAME = "set_variable_values"

DESCRIPTION = (
    "Set manual input values for template variables in the currently mounted "
    "playground. Use this when the user asks to fill, provide, change, or set "
    "playground variables before running or comparing prompts. This only updates "
    "variable values in browser UI state; it does not edit prompt messages, change "
    "dataset mappings, or run the playground."
)

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
class SetVariableValuesCapability(AbstractDynamicCapability[AgentDependencies]):
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
