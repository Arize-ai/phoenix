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

The prototype uses existing Phoenix dataset, experiment, evaluation, trace-ingestion, and ATIF APIs. It does not require a Phoenix server change.

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
- `expected_output` remains blank. A Harbor solution is an executable way to produce an end state, not a reference response.
- The prototype does not create wrapper spans for Harbor lifecycle phases or verifiers.
- The prototype does not include a post-hoc ingestion command.

## 3. Data model

| Harbor concept                | Phoenix concept             | Mapping                                                           |
| ----------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Dataset                       | Dataset                     | Name inferred from Harbor; optional override                      |
| Task                          | Dataset example             | Task ID, name, and instruction in input; other fields in metadata  |
| Task digest                   | Dataset version             | Full Harbor task digest                                           |
| Job × agent × model           | Experiment                  | One experiment for each agent and model                           |
| Trial                         | Experiment run              | One run for each task attempt                                     |
| Attempt                       | Repetition                  | Deterministic repetition number                                   |
| Trial exception               | Run error                   | Kept separate from behavioral failure                             |
| Trial `reward`                | Dense evaluation            | Stored on behaviorally completed runs                             |
| Infrastructure status         | Dense `infra_ok` evaluation | Stored on every attempted run                                     |
| Step reward                   | Sparse evaluation           | Named `<step_name>.<reward_key>`                                  |
| ATIF trajectory or OTLP spans | Trace                       | Linked to the experiment run when available                       |

Use one Phoenix dataset for one Harbor dataset. Infer its name from Harbor's resolved dataset configuration:

- use the published dataset name for `--dataset`;
- use the declared dataset name or directory name for `--path`; and
- use the selected dataset name for `--repo`.

The optional `dataset` plugin setting overrides this value. If Harbor does not provide an unambiguous name, the plugin raises a clear error and stops the Harbor job before trials begin.

Each task becomes a Phoenix dataset example with this shape:

```json
{
  "input": {
    "task_id": "<Harbor task ID>",
    "task_name": "<Harbor task name>",
    "instruction": "<task instruction>"
  },
  "expected_output": null,
  "metadata": {
    "task_digest": "<full Harbor task digest>",
    "...": "<other task fields and configuration>"
  }
}
```

Keep the fields an agent needs to identify and perform the task in `input`. Store the remaining JSON-safe Harbor task fields and configuration in example `metadata`, including the full task digest. Do not duplicate those fields in `input`. `expected_output` remains blank because Harbor verifies the resulting environment state instead of comparing the agent's response with a reference output.

Use Harbor's full task digest as the example version key. The digest covers the complete task package, including the solution, environment, tests, and steps. Any task-package change therefore creates a new dataset version and preserves exact provenance.

## 4. Plugin design

The package registers a plugin in Harbor's `harbor.plugins` entry-point group. Its main components are:

1. **Harbor compatibility adapter.** Reads the resolved task and trial plan and converts it to a stable internal model. It is the only component that accesses Harbor's private job-plan fields. It validates all required fields before ingestion begins.
2. **Mapping core.** Converts the internal Harbor model into Phoenix datasets, experiments, runs, evaluations, and trace links.
3. **Phoenix job plugin.** Connects Harbor lifecycle hooks to the mapping core and stops the job when required Phoenix recording fails.

### Job start

At `on_job_start`, the plugin:

1. resolves the complete task and trial plan;
2. upserts the dataset and examples;
3. creates one experiment for each agent and model, pinned to the current dataset version;
4. reads the server-assigned project name for each experiment;
5. derives a stable repetition number for every trial; and
6. in OTLP mode, creates each trial's trace and root-span identity and injects its project and W3C trace context.

Creating examples before experiments is required because a Phoenix experiment is pinned to a dataset version when it is created.

### Trial end

At the end of each trial, the plugin:

1. uploads the ATIF trajectory or closes the plugin-owned OTLP root span;
2. resolves the trace ID when available;
3. writes the experiment run with its output, timing, trace link, and error status; and
4. writes the dense and sparse evaluation scores emitted by Harbor.

The plugin streams each result as its trial ends. This provides live progress and preserves completed work if the job stops early.

### Job end

At `on_job_end`, the plugin updates experiment metadata and summary counts.

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

The plugin converts saved ATIF trajectories into spans in the experiment's Phoenix project. It computes the deterministic trace ID before upload and attaches that ID to the experiment run.

