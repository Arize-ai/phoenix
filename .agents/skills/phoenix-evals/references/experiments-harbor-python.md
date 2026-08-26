# Experiments: Recording Harbor Jobs (Python)

**Record a Harbor agent job as a Phoenix dataset plus one experiment per agent
configuration — no Phoenix code in your harness.**

Ships in `arize-phoenix-client` as `phoenix.client.harbor`. Python-only: there
is no TypeScript equivalent.

## Install

Harbor is not a dependency of `arize-phoenix-client`; the plugin imports it only
under `TYPE_CHECKING`, so installing the client alone never pulls Harbor in.
Install the extra when you want to use the plugin:

```bash
pip install 'arize-phoenix-client[harbor]'   # harbor>=0.21.0, requires Python >=3.12
```

## Enable

The plugin registers under the `harbor.plugins` entry point group as
`arize-phoenix`, so select it by name and pass configuration through Harbor's
`--plugin-kwarg key=value`:

```bash
harbor ... --plugin arize-phoenix --plugin-kwarg dataset=my-agent-suite
```

## Configuration

`PhoenixJobPlugin` takes keyword arguments only:

| Kwarg | Default | Meaning |
| ----- | ------- | ------- |
| `dataset` | derived from Harbor's dataset config or direct task | Phoenix dataset name override |
| `endpoint` | `phoenix.client.utils.config.get_base_url()` — `PHOENIX_ENDPOINT`, then `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix HTTP endpoint |
| `api_key` | `PHOENIX_API_KEY` | Phoenix API key |
| `trace_mode` | `"none"` | Trace recording mode. **Only `"none"` is supported** — any other value raises `ValueError` |
| `experiment_name` | — | Exact experiment name. Valid only when the job resolves to a single experiment slice |
| `experiment_name_template` | `"{job.name} · {agent.name} · {agent.model}"` | Names one experiment per resolved agent configuration |

`experiment_name` and `experiment_name_template` are mutually exclusive.
Supplying `experiment_name` for a job that expands to several agent
configurations raises `HarborPluginError`.

## Experiment naming

Template fields are published in `EXPERIMENT_NAME_TEMPLATE_FIELDS`; the default
is `DEFAULT_EXPERIMENT_NAME_TEMPLATE`. Both are exported from the package root:

```python
from phoenix.client.harbor import (
    DEFAULT_EXPERIMENT_NAME_TEMPLATE,
    EXPERIMENT_NAME_TEMPLATE_FIELDS,
    HarborPluginError,
    PhoenixJobPlugin,
)

for field, description in EXPERIMENT_NAME_TEMPLATE_FIELDS.items():
    print(field, "-", description)
```

| Field | Value |
| ----- | ----- |
| `job.name` | Harbor job name, falling back to the job ID |
| `job.id` | Unique Harbor job ID |
| `dataset.name` | Phoenix dataset name |
| `agent.name` | Harbor agent name |
| `agent.model` | Configured model name, or `default` |
| `agent.short_digest` | First twelve characters of the agent configuration digest |

An unknown field raises `ValueError` at construction time. When two slices
render the same name, the plugin appends the slice's short identity to
disambiguate.

## What gets recorded

- **One versioned Phoenix dataset per job.** At job start the plugin
  synchronizes Harbor's resolved task set into a single dataset, replacing its
  contents with a new version.
- **One experiment per agent/model configuration.** Re-running a job recovers
  the existing experiment rather than creating a duplicate.
- **One experiment run per terminal trial.** Retries are recorded as
  repetitions; a successful run is immutable, and a previously failed run may be
  replaced on resume.
- **Scores are not recorded yet** — the plugin logs a warning saying so at job
  start. Trace linkage is likewise unavailable, which is why `trace_mode` only
  accepts `"none"`.

## Failure modes

`HarborPluginError` (a `RuntimeError`) is raised when the plugin cannot record
the job. The cases you are most likely to hit:

- Harbor reported no dataset name — set `--plugin-kwarg dataset=<name>`.
- A job with multiple ad-hoc tasks has no collection identity — set
  `--plugin-kwarg dataset=<name>` to record the exact task set as a synthetic
  dataset.
- Tasks came from multiple dataset sources — use one dataset per job.
- Regrade and source-job runs are unsupported — omit `--plugin arize-phoenix`.
- The installed Harbor does not expose trial lifecycle hooks — upgrade Harbor.

Once the job is recorded, read the results with the normal experiment APIs — see
[experiments-running-python](experiments-running-python.md).
