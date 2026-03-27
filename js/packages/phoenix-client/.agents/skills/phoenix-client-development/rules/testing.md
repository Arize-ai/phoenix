# Testing Conventions

Tests in phoenix-client use three layers, each validating different concerns. No single layer covers everything.

## Layer 1: Unit Tests (vitest)

Unit tests live in `test/` mirroring the `src/` structure and are named `*.test.ts`. They mock external dependencies at module boundaries.

### Mocking phoenix-otel

Experiment tracing tests mock `@arizeai/phoenix-otel` at the module level. The mock MUST implement the functions the experiment code actually calls:

```typescript
vi.mock("@arizeai/phoenix-otel", () => ({
  register: vi.fn(({ projectName }) => ({
    getTracer: vi.fn(() => ({ startActiveSpan: vi.fn(/* ... */) })),
    forceFlush: vi.fn(() => Promise.resolve()),
    shutdown: vi.fn(() => Promise.resolve()),
  })),
  attachGlobalTracerProvider: vi.fn(() => ({ detach: vi.fn() })),
  createNoOpProvider: vi.fn(() => ({ /* ... */ })),
  objectAsAttributes: vi.fn((value) => value),
  SpanStatusCode: { OK: 1, ERROR: 2 },
}));
```

Key points:
- `register()` MUST return an object with `getTracer()`, `forceFlush()`, and `shutdown()`.
- `attachGlobalTracerProvider()` MUST return `{ detach: vi.fn() }`.
- `forceFlush()` and `shutdown()` MUST return promises.

### Mocking the Phoenix Client

The `PhoenixClient` is mocked by providing a plain object with `GET`, `POST`, and `config`:

```typescript
client = {
  GET: vi.fn(),
  POST: vi.fn((url: string) => {
    if (url === "/v1/datasets/{dataset_id}/experiments") {
      return Promise.resolve({ data: { data: { /* experiment */ } } });
    }
    // ... route-based responses
  }),
  config: { baseUrl: "http://localhost:6006" },
};
```

### What to Verify in Tracing Tests

- `register()` called once per phase (task + eval = 2 calls).
- Each call uses the correct `projectName` and `global: false`.
- `attachGlobalTracerProvider()` called for each phase when `setGlobalTracerProvider: true`.
- Every `detach()` handle is called exactly once (no leaks).

## Layer 2: Provider Lifecycle Tests (vitest, real OTel)

Tests in `phoenix-otel/test/register.test.ts` use real OpenTelemetry components with spy span processors. These validate the stack-based mount/detach mechanism without mocking.

Patterns tested:
- Multiple attached providers (stack ordering).
- Restore previous provider after detach.
- Auto-detach on shutdown.
- Out-of-order detach (ignored gracefully).

## Layer 3: Integration Tests (standalone scripts)

Integration tests run against a live Phoenix server and are **not** part of the vitest suite. They are standalone TypeScript files executed directly:

```bash
npx tsx test/experiments/integration-tracer-provider-lifecycle.ts
```

### Conventions for Integration Tests

- File name starts with `integration-` to distinguish from unit tests.
- No vitest imports — use a plain `assert()` helper function.
- Must not use `console.log` for progress/status (lint rule: `no-console`). Use a single `console.error` with an inline eslint-disable for the final error handler.
- Keep output minimal — assertions throw on failure, silence means success.
- Use `process.exit(1)` in the catch handler so CI detects failures.
- Clean up OTel global state at the end: `trace.disable()`, `context.disable()`, `propagation.disable()`.

### Sentinel Provider Pattern

To verify that experiments restore global state correctly, integration tests register a "sentinel" tracer provider before the experiment:

1. Create a provider with `InMemorySpanExporter`.
2. Emit a span, assert it was recorded.
3. Run the experiment.
4. Emit another span, assert the sentinel provider recorded it.

This proves the experiment's attach/detach cycle restored the original provider.
