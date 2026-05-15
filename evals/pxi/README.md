# PXI Evals

This tree is the canonical home for PXI-specific eval work.

## Layout

- `harness/` runs live PXI agent experiments against Phoenix datasets.
- `datasets/` stores YAML datasets shared by harness and CI workflows.
- `evaluators/` stores code evaluators for PXI tool behavior.
- `tests/` contains fast unit coverage for the harness and evaluators.
- `trace_ingest/` is reserved for future trace-to-dataset tooling.

## Splits

Every dataset example must declare list-shaped `splits: [...]`, even when the
example belongs to only one split:

```yaml
examples:
  - id: llm-spans
    splits: [regression]
    input:
      query: Show me only LLM spans.
```

The harness defaults to the `regression` split; `dev` is for manual
experimentation, `val` is reserved for optimizer scoring, and `holdout` is
manual-only. Do not use singular `split: regression`; the loader rejects it.

Examples may carry more than one split tag, but `val` must stay disjoint from
both `regression` and `dev`. The loader enforces that contract and warns when an
example is tagged with both `regression` and `holdout`.
