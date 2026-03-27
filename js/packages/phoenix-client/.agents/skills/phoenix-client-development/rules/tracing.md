# Tracing and OpenTelemetry Provider Management

The phoenix-client package creates and manages short-lived OpenTelemetry tracer providers during experiment execution. This rule covers the patterns and pitfalls of that lifecycle.

## Core Principle: Route All Global State Through Our API

In pnpm workspaces, multiple packages may resolve `@opentelemetry/api` to different module instances (different symlink paths = different module identity). If one package calls `provider.register()` using its own `@opentelemetry/api` import, and another package reads from a different import, they see different global state.

**Solution:** All global tracer provider mutations go through `phoenix-otel`'s `attachGlobalTracerProvider()` and `detachGlobalTracerProvider()`, which use a single canonical import of the OTel API. Never call `provider.register()` directly on a `NodeTracerProvider`.

## Stack-Based Mount System

`phoenix-otel` maintains a stack of tracer provider mounts:

1. Before the first mount, a snapshot of the pre-existing global state is captured.
2. Each `attachGlobalTracerProvider(provider)` pushes a mount onto the stack and returns a `{ detach }` handle.
3. `detach()` pops the mount. If the stack is empty, the original snapshot is restored.

This enables nesting: an experiment can temporarily replace a user's existing global provider and restore it afterward.

## Cleanup Sequence

The `cleanupOwnedTracerProvider()` helper in `src/experiments/tracing.ts` encapsulates the correct teardown:

```typescript
export async function cleanupOwnedTracerProvider({
  provider,
  globalRegistration,
}: {
  provider: NodeTracerProvider | null | undefined;
  globalRegistration?: GlobalTracerProviderRegistration | null;
}): Promise<void> {
  // 1. forceFlush() — wait for pending spans to be exported
  // 2. shutdown()   — close the exporter
  // 3. detach()     — remove from global state (in finally block)
}
```

The order matters:
- `forceFlush()` before `shutdown()` — otherwise pending spans are lost.
- `detach()` in a `finally` — globals MUST be cleaned even if shutdown fails.

## Auto-Detach on Shutdown

When `register()` is called with `global: true`, it binds the global registration to the provider's `shutdown()` method. Calling `shutdown()` automatically detaches from globals.

In the experiment code, we use `global: false` and manage attachment explicitly, so this binding does not apply. But be aware of it when working on `phoenix-otel`'s `register()`.

## Key Types

```typescript
// From phoenix-otel
interface GlobalTracerProviderRegistration {
  detach: () => void;
}

// register() returns a NodeTracerProvider with forceFlush() and shutdown()
```

## What Can Go Wrong

| Symptom | Likely cause |
|---------|-------------|
| Spans land in wrong Phoenix project | Provider not cleaned up between phases |
| User's tracer provider stops working after experiment | `detach()` not called — global slot still holds experiment provider |
| Spans silently lost | `forceFlush()` not awaited before `shutdown()` |
| Different global state seen by different packages | Direct `provider.register()` call instead of `attachGlobalTracerProvider()` |
| Detach called but globals not restored | Out-of-order detach — only the top-of-stack mount can be detached |
