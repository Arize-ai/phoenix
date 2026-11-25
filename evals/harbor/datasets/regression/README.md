# Regression

The regression job covers error analysis and prompt improvement. CI uses this dataset.

- `tasks/` contains the Harbor tasks.
- `fixtures/` contains shared fixture setup.

Staging downloads the published error-analysis and prompt-hill-climb databases. `make harbor-stage` runs the fixture scripts automatically;
you do not invoke them separately.

From the repository root, prepare and run the same job:

```bash
make harbor-stage HARBOR_JOB=evals/harbor/jobs/regression.yaml
make harbor-run HARBOR_JOB=evals/harbor/jobs/regression.yaml
```

See the [Harbor README](../../README.md) for prerequisites, subsets, and fixture regeneration.
