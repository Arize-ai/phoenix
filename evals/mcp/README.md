# Phoenix MCP and CLI benchmark

Run the same Phoenix questions with Claude Code or Codex, using either MCP or
`px`. Compare success, tool use, tokens, cost, and time in Phoenix experiments.

The nine questions come from
[mora/mcpbench-experiment at 39c9be2](https://github.com/Arize-ai/phoenix/tree/39c9be2cf0377aa2b2377c62cc69bfe5f674dd96/scripts/benchmarks/mcp/tasks).
Their wording is unchanged except for the project name, `research-assistant`.
[PatronusAI/TRAIL](https://huggingface.co/datasets/PatronusAI/TRAIL) supplies the
historical traces and annotations loaded into that project.

## Code layout

```text
benchmark.toml       Named conditions, models, agent/px versions, optional skills
scripts/             Prepare TRAIL, build images, stage jobs, invoke Harbor
  experiment.py      Read settings, prepare jobs, invoke Harbor
  build.py           Build selected implementation versions
  prepare_seed.py    Convert and save the private TRAIL fixture
  stage.py           Task wiring and native Harbor job configuration
environment/         Dockerfile, Compose services, startup and access checks
scoring/             Answer comparisons, references, ATIF and tool metrics
tasks/<task>/        Native Harbor task: prompt, metadata, tests/, solution/
```

Implementation tests live in root `tests/evals/mcp/`. Task-local `tests/` contain
Harbor verifiers. Local tasks use directory names and metadata version `0`.

## Three commands

Docker must use a Linux kernel with `CONFIG_NFT_FIB_INET` for Harbor's native
network allowlist. Some Docker Desktop VMs lack this feature; use a compatible
runtime such as OrbStack or a Linux Docker host. Harbor rejects unsupported
runtimes. See its [Docker compatibility guide](https://www.harborframework.com/docs/tasks/network-policy#local-docker-runtime-compatibility).

`make install-python` is the repository's existing Python setup command, needed
for the FastMCP integration test. Harbor uses a separate Python 3.13 environment
managed by `uv`; each command ensures it is installed.

```sh
make mcp-prepare
make mcp-check
make mcp-run ARGS='--prepared <directory printed by prepare> --oracle --task count-traces'
```

`mcp-prepare` creates a private TRAIL seed if needed, builds the images, and writes
native Harbor job configs for the configured conditions into a new private directory. The first download
requires `HF_TOKEN`; use `ARGS='--input /path/to/private-rows.json'` for saved rows.
An existing seed is reused after its contents are checked.

`mcp-check` runs source tests, Ruff, and mypy without model calls or Docker trials.
CI runs the same command. Tests remain in the root test tree, but the dedicated CI
job uses Python 3.13 so Harbor does not change Phoenix's Python 3.10 dependencies.

`mcp-run --oracle` runs the reference solution through the real CLI and Harbor
verifier. Omit `--task` to check all nine questions. The separate
`noop-surface-cost` control is selected explicitly with `--task noop-surface-cost`.

To run the coding agents, supply provider keys through `OPENAI_API_KEY` and/or
`ANTHROPIC_API_KEY`, then select the conditions and repetitions:

```sh
make mcp-run ARGS='--prepared <directory> --condition codex-mcp --condition codex-cli --repetitions 3'
```

Omit `--condition` to run all prepared conditions. Edit [benchmark.toml](benchmark.toml)
or pass `mcp-prepare --config` through `ARGS` to select another configuration.
Model IDs are
sent literally. The configured model requests still need live provider validation.

## Harbor runs the experiment

The launcher prints and executes the native command for each selected condition:

```sh
evals/mcp/.venv/bin/harbor run \
  --config <prepared-directory>/configs/codex-mcp.json \
  --plugin arize-phoenix --plugin-kwarg trace_mode=atif --yes
```

The generated JSON contains ordinary Harbor agent, dataset, Docker, repetition,
and retry settings. Harbor's built-in Claude Code and Codex adapters run the
agents. There is no custom agent or environment subclass. `mcp-run` clears
inherited personal agent configuration before invoking this command.

Set `PHOENIX_COLLECTOR_ENDPOINT` to choose where the plugin records results,
defaulting to `http://localhost:6006`. Use `PHOENIX_API_KEY` if that results server
requires authentication. This destination is separate from the trial's Phoenix.
Inspect experiments, scores, and linked ATIF traces in Phoenix.

## Inside each attempt

[Compose](environment/docker-compose.yaml) defines the agent and Phoenix services.
Every attempt gets a new writable Phoenix database, seeded and checked before the
agent starts. The containers have separate filesystems, so the agent cannot read
the target's database, seed files, or reference answers.

The agent connects directly to Phoenix at `http://127.0.0.1:6006` through MCP or
the installed `px` CLI. Harbor gives the two containers a shared localhost network;
Phoenix requests stay inside the trial and need no external network access.

During an attempt, the only allowed external destination is the selected LLM
provider: `api.openai.com` for Codex or `api.anthropic.com` for Claude Code.
Harbor's native network policy enforces this allowlist. Claude Code's `WebSearch`
and `WebFetch` tools and Codex web search are disabled. Image builds and seed
downloads happen beforehand on the host.

Harbor's built-in agent receives the selected provider key. Results credentials
stay on the host. The CLI image contains the real `px` binary; direct Phoenix
HTTP calls are also possible, so recorded `px` commands are a usage diagnostic.

Harbor stops the agent, collects artifacts, and runs the verifier in a separate
container with no network. This follows its
[Compose artifact pattern](https://harborframework.com/docs/tasks). Harbor removes
trial containers and networks after collection. Each trial's Phoenix database
remains in its private `target-data` directory alongside logs and artifacts.

## Test an unreleased MCP

The MCP is part of the Phoenix server wheel built from this checkout, including
uncommitted changes. It is not fetched from a deployed endpoint. To compare a
specific commit or another checkout:

```sh
make mcp-prepare ARGS='--target-ref <commit-or-branch>'
make mcp-prepare ARGS='--target-source /path/to/phoenix-checkout'
```

Each preparation records the source revision, wheel hash, and immutable image IDs.
Run the resulting jobs against the same seed, tasks, models, and repetition count.
Prepared jobs use their copied task files and skills and the previously built images.
Editing the source configuration or preparing another version does not invalidate them.

The host's `arize-phoenix-client[harbor]` dependency supplies the Phoenix plugin.
Its git revision is pinned in [pyproject.toml](pyproject.toml) because this version
contains the ATIF support. That pin is independent of the server under test.

## Version comparisons and experiment names

A preparation is an inspectable directory:

```text
configs/<condition>.json    Native Harbor job files; these drive execution
<condition>/tasks/          Copied tasks with resolved runtime settings
<condition>/skills/         Complete copies of the selected skills
images.json                Label, source revision, package hashes, image IDs
benchmark.toml             Original input, retained for reference
jobs/                      Harbor results, created when you run
```

The runner reads the saved job files. It does not reconstruct the experiment
from the current checkout or compare it against a live source hash. Keep the
prepared directory, referenced seed directory, and local Docker images to rerun
it. The host still uses the pinned Harbor/plugin environment in `uv.lock`.
Older preparations without `configs/` must be prepared again.

Use `--label` to distinguish revisions in Phoenix. Each job uses the plugin's
native experiment naming option to render `<label> · <condition>`. Labels are
display names; job identity and recorded artifact hashes still distinguish runs.

```sh
make mcp-prepare ARGS='--config /path/to/released.toml --label released'
make mcp-prepare ARGS='--config /path/to/candidate.toml --label cli-candidate --cli-package /path/to/phoenix-cli.tgz'
```

`--cli-package` accepts a local `npm pack` tarball named `@arizeai/phoenix-cli` in
its package metadata. Build and pack the desired CLI checkout first. Preparation
installs that artifact instead of `px_version` and records its SHA-256 and package
version in `images.json`. Without this option, `px_version` selects the published
CLI release. Coding-agent versions and models remain pinned in `[agents.*]`.

For skill comparisons, add named conditions to a copy of `benchmark.toml`:

```toml
[conditions.released_skill]
agent = "codex"
interface = "cli"
skills = ["/path/to/released/phoenix-cli"]

[conditions.candidate_skill]
agent = "codex"
interface = "cli"
skills = ["/path/to/candidate/phoenix-cli"]
```

Condition names are labels and are not parsed to choose behavior. Each skill path
must contain `SKILL.md`; relative paths resolve against the configuration file.
Use a checkout of the desired commit for a released or historical skill, or a
working directory for an unreleased edit. Preparation copies the complete skill
directory, including references and scripts, into the prepared experiment.
Later edits to the original directory do not affect that copy. Harbor installs
these copies using its native skill support and records their content digests
in the job lock. The saved input TOML retains the original skill selections.

Use `interface = "none"` for a coding agent with skills but no configured Phoenix
MCP or installed CLI. Phoenix remains available on localhost. All conditions
retain provider-only external network access. Dependencies needed by a task must
be installed before the trial. This launcher does not yet run the full PXI app.

## Task-owned verification

Harbor invokes `tests/test.sh` directly. For the bundled answer tasks, staging
generates this entrypoint to call the shared `scoring.verify` helper with the
task's `tests/verify.py`. A task can supply its own `tests/test.sh` to run any
verifier and supporting files it needs; staging preserves that script.
The script owns grading and writes Harbor's `/logs/verifier/reward.json` or
`reward.txt`. Task-defined finite numeric scores are accepted; a literal binary
`reward` is required only by the bundled answer helper.

Declare required evidence in the task's native `artifacts` entries and use
`[[verifier.collect]]` for sidecar snapshots. Staging retains those entries,
collection hooks, verifier environment variables and task-specific timeouts.
An explicit `artifacts` list replaces the answer-task defaults entirely. Collected
files are restored at their original absolute paths.

By default, staging writes a two-line `tests/Dockerfile` that extends the shared
verifier image and copies the task's tests into `/tests`. Harbor builds it using
its native separate-verifier support. For different grading dependencies, supply
your own `tests/Dockerfile` or `[verifier.environment].docker_image`. A prebuilt
image must contain `/tests/test.sh`. Verifiers remain separate and offline.

Staging also generates the bundled answer tasks' `solution/solve.sh` when no
solution directory is supplied. Tasks can provide their own solution directory.
Custom `tests/test.sh` entrypoints do not receive an automatic oracle solution.
The shared CLI oracle helper is available as `solution/oracle.py` unless the
task supplies that file. Run `--oracle` only on tasks with a solution; the
launcher's oracle route needs at least one CLI condition.

Missing optional telemetry omits the affected measurements. Missing evidence
needed to establish correctness must fail grading rather than produce a pass.

## Task selection and dev/test policy

Keep a task once in `tasks/`. Use explicit `--task` selections for comparisons;
record applicable conditions in the task's metadata or description when needed.
Applicability is authored for the task, not inferred from whether a candidate
succeeds. No capability taxonomy or difficulty rating is required.

When expanding the dataset, give each task a clear `metadata.split = "dev"` or
`"test"`. Review selections so every condition in a comparison runs the same
applicable split. The current seed questions are development cases, not an
independent held-out test set.

Both splits should cover the main workflows, using independent underlying
examples. Keep paraphrases and variants of one incident or fixture together in
one split. A review checklist is enough: shared workflow coverage, no related
examples crossing splits, and no test cases used for iterative tuning. A small
set of entirely unseen workflows can be reported separately as a generalization
check; do not replace the representative test set with only unseen workflows.

## Scoring and measurements

Each bundled answer task's named verifier returns `reward: 1` for a correct final answer and `0`
otherwise. [scoring/verify.py](scoring/verify.py) selects that verifier;
[scoring/references.py](scoring/references.py) calculates expected answers from
the private seed before the agent runs.

The nine tasks check trace count, total cost, most failing tool, top error category,
error rates by trace length, maximum LLM calls, repeated tool calls, spend
concentration, and the PageDown tool's root cause. Read each task's verifier
for its comparison and precision. The no-op control requires exactly `ok`.

A trace groups spans from one execution. This seed has 117 traces and 3,579 spans.
The count verifier accepts `117 traces` or a bare `117`, but rejects `117 spans`.
The shared ATIF helper extracts the final answer and counts tool calls and turns,
excluding copied context and historical TRAIL activity.

Measurements describe how the agent worked and do not change correctness.
Native logs record MCP, code-mode and SQL use. The ATIF helper identifies
recorded `px` commands for CLI trials. Missing evidence produces an unknown
measurement. Harbor and Phoenix retain timing, tokens, cost, infrastructure errors and linked
ATIF traces. Inspect results in Phoenix; there is no separate report pipeline.

[environment/pricing.json](environment/pricing.json) pins per-token rates for
`o3-mini`, which produced the historical TRAIL traces. It stabilizes cost-task
references and does not price the coding agents' calls.
