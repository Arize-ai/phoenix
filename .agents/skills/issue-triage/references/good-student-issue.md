# Policy: good-student-issue

**Gate label:** `good student issue` — GitHub defines it as "A good issue for
students taking CS146S".

> **Temporary.** This policy serves one cohort of Stanford CS146S (class runs
> 2026-09-22 to 2026-12-15; contributions start week 2, 2026-09-28). When the
> class ends, remove it in three edits: delete this file, delete its row in the
> SKILL.md policy table, and drop the `"good student issue"` example from the
> SKILL.md `description`. Also retire
> `.github/workflows/stanford-triage.yml`, the only caller. Nothing in the
> classifier depends on this policy.

## Audience

First- and second-year master's students with a rigorous CS systems core
(threading, memory models, C, algorithms), **zero** Phoenix familiarity, and a
mentor.

That sets the bar: reading one specific, scoped module or file is the intended
exercise, not a disqualifier. Only context spanning multiple subsystems or
undocumented history is too much.

## Qualifies when all three hold

- **Specified.** Passes every check in "Specification bar" below.
- **Scoped.** Lands in one module, file, or package.
- **Self-contained.** Needs no tribal knowledge spanning subsystems, and no
  product decision the student cannot make alone with a mentor.

Candidate areas, **illustrative not exhaustive** — a well-specified,
self-contained issue anywhere in the repo can qualify: `arize-phoenix-evals`,
`arize-phoenix-client`, OpenTelemetry instrumentation, agent tracing,
OpenInference instrumentation, REST API CRUD endpoints, or any bug with a clear
reproduction, including a scoped UI/CSS/layout bug.

## Specification bar

Under-specified issues are the main failure mode: a student burns days deciding
what to build instead of building. Gate an issue only if its body answers, in
its own text, **all** of:

- **What happens now** — current behavior, or the error/stack trace for a bug
- **What should happen instead** — the expected behavior or interface, concretely
- **Where to start** — a named file, module, endpoint, command, or UI surface,
  or enough specificity that one search finds it

Reject outright, however appealing the idea:

- an empty body, or a body that only restates the title
- a one-line wish: "would be nice to have X", "support Y"
- a bare link, screenshot, or log dump with no written expectation
- a question rather than a request for change
- a feature whose interface is still an open design question
- a checklist of many sub-tasks — that is an epic, not an issue

A mentor being available does not lower this bar. The mentor explains the
codebase; they should not have to invent the requirements.

## Dimensions

Apply exactly one complexity label and at least one domain label to every gated
issue.

### Complexity — `size:S` / `size:M` / `size:L`

These labels' GitHub descriptions ("This PR changes N lines…") are written for
pull requests by a bot that only labels PRs. **On issues they mean student
effort**, per this table; that is this policy overriding the description, as the
classifier's label-definition rules allow.

| Label | Means | Shape |
| --- | --- | --- |
| `size:S` | easy | One file, obvious fix, no design latitude — a clear bug with a repro, a validation tweak, a message or doc-string correction |
| `size:M` | medium | A few files in one module, follows an existing pattern — a new endpoint mirroring a sibling, a new evaluator, a contained UI fix |
| `size:L` | hard | Several files within one subsystem, some real design choices. The ceiling for a student with a mentor |

Bigger than `size:L` does not qualify — it fails "Scoped". Never apply
`size:XS`, `size:XL`, `size:XXL` to an issue.

### Domain — the `c/*` family

Use the existing `c/*` labels (`c/ui`, `c/server`, `c/evals`, `c/cli`,
`c/client`, `c/traces`, …), taking each label's meaning from its GitHub
description where it has one. Most gated issues already carry one; add one only
when it is missing and the right domain is unambiguous from the issue text. When
two domains genuinely apply, apply both. When unsure, leave domain alone — a
missing domain label is cheaper than a wrong one.

Spread gating across domains rather than emptying one area, so the cohort is not
90 students queued on `c/ui`.

## Never label when any one holds

However well-specified the issue otherwise is:

- **`assignees` is non-empty** — claimed is off the table, full stop (Pass A
  only; see "Assignment is not drift" in SKILL.md)
- it touches user management, permissions, auth, or admin-level CRUD — including
  anything labeled `c/auth` or `c/rbac`
- it is a third-party integration or package submission with promotional intent
- it carries `agent-in-progress`, `blocked`, `needs information`,
  `cannot reproduce`, `duplicate`, or `stale`
