# Harbor evaluations for Phoenix

Harbor tasks and tooling for evaluating agents against Phoenix. Harbor runs the agents
and the verifiers; the `arize-phoenix` Harbor plugin writes every run to a Phoenix of
your choice as versioned datasets, experiments, scores, and ATIF traces.

Two benchmarks live here and share the tooling:

| Job file | What it measures | Tasks | Phoenix dataset |
| --- | --- | --- | --- |
| `jobs/benchmark.yaml` | PXI, and Claude Code with the MCP server or the px CLI, on a multi-step error-analysis scenario | `tasks/error-analysis` | `pxi-benchmark` |
| `jobs/phoenix-tools-dev.yaml` | Every surface an agent can use to reach Phoenix (MCP server, px CLI, PXI) on the same questions about one seeded project | `tasks/phoenix-tools-dev/*` | `phoenix-tools-dev` |
| `jobs/phoenix-tools-test.yaml` | The same, on the held-out split | `tasks/phoenix-tools-test/*` | `phoenix-tools-test` |

```text
agents/             Harbor agents: PXI through the chat route, Claude Code and Codex with MCP or px
container_assets/   The Phoenix start script every task image carries
environment/        The shared Dockerfile of the tool benchmark; staging fills it in
jobs/               One job file per benchmark; a run is a job file
lib/                Grading helpers for the tool benchmark verifiers (pure Python, unit-tested)
scripts/            Staging, seeding, the px CLI archive, CI gates, job subsets
tasks/              error-analysis/, phoenix-tools-dev/<task>/, phoenix-tools-test/<task>/
```

## Run

Install the Phoenix client with its Harbor integration on Python 3.12 or newer:

```bash
pip install "arize-phoenix-client[harbor]"
```

Build Phoenix and stage each task's build context (from the repository root): the
wheel, the container assets, and the task's fixture database. The same command builds
the px CLI archive the CLI agents install. The CLI is built from source and assembled
with its production dependencies in a Docker container into
`dist/phoenix-cli/phoenix-cli.tar.gz`, outside every build context, so the CLI agents
test the checkout's CLI without exposing it to the other agents.

```bash
make harbor-stage
```

