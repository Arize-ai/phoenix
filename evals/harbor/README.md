# Harbor evaluations for Phoenix

Harbor tasks and tooling for evaluating agents against Phoenix. Harbor runs the agents
and the verifiers; the `arize-phoenix` Harbor plugin writes every run to a Phoenix of
your choice as versioned datasets, experiments, scores, and ATIF traces.

Two benchmarks live here and share the tooling:

| Job file | What it measures | Tasks | Phoenix dataset |
| --- | --- | --- | --- |
| `jobs/benchmark.yaml` | PXI, and Claude Code with the MCP server or the px CLI, on a multi-step error-analysis scenario | `tasks/error-analysis` | `pxi-benchmark` |
| `jobs/trail-benchmark-dev.yaml` | Every surface an agent can use to reach Phoenix (MCP server, px CLI, PXI) on the same questions about one project of TRAIL traces | `tasks/trail-benchmark-dev/*` | `trail-benchmark-dev` |

```text
agents/          Harbor agents: PXI through the chat route, Claude Code and Codex with MCP or px
environments/    The one Dockerfile every task runs in, the Phoenix start script, and a fixture per seeded database
jobs/            One job file per benchmark; a run is a job file
tasks/           error-analysis/ and trail-benchmark-dev/<task>/
verifiers/       Shared verifier code: the reply grader, the LLM judge, Phoenix queries for the solutions
scripts/         Host-side tooling: staging, the px CLI archive, job subsets, the CI reward gate
```

## Run

Install the Phoenix client with its Harbor integration on Python 3.12 or newer:

```bash
pip install "arize-phoenix-client[harbor]"
```

Build Phoenix and stage every task (from the repository root). Staging builds the wheel,
produces each fixture database that it can, writes each task's build context, and builds
the px CLI archive the CLI agents install:

```bash
make harbor-stage                 # error-analysis tasks only: the TRAIL fixture needs a token
HF_TOKEN=... make harbor-stage    # also seeds the TRAIL fixture and stages its tasks
```

