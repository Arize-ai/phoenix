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

NAME = "set_template_variables_path"

DESCRIPTION = (
    "Set the dataset field path that playground template variables resolve against, "
    "when a prompt references dataset fields outside the default `input` root. This "
    "only updates browser UI state; it does not edit prompt messages or run the playground."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "path": {
            "type": ["string", "null"],
            "description": (
                "The dataset field path (e.g. `input`, `reference`, `metadata`) that "
                "template variables resolve against. Empty string or null means the whole "
                "example (the example root)."
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
class SetTemplateVariablesPathCapability(AbstractDynamicCapability[AgentDependencies]):
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
