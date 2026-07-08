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

NAME = "save_prompt"

DESCRIPTION = (
    "Save the active changes for one mounted playground prompt instance. "
    "Use this only when the user explicitly asks to save the current playground prompt, "
    "or after they explicitly accept that the current prompt should become a saved prompt "
    "version. In manual approval mode, the browser asks the user to approve before "
    "committing the save; approval is bypassed only when edit_permission is bypass. "
    "If the instance is already associated with a prompt, omit `name` and "
    "`promptId` to save a new version on that prompt. If the instance is not associated "
    "with a prompt and `name` is omitted, the browser derives a valid prompt name from "
    "the current prompt content and creates a new prompt. Pass `name` only when the user "
    "provided a desired prompt name or explicitly asked to save as a new prompt. Pass "
    "`promptId` only when saving a new version on a specific existing prompt. Always pass "
    "a clear, short, concise `description` that states the change or intention. Tags work "
    "like releases: pass tags only when the user explicitly asks to tag, release, or "
    "promote this version."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "instanceId": {
            "type": "integer",
            "description": (
                "The playground instance ID to save. Omit only when there is exactly one "
                "playground instance."
            ),
        },
        "promptId": {
            "type": "string",
            "description": (
                "Optional GraphQL Prompt node ID to receive a new version. Omit to use the "
                "prompt already associated with the instance."
            ),
        },
        "name": {
            "type": "string",
            "description": (
                "Prompt name for creating a new prompt/save-as. Omit for an unsaved instance "
                "when the user did not provide a name; Phoenix will derive one from the "
                "current prompt content."
            ),
        },
        "description": {
            "type": "string",
            "minLength": 1,
            "description": (
                "Required prompt description when creating a prompt, or change description "
                "when saving a version on an existing prompt. Write it like a short, clear "
                "git commit message that states the change or intention."
            ),
        },
        "tags": {
            "type": "array",
            "items": {"type": "string"},
            "description": (
                "Optional version tag names to apply to the saved version. Tags work like "
                "releases; pass them only when the user explicitly asks to tag, release, or "
                "promote this version. Pass an empty array when the mounted instance has a "
                "current tag but the user did not ask to move it."
            ),
        },
    },
    "required": ["description"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SavePromptCapability(AbstractDynamicCapability[AgentDependencies]):
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
