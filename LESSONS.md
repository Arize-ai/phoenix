# Lessons Learned During Dataset Upsert Rollout

Use this file to capture non-obvious findings while executing the plan.

## When to add an entry
- You discover something surprising about behavior, architecture, tooling, or tests.
- You hit an unexpected failure mode, edge case, or migration concern.
- You identify something problematic (design risk, maintainability issue, performance concern).

## Entry format
Add one section per finding:

### YYYY-MM-DD — STEP-XX — Short title
- Category: `surprising` | `unexpected` | `problematic`
- Context: where this occurred (file/area/test).
- Observation: what was found.
- Impact: why it matters.
- Action taken: what changed (or why deferred).
- Follow-up: optional next step or open question.

## Entries


### 2026-02-26 — STEP-01 — `make help` target lookup is unreliable in this worktree
- Category: `unexpected`
- Context: local command execution while validating/formatting Python changes.
- Observation: `make help` exits with a shell quoting error after printing part of the help output, which makes target discovery unreliable.
- Impact: step automation cannot rely on `make help` to safely discover lint/format targets during this rollout.
- Action taken: used direct `uv run --python 3.10 ruff check --fix ...` and `uv run --python 3.10 ruff format ...` commands for touched files.
- Follow-up: investigate the `help` recipe quoting in `Makefile` separately from this upsert rollout.
