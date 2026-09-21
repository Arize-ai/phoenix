# PXI eval datasets

The YAML files under `datasets/` are the PXI next-action evals: each example seeds a
session with a primed transcript and scores the agent's next tool calls or reply with
the code evaluators under `evaluators/`. `evals/harbor/README.md`, "The PXI eval
datasets", explains how Harbor runs them. `dataset.py` validates a dataset file and
`transcripts.py` compiles the compact message notation to Phoenix UI messages.

Validate a dataset after editing it:

```bash
uv run python -c "from evals.harbor.pxi.dataset import load_dataset; load_dataset('<name>')"
```

Unit tests for the evaluators and the loader live under `tests/unit/harbor/pxi/`.

## Datasets

Datasets live in `evals/harbor/pxi/datasets/*.yaml`. Each file has:

- `dataset_name`
- optional `description`
- `evaluators`
- `examples`

Each example needs a stable `id`, exactly one split in a list-shaped `splits`
field, and whatever `input`, `expected`, and `metadata` shape its evaluators
consume. For the current tool-call evaluators, examples commonly use
`input.messages`, `expected.tools`, and expected tool arguments under
`expected.tool_call_args`. Behavior that lives behind the browser-action
surface is asserted with `expected.ui_operations` (required/forbidden
operation names, matched against `ui.<name>(...)` invocations inside observed
`execute_browser_action` scripts) and `expected.ui_operation_args` (the same
matcher vocabulary applied to the invocation's argument source).

Because `search_browser_actions` and `execute_browser_action` are external
tools, an agent run ends on the first one it emits. An example that scores
operation selection or arguments therefore primes the discovery step in
`input.messages` — an assistant `search_browser_actions` call plus a tool
return carrying a catalog excerpt rendered in the real
`renderUIOperationCatalog` format — so the agent resumes mid-loop holding the
catalog and the scored step is the `execute_browser_action` script it
composes next. Fresh-turn negatives stay unprimed.

Example IDs must be unique because the runner uses them for stable upserts.
Use `splits: [regression]` for a regression example.

Every dataset example must declare list-shaped `splits: [...]`, even when the
example belongs to only one split:

```yaml
examples:
  - id: llm-spans
    splits: [regression]
    input:
      messages:
        - role: user
          content: Show me only LLM spans.
```

Split meanings:

| Split | Size | Purpose |
| --- | --- | --- |
| `regression` | Small, 10-50 examples | Fast held-out regression gate; default for the harness. |
| `dev` | Larger, about 100+ examples | Manual experimentation, ablations, and failure analysis. |
| `val` | Small, 10-50 examples | Optimizer scoring signal. |
| `holdout` | Any size | Reserved as a held-out test set for final comparisons and tests of generalization. |

Each example belongs to exactly one split. The runner passes the YAML `splits`
list through to the Phoenix client upload payload.


## Inputs

New fixtures should use the public `PhoenixUIMessage` transcript returned by
`GET /v1/agent_sessions/{session_id}/messages`. This is a stored conversation
artifact. The chat POST now sends a new message or tool outputs into a server-owned
session, so a fixture is not a literal POST request body.

```yaml
input:
  messages:
    - id: user-1
      role: user
      parts:
        - type: text
          text: Keep the error filter, but only show root spans.
      metadata:
        phoenix:
          type: user
          currentDateTime: "2026-04-03T12:00:00-07:00"
          timeZone: America/Los_Angeles
          editPermission: manual
          uiContexts:
            project:
              type: project
              projectNodeId: UHJvamVjdDoxMg==
              spanFilter: "status_code == 'ERROR'"
```

Completed tool calls and their outputs live together in an assistant part:

```yaml
- id: assistant-1
  role: assistant
  parts:
    - type: tool-search_browser_actions
      toolCallId: search-1
      state: output-available
      input: {query: filter the spans table}
      output: "<the public browser operation catalog>"
```

The transcript must end with a user message or a completed tool output. Pending
calls and approvals are rejected. Use synthetic identifiers and results; do not
commit private production conversations. Keep each user turn's UI state and
browser clock in its metadata. The production adapter renders changed state at
the corresponding turn and preserves structured tool results.

Existing datasets may retain the compact `role/content/tool_calls` notation.
The fixture compiler pairs each tool return with its call, validates the result
as `PhoenixUIMessage`, then uses the same transcript adapter as production.
Tool `content` may be an object. In particular, `bash` returns `command`,
`stdout`, `stderr`, `exitCode`, timing, byte counts, and truncation flags. Raw
GraphQL JSON belongs inside `stdout`, not at the top level of the tool result.

For compact fixtures, `input.contexts` uses the public context union and describes
the active user turn. Omitted contexts mean no page context. There is no implicit
project. Do not combine top-level contexts with per-turn stored UI state.

Prefer assertions about public UI operation arguments, resulting filter
predicates, links, and artifacts. Avoid asserting a particular discovery order
unless that order is the behavior under test. A catalog excerpt still isolates a
single step; it does not exercise discovery against the full browser catalog.
These offline evals stop at deferred actions and cannot prove that a script ran,
a database query succeeded, or a UI mutation produced the intended state. Browser
E2E tests cover those outcomes. Script argument extraction and tool-call budgets
remain implementation-dependent checks and should be used sparingly.

`test_agent_task_inputs.py` validates every fixture through the current public
message models and production adapter. It also checks primed bash results against
the shipped result schema. That catches wire-format drift before spending tokens
on live evals.


## Matcher Vocabulary

The `tool_call_args_match` evaluator compares expected args to observed args
with subset semantics (extra observed keys are ignored). The same vocabulary
applies to `expected.ui_operation_args[<operation>]`, matched textually
against the JavaScript argument source of `ui.<operation>(...)` invocations
in observed `execute_browser_action` scripts (literals assert the key and
value appear in the source). Each expected value
is either a literal (compared by `==`) or a **matcher object** -- a dict
whose top-level keys are all in this vocabulary:

| Matcher | Meaning |
|---|---|
| `equals: <value>` | Explicit equality (same as a bare literal). |
| `contains_all: [<str>, ...]` | Observed must be a string containing every substring. Use this for clause-order-invariant DSL matching (`["span_kind == 'LLM'", "latency_ms >= 5000"]` matches either ordering). |
| `contains_any: [<str>, ...]` | Observed must be a string containing at least one substring. |
| `not_contains: [<str>, ...]` | Observed must be a string containing none of the substrings. |
| `any: true` | The key must be present in observed args; value is unconstrained. |
| `non_empty: true` | The key must be present and contain non-whitespace text. |
| `absent: true` | The key must not be present in observed args. |

To leave an arg entirely unconstrained, just omit it from `expected` --
subset matching ignores observed keys you don't mention. Use `any: true`
only when presence itself matters, and `non_empty: true` when required string
content matters. Use `absent: true` when omission itself is the behavior under
test.

For efficiency-focused examples, add `expected.budgets.max_tool_calls` and
enable the `tool_call_count_within_limit` evaluator. When a read-only example
must allow different setup paths, use `expected.budgets.max_repeated_tool_calls`
instead. A repeat has the same tool name and JSON arguments as an earlier call
in the scored output; object-key order and call IDs do not matter. Every call
after the first matching one counts toward the limit. Distinct skills and
corrected arguments are not repeats. Both limits apply if both are supplied.

Use a zero-repeat budget only when another identical request would add no new
information. It is not a replacement for latency or total-cost measurements,
and it does not detect unnecessary calls with different arguments. Bash-first examples can
use `bash_command_substrings_match` to check command intent without requiring
exact shell syntax.


## Evaluators

Code evaluators live in `evals/harbor/pxi/evaluators/` and use
`@create_evaluator(name=..., kind="code")` from `phoenix.evals`. Experiment
evaluators can bind `output`, `input`, `expected`, and `metadata`. Simple
`bool`, `int`, or `float` returns are converted into Phoenix scores, while dict
returns can include labels, explanations, and metadata for debugging.
