# Evaluation triggers

Author: @anticorrelator

Phoenix can evaluate a session automatically when an annotation matching a
user-defined rule is written. This document explains how the trigger system
works, the function of each subsystem, and the reasoning behind the design.

It builds on the session-evaluation pipeline described in
`server_evaluators.md` and `online-evals.md`: a project evaluator scores
completed sessions and writes its result back as a session annotation.

## Core constraint

The pipeline consumes its own output: evaluators are triggered by
annotations and produce annotations, and one annotation can match many
rules. Without a bound, this feedback structure allows infinite loops and
unbounded fan-out. The bound is:

An evaluator runs at most once per session per version of that session's
content, and only newly ingested spans advance the content version.

This constraint closes both failure modes:

- **Infinite loops.** An evaluator's result annotation can match a rule,
  but the resulting request finds the content version unchanged —
  annotations never advance it — so no new run is scheduled.
- **Unbounded fan-out.** Any number of matching annotations against one
  content version produce at most one new run.

A user can override the constraint with a forced run, which runs once per
request. The constraint is enforced at exactly one layer (the scheduler's
work-creation step, described below); every other mechanism serves or
observes it but does not duplicate it.

## Lifecycle

1. A user creates a **trigger** on a project evaluator: "when an annotation
   like this is written, evaluate the session it belongs to."
2. When annotations are written, the write path matches them against the
   project's triggers and records an **evaluation request** in the same
   database transaction.
3. A background **scheduler** turns unanswered requests into **work units**,
   applying the once-per-content-version constraint.
4. An **executor** claims work units, runs the evaluator, and writes the
   result back as a session annotation.
5. A **retention job** deletes aged bookkeeping rows while preserving the
   evidence the constraint depends on.

## Subsystems

### Trigger rules

Table `project_evaluator_triggers`; code
`phoenix/server/online_eval/triggering/rules.py`.

A trigger belongs to one project evaluator and names an event kind plus
optional predicates. The only event kind today is an annotation write.
Predicates can constrain the annotation's name, label, score (above or below
a bound), annotator kind, whether the write was an insert or an update, and
whether the annotation sits on a span, trace, or session. An absent predicate
is unconstrained.

Stored predicates are schema-validated when read. An invalid row is logged
and skipped, so a corrupt rule can never broaden into match-everything or
block the project's other rules.

### Matching at the annotation write

Code `phoenix/db/insertion/annotation.py` and
`phoenix/server/online_eval/triggering/matching.py`.

Matching runs inside the transaction that writes the annotation:

1. A cheap indexed existence check asks whether the writing project has any
   live trigger. Projects without triggers pay nothing further.
2. The project's rules load, and predicates evaluate in memory against the
   annotations being written. No I/O runs per candidate.
3. Each match records an evaluation request for the (session, evaluator)
   pair, in the same transaction.

Because matching and the write share one transaction, a rolled-back write
leaves no request, and a committed write can never lose its request. Matching
is prospective: a rule created after an annotation was written never fires on
it.

**Why not a queue between the write and the matcher?** An earlier design
wrote annotation events to a durable table and matched them in a background
job. That bought decoupling the system did not need — predicates are pure
field comparisons — at the cost of a second table, a polling job, retention
for the table, and a window where a write existed but its request did not.
Inline matching removes all of that. The trade-off is explicit: predicates
must stay cheap, in-memory checks. If a predicate ever needs I/O, the
decoupling should return.

Trigger failures never fail ingestion. A matched request that cannot be
granted — the session was deleted, the evaluator is paused, the session's
content is not in an evaluable state — is dropped and counted, and the
annotation write commits.

On PostgreSQL, the matching step reads session rows under a shared lock
(`FOR KEY SHARE`), so concurrent annotation writes to the same session do
not block each other. Destructive transitions that must serialize against
matching, such as session deletion, take exclusive locks and still do.

### Evaluation requests

Table `evaluation_requests`; code
`phoenix/server/online_eval/requests.py`.

One row per (session, evaluator) pair holds all pending demand. The row
carries two counters and a flag:

- `requested_generation` — how many times evaluation has been asked.
- `materialized_generation` — the ask count through which work has been
  created. The pair is pending while this trails `requested_generation`.
- `force_requested` — latched true when any ask was a forced run; cleared
  only when the row is fully serviced. Races err toward one extra run, never
  a lost force.

Counter arithmetic runs in SQL, so concurrent asks from any server replica
all land. Any number of matched annotations coalesce into one pending
request per pair: an annotation storm cannot become a row storm or a run
storm, and the table is bounded at one row per pair.

### Scheduling

Code `phoenix/server/online_eval/session_sweeper.py`.

One server replica at a time holds a lease to run the scheduler. Each pass
decides which (session, evaluator) pairs to run, from two sources:

- **Requested**: a pending request exists, the session has been quiet for the
  evaluator's configured delay, and the session's content version advanced
  past the last completed run — or the request was forced. Requested runs
  respect the evaluator's session filter but skip sampling: an explicit ask
  is never sampled away.
- **Scheduled**: the evaluator's own time-based pass over eligible sessions,
  subject to its session filter and sampling rate. A scheduled run happens at
  most once per session per evaluator configuration.

By construction a pair appears from exactly one source per pass: a pair with
a pending request is requested, every other eligible pair is scheduled. The
source is recorded on the work it creates (`scheduling_origin`) for tracing
and metrics; it carries no priority.

A global cap bounds outstanding work across the installation (default
10,000). Per-project fairness under that cap is an open follow-up (#15383).

### Work units

Table `eval_session_work_units`; code `phoenix/db/eval_work.py`.

A work unit is one scheduled run for a (session, evaluator, configuration)
triple: a status lifecycle from pending through running to a terminal state,
claim and lease fields so replicas cannot double-run it, a bounded retry
budget, and `evaluated_through` — the content version the run covered.

The newest terminal work unit per triple is the permanent record behind the
once-per-content-version constraint: the scheduler compares the session's
latest span time against it, and the insert that creates new work re-tests it
as it runs, so racing passes cannot double-schedule.

### Execution and results

Code `phoenix/server/online_eval/executor.py`.

The executor claims pending work, loads the session transcript, runs the
evaluator, and writes the score back as a session annotation under the
reserved `online:` identifier. Every run is traced into the `evaluators`
project (see `server_evaluators.md`).

The result annotation re-enters the same write path as any other annotation.
This is deliberate — there is exactly one announcement path — and it cannot
loop: evaluators cannot target the `evaluators` project, and even when an
evaluator's own annotation matches a rule, the resulting request finds the
content version unchanged and schedules nothing.

### History retention

Code `phoenix/server/online_eval/session_retention.py`.

The retention job deletes two kinds of aged rows: fulfilled requests older
than the cutoff, and terminal work units superseded by a newer terminal work
unit for the same (session, evaluator, configuration). The newest terminal
work unit is never deleted; it is the evidence the scheduler reads. Storage
therefore grows with the number of distinct pairs, not with the number of
runs.

The job selects only sessions that hold deletable rows — selection and
deletion share one predicate — so each pass shrinks its own working set and
the job converges instead of rescanning every session that ever ran an
evaluator.

## Accepted limits

- **No backfill.** Matching happens at write time. A rule never fires on
  annotations written before it existed; scheduled evaluation is the
  eventual catch-all. Backfill is tracked in #15386.
- **Slow predicates would slow ingestion.** Acceptable while predicates are
  in-memory field comparisons; a predicate that needs I/O is the signal to
  reintroduce decoupling.
- **Global scheduling, no per-project fairness.** One project's backlog can
  delay others under the shared cap (#15383).

