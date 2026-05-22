# PXI Evals

This tree is the canonical home for PXI-specific eval work. The harness runs
live-model PXI server-side evals as Phoenix experiments.

## Layout

- `harness/` runs live PXI agent experiments against Phoenix datasets.
- `datasets/` stores YAML datasets shared by harness and CI workflows.
- `evaluators/` stores code evaluators for PXI tool behavior.
- `trace_ingest/` is reserved for future trace-to-dataset tooling.

Fast unit coverage for the harness and evaluators lives under
`tests/unit/pxi/evals/`.

## Run Locally

The canonical entrypoint is `evals/pxi/harness/run_experiment.py`. Start
Phoenix, then run:

```bash
uv run python evals/pxi/harness/run_experiment.py --dataset set_spans_filter
```

For the in-app link suite:

```bash
uv run python -m evals.pxi.harness.run_experiment --dataset in_app_links
```

The default invocation runs the `regression` split. Use `--splits` for manual
experimentation:

```bash
uv run python -m evals.pxi.harness.run_experiment --dataset set_spans_filter --splits dev val
```

`--fail-on-regression` exits nonzero only when an evaluator fails on a
`regression` example. The runner prints a stdout summary and the Phoenix
experiment URL.

The runner checks `/healthz` against whichever Phoenix URL is configured
(default `http://localhost:6006`, or `PHOENIX_COLLECTOR_ENDPOINT` /
`OTEL_EXPORTER_OTLP_ENDPOINT` if set) before uploading anything. To use a
shared Phoenix endpoint:

```bash
export PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix.example.com
export PHOENIX_API_KEY=...
uv run python evals/pxi/harness/run_experiment.py --dataset set_spans_filter
```

Task errors (exception type plus a truncated message, no stack traces) are
uploaded to Phoenix as part of the experiment task output. Avoid pasting
credentials into request URLs while debugging against a shared Phoenix.

The task output stores the serialized Pydantic AI messages from the PXI agent
run. Tool evaluators read `tool-call` parts from those messages, so tool
selection and tool-argument checks cover every tool call emitted during the
turn.

## Model Configuration

The task uses Phoenix agent env vars for model selection:

```bash
export PHOENIX_AGENTS_ASSISTANT_PROVIDER=OPENAI
export PHOENIX_AGENTS_ASSISTANT_MODEL=gpt-5.4
```

