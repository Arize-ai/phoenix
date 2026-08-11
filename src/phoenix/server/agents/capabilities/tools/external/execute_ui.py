from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "execute_ui"

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "script": {
            "type": "string",
            "description": (
                "JavaScript executed in a sandboxed worker in the user's browser. Call "
                "UI operations via the `ui` object using names discovered through "
                "search_ui, e.g. `return await ui.timeRange.set({timeRangeKey: '7d'});`. "
                "Every call returns a promise of {ok: true, output?} or "
                "{ok: false, error}. `log(message)` emits progress. The script's return "
                "value becomes the tool output."
            ),
        },
    },
    "required": ["script"],
    "additionalProperties": False,
}

DESCRIPTION = (
    "Run a JavaScript script against the browser UI operation catalog. Use this for all "
    "UI-state operations: reading and editing playground prompts, setting models and "
    "filters, loading datasets, running the playground, and editing evaluator drafts. "
    "Scripts can await multiple operations, branch on results, and loop. Operations of "
    "kind `approval` stage a change the user must accept — the awaited promise resolves "
    "with the user's decision. Prefer several small scripts over one large script so "
    "approvals and errors stay legible."
)

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class ExecuteUiCapability(AbstractStaticCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return self.instructions.render()
