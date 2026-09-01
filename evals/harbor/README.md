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
dataset explicitly.

## ATIF tracing

The plugin uses `trace_mode=atif` by default. At the end of each trial, it reads Harbor's
persisted `trajectory.json` files and converts them into one Phoenix trace:

```text
harbor.trial (CHAIN)
  trajectory (AGENT)
    agent_action_N (CHAIN)
      LLM and TOOL spans
```

Visible names describe execution instead of copying raw ATIF indices. Fresh operational
steps are numbered within each label. `agent_action_3` is the third agent action, while
`compaction_1` is the first context-management step. The producer's original `step_id`
stays in span metadata as `atif.step_id`. The converter emits spans in causal and declared
array order. Multi-step trajectory roots include their Harbor step name, such as
`terminus-2 · step_01_aggregate`. Continuation roots use names such as
`terminus-2 (continuation 1)`. When ATIF does not tie a step observation to one tool call,
the action span keeps that observation in its output.

Every span uses one trial-scoped session ID. The top-level `harbor.trial` span records the Harbor
job, trial, task, repetition, and imported file paths. Phoenix links the experiment run to this
trace after it accepts every span for upload.

For a multi-step trial without native trajectory resume, the trace has one direct `AGENT` child
for each attempted step that wrote a canonical trajectory. With `agent.resume_trajectory=true`,
the last available step trajectory is the cumulative snapshot, so the plugin imports only that
file. Referenced continuations and subagent trajectories remain nested below their owning agent.

ATIF step timestamps describe when an event occurred, not both ends of an operation. The
converter bounds each source-step CHAIN by the preceding fresh event and its own timestamp. Harbor
adds Terminus request durations from `api_request_times_msec` when they match the trajectory's LLM
steps. Those LLM spans use the measured duration; unmeasured LLMs and all TOOL calls remain
zero-duration events at the exact ATIF timestamp. The plugin submits trace spans in reverse causal
order because Phoenix returns a trace's spans in reverse insertion order. Phoenix's stable
start-time sort then displays equal-time siblings as the LLM followed by its tool calls in declared
array order, without invented timestamps or UI-specific metadata. Declared tool-call order does
not imply serial execution. Copied context reconstructs prompts but does not create duplicate
execution spans.

Tracing is best effort. A missing or invalid trajectory, an unresolved reference, or an upload
failure produces a warning but does not discard the experiment run or its evaluations. Phoenix
experiment runs are immutable, so resuming a completed run does not add a trace that was missing
when the run was first recorded. Use a new Harbor job name to record it again. To disable trace
loading, pass `--plugin-kwarg trace_mode=none`.

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
its display name or the dataset's latest version. A replay recovers the experiment created for
that job even if another job has since created a new dataset version. Two jobs may use the same
exact name without being treated as the same experiment. Include `{job.name}` or `{job.id}` when
you want their names to be easy to distinguish in Phoenix.

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

Run the explicit Terminus-2 ATIF test with `OPENAI_API_KEY` already set in the environment:

```bash
make harbor-plugin-e2e-atif
```

The target runs Terminus-2 against three tasks from the pinned Harbor package dataset
`terminal-bench/terminal-bench-2-1@6`: `regex-log` exercises repeated shell inspection and editing,
`cancel-async-tasks` exercises a longer tool loop, and `fix-git` exercises repository inspection
and mutation. It checks the trial-level CHAIN root, trajectory sources, parent links, shared session
ID, source-step nesting, measured LLM timings, conservative TOOL event timings, experiment-run
linkage, and replay idempotency. It uses the same
`HARBOR_VERSION` as the credential-free matrix and defaults to `openai/gpt-5-mini`; override the
model with `HARBOR_ATIF_MODEL`. Without `HARBOR_E2E_ENDPOINT`, it uses a disposable Phoenix working
directory and does not touch the shared `~/.phoenix/phoenix.db`.

Both targets accept `HARBOR_E2E_ENDPOINT=http://127.0.0.1:6006` to run against an already-running
Phoenix instead of starting an isolated one, and `HARBOR_E2E_JOB_NAME` to pick a job name that does
not collide with earlier runs in that database.

### ATIF coverage matrix

The three live tasks are a representative integration sample, not the whole format contract. The
test suite divides coverage by the cheapest layer that can prove each behavior:

| Layer | Representative cases | Contract proved |
| --- | --- | --- |
| Converter producer fixtures | OpenHands, Terminus, Claude Code; ATIF v1.2-v1.8; timeout, invalid output, continuation, compaction, subagents, image and audio input, parallel tools, deterministic dispatch | Format and producer variations become valid causal span trees without invented timing |
| Harbor trace builder | Single-step, per-step multi-step, native resume, simulated user, missing clocks, embedded/external/shared subagents, continuation, cyclic or invalid refs, failed trials | Trial normalization, identity, parentage, source selection, fallback time, and replay remain correct for every Harbor layout |
| Credential-free Docker E2E | Direct regression-triage task with oracle and nop agents, repetitions, multiple agents, resume, startup failure | Dataset, experiment, evaluation, and lifecycle behavior when an agent does not produce ATIF |
| Live ATIF Docker E2E | Terminus-2 on the three Terminal Bench tasks above | A real Harbor producer writes ATIF, request timings survive trial persistence, spans upload, and experiment runs link to readable traces |

This split keeps semantic edge cases deterministic while retaining a real container-and-model path
for the integration boundary. Add a focused fixture when a new trajectory shape is introduced, and
add a live task only when it exercises a boundary fixtures cannot prove.

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
