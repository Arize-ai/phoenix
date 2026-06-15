# Online Evals

Author: @mikeldking

Status: Draft / Behavioral Spec

Online evals are project-level automations that run existing Phoenix evaluators against live
`spans`, `traces`, and `sessions` after ingestion. They provide continuous measurement of
production traffic without blocking the request path.

This spec builds on [server_evaluators.md](./server_evaluators.md), which defines reusable
evaluator definitions. This document covers how those evaluators are attached to projects,
scheduled against live data, retried, and written back as annotations.

## Goals

- Automatically evaluate spans, traces, and sessions as live data arrives.
- Scope evaluated data with filters and input mappings.
- Control cost and volume with deterministic sampling.
- Handle trace and session completion without relying on explicit end events.
- Persist results as span, trace, or session annotations that can be traced back to the online eval run.
- Keep ingestion reliable by running evals asynchronously with bounded worker capacity.

## Non-Goals (for v1)

- Blocking or mutating user traffic. Online evals measure quality asynchronously; guardrails are a
  separate product surface.
- Downstream automations such as "add to dataset", alerting, paging, or workflow triggers.
- Backfilling evals over historical data.
- Automatic evaluator calibration or human-label validation.
- Arbitrary session-level filtering until a clear session filter vocabulary exists.

## Terminology

- **Evaluator definition** - The reusable evaluator record defined by the server evaluator system.
  It can be LLM-backed, code-backed, or built in.
- **Online eval definition** - A project attachment for one evaluator. It defines the target type,
  filter, sampling rate, completion behavior, and enabled state.
- **Candidate artifact** - A span, trace, or session that has reached the point where it can be
  considered for evaluation.
- **Completion watermark** - The stable snapshot marker used for idempotency. For spans this is
  the ingested span row. For traces and sessions this is the latest observed activity timestamp
  plus enough identity data to detect later activity.
- **Online eval run** - One attempt to evaluate one online eval definition against one candidate
  artifact at one completion watermark.

## Product Requirements

### Defining an Online Eval

An online eval is not a new evaluator type. It is a project-level attachment to an existing
evaluator definition. A definition includes:

- `project_id`
- `evaluator_id`
- `name`
- `target_type`: `span`, `trace`, or `session`
- `filter_condition`: optional, target-specific filter expression
- `input_mapping`: how target data is mapped into evaluator inputs
- `sampling_rate`: a float in `[0, 1]`
- `enabled`: whether new runs should be scheduled and persisted
- `target_config`: target-specific completion settings, such as trace or session idle timeout
- `retry_policy`: bounded retry count and backoff settings
- `concurrency_limit`: optional per-definition cap, enforced below the project/global caps

The default user flow should make cost and blast radius visible before enabling a definition:

1. Select a project and target type.
2. Select or create the evaluator.
3. Configure input mapping from a recent example artifact.
4. Configure filter and sampling rate.
5. Preview matching recent artifacts and estimated run volume.
6. Enable the definition.

### Filters

Filters select candidates before sampling and before any evaluator call.

- Span targets should reuse the existing validated span filter condition.
- Trace targets should reuse the span filter condition for trace-level candidate selection by
  evaluating it against the trace's spans. The initial behavior should be `any span matches`;
  if users need `root span only` or `all spans match`, those should be explicit future options.
- Session targets should not silently reuse span filters because `any span`, `any trace`, and
  session metadata filters mean different things. v1 should either provide a small session
  filter vocabulary or omit session filters until that vocabulary exists.
- Filter validation happens when the online eval is created or updated. Invalid filters cannot be saved.
- Updating a filter affects only future candidates. It does not backfill or automatically re-run
  artifacts that were already evaluated under the previous filter.

### Sampling

Sampling is applied after filtering and before queueing a run.

- `sampling_rate = 0` evaluates no matching candidates.
- `sampling_rate = 1` evaluates every matching candidate.
- Intermediate values are deterministic, not random per worker. Compute a stable hash from
  `(online_eval_definition_id, target_type, artifact_id, completion_watermark)` and normalize
  it to `[0, 1)`. The candidate is sampled in when the normalized value is below `sampling_rate`.
- Deterministic sampling prevents retries, restarts, and multiple replicas from changing whether
  a candidate should be evaluated.
- Changing the sampling rate affects only future candidates unless a manual backfill feature is
  added later.

## Target Behavior

Online evals run after ingestion commits. They must never delay or fail ingestion.

### Spans

Spans are eligible as soon as they are stored. A span run uses the stored span as its snapshot.

Behavior:

1. A span is ingested into a project.
2. Enabled span-target online eval definitions for that project are loaded.
3. Each definition's filter is evaluated against the span.
4. Matching spans are sampled deterministically.
5. A run is queued for each sampled-in `(definition, span)` pair.

