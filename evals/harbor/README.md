# Harbor evaluations for Phoenix

Harbor tasks and tooling for evaluating agents against Phoenix. Harbor runs the agents
and the verifiers. The `arize-phoenix` Harbor plugin writes the results to a Phoenix of
your choice as versioned datasets, experiments, scores, and ATIF traces.

Two things live here. The Phoenix tool benchmark, documented first, compares coding
agents that reach Phoenix through the MCP server, the `px` CLI, or skills. The PXI
headless-agent task in `tasks/regression-triage` is the original multi-step Harbor task
for Phoenix's in-app agent, documented at the end.

## Phoenix tool benchmark

A trial starts two containers. One is a fresh Phoenix already seeded with the
[PatronusAI/TRAIL](https://huggingface.co/datasets/PatronusAI/TRAIL) traces and
annotations. The other holds Claude Code, Codex, and `px`. The agent answers a
question or changes Phoenix state, and the task's verifier grades the result while
that Phoenix is still up. The plugin then records the trial in whichever Phoenix you
point it at.

```text
conditions/           One Harbor job file per condition (agent x interface x versions)
environment/          Dockerfiles, the shared compose file, and the seed script
lib/                  Grading helpers used by task verifiers (pure Python, unit-tested)
scripts/              TRAIL download and image build
tasks/dev/<task>/     Development tasks: instruction, task.toml, tests/, solution/
tasks/test/<task>/    Held-out tasks, same layout (empty until needed)
```

### Requirements

- Docker whose Linux VM supports Harbor's allowlist network policy. Recent Docker
  Desktop builds do. Harbor probes the kernel before starting and refuses to run if the
  feature is missing, and its docs suggest OrbStack or a Linux host in that case.
- `uv`. The launcher gets its own Python 3.13 environment under `.venv/` here on first
  use, because Harbor needs Python 3.12 or newer and the repository runs on 3.10.
- A Hugging Face token with the TRAIL terms accepted, for the one-time seed download.
  TRAIL's terms forbid resharing it outside the Hugging Face hub. The download stays in
  a local cache, and a seeded image must never be pushed to a registry.
- A running Phoenix to receive results. The plugin reads `PHOENIX_COLLECTOR_ENDPOINT`
  and `PHOENIX_API_KEY` and defaults to `http://localhost:6006`.
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` for the coding-agent conditions.

### First time

```sh
HF_TOKEN=... make harbor-seed     # download TRAIL rows to evals/harbor/.cache
make harbor-images                # build the Phoenix image and the two agent images, tagged :local
make harbor-bench-oracle          # run every reference solution through the verifiers
```

`make harbor-images` builds the Phoenix image from this checkout, uncommitted changes
included, and seeds it during the build. A throwaway server starts inside a Dockerfile
stage, the repository's TRAIL loader pushes the rows through the public client, the
build waits until the API reports every trace and its computed cost, and the database
ships in the image. Rebuild that image whenever the server changes.

Rebuild the agent images with `make harbor-images IMAGES=agent` whenever `lib/` or the
pinned tool versions change. It takes seconds. Forgetting it is the most likely way to
get a confusing verifier error, because the verifier imports `lib/` from the image, not
from your checkout.

### Every run

```sh
make harbor-bench CONDITION=claude-mcp                      # whole dev split, one attempt
make harbor-bench CONDITION=codex-cli TASKS="count-traces total-cost" REPS=3
make harbor-bench CONDITION=claude-cli SPLIT=test NAME=cli-1.18.2-candidate
```

| Variable | Meaning | Default |
| --- | --- | --- |
| `CONDITION` | file under `conditions/` without `.yaml` | `claude-mcp` |
| `SPLIT` | task directory under `tasks/`; also names the Phoenix dataset `phoenix-tools-<split>` | `dev` |
| `TASKS` | space-separated task names to include | all in the split |
| `REPS` | attempts per task | `1` |
| `NAME` | Phoenix experiment name and Harbor job name; a new name starts a new experiment | `<condition>-<timestamp>` |

Each invocation is one Harbor job and one Phoenix experiment. To run several
conditions, invoke the target several times. The target prints the underlying
`harbor run` command, so you can also call `evals/harbor/.venv/bin/harbor` directly
with any other Harbor flags.

### What lands in Phoenix

- One dataset per split, versioned by task content. Every condition runs the same task
  files, so all conditions share a dataset version and their experiments compare
  directly.
- One experiment per run, named by `NAME`.
- On each run, Harbor's token counts, cost, and latency, an `infra_ok` evaluation that
  is `0` when Harbor recorded any exception, and the agent's ATIF trace.
- From the verifier, `reward` (0 or 1), `tool_call_count`, and `agent_turn_count`. The
  two counts come from the ATIF trajectory. The oracle has no trajectory, so its runs
  omit them.

### Inside a trial

`environment/docker-compose.yaml` adds a `phoenix` service beside Harbor's `main`
service. Every task sets Harbor's allowlist network policy with only the LLM provider
hosts allowed, so an agent cannot fetch documentation or read GitHub during a trial.
Harbor enforces the policy by putting every service in one network namespace. That is
why the agent reaches Phoenix at `http://127.0.0.1:6006` and the MCP server at
`http://127.0.0.1:6006/mcp` rather than by service name, and why `PHOENIX_ENDPOINT`
points `px` at localhost. The condition files disable web search and fetch tools. If a
teammate's Docker cannot run the allowlist, the fallback would be a task compose file
with an internal network and an allowlisting proxy. Nobody has needed it yet, so it does
not exist.

There are two agent images. `phoenix-bench-agent` keeps `px` under `/opt/px`, off
`PATH`, so MCP conditions never see it. `phoenix-bench-agent-cli` is the same image with
`px` symlinked onto `PATH`; CLI conditions select it through the
`conditions/images/cli.yaml` compose overlay. Setting `PATH` through the agent's `env`
does not reach Codex's shells, which is why the image differs rather than the
environment. The verifier toolchain, a venv with the Phoenix client plus `lib/`, lives
under `/opt/verifier` in both images and is never on `PATH`.

Verification runs in Harbor's shared mode. After the agent finishes, Harbor copies the
task's `tests/` to `/tests` in the agent container and runs `test.sh` there with Phoenix
still up. A verifier can read `/workspace/answer.txt`, query Phoenix over HTTP, or
both. The alternative, an offline verifier container, would lose access to the Phoenix
the agent just changed, which is the whole point for state-changing tasks.

### Adding a task

```text
tasks/dev/<name>/
  instruction.md                 the prompt; end with the answer-file sentence for answer tasks
  task.toml                      copy from an existing task (network policy, image, timeouts)
  environment/docker-compose.yaml -> ../../../../environment/docker-compose.yaml (symlink)
  tests/test.sh                  the verifier entry point
  tests/expected.json            the reference, for answer tasks
  solution/solve.sh              a reference solution through px, run by the oracle
```

For a question with a checkable answer, `test.sh` is one line that calls the shared
grader, and `expected.json` says how to compare. The supported kinds:

```json
{"kind": "integer", "value": 117}
{"kind": "number", "value": 16.0022, "places": 2}
{"kind": "number", "value": [45.32, 43.05], "places": 1}                 // any listed value
{"kind": "number", "value": [0.79, 14.61], "places": 1, "require_all": true}
{"kind": "name", "aliases": [["PageDownTool", "page_down"]]}
{"kind": "name", "aliases": [["forward"], ["unexpected", "unsupported"]], "require_all": true, "allow_hedging": true}
{"kind": "exact", "value": "ok"}
{"kind": "all", "checks": [{"kind": "name", "aliases": [["FinderTool"]]}, {"kind": "integer", "value": 24}]}
```

An answer that hedges between candidates, such as "117 or 118" or "about 117", fails
unless `allow_hedging` is set. Keep a `source` field in `expected.json` that says how
the value was derived.

For a task that changes Phoenix state, write your own `test.sh`. The verifier venv has
`phoenix.client`, so query Phoenix at `http://127.0.0.1:6006`, decide the reward, and
call `evals.harbor.lib.grade.write_reward(reward, **extra)` so the standard
measurements are attached. Every finite numeric key you pass becomes an evaluation.

Then run `make harbor-bench-oracle TASKS=<name>`. The oracle runs `solution/solve.sh`
and the verifier with no model calls. Its answer is the reference to record in
`expected.json`, and a reward of `1` confirms the verifier accepts it.

### Adding a condition

A condition is a Harbor job file. Copy one from `conditions/`, change the agent,
model, MCP servers, `env`, or `skills`, and commit it. To compare server or CLI
versions, build a second image pair with `make harbor-images TAG=candidate` from the
candidate checkout, then point a condition at those images with a compose overlay:

```yaml
environment:
  extra_docker_compose:
    - evals/harbor/conditions/images/candidate.yaml
```

```yaml
# conditions/images/candidate.yaml
services:
  main: { image: phoenix-bench-agent-cli:candidate }   # or phoenix-bench-agent for an MCP condition
  phoenix: { image: phoenix-bench-phoenix:candidate }
```

A condition can list several overlays. Later files win, so a CLI condition that
compares versions lists `images/cli.yaml` first and its candidate overlay second.

Skills go in the agent's `skills` list as directories that contain `SKILL.md`. Harbor
installs them for both agents and records their digests in the job lock.

### Dev and test splits

`tasks/dev` is for iterating on tools, prompts, and skills. `tasks/test` is held out
for reporting. Put paraphrases of one question in the same split, and do not tune
against test. Each split is its own Phoenix dataset, so experiments are only ever
compared within a split.

### Tests

Unit tests for the grading library run from the repository root:

```sh
uv run pytest tests/unit/harbor
```

The oracle run is the integration test for tasks, verifiers, and the environment.

## Phoenix headless agent task (regression-triage)

### Run

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

### Experiment names

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

Both trial targets accept overrides, e.g.:

```bash
make harbor-run HARBOR_TASK=evals/harbor/tasks/regression-triage \
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

### Publish fixtures

```bash
make harbor-publish-fixtures
```
