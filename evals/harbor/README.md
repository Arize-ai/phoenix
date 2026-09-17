# Harbor evaluations for Phoenix

Benchmarks for the ways an agent can reach Phoenix, run with
[Harbor](https://github.com/laude-institute/harbor). Harbor builds the environment, runs
each agent, and runs the verifier. The `arize-phoenix` Harbor plugin records every run to
a Phoenix of your choice as datasets, experiments, scores, and traces, so conditions
compare in the Phoenix UI.

| Job file | Question it answers | Tasks | Phoenix dataset |
| --- | --- | --- | --- |
| `jobs/benchmark.yaml` | Can PXI, or Claude Code with the MCP server or px, do a multi-step error analysis? CI runs this. | `tasks/error-analysis` | `pxi-benchmark` |
| `jobs/trail-benchmark-dev.yaml` | Which surface (MCP server, px CLI, PXI) answers the same questions about a project best, and at what cost? | `tasks/trail-benchmark-dev/*` | `trail-benchmark-dev` |

```text
agents/          The agents: PXI, and Claude Code or Codex with the MCP server or px
environments/    The Dockerfile every task runs in, and one fixture script per database
jobs/            One job file per benchmark
tasks/           error-analysis/ and trail-benchmark-dev/<task>/
verifiers/       The reply grader, the LLM judge, and the queries the reference solutions use
scripts/         Staging, the px archive, job subsets, the CI reward gate
```

## What you need

- Python 3.12 or newer with `pip install "arize-phoenix-client[harbor]"`.
- Docker for local runs, or `DAYTONA_API_KEY` for Daytona. Local Docker has to support
  Harbor's allowlist network policy. Recent Docker Desktop builds do; Harbor checks and
  refuses to run otherwise.
- `ANTHROPIC_API_KEY` for the Claude conditions and the TRAIL judge, `OPENAI_API_KEY` for
  the Codex conditions.
- For the TRAIL benchmark, a Hugging Face token whose account has accepted the terms of
  [PatronusAI/TRAIL](https://huggingface.co/datasets/PatronusAI/TRAIL). TRAIL is gated
  and cannot be reshared, so every developer seeds the database with their own token, and
  nothing derived from it is committed, uploaded, or pushed. Without a token, staging
  skips the TRAIL tasks. That is what CI does.

## Run a benchmark

Stage first, from the repository root. Staging builds the Phoenix wheel, produces each
fixture database, writes each task's build context, and builds the px archive the CLI
agents install:

```bash
make harbor-stage                 # error-analysis only
HF_TOKEN=... make harbor-stage    # also seeds the TRAIL fixture and stages its tasks
```

The px archive needs Docker and takes a few minutes. `HARBOR_CLI=0` skips it when no run
needs a CLI agent, and `HARBOR_CLI_PLATFORM` changes its target from `linux/amd64`.
Restage after changing the server, `verifiers/`, `environments/`, or a fixture, since the
image carries copies of all of them. `RESEED=1` rebuilds the fixtures too. `make
harbor-run` refuses to start a job whose tasks are not staged.

Then run a job file. `HARBOR_JOB` picks it and `HARBOR_ARGS` passes anything `harbor run`
accepts:

```bash
make harbor-run                                                          # the PXI benchmark, as CI runs it
make harbor-run HARBOR_ARGS='-e docker -k 1'                             # local Docker, one attempt
make harbor-run HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml HARBOR_ARGS='-e docker'
make harbor-run HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml HARBOR_ARGS='-a oracle -e docker'
make harbor-run HARBOR_JOB=evals/harbor/jobs/trail-benchmark-dev.yaml HARBOR_ARGS='-e docker -k 3 --job-name px-1.19'
```

`-a oracle` runs each task's reference solution through its verifier with no agent and
no model calls. Run it after changing a task, a fixture, or the verifiers. A reward of 1
everywhere means the environment starts, the queries work, and each reference answer
passes its own grader. It does not show that wrong answers fail.

To run a few conditions on a few tasks, write a trimmed copy of the job file and point
`HARBOR_JOB` at it. Don't reach for `-a <agent>` for this. It replaces the file's agents
with a bare entry and drops the MCP servers, environment, and skills that make a
condition what it is.

```bash
uv run --script evals/harbor/scripts/subset_job.py evals/harbor/jobs/trail-benchmark-dev.yaml \
  --agents claude-code-mcp codex-cli --tasks count-traces total-cost --out evals/harbor/.cache/subset.yaml
make harbor-run HARBOR_JOB=evals/harbor/.cache/subset.yaml HARBOR_ARGS='-e docker'
```

### Results

The plugin reads `PHOENIX_COLLECTOR_ENDPOINT` and `PHOENIX_API_KEY` from the environment.
A local Phoenix on the default port needs neither. If it cannot reach Phoenix, the job
fails before any trial starts.

Each job lands as one experiment per condition on the dataset in the table above. Every
copy of `trail-benchmark-dev.yaml` records to `trail-benchmark-dev`, so subset runs sit
next to full ones. `HARBOR_DATASET=<name>` picks another dataset and `HARBOR_PLUGIN=`
(empty) runs without recording.

Each run carries `reward` plus whatever else the verifier measured. The TRAIL verifier
adds `tool_call_count` and `agent_turn_count`, which do not affect the reward. The plugin
adds Harbor's token counts, cost, and latency, an `infra_ok` score that is `0` when
Harbor hit an exception, and the agent's full trace. `make harbor-view` opens Harbor's
own results viewer.

## Conditions

Every agent in a job runs against the same image and the same verifiers, so a reward
difference is a difference in the surface.

| Agent | Runs | Reaches Phoenix through |
| --- | --- | --- |
| `phoenix-chat-agent` | PXI inside the Phoenix server | The agent session chat route |
| `claude-code-mcp` | Claude Code | The remote MCP server at `/mcp` |
| `claude-code-cli` | Claude Code | `px`, built from this checkout, plus the public `phoenix-cli` skill |
| `codex-mcp` | Codex | The remote MCP server |
| `codex-cli` | Codex | The same px install and skill |
| `oracle` | nothing | Each task's `solution/solve.sh`, run with `-a oracle` |

The agent phase runs as an unprivileged user that cannot open `/data/phoenix.db`, so the
only way to the data is through Phoenix. PXI runs inside the server and has the server's
access. That is the condition being measured.

Claude Code only speaks the Anthropic API and Codex only speaks OpenAI's, so the job
file's models are per agent. Harbor installs Claude Code at trial start; Codex is baked
into the image at the version the job file pins. The CLI agents get `px` only. `pxi` is a
condition of its own, not a tool for the other agents to delegate to.

## The TRAIL benchmark

Ten questions about one project of TRAIL traces, `research-assistant`. Each condition
answers every question in its final reply, and the verifier grades that reply.

`tests/expected.json` in each task says how:

```json
{"exact": "ok", "source": "fixed reply requested by the instruction"}
{"reference": "117 traces", "notes": "...", "source": "solution/solve.sh against the seeded fixture"}
```

`exact` compares the reply to a fixed string, ignoring Markdown emphasis, case, and end
punctuation. `reference` asks an LLM judge whether the reply commits to the same final
answer as the reference. Wording, extra correct context, and rounding to the reference's
precision pass. A different value, hedging between candidates, or answering a different
question fails. `notes` is extra guidance for the judge, such as "page_down is the same
tool". `source` records where the reference value came from.

The judge is a `phoenix.evals` classifier on `claude-haiku-4-5`. Set
`PHOENIX_EVAL_JUDGE_MODEL` and `PHOENIX_EVAL_JUDGE_PROVIDER` to change it, and allow the
new provider's host in the task's `[verifier]` table.

### Adding a task

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

The solution is the derivation of the reference value. Write it against the live Phoenix
using `evals.harbor.verifiers.phoenix_api`, which reads spans and annotations through
the Phoenix client and per-span cost through GraphQL. Then stage, run the oracle on the
task, and copy the answer it produced into `expected.json` with a `source` note.

A task that changes Phoenix state instead of answering a question writes its own
`test.sh`. Query Phoenix at `http://127.0.0.1:6006` or read `/data/phoenix.db` (the
verifier runs as root), decide the reward, and call
`evals.harbor.verifiers.verify.write_reward(reward, **extra)` so the trajectory
measurements come along.

### Adding a condition

A condition is an agent entry in `jobs/trail-benchmark-dev.yaml`. Copy one, change the
class, model, `kwargs`, `env`, or `skills`, and give it a new name. Skills are directories
containing `SKILL.md`; Harbor installs them for Claude Code and Codex.

To compare px or server versions, stage from the other checkout and run with a
`--job-name` that says which. Both change the image, not the dataset, so the experiments
land side by side on the same dataset version.

### Tests

```bash
uv run pytest tests/unit/harbor
```

The oracle run is the integration test.

## The PXI benchmark

`tasks/error-analysis` is a two-step scenario on a hand-prepared database. The agent
open-codes a project's traces into notes, then axial-codes them into per-dimension
annotation configs. Its verifier lives with the task under `tests/` and reads the database
and the agent's sidecars directly. `jobs/benchmark.yaml` runs it with two attempts on
Daytona, and `.github/workflows/harbor-evals.yml` gates on `scripts/check_job_reward.py`.

To replace its fixture, upload the new database and restage:

```bash
gcloud storage cp --cache-control=no-store phoenix.db \
  gs://arize-phoenix-assets/evals/harbor/error-analysis/phoenix.db
RESEED=1 make harbor-stage HARBOR_CLI=0
```

## Testing an unreleased client plugin

Build the client wheel and put it in the Harbor environment in place of the pinned
release:

```bash
uv build --wheel packages/phoenix-client
CLIENT_WHEEL=$(ls dist/arize_phoenix_client-*.whl)
PYTHONPATH=. uvx --python 3.13 --from 'harbor[daytona]==0.21.0' --with "$CLIENT_WHEEL" \
  harbor run -c evals/harbor/jobs/benchmark.yaml -e docker -k 1 \
  --plugin arize-phoenix --plugin-kwarg dataset=pxi-benchmark --yes
```

## Experiment names

The plugin creates one experiment per agent configuration, named
`{job.name} · {agent.name} · {agent.model}` by default. To rename them, pass a template
through `HARBOR_ARGS`:

```bash
make harbor-run HARBOR_ARGS="--plugin-kwarg 'experiment_name_template={job.name} · {agent.name}'"
```

| Field | Value |
| --- | --- |
| `{job.name}` | Harbor job name, falling back to the job ID |
| `{job.id}` | Unique Harbor job ID |
| `{dataset.name}` | Phoenix dataset name |
| `{agent.name}` | Harbor agent name |
| `{agent.model}` | Configured model name, or `default` |
| `{agent.short_digest}` | First twelve characters of the agent configuration digest |

Standard format specifications work for the string fields, and
`phoenix.client.harbor.EXPERIMENT_NAME_TEMPLATE_FIELDS` lists them from Python. A job
with one agent can pass a literal `experiment_name=...` instead.

The plugin identifies an experiment by job ID, dataset version, and agent configuration
digest, not by name. Two jobs can share a name without being merged. Include `{job.name}`
or `{job.id}` when they should also be easy to tell apart in Phoenix.

## Network allowlists

A task allows nothing by itself. Every host is granted at the narrowest level that needs
it, so `task.toml`, and with it the dataset version, never changes for a new provider.

| Level | Set in | Applies to | Used for |
| --- | --- | --- | --- |
| Task | `[environment]` in `task.toml` | the whole trial | nothing |
| Verifier | `[verifier]` in `task.toml` | verification only | the judge's provider |
| Job | `environment.extra_allowed_hosts` in the job file | every agent in the job | the Phoenix docs hosts and `downloads.claude.ai` for the Claude Code install |
| Agent | `extra_allowed_hosts` on an agent entry | that agent's run | the agent's LLM provider |

Delete the job and agent hosts for a sealed run. Agent hosts are not in effect during
agent install, so anything an agent installs then must already be in the image, in the
upload, or reachable through a job-level host.
