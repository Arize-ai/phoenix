# PXI Harbor evaluation

## Run

Install the Phoenix client with its Harbor integration on Python 3.12 or newer:

```bash
pip install "arize-phoenix-client[harbor]"
```

Build Phoenix and stage each task's build context (from the repository root): the wheel,
the container assets, and the task's fixture database, which is baked into the image from
`gs://arize-phoenix-assets/evals/harbor/<task>/phoenix.db`. The same command builds the px
CLI archive the `claude-code-cli` agent installs: the CLI is built from source and assembled
with its production dependencies in a Docker container into
`dist/phoenix-cli/phoenix-cli.tar.gz`, outside every build context, so the agent tests the
checkout's CLI without exposing it to the other agents.

```bash
make harbor-stage
```

The archive step needs Docker and takes a few minutes; `HARBOR_CLI=0` skips it when no run
needs that agent. It targets `linux/amd64` by default; set `HARBOR_CLI_PLATFORM` to match
the trial environment when using another architecture.

Each task keeps its grading material under `tests/`, which Harbor uploads only when the
verifier runs, so the agent never sees the ground truth or the checks.

A Harbor job file defines a run: its tasks, agents, environment, attempts, and network
policy. `evals/harbor/jobs/benchmark.yaml` is the full benchmark, every agent on every
task on Daytona, and is what CI runs:

```bash
make harbor-run
```

Anything `harbor run` accepts passes through `HARBOR_ARGS` and overrides the file, e.g. a
local Docker run with one attempt, or the oracle trial that validates the environment and
verifiers without spending agent tokens:

```bash
make harbor-run HARBOR_ARGS='-e docker -k 1'
make harbor-run HARBOR_ARGS='-a oracle -k 1'
```

`-a` replaces the file's agents but keeps its tasks and environment, so a one-off agent
passed that way needs its own model, hosts, and kwargs on the command line. For anything
more than that, copy the benchmark file, trim its tasks and agents, and point `HARBOR_JOB`
at it:

```bash
make harbor-run HARBOR_JOB=my-job.yaml
```

Every run records its tasks, trials, scores, and traces in Phoenix through the
`arize-phoenix` Harbor plugin, which reads `PHOENIX_COLLECTOR_ENDPOINT` and
`PHOENIX_API_KEY` from the environment (a local server on the default port needs neither).
Runs from any job file share the `pxi-benchmark` dataset, so a subset run's experiments sit
next to CI's; `HARBOR_DATASET=` picks another dataset and `HARBOR_PLUGIN=` (empty) runs
without recording. The plugin fails the job before any trial starts if it cannot reach
Phoenix.

## Agents

Three agents run against the same environment and verifiers, so reward differences are
attributable to the surface:

| Agent | Surface | How it reaches Phoenix |
| --- | --- | --- |
| `phoenix-chat-agent` | PXI inside the Phoenix server | The agent session chat route; sidecars live in the PXI virtual shell |
| `claude-code-mcp` | Claude Code | The remote MCP server at `/mcp`, which also serves the error-analysis skill |
| `claude-code-cli` | Claude Code | `@arizeai/phoenix-cli` installed from the `dist/phoenix-cli/phoenix-cli.tar.gz` archive with `PHOENIX_ENDPOINT` set, plus the four public skills from `.agents/skills/` passed with `--skill` |

The Claude Code agents are subclasses of Harbor's installed `claude-code` agent in
`evals/harbor/agents/coding_agents.py`. They run with Harbor's default
`bypassPermissions`, matching the chat agent's auto-approved tool calls, and with
`--resume-trajectory` so step 2 continues step 1's conversation. Claude Code only speaks
the Anthropic API, so pass an `anthropic/` model.

