# Phoenix plugin for Harbor — design specification

**Status:** Proposed for prototype implementation

## Contents

- [Summary](#1-summary)
- [Goals and boundaries](#2-goals-and-boundaries)
- [Data model](#3-data-model)
- [Plugin design](#4-plugin-design)
- [Trace modes](#5-trace-modes)
- [Evaluation scores](#6-evaluation-scores)
- [Identity and failure handling](#7-identity-and-failure-handling)
- [Configuration](#8-configuration)
- [Prototype scope](#9-prototype-scope)
- [Future work](#10-future-work)
- [Assumptions and unverified contracts](#11-assumptions-and-unverified-contracts)

---

## 1. Summary

Build a Harbor plugin that records Harbor evaluation jobs in Phoenix. Harbor remains responsible for running agents and verifiers. Phoenix stores the tasks, experiment runs, scores, and traces so teams can compare results across agents, models, attempts, and time.

The plugin will:

- infer a Phoenix dataset from the Harbor dataset;
- create one Phoenix experiment for each agent and model in a job;
- record each Harbor trial as an experiment run;
- store Harbor's aggregate reward and infrastructure status as dense evaluation scores;
- store other task- and step-level rewards as sparse diagnostic scores; and
- optionally link each run to a trace reconstructed from Harbor's persisted ATIF artifacts.

Tracing is disabled by default. Stage 2 adds opt-in ATIF reconstruction without requiring agent
instrumentation. Native OTLP ingestion remains deferred.

ATIF backfill requires one narrow Phoenix server change: the experiment-run POST may attach a
validated trace ID once to an otherwise immutable successful run. The plugin composes the existing
package-internal pure ATIF conversion and reparenting helpers, so it does not add a new public
conversion API.

## 2. Goals and boundaries

### Goals

- One-command setup through `harbor run --plugin arize-phoenix`.
- Support any Harbor dataset and agent that meets the selected trace mode's requirements.
- Preserve Harbor's task, trial, attempt, agent, model, and reward identities.
- Show comparable results across agents and models.
- Preserve completed results when a long-running job is interrupted.
- Stop before spending trial compute when required Phoenix recording cannot be set up.
- Make repeated ingestion idempotent.

### Boundaries

- Harbor is the execution harness. Phoenix does not rerun these experiments or select Harbor tasks.
- Harbor's verifier remains the authority for rewards. The plugin does not calculate a second aggregate reward.
- Dataset example `output` remains an empty object. A Harbor solution is an executable way to produce an end state, not a reference response.
- The prototype accepts one Harbor dataset or a direct-task-only job. It rejects jobs that
  combine both sources. A single direct task gets a namespaced synthetic dataset name;
  several direct tasks require an explicit `dataset` plugin setting.
- The prototype does not create wrapper spans for Harbor lifecycle phases or verifiers.
- The prototype does not include a post-hoc ingestion command.

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
| Trial exception               | Run error                   | Kept separate from behavioral failure                             |
| Trial `reward`                | Dense evaluation            | Stored on behaviorally completed runs                             |
| Infrastructure status         | Dense `infra_ok` evaluation | Stored on every attempted run                                     |
| Step reward                   | Sparse evaluation           | Named `<step_name>.<reward_key>`                                  |
| ATIF trajectory               | Trace                       | Linked to the experiment run when ATIF mode succeeds               |

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
    "...": "<other task fields and configuration>"
  }
}
```

Put only the fields needed to identify and perform the task in `input`. Put other JSON-safe task fields in `metadata`, including the full task digest. Keep `output` empty because Harbor checks the environment state, not a reference response.

At each job start, synchronize the full task set. Use the Harbor task ID as the stable external example `id`. Phoenix returns a separate `node_id`; save it for logging experiment runs.

The task digest covers the solution, environment, tests, and steps. Phoenix reuses the current dataset version when the full task set is unchanged. Adding, removing, or changing a task creates a new version.

The job lock does not exist at `on_job_start`. The compatibility adapter builds it in memory from the resolved config, trial configs, and task downloads, then reads the task digests.

## 4. Plugin design

The plugin lives in `arize-phoenix-client` as `phoenix.client.harbor` and registers `arize-phoenix` in Harbor's `harbor.plugins` entry-point group. Harbor is imported only when the plugin is selected.

The package has three main components:

1. **Harbor compatibility adapter.** Reads the resolved task and trial plan and converts it to a stable internal model. It is the only component that accesses Harbor's private job-plan fields. It validates all required fields before ingestion begins.
2. **Mapping core.** Converts the internal Harbor model into Phoenix datasets, experiments, runs, evaluations, and trace links.
3. **Phoenix job plugin.** Connects Harbor lifecycle hooks to the mapping core and stops the job when required Phoenix recording fails.

The package supports normal jobs on Harbor `>=0.21.0`. It checks required capabilities at runtime. Regrade and source-job plans are not supported.

Phoenix version requirements depend on the feature:

| Requirement | Floor | Status |
| --- | --- | --- |
| Experiment/run/evaluation logging | `arize-phoenix-client>=2.10.0` | Released |
| Stable external dataset example IDs | Phoenix server `>=15.0` | Released |
| ATIF replay verification by span ID (§5) | Phoenix server `>=19.6` | Released; ATIF-mode-only floor |
| One-time trace attachment to a successful run | Current server | Older servers retain an unlinked trace and warn |

Phoenix server `>=19.6` is required only for ATIF replay queries. The plugin degrades safely when
the server does not support successful-run trace attachment.

### Job start

At `on_job_start`, the plugin:

1. resolves the complete task and trial plan;
2. synchronizes the complete dataset example snapshot;
3. recovers or creates one experiment for each effective agent and model configuration, pinned to the current dataset version;
4. reads the server-assigned project name for each experiment;
5. derives a stable repetition number for every trial.

The plugin cannot list physical attempts at job start. Harbor creates retries later, and trial UUIDs
do not exist until trial construction. Stage 2 ingests only the terminal logical trial result.

Creating examples before experiments is required because a Phoenix experiment is pinned to a dataset version when it is created.

### Trial end

Harbor may emit an END event for a failed attempt before it starts a retry. The event does not include the attempt number or say whether the attempt is terminal. The compatibility adapter reconstructs this decision. It counts START events for each logical trial and applies Harbor's `RetryConfig` rules in this order: exclude, include, then `max_retries`.

`RetryConfig` is public, but this decision logic is private Harbor behavior. Contract tests must cover all three supported Harbor versions. Do not write Phoenix or ATIF data for an attempt that will be retried. The final attempt keeps the logical trial's precomputed repetition number.

This logic has three limits:

- Only a top-level `TrialResult.exception_info` triggers a retry. A failure found only on a `StepResult` is terminal and must be ingested.
- `CancelledError` is never retryable.
- Harbor may crash after saving an intermediate result but before starting its retry. On resume, Harbor may treat that result as complete. The plugin cannot detect or repair this case.

At the terminal end of each logical trial, the plugin:

1. reconstructs and uploads the ATIF trace when `trace_mode=atif`;
2. resolves the trace ID when available;
3. writes the experiment run with its output, timing, trace link, and error status; and
4. writes the dense and sparse evaluation scores emitted by Harbor.

The plugin streams each result as its trial ends. This provides live progress and preserves completed work if the job stops early.

### Job end

`on_job_end` may write optional summaries. Required data must already be written because Harbor suppresses errors from this hook. Phoenix can derive run and evaluation counts.

## 5. Trace modes

Set `trace_mode` explicitly to `atif` or `none`. The plugin does not auto-detect tracing. Native
OTLP support is deferred.

| Behavior | `none` (default) | `atif` |
|---|---|---|
| Agent instrumentation required | No | No; the agent must persist ATIF |
| Trace upload | None | At terminal trial end |
| Sandbox Phoenix credentials | Not required | Not required |
| Destination | n/a | Experiment's Phoenix project |
| Run linkage | None | Deterministic trace ID from the Harbor trial identity |
| Trial-scoped root owned by the plugin | No | Yes |

### ATIF mode

ATIF mode uses the existing package-internal pure conversion and common-parent helpers. The plugin
needs the spans before upload so it can check deterministic IDs, repair partial uploads, and link
the run only after every expected span is queryable.

Use the package-internal pure conversion helpers to:

- validates and converts one or more trajectories;
- returns spans without uploading them;
- preserves ATIF v1.7 sub-agent flattening and cross-document references; and
- reparents every disconnected trajectory root under one Harbor-owned trial root.

The conversion layer does not use a client. Harbor-specific discovery, normalization, deterministic
identity, and upload-repair behavior stay private to the plugin.

The plugin creates one deterministic trial-level AGENT root. It converts saved trajectories under that root and sends all spans to the experiment's Phoenix project. Harbor-specific identity and replay logic stay in the plugin.

For each in-memory trajectory, the plugin:

- sets `trajectory_id` from the logical trial identity and step number; and
- prefixes `session_id` with the same trial identity while keeping the original value as a suffix.

It does not change the source file.

Always set both values. Harbor v0.18.0 source shows why:

- **Agents do not set `trajectory_id`.** Without it, older ATIF trajectories derive span IDs from `session_id` alone.
- **All steps in one trial share a `session_id`.** Harbor constructs the agent once per trial and reuses it for every step.
- **Some agents use a constant `session_id`.** These values would collide across trials and jobs.

The plugin must namespace `session_id` even when it sets `trajectory_id`. Phoenix resolves sessions from `session_id` without a project filter. A constant value could otherwise group unrelated trials into one session.

Both IDs must be globally unique and stable across replays. Derive them from the Harbor job ID, task ID, repetition, and step number.

For a multi-step task, the plugin creates one trial-level trace and places each step trajectory beneath the same root. One logical trial therefore appears as one experiment run with one trace.

Deterministic IDs do not make span upload idempotent. Phoenix has two important ingestion behaviors:

- If **any** span ID already exists, Phoenix rejects the full request. Do not send an existing span again.
- Phoenix does not report duplicate span IDs **within one request**. It silently drops them. Validate that all IDs in a request are unique.

On replay, query the expected span IDs and send only missing spans. Wait until every span is queryable before writing the run and trace link. This query requires Phoenix server `>=19.6` in `atif` mode.

Audio message parts introduced in ATIF 1.8 are preserved as structured span metadata and rendered as
readable placeholders. They do not invent OpenInference media URLs for local Harbor paths.

ATIF upload is best effort after trial execution. Discovery, conversion, upload, visibility polling,
or attachment failure emits a trial-scoped warning but does not suppress the run or its evaluations.
The plugin uploads only missing deterministic span IDs, waits until the complete trace is queryable,
and attaches the confirmed trace ID to the successful run once.

## 6. Evaluation scores

Harbor can use a different verifier for every task, so not every score is meaningful across an entire dataset. The plugin separates scores into dense summary metrics and sparse diagnostic metrics.

### Behaviorally completed

A run is **behaviorally completed** when Harbor produced a verifier result. The plugin records each reward under its exact Harbor key. Only a verifier result with a literal `reward` key produces a Phoenix evaluation named `reward`.

| Harbor terminal state | Top-level exception | Step exceptions | Behaviorally completed | `reward` | `infra_ok` |
| --- | --- | --- | --- | --- | --- |
| Success | none | none | Yes | Harbor's aggregate | 1 |
| Behavioral zero | none | none | Yes | `0` | 1 |
| Single-step agent or verifier failure | present | n/a | No | not written | 0 |
| Multi-step failure recorded on a step | usually none | present | Yes, if a final verifier result exists | Harbor's aggregate | 0 |
| Fatal multi-step failure with no verifier result | none or present | present | No | not written | 0 |
| Cancellation | `CancelledError` | partial | No | not written | 0 |

Infrastructure status and behavioral completion are independent. A run can be behaviorally completed and still have `infra_ok = 0`.

`reward` is present only when Harbor emits that key. The plugin does not promote a sole differently named value or infer an aggregate from other keys. Consumers must check `reward` coverage before computing cross-task summaries.

| Score | Coverage | Purpose |
|---|---|---|
| `reward` | Only where Harbor emits it | Harbor's conventional behavioral score; suitable for cross-task summaries |
| `infra_ok` | Every attempted run | Infrastructure success rate |
| `<reward_key>` | Only where Harbor emits it | Trial-level verifier reward or diagnostic |
| `<step_name>.<reward_key>` | Only where Harbor emits it | Step-level diagnosis within a task |

Rules:

- Read scores from `step_results` as well as the final verifier result.
- Check the top-level result and every step result for infrastructure errors. Any exception sets `infra_ok = 0`. A reward of zero without an exception keeps `infra_ok = 1`.
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
| Experiment | Harbor job ID, dataset version, and effective agent/model configuration |
| Run | Experiment, example, and repetition number (1-based) |
| Evaluation | Run and evaluation name |
| ATIF trace | Deterministic from the complete Harbor job and logical trial identity |

A Harbor job is one execution across all configured agents and models. A job with N agent/model configurations creates N experiments on one dataset.

The job ID separates executions. Two executions of the same benchmark must create separate experiments. Otherwise, their runs would use the same `(experiment, example, repetition)` keys. Successful Phoenix runs cannot be changed, so every run in the second execution would conflict. Phoenix represents comparison over time as separate experiments on the same dataset.

Harbor does not expose logical repetition numbers. At job start, the adapter walks the trial plan in order and counts repetitions by `(experiment identity, task ID)`. Never use completion order. Physical retries keep the same logical repetition even though each retry gets a new trial UUID.

Repetition numbers start at 1 because Phoenix rejects zero. Set the experiment's `repetitions` value to Harbor's configured attempt count. Phoenix uses this value for missing-run and completeness reports.

This key works only when task IDs and experiment identities are unique. Reject duplicates before writing to Phoenix.

Agent and model identity includes readable names and a stable digest of configuration that affects behavior. Build the digest from an explicit allowlist. Never include credentials or environment secrets. Different configurations must create different experiments even when their display names match.

Trace IDs must be globally unique. Phoenix joins a span to the existing trace with that ID, including that trace's project. An ID collision can silently send spans to the wrong project.

### Idempotent replay and resume

The prototype supports replay and resume when only one process ingests a Harbor job:

- synchronize the full dataset snapshot with stable external task IDs;
- find experiments by immutable identity metadata: create one for zero matches, reuse one match, and fail with the IDs of all matches when there is more than one;
- preload experiment runs by Phoenix example `node_id` and repetition;
- reuse a matching successful run after checking its stored terminal trial ID, outcome, and trace ID;
- retry or upgrade failed runs; and
- upsert all expected evaluations by run and evaluation name.

Phoenix cannot filter experiments by metadata on the server. The plugin must list all experiments for the dataset and filter them locally. This work grows with the number of experiments. A server-side identity filter or idempotency key is future work.

If run creation returns `409`, fetch the run and validate it. Do not ignore a conflict without checking the stored data. This also recovers from a crash after run creation but before all evaluations are written.

Successful run payloads are immutable. The experiment-run POST has one narrow exception: it may set
an empty `trace_id` once after verifying that the trace exists in the experiment's project. Repeating
the same link is idempotent; attempting to replace it returns `409`. Output, timing, error, and
repetition remain unchanged.

Evaluations returned through the experiment read API have placeholder IDs. Do not use them to find stored rows. Upsert by `(run, evaluation name)`.

Finding and then creating an experiment is not atomic. Run only one ingester for each Harbor job. When a stable job directory exists, use a best-effort local lock. Concurrent ingestion across processes or machines requires a Phoenix server idempotency feature and is out of scope.

### Failure policy

Selecting the Phoenix plugin makes successful Phoenix recording a requirement. This avoids spending compute on a job that will not be recorded. Users can omit the plugin when they want to run Harbor without Phoenix.

- At `on_job_start`, validate dataset identity, Harbor compatibility, trace requirements, the Phoenix connection, and initial writes. Raise a clear error to stop the job before trial compute.
- The plugin configures HTTPX's built-in retries for `ConnectError` and `ConnectTimeout` while establishing a connection. It does not retry HTTP responses or other transport errors itself. Any run or evaluation write that still fails raises and stops the job, except for the handled run-conflict recovery path. Completed Phoenix records remain available and Harbor persists terminal trial results for resume.
- Keep one terminal-failure flag. After it is set, make later trial-end callbacks no-ops while Harbor cancels sibling trials.
- Record a top-level exception or a fatal step exception as a run error and `infra_ok = 0`; do not rewrite it as `reward = 0`. A step exception is fatal when Harbor reports no verifier result for that step. Other step exceptions affect `infra_ok` but not the native run error.
- Do not ingest an attempt that Harbor will retry. Until Harbor exposes a terminal-attempt event, count START events by logical trial name and apply Harbor's retry rules.

The adapter checks capabilities at runtime. Set a minimum Harbor version but no upper bound. Test the minimum version, latest stable release, and Harbor `main`. Add a temporary upper bound only for a known released incompatibility.

## 8. Configuration

Pass settings through Harbor's `--plugin-kwarg` option.

| Key | Default | Purpose |
|---|---|---|
| `dataset` | inferred from Harbor | Phoenix dataset name override |
| `endpoint` | `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix endpoint |
| `api_key` | `PHOENIX_API_KEY` | Phoenix authentication |
| `trace_mode` | `none` | `atif` or `none` |
| `experiment_name` | unset | Exact name for a job with one agent configuration |
| `experiment_name_template` | `{job.name} · {agent.name} · {agent.model}` | Experiment naming |
| `project` | experiment's project | Optional trace-project override |

Experiment names must distinguish agent/model configurations in Phoenix's compare view. `{job.name}` defaults to a Harbor timestamp. If two configurations still have the same name, append a short configuration digest. This can happen when they differ only in skills, environment, or keyword arguments.

## 9. Prototype scope

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
- ATIF 1.8 audio forward compatibility
- Safe continuation and sub-agent graph traversal
- Deterministic partial-upload repair and one-time successful-run trace attachment
- Fail-closed validation and ingestion
- Compatibility tests against supported Harbor versions

### Deferred

- Native OTLP tracing
- Attribution of individual physical retry attempts
- Post-hoc ingestion command
- Harbor lifecycle and verifier wrapper spans
- Linking traces emitted independently by instrumented verifiers
- Native Phoenix summaries for pass^k and repetition aggregates
- Multi-trace runs and any `trace_layout` variant other than one trace per run

### Acceptance criteria

1. A public multi-step Harbor task creates a Phoenix experiment with runs, dense scores, step scores,
   and clickable ATIF traces. Post-hoc attachment uses the narrow successful-run enrichment in the
   experiment-run POST.
2. A two-agent job creates two experiments over one dataset and supports side-by-side comparison.
3. Sequential replay or resume creates no duplicate dataset versions, experiments, successful runs, evaluations, or traces. If several experiments match, the job fails with a clear error.
4. Changing a task creates a new dataset version, and each experiment remains pinned to the correct version.
5. Invalid Phoenix configuration or an unavailable endpoint stops Harbor before trials begin. Losing the endpoint later stops the job, while runs already streamed to Phoenix remain available.
6. Users can identify which step failed from the stored, unscaled step rewards.
7. Running the credentialed Terminus-2 matrix first records an untraced run, then replays it in ATIF
   mode and attaches exactly one complete trace without duplicating runs, spans, or evaluations.

## 10. Future work

After the prototype proves the design, consider:

- a public Harbor API for reading resolved tasks, trial assignments, and attempt numbers
- more ways to aggregate multi-step rewards
- step-aware verification events
- a post-hoc ingestion command for backfill and debugging
- trace links for instrumented verifiers
- native Phoenix aggregation across repetitions
- richer links between traces and external trial IDs
- a server-side experiment identity filter or idempotency key
- partial span acceptance or span upsert

These items can improve compatibility or analysis, but none blocks the prototype.

## 11. Assumptions and unverified contracts

This design depends on private or unverified behavior. Add a contract test for each item:

| Assumption | Basis | Risk if wrong |
| --- | --- | --- |
| Harbor's private job-plan attributes keep a stable shape | Verified on 0.18.0, 0.20.0, and `main` | A Harbor refactor breaks ingestion |
| START counts and public retry settings identify the final attempt | Verified in source across three versions; not a public contract | The plugin writes an intermediate attempt or skips a final attempt |
| A trial-end hook error stops the job and cancels sibling trials | Source review and an isolated hook test; not tested in a container job | Recording may not fail closed |
| Agents omit `trajectory_id`; steps share `session_id`; some session IDs are constant | Harbor v0.18.0 source and examples | Handled by always setting both IDs |
| Multi-step tasks use one ATIF file per step | Observed; not a public contract | Step trajectories may be missing or have the wrong parent |
| All ATIF agents follow the identity behavior above | About 10 of 28 agents sampled, plus the shared base class | Handled by always namespacing `session_id` |
| Phoenix rejects a batch with an existing span ID and silently drops duplicates within a batch | Verified in Phoenix source | Replay fails or loses spans |

Known gap: if Harbor crashes after saving an intermediate attempt but before starting its retry, resume may treat that attempt as complete. The plugin cannot repair this. Harbor should expose a terminal-attempt event.
