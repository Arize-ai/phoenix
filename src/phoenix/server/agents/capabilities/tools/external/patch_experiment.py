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

NAME = "patch_experiment"

DESCRIPTION = (
    "Edit an existing experiment's name, description, or metadata. Use this to record "
    "observations or notes on an experiment after reviewing its results, or to rename or "
    "redescribe it. Provide `experimentId` plus at least one field to change; omitted fields "
    "are left untouched. `metadata` replaces the experiment's metadata object as a whole, so "
    "read the current metadata first and resubmit the complete object when appending."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "experimentId": {
            "type": "string",
            "description": "The Phoenix GraphQL node ID of the experiment to edit.",
        },
        "name": {
            "type": "string",
            "minLength": 1,
            "description": "New experiment name. Omit to leave the name unchanged.",
        },
        "description": {
            "type": ["string", "null"],
            "description": (
                "New experiment description. Pass null to clear it; omit to leave it unchanged."
            ),
        },
        "metadata": {
            "type": "object",
            "additionalProperties": True,
            "description": (
                "Complete replacement metadata object. There is no deep merge: read the "
                "current metadata, preserve unrelated keys, and submit the full object. Omit "
                "to leave metadata unchanged."
            ),
        },
    },
    "required": ["experimentId"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class PatchExperimentCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return (
            ctx.deps.contexts.dataset is not None or ctx.deps.contexts.playground is not None
        ) and not ctx.deps.is_viewer
