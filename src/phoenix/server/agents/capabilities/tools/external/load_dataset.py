from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "load_dataset"

DESCRIPTION = """\
Load a dataset into the currently mounted playground, optionally scoped to a single split, so the \
prompt runs over the dataset's examples. Use this when the user asks to load, open, switch to, run \
against, or run an experiment over a dataset (or one split of it) in the playground. This only \
switches the playground's dataset selection; it does not edit prompts, set variables, or run the \
playground.
Loading a dataset begins experiment work: if the `experiments` skill is not already loaded, \
`load_skill` it for the iteration methodology before designing the run.
If you are unsure the dataset or split exists, or which exact name to pass, discover it first with \
`bash` and `phoenix-gql` rather than guessing. Pass `datasetName` (and `splitName`) exactly as \
Phoenix reports them; the browser resolves names to IDs. When the user names a dataset directly \
and you are confident it exists, you may pass that name without a discovery query.
Propose the load by calling this tool directly. In manual approval mode the browser renders an \
inline accept/reject card and the user approves the change; approval is skipped only when \
edit_permission is bypass. The card is the approval surface — do not ask the user a separate \
yes/no question (or call ask_user) to confirm before calling it. Asking which split to scope to is \
a content question and is fine.
After the load is applied, call `run_playground` if the user wants to see results over the loaded \
dataset.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "datasetName": {
            "type": "string",
            "minLength": 1,
            "description": "The name of the dataset to load, exactly as it appears in Phoenix.",
        },
        "splitName": {
            "type": ["string", "null"],
            "description": (
                "The name of a single dataset split to scope the run to, exactly as it "
                "appears in Phoenix. Use null or omit to load the whole dataset."
            ),
        },
    },
    "required": ["datasetName"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class LoadDatasetCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
