# Phoenix Evals

This directory contains first-class eval harnesses that are developed with the
Phoenix repo but are not part of the production package.

## Layout

- `pxi/` contains PXI eval datasets, evaluators, harnesses, and future
  ingestion tooling.
- `pxi/harness/` runs PXI server-side experiments against Phoenix datasets.
- `pxi/datasets/` stores YAML datasets shared by PXI eval workflows.
- `pxi/evaluators/` stores code evaluators shared by PXI eval workflows.

## Dataset Splits

PXI YAML datasets require each example to declare at least one `splits` tag.
Use the list-shaped field even for a single split:

```yaml
examples:
  - id: llm-spans
    splits: [regression]
    input:
      query: Show me only LLM spans.
```

| Split | Reader | Purpose |
| --- | --- | --- |
| `regression` | Harness default and CI | Fast held-out regression gate. |
| `dev` | Manual experimentation | Broader iteration, ablations, and failure analysis. |
| `val` | Optimizers | Optimization signal, disjoint from `regression` and `dev`. |
| `holdout` | Manual only | Generalization sanity checks. |

Examples may carry multiple tags, but the loader rejects combinations that leak
optimization signal: `regression` + `val`, and `dev` + `val`. The loader warns
on `regression` + `holdout` so reviewers notice the deliberate overlap.
