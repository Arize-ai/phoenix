from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "patch_dataset"

DESCRIPTION = """\
Edit the dataset the user is viewing — its name, description, and/or metadata. Only the fields you \
pass are changed; omitted fields are left as they are. Does not change the dataset's rows. Dataset \
names are unique; if the new name is taken the call fails and you should pick a different name.
Propose the edit by calling this tool directly. In manual approval mode the browser renders an \
inline accept/reject card and applies it only when the user accepts; in bypass mode it is applied \
immediately. The card is the approval surface — do not ask a separate yes/no question (or call \
ask_user) to confirm before calling it.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "minLength": 1,
            "description": "A new unique name for the dataset.",
        },
        "description": {
            "type": ["string", "null"],
            "description": "A new description for the dataset.",
        },
        "metadata": {
            "type": "object",
            "description": "New metadata for the dataset (replaces the existing metadata).",
        },
    },
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class PatchDatasetCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
