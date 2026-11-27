# Trail benchmark dev

The TRAIL benchmark compares agent interfaces on questions about the same trace project.

- `tasks/` contains the Harbor tasks.
- `fixtures/` contains shared fixture setup.

Staging invokes `fixtures/fixture.sh` to download gated TRAIL rows and seed Phoenix. Load `HF_TOKEN` for an account that has accepted the TRAIL terms before staging. `make harbor-stage` runs the fixture scripts automatically;
you do not invoke them separately.

From the repository root, prepare and run the same job:

```bash
make harbor-stage HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml
make harbor-run HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml
```

See the [Harbor README](../../README.md) for prerequisites, subsets, and fixture regeneration.
