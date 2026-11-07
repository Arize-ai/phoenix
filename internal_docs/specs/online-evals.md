# Project Evaluators

This document records current thinking about online evaluation, not settled rules; where it and the code differ, the code is right.

Project evaluators run existing evaluators against live spans, traces, and sessions after they
are ingested, so production traffic is scored continuously. ("Online evals" is the colloquial
term.) They build on [server_evaluators.md](./server_evaluators.md), which defines the reusable
evaluator definitions; this document covers how those are attached to projects and run against
live data.

## Terminology

What people see, in the UI, GraphQL, and docs:

- **Evaluation** — one evaluator applied to one span, trace, or session.
- **In queue** — evaluations not yet finished: **waiting** to start, **retrying** after an error,
  or **running**.
- **Added** and **completed** — evaluations that entered the queue, and those that finished
  (evaluated or failed), in a time window.
- **Cleared** — removed from the queue before it ran: by a user clearing the queue, by enabling
  the evaluator, or because the evaluator was disabled when its turn came.
- **Lag** — the time from added to completed.
- **Wait** — how long the oldest waiting evaluation has waited. It drives Degraded.
- **Load** — an evaluator's share of all evaluation time on the server.
- **Start point** — where an evaluator begins evaluating: on create, on enable, and, for span
  evaluators, when the filter or sampling rate changes.
