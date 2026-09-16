# Policy: good-student-issue

**Label:** `good student issue`

> **Temporary.** This policy exists for one cohort of a Stanford master's class.
> When the class ends, remove it in three edits: delete this file, delete its row
> in the SKILL.md policy table, and drop the `"good student issue"` example from
> the SKILL.md `description`. Also retire
> `.github/workflows/stanford-triage.yml`, which is the only caller. Nothing in
> the classifier itself depends on this policy.

## Audience

First- and second-year master's students with a rigorous CS systems core
(threading, memory models, C, algorithms), **zero** Phoenix familiarity, and a
mentor.

That sets the bar: reading one specific, scoped module or file is the intended
exercise, not a disqualifier. Only context spanning multiple subsystems or
undocumented history is too much.

## Qualifies when all three hold

- current behavior and expected behavior are both clear
- scope lands in one module, file, or package
- the body gives a student a real starting point

Candidate areas, **illustrative not exhaustive** — a well-specified,
self-contained issue anywhere in the repo can qualify: `arize-phoenix-evals`,
`arize-phoenix-client`, OpenTelemetry instrumentation, agent tracing,
OpenInference instrumentation, REST API CRUD endpoints, or any bug with a clear
reproduction, including a scoped UI/CSS/layout bug.

## Never label when any one holds

However well-specified the issue otherwise is:

- **`assignees` is non-empty** — claimed is off the table, full stop
- it touches user management, permissions, auth, or admin-level CRUD
- it is a third-party integration or package submission with promotional intent
