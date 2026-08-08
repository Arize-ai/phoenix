# Project Evaluators

Project evaluators are project-level automations that run existing evaluators against live
`spans`, `traces`, and `sessions` after ingestion, providing continuous measurement of
production traffic. ("Online evals" is the colloquial term.)

This spec builds on [server_evaluators.md](./server_evaluators.md), which defines the reusable
evaluator definitions; this document covers how those are attached to projects and run against
live data.

## Status

This document frames the problem — terminology, the hard parts, and the shape of the design — and
in a few areas (deterministic sampling, queue semantics, error handling) proposes concrete
mechanisms. It does not settle every decision: before implementation, the
[open questions](#open-questions) must be narrowed into an explicit v1 slice with chosen defaults
for target type, readiness, filtering, extraction, sampling, queue semantics, and auditability.

The live path is the initial focus — an agent running, an evaluator added, metrics flowing. Spans
are the easier case; traces and sessions add readiness, aggregation, and re-evaluation complexity
that v1 should scope deliberately.

## Goals

- Automatically evaluate spans, traces, and sessions as live data arrives, so production traffic
  is scored continuously. The intent is to make Phoenix proactive: a trace shows up and already
  tells you whether it was good or bad.
- Let users configure the scope of the data evaluated (filters).
- Control evaluation volume with sampling for cost; other heuristics (cost or latency thresholds)
  may also narrow what gets evaluated.
- Persist results as annotations on spans, traces, and sessions.
- Keep ingestion reliable.
- Keep the experience automatic: no jobs or cron to configure, and evaluation happens as quickly
  as possible — a trace arrives and moments later can be filtered on. The system behaves like a
  queue, not a batch job.

## Non-Goals (initial release)

- Downstream automations — signals/webhooks, alerting, paging (e.g. PagerDuty), automatic
  dataset curation, annotation-queue routing, workflow triggers. These are what project
  evaluators *unlock*, but they are out of scope for this spec's initial release.
- Shipping the entire complex-filter vocabulary in the initial release (see
  [Filters](#filters)). Topology- and session-level filtering is a large workstream; session-filter
  vocabulary in particular is unsettled. A useful subset can ship without solving all of it.

### Deferred, but in scope

Two capabilities are not the initial focus but are valuable and likely to follow. Both look
backward at data that already exists rather than being ingestion-driven. Excluding them creates a
usability gap: if you have traces, create an evaluator, and those traces cannot be evaluated,
something is wrong. Design them with the live path in mind; they may not share its execution
mechanism.

- **Backfilling** existing data — e.g. "run this evaluator over last week to see whether
  something went bad on Black Friday." Backward-looking, long-running, more like a scheduled job.
- **Manual triggering** on a chosen artifact — immediate feedback while developing or tuning an
  evaluator, distinct from backfill's fire-and-forget nature. Also useful internally while the
  live path is still being built.

## Terminology

- **Evaluator definition** — A reusable evaluator (LLM, code, or built-in) defined by the server
  evaluator system.
- **Project evaluator** — A project attachment that binds one evaluator definition to live data.
  It specifies what to evaluate, when, and at what rate.
- **Target** — The artifact type a project evaluator runs against: `span`, `trace`, or `session`.
  Trace and session are meta-concepts layered on top of spans, so they are harder to define than
  spans.
- **Attachment point** — Where the resulting annotation is written, which is not necessarily the
  target. A span-level judgment may be attached to the enclosing trace so it isn't buried.

## Use Cases

### Monitor final answers in production

As a user running a RAG or agent application, I want to automatically judge a sample of
final-answer LLM spans so I can spot hallucinations and quality regressions without manually
reviewing every response.

The judgment runs on the final-answer span, but I may want it surfaced on the whole trace so it
isn't buried — i.e. the thing under evaluation is a span, but the annotation should land on the
trace. This is harder with auto-instrumenters: repeated span names (e.g. an intermediary router
span) make it difficult to uniquely qualify which span to attach to.

### Score completed agent traces

As a user tracing multi-step agent workflows, I want to evaluate each trace after it finishes
so I can measure task success, tool-use correctness, or user frustration at the workflow level
rather than on individual spans.

The simplest form evaluates root-span I/O ("did the agent answer the question?"). A harder form
evaluates the *trajectory* — the sequence of steps taken. Start with the non-trajectory case.

### Assess long-running sessions

As a user with conversational agents, I want to evaluate a session after the user goes idle so
I can measure coherence, resolution, and trajectory over the full conversation — not just the
last turn.

A `project_sessions` row already exists (traces grouped by `session_id`) but carries no evaluable
content beyond a derived `first_input` / `last_output`, so evaluating the whole conversation
requires an aggregation strategy over its traces and spans. Useful starting points:

- **Conversational coherency** — treat the conversation as an ordered list of turns (the chatbot
  use case).
- **First-in / last-out** — compare the initial question against the final answer to judge
  whether the session reached a conclusion (e.g. did it end on an open question or "let me know
  if there's anything else I can help with").
- **AI–human message pairs** — the alternating messages, ignoring tool calls.

We should ship good standard strategies first, then let users define custom session aggregation.

### Evaluate on user feedback

As a user, I want to evaluate the artifacts that received negative user feedback (e.g. all the
thumbs-down responses) so I can read the explanations and understand my product. Feedback
arrives as an annotation, often *after* the span or trace was ingested, so the evaluator has to
wait for that annotation to be ready before it can run — a readiness/timing problem distinct
from filtering, and the feedback may live on the trace rather than the span being evaluated.

### Control cost at scale

As a user with high-volume production traffic, I want to filter to the spans or traces that
matter and sample a fraction of them so automated evaluation stays affordable without turning
off monitoring entirely. Beyond sampling, cost and latency are useful thresholds: as context
windows grow, expensive traces carry higher stakes, so I may want to filter on them.

### Triage failures in the UI

As a user reviewing production data, I want evaluator results to appear as annotations on
spans, traces, and sessions — the same surfaces I already use for human review — so I can
filter, sort, and drill into flagged artifacts, including a time-series view of eval results I
can zoom into and follow back to the failing traces.

### Audit why an eval did or didn't run

As a user configuring project evaluators, I want to see run history and status for each
definition so I can tell whether an expected annotation is missing because of a filter,
sampling, overload backpressure, a configuration error, or a transient failure — and, for
failures, why and where. Evaluators are failure-prone, so this must be auditable.

## What a Project Evaluator Defines

A project evaluator is not a new evaluator type. It is a project-level attachment to an existing
evaluator definition. Each attachment specifies:

- **Project and target type** — which project it applies to, and whether to evaluate individual
  spans, whole traces, or sessions.
- **Attachment point** — where the annotation is written; may differ from the target (evaluate a
  span, annotate the trace).
- **Filter** — which artifacts are eligible (optional; may be multi-level / topology-aware — see
  [Filters](#filters)).
- **Extraction & input mapping** — how target data is extracted and mapped into the evaluator's
  inputs (see [Extraction and Input Mapping](#extraction-and-input-mapping)).
- **Sampling rate** — what fraction of *matching* (post-filter) artifacts to evaluate.
- **Completion behavior** — for traces and sessions, how long to wait after the last activity
  before treating the artifact as ready to evaluate.
- **Enabled state** — whether new evaluations should be enqueued.

A project evaluator also needs stable identity. Runs and annotations should be traceable back to
the project evaluator configuration that produced them, not only to the reusable evaluator
definition. The identity model should be rich enough to explain which evaluator, configuration,
target, attachment point, mapping, and eligibility decision produced a result or failed to do so —
this identity is what drives both audit and override behavior (see [Output](#output)).

## Extraction and Input Mapping

Mapping target data into an evaluator's inputs is two steps, not one:

1. **Extraction** — pull the values the evaluator needs out of the raw span/trace/session. This
   is more than reading attributes off a single span: the relevant data may live on a *different*
   span than the one being evaluated (e.g. a tool call sits on one span while the evaluator
   judges the messages after it), and extraction may need to hoist nested fields — "all the tool
   calls under this span as a list" — up to the entity under evaluation. A little hoisting exists
   already (`Trace.root_span`; `ProjectSession.first_input` / `last_output`), but there is no
   generalized "turn" or aggregation abstraction, so anything deeper is new — and may eventually
   become user-definable.
2. **Mapping** — bind the extracted values into the evaluator's template inputs (the existing
   dataset-style dictionary mapping).

For simple span evaluators extraction is a trivial attribute mapping; the complexity appears at
the trace and session levels, where it becomes a *hoisting* problem. Whether extraction happens
before or after filtering is open (it interacts with how complex filters need to be). We avoid
the "ETL" framing, but extraction + transformation generalizes the current evaluator input model
and needs its own data model.

## Queuing

Project evaluators are queue-driven, not job-scheduled (see [Goals](#goals)): matching artifacts
are evaluated asynchronously after ingestion. Queuing and filtering are co-equal hard problems — a
mis-sized queue can blow up under high ingest, which is why the
[overload backstop](#reliability-errors-and-auditability) exists.

The product requirements: queued work is recoverable, duplicate work does not produce duplicate
user-visible results, and skipped or failed work is explainable. Transient queue state must not be
the only record of whether something was supposed to be evaluated. The live trigger is part of the
latency story, not the whole correctness story — the system needs a way to recover eligible work
missed because of restarts, overload, delayed data, or other ordinary operational failures.

There are (at least) three trigger classes, and they are not all ingestion-driven: a span is
stored (span targets); an artifact goes quiet after an idle period (trace/session targets); and a
**late annotation arrives** — e.g. user thumbs-down feedback landing well after ingestion (the
[feedback use case](#evaluate-on-user-feedback)). The third is event-driven, not
ingestion-triggered, and is the main reason the queue cannot be purely ingestion-driven. v1 may
scope it out, but the trigger model should name it rather than leave it implicit — and its
semantics (which annotations qualify, re-trigger on update, recursion via evaluator-written
annotations) are [open question #12](#open-q-12).

Design questions include:

- When evaluation becomes eligible — on span store, after a trace/session readiness signal, or on
  a late annotation arriving.
- How the system recovers eligible work that was missed by the live path.
- Deduplication and re-evaluation when an artifact goes quiet and then receives new activity.
- Priority and fairness across project evaluators and projects.
- Backpressure when configured sampling exceeds processing capacity (see
  [Overload backstop](#reliability-errors-and-auditability)).

## Target Behavior

Project evaluators run after ingestion. They must never delay or fail ingestion.

### Spans

Spans are eligible as soon as they are stored. When a matching span is ingested, the project
evaluator runs against that span's data. On a simple level spans are the tractable case — take
the attributes (and a few extras) and push them into an LLM-as-a-judge or code-as-a-judge.

Example: judge every final-answer LLM span, or a sampled subset, for hallucination.

### Traces

Traces do not have an explicit "done" event. **How to detect completion is still open:** root
span end, an idle period after the last span, or both for different evaluator types. One viable
approach is to use a quiet period (same mechanism as sessions). If new spans arrive after an
evaluation, the trace can be re-evaluated when it goes quiet again. The visible trace annotation
reflects the latest evaluation.

Trace evaluation has two flavors. Treating a trace as its root span makes the simple case easy:
evaluate the root span's I/O ("did the agent answer my question?"). The harder case evaluates
the trajectory. Start with the root-span case. A trace annotation may also be produced by an
evaluator whose target is a span (see attachment point).

Example: after an agent trace finishes, score whether the user got a correct answer.

### Sessions

Sessions are open-ended and can resume. The likely readiness mechanism is an idle timeout: a
session is treated as ready for evaluation after no new activity arrives for some configured
duration. This is only a pragmatic proxy for "complete" — e.g. sessions idle for a day may be
considered done, even though that is not strictly true. If the session resumes and later goes idle
again, it can be evaluated again. The visible session annotation reflects the latest evaluation.

Re-evaluation **overrides** rather than stacks: if a session was judged "incomplete" and later
completes, the newer judgment should replace the earlier one (see [Output](#output) for override-key
requirements). Run history still preserves prior evaluations for audit.

Example: after a support chat ends, assess whether the agent stayed coherent and moved toward
resolution.

## Filters

Filtering is a large workstream. Today, the only filter language is the span-scoped `SpanFilter`
DSL (`src/phoenix/trace/dsl/filter.py`): a Python expression over a single span, with no
parent/child/subtree predicates. Project evaluators need more levels:

- **Target-level filters** — the target has a specific attribute or property: latency, a metadata
  field, a status/error message. This is closest to what `SpanFilter` already does, but there are
  gaps even here — span **cost is not currently filterable** (costs live in a separate
  `span_costs` table), so cost-based filtering is new work.
- **Parent / trace-level filters** — topology-aware conditions on the target's position, e.g.
  "LLM spans whose root/parent span is the orchestrator agent," or sub-agent spans. Match when
  the condition holds for the root span (the `parent_id IS NULL` span) of the trace. `SpanFilter`
  exposes `parent_id` only as a scalar column, so this is not expressible today.
- **Tree-level filters** — the target is eligible if *any* span anywhere under the trace matches
  a condition, e.g. "evaluate this trace only if a planner sub-agent was called," or "traces
  with three or more tool calls."

These need any/all semantics and can become arbitrarily complex — effectively a
"search for the bad traces" product in itself. They likely cannot be expressed purely in the
database, so some evaluation happens in Python, which makes them open-endedly expensive. We do
not need to solve all levels at launch; a subset is still useful, and we can carve out room for
the rest.

Session filtering is the hardest: there is no obvious filter vocabulary for a session yet (it may
come down to consistent metadata on root spans), and it is unclear whether a condition should
apply to *any* or *all* of the session's spans. v1 should either define a small set of session
filter options or omit session filters until that exists.

Changing a filter affects only future artifacts; it does not backfill or re-run past data.

## Sampling

Sampling controls volume after filtering. A rate of 0 evaluates nothing; 1 evaluates everything.
Sampling is applied to the post-filter subset, not to overall traffic.

### Deterministic sampling (ρ)

One likely approach is deterministic sampling. Each artifact gets a stable pseudo-random value
**ρ** (rho) in `[0, 1)` by hashing its ID (`span_id`, `trace_id`, or `session_id`, depending on
target type). A good hash yields a uniform ρ regardless of what the raw ID looks like, so all
three ID types work equally well — `session_id` being a user-supplied string rather than a random
OTel ID makes no difference once hashed. Hashing makes ρ deterministic per artifact without extra
state, so the same artifact is always in or out across retries and restarts.

An artifact is sampled when it matches the filter **and** ρ < rate.

Beyond volume control, the reason to share ρ is **density**: when several evaluators are meant to
apply to the same artifacts (so their results are comparable on those artifacts rather than
scattered across disjoint samples), a shared ρ makes them co-sample instead of each drawing an
independent subset.

Example:

```
filterA: X == '1'                          →  X == '1' && ρ < rateA   (e.g. 0.7)
filterB: X == '1' && Y == '2'              →  X == '1' && Y == '2' && ρ < rateB   (e.g. 0.5)
```

Without sampling, filterB is clearly a subset of filterA. With shared ρ, filterB's sampled set
remains a subset of filterA's **as long as rateB ≤ rateA** — every artifact B evaluates was
also eligible under A's sampling gate. The same property holds when two evaluators share the
exact filter and rate: they evaluate the identical artifacts (e.g. a cheap code evaluator at 60%
plus an LLM-as-judge on the same 60%, so results are comparable).

More generally: nested filters with nested rates (stricter filter, lower or equal rate) preserve
density automatically; no independent coin flip per evaluator is needed.

Open cases: rateB > rateA with nested filters (B could sample artifacts outside A's sample);
evaluators that need a different ρ basis; whether grouping is inferred from filter/rate nesting
or configured explicitly.

If we support both comparable and independent samples, the deterministic value should probably be
derived from an explicit sampling cohort/salt in addition to the artifact ID. Evaluators in the
same cohort share density; evaluators in different cohorts get independent deterministic samples.
This keeps the product behavior explainable instead of making correlation an accidental side
effect of implementation.

Because ρ depends only on the artifact's ID, the `ρ < rate` gate **commutes** with filtering:
`{matches filter} ∩ {ρ < rate}` is the same set regardless of order. Sampling stays *defined* as
post-filter (the sampled fraction is of the matching set), but the implementation is free to apply
the cheap ρ gate first and discard most artifacts before running the open-endedly expensive
Python tree filters from [Filters](#filters).

Changing the sampling rate affects only future artifacts.

## Output

Each successful run writes annotations to the configured attachment artifact using Phoenix's
existing annotation model (label, score, explanation). Usually the attachment artifact is the
evaluated artifact; in the hoisting case the target may be a span while the annotation is written
to the trace so the result is visible at the workflow level. `annotator_kind` (`LLM` / `CODE`)
already distinguishes automated annotations from human ones at the data level, so the remaining
gap is UI treatment and traceability back to the specific project evaluator and run — not captured
today (there is no FK from an annotation to a project evaluator).

Re-evaluation maps onto an existing mechanism: the annotation tables enforce
`UniqueConstraint(name, <target>_rowid, identifier)`, so writing with a stable `identifier` gives
upsert/override for free — a later run replaces its own prior annotation. Deriving that
`identifier` takes care, because `<target>_rowid` is the *attachment* artifact, not the source.
When the annotation lands on the artifact it evaluated, keying `identifier` on the project
evaluator configuration is enough. But when a span-level judgment is hoisted onto its enclosing
trace, `<target>_rowid` is the trace, so judgments from *different source spans* would overwrite
each other unless the `identifier` also encodes the **source span's ID** — this is not solved by
"target", which [Terminology](#terminology) defines as the artifact *type* (identical across those
spans). So the override key = project evaluator configuration + attachment point + specific source
artifact, precise enough that concurrent judgments on one trace stay distinct and a re-run
overwrites only its own prior result. This is the same uniqueness problem as
[open question #5](#open-q-5) (auto-instrumented duplicate span names). Prior evaluations are
preserved for audit not by the annotation row (overwritten) but by the run record (see
[Run Records and Audit](#run-records-and-audit)).

## Run Records and Audit

The upsert-by-`identifier` mechanism in [Output](#output) is intentionally destructive: a re-run
overwrites its own prior annotation, and a decision that produces *no* annotation (filtered out,
sampled out, overload-dropped, pending, failed) writes nothing at all. Several requirements in
this spec presuppose a durable record that the annotation tables cannot provide:

- **Audit** ("why is this annotation missing?") needs to tell filtered-out, sampled-out,
  overload-dropped, pending, failed, and succeeded apart — none of which an absent annotation row
  can express.
- **Override history** — prior evaluations should stay inspectable even though the visible
  annotation was overwritten.
- **Overload-skip visibility** and the [failure taxonomy](#open-q-10) both need somewhere to
  write a decision that produced no annotation.

None of this fits the annotation tables (no `error` column, no status column, one row per
`(name, target, identifier)`). It needs its own run/decision record — roughly one row per
evaluation attempt, capturing the target, the eligibility decision, the outcome or error, and a
link to the evaluator trace. `experiment_eval_logs` is the closest existing pattern (a per-eval-job
row with `level` / `message` / `detail`). This store is effectively v1-blocking: without it, "why
didn't this run" — which this spec calls a v1 priority — is unanswerable, and [open question #26](#open-q-26) (retention) presupposes it.

## Reliability, Errors, and Auditability

- Evaluation runs in the background and does not block ingestion or normal query traffic.
- The evaluator system should fail independently from the core observability path: if evaluation
  is unhealthy, Phoenix should still ingest and display traces normally.
- Disabling a project evaluator stops new runs immediately.
- **Overload backstop.** If configured sampling exceeds what we can process at the current ingest
  rate, a backstop must shed load so the queue does not blow up. When artifacts are skipped for
  this reason, the user must be able to see that they were skipped ("this set was meant to be
  sampled but was dropped because ingest was too high"), not have them silently disappear.
- **Self-triggering loop guard.** Evaluator runs produce their own traces, which must not
  recursively enqueue the same class of project evaluations. This largely falls out of the
  architecture: if evaluator traces live in a dedicated project (as
  [server_evaluators.md](./server_evaluators.md) proposes) and project evaluators are per-project,
  evaluator traces are only a risk when a user deliberately routes them into a monitored project —
  so the guard is a targeted check, not a pervasive concern. Note this covers only *trace*
  recursion: if annotation arrival is a trigger, evaluator-written annotations open a separate
  loop that project scoping does not close (see [open question #12](#open-q-12)).
- Transient failures (provider errors, rate limits, timeouts) should be retried with backoff;
  configuration errors should not be retried until the user fixes the setup.
- Failed runs should not write partial annotations.
- Runs and annotations should carry enough identity to explain which project evaluator,
  evaluator definition/version, target, attachment point, mapping, and eligibility decision
  produced a result or failure.

### Capturing errors

LLM-as-judge evaluators fail, retry, and sometimes give up. The live span/trace/session annotation
tables have no place to record that. Experiment-run annotations already carry an **error** column
(populated when an evaluator errors) — a precedent for surfacing failure on a different table, but
online evals should not flatten retry logs into the annotation itself.

- **Trace the evaluators** (preferred starting point). If evaluator runs are themselves traced
  (the Evaluator Traces concept proposed in [server_evaluators.md](./server_evaluators.md), not
  yet a shipped, general feature), a trace records that an error happened, and also *why* and
  *where*. The important product requirement is
  that evaluator failures can be connected back to the artifact they were trying to evaluate. This
  keeps error logs out of the annotation itself, which is treated as a completion step; flattening
  retry logs into an annotation munges two different things.
- **Stateful annotations** (progressive enhancement). Simple annotation states — queued, pending,
  completed, errored — would let a user see, for an artifact with several expected annotations,
  which are pending or failed and click through, without digging through retry-noisy logs (5
  failures that are just retries add noise). Not required for the first release; annotation state
  can be bubbled into the data model later.

A useful eventual view (per project evaluator): the artifacts that were eligible, which ran
successfully, and which failed.

**v1 priority:** evals run reliably and the user can understand recent production data within
seconds to minutes (e.g. scan the last hour and see what failed). Rich evaluator auditing comes
after queuing, filtering, and the core annotation loop work.

## Examples

### Span-level final answer judge

Filter to final-answer LLM spans. Sample 25%. Run a hallucination or answer-quality evaluator.
Results appear as span annotations (optionally hoisted onto the trace).

### Trace-level task success judge

Filter to traces matching a product workflow. Evaluate every matching trace after a quiet period.
Results appear as trace annotations. Late-arriving spans trigger a fresh evaluation.

### Session-level coherence judge

Sample 10% of sessions. Evaluate after the user goes idle. Results appear as session
annotations. Resumed sessions can be evaluated again on the next idle period, overriding the
prior annotation.

## Open Questions

This is the full backlog, including operational and security concerns implied by running
evaluators continuously against production data. The first release does **not** need to answer
all of it, so the questions are grouped into two tiers rather than kept in the order they were
raised.

### V1-blocking

These define the v1 slice; together with the run/decision record data model (see
[Run Records and Audit](#run-records-and-audit)) they must be answered before implementation.
Scope-defining questions come first.

1. Which targets should v1 support — span only, span plus root-span trace evaluation, or a
   limited trace/session subset?
2. Execution topology — where does evaluation run (in-process daemon, background process,
   separate worker), how do multiple server replicas coordinate ownership so an artifact is
   evaluated exactly once, and how do SQLite vs. PostgreSQL deployments constrain the design?
   The experiment runner already solves a version of this
   ([experiment-runner-background-process.md](./experiment-runner-background-process.md):
   heartbeat-based ownership for PostgreSQL, orphan recovery on restart, round-robin dispatch) —
   how much of it is reusable?
3. Queue design — enqueue timing, deduplication, priority/fairness, and how backpressure
   interacts with ρ-based sampling decisions.
4. How should trace readiness be detected — root-span completion, idle timeout after the last
   span, or both? What are the default timeout values for traces and sessions?
5. <a id="open-q-5"></a>How do we uniquely qualify a span for attachment when auto-instrumented span names repeat
   (e.g. an intermediary router span)?
6. Does extraction happen before or after filtering?
7. Which extraction/hoisting primitives are built in, and does v1 allow user-defined hoisting?
8. What session filter vocabulary should v1 expose, and should a session condition apply to
   *any* or *all* of the session's spans?
9. When nested filters have rateB > rateA, should B still be allowed to sample outside A's
   sample, or should density be enforced? Should grouping be inferred from filter/rate nesting
   or configured explicitly? And should the ρ hash algorithm be pinned as an explicit
   compatibility guarantee — determinism across retries and restarts is only as good as the hash
   staying fixed across Phoenix versions?
10. <a id="open-q-10"></a>What is the failure taxonomy: retryable failure, terminal failure, configuration error,
    sampled out, overload drop, disabled evaluator, and skipped because the target changed?

### Can follow v1

Important but not v1-blocking; roughly ordered by how soon each will matter, with near-resolved
questions and policy knobs at the bottom.

11. How do evaluator definition changes, prompt/model changes, mapping changes, filter changes,
    and sampling changes affect existing annotations and future override behavior?
12. <a id="open-q-12"></a>What defines the annotation-arrival trigger — which annotation names and kinds qualify (human
    feedback only?), and does an *updated* annotation re-trigger? And how is annotation-level
    recursion prevented — evaluators *write* annotations, so evaluator A's output can match
    evaluator B's annotation trigger and vice versa ([open question #25](#open-q-25) covers only trace-level recursion)?
13. <a id="open-q-13"></a>Whose credentials and execution context are used for LLM and code evaluators, and what
    isolation is required so evaluator execution cannot compromise ingestion or server health?
14. What data minimization rules apply before span/trace/session fields are sent to an external
    LLM-as-a-judge provider? And what about score integrity in the other direction — production
    span content is untrusted input fed into the judge prompt, so adversarial content (prompt
    injection) can skew scores; data minimization covers data leaving the building, not data
    lying to the judge.
15. How should late data be handled — out-of-order spans, delayed feedback annotations, and traces
    or sessions that never become quiet?
16. Where should evaluation errors surface — evaluator traces (with target metadata), a stateful
    annotation, or an error field on the annotation (as experiment-run annotations already have)?
17. `annotator_kind` already separates `LLM` / `CODE` from `HUMAN` at the data level — how should
    that surface in the UI, and how do we additionally trace an annotation back to the specific
    project evaluator that produced it (no such link exists today)? Relatedly, the annotation
    `source` column is constrained to `API` / `APP` — which value do project-evaluator annotations
    get, or do they need a third value (a schema migration if so)?
18. Which user roles may create, edit, enable, or disable project evaluators? These
    configurations spend money and send production data to external providers, so this is
    distinct from [open question #13](#open-q-13) (whose credentials *execute* the evaluation).
19. How does a user learn that an evaluator was disabled or persistently
    failing? The audit surface covers *pull* ("why is this annotation missing?"); nothing yet
    covers *push* — without it, a silently disabled evaluator is discovered days later via
    missing annotations.
20. What happens to in-flight evaluations when a project evaluator is disabled, changed, or made
    obsolete by a newer evaluation of the same target?
21. How should concurrency and fairness be enforced across projects and project evaluators so one
    noisy configuration cannot starve the rest?
22. What retry policy should LLM-as-a-judge failures use — max attempts, backoff, jitter, and
    special handling for provider rate limits?
23. How do run records and annotations interact with data retention — what happens when the
    source artifact is deleted by a retention policy, and does the missed-work recovery scan
    (see [Queuing](#queuing)) interact badly with deletion?
24. For re-evaluated traces and sessions, should users choose between updating the latest
    annotation and keeping every snapshot, or should v1 always show the latest? (Full versioning
    of evaluators/annotations is likely too heavy; a lightweight one-time "correction" mechanism
    may serve the retuning use case instead.)
25. <a id="open-q-25"></a>How are evaluator-generated traces identified and excluded so they do not recursively trigger
    project evaluators? (Largely resolved by the dedicated-project architecture — see
    [Reliability](#reliability-errors-and-auditability); what remains is the deliberately
    re-routed case.)
26. <a id="open-q-26"></a>How long should run history — run attempts, skipped decisions, failures, and previous
    overwritten annotations — be retained and remain queryable?
