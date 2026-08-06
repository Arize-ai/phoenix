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

---

## 1. Summary

Build a Harbor plugin that records Harbor evaluation jobs in Phoenix. Harbor remains responsible for running agents and verifiers. Phoenix stores the tasks, experiment runs, scores, and traces so teams can compare results across agents, models, attempts, and time.

The plugin will:

- infer a Phoenix dataset from the Harbor dataset;
- create one Phoenix experiment for each agent and model in a job;
- record each Harbor trial as an experiment run;
- store Harbor's aggregate reward and infrastructure status as dense evaluation scores;
- store other task- and step-level rewards as sparse diagnostic scores; and
- link each run to an ATIF or live OTLP trace when the selected trace mode supports it.

ATIF is the default trace mode because it works without agent instrumentation. OTLP mode supports applications that already emit OpenTelemetry spans and provides live traces during a trial.

The prototype uses existing Phoenix dataset, experiment, evaluation, and trace-ingestion APIs, plus a small public Phoenix-client ATIF conversion primitive. It does not require a Phoenix server change.

## 2. Goals and boundaries

### Goals

- One-command setup through `harbor run --plugin phoenix`.
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
- The prototype accepts exactly one configured Harbor dataset and no direct tasks. It rejects multi-dataset, direct-task-only, and mixed jobs before trials begin.
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
| ATIF trajectory or OTLP spans | Trace                       | Linked to the experiment run when available                       |

Use one Phoenix dataset for one Harbor dataset. Require exactly one configured dataset and zero direct tasks; Harbor's flattened resolved task plan does not retain enough provenance to support multiple or mixed sources safely. Infer the dataset name from Harbor's resolved dataset configuration:

- use the published dataset name for `--dataset`;
- use the declared dataset name or directory name for `--path`; and
- use the selected dataset name for `--repo`.

The optional `dataset` plugin setting overrides this value. If Harbor does not provide an unambiguous name, the plugin raises a clear error and stops the Harbor job before trials begin.

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

Keep the fields an agent needs to identify and perform the task in `input`. Store the remaining JSON-safe Harbor task fields and configuration in example `metadata`, including the full task digest. Do not duplicate those fields in `input`. `output` is an empty object because Harbor verifies the resulting environment state instead of comparing the agent's response with a reference output.

Synchronize the complete resolved task snapshot on every job start, using each Harbor task ID as the stable external example `id`. Phoenix returns a separate `node_id` for each example; retain that value and use it when logging experiment runs. The digest covers the complete task package, including the solution, environment, tests, and steps. An unchanged full snapshot reuses the current Phoenix dataset version, while any task addition, removal, or digest change creates a new version and preserves exact provenance.

## 4. Plugin design

Phoenix owns and releases the standalone `arize-phoenix-harbor` package from `packages/phoenix-harbor/` in the Phoenix monorepo. Its `phoenix_harbor` module registers `phoenix` in Harbor's `harbor.plugins` entry-point group. Its main components are:

1. **Harbor compatibility adapter.** Reads the resolved task and trial plan and converts it to a stable internal model. It is the only component that accesses Harbor's private job-plan fields. It validates all required fields before ingestion begins.
2. **Mapping core.** Converts the internal Harbor model into Phoenix datasets, experiments, runs, evaluations, and trace links.
3. **Phoenix job plugin.** Connects Harbor lifecycle hooks to the mapping core and stops the job when required Phoenix recording fails.

The package supports Harbor `>=0.18.0` for ordinary jobs and checks required capabilities at runtime. Regrade/source-job plans are unsupported until mapped explicitly. The package uses `arize-phoenix-client>=2.10.0`; startup preflight reports an actionable error when the connected Phoenix server lacks required capabilities such as stable external dataset example IDs.

### Job start

At `on_job_start`, the plugin:

1. resolves the complete task and trial plan;
2. synchronizes the complete dataset example snapshot;
3. recovers or creates one experiment for each effective agent and model configuration, pinned to the current dataset version;
4. reads the server-assigned project name for each experiment;
5. derives a stable repetition number for every trial; and
6. in OTLP mode, verifies that the installed Harbor/adapter path can provide runtime-only per-trial values before agent construction, then creates each physical attempt's trace and root-span identity and injects its project and W3C trace context.

