# Phoenix Evals

This directory contains first-class eval harnesses that are developed with the
Phoenix repo but are not part of the production package.

## Layout

- `pxi/harness/` runs PXI server-side experiments against Phoenix datasets.
- `pxi/datasets/` stores YAML datasets shared by PXI eval workflows.
- `pxi/evaluators/` stores code evaluators shared by PXI eval workflows.

## Dataset Splits

PXI YAML datasets require each example to declare exactly one `split`:

| Split | Reader | Purpose |
| --- | --- | --- |
| `regression` | Harness default and CI | Fast held-out regression gate. |
| `dev` | Manual experimentation | Broader iteration, ablations, and failure analysis. |
| `val` | Optimizers | Optimization signal, disjoint from `regression` and `dev`. |

The three splits are mutually exclusive. The loader rejects examples with
unknown split names or the old list-shaped `splits` field. The runner translates
the YAML `split` value into the Phoenix client upload payload's `splits` list.
