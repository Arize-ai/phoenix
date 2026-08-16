from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset
from typing_extensions import override

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "read_prompt_tools"

DESCRIPTION = (
    "Read the function/tool definitions attached to one playground prompt instance. "
    "Returns the list of tools (id, name, description, parameters JSON Schema, strict flag) "
    "and a `revision` token. Always call this before `write_prompt_tools` and pass the "
    "returned `revision` back as `expectedRevision`; stale writes are rejected if the "
    "tool list changed in between. "
    "If there is exactly one playground instance, `instanceId` may be omitted. If there "
    "are multiple comparison instances, pass the specific `instanceId`. Vendor passthrough "
    'tools (e.g. provider builtins like `web_search`) are surfaced with `kind: "raw"` '
    "and an opaque `raw` blob; only function tools can be written via `write_prompt_tools`."
)

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
class ReadPromptToolsCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    @override
    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    @override
    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