The span completion watermark is the span row identity plus the span's persisted content version
or ingestion timestamp. If the span row is later updated by a late-arriving duplicate, that is a
new watermark only if Phoenix treats it as a material content change.

### Traces

Traces do not have an explicit "done" event. Treat a trace as complete after it has been quiet
for a configured idle timeout.

Behavior:

1. Any span ingestion for a trace updates that trace's activity watermark.
2. The scheduler upserts a DB-backed timer for each enabled trace-target definition.
3. If another span arrives before the timer fires, the timer is moved forward.
4. When the timer fires and the trace has remained quiet, the trace becomes a candidate.
5. The trace filter, deterministic sampling, and queueing steps run against that trace snapshot.

The trace completion watermark is based on the trace row identity, the latest observed span
activity for the trace, and the number of spans in the trace. If late spans arrive after a
successful run, they create a newer watermark and can schedule a new run. The annotation for the
definition is upserted so the visible trace annotation represents the latest evaluated trace
snapshot, while run history preserves earlier snapshots.

### Sessions

Sessions are open-ended and can resume. Treat a session as ready for evaluation after it has
been idle for a user-configured duration.

Behavior:

1. Any span or trace activity associated with a session updates that session's activity watermark.
2. The scheduler upserts a DB-backed idle timer for each enabled session-target definition.
3. If the session resumes before the timer fires, the timer is moved forward.
4. When the timer fires and the session is still idle, the session becomes a candidate.
5. The session filter, deterministic sampling, and queueing steps run against that session snapshot.

The session completion watermark is based on the session identity, latest observed session
activity, and enough aggregate counts to detect later activity. If a session resumes after a
successful run, the next idle period creates a newer watermark and can schedule another run. The
session annotation is upserted to represent the latest evaluated session state. Run history
preserves prior evaluations.

## Execution Semantics

### Queueing and Idempotency

The scheduler should persist run intent in the database before workers execute evaluator code.
This gives Phoenix restart safety and replica-safe deduplication.

Recommended run states:

- `queued`
- `running`
- `succeeded`
- `failed`
- `skipped`
- `cancelled`

Required invariants:

- Only one active run may exist for `(online_eval_definition_id, target_type, artifact_id, completion_watermark)`.
- Workers acquire runs with leases so abandoned work can be retried after a timeout.
- Disabling a definition stops new scheduling immediately.
- Queued runs for a disabled definition should be marked `skipped`.
- In-flight runs may finish their provider call, but they must re-check the enabled state before
  writing annotations. If the definition is disabled, discard the result and mark the run `skipped`.

### Retries

Retries should be narrow and observable.

- Retry transient LLM provider, sandbox, network, timeout, and worker lease failures.
- Do not retry invalid configuration, invalid filter, missing evaluator, missing prompt version,
  or input mapping errors until the definition is changed.
- Use bounded exponential backoff with jitter.
- Persist the last error type and message on the run.
- Never write a partial annotation for a failed run.

### Capacity and Backpressure

Online evals must not starve ingestion or normal query traffic.

- Run evaluator workers in a separate background pool from ingestion.
- Enforce global, per-project, and optional per-definition concurrency limits.
- Keep DB-backed timers and queues compact by coalescing duplicate trace/session activity into
  one pending timer per `(definition, artifact)`.
- If capacity is exhausted, delay queued runs rather than dropping candidates silently.
- If a project exceeds quota or provider credentials are unavailable, mark affected runs failed
  or skipped with a user-visible reason.

## Annotation Output

Each successful run writes one or more annotations to the evaluated artifact. The output shape
should use Phoenix's existing annotation fields:

- `name`: the evaluator output config name, or the online eval name when there is only one output
- `annotator_kind`: `LLM` or `CODE`, matching the evaluator execution kind
- `label`: optional evaluator label
- `score`: optional evaluator score
- `explanation`: optional evaluator explanation
- `metadata`: machine-readable run provenance
- `identifier`: stable online eval identifier for upsert semantics
- `source`: system-generated source

Use a stable annotation identifier such as `online-eval:<online_eval_definition_id>`. Existing
annotation upsert semantics include the target artifact and annotation `name`, so the same
identifier can be reused across multiple output configs.

Required metadata:

- `online_eval_definition_id`
- `online_eval_run_id`
- `evaluator_id`
- `evaluator_version` or prompt version tag, when available
- `target_type`
- `target_id`
- `completion_watermark`
- `sampling_rate`
- `attempt`
- `started_at`
- `completed_at`

