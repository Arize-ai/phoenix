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

ATIF is the default trace mode because it works without agent instrumentation. OTLP mode supports applications that already emit OpenTelemetry spans and provides live traces during a trial; in this prototype it covers project routing and adapter-assisted linkage, while generic per-trial context injection is blocked on an upstream Harbor change (§5.3).

The prototype uses existing Phoenix dataset, experiment, evaluation, and trace-ingestion APIs. It requires **no Phoenix server change** and **one additive public API in `arize-phoenix-client`** — a pure ATIF conversion primitive (§5) — which does not exist today and is the prototype's only blocking dependency outside the plugin package.

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

Use one Phoenix dataset for one Harbor dataset. Require exactly one configured dataset and zero direct tasks; Harbor's flattened resolved task plan does not retain enough provenance to support multiple or mixed sources safely. Infer the dataset name from the single resolved `DatasetConfig`, which has four shapes:

| Harbor input | Classification | Inferred dataset name |
| --- | --- | --- |
| local path (`--path`) | `is_local()` | resolved directory basename |
| registry bare name (`--dataset <name>`) | `is_registry()` | the selected bare name |
| published package (`--dataset <org>/<name>`) | `is_package()` | the selected `<org>/<name>` |
| repository source (`--repo` with `--dataset`) | `is_repo()` | resolved registry metadata name |

A local dataset exposes no declared name; only the directory basename is available. After inferring the name, verify that every resolved task's `source` agrees with it.

The optional `dataset` plugin setting overrides the inferred name. It does not bypass the structural one-dataset check. If Harbor does not provide an unambiguous name, the plugin raises a clear error and stops the Harbor job before trials begin.

Reject a plan containing duplicate resolved task IDs. Phoenix example identity and the run key both derive from the task ID, so duplicates would silently collapse distinct tasks onto one example.

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

Harbor's job lock does not exist yet at `on_job_start`, so the task digest cannot be read from it. The compatibility adapter obtains digests by building the job lock in memory from the resolved config, trial configs, and task download results.

## 4. Plugin design

Phoenix owns and releases the standalone `arize-phoenix-harbor` package from `packages/phoenix-harbor/` in the Phoenix monorepo. Its `phoenix_harbor` module registers `phoenix` in Harbor's `harbor.plugins` entry-point group. Its main components are:

1. **Harbor compatibility adapter.** Reads the resolved task and trial plan and converts it to a stable internal model. It is the only component that accesses Harbor's private job-plan fields. It validates all required fields before ingestion begins.
2. **Mapping core.** Converts the internal Harbor model into Phoenix datasets, experiments, runs, evaluations, and trace links.
3. **Phoenix job plugin.** Connects Harbor lifecycle hooks to the mapping core and stops the job when required Phoenix recording fails.

The package supports Harbor `>=0.18.0` for ordinary jobs and checks required capabilities at runtime. Regrade/source-job plans are unsupported until mapped explicitly.

Phoenix-side floors are per capability, and one of them is not yet released:

| Requirement | Floor | Status |
| --- | --- | --- |
| Experiment/run/evaluation logging | `arize-phoenix-client>=2.10.0` | Released |
| Stable external dataset example IDs | Phoenix server `>=15.0` | Released |
| Public ATIF conversion primitive (§5) | Unreleased client | **Required client addition** |
| ATIF replay verification by span ID (§5) | Phoenix server `>=19.6` | Released; ATIF-mode-only floor |

The prototype requires no Phoenix **server** change, but it does require a new public **client** API for ATIF conversion. Startup preflight reports an actionable error naming the detected version and the missing capability. The span-ID query floor applies only in `atif` mode; `none` mode does not need it.

### Job start

At `on_job_start`, the plugin:

1. resolves the complete task and trial plan;
2. synchronizes the complete dataset example snapshot;
3. recovers or creates one experiment for each effective agent and model configuration, pinned to the current dataset version;
4. reads the server-assigned project name for each experiment;
5. derives a stable repetition number for every trial; and
6. in OTLP mode, validates the resolved per-agent exporter environment against the plugin's own project and endpoint and fails closed with the exact flags to add.

