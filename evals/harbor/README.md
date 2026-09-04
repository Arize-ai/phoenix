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
  --yes
```

A single direct task uses `harbor-task/<declared task name>` as its Phoenix dataset.
For several direct tasks, pass `--plugin-kwarg dataset=<name>` to name the synthetic
dataset explicitly. Trace recording defaults to `atif`; pass `--plugin-kwarg trace_mode=null`
to record runs and scores without traces.

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

Run the credentialed ATIF matrix with:

```bash
OPENAI_API_KEY=... ANTHROPIC_API_KEY=... make harbor-plugin-e2e-atif
```

This target runs three cases, selectable with `HARBOR_E2E_ATIF_CASES` (comma-separated):

| Case | Agent | What it checks |
| --- | --- | --- |
| `terminus` | Terminus-2 on `HARBOR_ATIF_MODEL` | Three Terminal-Bench trials in one experiment: run linkage, measured LLM timing, equal-time ordering, idempotent resume |
| `compaction` | Terminus-2, forced summarization | The compaction span, continuation trajectory, and three summarizer subagent trajectories |
| `multi-step` | Claude Code on `HARBOR_ATIF_CLAUDE_MODEL` | The three-step `evals/harbor/plugin_e2e/word-count` task: one trace with a `harbor.step` span per step, step rewards, idempotent resume |

Every case prints the resulting trace tree and checks the shared invariants: one `harbor.trial`
root, resolvable parents, one session, target-named spans, no `llm.*` attributes outside LLM
spans, and input and output on every iteration. Set `HARBOR_E2E_ENDPOINT` to reuse a running
Phoenix server; otherwise the target starts an isolated server.

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
