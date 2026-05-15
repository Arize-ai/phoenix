# Phoenix Evals

This directory contains first-class eval harnesses that are developed with the
Phoenix repo but are not part of the production package.

## Layout

- `pxi/harness/` runs PXI server-side experiments against Phoenix datasets.
- `pxi/datasets/` stores YAML datasets shared by PXI eval workflows.
- `pxi/evaluators/` stores code evaluators shared by PXI eval workflows.
- `pxi/trace_ingest/` is reserved for future trace-derived dataset tooling.

## Dataset Splits

PXI YAML datasets require each example to declare exactly one split:

| Split | Reader | Purpose |
| --- | --- | --- |
| `regression` | Harness default and future CI | Fast held-out regression gate. |
| `dev` | Manual experimentation | Broader iteration, ablations, and failure analysis. |
| `val` | Future optimizer | Optimization signal, disjoint from `regression` and `dev`. |

The three splits are mutually exclusive. The loader rejects examples with
unknown split names or multiple split tags.