Creating examples before experiments is required because a Phoenix experiment is pinned to a dataset version when it is created.

### Trial end

Harbor may emit an END event for a failed physical attempt before retrying the same logical trial. The compatibility adapter counts START events and mirrors Harbor's configured retry policy. It performs no Phoenix or ATIF writes for an intermediate retryable END event. The terminal successful, exhausted, or non-retryable attempt retains the logical trial's precomputed repetition number.

At the terminal end of each logical trial, the plugin:

1. uploads the ATIF trajectory or submits the plugin-owned OTLP root span;
2. resolves the trace ID when available;
3. writes the experiment run with its output, timing, trace link, and error status; and
4. writes the dense and sparse evaluation scores emitted by Harbor.

The plugin streams each result as its trial ends. This provides live progress and preserves completed work if the job stops early.

### Job end

`on_job_end` may write best-effort summaries, but no correctness requirement depends on it. Harbor suppresses job-end plugin errors, Phoenix derives run and evaluation counts, and required records have already been written at job start or terminal trial end.

## 5. Trace modes

Set `trace_mode` explicitly to `atif`, `otlp`, or `none`. The plugin does not auto-detect tracing because combining partial live spans with a converted ATIF trajectory could create duplicate traces.

| Behavior | `atif` (default) | `otlp` |
|---|---|---|
| Agent instrumentation required | No; agent must produce ATIF | Yes; standard OpenTelemetry instrumentation is sufficient |
| Live during the trial | No; uploaded when the trial ends | Yes |
| Sandbox endpoint and credentials | Not required | Required |
| Network access from sandbox | Not required | Required |
| Destination | Experiment's Phoenix project | Experiment's Phoenix project |
| Run linkage | Deterministic from the ATIF trajectory | Deterministic when the agent accepts the injected W3C context |

### ATIF mode

The Phoenix client exposes a public, pure ATIF conversion function that accepts one or more trajectories and an optional supplied parent span context, returning the converted Phoenix spans without uploading them. The existing ATIF upload helper remains a convenience wrapper. Harbor-specific identity, root creation, and replay recovery remain in the plugin rather than the general client.

The plugin creates one deterministic trial-level AGENT root, converts saved ATIF trajectories beneath it, and submits the root and children to the experiment's Phoenix project. If an older trajectory omits `trajectory_id`, the plugin adds a deterministic value derived from the full logical trial identity and stable step ordinal without modifying the source file. Producer-supplied trajectory and session identities are preserved.

For a multi-step task, the plugin creates one trial-level trace and places each step trajectory beneath the same root. One logical trial therefore appears as one experiment run with one trace.

Deterministic IDs do not by themselves make trace upload idempotent. On replay, the plugin verifies existing deterministic span IDs, retries only missing spans, and waits until every expected span is queryable before linking and writing the experiment run. Invalid or conflicting spans fail ingestion rather than being treated as benign duplicates.

### OTLP mode

Before each physical attempt, the plugin creates a deterministic trace ID and root span ID. It passes the following values to the trial environment through a runtime-only overlay that is excluded from Harbor's persisted configuration, locks, results, and resume equality:

- the experiment's Phoenix project name;
- a W3C `traceparent` for the trial root; and
- `harbor.job.id`, `harbor.trial.id`, and `harbor.task.id` OpenTelemetry resource attributes.

The runtime overlay must be applied after Harbor allocates the actual trial ID but before agent and environment construction. A current Harbor version or adapter path that cannot provide this capability fails OTLP preflight and recommends ATIF or `none`; the plugin must not mutate persisted private trial configuration as a fallback.

An agent adapter that extracts the W3C context runs the instrumented application beneath the plugin-owned root. All steps then share one trace, and the plugin already knows which trace to attach to the experiment run. Applications do not need Phoenix-specific tracing code. The plugin submits its prebuilt root after child execution; the root's status represents infrastructure outcome, not whether behavioral reward was zero.

Each physical retry uses a distinct trace identity. Only the terminal attempt's trace is linked to the logical experiment run. Earlier retry traces remain available in the experiment project with their Harbor correlation attributes and infrastructure error status; they are not rewritten as additional experiment runs.

