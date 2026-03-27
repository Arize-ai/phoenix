# Experiment Execution

The experiment engine runs in two distinct phases with separate tracer providers. Understanding this separation is critical when modifying experiment code.

## Two-Phase Architecture

### Phase 1: Task Execution

A tracer provider is created with the experiment's project name (e.g., `"experiment-project"`). The task function runs against each dataset example, producing spans that land in the experiment's Phoenix project.

```typescript
taskProvider = register({
  projectName,
  url: baseUrl,
  batch: useBatchSpanProcessor,
  global: false, // Never auto-attach — explicit control only
});
```

### Phase 2: Evaluation

After the task provider is cleaned up, a new provider is created with `projectName: "evaluators"`. Evaluator spans land in a separate Phoenix project so they don't pollute the task trace view.

```typescript
evalProvider = register({
  projectName: "evaluators",
  url: baseUrl,
  batch: useBatchSpanProcessor,
  global: false,
});
```

### Cleanup Between Phases

The task provider MUST be fully cleaned up before evaluation begins. This ensures all task spans are flushed and the global tracer provider slot is free for the eval provider.

```typescript
await cleanupOwnedTracerProvider({
  provider: taskProvider,
  globalRegistration: taskGlobalRegistration,
});
```

The cleanup sequence is always: `forceFlush()` → `shutdown()` → `detach()`. See `rules/tracing.md` for details.

## Provider Ownership

Functions that create a tracer provider own it and are responsible for cleanup. Functions that receive a provider from their caller MUST NOT clean it up.

```typescript
const ownsProvider = !paramsTracerProvider;
// ...
finally {
  if (ownsProvider) {
    await cleanupOwnedTracerProvider({ provider, globalRegistration });
  }
}
```

This enables provider reuse — `evaluateExperiment()` can accept an external provider when called standalone.

## Global Tracer Provider Opt-In

The `setGlobalTracerProvider` parameter controls whether experiment providers are attached to the OTel global state. When `true`, the provider is mounted via `attachGlobalTracerProvider()` so that third-party instrumentation libraries (which read from globals) pick up the experiment's provider.

Both providers are always created with `global: false` and explicitly attached/detached — never relying on `register()`'s built-in global registration.

## Entry Points

There are three entry points into the experiment engine. All three follow the same two-phase pattern:

| Function | Purpose |
|----------|---------|
| `runExperiment()` | Full run: create experiment, execute tasks, evaluate |
| `resumeExperiment()` | Re-run tasks for missing/failed examples, then evaluate |
| `resumeEvaluation()` | Skip tasks, only run evaluators against existing runs |

When modifying tracing or lifecycle logic, all three functions MUST be updated consistently.

## Evaluators

Evaluators are wrapped with `asEvaluator()` which normalizes the interface. Each evaluator receives `{ input, output, expected, metadata }` and returns `{ label, score, explanation }`.

Evaluators run concurrently (controlled by `concurrency` parameter). Each evaluator invocation is traced as a span under the evaluator provider.