Physical attempts cannot be enumerated at job start: retries are created dynamically by Harbor's trial queue and trial UUIDs do not exist until trial construction. Any per-attempt trace identity is therefore established at attempt time, not at job start.

Creating examples before experiments is required because a Phoenix experiment is pinned to a dataset version when it is created.

### Trial end

Harbor may emit an END event for a failed physical attempt before retrying the same logical trial. Harbor does not publish the attempt index or the terminal-attempt decision on the event, so the compatibility adapter reconstructs it: it counts START events per logical trial name and reapplies Harbor's `RetryConfig` exclude → include → `max_retries` decision. `RetryConfig` is public; the decision procedure is private queue behavior and must be pinned by the three-version contract suite. The adapter performs no Phoenix or ATIF writes for an intermediate retryable END event. The terminal successful, exhausted, or non-retryable attempt retains the logical trial's precomputed repetition number.

Three qualifications apply to that reconstruction:

- Only a top-level `TrialResult.exception_info` triggers a Harbor retry. A multi-step failure recorded solely on a `StepResult` is terminal and must be ingested.
- A `CancelledError` END is never retryable and must not be treated as an intermediate attempt.
- Harbor can crash between writing an intermediate attempt's result and starting its retry. On resume Harbor may treat that intermediate result as completed work. The plugin cannot detect or repair this; it is a known gap pending an upstream terminal-attempt event.

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
| Run linkage | Deterministic from the ATIF trajectory | Report-back or correlation query; see §5.2 |
| Trial-scoped root owned by the plugin | Yes | Not until the Harbor runtime hook exists |

### ATIF mode

ATIF mode requires **one new public API in `arize-phoenix-client`**. Today the client exposes only `upload_atif_trajectories_as_spans`, which uploads unconditionally, accepts no caller-supplied parent, and returns queue counts rather than spans. The plugin needs the converted spans in hand before upload so it can verify deterministic IDs, submit only missing spans on replay, and decide when to link the run.

The required addition is a batch-level pure function that validates and converts one or more trajectories and returns the spans without uploading, accepting an optional caller-owned parent span context. Exporting the existing private single-trajectory converter is **not** sufficient: batch validation, v1.7 sub-agent flattening, the cross-document sub-agent reference map, and parent-context precedence all live in the current public wrapper and would otherwise be reimplemented in the plugin. The supplied parent must also be honored during flattening and reference mapping, or embedded and cross-document sub-agents land in a different trace than their parent. The existing uploader is refactored onto the new function and its behavior is unchanged.

The function takes no client, so no async variant is needed; the plugin awaits the async span-log call itself.

The plugin creates one deterministic trial-level AGENT root, converts saved ATIF trajectories beneath it, and submits the root and children to the experiment's Phoenix project. Harbor-specific identity, root creation, and replay recovery stay in the plugin rather than the general client.

The plugin injects a deterministic `trajectory_id` derived from the full logical trial identity and stable step ordinal onto an in-memory copy of every trajectory that lacks one, without modifying the source file. This is **mandatory, not a legacy fallback**: when a trajectory has no `trajectory_id`, span IDs are seeded from `session_id` alone, so two step trajectories of one multi-step trial that share a session ID produce identical span IDs even under an explicit trial root — which, per the ingestion rules below, is silent data loss. Producer-supplied trajectory and session identities are preserved when present.

Whether Harbor agents emit `trajectory_id` at all, and how unique their `session_id` values are in practice, has not been characterized against a supported Harbor release. See §11.

For a multi-step task, the plugin creates one trial-level trace and places each step trajectory beneath the same root. One logical trial therefore appears as one experiment run with one trace.

Deterministic IDs do not by themselves make trace upload idempotent, and Phoenix's span ingestion does not make it idempotent either. Two behaviors constrain the design:

- Phoenix rejects an entire span-upload request when **any** span ID in it already exists. It compares IDs only, so a byte-identical re-upload is rejected exactly like a genuine conflict. The plugin must therefore never re-send a span it has already persisted.
- Duplicate span IDs **within a single request** are not detected. They are silently dropped on insert while the response reports success. A collision in the deterministic derivation is therefore silent data loss, not an error.

Accordingly, on replay the plugin queries the expected span IDs first, submits only the missing ones, and waits until every expected span is queryable before linking and writing the experiment run. It validates that the derived span IDs within one submission are distinct before sending. Span-ID querying requires Phoenix server `>=19.6`, which is an `atif`-mode-only floor.

### OTLP mode

OTLP is not one capability. It decomposes into project routing, trace→run linkage, and plugin-owned per-trial trace identity, and these have different availability today. The prototype ships the first two and blocks the third.

Harbor contains no OpenTelemetry code of its own; every span comes from the agent process. Harbor exposes exactly one per-agent environment channel, `AgentConfig.env`, which is shared by every trial of that agent and is copied into the agent at construction time.

#### 5.1 Project routing — available now, generic

The user supplies the exporter endpoint, credentials, and project through Harbor's per-agent environment (`--agent-env`, or an `env:` block per agent in a job config file). Phoenix routes on the `openinference.project.name` resource attribute, or on an `x-project-name` header over HTTP.

At `on_job_start` the plugin reads the resolved agent environments, validates them against its own resolved project and endpoint, and fails closed with the exact flags to add if they disagree or are absent. Per-agent (and therefore per-experiment) routing works because `AgentConfig` is per agent; it requires a job config file, because the CLI applies one `--agent-env` set to every agent.

The plugin **must not** inject these values by mutating `job.config.agents[*].env` at `on_job_start`. The mutation does reach the agent, but it is persisted into the trial config, and Harbor compares planned against persisted configs before plugins attach, so the next `resume` of that job hard-fails. It would also persist credentials into `config.json`.

Where the sandbox uses a network allowlist, the Phoenix host must be added with Harbor's agent-host allowlist flag.

#### 5.2 Trace→run linkage — available now, adapter-assisted

Two mechanisms, used together:

- **Report-back.** The agent adapter writes its emitted trace ID into the Harbor agent context metadata, which surfaces on the trial result and is therefore readable from the trial-end event. The adapter must merge into that metadata rather than overwrite it, and note that non-empty metadata suppresses Harbor's automatic token and cost fill.
- **Correlation query.** The adapter records `harbor.trial.id` as a **span** attribute; the plugin then queries the experiment project for spans carrying the terminal trial's UUID and resolves the trace.

Both require an adapter Phoenix controls. A Phoenix-owned adapter can do all of this today with no Harbor change: the real trial UUID is available to the agent as its context ID, so the adapter derives a deterministic trial trace, attaches it around every step, and reports it back. That yields one trace per trial across all steps.

Correlation keys must be span attributes. Phoenix discards every OTLP **resource** attribute except the project name, so the previously specified `harbor.job.id` / `harbor.trial.id` / `harbor.task.id` resource attributes are dropped on ingestion and are not queryable. Note also that Harbor's real job ID is a UUID minted at job construction and is not knowable at CLI time, so only a user-supplied job label can be static.

Limitation of the adapter-assisted path: the **adapter**, not the plugin, mints the root, so the plugin cannot know the trace ID before the trial runs. Linkage validation becomes after-the-fact rather than a job-start preflight.

#### 5.3 Plugin-owned per-trial context — blocked on Harbor

Generic OTLP — a plugin-owned trial root injected into an agent Phoenix does not control — requires a per-trial, pre-construction runtime value. No released Harbor version and no current `main` provides one:

- the real trial UUID is minted inside trial construction, after the plan exists, so per-attempt identity cannot be computed at job start;
- `AgentConfig` is a single shared object, so per-trial mutation races across concurrent trials; and
- the trial-start hooks fire after the agent has already copied its environment.

