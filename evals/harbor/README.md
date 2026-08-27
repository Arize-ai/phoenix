# Phoenix headless agent Harbor evaluation

## Run

Install the Phoenix client with its Harbor integration on Python 3.12 or newer:

```bash
pip install "arize-phoenix-client[harbor]"
```

Build Phoenix and stage the wheel and container assets (from the repository root):

```bash
make harbor-stage-environments
```

Validate with the bundled oracle:

```bash
make harbor-oracle
```

Run the real headless-agent adapter:

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
  --plugin-kwarg trace_mode=none \
  --yes
```

A single direct task uses `harbor-task/<declared task name>` as its Phoenix dataset.
For several direct tasks, pass `--plugin-kwarg dataset=<name>` to name the synthetic
dataset explicitly.

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

The plugin identifies an experiment by its Harbor job ID, Phoenix dataset version, and agent
configuration digest, not by its display name. Two jobs may use the same exact name without being
treated as the same experiment. Include `{job.name}` or `{job.id}` when those jobs should also be
easy to distinguish by name in Phoenix.

## ATIF traces

Tracing is opt-in. Pass `trace_mode=atif` to import the canonical ATIF files written by the
Harbor agent and attach one trace to each experiment run:

```bash
harbor run ... \
  --plugin arize-phoenix \
  --plugin-kwarg endpoint=http://127.0.0.1:6006 \
  --plugin-kwarg trace_mode=atif
```

The plugin discovers `trajectory.json` in the completed trial's agent directories, follows local
continuation and subagent references, and stores the resulting trace in the experiment's own
Phoenix project. It does not fetch remote references or read files outside the Harbor agent log
directory. Missing or invalid trajectories, upload failures, and attachment conflicts emit a
warning without dropping the experiment run or its evaluations.

Trace IDs and span IDs are deterministic for a Harbor job and trial. Re-running a completed job
repairs a partial upload and can attach a trace to a successful run that was originally recorded
with `trace_mode=none`. The trace link is write-once. Phoenix keeps the first link if a run already
points to another trace. Older Phoenix servers that do not support one-time attachment keep the
uploaded trace and untraced run separately, then log an upgrade warning.

Both trial targets accept overrides, e.g.:

```bash
make harbor-run HARBOR_TASK=evals/harbor/tasks/regression-triage \
  HARBOR_MODEL=anthropic/claude-sonnet-4-5 \
  HARBOR_ENV=docker \
  HARBOR_ATTEMPTS=1
```

Run the Phoenix plugin end-to-end matrix with:

```bash
make harbor-plugin-e2e
```

The command requires Docker. It builds the current client wheel, starts an isolated Phoenix
server, and exercises dataset snapshots, experiment runs, repetitions, multiple agents, resume,
and startup failures with Harbor 0.21.0. Successful runs remove their temporary workspace. Failed
runs print and retain the workspace path for investigation. Set `HARBOR_E2E_KEEP=1` to retain a
successful run as well.

Run the explicit Terminus-2 ATIF test with an OpenAI key from macOS Keychain:

```bash
make harbor-plugin-e2e-atif
```

This target reads `OPENAI_API_KEY` with `keyget` for the duration of the command. It runs Terminus-2
once with tracing disabled, resumes the completed job with ATIF enabled to backfill the existing
run, then resumes it again to check idempotency. It defaults to Harbor 0.22.0 and
`openai/gpt-5-mini`; override them with `HARBOR_ATIF_VERSION` and `HARBOR_ATIF_MODEL`. Like the
credential-free matrix, it uses a disposable Phoenix working directory and does not touch the
shared `~/.phoenix/phoenix.db`.

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
