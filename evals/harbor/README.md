# PXI Harbor evaluation

## Run

Install the Phoenix client with its Harbor integration on Python 3.12 or newer:

```bash
pip install "arize-phoenix-client[harbor]"
```

Build Phoenix and stage each task's build context (from the repository root): the wheel,
the container assets, and the task's fixture database, which is baked into the image from
`gs://arize-phoenix-assets/evals/harbor/<task>/phoenix.db`. The same command packs the px
CLI and its workspace dependencies from source into `dist/phoenix-cli/`, outside every
build context, so the `claude-code-cli` agent tests the checkout's CLI without exposing it
to the other agents.

```bash
make harbor-stage-environments
```

Each task keeps its grading material under `tests/`, which Harbor uploads only when the
verifier runs, so the agent never sees the ground truth or the checks.

Validate with the bundled oracle:

```bash
make harbor-oracle
```

Run one agent on the task:

```bash
make harbor-run                                # PXI through the chat route
make harbor-run HARBOR_AGENT=claude-code-mcp   # Claude Code + the Phoenix MCP server
make harbor-run HARBOR_AGENT=claude-code-cli   # Claude Code + the px CLI and public skills
```

Run all three on the error-analysis task in one Daytona job, one trial per agent:

```bash
make harbor-compare
```

## Agents

Three agents run against the same environment and verifiers, so reward differences are
attributable to the surface:

| Agent | Surface | How it reaches Phoenix |
| --- | --- | --- |
| `phoenix-chat-agent` | PXI inside the Phoenix server | The agent session chat route; sidecars live in the PXI virtual shell |
| `claude-code-mcp` | Claude Code | The remote MCP server at `/mcp`, which also serves the error-analysis skill |
| `claude-code-cli` | Claude Code | `@arizeai/phoenix-cli` installed from the `dist/phoenix-cli/` tarballs with `PHOENIX_ENDPOINT` set, plus the four public skills from `.agents/skills/` passed with `--skill` |

The Claude Code agents are subclasses of Harbor's installed `claude-code` agent in
`evals/harbor/agents/claude_code_agents.py`. They run with Harbor's default
`bypassPermissions`, matching the chat agent's auto-approved tool calls, and with
`--resume-trajectory` so step 2 continues step 1's conversation. Claude Code only speaks
the Anthropic API, so pass an `anthropic/` model. After each step they write the final reply
to `/logs/agent/steps/<n>/answer.md`; the verifier reads sidecars from `/app/.px/coding` on
disk when present and from the PXI snapshot otherwise.

The `claude-code-cli` agent uploads the packed tarballs into its own sandbox during install
and runs `evals/harbor/agents/install_phoenix_cli.sh`, which turns each tarball into an npm
override so the workspace packages resolve to the local builds.

Test the Harbor plugin against a local Phoenix server with the direct task path used by
the PXI workflow:

```bash
make dev-backend
# In another terminal:
uv build --wheel packages/phoenix-client
CLIENT_WHEEL=$(ls dist/arize_phoenix_client-*.whl)
uvx --python 3.13 --from 'harbor[daytona]==0.21.0' --with "$CLIENT_WHEEL" \
  harbor run -p evals/harbor/tasks/error-analysis -a oracle -e docker \
  --plugin arize-phoenix \
  --plugin-kwarg endpoint=http://127.0.0.1:6006 \
  --plugin-kwarg trace_mode=null \
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

`make harbor-compare` takes plugin flags through `HARBOR_ARGS`:

```bash
make harbor-compare HARBOR_ARGS='--plugin arize-phoenix --plugin-kwarg endpoint=http://127.0.0.1:6006 \
  --plugin-kwarg "experiment_name_template={job.name} · {agent.name}"'
```

The trial targets accept overrides, e.g.:

```bash
make harbor-run HARBOR_TASK=evals/harbor/tasks/error-analysis \
  HARBOR_MODEL=anthropic/claude-sonnet-4-5 \
  HARBOR_ENV=docker \
  HARBOR_ATTEMPTS=1
```

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

The task runs under Harbor's allowlist network policy, so add the collector's host to
`allowed_hosts` in `task.toml` or the export is silently dropped.

## Fixtures

The error-analysis fixture is hand-prepared. To replace it, upload the new database and
restage:

```bash
gcloud storage cp --cache-control=no-store phoenix.db \
  gs://arize-phoenix-assets/evals/harbor/error-analysis/phoenix.db
make harbor-stage-environments
```