If an adapter cannot accept the context but exposes the trace IDs it emitted, the plugin links the first trace and records the ordered, deduplicated trace list in the run output envelope with `trace_layout: "separate_steps"`. If neither method is available, OTLP preflight fails before trials begin.

The injected Harbor attributes provide a standard correlation vocabulary, but the prototype does not depend on querying them for trace linkage.

## 6. Evaluation scores

Harbor can use a different verifier for every task, so not every score is meaningful across an entire dataset. The plugin separates scores into dense summary metrics and sparse diagnostic metrics.

| Score | Coverage | Purpose |
|---|---|---|
| `reward` | Every behaviorally completed run | Harbor's aggregate behavioral score; suitable for cross-task summaries |
| `infra_ok` | Every attempted run | Infrastructure success rate |
| `verifier.<reward_key>` | Only where Harbor emits it | Other final-verifier diagnostics |
| `<step_name>.<reward_key>` | Only where Harbor emits it | Step-level diagnosis within a task |

Rules:

- Read scores from `step_results` as well as the final verifier result.
- Determine infrastructure status from the top-level result and every step result. Any recorded exception makes `infra_ok = 0`; a valid behavioral reward of zero with no exception keeps `infra_ok = 1`.
- Use the final verifier's `reward` value as Harbor's aggregate when present. If `reward` is absent, accept the sole final-verifier value as the aggregate. Multiple final values without `reward` are ambiguous and fail that trial before its run or evaluations are written.
- Store other final-verifier rewards as `verifier.<reward_key>` and step rewards as `<step_name>.<reward_key>`. Validate reserved/generated name collisions before writing.
- Store step rewards in their original numeric scale.
- Keep infrastructure failures separate from behavioral failures.
- Do not add a built-in `all_steps_passed` or `tool_calls` score. Tasks can emit task-specific scores when useful.
- Store the Harbor terminal trial ID, token usage, cost, available phase timings, trace layout, and auxiliary trace IDs in a compact JSON-safe run `output` envelope. The public Phoenix run API has no run-metadata argument.

Phoenix can calculate token cost and latency from traces. Pass rate, pass^k, confidence intervals, and thresholded release gates can be calculated from stored rewards outside ingestion without changing the source data.

## 7. Identity and failure handling

### Stable identity

| Object | Stable key |
|---|---|
| Dataset | Resolved Harbor dataset identity or explicit override |
| Example | Task ID within the dataset |
| Example version | Full Harbor task digest |
| Experiment | Harbor job ID, dataset version, and effective agent/model configuration |
| Run | Experiment, example, and repetition number |
| Evaluation | Run and evaluation name |
| ATIF trace | Deterministic from the complete Harbor job and logical trial identity |
| OTLP attempt trace | Deterministic from the Harbor job and physical trial-attempt identity |

Harbor does not expose the logical repetition number directly. The compatibility adapter derives repetitions from the resolved trial plan at job start, where attempts are created in a stable outer loop. It never assigns repetitions by completion order. Physical Harbor retries keep the same logical repetition even though Harbor assigns each retry a new trial UUID.

Agent and model identity includes readable names plus a deterministic, secret-free digest of behavior-affecting resolved configuration. Two configurations that share display names but differ in effective behavior must not collapse into one experiment.

### Idempotent replay and resume

The prototype guarantees sequential replay and resume for one active ingester per Harbor job:

- synchronize the full dataset snapshot with stable external task IDs;
- discover experiments by immutable identity metadata, creating on zero matches, reusing one match, and failing with all matching IDs on multiple matches;
- preload experiment runs by Phoenix example `node_id` and repetition;
- reuse a matching successful run after validating its stored Harbor terminal trial ID and canonical outcome/trace identity;
- retry or upgrade failed runs; and
- upsert all expected evaluations by run and evaluation name.

If run creation races and receives `409`, refetch and apply the same matching/conflict validation. Never swallow a conflict without verifying the stored run. This also repairs a crash after writing a run but before all evaluations.

Experiment discovery followed by creation is not atomic. The prototype requires one active ingester per Harbor job and does not promise idempotency for simultaneous ingestion of the same job across processes or machines. When a stable Harbor job directory is available, the plugin should use a best-effort local lock; a distributed guarantee would require a Phoenix server idempotency feature and is out of scope.

