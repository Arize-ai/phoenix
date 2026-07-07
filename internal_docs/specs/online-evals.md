# Project Evaluators

Project evaluators are project-level automations that run existing evaluators against live
`spans`, `traces`, and `sessions` after ingestion. They provide continuous measurement of
production traffic.

This spec builds on [server_evaluators.md](./server_evaluators.md), which defines reusable
evaluator definitions. This document covers how those evaluators are attached to projects and
run against live data.

## Goals

- Automatically evaluate spans, traces, and sessions as live data arrives.
- Scope evaluated data with filters and input mappings.
- Control cost and volume with sampling.
- Persist results as annotations on the evaluated artifact.
- Keep ingestion reliable by running evals asynchronously in the background.

## Non-Goals

- Downstream automations such as "add to dataset", alerting, paging, or workflow triggers.
- Backfilling evals over historical data.
- Arbitrary session-level filtering until a clear session filter vocabulary exists.

## Terminology

- **Evaluator definition** — A reusable evaluator (LLM, code, or built-in) defined by the server
  evaluator system.
- **Project evaluator** — A project attachment that binds one evaluator definition to live data.
  It specifies what to evaluate, when, and at what rate.
- **Target** — The artifact type a project evaluator runs against: `span`, `trace`, or `session`.

## Use Cases

### Monitor final answers in production

As a user running a RAG or agent application, I want to automatically judge a sample of
final-answer LLM spans so I can spot hallucinations and quality regressions without manually
reviewing every response.

### Score completed agent traces

As a user tracing multi-step agent workflows, I want to evaluate each trace after it finishes
so I can measure task success, tool-use correctness, or user frustration at the workflow level
rather than on individual spans.

### Assess long-running sessions

As a user with conversational agents, I want to evaluate a session after the user goes idle so
I can measure coherence, resolution, and trajectory over the full conversation — not just the
last turn.

### Control cost at scale

As a user with high-volume production traffic, I want to filter to the spans or traces that
matter and sample a fraction of them so automated evaluation stays affordable without turning
off monitoring entirely.

### Triage failures in the UI

As a user reviewing production data, I want evaluator results to appear as annotations on
spans, traces, and sessions — the same surfaces I already use for human review — so I can
filter, sort, and drill into flagged artifacts.

### Understand why an eval did or didn't run

As a user configuring project evaluators, I want to see run history and status for each
definition so I can tell whether an expected annotation is missing because of a filter,
sampling, a configuration error, or a transient failure.

## What a Project Evaluator Defines

A project evaluator is not a new evaluator type. It is a project-level attachment to an existing
evaluator definition. Each attachment specifies:

- **Target type** — whether to evaluate individual spans, whole traces, or sessions.
- **Filter** — which artifacts are eligible (optional).
- **Input mapping** — how target data is mapped into the evaluator's inputs.
- **Sampling rate** — what fraction of matching artifacts to evaluate.
- **Completion behavior** — for traces and sessions, how long to wait after the last activity
  before treating the artifact as ready to evaluate.
- **Enabled state** — whether new evaluations should be scheduled.

The setup flow should make cost and blast radius visible before enabling:

1. Select a project and target type.
2. Select or create the evaluator.
3. Configure input mapping from a recent example artifact.
4. Configure filter and sampling rate.
5. Preview matching recent artifacts and estimated run volume.
6. Enable the project evaluator.

## Target Behavior

Project evaluators run after ingestion. They must never delay or fail ingestion.

### Spans

Spans are eligible as soon as they are stored. When a matching span is ingested, the project
evaluator runs against that span's data.

Example: judge every final-answer LLM span, or a sampled subset, for hallucination.

### Traces

Traces do not have an explicit "done" event. A trace is treated as complete after it has been
quiet for a configured idle period. If new spans arrive after an evaluation, the trace can be
re-evaluated when it goes quiet again. The visible trace annotation reflects the latest
evaluation.

Example: after an agent trace finishes, score whether the user got a correct answer.

### Sessions

Sessions are open-ended and can resume. A session is treated as ready for evaluation after it
has been idle for a user-configured duration. If the session resumes and later goes idle again,
it can be evaluated again. The visible session annotation reflects the latest evaluation.

Example: after a support chat ends, assess whether the agent stayed coherent and moved toward
resolution.

## Filters and Sampling

**Filters** narrow which artifacts are considered. Span and trace filters reuse Phoenix's
existing span filter expressions. Session filters need their own vocabulary — v1 should either
define a small set of session filter options or omit session filters until that exists. Changing
a filter affects only future artifacts; it does not backfill or re-run past data.

**Sampling** controls volume after filtering. A rate of 0 evaluates nothing; 1 evaluates
everything; intermediate values evaluate a stable subset so the same artifact is not randomly
included or excluded across retries or restarts. Changing the sampling rate affects only future
artifacts.

## Output

Each successful run writes annotations to the evaluated artifact using Phoenix's existing
annotation model (label, score, explanation). Annotations should be clearly distinguishable from
human-created annotations and traceable back to the project evaluator and run that produced
them.

For traces and sessions that are re-evaluated after new activity, the latest annotation on the
artifact should represent the most recent automated judgment. Run history should preserve prior
evaluations for audit.

## Reliability Expectations

- Evaluation runs in the background and does not block ingestion or normal query traffic.
- Disabling a project evaluator stops new runs immediately.
- Transient failures (provider errors, timeouts) should be retried; configuration errors should
  not be retried until the user fixes the setup.
- Failed runs should not write partial annotations.
- Users should be able to see why a run failed.

## Examples

### Span-level final answer judge

Filter to final-answer LLM spans. Sample 25%. Run a hallucination or answer-quality evaluator.
Results appear as span annotations.

### Trace-level task success judge

Filter to traces matching a product workflow. Evaluate every matching trace after a quiet period.
Results appear as trace annotations. Late-arriving spans trigger a fresh evaluation.

### Session-level coherence judge

Sample 10% of sessions. Evaluate after the user goes idle. Results appear as session
annotations. Resumed sessions can be evaluated again on the next idle period.

## Open Questions

1. What are the default trace and session idle timeout values?
2. How should automated annotations be distinguished from human annotations in the UI?
3. What session filter vocabulary should v1 expose?
4. For re-evaluated traces and sessions, should users choose between updating the latest
   annotation and keeping every snapshot, or should v1 always show the latest?
5. How long should run history be retained?