Implementation note: the current annotation source enum only has `API` and `APP`. Online evals
are neither user API calls nor manual app annotations, so the implementation should add a
system source before shipping. If v1 deliberately reuses `APP`, that should be called out in the
API and UI because it will otherwise blur automated and human-created annotations.

## Data Model Sketch

This is a minimum shape, not a migration plan.

### `online_eval_definitions`

- `id`
- `project_id`
- `evaluator_id`
- `name`
- `target_type`
- `filter_condition`
- `input_mapping`
- `sampling_rate`
- `target_config`
- `retry_policy`
- `concurrency_limit`
- `enabled`
- `created_by_user_id`
- `created_at`
- `updated_at`

### `online_eval_runs`

- `id`
- `online_eval_definition_id`
- `target_type`
- `artifact_id`
- `completion_watermark`
- `status`
- `attempt`
- `lease_owner`
- `lease_expires_at`
- `scheduled_at`
- `started_at`
- `completed_at`
- `error_type`
- `error_message`
- `annotation_ids`
- `cost_summary`

### `online_eval_timers`

- `id`
- `online_eval_definition_id`
- `target_type`
- `artifact_id`
- `activity_watermark`
- `fire_at`
- `created_at`
- `updated_at`

`online_eval_timers` is needed for trace and session idle scheduling. Span evals can enqueue
directly after ingestion.

## API and UI Requirements

Minimum API surface:

- Create, read, update, delete online eval definitions.
- Enable and disable definitions.
- List runs with status, target, timing, error, and cost fields.
- Fetch run detail for an annotation.
- Preview candidate matching for a definition without executing evaluator calls.

Minimum UI surface:

- Project settings page for online eval definitions.
- Creation/edit flow with target type, evaluator, input mapping, filter, sampling, and timeout controls.
- Estimated matching volume based on recent project data.
- Definition list with enabled state, recent success rate, recent error count, and last run time.
- Run history drill-down from both the definition and generated annotations.

## Security and Privacy

- LLM evals use the same provider configuration and authentication controls as existing server
  evaluators.
- Code evals use the same sandbox isolation as server-side code evaluators.
- Input mappings should make it clear which span, trace, or session fields will be sent to the
  evaluator.
- Secrets must not be copied into run metadata or annotation metadata.
- Failed runs should redact provider responses if they may contain user data.

## Observability

v1 should expose enough run history to answer why an expected annotation is missing.

Track at least:

- Count of candidates filtered out.
- Count of candidates sampled out.
- Queue depth and run latency.
- Success, failure, skipped, and cancelled counts.
- Last error by definition.
- Estimated and actual token/cost usage when available.

These metrics should be scoped by project and online eval definition.

## Behavior Examples

### Span-Level Final Answer Judge

Configuration:

- Target type: `span`
- Filter: final-answer LLM spans only
- Sampling rate: `0.25`
- Evaluator: hallucination or answer quality judge

Behavior:

Only spans that match the final-answer filter are considered. A deterministic 25% of those spans
are queued. Successful runs write span annotations with a stable `online-eval:<id>` identifier.

### Trace-Level Task Success Judge

Configuration:

- Target type: `trace`
- Filter: traces where any span matches the product workflow
- Idle timeout: configured quiet period
- Sampling rate: `1`

Behavior:

Every matching trace is evaluated after no new spans have arrived for the quiet period. If a late
span arrives later, Phoenix can evaluate the newer trace watermark and upsert the trace annotation.

### Session-Level Coherence Judge

Configuration:

- Target type: `session`
- Idle timeout: user-configured
- Sampling rate: `0.1`

Behavior:

Phoenix evaluates a sampled subset of idle session snapshots. If the session resumes and later
goes idle again, the new snapshot can be evaluated and the session annotation is updated to the
latest automated judgment.

## Milestones

1. Span-level online evals: definitions, validated filters, deterministic sampling, execution,
   idempotent annotations, and run history.
2. Trace-level online evals: DB-backed quiet-period scheduling and late-span watermark handling.
3. Session-level online evals: DB-backed idle scheduling, session snapshot watermarking, and
   explicit session filter vocabulary.
4. Operational polish: cost reporting, quota handling, richer run diagnostics, and candidate
   preview in the UI.
5. Follow-on automations: alerting, add-to-dataset, and backfill workflows.

## Open Questions

1. What are the default trace and session idle timeout values?
2. Should the annotation source enum add `SYSTEM`, `AUTO`, or another value for online evals?
3. What exact session filter vocabulary should v1 expose?
4. Should users be able to choose between "update latest annotation" and "append every snapshot"
   for trace/session re-evaluations, or should v1 always upsert the latest automated judgment?
5. What minimum run retention period is needed before compaction or deletion?