### Failure policy

Selecting the Phoenix plugin makes successful Phoenix recording a requirement. This avoids spending compute on a job that will not be recorded. Users can omit the plugin when they want to run Harbor without Phoenix.

- At `on_job_start`, validate the dataset identity, Harbor compatibility, trace-mode requirements, Phoenix connection, and initial writes. Raise a clear error if any check fails.
- After trials begin, surface any required Phoenix write or trace-linkage failure so Harbor stops the job. Runs already streamed to Phoenix remain available.
- Record an infrastructure exception as a run error and `infra_ok = 0`; do not rewrite it as `reward = 0`.
- Do not ingest a retryable intermediate Harbor attempt. For current supported Harbor releases, the compatibility adapter counts START events by logical trial name and mirrors Harbor's public include/exclude/maximum retry policy. It should migrate to a queue-owned terminal-attempt event when Harbor exposes one.

The compatibility adapter checks capabilities at runtime. The package declares a minimum Harbor version without an upper bound. Automated tests cover the minimum version, the latest stable release, and Harbor's main branch. A temporary upper bound is appropriate only for a known released incompatibility.

## 8. Configuration

Pass settings through Harbor's `--plugin-kwarg` option.

| Key | Default | Purpose |
|---|---|---|
| `dataset` | inferred from Harbor | Phoenix dataset name override |
| `endpoint` | `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix endpoint |
| `api_key` | `PHOENIX_API_KEY` | Phoenix authentication |
| `trace_mode` | `atif` | `atif`, `otlp`, or `none` |
| `experiment_name_template` | `{job_name}-{job_id:.8} · {agent}` | Experiment naming |
| `project` | experiment's project | Optional trace-project override |

In OTLP mode, the plugin passes the resolved project and trial context to the exporter through the capability-gated runtime-only overlay before the agent starts.

## 9. Prototype scope

### Included

- Harbor plugin entry point and compatibility adapter
- Exactly one configured Harbor dataset and no direct tasks
- Dataset and example upsert with digest-based versioning
- One experiment for each agent and model
- Streaming experiment runs with deterministic repetitions
- Dense aggregate scores and sparse step-level scores
- ATIF trace conversion and experiment-run linkage
- OTLP project routing, plugin-owned physical-attempt identity, runtime-only W3C context injection, and linkage when Harbor and the adapter expose the required pre-construction capability
- One trial-level trace for single-step and multi-step tasks
- Fail-closed validation and ingestion
- Compatibility tests against supported Harbor versions

### Deferred

- Post-hoc ingestion command
- Harbor lifecycle and verifier wrapper spans
- Linking traces emitted independently by instrumented verifiers
- Native Phoenix summaries for pass^k and repetition aggregates

### Acceptance criteria

1. A public multi-step Harbor task produces a Phoenix experiment with runs, dense and step-level scores, and clickable ATIF or OTLP traces without a Phoenix server change.
2. A two-agent job creates two experiments over one dataset and supports side-by-side comparison.
3. Sequential replay or resume for the same job creates no duplicate dataset versions, experiments, successful runs, evaluations, or traces; multiple matching experiments fail explicitly.
4. Changing a task creates a new dataset version, and each experiment remains pinned to the correct version.
5. Invalid Phoenix configuration or an unavailable endpoint stops Harbor before trials begin. Losing the endpoint later stops the job, while runs already streamed to Phoenix remain available.
6. Users can identify which step failed from the stored, unscaled step rewards.
7. A multi-step OTLP adapter that accepts the runtime-only W3C context produces one trace for the complete terminal attempt. OTLP preflight fails before compute when the Harbor/adapter path cannot inject that context safely.

## 10. Future work

After the prototype proves the design, consider:

- a public, read-only Harbor job-plan API with resolved tasks, trial assignments, and attempt indexes;
- more Harbor strategies for aggregating multi-step rewards;
- step-aware verification lifecycle events;
- a post-hoc ingestion command for backfill and debugging;
- trace linkage for already-instrumented verifiers;
- native Phoenix aggregation across repetitions; and
- richer support for correlating traces with external trial identities.

These items can improve compatibility or analysis, but none blocks the prototype.
