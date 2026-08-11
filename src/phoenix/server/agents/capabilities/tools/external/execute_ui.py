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
        # `summary` is deliberately listed before `script`: arguments stream in
        # schema order, so the user-facing preview renders before the script body.
        "summary": {
            "type": "string",
            "description": (
                "One short sentence, written for the user, describing what this "
                "script accomplishes (e.g. 'Set the playground model to gpt-5 and "
                "run it'). Shown as the tool call's preview while the script "
                "streams and runs. Provide it before `script`."
            ),
        },
        "script": {
            "type": "string",
            "description": (
                "JavaScript executed in a sandboxed worker in the user's browser. Call "
                "UI operations via the `ui` object using names discovered through "
                "search_ui, e.g. `return await ui.timeRange.set({timeRangeKey: '7d'});`. "
                "Every call returns a promise of {ok: true, output?} or "
                "{ok: false, error}, where `output` is structured data usable directly "
                "(e.g. `result.output.instanceId`) — never JSON text to parse. "
                "`log(message)` emits progress. The script's return value is "
                "JSON-serialized into the tool output."
            ),
        },
    },
    "required": ["summary", "script"],
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
