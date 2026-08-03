from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "save_prompt"

DESCRIPTION = """\
Save the active changes for one mounted playground prompt instance by creating a new prompt or a \
new prompt version. Use this only when the user explicitly asks to save, publish, persist, save \
as, or version the current playground prompt, or after they explicitly accept that the current \
prompt should become a saved prompt version. Do not call it just because you edited or ran a \
prompt.
In manual approval mode the browser asks the user to approve before committing the save; approval \
is bypassed only when edit_permission is bypass.
`description` is required. Treat saving like a git commit: pass a clear, short, concise \
`description` that states the change or intention.
If there is exactly one playground instance, `instanceId` may be omitted. With multiple comparison \
instances, pass the specific `instanceId`.
If the instance is already associated with a prompt, omit `name` and `promptId` to save a new \
version on that prompt. For a first-time save of an unsaved playground prompt, call `save_prompt` \
even if the user did not provide a name — omit `name` and the browser derives a valid prompt name \
from the current prompt content. Pass `name` only when the user provided a desired name or \
explicitly asked for a save-as/create-new-prompt flow, and `promptId` only when saving the \
instance to a specific existing prompt.
Tags work like releases: pass `tags` only when the user explicitly asks to tag, release, or \
promote this version. If the mounted instance has a current tag and the user did not ask to move \
it, pass `tags: []` so the save does not promote that tag.\
"""

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
class SavePromptCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
