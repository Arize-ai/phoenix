# Policy: good-student-issue

**Gate label:** `good student issue` — GitHub defines it as "A good issue for
students taking CS146S".

> **Temporary.** This policy serves one cohort of Stanford CS146S (class runs
> 2026-09-22 to 2026-12-15; contributions start week 2, 2026-09-28). When the
> class ends, remove it in three edits: delete this file, delete its row in the
> SKILL.md gate-policy table, and drop the `"good student issue"` example from
> the SKILL.md `description`. Also retire
> `.github/workflows/stanford-triage.yml`, the only caller. Stages 1–6 of the
> triage workflow do not depend on this policy.

## Audience

First- and second-year master's students with a rigorous CS systems core
(threading, memory models, C, algorithms), **zero** Phoenix familiarity, and a
mentor.

That sets the bar: reading one specific, scoped module or file is the intended
exercise, not a disqualifier. Only context spanning multiple subsystems or
undocumented history is too much.

A mentor explains the codebase; they should not have to invent the requirements.
An under-specified issue is never a good student issue no matter how appealing
the idea.

## Qualifies when all four hold

By this stage the triage workflow has already established most of this — the
gate reads its output rather than re-deriving it.

| Condition | How to check |
| --- | --- |
| **Specified** | Passed stage 2. An issue carrying `needs information` never qualifies |
| **Scoped** | `size:S` or `size:M`. See complexity note below |
| **Self-contained** | At most two `c/*` components, and no decision the student cannot make with a mentor |
| **Actionable** | Typed `bug` or `enhancement` in stage 1. Questions and discussions never qualify |

**Complexity.** `size:S` and `size:M` qualify. `size:L` qualifies **only** if
the issue is confined to a single component and its difficulty is depth rather
than breadth — a contained algorithmic or UI problem a strong student can sit
with. A `size:L` spanning components does not qualify; that is exactly the
tribal-knowledge case the audience cannot absorb.

Prefer a spread of complexity: the cohort needs `size:S` issues to start on, not
only hard ones.

Candidate areas, **illustrative not exhaustive** — a well-specified,
self-contained issue anywhere in the repo can qualify: `arize-phoenix-evals`,
`arize-phoenix-client`, OpenTelemetry instrumentation, agent tracing,
OpenInference instrumentation, REST API CRUD endpoints, or any bug with a clear
reproduction, including a scoped UI/CSS/layout bug.

Spread gating across components rather than emptying one area, so the cohort is
not 90 students queued on `c/ui`.

## Never label when any one holds

However well-specified the issue otherwise is:

- **`assignees` is non-empty** — claimed is off the table, full stop (new
  candidates only; see "Assignment is not drift" in SKILL.md)
- it touches user management, permissions, auth, or admin-level CRUD — including
  anything labelled `c/auth` or `c/rbac`
- it is a third-party integration or package submission with promotional intent
- it carries `agent-in-progress`, `blocked`, `needs information`,
  `cannot reproduce`, `duplicate`, or `stale`
- it is an epic — a checklist of sub-tasks rather than one change
