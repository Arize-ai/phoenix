# Testing Conventions

## Three Test Layers

### Layer 1: Unit Tests (vitest)

Mock external dependencies at module boundaries. When mocking `@arizeai/phoenix-otel`:

- `register()` MUST return an object with `getTracer()`, `forceFlush()`, and `shutdown()`.
- `attachGlobalTracerProvider()` MUST return `{ detach: vi.fn() }`.
- `forceFlush()` and `shutdown()` MUST return promises.

What to verify in tracing tests:

- `register()` called once per phase (task + eval = 2 calls) with correct `projectName` and `global: false`.
- `attachGlobalTracerProvider()` called per phase when `setGlobalTracerProvider: true`.
- Every `detach()` handle called exactly once (no leaks).

### Layer 2: Provider Lifecycle Tests (vitest, real OTel)

In `phoenix-otel/test/register.test.ts`. Uses real OTel components with spy span processors to validate the stack-based mount/detach mechanism.

### Layer 3: Integration Tests (standalone scripts)

Run against a live Phoenix server via `npx tsx`. NOT part of the vitest suite.

- File names MUST start with `integration-`.
- No vitest imports — use a plain `assert()` helper.
- MUST NOT use `console.log` (lint rule: `no-console`).
- Silence means success; `process.exit(1)` in catch handler for CI.
- Clean up OTel global state: `trace.disable()`, `context.disable()`, `propagation.disable()`.

**Sentinel provider pattern**: register a provider before the experiment, then assert it still receives spans afterward — proves the attach/detach cycle restored original state.