This blocks: a plugin-owned root, a trace ID known before the trial runs, fail-closed preflight of linkage, and attribution of individual retry attempts. It is tracked as an upstream Harbor request for a pre-construction runtime-overrides hook whose values are excluded from persisted config, locks, and resume equality. Until that lands in the declared Harbor minimum, `trace_mode: otlp` supports §5.1 and §5.2 only, and the plugin says so explicitly at preflight.

#### 5.4 Consequences that hold in every OTLP variant

The plugin submits any prebuilt root after child execution. Phoenix handles either arrival order for parent/child linkage and cumulative metrics, but the trace's project is fixed by whichever span arrives **first** — so a misrouted child pins the whole trial trace to the wrong project, and §5.1 routing must be correct before any child is emitted. The root's status represents infrastructure outcome, not whether behavioral reward was zero; note that child error statuses still roll up into the root's cumulative error count.

Each physical retry emits its own trace. Only the terminal attempt's trace is linked to the logical experiment run. Earlier attempts' traces remain in the project with no run linking them. Presenting or suppressing those orphans is an open question, not a settled design.

Multi-trace fallbacks are out of scope for the prototype. Phoenix renders exactly one trace per experiment run, so recording auxiliary trace IDs in the run output envelope would store inert data and would not satisfy the single-trial-trace goal.

## 6. Evaluation scores

Harbor can use a different verifier for every task, so not every score is meaningful across an entire dataset. The plugin separates scores into dense summary metrics and sparse diagnostic metrics.

### Behaviorally completed

A run is **behaviorally completed** when Harbor produced a verifier judgement for it. This is the coverage condition for the dense `reward` score.

| Harbor terminal state | Top-level exception | Step exceptions | Behaviorally completed | `reward` | `infra_ok` |
| --- | --- | --- | --- | --- | --- |
| Success | none | none | Yes | Harbor's aggregate | 1 |
| Behavioral zero | none | none | Yes | `0` | 1 |
| Single-step agent or verifier failure | present | n/a | No | not written | 0 |
| Multi-step failure recorded on a step | usually none | present | Yes, if a final verifier result exists | Harbor's aggregate | 0 |
| Multi-step failure with no verifier result | none or present | present | No | not written | 0 |
| Cancellation | `CancelledError` | partial | No | not written | 0 |

Infrastructure status and behavioral completion are independent. A run can be behaviorally completed and still have `infra_ok = 0`.

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
- Store the Harbor terminal trial ID, token usage, cost, and available phase timings in a compact JSON-safe run `output` envelope. The public Phoenix run API has no run-metadata argument.

Phoenix can calculate token cost and latency from traces. Pass rate, pass^k, confidence intervals, and thresholded release gates can be calculated from stored rewards outside ingestion without changing the source data.

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

Harbor does not expose the logical repetition number directly. The compatibility adapter derives repetitions from the resolved trial plan at job start, where attempts are created in a stable outer loop. It walks the trial plan once in order and assigns a counter keyed by `(experiment identity, task ID)`. It never assigns repetitions by completion order. Physical Harbor retries keep the same logical repetition even though Harbor assigns each retry a new trial UUID.

Repetition numbers are 1-based; Phoenix rejects a repetition of zero. The experiment is created with `repetitions` set to Harbor's configured attempt count, because Phoenix derives missing-run and completeness reporting from that value and does not validate it against logged runs.

This keying is only unambiguous when task IDs and experiment identities are unique. Reject duplicates of either before any Phoenix write.

Agent and model identity includes readable names plus a deterministic, secret-free digest of behavior-affecting resolved configuration. Two configurations that share display names but differ in effective behavior must not collapse into one experiment. The digest is computed from an explicit allowlist of resolved configuration fields so that credentials and environment secrets can never enter it; the allowlist is part of the compatibility adapter's contract and is version-pinned with it.

