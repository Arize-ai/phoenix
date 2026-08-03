from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset
from typing_extensions import override

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "read_prompt_tools"

DESCRIPTION = """\
Read the function/tool definitions attached to one playground prompt instance. Returns the list of \
tools (id, name, description, parameters JSON Schema, strict flag) and a `revision` token. Call \
this before `write_prompt_tools` — you need the latest `revision` to pass as `expectedRevision` \
and the existing tool `id`s to do an update — and whenever the user asks what tools the prompt \
currently exposes or wants to add to / refine the existing list.
The returned `revision` is opaque. Pass it back unchanged as `expectedRevision`; if the tool list \
changes between read and write, the write is rejected, so re-read and retry.
Each tool entry includes a `kind`: `function` tools are editable via `write_prompt_tools`; `raw` \
tools are vendor passthrough blobs (provider builtins like `web_search`) that cannot be authored \
from PXI — the user manages them directly in the playground tool editor.
If there is exactly one playground instance, `instanceId` may be omitted. Otherwise pass the \
specific numeric `instanceId`; use the alphabetic `label` (A, B, C, D) only when talking to the \
user.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "instanceId": {
            "type": "integer",
            "description": (
                "The playground instance ID to read. Omit only when there is exactly one "
                "playground instance."
            ),
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
class ReadPromptToolsCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    @override
    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
