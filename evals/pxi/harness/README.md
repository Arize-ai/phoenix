# PXI Server-Side Evals

This harness runs live-model PXI server-side evals as Phoenix experiments.

## Run Locally

The canonical entrypoint is `evals/pxi/harness/run_experiment.py`. Start
Phoenix, then run:

```bash
uv run python evals/pxi/harness/run_experiment.py --dataset set_spans_filter
```

The default invocation runs the `regression` split. Use `--splits` for manual
experimentation:

```bash
uv run python -m evals.pxi.harness.run_experiment --dataset set_spans_filter --splits dev val
```

The runner writes `summary.json` and `summary.md` to `evals/pxi/.last-run/` by
default. Override that location with `--summary-dir PATH`. `--fail-on-regression`
exits nonzero only when an evaluator fails on a `regression` example.

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

The task output stores the serialized Pydantic AI messages from the PXI
agent run. Tool evaluators read `tool-call` parts from those messages, so
tool selection and tool-argument checks cover every tool call emitted during
the turn.

## Model Configuration

The task uses Phoenix agent env vars for model selection:

```bash
export PHOENIX_AGENTS_ASSISTANT_PROVIDER=OPENAI
export PHOENIX_AGENTS_ASSISTANT_MODEL=gpt-5.4
```

Provider credentials are read from the normal provider env vars, such as
`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.
Local project credentials are stored in `~/Projects/phoenix/.env`; source that
file before running the harness if your shell does not already load it.

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

Each example needs a stable `id`, a non-empty `splits` list, `input.query`,
`expected.tools`, and expected tool arguments under `expected.tool_call_args`.
Example IDs must be unique because the runner uses them for stable upserts.

Split meanings:

| Split | Purpose |
| --- | --- |
| `regression` | Fast held-out regression gate; default for the harness. |
| `dev` | Manual experimentation, ablations, and failure analysis. |
| `val` | Future optimizer scoring signal; disjoint from `regression` and `dev`. |
| `holdout` | Manual-only generalization sanity checks. |

The loader rejects examples tagged with both `regression` and `val`, and
examples tagged with both `dev` and `val`. It allows `regression` plus
`holdout`, but warns during load so the overlap is visible.

`expected.tools` may also include `exact_match: true`, which switches
`correct_tools_called` from "all required tools must be called" to "the
observed tool sequence must equal the required sequence" (no extras, no
duplicates, same order).

`expected.tool_call_args` holds at most one expected arg map per tool name.
The match is intentionally permissive in two ways:

1. **Subset match per call.** A call passes when *all* expected `(key, value)`
   pairs are present; the observed call may carry extra arg keys that the
   dataset doesn't mention.
2. **Any-of match across multiple calls.** When a tool is called more than
   once in a turn, the check passes if *any* of those calls satisfies the
   expected pairs.

String values that contain ` and ` are normalized as order-independent
conjunctions, so `latency_ms >= 5000 and span_kind == 'LLM'` matches
`span_kind == 'LLM' and latency_ms >= 5000`.

Tool arg keys must match the tool's exact JSON schema, including
camelCase. For `set_spans_filter` that means `condition` and
`rootSpansOnly` — `root_spans_only` will silently fail arg-match.

## Evaluators

Code evaluators live in `evals/pxi/evaluators/` and use
`@create_evaluator(name=..., kind="code")` from `phoenix.evals`. Experiment
evaluators can bind `output`, `input`, `expected`, and `metadata`. Simple
`bool`, `int`, or `float` returns are converted into Phoenix scores, while
dict returns can include labels, explanations and metadata for debugging.

## What Belongs Here

Use Python server evals for model-facing PXI behavior that can be measured from
the server-owned agent output, including tool selection and deferred tool
arguments. Use Playwright when the behavior depends on browser rendering,
frontend dispatch, page state transitions, or visual/UI assertions.
