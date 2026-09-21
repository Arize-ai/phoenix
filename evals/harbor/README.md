# Harbor evaluations for Phoenix

These benchmarks compare the ways an agent can interact with Phoenix. They run with
[Harbor](https://github.com/laude-institute/harbor), which builds the environment, runs
each agent, and verifies the results. The `arize-phoenix` Harbor plugin records each run
in the configured Phoenix instance as datasets, experiments, scores, and traces. You can
compare the conditions in the Phoenix UI.

| Job file | Question it answers | Tasks | Phoenix dataset |
| --- | --- | --- | --- |
| `jobs/benchmark.yaml` | Can PXI, or Claude Code with the MCP server or px, do a multi-step error analysis? CI runs this. | `tasks/error-analysis` | `pxi-benchmark` |
| `jobs/trail-benchmark-dev.yaml` | Which Phoenix interface (MCP server, px CLI, or PXI) answers the same project questions most accurately, and at what cost? | `tasks/trail-benchmark-dev/*` | `trail-benchmark-dev` |
| `jobs/pxi.yaml` | Does PXI take the right next action on the `evals/pxi` datasets? CI runs the regression split. | `tasks/pxi/*` (generated) | one per dataset |

| Path | Contents |
| --- | --- |
| `agents/` | PXI and the Claude Code or Codex configurations for the MCP server and px |
| `environments/` | The shared Dockerfile and the fixture script for each database |
| `jobs/` | One configuration file for each benchmark |
| `tasks/` | The `error-analysis/` task and the tasks under `trail-benchmark-dev/` |
| `verifiers/` | The reply grader, LLM judge, and reference-solution query helpers |
| `scripts/` | Scripts for staging, building the px archive, selecting job subsets, and checking CI rewards |

## Prerequisites

- Install Python 3.12 or newer and run `pip install "arize-phoenix-client[harbor]"`.
- Install Docker for local runs, or set `DAYTONA_API_KEY` to use Daytona. Local Docker
  must support Harbor's allowlist network policy. Recent Docker Desktop versions support
  this policy. Harbor stops the run if the Docker installation does not support it.
- Set `ANTHROPIC_API_KEY` for the Claude conditions. Set `OPENAI_API_KEY` for the Codex
  conditions and the TRAIL judge.
- To run the TRAIL benchmark, use a Hugging Face token for an account that has accepted
  the terms of
  [PatronusAI/TRAIL](https://huggingface.co/datasets/PatronusAI/TRAIL). TRAIL is gated
  and cannot be redistributed. Seed the database with your own token, and do not commit
  or upload the dataset or generated fixture. Without a token, staging skips the TRAIL
  tasks. CI does not set this token.

## Run a benchmark

### 1. Stage the tasks

From the repository root, stage the tasks before you run a benchmark. Staging builds the
Phoenix wheel, creates the fixture databases and task build contexts, and builds the px
archive for the CLI agents:

```bash
# Stage error-analysis only.
make harbor-stage
# Also seed the TRAIL fixture and stage its tasks.
HF_TOKEN=... make harbor-stage
```

The px archive requires Docker and takes a few minutes to build. If the job has no CLI
agent, set `HARBOR_CLI=0` to skip the archive. Use `HARBOR_CLI_PLATFORM` to change the
target from `linux/amd64`. Restage after changing the server, `verifiers/`,
`environments/`, or a fixture because the image contains copies of these files.
`RESEED=1` also rebuilds the fixtures. `make harbor-run` refuses to start a job whose
tasks are not staged.

### 2. Run a job

Run a job file after staging. `HARBOR_JOB` selects the file, and `HARBOR_ARGS` passes
arguments to `harbor run`:

```bash
# Run the PXI benchmark as CI runs it.
make harbor-run
# Run one attempt with local Docker.
make harbor-run HARBOR_ARGS='-e docker -k 1'
make harbor-run HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml HARBOR_ARGS='-e docker'
make harbor-run HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml HARBOR_ARGS='-a oracle -e docker'
make harbor-run HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml HARBOR_ARGS='-e docker -k 3 --job-name px-1.19'
```

`-a oracle` runs each task's reference solution through its verifier with no agent and
no model calls. Run it after changing a task, a fixture, or the verifiers. A reward of 1
everywhere means the environment starts, the queries work, and each reference answer
passes its grader. It does not verify that the grader rejects incorrect answers.

To run a subset of conditions or tasks, create a reduced copy of the job file and set
`HARBOR_JOB` to its path. Do not use `-a <agent>` to select an existing condition. This
option replaces the configured agents with a minimal agent entry and removes the MCP
servers, environment, and skills that define the condition.

```bash
uv run --script evals/harbor/scripts/subset_job.py evals/harbor/jobs/trail-benchmark-dev.yaml \
  --agents claude-code-mcp codex-cli --tasks count-traces total-cost --out evals/harbor/.cache/subset.yaml
make harbor-run HARBOR_JOB=evals/harbor/.cache/subset.yaml HARBOR_ARGS='-e docker'
```

### Results

The plugin reads `PHOENIX_COLLECTOR_ENDPOINT` and `PHOENIX_API_KEY` from the environment.
A local Phoenix instance on the default port needs neither variable. If the plugin cannot
reach Phoenix, the job fails before any trial starts.

The plugin records one experiment per condition on the dataset in the table above. Every
copy of `trail-benchmark-dev.yaml` records to `trail-benchmark-dev`, so subset and full
runs use the same dataset. Set `HARBOR_DATASET=<name>` to select another dataset. Set
`HARBOR_PLUGIN=` to run without recording results in Phoenix.

Each run includes `reward` and the other verifier measurements. The TRAIL verifier
adds `tool_call_count` and `agent_turn_count`, which do not affect the reward. The plugin
adds Harbor's token counts, cost, and latency, an `infra_ok` score that is `0` when
Harbor reports an exception, and the agent's full trace. Run `make harbor-view` to open
Harbor's results viewer.

## Benchmark conditions

Every agent in a job uses the same image and verifiers. The reward scores therefore
compare the Phoenix interfaces under the same test conditions.

| Agent | Runs | Reaches Phoenix through |
| --- | --- | --- |
| `phoenix-chat-agent` | PXI inside the Phoenix server | The agent session chat route |
| `claude-code-mcp` | Claude Code | The remote MCP server at `/mcp` |
| `claude-code-cli` | Claude Code | `px`, built from this checkout, plus the public `phoenix-cli` skill |
| `codex-mcp` | Codex | The remote MCP server |
| `codex-cli` | Codex | The same px install and skill |
| `oracle` | No agent | Each task's `solution/solve.sh`, run with `-a oracle` |

The agent phase runs as an unprivileged user that cannot open `/data/phoenix.db`. Agents
must access the data through Phoenix. PXI runs inside the server and uses the server's
database access. This difference is part of the PXI condition.

Claude Code uses the Anthropic API, and Codex uses the OpenAI API. The job file therefore
sets a model for each agent. Harbor installs Claude Code when the trial starts. The image
contains the Codex version pinned in the job file. The CLI agents access Phoenix only
through `px`. PXI is a separate condition and is not available to the other agents.

## The TRAIL benchmark

The TRAIL benchmark contains questions about the `research-assistant` project. Each
condition answers every question in its final reply, and the verifier grades that reply.

The `tests/expected.json` file in each task selects one of two grading methods:

```json
{"exact": "ok", "source": "fixed reply requested by the instruction"}
{"reference": "117 traces", "notes": "...", "source": "solution/solve.sh against the seeded fixture"}
```

`exact` compares the reply with a fixed string and ignores Markdown emphasis, letter case,
and final punctuation. `reference` asks an LLM judge whether the reply gives the same
answer as the reference. Different wording, additional correct context, and rounding to
the reference precision are acceptable. A different value, multiple candidate answers,
or an answer to a different question fails. `notes` provides extra guidance to the judge,
such as "page_down is the same tool." `source` records how the reference value was
derived.

The judge uses a `phoenix.evals` classifier with `gpt-5-nano`. Set
`PHOENIX_EVAL_JUDGE_MODEL` and `PHOENIX_EVAL_JUDGE_PROVIDER` to use another model. Add
the provider host to the task's `[verifier]` table.

### Add a task

```text
tasks/trail-benchmark-dev/<name>/
  instruction.md                 the question, and nothing about where to put the answer
  task.toml                      [task] name and description, then a shared block
  .gitignore                     identical across tasks
  tests/test.sh                  identical across tasks
  tests/expected.json            the reference answer
  solution/solve.sh              a reference solution, run by the oracle
```

Copy an existing task and change `instruction.md`, the `[task]` table, the solution,
and `expected.json`. A unit test checks that the shared files stay identical and that
`expected.json` is well formed.

Write a solution that calculates the reference value from the running Phoenix instance.
Use `evals.harbor.verifiers.phoenix_api` to read spans and annotations through the Phoenix
client and per-span costs through GraphQL. Stage the task, run the oracle, and copy its
answer into `expected.json`. Use `source` to describe how the solution calculated the
answer.

For a task that changes Phoenix state instead of answering a question, write a custom
`test.sh`. Query Phoenix at `http://127.0.0.1:6006` or read `/data/phoenix.db`. The
verifier runs as root. Calculate the reward, and call
`evals.harbor.verifiers.verify.write_reward(reward, **extra)` to include the trajectory
measurements.

### Add a condition

A condition is an agent entry in `jobs/trail-benchmark-dev.yaml`. Copy one, change the
class, model, `kwargs`, `env`, or `skills`, and give it a new name. Skills are directories
containing `SKILL.md`; Harbor installs them for Claude Code and Codex.

To compare px or server versions, stage the tasks from the other checkout and use
`--job-name` to identify the version. This process changes the image but not the dataset,
so both experiments use the same dataset version.

### Run the tests

```bash
uv run pytest tests/unit/harbor
```

Use an oracle run to test the task environment, reference solutions, and verifiers
together.

## The PXI benchmark

`tasks/error-analysis` is a two-step scenario on a hand-prepared database. The agent
open-codes a project's traces into notes, then axial-codes them into per-dimension
annotation configurations. Its verifier lives with the task under `tests/` and reads the
database and the agent's sidecars directly. `jobs/benchmark.yaml` runs it with two
attempts on Daytona. In CI, `.github/workflows/harbor-evals.yml` checks the reward with
`scripts/check_job_reward.py`.

To replace its fixture, upload the new database and restage:

```bash
gcloud storage cp --cache-control=no-store phoenix.db \
  gs://arize-phoenix-assets/evals/harbor/error-analysis/phoenix.db
RESEED=1 make harbor-stage HARBOR_CLI=0
```

## The PXI eval datasets

`jobs/pxi.yaml` runs the datasets under `evals/pxi/datasets/` through the agent session
chat route. Each dataset becomes one multi-step task under `tasks/pxi/`, and each example
becomes a step. `harbor-stage` generates the tasks with `evals.harbor.pxi.generate_tasks`;
they are not committed because the YAML files are the source of truth.

Every step seeds a fresh session with the example's primed transcript, runs one turn, and
verifies it:

1. `PxiEvalAgent` runs `evals.harbor.pxi.seed` as root. The seeder compiles the example
   with the harness's fixture compiler, gives the active user turn the metadata the
   browser would attach, and writes the session and its messages to the database. A
   transcript that ends with a completed tool result is stored with that call pending.
2. The chat client continues the session with `headless: false`, so the browser tools
   are available, and either posts the final user message or submits the stored call's
   output as `toolOutputs`, the way the browser answers a client-executed tool. The turn
   ends when the server stops streaming: the model replied, called a client-executed
   tool, or asked for approval. Nothing answers those calls, so each step scores the
   next action like the pytest harness does.
3. `evals.harbor.pxi.verify` reads the transcript back, drops the seeded prefix, and runs
   the evaluators the dataset declares over the new tool calls and text. The reward is 1
   when every evaluator passes, and each evaluator's score is written beside it.

Two differences from the pytest harness: the server and database are real, so `bash` and
`execute` calls run against the empty fixture instead of ending the turn, and
per-`(dataset, evaluator, split)` thresholds from `evals/pxi/thresholds.yaml` are not
applied. Harbor reports the mean step reward per task.

```bash
# Stage a subset while iterating: two datasets, three examples each.
HARBOR_PXI_ARGS="--datasets set_spans_filter in_app_links --limit 3" HARBOR_CLI=0 make harbor-stage
make harbor-run HARBOR_JOB=evals/harbor/jobs/pxi.yaml HARBOR_ARGS='-e docker -k 1'
# Stage every dataset.
HARBOR_CLI=0 make harbor-stage
```

The job records to a dataset per task directory name, such as `set_spans_filter`. Set
`HARBOR_PLUGIN=` to run without a Phoenix instance to record to.

`.github/workflows/pxi-evals.yml` runs the regression split of every dataset on Daytona
for pull requests that touch the evals or the agent, and gates on the mean step reward
with `scripts/check_job_reward.py`. The pytest harness under `evals/pxi` no longer runs
in CI; `pytest evals/pxi -c evals/pxi/pytest.ini` still runs it locally.

## Test an unreleased client plugin

Build the client wheel and use it in the Harbor environment instead of the pinned release:

```bash
uv build --wheel packages/phoenix-client
CLIENT_WHEEL=$(ls dist/arize_phoenix_client-*.whl)
PYTHONPATH=. uvx --python 3.13 --from 'harbor[daytona]==0.21.0' --with "$CLIENT_WHEEL" \
  harbor run -c evals/harbor/jobs/benchmark.yaml -e docker -k 1 \
  --plugin arize-phoenix --plugin-kwarg dataset=pxi-benchmark --yes
```

## Name experiments

The plugin creates one experiment per agent configuration, named
`{job.name} · {agent.name} · {agent.model}` by default. To rename them, pass a template
through `HARBOR_ARGS`:

```bash
make harbor-run HARBOR_ARGS="--plugin-kwarg 'experiment_name_template={job.name} · {agent.name}'"
```

| Field | Value |
| --- | --- |
| `{job.name}` | Harbor job name, or the job ID if no name is set |
| `{job.id}` | Unique Harbor job ID |
| `{dataset.name}` | Phoenix dataset name |
| `{agent.name}` | Harbor agent name |
| `{agent.model}` | Configured model name, or `default` |
| `{agent.short_digest}` | First 12 characters of the agent configuration digest |

You can use standard format specifications with the string fields.
`phoenix.client.harbor.EXPERIMENT_NAME_TEMPLATE_FIELDS` lists the fields in Python. A job
with one agent can use a literal `experiment_name=...` instead.

The plugin identifies an experiment by job ID, dataset version, and agent configuration
digest, not by name. Two jobs can share a name without being merged. To distinguish the
jobs in Phoenix, include `{job.name}` or `{job.id}` in the experiment name.

## Configure network allowlists

By default, a task allows no external hosts. Add each host at the narrowest level that
requires it. This approach prevents a new provider from changing `task.toml` and its
dataset version.

| Level | Set in | Applies to | Used for |
| --- | --- | --- | --- |
| Task | `[environment]` in `task.toml` | the whole trial | nothing |
| Verifier | `[verifier]` in `task.toml` | verification only | the judge's provider |
| Job | `environment.extra_allowed_hosts` in the job file | every agent in the job | the Phoenix docs hosts and `downloads.claude.ai` for the Claude Code install |
| Agent | `extra_allowed_hosts` on an agent entry | that agent's run | the agent's LLM provider |

For a sealed run, remove the allowed hosts from the job and agent configurations. Agent
hosts do not apply during installation. Installation dependencies must already be in the
image or uploaded files, or they must be accessible through a job-level host.
