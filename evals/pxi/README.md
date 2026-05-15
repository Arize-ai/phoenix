# PXI Evals

This tree is the canonical home for PXI-specific eval work.

## Layout

- `harness/` runs live PXI agent experiments against Phoenix datasets.
- `datasets/` stores YAML datasets shared by harness and CI workflows.
- `evaluators/` stores code evaluators for PXI tool behavior.
- `tests/` contains fast unit coverage for the harness and evaluators.
- `trace_ingest/` is reserved for future trace-to-dataset tooling.

## Splits

Every dataset example must declare `splits: [...]`. The harness defaults to the
`regression` split; `dev` is for manual experimentation, `val` is reserved for
optimizer scoring, and `holdout` is manual-only.

Examples may carry more than one split tag, but `val` must stay disjoint from
both `regression` and `dev`. The loader enforces that contract and warns when an
example is tagged with both `regression` and `holdout`.
