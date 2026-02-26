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

### 2026-02-26 — STEP-02 — Dataset creation path requires explicit `created_at`
- Category: `unexpected`
- Context: REST upsert endpoint implementation in `src/phoenix/server/api/routers/v1/datasets.py`.
- Observation: calling `insert_dataset(...)` without `created_at` fails at runtime because `datasets.created_at` is non-nullable, even though `insert_dataset` accepts `created_at: Optional[datetime]`.
- Impact: initial upsert-by-name on a new dataset can fail with a database integrity error.
- Action taken: set `created_at=datetime.now(timezone.utc)` when creating a dataset through the upsert route.
- Follow-up: align insertion helper signatures/default handling with actual DB non-null constraints in a cleanup pass.

### 2026-02-26 — STEP-03 — Integration endpoint coverage must be updated with new REST routes
- Category: `unexpected`
- Context: integration test bootstrap in `tests/integration/_helpers.py`.
- Observation: the integration suite fails at import time if newly added v1 routes are not listed in endpoint coverage constants, and `POST /v1/datasets/upsert` was missing.
- Impact: client integration verification is blocked even when implementation is correct.
- Action taken: added `(422, "POST", "v1/datasets/upsert")` to `_VIEWER_BLOCKED_WRITE_OPERATIONS` so the integration test gate reflects current API surface.
- Follow-up: keep endpoint coverage constants updated in the same step that adds new routes to avoid cross-step breakage.
