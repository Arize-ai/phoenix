from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.types import AgentDependencies

NAME = "execute_browser_action"

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
                "search_browser_actions, e.g. `return await ui.timeRange.set({timeRangeKey: '7d'});`. "
                "Every call returns a promise of {ok: true, output?} or "
                "{ok: false, error}, where `output` is structured data usable directly "
                "(e.g. `result.output.instanceId`) — never JSON text to parse. "
                "`log(message)` emits progress. The script's return value is "
                "JSON-serialized into the tool output; constrain it in the script "
                "(slice, project fields, count) as you would with grep/head/tail — "
                "oversized return values are truncated."
            ),
        },
    },
    "required": ["summary", "script"],
    "additionalProperties": False,
}

DESCRIPTION = """\
Run a JavaScript script in a sandboxed worker in the user's browser to read and change Phoenix UI state through the `ui` operation catalog. This is the single entry point for UI-state work: reading and editing playground prompts, setting models and filters, loading datasets, running the playground, and editing evaluator drafts. Scripts can await multiple operations, branch on results, and loop.
Provide `summary` first: one short user-facing sentence saying what the script accomplishes. It is shown to the user as the tool call's preview, so describe the outcome ("Set the playground model to gpt-5"), not the mechanics.
Follow the search-then-execute loop: discover operations with `search_browser_actions` first, then call them via the `ui` object using the exact names and input shapes the catalog documented. Never invent an operation name.
Every operation call is async and resolves to a `UIResult`: `{ok: true, output?}` on success or `{ok: false, error}` on failure. `output` is structured data — read fields off it directly (e.g. `result.output.revision`); never `JSON.parse` it. Check `ok` before using `output`, and stop or adapt when a call fails instead of blindly continuing. Call `log(message)` to emit progress the user can see while a longer script runs. The script's return value becomes the tool output — `return` the data you need for your next step (for example, a read operation's `output`). Constrain it in the script the way you would with grep/head/tail in bash: slice arrays, project only the fields you need, return counts instead of collections. Return values beyond a few thousand characters are truncated from the middle.
When embedding another language's source code as a string (e.g. Python for a code evaluator), prefer an ordinary quoted string with `\\n` escapes; inside a template literal, backticks in the embedded code must be escaped as `\\`` (a single backslash) — `\\\\`` ends the literal and the script fails to parse.
Operations of kind `approval` stage a change the user must accept or reject in the UI; the awaited promise resolves with the user's decision. Treat a rejection as an answer, not an error — do not retry the same change.
Batch every related operation into one script: one script per coherent unit of work, never one script per operation. Each `execute_browser_action` call costs a full model turn; another `await` inside the script is free. Read state, branch on it, loop over items, and apply all the changes in the same script — if you are about to issue several one-line scripts back to back, combine them.
Approvals batch too: awaiting an `approval` operation parks the script (without burning its time budget) until the user decides, so a script may stage an approval and keep working after the decision resolves. Split into a follow-up script only when what comes next depends on the decision or on an intermediate result in a way you cannot express as a branch in the script.
Error recovery: an unknown-operation error includes suggested near-miss names — call `search_browser_actions` to confirm before retrying. An operation that is unavailable on the user's current page fails with a route hint describing where it becomes available; navigate or ask the user rather than retrying in place.
Example — set a model, run the playground, and read the output in one script (one turn, not three):
```
const model = await ui.playground.model.set({target: {type: 'builtin', provider: 'OPENAI', modelName: 'gpt-5'}});
if (!model.ok) return model;
const run = await ui.playground.run({});
if (!run.ok) return run;
log('run finished');
return await ui.playground.run.readOutput({});
```
Operation names here are illustrative — always take the real names and input shapes from `search_browser_actions` results."""

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class ExecuteBrowserActionCapability(AbstractCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])
