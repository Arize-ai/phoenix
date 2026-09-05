# Phoenix headless agent Harbor evaluation

## Run

Install the Phoenix client with its Harbor integration on Python 3.12 or newer:

```bash
pip install "arize-phoenix-client[harbor]"
```

From the repository root, build Phoenix and stage the wheel and container assets:

```bash
make harbor-stage-environments
```

Validate with the bundled oracle:

```bash
make harbor-oracle
```

Run the headless-agent adapter:

```bash
make harbor-run
```

Test the Harbor plugin against a local Phoenix server with the direct task path used by
the PXI workflow:

```bash
make dev-backend
# In another terminal:
uv build --wheel packages/phoenix-client
CLIENT_WHEEL=$(ls dist/arize_phoenix_client-*.whl)
uvx --python 3.13 --from 'harbor[daytona]==0.21.0' --with "$CLIENT_WHEEL" \
  harbor run -p evals/harbor/tasks/regression-triage -a oracle -e docker \
  --plugin arize-phoenix \
  --plugin-kwarg endpoint=http://127.0.0.1:6006 \
  --yes
```

A single direct task uses `harbor-task/<declared task name>` as its Phoenix dataset.
For several direct tasks, pass `--plugin-kwarg dataset=<name>` to name the synthetic
dataset explicitly.

### ATIF traces

Trace recording defaults to `atif` and requires Phoenix server 19.6 or newer. The agent must save
ATIF trajectories. The plugin loads canonical agent and simulated-user files, follows local
subagent and continuation references, and links one trace to the terminal trial's experiment run.
Multi-step trials include a `harbor.step` span for each attempted step.

LLM messages are reconstructed from ATIF, not copied from provider requests. See
[Import ATIF trajectories](../../docs/phoenix/tracing/how-to-tracing/importing-and-exporting-traces/importing-atif-trajectories.mdx)
for the message, timing, and span mappings.

Missing or invalid files and trace upload failures produce warnings. The plugin still records
the run and scores; these tracing failures do not change `infra_ok`. A successful run recorded
without a trace cannot gain a trace link on replay. Run and score write failures still stop the job.

Pass `--plugin-kwarg trace_mode=null` to record runs and scores without traces. OTLP mode is not
implemented.

## Experiment names

When a Harbor job has one agent configuration, give its Phoenix experiment an exact name with:

```bash
--plugin-kwarg experiment_name=my-baseline
```

An exact name is literal, so braces have no formatting behavior. Jobs with several agent
configurations create one Phoenix experiment per configuration and must use a template instead:

```bash
--plugin-kwarg 'experiment_name_template={job.name} · {agent.name} · {agent.model}'
```

The available template fields are:

| Field | Value |
| --- | --- |
| `{job.name}` | Harbor job name, falling back to the job ID |
| `{job.id}` | Unique Harbor job ID |
| `{dataset.name}` | Phoenix dataset name |
| `{agent.name}` | Harbor agent name |
| `{agent.model}` | Configured model name, or `default` |
| `{agent.short_digest}` | First twelve characters of the agent configuration digest |

Python callers can inspect the same field catalog through
`phoenix.client.harbor.EXPERIMENT_NAME_TEMPLATE_FIELDS`. Standard format specifications work for
the string-valued fields.

The plugin identifies an experiment by its Harbor job ID and agent configuration digest, not by
its display name. Two jobs may use the same exact name without being
treated as the same experiment. Include `{job.name}` or `{job.id}` when those jobs should also be
easy to distinguish by name in Phoenix.

## Task and model overrides

Both `harbor-run` and `harbor-oracle` accept task and environment overrides. Set the model and
attempt count for `harbor-run`:

```bash
make harbor-run HARBOR_TASK=evals/harbor/tasks/regression-triage \
  HARBOR_MODEL=anthropic/claude-sonnet-4-5 \
  HARBOR_ENV=docker \
  HARBOR_ATTEMPTS=1
```

For real-job trace and replay checks, see the
[Harbor plugin integration tests](../../tests/integration/harbor/README.md).

Browse job results in a local web viewer:

```bash
make harbor-view
```

Optionally export traces to a remote Phoenix instance:

```bash
export HARBOR_PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix.example.com
export HARBOR_PHOENIX_API_KEY=...
export HARBOR_PHOENIX_PROJECT_NAME=harbor-server-agent-evals
```

## Publish fixtures

```bash
make harbor-publish-fixtures
```