Trace identity derivations must be globally unique, not merely unique within the experiment. Phoenix resolves traces and sessions in a global namespace: spans join whichever trace row already owns their trace ID, and that row's project wins. A colliding derivation therefore silently routes spans into another project.

### Idempotent replay and resume

The prototype guarantees sequential replay and resume for one active ingester per Harbor job:

- synchronize the full dataset snapshot with stable external task IDs;
- discover experiments by immutable identity metadata, creating on zero matches, reusing one match, and failing with all matching IDs on multiple matches;
- preload experiment runs by Phoenix example `node_id` and repetition;
- reuse a matching successful run after validating its stored Harbor terminal trial ID and canonical outcome/trace identity;
- retry or upgrade failed runs; and
- upsert all expected evaluations by run and evaluation name.

Phoenix has no server-side filter for experiment metadata, so discovery lists every experiment on the dataset and matches client-side. This is acceptable for the prototype but is linear in the dataset's total experiment count at every job start. A server-side identity filter or idempotency key is the natural follow-up.

If run creation races and receives `409`, refetch and apply the same matching/conflict validation. Never swallow a conflict without verifying the stored run. This also repairs a crash after writing a run but before all evaluations.

A successful run is immutable: Phoenix returns `409` and refuses to update any run whose stored error is absent. Only errored runs can be upgraded in place. If validation finds a successful run whose stored trial ID or trace identity disagrees with the current job, the plugin fails with both values rather than attempting a repair, because no repair path exists.

Evaluations recovered through the experiment read path carry synthesized placeholder IDs and cannot be used to identify existing evaluation rows. Rely on upsert by `(run, evaluation name)` instead.

Experiment discovery followed by creation is not atomic. The prototype requires one active ingester per Harbor job and does not promise idempotency for simultaneous ingestion of the same job across processes or machines. When a stable Harbor job directory is available, the plugin should use a best-effort local lock; a distributed guarantee would require a Phoenix server idempotency feature and is out of scope.

### Failure policy

Selecting the Phoenix plugin makes successful Phoenix recording a requirement. This avoids spending compute on a job that will not be recorded. Users can omit the plugin when they want to run Harbor without Phoenix.

- At `on_job_start`, validate the dataset identity, Harbor compatibility, trace-mode requirements, Phoenix connection, and initial writes. Raise a clear error if any check fails. Harbor does not catch `on_job_start` failures, so raising here aborts the job before trial compute.
- After trials begin, surface any required Phoenix write or trace-linkage failure so Harbor stops the job. Runs already streamed to Phoenix remain available. Harbor runs trial-end hooks serially with no isolation, so a raised error also suppresses later hooks for that trial and cancels sibling trials. The plugin must hold a single terminal-failure flag and make every subsequent trial-end callback a no-op, because sibling callbacks continue to fire while cancellation unwinds.
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

In OTLP mode the plugin does not inject exporter configuration. The user supplies endpoint, credentials, and `openinference.project.name` through Harbor's per-agent environment, and the plugin validates them at job start (§5.1).

## 9. Prototype scope

### Included

- Harbor plugin entry point and compatibility adapter
- Exactly one configured Harbor dataset and no direct tasks
- Dataset and example upsert with digest-based versioning
- One experiment for each agent and model
- Streaming experiment runs with deterministic repetitions
- Dense aggregate scores and sparse step-level scores
- A new public pure ATIF conversion primitive in `arize-phoenix-client`
- ATIF trace conversion and experiment-run linkage
- One trial-level ATIF trace for single-step and multi-step tasks
- OTLP project-routing validation (§5.1) and adapter-assisted trace→run linkage (§5.2)
- Fail-closed validation and ingestion
- Compatibility tests against supported Harbor versions

### Blocked on upstream Harbor

- Plugin-owned per-trial trace identity and W3C context injection for agents Phoenix does not control (§5.3)
- Fail-closed preflight of OTLP trace linkage, rather than after-the-fact validation
- Attribution of individual physical retry attempts

