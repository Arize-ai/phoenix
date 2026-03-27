# Global Tracer Provider Lifecycle

The core complexity in this package is managing OTel global state safely — allowing multiple providers to be mounted and unmounted without losing the user's pre-existing provider.

## The pnpm Module Identity Problem

In pnpm workspaces, each package gets its own symlinked `node_modules`. Two packages that both `import { trace } from "@opentelemetry/api"` may resolve to **different module instances** (different symlink paths = different module identity). If `phoenix-otel` calls `provider.register()` (which uses the SDK's own import of `@opentelemetry/api`), and `phoenix-client` reads globals through its import, they see different state.

**Solution:** All global state mutations go through `setGlobalProvider()` in `register.ts`, which uses **this module's own imports** of the OTel API. Never call `provider.register()` directly on a `NodeTracerProvider`.

```typescript
// WRONG — SDK's internal import may differ from ours
provider.register();

// CORRECT — route through our API
attachGlobalTracerProvider(provider);
```

## setGlobalProvider()

This internal function manually sets up three global components that `provider.register()` would normally handle:

1. **Tracer provider** via `trace.setGlobalTracerProvider(provider)`
2. **Context manager** via `context.setGlobalContextManager(new AsyncLocalStorageContextManager())`
3. **Propagator** via `propagation.setGlobalPropagator(new CompositePropagator(...))`

The propagator uses W3C standards: `W3CTraceContextPropagator` + `W3CBaggagePropagator`.

## Snapshot/Restore Mechanism

Three internal functions manage OTel global state:

| Function | Purpose |
|----------|---------|
| `getGlobalTelemetrySnapshot()` | Capture current `tracerProvider`, `contextManager`, `propagator` from `Symbol.for("opentelemetry.js.api.1")` |
| `restoreGlobalTelemetrySnapshot(snapshot)` | Clear globals, then re-apply a captured snapshot |
| `clearGlobalTelemetry()` | Call `trace.disable()`, `context.disable()`, `propagation.disable()` |

The raw global state is accessed via `OTEL_GLOBAL_SYMBOL = Symbol.for("opentelemetry.js.api.1")`, which is the well-known symbol the OTel API uses internally to store singletons on `globalThis`.

## Stack-Based Mount System

Module-level state:

```typescript
let nextGlobalTracerProviderMountId = 0;
let managedGlobalBaseSnapshot: GlobalTelemetrySnapshot | null = null;
const managedGlobalTracerProviderMounts: GlobalTracerProviderMount[] = [];
```

### Attach Flow (`attachGlobalTracerProvider`)

1. If this is the **first mount**, capture the current global state as `managedGlobalBaseSnapshot`.
2. Allocate a unique `mountId` from the incrementing counter.
3. Push `{ id: mountId, provider }` onto `managedGlobalTracerProviderMounts`.
4. Clear existing globals, then call `setGlobalProvider(provider)`.
5. Return `{ detach: () => detachManagedGlobalTracerProvider(mountId) }`.

### Detach Flow (`detachManagedGlobalTracerProvider`)

1. Find the mount by ID in the stack.
2. Remove it from the array.
3. **Only if it was the topmost mount:** restore the next mount down (or the base snapshot if stack is empty).
4. **Non-topmost removals are silent no-ops** — stack discipline ensures only the active (top) provider can be swapped out.

This means out-of-order detaches are safe but ineffective — the mount is removed from the stack but globals are not changed until the top mount detaches.

### Why a Stack?

Experiments create two sequential providers (task then eval). If the user already has a global provider, the sequence is:

```
[user provider] → attach(task) → detach(task) → attach(eval) → detach(eval) → [user provider restored]
```

Without the stack, restoring after detach would require the caller to track the original state. The stack handles this automatically.

## Auto-Detach on Shutdown

`bindGlobalTracerProviderRegistrationToShutdown()` wraps a provider's `shutdown()` method so it automatically calls `detach()`:

```typescript
provider.shutdown = async (): Promise<void> => {
  if (!hasDetachedRegistration) {
    registration.detach();
    hasDetachedRegistration = true;
  }
  await originalShutdown();
};
```

This binding is applied when `register()` is called with `global: true`. It prevents orphaned global state if a caller shuts down the provider without explicitly detaching.

The idempotency flag (`hasDetachedRegistration`) ensures detach is called at most once, even if both `detach()` and `shutdown()` are called.

## Invariants

These MUST hold after any modification to the lifecycle code:

1. Every `attachGlobalTracerProvider()` MUST have a corresponding `detach()` (either explicit or via shutdown).
2. After all mounts are detached, globals MUST be restored to the base snapshot.
3. `setGlobalProvider()` MUST only be called through this module's imports of the OTel API — never through `provider.register()`.
4. Out-of-order detach MUST NOT corrupt global state — it is silently ignored.
5. The base snapshot is captured **once** (on first attach) and cleared when the stack empties.

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| User's provider stops working after Phoenix code runs | `detach()` not called — global slot still holds Phoenix provider |
| Spans silently lost | `forceFlush()` not awaited before `shutdown()` |
| Different global state seen by different packages | Direct `provider.register()` call bypassing `attachGlobalTracerProvider()` |
| Detach called but globals not restored | Out-of-order detach — only topmost mount triggers restoration |
| Base snapshot never restored | Mount stack not fully drained — a mount was leaked |
| `shutdown()` doesn't clean up globals | `bindGlobalTracerProviderRegistrationToShutdown` not applied (provider created with `global: false`) |
