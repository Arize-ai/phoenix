# Phoenix eval CI (pytest)

Run LLM evals as a normal pytest suite and gate CI on the results.

- `test_evals.py` — an example eval suite using `@pytest.mark.phoenix` and the
  `px.log_output` / `px.log_evaluation` helpers.
- `eval-ci.yml` — a copy-paste GitHub Actions workflow that installs the plugin,
  runs the suite, and fails the job on the pytest exit code. It includes an
  optional, commented-out step that upserts a single PR comment with the printed
  summary.

## Quick start

```bash
pip install "arize-phoenix-client[pytest]" pytest
export PHOENIX_COLLECTOR_ENDPOINT=...   # your Phoenix endpoint
export PHOENIX_API_KEY=...              # if your deployment requires auth
pytest
```

The plugin activates automatically once the `pytest` extra is installed. See the
[eval CI docs page](https://arize.com/docs/phoenix/datasets-and-experiments/how-to-experiments/eval-ci-with-pytest)
for the full marker, env-var, and gating reference.