- **Evaluator status** — Healthy, Starting, Degraded, Error, Disabled, or Never ran (see
  [Queue health](#queue-health)).

In the code, schema, and metrics:

- **Work unit** — the row for one evaluation, in `eval_work_units` (spans),
  `eval_trace_work_units`, or `eval_session_work_units`.
- **Target** — the span, trace, or session being evaluated. Traces and sessions are **swept
  targets**.
- **Evaluation producer** — adds evaluations to the queue, one per target:
  `SpanEvaluationProducer` scans new spans in arrival order; `TraceEvaluationProducer` and
  `SessionEvaluationProducer` (both `SweepingEvaluationProducer`s) sweep for targets that went
  quiet. "Scan" and "sweep" are what a producer does, not role names.
- **Evaluation consumer** — `EvaluationConsumer`, one per target, runs queued evaluations.
- **Span cursor** — the span producer's position in the span arrival log
  (`eval_span_cursors.produced_through_id`). **High water** is the newest span id it has seen.
- **Scan window** — the span ids one tick reads, from the span cursor to the window end.
- **Catch-up scan** — the span producer's hourly re-read behind the span cursor.
- **Visibility lag** — how long producers wait before relying on new rows, so rows from
  transactions that commit late are seen (`VISIBILITY_LAG_SECONDS`, 60 s).
- **Retention floor** and **retention cleanup** — finished span work below the floor and older
  than the retention period is deleted.
- **Span start** — `project_evaluator_state.span_start_rowid`: a span evaluator evaluates only
  spans above it.
- **Sweep position** — `project_evaluator_state.swept_through_at`: how far a trace or session
  evaluator has swept. **Sweep start** is the sweep position minus the visibility lag.
- **Decided through** — `decided_through`, the activity a sweep decision covered.
- **Scan lease** and **claim lease** — the advisory lease a producer holds while it scans, and
  the lease a consumer holds on a claimed work unit.
- **Lapsed-claim recovery** — failing claimed work whose claim lease lapsed with no attempts
  left.

## Goals and limits

- Evaluate spans, traces, and sessions as they arrive, so a trace shows up and moments later can
  be filtered on by its scores. The system behaves like a queue, not a batch job.
- Let users choose what is evaluated (filters) and how much (sampling).
- Write results as annotations on spans, traces, and sessions.
- Never delay or fail ingestion. If evaluation is unhealthy, Phoenix still ingests and shows
  traces.

Not built yet, and likely to follow: backfilling data that existed before an evaluator was turned
on, running an evaluator on demand against a chosen span or trace, evaluating when a late
annotation (such as user feedback) arrives, and downstream automations such as alerts.

## What a project evaluator defines

A project evaluator attaches one evaluator definition (LLM, code, built-in, or decision) to a
project. It holds what users configure, in `project_evaluators`:

- the **target**: spans, traces, or sessions, fixed at creation;
- a **filter**, written in the filter language of the target;
- a **sampling rate**, the fraction of matching targets to evaluate;
- an **evaluation delay** for traces and sessions: how long a target must be quiet before it is
  evaluated (5 minutes by default, at least 10 seconds);
- an **input mapping** from the target's data to the evaluator's inputs;
- whether it is **enabled**.

What the producers track about it lives apart, in `project_evaluator_state`: the span start and
the sweep position. A row is written only once there is a position to record, and a missing row
means no span start and a sweep from the evaluator's creation. Because the producers never write
`project_evaluators`, its `updated_at` changes only when a user edits the evaluator.

## How evaluation runs

Three roles share the work, coordinated through the database so any number of replicas can run
them. Producers add evaluations to the queue, consumers run them, and the queue measures report
on both.

### Spans

The span producer scans the span arrival log. Each tick, once the newest span it has seen is
older than the visibility lag, it reads the scan window (at most 10,000 span ids), applies each
span evaluator's filter and sampling, adds a work unit per sampled span, and moves the span
cursor to the window end. After a full window the next tick starts at once. An hourly catch-up
scan re-reads the 100,000 span ids behind the cursor to pick up spans that became visible after
their window was read. The scan lease keeps one replica scanning at a time, but no write depends
on it: the unique (span, evaluator) key absorbs duplicates, and a scan commits only if the cursor
has not moved since it was read.

Retention cleanup deletes finished span work older than the retention period, but never above the
retention floor, the cursor minus the catch-up scan's lookback, so the catch-up scan cannot queue
a span again.

### Traces and sessions

Traces and sessions have no "done" event, so a swept target is ready once it has been quiet for
the evaluator's delay, judged by its last span ingest time. Every 10 seconds, each sweeping
producer reads a page of ready targets (at most 1,000) with activity after the evaluator's sweep
start, and decides each one: filtered out, sampled out, or added to the queue. Each decision
records the activity it covered as `decided_through`, and the sweep position moves forward. A
trace evaluation sees the root span's input and output, though its filter can match on any span
in the trace; a session evaluation sees its turns, up to 1,000.

Each target is evaluated once per project evaluator, at its first quiet period. Later activity
does not schedule another evaluation, and a filtered-out or sampled-out decision is final. The
exception is an evaluation that produced no result: one that failed, expired, lost its content,
or was cleared is offered again once new spans arrive and the target goes quiet again. Spans that
arrived while it was running might not trigger that.

### Consumers

Each replica runs one consumer per target. A consumer claims queued work units, loads the
evaluator's current configuration, runs it, and writes the annotations and marks the unit done in
one transaction. Every write after a claim checks that the claim still holds, so a unit taken over
by another replica is never finished twice. A claim lease lasts 90 seconds and is renewed while
the evaluation runs; work whose lease lapses is claimed again. An evaluation that runs past
10 minutes is stopped. `PHOENIX_ONLINE_EVAL_MAX_EVALUATOR_CONCURRENCY` bounds how many
evaluations a replica runs at once, across targets.

## Start point

A project evaluator evaluates only what arrives after it is turned on. Creating one starts it at
now, and so does enabling it again; enabling it also clears the work it still had queued from
before it was disabled. A span evaluator also starts again at now when its filter or sampling
rate changes, so a widened selection does not reach back over spans already passed. Trace and
session decisions already made are final, so their selection edits need nothing.

A span evaluator's span start is the span cursor, which trails the newest span by about the
visibility lag, so spans from a minute or two before the start can still be evaluated. A trace or
session counts if it has activity after the start, within the 60-second visibility lag. Older data
belongs to backfill, which is a separate feature.

Start points are written in the same transaction as the configuration change, through the one
write path that GraphQL, REST, and the CLI share.

## Filters and sampling

Span evaluators use the span filter language (`src/phoenix/trace/dsl/filter.py`), and trace and
session evaluators use their own filter languages, applied when the target is decided. A filter
that fails to compile, or fails when it runs, skips that evaluator for the window or page rather
than holding back the others. Changing a filter or sampling rate affects only future targets.

Sampling is applied to the targets that match the filter. Each target gets a stable value ρ in
`[0, 1)` from a hash of its id (span row id, `trace_id`, or `session_id`), and it is sampled when
ρ is below the rate. The hash is the same for every evaluator, so samples nest: with nested
filters and nested rates, every target a stricter, lower-rate evaluator samples is also sampled by
the broader one, and two evaluators with the same filter and rate evaluate the same targets. A
target is always in or out across retries and restarts.

## Output

Each successful evaluation writes annotations to the target with the existing annotation model
(label, score, explanation). The annotation's `identifier` is derived from the project
evaluator's configuration, and an evaluation keeps the first annotation written under it, so a
project evaluator annotates a target at most once per configuration. Each evaluation also writes a
trace of its own to the project evaluator's trace project, which is where errors and timings can
be read and what evaluator load is measured from.

## Queue health

The queue has no size limit. Producers add everything they find, so overload shows as a growing
queue and a longer wait, not as dropped work. The queue is **Degraded** when its oldest waiting
evaluation has waited over 10 minutes; retries are not counted, so one evaluator's provider outage
does not mark the shared queue. Counts are exact up to 1,000,000 and shown as "1,000,000+" past
that.

Each evaluator's status comes from its own evaluations only, by precedence: Disabled when turned
off; Error when its newest completed evaluation failed; Degraded when its oldest waiting or
retrying evaluation has waited over 10 minutes; Healthy when its newest completed evaluation
succeeded; Starting when work is queued but none has completed; Never ran otherwise.

## Clearing

A user can clear the queued evaluations of one project evaluator, one project, or every project.
Evaluations already running are not cleared. Turning an evaluator off does not clear its queue, so
a large clear never fails the toggle: its queued evaluations are cleared, not run, when their turn
comes, the evaluators page clears them right after turning one off, and turning it on again
clears any still queued. Cleared evaluations are not failures and do not affect the status.

## Failures

- A failed evaluation is retried with backoff, up to 3 attempts. Provider outages and other
  transient errors retry without using an attempt, for up to a day.
- An evaluation that cannot run, such as one whose target no longer exists, ends without a retry.
- A failed evaluation writes no annotation.
- Evaluator traces live in the project evaluator's own trace project, so they do not trigger
  project evaluators unless a user routes them into a monitored project.

## Open questions

- **Backfill and on-demand runs.** How to evaluate data from before an evaluator was turned on,
  and how to run one evaluator against a chosen target while developing it.
- **Re-evaluation.** Whether a trace or session that resumes after its evaluation should be
  evaluated again, and whether the newer result should replace the earlier one. Replacing needs an
  annotation identity that includes the source target when a result is written somewhere other
  than the target it judged.
- **Annotation-arrival triggers.** Which annotations should start an evaluation (for example, a
  thumbs-down), and how to keep evaluators from triggering each other through the annotations
  they write.
- **Run history.** Span filter and sampling declines leave no record, so "why is this annotation
  missing?" cannot always be answered. A durable record of every decision, and how long to keep
  it, is still to be designed.
- **Richer filters.** Parent- and tree-level conditions ("traces where a planner sub-agent was
  called") and filtering on cost.
- **Load and timeliness.** If a size or lag limit is ever added, it should drop work under the
  existing DROPPED status so it needs no migration.
- **Notification.** How a user learns that an evaluator was disabled or keeps failing.
- **Data sent to providers.** What to minimize before production content goes to an external
  judge, and how to keep adversarial content from skewing scores.
