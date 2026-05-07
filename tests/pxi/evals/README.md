# PXI Server-Side Evals

This harness runs live-model PXI server-side evals as Phoenix experiments.

## Run Locally

Start Phoenix, then run:

```bash
uv run python tests/pxi/evals/run_experiment.py --dataset set_spans_filter
```

By default the runner writes results to `http://localhost:6006` and checks
`/healthz` before starting. To use a shared Phoenix endpoint:

```bash
export PXI_E2E_EXPERIMENT_BASE_URL=https://your-phoenix.example.com
export PXI_E2E_EXPERIMENT_BEARER_TOKEN=...
uv run python tests/pxi/evals/run_experiment.py --dataset set_spans_filter
```

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