Provider credentials are read from the normal provider env vars, such as
`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.

The docs MCP toolset follows the same production gates as the Phoenix server:

```bash
export PHOENIX_DANGEROUSLY_ENABLE_AGENTS=true
export PHOENIX_ALLOW_EXTERNAL_RESOURCES=true
```

If either gate is disabled, the experiment still runs but the agent does not
receive docs MCP tools.

## Datasets

Datasets live in `evals/pxi/datasets/*.yaml`. Each file has:

- `dataset_name`
- optional `description`
- `evaluators`
- `examples`

Each example needs a stable `id`, exactly one split in a list-shaped `splits`
field, and whatever `input`, `expected`, and `metadata` shape its evaluators
consume. For the current tool-call evaluators, examples commonly use
`input.query`, `expected.tools`, and expected tool arguments under
`expected.tool_call_args`.

Example IDs must be unique because the runner uses them for stable upserts.
Use `splits: [regression]` for a regression example.

Every dataset example must declare list-shaped `splits: [...]`, even when the
example belongs to only one split:

```yaml
examples:
  - id: llm-spans
    splits: [regression]
    input:
      query: Show me only LLM spans.
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

Every example declares `input.messages` as a single ordered conversation
prefix. The trailing entry decides which step of the agent loop the harness
scores:

- **Last entry is `role: user`.** That turn becomes the user prompt; everything
  before it is replayed as message history. The default case -- "user asks,
  what does the agent do?"
- **Last entry is `role: tool`.** The harness runs the agent with `user_prompt
  = None` and the full list as message history, so the agent picks up
  mid-loop from a primed tool return. Lets a dataset isolate one step of
  behavior ("given the bash output below, what does the agent emit next?")
  without a synthetic user follow-up.
- **Last entry is `role: assistant`.** Rejected -- nothing remains to score.

Examples may also include `input.contexts`, which uses the same camelCase
shape as the browser agent API (`app`, `project`, `graphql`, etc.) so
server-side evals can exercise realistic page state without launching
Playwright.

A plain example -- user asks, agent decides:

```yaml
input:
  contexts:
    - type: project
      projectNodeId: UHJvamVjdDoxMg==
      spanFilter: "status_code == 'ERROR'"
      rootSpansOnly: false
  messages:
    - role: user
      content: Keep the error filter, but only show root spans.
```

A primed-tool-history example -- the agent has already issued a `bash` call
to inspect recent traces, and the harness scores whatever action it emits
next (typically a `set_spans_filter` call referencing the dates that came
back in the tool return):

```yaml
input:
  contexts:
    - type: project
      projectNodeId: UHJvamVjdDoxMg==
      spanFilter: "span_kind == 'LLM'"
      rootSpansOnly: false
  messages:
    - role: user
      content: Show me only the latest traces in this project.
    - role: assistant
      tool_calls:
        - id: t1
          name: bash
          args:
            command: "phoenix-gql --query '...recent spans by startTime desc...'"
    - role: tool
      tool_call_id: t1
      name: bash
      content: |
        {"data":{"node":{"spans":{"edges":[
          {"node":{"startTime":"2026-04-03T18:42:11Z"}},
          {"node":{"startTime":"2026-04-03T18:41:58Z"}}
        ]}}}}
```

Schema notes:

- An assistant turn may carry `content`, `tool_calls`, or both. Real PXI
  traces show no assistant text between tool calls, so primed-tool examples
  should omit narration unless you're deliberately testing narration
  behavior.
- Each tool call needs a local string `id` (any value; not interpreted by
  the agent) plus `name` and `args`. Every assistant `tool_calls` entry
  MUST be followed later by a `role: tool` entry whose `tool_call_id` and
  `name` match. `tool_call_id` values must be unique across the whole list.
- Primed messages are fed to the model verbatim via pydantic_ai's message
  types; the model cannot distinguish a primed tool call from one that
  was actually executed.

## Matcher Vocabulary

The `tool_call_args_match` evaluator compares expected args to observed args
with subset semantics (extra observed keys are ignored). Each expected value
is either a literal (compared by `==`) or a **matcher object** -- a dict
whose top-level keys are all in this vocabulary:

| Matcher | Meaning |
|---|---|
| `equals: <value>` | Explicit equality (same as a bare literal). |
| `contains_all: [<str>, ...]` | Observed must be a string containing every substring. Use this for clause-order-invariant DSL matching (`["span_kind == 'LLM'", "latency_ms >= 5000"]` matches either ordering). |
| `contains_any: [<str>, ...]` | Observed must be a string containing at least one substring. |
| `not_contains: [<str>, ...]` | Observed must be a string containing none of the substrings. |
| `any: true` | The key must be present in observed args; value is unconstrained. |

To leave an arg entirely unconstrained, just omit it from `expected` --
subset matching ignores observed keys you don't mention. Use `any: true`
only when presence itself matters.

For efficiency-focused examples, add `expected.budgets.max_tool_calls` and
enable the `tool_call_count_within_limit` evaluator. Bash-first examples can
use `bash_command_substrings_match` to check command intent without requiring
exact shell syntax.

## Manual CI

`expected.tools` may also include `exact_match: true`, which switches
`correct_tools_called` from "all required tools must be called" to "the
observed tool sequence must equal the required sequence" (no extras, no
duplicates, same order).

`expected.tool_call_args` holds at most one expected arg map per tool name. The
match is intentionally permissive in two ways:

1. **Subset match per call.** A call passes when *all* expected `(key, value)`
   pairs are present; the observed call may carry extra arg keys that the
   dataset doesn't mention.
2. **Any-of match across multiple calls.** When a tool is called more than once
   in a turn, the check passes if *any* of those calls satisfies the expected
   pairs.

String values that contain ` and ` are normalized as order-independent
conjunctions, so `latency_ms >= 5000 and span_kind == 'LLM'` matches
`span_kind == 'LLM' and latency_ms >= 5000`.

Tool arg keys must match the tool's exact JSON schema, including camelCase. For
`set_spans_filter` that means `condition` and `rootSpansOnly`;
`root_spans_only` will silently fail arg-match.

## Evaluators

Code evaluators live in `evals/pxi/evaluators/` and use
`@create_evaluator(name=..., kind="code")` from `phoenix.evals`. Experiment
evaluators can bind `output`, `input`, `expected`, and `metadata`. Simple
`bool`, `int`, or `float` returns are converted into Phoenix scores, while dict
returns can include labels, explanations, and metadata for debugging.

## What Belongs Here

Use Python server evals for model-facing PXI behavior that can be measured from
the server-owned agent output, including tool selection and deferred tool
arguments. Use Playwright when the behavior depends on browser rendering,
frontend dispatch, page state transitions, or visual/UI assertions.