Every agent hands its work to the verifier through Harbor's own ATIF trajectory at
`/logs/agent/trajectory.json`, which Harbor writes for Claude Code after each step and which
`phoenix-chat-agent` builds from the turn's transcript in `populate_context_post_run`. The
verifier takes the final reply from the last agent step, counts tool calls from the steps, and
finds the PXI agent session through the trajectory's `session_id`. Sidecars are read from
`/app/.px/coding` on disk when present and from the PXI snapshot otherwise.

A chat transcript carries one timestamp and one usage figure per turn, so the chat agent
also records each turn's trace in the container's Phoenix (tracing is forced in
`start_phoenix_server.sh`) and saves its trimmed spans next to the transcript. Each ATIF
step is matched to its LLM span and tool spans by tool call ID, which gives the step its
real timestamp and token counts, and the per-call LLM latencies reach the Phoenix plugin
through `AgentContext.metadata["api_request_times_msec"]`, so the experiment's spans have
durations comparable to the Claude Code agents'.

The `phoenix-chat-agent` uploads its `chat_client.py` during setup; the shared task image
contains only the server startup script, wheel, and fixture database.

The `claude-code-cli` agent uploads the complete archive into its own sandbox during install
and runs `evals/harbor/agents/install_phoenix_cli.sh` to extract it and link the executables.
Only the host build container accesses npm; the trial needs no npm registry allowance.

To test an unreleased Phoenix client's plugin, build its wheel and put it in the Harbor
environment in place of the pinned release:

```bash
uv build --wheel packages/phoenix-client
CLIENT_WHEEL=$(ls dist/arize_phoenix_client-*.whl)
PYTHONPATH=. uvx --python 3.13 --from 'harbor[daytona]==0.21.0' --with "$CLIENT_WHEEL" \
  harbor run -c evals/harbor/jobs/benchmark.yaml -e docker -k 1 \
  --plugin arize-phoenix --plugin-kwarg dataset=pxi-benchmark --yes
```

## Experiment names

The plugin creates one Phoenix experiment per agent configuration, named by default
`{job.name} · {agent.name} · {agent.model}`. To rename them, pass a template through
`HARBOR_ARGS`:

```bash
make harbor-run HARBOR_ARGS="--plugin-kwarg 'experiment_name_template={job.name} · {agent.name}'"
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
the string-valued fields. A job with a single agent configuration may use an exact
`experiment_name=...` instead; an exact name is literal, so braces have no formatting behavior.

The plugin identifies an experiment by its Harbor job ID, Phoenix dataset version, and agent
configuration digest, not by its display name. Two jobs may use the same exact name without being
treated as the same experiment. Include `{job.name}` or `{job.id}` when those jobs should also be
easy to distinguish by name in Phoenix.

Browse job results in a local web viewer:

```bash
make harbor-view
```

## Network allowlists

The task allows nothing by itself; every host is granted at the narrowest level that
needs it, so `task.toml` (and with it the Phoenix dataset version) never changes for a
new provider or operator.

| Level | Set in | Applies to | Used for |
| --- | --- | --- | --- |
| Task baseline | `[environment]` in `task.toml` | the whole trial | nothing: `network_mode = "allowlist"` with no hosts |
| Verifier phase | `[verifier]` in `task.toml` | verification only | `network_mode = "public"`: the LLM judge reaches its provider without a second allowlist |
| Job environment | `environment.extra_allowed_hosts` in the job file, or `--allow-environment-host` | the whole trial, every agent | the Phoenix docs hosts |
| Agent | `extra_allowed_hosts` on an agent entry, or `--allow-agent-host` | that agent's run only | the agent's LLM provider |

The job file grants the docs hosts and each agent's provider host; delete them there for
a sealed run. Agent-level hosts are not in effect during agent install, so anything an
agent installs at that point must already be in the image or in the upload.

## Fixtures

The error-analysis fixture is hand-prepared. To replace it, upload the new database and
restage:

```bash
gcloud storage cp --cache-control=no-store phoenix.db \
  gs://arize-phoenix-assets/evals/harbor/error-analysis/phoenix.db
make harbor-stage HARBOR_CLI=0
```
