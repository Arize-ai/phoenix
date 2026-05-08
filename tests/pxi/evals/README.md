# PXI Server-Side Evals

This harness runs live-model PXI server-side evals as Phoenix experiments.

## Run Locally

The canonical entrypoint is `tests/pxi/evals/run_experiment.py`. Start
Phoenix, then run:

```bash
uv run python tests/pxi/evals/run_experiment.py --dataset set_spans_filter
```

The runner checks `/healthz` against whichever Phoenix URL is configured
(default `http://localhost:6006`, or `PXI_E2E_EXPERIMENT_BASE_URL` if set)
before uploading anything. To use a shared Phoenix endpoint:

```bash
export PXI_E2E_EXPERIMENT_BASE_URL=https://your-phoenix.example.com
export PXI_E2E_EXPERIMENT_BEARER_TOKEN=...
uv run python tests/pxi/evals/run_experiment.py --dataset set_spans_filter
```

Task errors (exception type plus a truncated message, no stack traces) are
uploaded to Phoenix as part of the experiment task output. Avoid pasting
credentials into request URLs while debugging against a shared Phoenix.

## Model Configuration

The task uses the same assistant env vars as PXI E2E tests:

```bash
export PXI_E2E_ASSISTANT_PROVIDER=OPENAI
export PXI_E2E_ASSISTANT_MODEL=gpt-5.4
```

Provider credentials are read from the normal provider env vars, such as
`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.

## Datasets

Datasets live in `tests/pxi/evals/datasets/*.yaml`. Each file has:

- `dataset_name`
- optional `description`
- `examples`

Each example needs a stable `id`, `input.query`, `expected.tools`, and
expected tool arguments under `expected.tool_call_args`. Do not add manual version numbers; Phoenix
versions datasets on upload. Example IDs must be unique because the runner
uses them for stable upserts.

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

Code evaluators live in `tests/pxi/evals/evaluators/` and use
`@create_evaluator(name=..., kind="code")` from `phoenix.evals`. Experiment
evaluators can bind `output`, `input`, `expected`, and `metadata`. Simple
`bool`, `int`, or `float` returns are converted into Phoenix scores, while
dict returns can include explanations and metadata for debugging.

## What Belongs Here

Use Python server evals for model-facing PXI behavior that can be measured from
the server-owned agent output, including tool selection and deferred tool
arguments. Use Playwright when the behavior depends on browser rendering,
frontend dispatch, page state transitions, or visual/UI assertions.
