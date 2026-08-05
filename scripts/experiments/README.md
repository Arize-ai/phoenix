# `scripts.experiments`

Experiment and dataset fixtures for Phoenix development. Where `scripts/generate_spans/`
produces traces over OTLP, these scripts drive the **dataset → experiment → evaluation** loop
through the Phoenix client and GraphQL, so they need a running server for anything but
`--dry-run`.

```bash
make seed-experiments                                    # baseline fixture, default options
make seed-experiments DATAGEN_EXPERIMENT=generate_multipage_experiment_data.py

# Or run a script directly for its own options.
uv run python scripts/experiments/generate_baseline_metrics_data.py --experiments 10
uv run python scripts/experiments/generate_multipage_experiment_data.py --examples 300
```

`make seed-experiments` forwards `--endpoint`, `--seed`, and `DATAGEN_ARGS` only. It does not
pass `--project-name`, because these scripts have none — a project is created implicitly, named
after the dataset.

## Scripts

| Script | Question it answers | Key surface exercised |
| --- | --- | --- |
| `generate_baseline_metrics_data.py` | Does experiment-over-experiment comparison read clearly? | a sequence of improving experiments, one marked baseline |
| `generate_multipage_experiment_data.py` | Does the experiment view paginate? | one large experiment with mixed evaluator results |

Both accept `--endpoint`, `--examples`, `--seed`, `--dataset-name`, and `--dry-run`.
`generate_baseline_metrics_data.py` adds `--experiments` and `--baseline` (a **one-based**
index into the sequence); `generate_multipage_experiment_data.py` adds `--experiment-name` and
`--evaluator-error-rate`.

## Adding a script

Follow the same shape as the two that exist: a `build_parser()`, a `main(argv=None) -> int`,
`add_common_arguments(parser, default_examples=...)` from `_shared.py`, and the dual-import
idiom so the file runs directly as well as via `python -m`:

```python
try:
    from ._shared import add_common_arguments, examples
except ImportError:  # Support direct execution from this directory.
    from _shared import add_common_arguments, examples
```

Keep both branches listing exactly the same names — they drift silently otherwise, and only
direct execution catches it.

## Gotchas

**The experiment sequence improves overall but is not monotonic.** Two iterations deliberately
regress — quality drops while latency and error rate rise together, the way a real bad change
behaves. A strictly improving sequence would make the fixture unable to show the comparison
people actually care about: an experiment that came out *worse* than the one before it. The
setback penalty scales with the per-step gain, so it stays visible at low `--experiments`
counts, and the final iteration is never a setback.

**`experiments` comes back newest-first over GraphQL.** Reading the connection in returned
order makes an improving sequence look like a declining one. Reverse it, or sort by id, before
comparing iteration N against N-1 — the scores match the intended profiles to within ~0.06
once reversed.

**These scripts need a live Phoenix; `--dry-run` is the only offline mode.** Unlike the span
generators, there is no OTLP path here — datasets, experiments, and evaluations all go through
the client and GraphQL. `--dry-run` prints the plan and writes nothing.

**A dead endpoint fails fast here, unlike the span generators.** The client raises
`httpx.ConnectError` within a few seconds, so there is no preflight check and none is needed.
The OTLP exporter in `generate_spans` behaves oppositely — it retries each span with backoff
and can appear to hang — which is why that package has `--no-preflight` and this one does not.

**Marking a baseline is GraphQL-only.** The Phoenix client has no method for it, so
`generate_baseline_metrics_data.py` posts the `setExperimentBaseline` mutation directly with
`httpx`. If the mutation changes, that raw query is what breaks.

**Every run creates a new dataset unless you name one.** The default is
`baseline-metrics-<uuid>` / `pagination-experiment-<uuid>`, so repeated runs accumulate
datasets rather than overwriting. Pass `--dataset-name` to reuse one.

**Experiment runs also emit spans, into a project called `evaluators`.** The Phoenix client
hardcodes that project name for evaluator tracing
(`client/resources/experiments/__init__.py`), so evaluator spans land there no matter what the
dataset is called. `generate_baseline_metrics_data.py` does call
`phoenix.otel.register(project_name=dataset_name, ...)`, but no project by that name appears
in practice — verified by seeding a clean Phoenix and listing projects. Expect one shared
`evaluators` project accumulating spans across every experiment run, and do not go looking for
a project named after your dataset.

**`--seed` really is reproducible, despite the concurrency.** Task and evaluator functions
close over one shared `random.Random`, and the client runs them through a `SyncExecutor` with
an AIMD concurrency controller — which looks like it should interleave draws and destroy
determinism. It does not: two runs at the same seed produced byte-identical evaluation means,
verified at both 4 and 60 examples (the larger size so the controller had room to ramp up).
Worth knowing before anyone "fixes" the shared RNG.

**Evaluators are code evaluators, not LLM judges.** They are built with
`@create_evaluator(kind="code")` and return a seeded score, so runs are reproducible and cost
nothing. There is no model call to configure, and no API key required.