The archive step needs Docker and takes a few minutes; `HARBOR_CLI=0` skips it when no
run needs a CLI agent. It targets `linux/amd64` by default; set `HARBOR_CLI_PLATFORM` to
match the trial environment on another architecture. See
[Environments and fixtures](#environments-and-fixtures) for what staging writes and when
to rerun it.

A Harbor job file defines a run: its tasks, agents, environment, attempts, and network
policy. `HARBOR_JOB` picks the file (default `jobs/benchmark.yaml`, which is what CI
runs), and anything `harbor run` accepts passes through `HARBOR_ARGS` and overrides
the file:

```bash
make harbor-run                                                          # the PXI benchmark, as CI runs it
make harbor-run HARBOR_ARGS='-e docker -k 1'                             # local Docker, one attempt
make harbor-run HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml HARBOR_ARGS='-e docker'
make harbor-run HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml HARBOR_ARGS='-a oracle -e docker'
make harbor-run HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml HARBOR_ARGS='-e docker -k 3 --job-name px-1.19'
```

`-a oracle` runs each task's reference solution through its verifier with no agent; see
[Solutions and the oracle](#solutions-and-the-oracle). `-a` replaces the file's agents but
keeps its tasks and environment, so a one-off agent passed that way needs its own model,
hosts, and kwargs on the command line. For anything more than that, a subset is a copy
of the job file with fewer tasks and agents. `scripts/subset_job.py` writes the copy by
name:

```bash
uv run --script evals/harbor/scripts/subset_job.py evals/harbor/jobs/trail-benchmark-dev.yaml \
  --agents claude-code-mcp codex-cli --tasks count-traces total-cost --out evals/harbor/.cache/subset.yaml
make harbor-run HARBOR_JOB=evals/harbor/.cache/subset.yaml HARBOR_ARGS='-e docker'
```

Every run records its tasks, trials, scores, and traces in Phoenix through the
`arize-phoenix` Harbor plugin, which reads `PHOENIX_COLLECTOR_ENDPOINT` and
`PHOENIX_API_KEY` from the environment (a local server on the default port needs neither).
A job file that lists a task directory records to the dataset named after that
directory, so every copy of `trail-benchmark-dev.yaml` lands in `trail-benchmark-dev`; a
job file that lists tasks directly needs a name, and `benchmark.yaml`'s is `pxi-benchmark`.
`HARBOR_DATASET=` overrides either, and `HARBOR_PLUGIN=` (empty) runs without
recording. The plugin fails the job before any trial starts if it cannot reach Phoenix.

Browse job results in a local web viewer:

```bash
make harbor-view
```

## Agents

Every agent runs against the same environment and verifiers as the others in its job,
so reward differences are attributable to the surface:

| Agent | Surface | How it reaches Phoenix |
| --- | --- | --- |
| `phoenix-chat-agent` | PXI inside the Phoenix server | The agent session chat route; sidecars live in the PXI virtual shell |
| `claude-code-mcp` | Claude Code | The remote MCP server at `/mcp`, which also serves the error-analysis skill |
| `claude-code-cli` | Claude Code | `@arizeai/phoenix-cli` installed from `dist/phoenix-cli/phoenix-cli.tar.gz` with `PHOENIX_ENDPOINT` set, plus public skills from `.agents/skills/` passed with `--skill` |
| `codex-mcp` | Codex | The remote MCP server |
| `codex-cli` | Codex | The same px install and skills as `claude-code-cli` |
| `oracle` | none | Harbor's oracle runs each task's `solution/solve.sh` through the verifier; use it with `-a oracle` |

The coding agents are subclasses of Harbor's installed `claude-code` and `codex` agents
in `evals/harbor/agents/coding_agents.py`: two mixins add the Phoenix MCP server or the
px install to either base. They run with Harbor's default `bypassPermissions`, matching
the chat agent's auto-approved tool calls. Claude Code only speaks the Anthropic API, so
pass an `anthropic/` model; Codex only speaks OpenAI's. The Claude Code agents in
`benchmark.yaml` also run with `--resume-trajectory` so step 2 continues step 1's
conversation.

Harbor installs Claude Code at trial start from `downloads.claude.ai`, which the job
files allow. Codex is preinstalled in the image at the version the job files pin, because
Harbor's Codex installer fetches nvm from GitHub, which the allowlist blocks; Harbor
verifies the version and skips the install.

Every agent hands its work to the verifier through Harbor's own ATIF trajectory at
`/logs/agent/trajectory.json`, which Harbor writes for Claude Code and Codex after each
step and which `phoenix-chat-agent` builds from the turn's transcript in
`populate_context_post_run`. The verifier takes the final reply from the last agent step,
counts tool calls from the steps, and finds the PXI agent session through the trajectory's
`session_id`. Sidecars are read from `/app/.px/coding` on disk when present and from the
PXI snapshot otherwise.

A chat transcript carries one timestamp and one usage figure per turn, so the chat agent
also records each turn's trace in the container's Phoenix (tracing is forced in
`start_phoenix_server.sh`) and saves its trimmed spans next to the transcript. Each ATIF
step is matched to its LLM span and tool spans by tool call ID, which gives the step its
real timestamp and token counts, and the per-call LLM latencies reach the Phoenix plugin
through `AgentContext.metadata["api_request_times_msec"]`, so the experiment's spans have
durations comparable to the coding agents'.

The `phoenix-chat-agent` uploads its `chat_client.py` during setup. The CLI agents upload
the complete px archive into their own sandbox during install and run
`evals/harbor/agents/install_phoenix_cli.sh` as root to extract it and link `px` (only
`px`: `pxi` is the PXI condition, not a tool the CLI agents get to delegate to). Only the
host build container accesses npm; the trial needs no npm registry allowance.

To test an unreleased Phoenix client's plugin, build its wheel and put it in the Harbor
environment in place of the pinned release:

```bash
uv build --wheel packages/phoenix-client
CLIENT_WHEEL=$(ls dist/arize_phoenix_client-*.whl)
PYTHONPATH=. uvx --python 3.13 --from 'harbor[daytona]==0.21.0' --with "$CLIENT_WHEEL" \
  harbor run -c evals/harbor/jobs/benchmark.yaml -e docker -k 1 \
  --plugin arize-phoenix --plugin-kwarg dataset=pxi-benchmark --yes
```

## Environments and fixtures

Every task runs in the same image, `environments/Dockerfile`: a Phoenix from this
checkout, Node 22, Codex at the pinned version, the shared verifiers under
`/opt/verifier`, the start script under `/opt/phoenix-eval`, and one fixture database at
`/data/phoenix.db`. What differs between tasks is the fixture. A task names its fixture
in `task.toml`:

```toml
[metadata]
fixture = "trail"
```

Each fixture is a directory under `environments/fixtures/` with a `fixture.sh` that
writes `$1/phoenix.db`. `error-analysis` downloads the hand-prepared database from the
public assets bucket. `trail` seeds one project of
[PatronusAI/TRAIL](https://huggingface.co/datasets/PatronusAI/TRAIL) traces and
annotations through this checkout's own Phoenix on the host: it downloads the rows with
`HF_TOKEN`, starts `phoenix serve` on free ports against a scratch directory, loads the
rows through the repository's TRAIL loader, waits until the API reports every trace and
its computed costs, checkpoints the SQLite write-ahead log, and keeps the file. TRAIL is
gated and its terms forbid resharing it outside the Hugging Face hub, so every developer
seeds it with their own token, the rows and the database stay under `evals/harbor/.cache`,
and nothing TRAIL-derived is committed, uploaded to a bucket, or pushed to a registry. On
Daytona the built image lives in an auto-snapshot of your Daytona organization; treat that
like the local Docker image. Without a token the trail fixture exits with a message and staging skips its tasks.
That is what happens in CI.

`make harbor-stage` runs `scripts/stage_harbor_environments.sh`:

1. Builds the wheel and assembles the shared build context under
   `evals/harbor/.cache/environment`: the Dockerfile, the wheel, `verifiers/` as an
   importable `evals.harbor.verifiers` package, and the container assets.
2. Produces each fixture a task needs into `evals/harbor/.cache/fixtures/<name>/` unless
   it is already there. `RESEED=1` rebuilds them.
3. Copies the context into each task's `environment/` with hard links and hard-links the
   fixture to `environment/data/phoenix.db`.

Harbor builds a task's image from that task's own directory, and Docker cannot follow
symlinks out of a build context, so the context has to be a real copy. Each task's `.gitignore` ignores
`environment/`, and Harbor applies that file when it hashes the task, so staging never
changes the dataset version. The version covers the instruction, the verifier, and the
reference solution; the image is the thing under test. Restage after changing the server,
`verifiers/`, `environments/`, or a fixture. The verifier imports `verifiers/` from the image, not from your checkout, so a stale
stage produces confusing verifier errors. `make harbor-run` refuses to start a job whose tasks are not staged.

Inside a trial, Harbor starts the container with its own keepalive command and then runs
the task's `[environment.healthcheck]` as root, which is `start_phoenix_server.sh`. The
script is idempotent: it starts Phoenix on `/data/phoenix.db` if nothing answers on port
6006 and waits until it does. Running Phoenix from the healthcheck rather than the image
entrypoint works the same on Docker and Daytona, and Harbor does not begin agent setup
until it passes. The agent phase then runs as the unprivileged `agent` user
(`[agent] user = "agent"` in every `task.toml`). `/data` is root-only, so an agent can
reach the data only through Phoenix: the MCP server, px, or the API. PXI runs inside the
server process and has the server's access by design.

Verification runs in Harbor's shared mode, as root, with Phoenix still up: after the
agent finishes, Harbor uploads the agent's log directory, including the ATIF
`trajectory.json`, and the task's `tests/` into the container, and runs `test.sh` there.
Each task keeps its grading material under `tests/`, which Harbor uploads only then, so
the agent never sees the ground truth or the checks.

To replace the error-analysis fixture, upload the new database and restage:

```bash
gcloud storage cp --cache-control=no-store phoenix.db \
  gs://arize-phoenix-assets/evals/harbor/error-analysis/phoenix.db
RESEED=1 make harbor-stage HARBOR_CLI=0
```

## PXI benchmark

`tasks/error-analysis` is a two-step scenario on the hand-prepared fixture: PXI (or a
coding agent) open-codes a project's traces into notes, then axial-codes them into
per-dimension annotation configs. Its verifier lives with the task under `tests/` and
reads the fixture database and the agent's sidecars directly. `jobs/benchmark.yaml` runs
it with two attempts on Daytona; the workflow in `.github/workflows/harbor-evals.yml`
gates on `scripts/check_job_reward.py`.

## TRAIL benchmark

Ten questions about one project, each answered by every condition in
`jobs/trail-benchmark-dev.yaml`. The agent answers the question in its final reply, and
the task's verifier grades that reply while the Phoenix is still up. The same image runs
on local Docker and on Daytona.

Requirements: Docker whose Linux VM supports Harbor's allowlist network policy (recent
Docker Desktop builds do; Harbor probes the kernel and refuses to run otherwise), a
Hugging Face token with the TRAIL terms accepted, `ANTHROPIC_API_KEY` for the judge and
the Claude conditions, `OPENAI_API_KEY` for the Codex conditions, and `DAYTONA_API_KEY`
for Daytona.

```bash
HF_TOKEN=... make harbor-stage
make harbor-run HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml HARBOR_ARGS='-a oracle -e docker'
```

### Verifier

Every task's `tests/test.sh` runs the shared grader,
`python -m evals.harbor.verifiers.verify`, which reads the last agent message from the
ATIF trajectory and compares it with `tests/expected.json`. The oracle runs a solution
script instead of an agent and so has no trajectory; it writes `/app/answer.txt`, which
the grader reads only when no trajectory exists.

`expected.json` has one of two shapes:

```json
{"exact": "ok", "source": "fixed reply requested by the instruction"}
{"reference": "117 traces", "notes": "...", "source": "solution/solve.sh against the seeded fixture"}
```

`exact` is for a fixed reply: the grader strips Markdown emphasis, whitespace, and end
punctuation and compares case-insensitively, through the `exact_match` metric in
`phoenix.evals`. `reference` hands the reply and the reference answer to an LLM judge, a
`phoenix.evals` classifier in `verifiers/llm_judge.py`, which decides whether the reply
commits to the same final answer: wording, formatting, extra correct context, and
rounding to the reference's precision do not matter, while a different value, hedging
between candidates, or answering a different question fails. `notes` is optional guidance
for the judge, such as "page_down is the same tool". `source` records how the reference
value was derived. The judge runs on `claude-haiku-4-5` by default; set
`PHOENIX_EVAL_JUDGE_MODEL` (and `PHOENIX_EVAL_JUDGE_PROVIDER`) to change it. The task's
`[verifier]` table allows `api.anthropic.com` for it.

The verifier writes `reward` (0 or 1) plus `tool_call_count` and `agent_turn_count` from
the trajectory to `reward.json`; the plugin records each key as a separate evaluation.
The two counts are efficiency measurements and do not change the reward. The oracle has
no trajectory, so its runs omit them. On each run the plugin also records Harbor's token
counts, cost, and latency, an `infra_ok` evaluation that is `0` when Harbor recorded any
exception, and the agent's ATIF trace.

A task that changes Phoenix state writes its own `test.sh`: query Phoenix at
`http://127.0.0.1:6006` or read `/data/phoenix.db` (the verifier runs as root), decide the
reward, and call `evals.harbor.verifiers.verify.write_reward(reward, **extra)` to attach
the trajectory measurements.

### Solutions and the oracle

Each task has a `solution/solve.sh`, a reference solution that computes the answer from
the live Phoenix and writes it to `/app/answer.txt`. The Python solutions import
`evals.harbor.verifiers.phoenix_api` from `/opt/verifier`, which reads spans and
annotations through the typed Phoenix client. Phoenix exposes cost only through GraphQL,
so per-span cost is the one GraphQL query left.

The solution is the executable derivation of the value in `expected.json`, and the
oracle is how the two are checked against each other: `-a oracle` makes Harbor run each
task's `solve.sh` in place of an agent and grade the answer with the same verifier. A
reward of 1 on every task means the environment starts, the queries work, and the
verifier accepts each reference. It does not show that wrong answers fail; the judge's
prompt is what does that. Run it after changing a task, a fixture, or the
verifiers. Nothing runs it on a schedule.

### Adding a task

```text
tasks/trail-benchmark-dev/<name>/
  instruction.md                 the prompt, nothing about where to put the answer
  task.toml                      [task] metadata, then a block identical across tasks
  .gitignore                     identical across tasks: ignores the staged environment/
  tests/test.sh                  identical across tasks: runs the shared grader
  tests/expected.json            the reference answer
  solution/solve.sh              a reference solution, run by the oracle
```

Everything in `task.toml` after the `[task]` table, plus `.gitignore` and `tests/test.sh`,
is identical across tasks; a unit test checks that they stay that way and that
`expected.json` is well formed. Write the solution, run `make harbor-stage` so the task
gets its `environment/`, run the oracle on it, and copy the answer it produced into
`expected.json` with a `source` note.

### Adding a condition

A condition is an agent entry in `jobs/trail-benchmark-dev.yaml`. Copy one, change the
class, model, `kwargs`, `env`, or `skills`, and give it a new name. To compare px or
server versions, stage from the other checkout and run under a `--job-name` that says so;
both change the image, not the dataset, so the experiments land side by side on the same
dataset version.

Skills go in the agent's `skills` list as directories that contain `SKILL.md`. Harbor
installs them for Claude Code and Codex and records their digests in the job lock.

### Tests

Unit tests for the verifier and the task layout run from the repository root:

```bash
uv run pytest tests/unit/harbor
```

The oracle run is the integration test for tasks, verifiers, and the environment.

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

## Network allowlists

The task allows nothing by itself; every host is granted at the narrowest level that
needs it, so `task.toml` (and with it the Phoenix dataset version) never changes for a
new provider or operator.

| Level | Set in | Applies to | Used for |
| --- | --- | --- | --- |
| Task baseline | `[environment]` in `task.toml` | the whole trial | nothing: `network_mode = "allowlist"` with no hosts |
| Verifier phase | `[verifier]` in `task.toml` | verification only | the judge's provider: the TRAIL tasks allow `api.anthropic.com`; error-analysis runs `network_mode = "public"` |
| Job environment | `environment.extra_allowed_hosts` in the job file, or `--allow-environment-host` | the whole trial, every agent | the Phoenix docs hosts and `downloads.claude.ai`, where Harbor installs Claude Code at trial start |
| Agent | `extra_allowed_hosts` on an agent entry, or `--allow-agent-host` | that agent's run only | the agent's LLM provider |

The job file grants the docs hosts and each agent's provider host; delete them there for
a sealed run. Agent-level hosts are not in effect during agent install, so anything an
agent installs at that point must already be in the image, in the upload, or reachable
through a job-environment host.
