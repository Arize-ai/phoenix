from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

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

DESCRIPTION = """\
Run a JavaScript script in a sandboxed worker in the user's browser to read and change Phoenix UI state through the `ui` operation catalog. This is the single entry point for UI-state work: reading and editing playground prompts, setting models and filters, loading datasets, running the playground, and editing evaluator drafts. Scripts can await multiple operations, branch on results, and loop.
Follow the search-then-execute loop: discover operations with `search_ui` first, then call them via the `ui` object using the exact names and input shapes the catalog documented. Never invent an operation name.
Every operation call is async and resolves to a `UiResult`: `{ok: true, output?}` on success or `{ok: false, error}` on failure. Check `ok` before using `output`, and stop or adapt when a call fails instead of blindly continuing. Call `log(message)` to emit progress the user can see while a longer script runs. The script's return value becomes the tool output — `return` the data you need for your next step (for example, a read operation's `output`).
Operations of kind `approval` stage a change the user must accept or reject in the UI; the awaited promise resolves with the user's decision. Treat a rejection as an answer, not an error — do not retry the same change. Prefer several small scripts over one large script so approvals and errors stay legible; keep at most one approval-staging operation per script when practical.
Error recovery: an unknown-operation error includes suggested near-miss names — call `search_ui` to confirm before retrying. An operation that is unavailable on the user's current page fails with a route hint describing where it becomes available; navigate or ask the user rather than retrying in place.
Example, split across small scripts (operation names are illustrative — always take the real names and input shapes from `search_ui` results):
1. `return await ui.playground.model.set({target: {type: 'builtin', provider: 'OPENAI', modelName: 'gpt-5'}});` — check `ok` on the result.
2. `const run = await ui.playground.run({}); if (!run.ok) return run; log('run finished'); return await ui.playground.run.readOutput({});`"""

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class ExecuteUiCapability(AbstractCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])
