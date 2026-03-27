# Testing Conventions

## Real OTel, Not Mocks

Tests use real OTel components with spy span processors. This validates the actual stack mechanism and global state management.

MUST NOT mock:

- `@opentelemetry/api` — that's the thing being tested.
- `NodeTracerProvider` — use real instances with spy processors.
- The global state at `globalThis[Symbol.for("opentelemetry.js.api.1")]` — MUST be real.

## Cleanup

Every test that touches global state MUST call `detachGlobalTracerProvider()` in `afterEach`. A leaked mount corrupts subsequent tests.

## Writing New Tests

1. Create providers with spy processors (not real exporters).
2. Use `register()` with `global: true` or `attachGlobalTracerProvider()` directly.
3. Create spans via `trace.getTracer("test").startSpan("name").end()`.
4. Assert against `spyProcessor.onStart` call counts to verify which provider is active.
5. Always detach in `afterEach`.
