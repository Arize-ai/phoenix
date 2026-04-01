# Experiment Execution

## Two-Phase Architecture

Experiments run in two sequential phases, each with its own tracer provider:

1. **Task phase** — provider uses the experiment's `projectName`.
2. **Evaluation phase** — provider uses `projectName: "evaluators"` so eval spans don't pollute the task trace view.

The task provider MUST be fully cleaned up before the eval provider is created. Both providers are created with `global: false` and explicitly attached/detached — never relying on `register()`'s built-in global registration.

## Provider Ownership

Functions that create a tracer provider own it and MUST clean it up. Functions that receive a provider from their caller MUST NOT clean it up. This enables provider reuse (e.g., `evaluateExperiment()` accepts an external provider when called standalone).

## Consistency Across Entry Points

`runExperiment()`, `resumeExperiment()`, and `resumeEvaluation()` all follow the two-phase pattern. When modifying tracing or lifecycle logic, all three MUST be updated consistently.
