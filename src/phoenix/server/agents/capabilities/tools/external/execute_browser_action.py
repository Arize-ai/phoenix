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
                "{ok: false, code?, error} — branch on the stable `code`, not the "
                "`error` prose. `output` is structured data usable directly "
                "(e.g. `result.output.instanceId`) — never JSON text to parse. "
                "`log(message)` emits progress. The script's return value is "
                "JSON-serialized into the tool output; constrain it in the script "
                "(slice, project fields, count) as you would with grep/head/tail — "
                "oversized return values are truncated."
            ),
        },
        "write_description": {
            "type": "string",
            "description": (
                "Provide if and only if the script calls any operation of kind `write` "
                "(shown in search_browser_actions results): a concise, user-facing "
                "description of the changes the script will make, starting with 'This "
                "script will ...'. This is the entire approval prompt the user reads "
                "before the script runs, so describe the actual changes, not your goal. "
                "Omitting it on a state-changing script does not skip approval — the "
                "state-changing operation is refused and you must re-issue the call "
                "with it."
            ),
        },
    },
    "required": ["summary", "script"],
    "additionalProperties": False,
}

DESCRIPTION = """\
Run a JavaScript script in a sandboxed worker in the user's browser to read and change Phoenix UI state through the `ui` operation catalog. This is the single entry point for UI-state work: reading and editing playground prompts, setting models and filters, loading datasets, running the playground, and editing evaluator drafts — and for dataset writes (`ui.dataset.*`): creating, editing, and deleting datasets, their rows, and adding spans to them. Scripts can await multiple operations, branch on results, and loop.
Provide `summary` first: one short user-facing sentence saying what the script accomplishes. It is shown to the user as the tool call's preview, so describe the outcome ("Set the playground model to gpt-5"), not the mechanics.
Follow the search-then-execute loop: discover operations with `search_browser_actions` first, then call them via the `ui` object using the exact names and input shapes the catalog documented. Never invent an operation name.
Every operation call is async and resolves to a `UIResult`: `{ok: true, output?}` on success or `{ok: false, code?, error}` on failure. `output` is structured data — read fields off it directly (e.g. `result.output.revision`); never `JSON.parse` it. Check `ok` before using `output`, and stop or adapt when a call fails instead of blindly continuing.
Branch on the failure `code`, never on the `error` prose: `STALE_REVISION` → retry with the current revision quoted in the message; `NOT_AVAILABLE` → stage a navigation or mounting step, then retry; `INVALID_INPUT` → fix the input against the catalog signature; `UNKNOWN_OPERATION` → check the did-you-mean suggestions. The `error` string is the human explanation and may be reworded at any time.
Feature-detect operations with `in` or `Object.keys` — `'prompt' in ui.playground`, `Object.keys(ui.playground)` — which answer truthfully from the catalog. Never use `typeof`: property access always returns a callable (so unknown-name calls can fail with did-you-mean suggestions), which makes `typeof ui.anything === 'function'` true for names that do not exist.
Call `log(message)` to emit progress the user can see while a longer script runs. The script's return value becomes the tool output — `return` the data you need for your next step (for example, a read operation's `output`). Constrain it in the script the way you would with grep/head/tail in bash: slice arrays, project only the fields you need, return counts instead of collections. Oversized return values are pruned structure-aware (object keys survive; long arrays keep leading items plus an omission marker) and the truncation note lists the pruned paths; the output's `Calls:` lines show each call's duration and output size, so the call that produced the bulk is identifiable without a probe.
When embedding another language's source code as a string (e.g. Python for a code evaluator), prefer an ordinary quoted string with `\\n` escapes; inside a template literal, backticks in the embedded code must be escaped as `\\`` (a single backslash) — `\\\\`` ends the literal and the script fails to parse.
Approval is script-level, not per-operation. Operations of kind `write` change state; a script that calls any of them must include `write_description`, and when the user requires manual approval they accept or reject the entire script before it runs. Treat a rejection as an answer, not an error — do not re-run the same script; ask what should change instead. The approval card is the confirmation surface: propose the change by writing the script, and do not ask a separate yes/no question (or call `ask_user`) first. A state-changing call from a script that omitted `write_description` fails with code `APPROVAL_REQUIRED` — re-issue the whole `execute_browser_action` call with a `write_description` covering all of the script's changes.
Dataset write operations (`ui.dataset.*`) that act on "the dataset the user is viewing" resolve their target from the page the user has open, never from an id you pass. If no dataset is in view they fail with an explanatory error — ask the user to open the dataset rather than retrying.
Batch every related operation into one script: one script per coherent unit of work, never one script per operation. Each `execute_browser_action` call costs a full model turn; another `await` inside the script is free. Read state, branch on it, loop over items, and apply all the changes in the same script — if you are about to issue several one-line scripts back to back, combine them.
Batching also batches approval: because the user approves the whole script once, one script with five writes costs one decision, while five single-write scripts cost five. Make `write_description` cover every change the script makes — an approved script's writes all execute without further prompts, so never smuggle in a change the description does not mention.
Error recovery: an unknown-operation error includes suggested near-miss names — call `search_browser_actions` to confirm before retrying. An operation that is unavailable on the user's current page fails with a route hint describing where it becomes available; call `ui.navigation.goTo({path, reason})` to take the user there (it resolves after the route change commits), then retry the operation. Navigation changes state, so the calling script needs a `write_description` that mentions the destination. If the user rejects a script that navigates, offer a markdown link instead — never re-run the navigation.
Example — set a model, run the playground, and read the output in one script (one turn, not three). Setting the model and running are state changes, so this script would carry e.g. `write_description`: "This script will set the playground model to gpt-5 and run the playground once."
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
