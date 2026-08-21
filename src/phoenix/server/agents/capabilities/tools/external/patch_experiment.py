from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "patch_experiment"

DESCRIPTION = """\
Edit an existing experiment's name, description, or metadata. Use this to record an observation, note, hypothesis, or finding on an experiment after reviewing its results, or to rename or redescribe it.
Pass the experiment's GraphQL node ID as `experimentId`; if you do not have it, discover it first with `bash` and `phoenix-gql` rather than guessing. Provide `experimentId` plus at least one field to change; omitted fields are left untouched, and `description: null` clears a description.
METADATA: `metadata` replaces the experiment's metadata object as a whole. There is no deep merge — any key you omit from the object you submit is dropped. Before editing metadata, read the experiment's current metadata with `phoenix-gql`, build the new object from it, preserve every unrelated key, and submit the complete object. Record post-hoc findings under an `observations` array: append a new entry {"at": "<ISO 8601 timestamp>", "by": "pxi", "note": "<your observation>"} to the existing `observations` (or start the array if absent), and keep all other metadata keys — such as `hypothesis`, `changed_variable`, or `baseline_experiment_id` — exactly as they were. Do not overwrite earlier observations.
Propose the edit by calling this tool directly. In manual approval mode the browser renders an inline accept/reject card showing the experiment's current name and a before/after diff, and the edit is not applied until the user accepts; approval is skipped only when edit_permission is bypass. The card is the approval surface — do not ask the user a separate yes/no question (or call ask_user) to confirm before calling it.
Do not claim the experiment was updated until this tool returns an applied result; report the result the tool gives you rather than self-confirming. If the tool reports that the experiment changed after the edit was proposed, re-read the experiment and propose the edit again against its current state."""

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
class PatchExperimentCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return (
            ctx.deps.contexts.dataset is not None or ctx.deps.contexts.playground is not None
        ) and not ctx.deps.is_viewer