The archive step needs Docker and takes a few minutes; `HARBOR_CLI=0` skips it when no
run needs a CLI agent. It targets `linux/amd64` by default; set `HARBOR_CLI_PLATFORM` to
match the trial environment on another architecture. The tool benchmark tasks are
staged only once their database is seeded (see [Phoenix tool benchmark](#phoenix-tool-benchmark));
until then `make harbor-stage` skips them and says so.

Each task keeps its grading material under `tests/`, which Harbor uploads only when the
verifier runs, so the agent never sees the ground truth or the checks.

A Harbor job file defines a run: its tasks, agents, environment, attempts, and network
policy. `HARBOR_JOB` picks the file (default `jobs/benchmark.yaml`, which is what CI
runs), and anything `harbor run` accepts passes through `HARBOR_ARGS` and overrides
the file:

```bash
make harbor-run                                                          # the PXI benchmark, as CI runs it
make harbor-run HARBOR_ARGS='-e docker -k 1'                             # local Docker, one attempt
make harbor-run HARBOR_ARGS='-a oracle -k 1'                             # the oracle: reference solutions through the verifiers, no model calls
make harbor-run HARBOR_JOB=evals/harbor/jobs/phoenix-tools-dev.yaml HARBOR_ARGS='-e docker'
make harbor-run HARBOR_JOB=evals/harbor/jobs/phoenix-tools-dev.yaml HARBOR_ARGS='-e docker -k 3 --job-name px-1.19'
```

`-a` replaces the file's agents but keeps its tasks and environment, so a one-off agent
passed that way needs its own model, hosts, and kwargs on the command line. For anything
more than that, a subset is a copy of the job file with fewer tasks and agents.
`scripts/subset_job.py` writes the copy by name:

```bash
uv run --script evals/harbor/scripts/subset_job.py evals/harbor/jobs/phoenix-tools-dev.yaml \
  --agents claude-code-mcp codex-cli --tasks count-traces total-cost --out evals/harbor/.cache/subset.yaml
make harbor-run HARBOR_JOB=evals/harbor/.cache/subset.yaml HARBOR_ARGS='-e docker'
```

Every run records its tasks, trials, scores, and traces in Phoenix through the
`arize-phoenix` Harbor plugin, which reads `PHOENIX_COLLECTOR_ENDPOINT` and
`PHOENIX_API_KEY` from the environment (a local server on the default port needs neither).
A job file that lists a task directory records to the dataset named after that
directory, so every copy of `phoenix-tools-dev.yaml` lands in `phoenix-tools-dev`; a job
file that lists tasks directly needs a name, and `benchmark.yaml`'s is `pxi-benchmark`.
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
in `evals/harbor/agents/coding_agents.py`. They run with Harbor's default
`bypassPermissions`, matching the chat agent's auto-approved tool calls. Claude Code only
speaks the Anthropic API, so pass an `anthropic/` model; Codex only speaks OpenAI's.
The Claude Code agents in `benchmark.yaml` also run with `--resume-trajectory` so step 2
continues step 1's conversation.

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

The `phoenix-chat-agent` uploads its `chat_client.py` during setup; the task images
contain only the server startup script, wheel, and fixture database (plus the grading
library and the preinstalled coding agents in the tool benchmark image).

The CLI agents upload the complete archive into their own sandbox during install and run
`evals/harbor/agents/install_phoenix_cli.sh` to extract it and link `px` (only `px`:
`pxi` is the PXI condition, not a tool the CLI agents get to delegate to). Only the host
build container accesses npm; the trial needs no npm registry allowance.

To test an unreleased Phoenix client's plugin, build its wheel and put it in the Harbor
environment in place of the pinned release:

```bash
uv build --wheel packages/phoenix-client
CLIENT_WHEEL=$(ls dist/arize_phoenix_client-*.whl)
PYTHONPATH=. uvx --python 3.13 --from 'harbor[daytona]==0.21.0' --with "$CLIENT_WHEEL" \
  harbor run -c evals/harbor/jobs/benchmark.yaml -e docker -k 1 \
  --plugin arize-phoenix --plugin-kwarg dataset=pxi-benchmark --yes
```

## PXI benchmark

`tasks/error-analysis` is a two-step scenario on a hand-prepared fixture: PXI (or a coding
agent) open-codes a project's traces into notes, then axial-codes them into per-dimension
annotation configs. Its image is `tasks/error-analysis/environment/Dockerfile`, its
fixture comes from `gs://arize-phoenix-assets/evals/harbor/error-analysis/phoenix.db` at
staging, and each step's `workdir/setup.sh` starts Phoenix before the agent runs.
`jobs/benchmark.yaml` runs it with two attempts on Daytona; the workflow in
`.github/workflows/harbor-evals.yml` gates on `scripts/check_job_reward.py`.

## Phoenix tool benchmark

Ten questions about one project, each answered by every condition in
`jobs/phoenix-tools-dev.yaml`. Every trial runs in one container built from
`environment/Dockerfile`: a Phoenix from this checkout serving a database pre-seeded with
the [PatronusAI/TRAIL](https://huggingface.co/datasets/PatronusAI/TRAIL) traces and
annotations, Claude Code and Codex at pinned versions, and the grading library. The agent
answers the question in its final reply, and the task's verifier grades that reply while
the Phoenix is still up. The same image runs on local Docker and on Daytona.

### Requirements

- Docker whose Linux VM supports Harbor's allowlist network policy. Recent Docker
  Desktop builds do. Harbor probes the kernel before starting and refuses to run if the
  feature is missing; its docs suggest OrbStack or a Linux host in that case.
- A Hugging Face token with the TRAIL terms accepted, for the one-time seed. TRAIL's
  terms forbid resharing it outside the Hugging Face hub, so the rows stay in a local
  cache and the seeded database goes only into the task build contexts, never to a
  registry or a bucket. On Daytona the built image lives in an auto-snapshot of your
  Daytona organization; treat that like the local Docker image.
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` for the paid conditions, and `DAYTONA_API_KEY`
  for Daytona.

### First time

```bash
HF_TOKEN=... make harbor-seed     # download the TRAIL rows, seed environment/data/phoenix.db
make harbor-stage                 # build the wheel and the px archive, stage every task
make harbor-run HARBOR_JOB=evals/harbor/jobs/phoenix-tools-dev.yaml HARBOR_ARGS='-a oracle -e docker'
```

`make harbor-seed` builds a throwaway image that starts Phoenix from this checkout's
wheel, pushes the TRAIL rows through the repository's loader and the public client,
waits until the API reports every trace and its computed cost, checkpoints the SQLite
write-ahead log, and copies the database out. It reuses the rows and the database once
they exist; pass `RESEED=1` after a change that affects ingestion.

`make harbor-stage` then writes `wheels/`, `lib/`, and `container_assets/` next to the
Dockerfile and copies the whole `environment/` into each tool task with hard links,
because Harbor builds a task's image from that task's own directory and Docker cannot
follow symlinks out of a build context. Each task's `.gitignore` ignores the copy, and
Harbor applies that file when it hashes the task, so staging never changes the dataset
version. The version covers the instruction, the verifier, and the reference solution;
the image is the thing under test. Restage after changing the server, `lib/`,
`container_assets/`, or a pinned agent version. Forgetting it is the most likely way to
get a confusing verifier error, because the verifier imports `lib/` from the image, not
from your checkout.

### Inside a trial

Harbor starts the container with its own keepalive command and then runs the task's
`[environment.healthcheck]`, which is `container_assets/start_phoenix_server.sh`. The
script is idempotent: it starts Phoenix on `/data/phoenix.db` if nothing answers on port
6006 and waits until it does. Running Phoenix from the healthcheck rather than the image
entrypoint works the same on Docker and Daytona, and Harbor does not begin agent setup
until it passes.

Claude Code and Codex are preinstalled in the image at the versions the job file pins,
so Harbor verifies them and skips its own install. The Codex installer fetches nvm from
GitHub, which the allowlist blocks, and the trial needs no download hosts this way. Only
the CLI agents get px, uploaded at install time; the MCP agents and PXI never see it.
The web search and fetch tools are disabled for both coding agents. Every condition
sees the same instruction; there is no per-condition hint text.

Verification runs in Harbor's shared mode. After the agent finishes, Harbor uploads the
agent's log directory, including the ATIF `trajectory.json`, and the task's `tests/` into
the container, and runs `test.sh` there with Phoenix still up. The grader reads the
agent's final reply from `/logs/agent/trajectory.json`. The oracle runs a solution script
instead of an agent and so has no trajectory; it writes `/app/answer.txt`, which the
grader reads only when no trajectory exists.

### What lands in Phoenix

- One dataset per split, versioned by the selected task content. Runs share a dataset
  version only when they select the same tasks.
- One experiment per condition and job name.
- On each run, Harbor's token counts, cost, and latency, an `infra_ok` evaluation that
  is `0` when Harbor recorded any exception, and the agent's ATIF trace.
- From the verifier, `reward` (0 or 1), `tool_call_count`, and `agent_turn_count`. The
  two counts come from the ATIF trajectory. The oracle has no trajectory, so its runs
  omit them.

`reward` is the final correctness score. Tool-call and turn counts are separate
efficiency measurements and do not change it. Phoenix records these values but does not
combine or recalculate them.

### Adding a task

```text
tasks/phoenix-tools-dev/<name>/
  instruction.md                 the prompt, nothing about where to put the answer
  task.toml                      [task] metadata, then a block identical across tasks
  .gitignore                     identical across tasks: ignores the staged environment/
  tests/test.sh                  the verifier entry point
  tests/expected.json            the reference, for answer tasks
  solution/solve.sh              a reference solution, run by the oracle
```

Reference solutions in Python import `evals.harbor.lib.phoenix_query` from
`/opt/verifier`, which reads a project's spans through the GraphQL route. Everything in
`task.toml` after the `[task]` table, plus `.gitignore` and `tests/test.sh`, is identical
across tasks; a unit test checks that they stay that way. Run `make harbor-stage` after
adding a task so it gets its `environment/`.

For a question with a checkable answer, `test.sh` calls the shared grader and
`expected.json` defines the comparison. These are the supported forms:

```json
{"kind": "integer", "value": 117, "aliases": ["traces"]}
{"kind": "number", "value": 16.0022, "places": 2, "aliases": ["cost", "total"]}
{"kind": "number", "value": [45.32, 43.05], "places": 1}
{"kind": "labeled_number", "places": 1, "labels": {"short": {"aliases": ["short", "<15"], "value": 0.79}, "long": {"aliases": ["long", "40+"], "value": 14.61}}}
{"kind": "entity_count", "aliases": ["FinderTool"], "value": 24}
{"kind": "name", "aliases": [["PageDownTool", "page_down"]]}
{"kind": "name", "aliases": [["forward"], ["keyword argument", "TypeError"]], "require_all": true, "allow_hedging": true}
{"kind": "exact", "value": "ok"}
{"kind": "all", "checks": [{"kind": "name", "aliases": [["FinderTool"]]}, {"kind": "integer", "value": 24}]}
```

A value list accepts any listed value unless `require_all` is `true`. The matchers
remove Markdown emphasis and normalize whitespace before comparing. Integer, number,
and name checks reject phrases such as "117 or 118" and "about 117". Name checks can
set `allow_hedging` to skip that rejection. `exact` ignores case and end punctuation.

Replies are graded, not answer files, and a reply often says more than the answer.
Give `integer` and `number` checks `aliases` naming what the value measures: a reply
with a single number is compared directly, and a reply with several must put the
expected value nearest one of those names, in a sentence that names it. That is what
turns "I paged through 117 rows; the project has 118 traces" into a failure while
"3,579 spans across 117 traces" still passes.

`labeled_number` and `entity_count` tie a value to the label or entity it belongs to in
the same way. Use them whenever an answer states more than one number, because a plain
`number` or `integer` check would accept "Short: 14.6%; Long: 0.8%" or
"FinderTool had 20 calls; SearchTool had 24".

Keep a `source` field in `expected.json` that explains how the reference value was
derived, plus `accept` and `reject` lists of example answers. The unit tests grade
every example, so they document the check and catch regressions when the grader
changes. Cover a paraphrase, a wrong value, a hedge, a long reply that states the value
beside other numbers, a reply that mentions the value while answering something else,
and, for multi-number answers, a reversed or mislabelled version.

For a task that changes Phoenix state, write your own `test.sh`: query Phoenix at
`http://127.0.0.1:6006` (the image's Python has the Phoenix client), decide the reward,
and call `evals.harbor.lib.grade.write_reward(reward, **extra)` to attach the ATIF
measurements. The plugin records each extra numeric key as a separate evaluation.

Then run the oracle on the task. It runs `solution/solve.sh` and the verifier with no
model calls, and its answer provides the reference for `expected.json`. A reward of `1`
confirms that the verifier accepts the reference; it does not show that incorrect
answers fail.

### Adding a condition

A condition is an agent entry in `jobs/phoenix-tools-dev.yaml` (and `-test.yaml`). Copy
one, change the class, model, `kwargs`, `env`, or `skills`, and give it a new name. To
compare px or server versions, stage from the other checkout and run under a
`--job-name` that says so; both change the image, not the dataset, so the experiments
land side by side on the same dataset version.

Skills go in the agent's `skills` list as directories that contain `SKILL.md`. Harbor
installs them for Claude Code and Codex and records their digests in the job lock.

### Dev and test splits

`tasks/phoenix-tools-dev` is for iterating on tools, prompts, and skills.
`tasks/phoenix-tools-test` is held out for reporting. Put paraphrases of one question in
the same split, and do not tune against test. Each split is its own Phoenix dataset, so
experiments are only ever compared within a split.

### Tests

Unit tests for the grading library and the task layout run from the repository root:

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
| Verifier phase | `[verifier]` in `task.toml` | verification only | error-analysis runs `network_mode = "public"` so its LLM judge reaches its provider; the tool benchmark grader needs no network and keeps the baseline |
| Job environment | `environment.extra_allowed_hosts` in the job file, or `--allow-environment-host` | the whole trial, every agent | the Phoenix docs hosts, and `downloads.claude.ai` where Harbor installs Claude Code at trial start |
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

The tool benchmark fixture is derived from TRAIL on each developer's machine by
`make harbor-seed` and is never uploaded anywhere. `evals/harbor/.cache/seed-summary.json`
records what the seed produced (117 traces, 3,579 spans in `research-assistant`); the
`source` field of each task's `expected.json` says how its reference value follows.
