# Harbor evaluations for Phoenix

This directory holds Harbor tasks and tooling for evaluating agents against Phoenix.
Results are recorded in a Phoenix instance of your choice through the
`arize-phoenix` Harbor plugin, as versioned datasets, experiments, scores, and
ATIF traces.

It contains two things:

- **The Phoenix tool benchmark** (below): compare coding agents that reach Phoenix
  through the MCP server, the `px` CLI, or skills, on tasks run against a fresh
  Phoenix seeded with real traces.
- **The PXI headless-agent task** (`tasks/regression-triage`, documented at the end):
  the original multi-step Harbor task for Phoenix's in-app agent.

## Phoenix tool benchmark

Every trial starts two containers: a fresh Phoenix seeded with the
[PatronusAI/TRAIL](https://huggingface.co/datasets/PatronusAI/TRAIL) traces and
annotations, and an agent container with Claude Code, Codex, and `px` installed.
The agent answers a question or changes Phoenix state, and the task's verifier
grades the result while that Phoenix is still running. The plugin records each
trial in the results Phoenix you point it at.

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
  Desktop builds do; Harbor's docs recommend OrbStack or a Linux host if yours does
  not (Harbor checks before starting and refuses otherwise).
- `uv`. The launcher lives in its own Python 3.13 environment under `.venv/` here,
  created on first use.
- A Hugging Face token with the TRAIL terms accepted, for the one-time seed download.
  TRAIL may not be reshared outside the Hugging Face hub, so the download is cached
  locally and seeded images must never be pushed to a registry.
- A running Phoenix to receive results. The plugin reads `PHOENIX_COLLECTOR_ENDPOINT`
  and `PHOENIX_API_KEY` and defaults to `http://localhost:6006`.
- `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` for the coding-agent conditions.

### First time

```sh
HF_TOKEN=... make harbor-seed     # download TRAIL rows to evals/harbor/.cache
make harbor-images                # build phoenix-bench-phoenix:local and phoenix-bench-agent:local
make harbor-bench-oracle          # run every reference solution through the verifiers
```

The Phoenix image is built from this checkout, including uncommitted changes, and is
seeded during the build: a throwaway server loads TRAIL through the public client, the
build waits for span costs, and the resulting database ships in the image. Rebuild the
Phoenix image whenever the server changes, and the agent image (`make harbor-images
IMAGES=agent`, a few seconds) whenever `lib/` or the pinned tool versions change.

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

Each invocation is one Harbor job and one Phoenix experiment. Run several conditions
by invoking the target several times. The underlying command is printed, so you can
also call `harbor run` directly from `evals/harbor/.venv/bin/harbor` with any extra
Harbor flags.

### What lands in Phoenix

- One dataset per split, versioned by task content. Because every condition runs the
  same task files, conditions share a dataset version and their experiments compare
  directly.
- One experiment per run, named by `NAME`.
- Per run: tokens, cost, and latency from Harbor, an `infra_ok` evaluation that is
  `0` when Harbor recorded any exception, and the ATIF trace of the agent.
- Per run, from the verifier: `reward` (0 or 1), `tool_call_count`, and
  `agent_turn_count`. The two counts come from the ATIF trajectory and are omitted for
  the oracle, which has none.

### Inside a trial

[environment/docker-compose.yaml](environment/docker-compose.yaml) adds a `phoenix`
service beside Harbor's `main` service. Every task uses Harbor's allowlist network
policy, which permits only the LLM provider hosts. Harbor enforces it by putting all
services in one network namespace, so the agent reaches Phoenix at
`http://127.0.0.1:6006`, the MCP server at `http://127.0.0.1:6006/mcp`, and `px` is
preconfigured through `PHOENIX_ENDPOINT`. Web search and fetch tools are disabled in
the condition files. If a teammate's Docker cannot run the allowlist, the fallback is
a task compose with an internal network and an allowlisting proxy; that is not
implemented.

`px` is installed under `/opt/px` and the verifier toolchain (a venv with the Phoenix
client plus `lib/`) under `/opt/verifier`; neither is on `PATH`. CLI conditions add
`/opt/px/bin` through the agent's `env`, so MCP conditions do not see `px`.

Verification runs in shared mode: Harbor copies the task's `tests/` to `/tests` in the
agent container after the agent finishes and runs `test.sh` there, with Phoenix still
up. Verifiers can therefore read `/workspace/answer.txt`, query Phoenix over HTTP, or
both.

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

For a question with a checkable answer, `test.sh` is one line calling the shared grader,
and `expected.json` says how to compare. Supported kinds:

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

Answers that hedge between candidates ("117 or 118", "about 117") fail unless
`allow_hedging` is set. Keep a `source` field in `expected.json` saying how the value
was derived.

For a task that changes Phoenix state, write your own `test.sh`: query Phoenix at
`http://127.0.0.1:6006` (the verifier venv has `phoenix.client`), decide the reward,
and call `evals.harbor.lib.grade.write_reward(reward, **extra)` so the standard
measurements are attached. Any finite numeric key you pass becomes an evaluation.

Then run `make harbor-bench-oracle TASKS=<name>`. The oracle runs `solution/solve.sh`
and the verifier without any model calls; its answer is the reference value to record
in `expected.json`, and a reward of `1` confirms the verifier accepts it.

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
  main: { image: phoenix-bench-agent:candidate }
  phoenix: { image: phoenix-bench-phoenix:candidate }
```

Skills go in the agent's `skills` list as directories containing `SKILL.md`; Harbor
installs them for both agents and records their digests.

### Dev and test splits

`tasks/dev` is for iterating on tools, prompts, and skills; `tasks/test` is held out
for reporting. Put paraphrases of one question in the same split, and do not tune
against test. Each split is its own Phoenix dataset, so experiments are only ever
compared within a split.

### Tests

The grading library is unit-tested from the repository root:

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
