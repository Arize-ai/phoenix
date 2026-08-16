from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_playground_model"

MODEL_PROVIDER_ENUM = [provider.value for provider in ModelProvider]

DESCRIPTION = (
    "Switch the selected model for one mounted playground instance. This tool "
    "applies immediately, like the playground model menu. If there is exactly "
    "one playground instance, `instanceId` may be omitted. If there are "
    "multiple comparison instances, pass the numeric `instanceId` from the "
    "playground context. Use `target.type = 'builtin'` for Phoenix built-in "
    "providers, and `target.type = 'custom'` for a configured custom provider."
)

BUILTIN_TARGET_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "type": {
            "type": "string",
            "enum": ["builtin"],
            "description": "Select a built-in Phoenix model provider.",
        },
        "provider": {
            "type": "string",
            "enum": MODEL_PROVIDER_ENUM,
            "description": "Built-in model provider key, e.g. OPENAI or ANTHROPIC.",
        },
        "modelName": {
            "type": "string",
            "description": "The model name to select for the built-in provider.",
        },
    },
    "required": ["type", "provider", "modelName"],
    "additionalProperties": False,
}

CUSTOM_TARGET_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "type": {
            "type": "string",
            "enum": ["custom"],
            "description": "Select a configured custom model provider.",
        },
        "customProviderId": {
            "type": "string",
            "description": "Custom provider ID from the playground context.",
        },
        "modelName": {
            "type": "string",
            "description": "The model name to select for the custom provider.",
        },
    },
    "required": ["type", "customProviderId", "modelName"],
    "additionalProperties": False,
}

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "instanceId": {
            "type": "integer",
            "description": (
                "The playground instance ID to update. Omit only when there is exactly one "
                "playground instance."
            ),
        },
        "target": {
            "oneOf": [BUILTIN_TARGET_SCHEMA, CUSTOM_TARGET_SCHEMA],
            "description": "The model target to select.",
        },
    },
    "required": ["target"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetPlaygroundModelCapability(AbstractDynamicCapability[AgentDependencies]):
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
