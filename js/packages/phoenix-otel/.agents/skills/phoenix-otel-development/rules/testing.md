# Testing Conventions

Tests in phoenix-otel use **real OTel components** with spy span processors — not mocks. This is the opposite of phoenix-client's approach (which mocks phoenix-otel at the module boundary). Here, we validate the actual stack mechanism and global state management.

## Setup and Cleanup

Every test file that touches global state MUST clean up in `afterEach`:

```typescript
afterEach(() => {
  detachGlobalTracerProvider();
});
```

This ensures a leaked mount from one test doesn't affect the next.

## Spy Span Processor Pattern

Tests create real `NodeTracerProvider` instances with inline spy processors to observe span routing:

```typescript
const spyProcessor = {
  onStart: vi.fn(),
  onEnd: vi.fn(),
  shutdown: vi.fn().mockResolvedValue(undefined),
  forceFlush: vi.fn().mockResolvedValue(undefined),
};

const provider = new NodeTracerProvider({
  spanProcessors: [spyProcessor],
});
```

After creating spans through the global tracer, assertions check which processor received the `onStart` call. This verifies which provider is active without mocking any OTel internals.

## Test Patterns

### Attach/Detach Isolation

Two providers with separate spy processors. Attach the first, create a span, verify the first processor received it. Detach, attach the second, create a span, verify the second processor received it. Confirms clean provider switching.

### Snapshot/Restore of External Provider

Simulates a user who registered their own provider before Phoenix code runs:

1. Create an external provider and call `provider.register()` (the SDK method).
2. Call `attachGlobalTracerProvider(phoenixProvider)`.
3. Create spans — go to Phoenix provider.
4. Call `detach()`.
5. Create spans — go to the external provider (restored from snapshot).

This is the critical "don't break the user's setup" test.

### Auto-Detach on Shutdown

Register two providers with `global: true`. Shut down the first — its auto-detach binding should fire. Verify the second provider becomes active and receives spans. Confirms `bindGlobalTracerProviderRegistrationToShutdown` works correctly.

### Out-of-Order Detach

Attach two providers. Detach the first (non-topmost). Verify it's ignored — the second provider is still active. Then detach the second and verify cleanup. Confirms stack discipline.

### URL Normalization (Parameterized)

`ensureCollectorEndpoint()` tests are parameterized with input/expected pairs:

```typescript
it.each([
  ["http://localhost:6006", "http://localhost:6006/v1/traces"],
  ["https://app.phoenix.arize.com/s/my-space", "https://app.phoenix.arize.com/s/my-space/v1/traces"],
  // ... more cases
])("normalizes %s to %s", (input, expected) => {
  expect(ensureCollectorEndpoint(input)).toBe(expected);
});
```

Cover: bare hosts, paths with and without trailing slashes, already-correct URLs (idempotent).

### Re-export Verification

`suppressTracing.test.ts` verifies that `suppressTracing` is re-exported and is identical to the `@opentelemetry/core` version. This catches accidental removal of re-exports.

## What NOT to Mock

- Never mock `@opentelemetry/api` in this package — that's the thing being tested.
- Never mock `NodeTracerProvider` — use real instances with spy processors.
- The snapshot/restore mechanism reads from `globalThis[Symbol.for("opentelemetry.js.api.1")]` — this must be the real global, not a mock.

## Adding New Tests

When adding a lifecycle test:

1. Create providers with spy processors (not real exporters).
2. Use `register()` with `global: true` or `attachGlobalTracerProvider()` directly depending on what you're testing.
3. Create spans via `trace.getTracer("test").startSpan("name").end()`.
4. Assert against `spyProcessor.onStart` call counts.
5. Always detach in `afterEach`.
