# Tracing and Provider Management

## Route All Global State Through phoenix-otel

In pnpm workspaces, packages may resolve `@opentelemetry/api` to different module instances (different symlink paths = different module identity). If one package calls `provider.register()` and another reads globals through a different import, they see different state.

All global tracer provider mutations MUST go through `phoenix-otel`'s `attachGlobalTracerProvider()` / `detachGlobalTracerProvider()`. NEVER call `provider.register()` directly.

## Cleanup Sequence

`cleanupOwnedTracerProvider()` runs: `forceFlush()` → `shutdown()` → `detach()`.

- `forceFlush()` before `shutdown()` — otherwise pending spans are lost.
- `detach()` in `finally` — globals MUST be cleaned even if shutdown fails.

## Stack-Based Mount System

`phoenix-otel` maintains a provider mount stack. See `phoenix-otel`'s `rules/global-provider-lifecycle.md` for details. Experiments can temporarily replace a user's global provider; the stack restores it automatically on detach.