These require a pre-construction runtime-overrides hook in Harbor. They are designed, not scheduled, and nothing else in the prototype depends on them.

### Deferred

- Post-hoc ingestion command
- Harbor lifecycle and verifier wrapper spans
- Linking traces emitted independently by instrumented verifiers
- Native Phoenix summaries for pass^k and repetition aggregates
- Multi-trace runs and any `trace_layout` variant other than one trace per run

### Acceptance criteria

1. A public multi-step Harbor task produces a Phoenix experiment with runs, dense and step-level scores, and clickable ATIF traces, requiring no Phoenix server change and one additive `arize-phoenix-client` API.
2. A two-agent job creates two experiments over one dataset and supports side-by-side comparison.
3. Sequential replay or resume for the same job creates no duplicate dataset versions, experiments, successful runs, evaluations, or traces; multiple matching experiments fail explicitly.
4. Changing a task creates a new dataset version, and each experiment remains pinned to the correct version.
5. Invalid Phoenix configuration or an unavailable endpoint stops Harbor before trials begin. Losing the endpoint later stops the job, while runs already streamed to Phoenix remain available.
6. Users can identify which step failed from the stored, unscaled step rewards.
7. In `otlp` mode, a job whose agent environment lacks a valid Phoenix endpoint or project fails at job start with the exact flags to add, before trial compute.
8. A Phoenix-owned multi-step OTLP adapter produces one trace for the terminal attempt and the plugin links it to the run by report-back, with a correlation query as fallback.

Criterion 8 covers the adapter-assisted path only. Generic OTLP for third-party agents is blocked (§5.3) and has no acceptance criterion until the upstream Harbor hook exists.

## 10. Future work

After the prototype proves the design, consider:

- a public, read-only Harbor job-plan API with resolved tasks, trial assignments, and attempt indexes;
- more Harbor strategies for aggregating multi-step rewards;
- step-aware verification lifecycle events;
- a post-hoc ingestion command for backfill and debugging;
- trace linkage for already-instrumented verifiers;
- native Phoenix aggregation across repetitions; and
- richer support for correlating traces with external trial identities;
- a server-side experiment identity filter or idempotency key, which would remove both the list-and-scan discovery cost and the concurrent-ingestion caveat; and
- a partial-accept or upsert mode for span ingestion, which would remove the plugin's bespoke replay loop.

These items can improve compatibility or analysis, but none blocks the prototype.

## 11. Assumptions and unverified contracts

This design depends on behavior that is either private to Harbor or not yet probed. Each item below must be encoded as a contract test rather than trusted.

| Assumption | Basis | Risk if wrong |
| --- | --- | --- |
| The resolved task and trial plan is readable from Harbor's private job-plan attributes with a stable shape | Verified against 0.18.0, 0.20.0, and main | Ingestion breaks on a Harbor refactor with no public-API change |
| Retry terminality can be reconstructed from START counts plus the public retry config | Verified by source across three versions; not a public Harbor promise | Intermediate attempts ingested as terminal, or terminal attempts skipped |
| A raised trial-end hook error stops the job and cancels siblings | Derived from source and an isolated hook probe; **not** proven in a container-backed job | Fail-closed guarantee weaker than specified |
| Harbor agents emit ATIF `trajectory_id`, and `session_id` values are unique per step | **Not probed.** Stage 0 characterized file locations only | Span-ID collisions, silently dropped spans |
| Per-step ATIF file layout for multi-step tasks | Observed, not asserted as a Harbor contract | Missing or misparented step trajectories |
| Phoenix rejects any span batch containing an already-persisted span ID, and silently drops in-batch duplicates | Verified in Phoenix source | Replay either fails loudly or loses spans |

Known gap with no plugin-side remedy: if Harbor crashes between persisting an intermediate retry attempt and starting its retry, resume may treat that attempt as completed work. This is upstream and is one reason to prefer a queue-owned terminal-attempt event.
