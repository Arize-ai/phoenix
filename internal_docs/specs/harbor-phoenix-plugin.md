# Phoenix plugin for Harbor: design specification

ATIF is implemented. OTLP is planned and is not accepted by the plugin.

## Contents

- [Summary](#1-summary)
- [Goals and boundaries](#2-goals-and-boundaries)
- [Data model](#3-data-model)
- [Plugin design](#4-plugin-design)
- [Trace modes](#5-trace-modes)
- [Evaluation scores](#6-evaluation-scores)
- [Identity and failure handling](#7-identity-and-failure-handling)
- [Configuration](#8-configuration)
- [Implementation scope](#9-implementation-scope)
- [Future work](#10-future-work)
- [Compatibility assumptions](#11-compatibility-assumptions)

---

## 1. Summary

The Phoenix Harbor plugin records Harbor evaluation jobs in Phoenix. Harbor runs the agents and
verifiers. Phoenix stores the tasks, experiment runs, scores, and traces so teams can compare
results across agents, models, attempts, and time.

The plugin:

- infers a Phoenix dataset from the Harbor tasks
- creates one Phoenix experiment for each agent and model in a job
- records each Harbor trial as an experiment run
- stores Harbor's aggregate reward and infrastructure status as dense evaluation scores
- stores other task- and step-level rewards as sparse diagnostic scores
- links each run to an ATIF trace when ATIF tracing succeeds

ATIF is the default and requires saved trajectories, not live agent instrumentation. The planned
OTLP design is separate from the current implementation and appears in §5.

The plugin uses the existing ATIF conversion and reparenting helpers. It requires no Phoenix server
changes.

## 2. Goals and boundaries

### Goals

- One-command setup through `harbor run --plugin arize-phoenix`.
- Support any Harbor dataset and agent that meets the selected trace mode's requirements.
- Preserve Harbor's task, logical trial, agent, model, and reward identities.
- Show comparable results across agents and models.
- Preserve completed results when a long-running job is interrupted.
- Stop before spending trial compute when required Phoenix recording cannot be set up.
- Make repeated ingestion idempotent.

### Boundaries

- Harbor runs the agents and verifiers. Phoenix does not rerun these experiments or select Harbor tasks.
- Harbor's verifier remains the authority for rewards. The plugin does not calculate a second aggregate reward.
- Dataset example `output` remains an empty object. A Harbor solution is an executable way to produce an end state, not a reference response.
- The plugin accepts one Harbor dataset or a direct-task-only job. It rejects jobs that
  combine both sources. A single direct task gets a namespaced synthetic dataset name;
  several direct tasks require an explicit `dataset` plugin setting.
- The plugin does not wrap Harbor's environment setup, agent setup, or verifier phases in spans. Trial and step spans are built from the saved terminal result.
- There is no post-hoc ingestion command.

## 3. Data model

| Harbor concept                | Phoenix concept             | Mapping                                                           |
| ----------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Dataset                       | Dataset                     | Name inferred from Harbor; optional override                      |
| Task                          | Dataset example             | Task ID, name, and instruction in input; other fields in metadata  |
| Task digest                   | Dataset example metadata    | Full Harbor task digest                                           |
| Resolved task snapshot        | Dataset version             | Complete synchronized task set                                    |
| Job × agent × model           | Experiment                  | One experiment for each agent and model                           |
| Logical trial                 | Experiment run              | One run for each planned task attempt                             |
| Planned attempt               | Repetition                  | Deterministic repetition number                                   |
| Trial or step exception       | Run error                   | Kept separate from verifier rewards                               |
| Trial `reward`                | Dense evaluation            | Stored on behaviorally completed runs                             |
| Infrastructure status         | Dense `infra_ok` evaluation | Stored on every recorded terminal run                             |
| Step reward                   | Sparse evaluation           | Named `<step_name>.<reward_key>`                                  |
| ATIF trajectory               | Trace                       | Linked to the experiment run when tracing succeeds                 |

Use one Phoenix dataset for one Harbor task collection. A normal job maps its single configured
Harbor dataset directly. A direct-task-only job maps the resolved task set to a synthetic Phoenix
dataset. Do not combine configured datasets and direct tasks, and do not accept several configured
datasets.

Infer the dataset name from the resolved `DatasetConfig`:

| Harbor input | Classification | Inferred dataset name |
| --- | --- | --- |
| local path (`--path`) | `is_local()` | resolved directory basename |
| registry bare name (`--dataset <name>`) | `is_registry()` | the selected bare name |
| published package (`--dataset <org>/<name>`) | `is_package()` | the selected `<org>/<name>` |
| repository source (`--repo` with `--dataset`) | `is_repo()` | resolved registry metadata name |
| one direct task (`--path`, package, or Git task) | direct task | `harbor-task/<declared task name>` |

A local dataset exposes only its directory name. After inferring a name, verify that every resolved task has the same source.

The optional `dataset` setting overrides the inferred name, but not the one-collection rule. For
several direct tasks it is required and declares that the complete resolved task set is one
synthetic dataset snapshot. Full update semantics apply, so a later job using the same name and a
different task set creates a new version whose examples exactly match the later job.

Reject duplicate task IDs. Phoenix uses the task ID for example and run identity, so duplicates would merge separate tasks.

Each task becomes a Phoenix dataset example with this shape:

```json
{
  "id": "<stable Harbor task ID>",
  "input": {
    "task_id": "<Harbor task ID>",
    "task_name": "<Harbor task name>",
    "instruction": "<task instruction>"
  },
  "output": {},
  "metadata": {
    "task_digest": "<full Harbor task digest>",
    "task_source": "<resolved Harbor task source>",
    "task_type": "<Harbor task type>",
    "task_version": "<Harbor task version or null>",
    "task_config": {}
  }
}
```

For a multi-step task, `input` also contains the ordered step names and instructions:

```json
{
  "steps": [
    {
      "name": "<step name>",
      "instruction": "<step instruction>"
    }
  ]
}
```

Put only the fields needed to identify and perform the task in `input`. Put the task digest,
source, type, version, and redacted task configuration in `metadata`. Keep `output` empty because
Harbor checks the environment state, not a reference response.

At each job start, synchronize the full task set. Use the Harbor task ID as the stable external example `id`. Phoenix returns a separate `node_id`; save it for logging experiment runs.

The task digest covers the solution, environment, tests, and steps. Phoenix reuses the current dataset version when the full task set is unchanged. Adding, removing, or changing a task creates a new version.

The job lock does not exist at `on_job_start`. The compatibility adapter builds it in memory from the resolved config, trial configs, and task downloads, then reads the task digests.

## 4. Plugin design

The plugin lives in `arize-phoenix-client` as `phoenix.client.harbor` and registers `arize-phoenix` in Harbor's `harbor.plugins` entry-point group. Harbor is imported only when the plugin is selected.

The package has three main components:

1. The Harbor compatibility adapter reads the resolved task and trial plan into an internal model. It is the only component that accesses Harbor's private job-plan fields and validates them before ingestion begins.
2. The recorder maps that model to Phoenix datasets, experiments, runs, evaluations, and trace links.
3. The job plugin connects Harbor lifecycle hooks to the recorder and stops the job when required Phoenix recording fails.

The package supports normal jobs on Harbor `>=0.21.0`. It checks required capabilities at runtime. Regrade and source-job plans are not supported.

Phoenix version requirements depend on the feature:

| Requirement | Floor | Status |
| --- | --- | --- |
| Experiment/run/evaluation logging | `arize-phoenix-client>=2.10.0` | Released |
| Stable external dataset example IDs | Phoenix server `>=15.0` | Released |
| ATIF trace lookup and replay verification (§5) | Phoenix server `>=13.9` | Released; ATIF-mode-only floor |

Phoenix server `>=13.9` is required only for the trace ID filter used by ATIF mode.

### Job start

At `on_job_start`, the plugin:

1. resolves the complete task and trial plan;
2. synchronizes the complete dataset example snapshot;
3. recovers or creates one experiment for each effective agent and model configuration. Recovery
   matches the stored Harbor job ID and agent identity digest. Other jobs may create new versions
   of the same dataset between replays, so the recovered experiment stays pinned to its original
   version. A new experiment uses the current dataset version;
4. reads the server-assigned project name for each experiment;
5. derives a stable repetition number for every trial.

The plugin cannot list physical attempts at job start. Harbor creates retries later, and trial UUIDs
do not exist until trial construction. The plugin creates ATIF identity from the saved terminal
result after retry handling decides that the attempt is final. Planned OTLP attempt identity must be
created after Harbor constructs each physical attempt.

Creating examples before experiments is required because a Phoenix experiment is pinned to a dataset version when it is created.

### Trial end

Harbor may emit an END event for a failed attempt before it starts a retry. The event does not include the attempt number or say whether the attempt is terminal. The compatibility adapter reconstructs this decision. It counts START events for each logical trial and applies Harbor's `RetryConfig` rules in this order: exclude, include, then `max_retries`.

`RetryConfig` is public, but this decision logic is private Harbor behavior. Contract tests cover
the installed Harbor version, and the E2E target defaults to the minimum supported version. Do not
write Phoenix or ATIF data for an attempt that will be retried. The final attempt keeps the logical
trial's precomputed repetition number.

This logic has three limits:

- Only a top-level `TrialResult.exception_info` triggers a retry. A failure found only on a `StepResult` is terminal and must be ingested.
- `CancelledError` is never retryable.
- Harbor may crash after saving an intermediate result but before starting its retry. On resume, Harbor may treat that result as complete. The plugin cannot detect or repair this case.

At the terminal end of each logical trial, the plugin:

1. builds and uploads the ATIF trace when `trace_mode="atif"`;
2. resolves the trace ID when available;
3. writes the experiment run with its output, timing, trace link, and error status; and
4. writes the dense and sparse evaluation scores emitted by Harbor.

The plugin streams each result as its trial ends. This provides live progress and preserves completed work if the job stops early.

### Job end

`on_job_end` logs a completion message. Required data is written at trial end because Harbor
suppresses errors from the job-end hook.

## 5. Trace modes

The plugin accepts `atif` and `null`; `null` disables tracing. It does not auto-detect tracing or
combine ATIF with live spans. `otlp` is planned but not implemented.

| Behavior | `atif` (default) | `otlp` (deferred) |
|---|---|---|
| Agent instrumentation required | No; agent must produce ATIF | Yes; standard OpenTelemetry instrumentation is sufficient |
| Live during the trial | No; uploaded when the trial ends | Yes |
| Sandbox endpoint and credentials | Not required | Required |
| Network access from sandbox | Not required | Required |
| Destination | Experiment's Phoenix project | Experiment's Phoenix project |
| Run linkage | Deterministic from the Harbor job and terminal trial IDs | Report-back or correlation query; see §5.2 |
| Trial-scoped root owned by the plugin | Yes | Not until the Harbor runtime hook exists |

### ATIF mode

The converter supports ATIF v1.0 through v1.7. The Harbor loader also validates files against the
installed Harbor trajectory model. ATIF v1.8 audio fields are not supported.

ATIF mode uses the existing package-internal pure conversion and common-parent helpers. The plugin
needs the spans before upload so it can check deterministic IDs, repair partial uploads, and link
the run only once Phoenix has accepted every missing span.

The package-internal pure conversion helpers:

- validate and convert one or more trajectories;
- return spans without uploading them;
- preserve ATIF v1.7 sub-agent flattening and valid external references;
- reject duplicate span IDs, unresolved parents, cross-trace parent links, and cycles before upload; and
- reparent every independent trajectory root under one Harbor-owned trial root.

The conversion layer does not use a client. Harbor-specific discovery, normalization, deterministic
identity, and upload-repair behavior stay private to the plugin.

When a subagent reference supplies both an embedded ID and a file path, the embedded match takes
precedence so the child is converted once. Continuations are followed for file and embedded
documents, and remain beneath the original document's caller. Role directories and referenced
files must resolve inside the trial directory, including when symlinks are present. Each referenced
file must also stay within its role directory. URLs and absolute references are rejected.

The trace mirrors Harbor's structure: trial → step → agent trajectory. The plugin creates one
deterministic CHAIN root, `harbor.trial <task id>`, and sends all spans to the experiment's Phoenix
project. A multi-step trial gets one `harbor.step <index> <step name>` CHAIN span per attempted
step, in `step_results` order, with that step's trajectories beneath it; a single-step trial hangs
its trajectories directly beneath the root. The step span's input is the step instruction, its
output is the step's verifier rewards, and its status is `ERROR` for the step's own exception. The
root's status is `ERROR` for the same failures that set the experiment run's error and drive
`infra_ok`: any top-level or step exception, even when Harbor also records verifier rewards. Under
native resume only the last cumulative snapshot is loaded, so earlier steps keep their `harbor.step`
span without trajectories beneath it.

Within a trajectory, each fresh agent step is one iteration of the agent loop and becomes a CHAIN
span. LLM, TOOL, and referenced subagent work hangs beneath that iteration; a matching
`source_call_id` narrows a subagent parent to its TOOL call. Copied context is prompt history and
does not create duplicate execution spans.

Harbor-owned spans keep a `harbor.` prefix. Trajectory spans use these names:

| Span | Kind | Name |
| --- | --- | --- |
| Trial | CHAIN | `harbor.trial <task id>` |
| Step (multi-step only) | CHAIN | `harbor.step <index> <step name>` |
| Trajectory root | AGENT | `<agent name>`; a continuation adds ` (continuation N)` |
| Turn (multi-turn only) | AGENT | `turn N` |
| Agent loop iteration | CHAIN | `iteration N` |
| Context management | CHAIN | `compaction N` |
| Operational system step (a handoff, for example) | CHAIN | `system event N` |
| LLM call | LLM | `<model name>`, or `LLM` when the trajectory names no model |
| Tool call | TOOL | `<tool name>` |

Ordinals count fresh operational steps with the same label, regardless of interleaving; the
producer's `step_id` stays in metadata as `atif.step_id`. A user message never consumes an ordinal.
Consecutive user or system context messages do not open new turns; a turn starts only at a user
message that follows agent activity.

Every span of a trajectory carries `metadata.agent_name`, and every span beneath a step carries
`metadata.harbor.step_index` and `metadata.harbor.step_name`.

Every AGENT and CHAIN span carries `input.value` and `output.value` when the trajectory provides
them. An iteration's input is the preceding user or system message, or the previous iteration's
observations. Its output is the step message plus any observation that no tool call claims, or the
tool results when the step only issued tool calls.
Only an explicit `source_call_id` pairs a result with a tool; multiple results for that call are
preserved in order. Only LLM spans carry `llm.*` attributes. A trajectory's `final_metrics` stay in
the root span's `metadata.final_metrics`, so Phoenix's cumulative token counts do not double count.

LLM inputs are reconstructed ATIF context, not exact provider requests. Every LLM span carries
`metadata.atif.input_source = "reconstructed"`. ATIF sources `user`, `system`, and `agent` map to
message roles `user`, `system`, and `assistant`. The converter does not parse provider-native
messages or interpret tool argument keys. Feedback without a matching call ID stays as an
`observation` entry with `after_step_id` in `input.value`,
without an inferred role or tool association. Multimodal tool results retain their content parts
in reconstructed inputs and serialized tool outputs. No media bytes are read or uploaded.
An agent step with `llm_call_count: 0` still gets its iteration CHAIN even if it issued no tools,
and creates no synthetic LLM span.

ATIF timestamps are point events. An iteration spans the preceding fresh event through its own
event. Harbor enriches Terminus trajectories with `agent_result.metadata.api_request_times_msec`
only when the number of request measurements exactly matches the number of fresh LLM steps. A
single document uses its declared step order. Continuation and subagent graphs require timestamps
on every fresh LLM step so their requests can be merged chronologically; otherwise enrichment is
skipped rather than risking a shifted measurement. The converter does not interpret
producer-specific latency metrics. Measured LLM spans use the Harbor request duration within the
source interval. Unmeasured LLMs and TOOL calls are zero-duration events; the converter does not
infer tool serialism, concurrency, or elapsed time.
Equal-time events retain the exact ATIF timestamp. The converter lists an unmeasured LLM before its
tool calls and tool calls in their declared array order, but that order does not imply serial tool
execution. Immediately before upload, the Harbor adapter reverses the missing-span batch. Phoenix
inserts the batch FIFO and returns trace spans by descending row ID; its stable start-time sort
therefore restores the converter's causal and declared order for exact ties. Interrupted prefix
uploads use the same reverse-and-filter rule during repair. Missing and non-monotonic clocks
collapse instead of creating synthetic duration.

For each in-memory trajectory, the plugin:

- sets `trajectory_id` from the saved terminal trial identity, role, step, file, and embedding index; and
- sets `session_id` to one value per trial (`harbor:<trace_id>`), so a trial appears as one Phoenix session containing one trace. The producer's original `trajectory_id` and `session_id` are kept in the agent metadata of the trajectory's root span.

It does not change the source file.

Always set both values. Agents may omit `trajectory_id`, reuse a `session_id` across steps, or use a
constant session ID. None of those producer choices should merge separate trials.

The plugin must namespace `session_id` even when it sets `trajectory_id`. Phoenix resolves sessions from `session_id` without a project filter. A constant value could otherwise group unrelated trials into one session.

Both IDs must be globally unique and stable across replays. The trace ID comes from the Harbor job
ID and the saved terminal trial UUID, and `session_id` comes from the trace ID. Each
`trajectory_id` also includes its role, step name, source path, and embedded position.

Deterministic IDs do not make span upload idempotent. Phoenix has two important ingestion behaviors:

- If any span ID already exists, Phoenix rejects the full request. Do not send an existing span again.
- Phoenix silently drops duplicate span IDs within one request. Validate that all IDs in a request are unique.

Before upload, query the expected span IDs and send only missing spans. Link the run as soon as
Phoenix reports every missing span queued. The spans become queryable within Phoenix's bulk-insert
interval. Successful experiment runs are immutable. A successful run recorded without a trace
keeps no trace on later replays. This query requires Phoenix server `>=13.9` in `atif` mode.

### Planned OTLP mode

This section describes behavior deferred for a follow-up. It remains the planned OTLP contract.

OTLP has three separate features:

1. project routing;
2. adapter-assisted trace-to-run linkage; and
3. plugin-owned per-trial trace identity, blocked on Harbor.

Harbor does not create OpenTelemetry spans. Agents create them. Each agent has one shared environment, `AgentConfig.env`, which Harbor copies when it constructs the agent.

#### 5.1 Project routing

The user supplies the exporter endpoint, credentials, and project through Harbor's per-agent environment (`--agent-env`, or an `env:` block per agent in a job config file). Phoenix routes on the `openinference.project.name` resource attribute, or on an `x-project-name` header over HTTP.

At `on_job_start`, the plugin checks each agent's environment against the configured project and endpoint. If a value is missing or different, stop with the exact flags needed to fix it.

Per-agent routing requires a job config file. The CLI applies one `--agent-env` value to all agents.

Do **not** mutate `job.config.agents[*].env` at `on_job_start`. Harbor saves the change in the trial config, including any credentials. A later `resume` then fails because the saved config differs from the plan.

Where the sandbox uses a network allowlist, the Phoenix host must be added with Harbor's agent-host allowlist flag.

#### 5.2 Trace→run linkage

Use both mechanisms:

- **Report-back.** The adapter adds its trace ID to the Harbor agent context metadata. Merge with existing metadata instead of replacing it. Note: non-empty metadata disables Harbor's automatic token and cost fields.
- **Correlation query.** The adapter adds `harbor.trial.id` as a **span** attribute. The plugin queries the experiment project for that terminal trial UUID.

Both mechanisms require a Phoenix-owned adapter. The adapter can read the trial UUID from its context, create one deterministic trace around all steps, and report the trace ID.

Correlation keys must be span attributes. Phoenix drops all OTLP **resource** attributes except the project name. Also, Harbor creates the job UUID after CLI setup, so only a user-supplied job label can be static.

The adapter creates the root span, so the plugin learns the trace ID only after the trial runs. It cannot validate linkage at job start.

#### 5.3 Plugin-owned per-trial context

Generic OTLP needs a Harbor hook that can inject a trial root before agent construction. Before
implementing this mode, check that the supported Harbor versions provide a hook that addresses
these constraints:

- Harbor creates the trial UUID during trial construction, so it is not available at job start;
- concurrent trials share one `AgentConfig`, so per-trial mutation would race; and
- trial-start hooks run after the agent copies its environment.

A runtime-overrides hook must run before agent construction without changing saved config, job
locks, or resume checks. Until the minimum Harbor version includes it, OTLP support is limited to
§5.1 and §5.2. State this limit during startup checks.

#### 5.4 Consequences that hold in every OTLP variant

The plugin sends a prebuilt root after its child spans. Phoenix supports either arrival order, but the **first** span fixes the trace project. Project routing must be correct before an agent sends any span.

The root status describes infrastructure success, not behavioral reward. Child errors still contribute to the root's error count.

Each retry has a new trial UUID and emits a separate trace. Link only the final attempt to the experiment run. Earlier traces remain unlinked in the same project. Project-level metrics, such as token cost, include all attempts.

Harbor decides whether to retry only after spans are sent, and Phoenix cannot move spans later.
The earlier traces remain available for debugging.

Add `harbor.trial.id` as a **span** attribute so users can find an unlinked trace. The adapter cannot add the attempt number because only Harbor's trial queue knows it.

Multi-trace runs are out of scope. Phoenix displays one trace per experiment run, so extra trace IDs in run output would not be useful.

## 6. Evaluation scores

Harbor can use a different verifier for every task, so not every score is meaningful across an entire dataset. The plugin separates scores into dense summary metrics and sparse diagnostic metrics.

### Behaviorally completed

A run is **behaviorally completed** when Harbor produced a verifier result. The plugin records each reward under its exact Harbor key. Only a verifier result with a literal `reward` key produces a Phoenix evaluation named `reward`.

| Harbor terminal state | Top-level exception | Step exceptions | Behaviorally completed | Run error | `reward` | `infra_ok` |
| --- | --- | --- | --- | --- | --- | --- |
| Success | none | none | Yes | no | Harbor's aggregate | 1 |
| Behavioral zero | none | none | Yes | no | `0` | 1 |
| Single-step agent or verifier failure | present | n/a | No | yes | not written | 0 |
| Scored multi-step exception | usually none | present | Yes, if a final verifier result exists | yes | Harbor's aggregate | 0 |
| Multi-step exception with no verifier result | none or present | present | No | yes | not written | 0 |
| Cancellation | `CancelledError` | partial | No | yes | not written | 0 |

Exception status and behavioral completion are independent. A run can retain verifier rewards
while also carrying a run error, `infra_ok = 0`, and an `ERROR` trace root.

`reward` is present only when Harbor emits that key. The plugin does not promote a sole differently named value or infer an aggregate from other keys. Consumers must check `reward` coverage before computing cross-task summaries.

| Score | Coverage | Purpose |
|---|---|---|
| `reward` | Only where Harbor emits it | Harbor's conventional behavioral score; suitable for cross-task summaries |
| `infra_ok` | Every attempted run | Infrastructure success rate |
| `<reward_key>` | Only where Harbor emits it | Trial-level verifier reward or diagnostic |
| `<step_name>.<reward_key>` | Only where Harbor emits it | Step-level diagnosis within a task |

Rules:

- Read scores from `step_results` as well as the final verifier result.
- Check the top-level result and every step result for exceptions. Any exception sets the run error and `infra_ok = 0`. A reward of zero without an exception keeps `infra_ok = 1`.
- Store every final-verifier reward as `<reward_key>` and every step reward as `<step_name>.<reward_key>`. Do not infer `reward` from another key, even when the verifier emits only one value.
- Add `multi_step_reward_strategy` to each trial-level reward evaluation for a multi-step task. Resolve Harbor's omitted default to `mean`; preserve an explicit `final`. Do not add this metadata to step-level scores, `infra_ok`, or single-step rewards.
- Reject empty or duplicate step names before writing and detect any remaining generated-name collision during extraction.
- Store step rewards in their original numeric scale.
- Keep infrastructure failures separate from behavioral failures.
- Do not add a built-in `all_steps_passed` or `tool_calls` score. Tasks can emit task-specific scores when useful.
- Store the Harbor terminal trial ID, token usage, and cost in a compact JSON-safe run `output` envelope. The public Phoenix run API has no run-metadata argument. Defer phase timings until the output schema can represent multi-step timings without breaking reuse of immutable runs written by older plugin versions.

Phoenix can calculate token cost and latency from traces. Consumers can calculate pass rate, pass^k, confidence intervals, and release gates from stored rewards.

## 7. Identity and failure handling

### Stable identity

| Object | Stable key |
|---|---|
| Dataset | Resolved Harbor dataset identity or explicit override |
| Example | Task ID within the dataset |
| Example version | Full Harbor task digest |
| Experiment | Harbor job ID and effective agent/model configuration; pinned to its creation-time dataset version |
| Run | Experiment, example, and repetition number (1-based) |
| Evaluation | Run and evaluation name |
| ATIF trace | Harbor job ID and saved terminal trial UUID |
| OTLP attempt trace, planned | Deterministic from the Harbor job and physical trial-attempt identity |

A Harbor job is one execution across all configured agents and models. A job with N agent/model configurations creates N experiments on one dataset.

The job ID separates executions. Two executions of the same benchmark must create separate experiments. Otherwise, their runs would use the same `(experiment, example, repetition)` keys. Successful Phoenix runs cannot be changed, so every run in the second execution would conflict. Phoenix represents comparison over time as separate experiments on the same dataset.

Harbor does not expose logical repetition numbers. At job start, the adapter walks the trial plan in order and counts repetitions by `(experiment identity, task ID)`. Never use completion order. Physical retries keep the same logical repetition even though each retry gets a new trial UUID.

Repetition numbers start at 1 because Phoenix rejects zero. Set the experiment's `repetitions` value to Harbor's configured attempt count. Phoenix uses this value for missing-run and completeness reports.

This key works only when task IDs and experiment identities are unique. Reject duplicates before writing to Phoenix.

Agent and model identity includes readable names and a stable digest of configuration that affects
behavior. The digest excludes scheduling and logging fields. It includes environment variable names
but not their values. Different digested configurations must create different experiments even when
their display names match.

Trace IDs must be globally unique. Phoenix joins a span to the existing trace with that ID, including that trace's project. An ID collision can silently send spans to the wrong project.

### Idempotent replay and resume

The plugin supports replay and resume when only one process ingests a Harbor job:

- synchronize the full dataset snapshot with stable external task IDs;
- find experiments by immutable identity metadata: create one for zero matches, reuse one match, and fail with the IDs of all matches when there is more than one;
- preload experiment runs by Phoenix example `node_id` and repetition;
- reuse a matching successful run after checking its stored terminal trial ID, outcome, and trace ID;
- retry or upgrade failed runs; and
- upsert all expected evaluations by run and evaluation name.

Phoenix cannot filter experiments by metadata on the server. The plugin must list all experiments for the dataset and filter them locally. This work grows with the number of experiments. A server-side identity filter or idempotency key is future work.

If run creation returns `409`, fetch the run and validate it. Do not ignore a conflict without checking the stored data. This also recovers from a crash after run creation but before all evaluations are written.

Successful runs are immutable. Phoenix returns `409` if code tries to update a run with no stored error. Only errored runs can be updated. If a successful run has a different trial ID or trace ID, fail and show both values. The plugin cannot repair it.

Evaluations returned through the experiment read API have placeholder IDs. Do not use them to find stored rows. Upsert by `(run, evaluation name)`.

Finding and then creating an experiment is not atomic. Run only one ingester for each Harbor job.
Concurrent ingestion across processes or machines requires a Phoenix server idempotency feature
and is out of scope.

### Failure policy

Selecting the Phoenix plugin makes successful Phoenix recording a requirement. This avoids spending compute on a job that will not be recorded. Users can omit the plugin when they want to run Harbor without Phoenix.

- At `on_job_start`, validate dataset identity, Harbor compatibility, the Phoenix connection, and initial writes. Raise a clear error to stop the job before trial compute.
- The plugin configures HTTPX's built-in retries for `ConnectError` and `ConnectTimeout` while establishing a connection. It does not retry HTTP responses or other transport errors itself. Any run or evaluation write that still fails raises and stops the job, except for the handled run-conflict recovery path. Completed Phoenix records remain available and Harbor persists terminal trial results for resume.
- ATIF discovery, conversion, and upload are best-effort. Missing or invalid files produce warnings; valid roots can still contribute to the trace. If construction or upload fails, record the run and evaluations without a trace. Tracing failures do not change the run error or `infra_ok`. A successful run without a trace cannot gain that link on replay.
- Keep one terminal-failure flag. After it is set, make later trial-end callbacks no-ops while Harbor cancels sibling trials.
- Record every top-level and step exception in the run error and set `infra_ok = 0`. Keep any verifier rewards Harbor produced alongside the exception, and do not rewrite the exception as `reward = 0`. Use the same collected exception list for the trace root's `ERROR` status and status message.
- Do not ingest an attempt that Harbor will retry. Until Harbor exposes a terminal-attempt event, count START events by logical trial name and apply Harbor's retry rules.

The adapter checks capabilities at runtime. Set a minimum Harbor version but no upper bound. Test the minimum version, latest stable release, and Harbor `main`. Add a temporary upper bound only for a known released incompatibility.

## 8. Configuration

Pass settings through Harbor's `--plugin-kwarg` option.

| Key | Default | Purpose |
|---|---|---|
| `dataset` | inferred from Harbor | Phoenix dataset name override |
| `endpoint` | `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix endpoint |
| `api_key` | `PHOENIX_API_KEY` | Phoenix authentication |
| `trace_mode` | `atif` | Current: `atif` or `null`; planned: `atif`, `otlp`, or `null` |
| `experiment_name` | unset | Exact name for a job with one agent configuration |
| `experiment_name_template` | `{job.name} · {agent.name} · {agent.model}` | Experiment naming |

Experiment names must distinguish agent/model configurations in Phoenix's compare view. `{job.name}` defaults to a Harbor timestamp. If two configurations still have the same name, append a short configuration digest. This can happen when they differ only in skills, environment, or keyword arguments.

Planned OTLP mode will not inject exporter configuration. The user will supply endpoint,
credentials, and `openinference.project.name` through Harbor's per-agent environment, and the
plugin will validate them at job start (§5.1).

## 9. Implementation scope

### Included

- Harbor plugin entry point and compatibility adapter
- One configured Harbor dataset, or a direct-task-only job with an unambiguous synthetic name
- Dataset and example upsert with digest-based versioning
- One experiment for each agent and model
- Streaming experiment runs with deterministic repetitions
- Dense aggregate scores and sparse step-level scores
- Package-internal pure ATIF conversion and Harbor-specific trace construction
- ATIF trace conversion and experiment-run linkage
- One trial-level ATIF trace for single-step and multi-step tasks
- Safe continuation and sub-agent graph traversal
- Deterministic partial-upload repair
- Stop the job on dataset, experiment, run, or evaluation write failures; warn on ATIF failures
- Contract tests for the Harbor APIs the plugin reads, plus an E2E target that accepts a Harbor version override

### Deferred

- OTLP project routing and adapter-assisted trace-to-run linkage (§5.1 and §5.2)
- Attribution of individual physical retry attempts
- Post-hoc ingestion command
- Harbor lifecycle and verifier wrapper spans
- Linking traces emitted independently by instrumented verifiers
- Native Phoenix summaries for pass^k and repetition aggregates
- Multi-trace runs and any `trace_layout` variant other than one trace per run

### Acceptance criteria

1. A public multi-step Harbor task creates a Phoenix experiment with runs, dense scores, step scores, and clickable ATIF traces without a Phoenix server change.
2. A two-agent job creates two experiments over one dataset and supports side-by-side comparison.
3. Sequential replay or resume creates no duplicate dataset versions, experiments, successful runs, evaluations, or traces. If several experiments match, the job fails with a clear error.
4. Changing a task creates a new dataset version, and each experiment remains pinned to the correct version.
5. Invalid Phoenix configuration or an unavailable endpoint stops Harbor before trials begin. Losing the endpoint later stops the job, while runs already streamed to Phoenix remain available.
6. Users can identify which step failed from the stored, unscaled step rewards.
7. When deferred OTLP mode is implemented, a missing or invalid endpoint or project stops the job before trial compute. The error shows the exact flags to add.
8. When deferred OTLP mode is implemented, a Phoenix-owned multi-step OTLP adapter creates one trace for the final attempt. The plugin links it by report-back, with a correlation query as fallback.

Criterion 8 covers only Phoenix-owned adapters. Generic OTLP for third-party agents remains blocked (§5.3).

## 10. Future work

Possible follow-ups:

- a public Harbor API for reading resolved tasks, trial assignments, and attempt numbers
- more ways to aggregate multi-step rewards
- step-aware verification events
- a post-hoc ingestion command for backfill and debugging
- trace links for instrumented verifiers
- native Phoenix aggregation across repetitions
- richer links between traces and external trial IDs
- a server-side experiment identity filter or idempotency key
- partial span acceptance or span upsert

## 11. Compatibility assumptions

These behaviors need compatibility checks as Harbor and Phoenix change:

| Assumption | Basis | Risk if wrong |
| --- | --- | --- |
| Harbor's private job-plan attributes keep a stable shape | Contract tests run against the installed version; E2E defaults to 0.21.0 | A Harbor refactor breaks ingestion |
| START counts and public retry settings identify the final attempt | Source-derived behavior covered by plugin tests; not a public contract | The plugin writes an intermediate attempt or skips a final attempt |
| A trial-end hook error stops the job and cancels sibling trials | Source review and an isolated hook test; not tested in a container job | Recording may not fail closed |
| Agents omit `trajectory_id`; steps share `session_id`; some session IDs are constant | Harbor v0.18.0 source and examples | Handled by always setting both IDs |
| Multi-step tasks save step-local trajectories, or a cumulative snapshot under native resume | Loader tests and the Claude Code E2E case | Step trajectories may be missing or have the wrong parent |
| All ATIF agents follow the identity behavior above | About 10 of 28 agents sampled, plus the shared base class | Handled by always namespacing `session_id` |
| Phoenix rejects a batch with an existing span ID and silently drops duplicates within a batch | Verified in Phoenix source | Replay fails or loses spans |

Known gap: if Harbor crashes after saving an intermediate attempt but before starting its retry, resume may treat that attempt as complete. The plugin cannot repair this. Harbor should expose a terminal-attempt event.
