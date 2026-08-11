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
- link each run to an ATIF or live OTLP trace when the selected trace mode supports it.

ATIF is the default because it does not require agent instrumentation. OTLP provides live traces for instrumented agents. In this prototype, OTLP supports project routing and adapter-assisted run linkage. Generic per-trial context injection requires an upstream Harbor change (§5.3).

The prototype requires **no Phoenix server changes**. It requires **one new public API in `arize-phoenix-client`**: a pure ATIF conversion function (§5). This API is the only blocking dependency outside the plugin package.

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
- The prototype accepts one Harbor dataset and no direct tasks. It rejects all other job shapes before trials begin.
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

Use one Phoenix dataset for one Harbor dataset. Require one configured dataset and no direct tasks. Harbor's resolved task plan loses the source information needed to support other job shapes safely.

Infer the dataset name from the resolved `DatasetConfig`:

| Harbor input | Classification | Inferred dataset name |
| --- | --- | --- |
| local path (`--path`) | `is_local()` | resolved directory basename |
| registry bare name (`--dataset <name>`) | `is_registry()` | the selected bare name |
| published package (`--dataset <org>/<name>`) | `is_package()` | the selected `<org>/<name>` |
| repository source (`--repo` with `--dataset`) | `is_repo()` | resolved registry metadata name |

A local dataset exposes only its directory name. After inferring a name, verify that every resolved task has the same source.

The optional `dataset` setting overrides the inferred name, but not the one-dataset rule. If Harbor does not provide a clear name, stop the job before trials begin.

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

Phoenix owns and releases `arize-phoenix-harbor` from `packages/phoenix-harbor/`. The `phoenix_harbor` module registers `phoenix` in Harbor's `harbor.plugins` entry-point group.

The package has three main components:

1. **Harbor compatibility adapter.** Reads the resolved task and trial plan and converts it to a stable internal model. It is the only component that accesses Harbor's private job-plan fields. It validates all required fields before ingestion begins.
2. **Mapping core.** Converts the internal Harbor model into Phoenix datasets, experiments, runs, evaluations, and trace links.
3. **Phoenix job plugin.** Connects Harbor lifecycle hooks to the mapping core and stops the job when required Phoenix recording fails.

The package supports normal jobs on Harbor `>=0.18.0`. It checks required capabilities at runtime. Regrade and source-job plans are not supported.

Phoenix version requirements depend on the feature:

| Requirement | Floor | Status |
| --- | --- | --- |
| Experiment/run/evaluation logging | `arize-phoenix-client>=2.10.0` | Released |
| Stable external dataset example IDs | Phoenix server `>=15.0` | Released |
| Public ATIF conversion function (§5) | Unreleased client | **Required client addition** |
| ATIF replay verification by span ID (§5) | Phoenix server `>=19.6` | Released; ATIF-mode-only floor |

Startup checks report the installed version and any missing feature. Phoenix server `>=19.6` is required only for `atif` mode. The prototype needs the new client API listed above, but no server changes.

### Job start

At `on_job_start`, the plugin:

1. resolves the complete task and trial plan;
2. synchronizes the complete dataset example snapshot;
3. recovers or creates one experiment for each effective agent and model configuration, pinned to the current dataset version;
4. reads the server-assigned project name for each experiment;
5. derives a stable repetition number for every trial; and
6. in OTLP mode, validates each agent's exporter project and endpoint. If they are invalid, the error lists the exact flags to add.

The plugin cannot list physical attempts at job start. Harbor creates retries later, and trial UUIDs do not exist until trial construction. The plugin must create per-attempt trace identity when each attempt starts.

Creating examples before experiments is required because a Phoenix experiment is pinned to a dataset version when it is created.

### Trial end

Harbor may emit an END event for a failed attempt before it starts a retry. The event does not include the attempt number or say whether the attempt is terminal. The compatibility adapter reconstructs this decision. It counts START events for each logical trial and applies Harbor's `RetryConfig` rules in this order: exclude, include, then `max_retries`.

`RetryConfig` is public, but this decision logic is private Harbor behavior. Contract tests must cover all three supported Harbor versions. Do not write Phoenix or ATIF data for an attempt that will be retried. The final attempt keeps the logical trial's precomputed repetition number.

This logic has three limits:

- Only a top-level `TrialResult.exception_info` triggers a retry. A failure found only on a `StepResult` is terminal and must be ingested.
- `CancelledError` is never retryable.
- Harbor may crash after saving an intermediate result but before starting its retry. On resume, Harbor may treat that result as complete. The plugin cannot detect or repair this case.

At the terminal end of each logical trial, the plugin:

1. uploads the ATIF trajectory or submits the plugin-owned OTLP root span;
2. resolves the trace ID when available;
3. writes the experiment run with its output, timing, trace link, and error status; and
4. writes the dense and sparse evaluation scores emitted by Harbor.

The plugin streams each result as its trial ends. This provides live progress and preserves completed work if the job stops early.

### Job end

`on_job_end` may write optional summaries. Required data must already be written because Harbor suppresses errors from this hook. Phoenix can derive run and evaluation counts.

## 5. Trace modes

Set `trace_mode` explicitly to `atif`, `otlp`, or `none`. The plugin does not auto-detect tracing because combining partial live spans with a converted ATIF trajectory could create duplicate traces.

| Behavior | `atif` (default) | `otlp` |
|---|---|---|
| Agent instrumentation required | No; agent must produce ATIF | Yes; standard OpenTelemetry instrumentation is sufficient |
| Live during the trial | No; uploaded when the trial ends | Yes |
| Sandbox endpoint and credentials | Not required | Required |
| Network access from sandbox | Not required | Required |
| Destination | Experiment's Phoenix project | Experiment's Phoenix project |
| Run linkage | Deterministic from the ATIF trajectory | Report-back or correlation query; see §5.2 |
| Trial-scoped root owned by the plugin | Yes | Not until the Harbor runtime hook exists |

### ATIF mode

ATIF mode requires **one new public API in `arize-phoenix-client`**. The current `upload_atif_trajectories_as_spans` API always uploads, cannot accept a parent, and returns counts instead of spans. The plugin needs the spans before upload. It uses them to check IDs, skip existing spans, and link the run only after upload succeeds.

Add a pure batch function that:

- validates and converts one or more trajectories;
- accepts an optional parent span context;
- returns spans without uploading them;
- preserves ATIF v1.7 sub-agent flattening and cross-document references; and
- applies the parent context to all sub-agents.

Do not expose only the private single-trajectory converter. That would force the plugin to copy the batch logic listed above. Refactor the existing uploader to call the new function without changing uploader behavior.

The function does not use a client, so it does not need an async version. The plugin can await the async span-log call.

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

### OTLP mode

OTLP has three separate features:

1. project routing, available now;
2. adapter-assisted trace-to-run linkage, available now; and
3. plugin-owned per-trial trace identity, blocked on Harbor.

Harbor does not create OpenTelemetry spans. Agents create them. Each agent has one shared environment, `AgentConfig.env`, which Harbor copies when it constructs the agent.

#### 5.1 Project routing — available now, generic

The user supplies the exporter endpoint, credentials, and project through Harbor's per-agent environment (`--agent-env`, or an `env:` block per agent in a job config file). Phoenix routes on the `openinference.project.name` resource attribute, or on an `x-project-name` header over HTTP.

At `on_job_start`, the plugin checks each agent's environment against the configured project and endpoint. If a value is missing or different, stop with the exact flags needed to fix it.

Per-agent routing requires a job config file. The CLI applies one `--agent-env` value to all agents.

Do **not** mutate `job.config.agents[*].env` at `on_job_start`. Harbor saves the change in the trial config, including any credentials. A later `resume` then fails because the saved config differs from the plan.

Where the sandbox uses a network allowlist, the Phoenix host must be added with Harbor's agent-host allowlist flag.

#### 5.2 Trace→run linkage — available now, adapter-assisted

Use both mechanisms:

- **Report-back.** The adapter adds its trace ID to the Harbor agent context metadata. Merge with existing metadata instead of replacing it. Note: non-empty metadata disables Harbor's automatic token and cost fields.
- **Correlation query.** The adapter adds `harbor.trial.id` as a **span** attribute. The plugin queries the experiment project for that terminal trial UUID.

Both mechanisms require a Phoenix-owned adapter. The adapter can read the trial UUID from its context, create one deterministic trace around all steps, and report the trace ID. This works today without a Harbor change.

Correlation keys must be span attributes. Phoenix drops all OTLP **resource** attributes except the project name. Also, Harbor creates the job UUID after CLI setup, so only a user-supplied job label can be static.

The adapter creates the root span, so the plugin learns the trace ID only after the trial runs. It cannot validate linkage at job start.

#### 5.3 Plugin-owned per-trial context — blocked on Harbor

Generic OTLP needs the plugin to inject a trial root before Harbor constructs an agent. Released Harbor versions and current `main` cannot do this:

- Harbor creates the trial UUID during trial construction, so it is not available at job start;
- concurrent trials share one `AgentConfig`, so per-trial mutation would race; and
- trial-start hooks run after the agent copies its environment.

This blocks a plugin-owned root, startup trace validation, and retry-attempt labels. The upstream fix is a runtime-overrides hook that runs before agent construction. Its values must not affect saved config, job locks, or resume checks. Until the minimum Harbor version includes this hook, `trace_mode: otlp` supports only §5.1 and §5.2. State this limit during startup checks.

