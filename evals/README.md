# Phoenix Evals

This directory contains first-class eval harnesses that are developed with the
Phoenix repo but are not part of the production package.

## Layout

- `pxi/harness/` runs PXI server-side experiments against Phoenix datasets.
- `pxi/datasets/` stores YAML datasets shared by PXI eval workflows.
- `pxi/evaluators/` stores code evaluators shared by PXI eval workflows.
- `pxi/trace_ingest/` is reserved for future trace-derived dataset tooling.

## Dataset Splits

PXI YAML datasets require each example to declare at least one split:

| Split | Reader | Purpose |
| --- | --- | --- |
| `regression` | Harness default and future CI | Fast held-out regression gate. |
| `dev` | Manual experimentation | Broader iteration, ablations, and failure analysis. |
| `val` | Future optimizer | Optimization signal, disjoint from `regression` and `dev`. |
| `holdout` | Manual only | Generalization sanity checks. |

Examples may carry multiple split tags, but `regression`/`val` and `dev`/`val`
are rejected by the loader. `regression`/`holdout` is allowed and emits a
warning so reviewers notice the deliberate overlap.
