# Global Tracer Provider Lifecycle

## The pnpm Module Identity Problem

In pnpm workspaces, packages that import `@opentelemetry/api` may resolve to different module instances (different symlink paths = different module identity). If `phoenix-otel` set globals through the SDK's import of the API and `phoenix-client` read them through its own import, they would see different state.

All global state mutations MUST go through `setGlobalProvider()` in `register.ts`, which uses this module's own OTel API imports. The OpenTelemetry JS 3 `TracerProvider` has no `register()` method.

## Stack-Based Mount System

`attachGlobalTracerProvider()` pushes mounts onto a stack; `detach()` pops them. On first mount, pre-existing global state is captured as a base snapshot. When the stack empties, the snapshot is restored.

Non-topmost detaches are safe but ineffective — the mount is removed but globals are unchanged until the top mount detaches.

## Auto-Detach on Shutdown

When `register()` is called with `global: true`, `shutdown()` automatically calls `detach()`. An idempotency flag ensures detach runs at most once.

With `global: false` (as phoenix-client experiments use), this binding is not applied — callers manage attachment explicitly.

## Invariants

1. Every `attachGlobalTracerProvider()` MUST have a corresponding `detach()` (explicit or via shutdown).
2. After all mounts detach, globals MUST be restored to the base snapshot.
3. Global state MUST only be set through this module's OTel API imports.
4. Out-of-order detach MUST NOT corrupt global state — it is silently ignored.
5. The base snapshot is captured once (on first attach) and cleared when the stack empties.