#### 5.4 Consequences that hold in every OTLP variant

The plugin sends a prebuilt root after its child spans. Phoenix supports either arrival order, but the **first** span fixes the trace project. Project routing must be correct before an agent sends any span.

The root status describes infrastructure success, not behavioral reward. Child errors still contribute to the root's error count.

Each retry has a new trial UUID and emits a separate trace. Link only the final attempt to the experiment run. Earlier traces remain unlinked in the same project. Project-level metrics, such as token cost, include all attempts.

The prototype accepts this behavior. Harbor decides whether to retry only after spans are sent, and Phoenix cannot move spans later. The earlier traces are also useful for debugging.

Add `harbor.trial.id` as a **span** attribute so users can find an unlinked trace. The adapter cannot add the attempt number because only Harbor's trial queue knows it.

Multi-trace runs are out of scope. Phoenix displays one trace per experiment run, so extra trace IDs in run output would not be useful.

## 6. Evaluation scores

Harbor can use a different verifier for every task, so not every score is meaningful across an entire dataset. The plugin separates scores into dense summary metrics and sparse diagnostic metrics.

### Behaviorally completed

A run is **behaviorally completed** when Harbor produced a verifier result. Only these runs can have a dense `reward` score.

| Harbor terminal state | Top-level exception | Step exceptions | Behaviorally completed | `reward` | `infra_ok` |
| --- | --- | --- | --- | --- | --- |
| Success | none | none | Yes | Harbor's aggregate | 1 |
| Behavioral zero | none | none | Yes | `0` | 1 |
| Single-step agent or verifier failure | present | n/a | No | not written | 0 |
| Multi-step failure recorded on a step | usually none | present | Yes, if a final verifier result exists | Harbor's aggregate | 0 |
| Multi-step failure with no verifier result | none or present | present | No | not written | 0 |
| Cancellation | `CancelledError` | partial | No | not written | 0 |

Infrastructure status and behavioral completion are independent. A run can be behaviorally completed and still have `infra_ok = 0`.

`reward` is present for behaviorally completed runs when the plugin can find one aggregate value. A verifier with several unnamed values has no clear aggregate, so that run has diagnostic scores only. Consumers must check `reward` coverage before computing cross-task summaries.

| Score | Coverage | Purpose |
|---|---|---|
| `reward` | Every behaviorally completed run with a determinable aggregate | Harbor's aggregate behavioral score; suitable for cross-task summaries |
| `infra_ok` | Every attempted run | Infrastructure success rate |
| `verifier.<reward_key>` | Only where Harbor emits it | Other final-verifier diagnostics |
| `<step_name>.<reward_key>` | Only where Harbor emits it | Step-level diagnosis within a task |

Rules:

- Read scores from `step_results` as well as the final verifier result.
- Check the top-level result and every step result for infrastructure errors. Any exception sets `infra_ok = 0`. A reward of zero without an exception keeps `infra_ok = 1`.
- Use the final verifier's `reward` value as the aggregate. If there is no `reward` key but there is one final value, use that value. If there are several final values, write the run and its `verifier.<reward_key>` scores but no aggregate `reward`. Warn with the trial, task, and sorted keys. Never choose a value by key order.

  **Tradeoff:** Harbor's leaderboard chooses the first value by dictionary order. That choice is stable but has no semantic basis. Stopping the job would keep `reward` complete, but fixing the task changes its digest and requires a full rerun. The prototype keeps the run and warns instead. Revisit this choice if unnamed multi-value rewards are common.
- Store other final-verifier rewards as `verifier.<reward_key>` and step rewards as `<step_name>.<reward_key>`. Validate reserved/generated name collisions before writing.
- Store step rewards in their original numeric scale.
- Keep infrastructure failures separate from behavioral failures.
- Do not add a built-in `all_steps_passed` or `tool_calls` score. Tasks can emit task-specific scores when useful.
- Store the Harbor terminal trial ID, token usage, cost, and available phase timings in a compact JSON-safe run `output` envelope. The public Phoenix run API has no run-metadata argument.

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
| OTLP attempt trace | Deterministic from the Harbor job and physical trial-attempt identity |

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

Successful runs are immutable. Phoenix returns `409` if code tries to update a run with no stored error. Only errored runs can be updated. If a successful run has a different trial ID or trace ID, fail and show both values. The plugin cannot repair it.

Evaluations returned through the experiment read API have placeholder IDs. Do not use them to find stored rows. Upsert by `(run, evaluation name)`.