For a multi-step task, the plugin creates one trial-level trace and places each step trajectory beneath the same root. One task attempt therefore appears as one experiment run with one trace.

### OTLP mode

At job start, the plugin creates a deterministic trace ID and root span ID for each trial. It passes the following values to the trial environment:

- the experiment's Phoenix project name;
- a W3C `traceparent` for the trial root; and
- `harbor.job.id`, `harbor.trial.id`, and `harbor.task.id` OpenTelemetry resource attributes.

An agent adapter that extracts the W3C context runs the instrumented application beneath the plugin-owned root. All steps then share one trace, and the plugin already knows which trace to attach to the experiment run. Applications do not need Phoenix-specific tracing code.

If an adapter cannot accept the context but exposes the trace IDs it emitted, the plugin links the first trace and records the remaining IDs in run metadata with `trace_layout: "separate_steps"`. If neither method is available, OTLP preflight fails before trials begin.

The injected Harbor attributes provide a standard correlation vocabulary, but the prototype does not depend on querying them for trace linkage.

## 6. Evaluation scores

Harbor can use a different verifier for every task, so not every score is meaningful across an entire dataset. The plugin separates scores into dense summary metrics and sparse diagnostic metrics.

| Score | Coverage | Purpose |
|---|---|---|
| `reward` | Every behaviorally completed run | Harbor's aggregate behavioral score; suitable for cross-task summaries |
| `infra_ok` | Every attempted run | Infrastructure success rate |
| `<step_name>.<reward_key>` | Only where Harbor emits it | Step-level diagnosis within a task |

Rules:

- Read scores from `step_results` as well as the final verifier result.
- Store Harbor's trial `reward` without recomputing it.
- Store step rewards in their original numeric scale.
- Keep infrastructure failures separate from behavioral failures.
- Do not add a built-in `all_steps_passed` or `tool_calls` score. Tasks can emit task-specific scores when useful.
- Store token usage, cost, and available phase timings in run metadata.

Phoenix can calculate token cost and latency from traces. Pass rate, pass^k, confidence intervals, and thresholded release gates can be calculated from stored rewards outside ingestion without changing the source data.

## 7. Identity and failure handling

### Stable identity

| Object | Stable key |
|---|---|
| Dataset | Resolved Harbor dataset identity or explicit override |
| Example | Task ID within the dataset |
| Example version | Full Harbor task digest |
| Experiment | Harbor job ID, agent, and model |
| Run | Experiment, example, and repetition number |
| Evaluation | Run and evaluation name |
| ATIF trace | Deterministic from the ATIF session identity |
| OTLP trial trace | Deterministic from the Harbor job and trial identity |

Harbor does not expose an attempt index. The compatibility adapter derives repetition numbers from the resolved trial plan at job start, where attempts are created in a stable outer loop. It never assigns repetitions by completion order.

### Failure policy

Selecting the Phoenix plugin makes successful Phoenix recording a requirement. This avoids spending compute on a job that will not be recorded. Users can omit the plugin when they want to run Harbor without Phoenix.

- At `on_job_start`, validate the dataset identity, Harbor compatibility, trace-mode requirements, Phoenix connection, and initial writes. Raise a clear error if any check fails.
- After trials begin, surface any required Phoenix write or trace-linkage failure so Harbor stops the job. Runs already streamed to Phoenix remain available.
- Record an infrastructure exception as a run error and `infra_ok = 0`; do not rewrite it as `reward = 0`.

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

In OTLP mode, the plugin passes the resolved project to the trial's exporter before the agent starts.

## 9. Prototype scope

### Included

- Harbor plugin entry point and compatibility adapter
- Dataset and example upsert with digest-based versioning
- One experiment for each agent and model
- Streaming experiment runs with deterministic repetitions
- Dense aggregate scores and sparse step-level scores
- ATIF trace conversion and experiment-run linkage
- OTLP project routing, plugin-owned trial identity, W3C context injection, and linkage for compatible adapters
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
3. Repeating ingestion for the same job creates no duplicates.
4. Changing a task creates a new dataset version, and each experiment remains pinned to the correct version.
5. Invalid Phoenix configuration or an unavailable endpoint stops Harbor before trials begin. Losing the endpoint later stops the job, while runs already streamed to Phoenix remain available.
6. Users can identify which step failed from the stored, unscaled step rewards.
7. A multi-step OTLP adapter that accepts the injected W3C context produces one trace for the complete trial.

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
