# Evaluator playground MVP — issue #15861

Implemented on `cephalization/project-evaluators-playground` for one PR.

## Agreed scope

- `/playground?mode=evaluators` with Prompts/Evaluators mode selection.
- Upper editor and lower shared results layout; Compare adds a second independent slot.
- Existing or new LLM/code evaluators, input mapping, one categorical output per slot.
- Configurable sample of the first 1–500 dataset examples (default 20) with optional splits.
- Manual human expected labels, editor changes, and reruns.
- A/B exact label agreement only for matching label sets; A is a baseline.
- Explicit Save as new copies; temporary draft/run state.
- Narrow versioned metadata mutation preserves review provenance and rejects stale calibration writes.

## Validation

Frontend typecheck, lint, production build, and 2,527 tests passed (12 skipped). Focused backend calibration tests passed on SQLite; PostgreSQL variants require a local PostgreSQL installation. Browser validation uses localhost:6008 with a temporary two-example dataset.

## Deferred

Automatic optimization, persistent run history, more than two slots, continuous/freeform calibration, label remapping, and updating existing evaluator definitions in place.