Finding and then creating an experiment is not atomic. Run only one ingester for each Harbor job. When a stable job directory exists, use a best-effort local lock. Concurrent ingestion across processes or machines requires a Phoenix server idempotency feature and is out of scope.

### Failure policy

Selecting the Phoenix plugin makes successful Phoenix recording a requirement. This avoids spending compute on a job that will not be recorded. Users can omit the plugin when they want to run Harbor without Phoenix.

- At `on_job_start`, validate dataset identity, Harbor compatibility, trace requirements, the Phoenix connection, and initial writes. Raise a clear error to stop the job before trial compute.
- After trials begin, raise any required Phoenix write or trace-link error. Harbor stops the job, but completed Phoenix runs remain available. Keep one terminal-failure flag. After it is set, make later trial-end callbacks no-ops while Harbor cancels sibling trials.
- Record an infrastructure exception as a run error and `infra_ok = 0`; do not rewrite it as `reward = 0`.
- Do not ingest an attempt that Harbor will retry. Until Harbor exposes a terminal-attempt event, count START events by logical trial name and apply Harbor's retry rules.

The adapter checks capabilities at runtime. Set a minimum Harbor version but no upper bound. Test the minimum version, latest stable release, and Harbor `main`. Add a temporary upper bound only for a known released incompatibility.

## 8. Configuration

Pass settings through Harbor's `--plugin-kwarg` option.

| Key | Default | Purpose |
|---|---|---|
| `dataset` | inferred from Harbor | Phoenix dataset name override |
| `endpoint` | `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix endpoint |
| `api_key` | `PHOENIX_API_KEY` | Phoenix authentication |
| `trace_mode` | `atif` | `atif`, `otlp`, or `none` |
| `experiment_name_template` | `{job_name} · {agent} · {model}` | Experiment naming |
| `project` | experiment's project | Optional trace-project override |

Experiment names must distinguish agent/model configurations in Phoenix's compare view. `{job_name}` defaults to a Harbor timestamp. If two configurations still have the same name, append a short configuration digest. This can happen when they differ only in skills, environment, or keyword arguments.

In OTLP mode the plugin does not inject exporter configuration. The user supplies endpoint, credentials, and `openinference.project.name` through Harbor's per-agent environment, and the plugin validates them at job start (§5.1).

## 9. Prototype scope

### Included

- Harbor plugin entry point and compatibility adapter
- Exactly one configured Harbor dataset and no direct tasks
- Dataset and example upsert with digest-based versioning
- One experiment for each agent and model
- Streaming experiment runs with deterministic repetitions
- Dense aggregate scores and sparse step-level scores
- A new public pure ATIF conversion function in `arize-phoenix-client`
- ATIF trace conversion and experiment-run linkage
- One trial-level ATIF trace for single-step and multi-step tasks
- OTLP project-routing validation (§5.1) and adapter-assisted trace→run linkage (§5.2)
- Fail-closed validation and ingestion
- Compatibility tests against supported Harbor versions

### Blocked on upstream Harbor

- Plugin-owned per-trial trace identity and W3C context injection for agents Phoenix does not control (§5.3)
- OTLP trace-link validation at job start instead of after the trial
- Attribution of individual physical retry attempts

These features need a pre-construction runtime-overrides hook in Harbor. They are designed but not scheduled. They do not block other prototype work.

### Deferred

- Post-hoc ingestion command
- Harbor lifecycle and verifier wrapper spans
- Linking traces emitted independently by instrumented verifiers
- Native Phoenix summaries for pass^k and repetition aggregates
- Multi-trace runs and any `trace_layout` variant other than one trace per run

### Acceptance criteria

1. A public multi-step Harbor task creates a Phoenix experiment with runs, dense scores, step scores, and clickable ATIF traces. This needs no Phoenix server change and one new `arize-phoenix-client` API.
2. A two-agent job creates two experiments over one dataset and supports side-by-side comparison.
3. Sequential replay or resume creates no duplicate dataset versions, experiments, successful runs, evaluations, or traces. If several experiments match, the job fails with a clear error.
4. Changing a task creates a new dataset version, and each experiment remains pinned to the correct version.
5. Invalid Phoenix configuration or an unavailable endpoint stops Harbor before trials begin. Losing the endpoint later stops the job, while runs already streamed to Phoenix remain available.
6. Users can identify which step failed from the stored, unscaled step rewards.
7. In `otlp` mode, a missing or invalid endpoint or project stops the job before trial compute. The error shows the exact flags to add.
8. A Phoenix-owned multi-step OTLP adapter creates one trace for the final attempt. The plugin links it by report-back, with a correlation query as fallback.

Criterion 8 covers only Phoenix-owned adapters. Generic OTLP for third-party agents remains blocked (§5.3).

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
