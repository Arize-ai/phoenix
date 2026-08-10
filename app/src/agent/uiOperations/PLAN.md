# RFC: `search_ui` / `execute_ui` — generic meta-tools for PXI client operations

## Summary

Replace the ~35 per-operation client-action tools (and eventually the dataset
tools) with **two meta-tools**:

- **`search_ui`** — progressive discovery: the model searches a client-side
  _operation catalog_ and gets back `.d.ts`-style signatures it can write
  code against.
- **`execute_ui`** — execution: the model submits a JavaScript **script** that
  runs in a sandboxed **web worker** and calls operations through a proxied
  `ui.*` API; every call round-trips to the main thread where validation,
  capability gates, and approval staging live.

The design borrows from two prior arts:

- **json-render** — a catalog of schema-described building blocks the model
  composes against, with validation at the boundary.
- **codemode** (opencode) — collapse N tools into "search the API" +
  "execute code against the API", with progressive disclosure and real
  composition (branching, loops, feeding one result into the next call).

## Why

Today each client-executed tool exists in three hand-synchronized places:

1. A Python module in
   `src/phoenix/server/agents/capabilities/tools/external/<name>.py` with a
   hand-written JSON schema (see the "drift warning" comments these files
   carry).
2. A hand-rolled `parseInput` in `app/src/agent/tools/<name>/`.
3. A `defineClientActionTool` config wiring it to a zustand-registered
   client action.

Consequences: schema drift is a standing hazard; adding an operation requires
a server release; and every tool schema is advertised to the model on every
request (~60 tool schemas of prompt tokens).

After this change:

- **One source of truth.** A zod schema per operation, colocated with its
  handler registration. The runtime validator, the model-facing JSON schema,
  and the `search_ui` signature all derive from it. The Python schema files
  are deleted.
- **Client-only iteration.** Adding a UI operation is a frontend change.
- **Two advertised schemas** instead of ~60, plus real composition: scripts
  can read an output, branch on it, and loop — impossible with per-call
  tools.

## Architecture

```
   server advertises: search_ui, execute_ui          (2 Python files, stable)
                          │
                          ▼
   app/src/agent/uiOperations/
     searchUiAgentTool ── searches ──► catalog  ◄── registers ── mounted
     executeUiAgentTool ─ runs ─┐       │  ▲                     components
                                ▼       ▼  │                     (zustand-side)
                        uiScriptBridge ─ dispatch ─► zod validate ─► handler
                                │  ▲
                     postMessage│  │postMessage
                                ▼  │
                        uiScriptWorker (fresh per run)
                          `ui.*` proxy + agent script
```

### The operation catalog (json-render's registry idea)

`types.ts` defines `UiOperationDescriptor`: namespaced name
(`timeRange.set`), description, **zod input schema**, `kind`
(`read | write | approval`), capability/session requirements, chat
`uiBehavior`, and an availability route hint.

- Descriptors are **statically known** (importable list) so `search_ui` can
  describe operations whose pages are not mounted and say how to reach them.
- **Handlers are registered at mount** — exactly today's
  `registeredClientActions` lifecycle, but the registration carries the
  descriptor so handler and schema cannot disagree (compile-checked in
  `registerUiOperation`).
- RFC scope: the catalog is module-scoped in `catalog.ts`. Real
  implementation: it moves onto the agent store next to (then replacing)
  `registeredClientActions`.

### `search_ui` (codemode's discovery idea)

Input `{ query?: string, mountedOnly?: boolean }`. Empty query returns the
whole catalog as a table of contents. Results render as signatures with doc
comments — the literal API the model writes against:

```ts
/**
 * Set the Phoenix app time range selector. ...
 * kind: write; available on the current page
 */
ui.timeRange.set(input: { timeRangeKey: "15m" | "1h" | "12h" | "1d" | "7d" | "30d" | "custom"; startTime?: string; endTime?: string }): Promise<UiResult>;
```

Substring/token scoring is sufficient at ~60 operations; no index or
embeddings. Availability is first-class: an unmounted operation renders with
its route hint so the agent navigates instead of dead-ending.

### `execute_ui` and the worker runtime

Input is `{ script: string }` only. Example script the model would write:

```js
const result = await ui.timeRange.set({
  timeRangeKey: "custom",
  startTime: "2026-08-01T00:00:00Z",
});
if (!result.ok) return result.error;
log("time range set; checking output");
return await ui.playground.readOutput({});
```

**Why a worker.** It is an _execution_ boundary with exactly the properties
we need:

- `worker.terminate()` hard-kills a runaway script mid-loop — impossible for
  main-thread eval.
- The realm has no DOM, no zustand, no Relay: every effect **must** flow
  through the `ui` RPC, which is where validation and gating live.
- The main thread stays responsive; Vite bundles module workers natively.

**What a worker is not:** a same-origin security boundary. PXI scripts run at
user trust level (as the bash tool and `phoenix-gql` already do). As
defense-in-depth the bootstrap removes `fetch`, `XMLHttpRequest`,
`WebSocket`, `importScripts`, `indexedDB`, etc., so the `ui` proxy is the
worker's only capability in practice. If a hard boundary is ever wanted, the
upgrade path is QuickJS-wasm/SES behind the same message protocol.

**Lifecycle:** one fresh worker per run — spawn, run, terminate. No state
leaks between runs; startup is single-digit ms.

**The `ui` proxy** is built from nested `Proxy`s, so _any_ property path is
callable. Unknown names are intentionally forwarded and rejected on the main
thread with a did-you-mean error (`dispatch.ts`) — far more recoverable for
the model than `undefined is not a function` inside the script.

**Limits (all enforced main-thread-side**, so the worker can't evade them):
wall-clock timeout (default 30s) enforced by `terminate()`; per-script `ui.*`
call budget (default 50); output size caps at the tool-output layer.

**CSP:** Phoenix sets no Content-Security-Policy today, so `new Function`
inside the worker works. A self-hosted deployment fronted by a strict-CSP
proxy would break dynamic evaluation; the runtime should detect this at
startup and fail with a clear tool error (follow-up, not MVP).

**Serialization:** all inputs/outputs cross `postMessage` structured clone —
plain JSON only, which the zod schemas already guarantee.

### Approvals become an await point

`approval`-kind operations (the `emitSuccess: false` family: prompt edits,
save prompt, evaluator drafts) stage a pending Accept/Reject entry and
resolve their promise **only when the user decides**. The script simply
awaits; two rules make this sound (both in `uiScriptBridge.ts`):

1. The wall-clock budget **pauses** while an approval-kind call is in flight
   and resumes after — user think-time never burns script budget.
2. The chat UI shows a "script paused, awaiting approval" state.

Bypass edit mode auto-applies, exactly as today.

### Chat rendering

Rendering one opaque card per `execute_ui` call would badly regress UX.
Instead the bridge emits per-call progress, and each inner call renders its
own card using the descriptor's `uiBehavior` — preserving today's per-tool
cards (including Accept/Reject) inside a collapsible script frame. (Not in
this RFC; needs the `appendMessagePart` path.)

### Server side

The ~60 external tool modules collapse to two stable definitions plus
instructions teaching the loop (search first; never guess op names; prefer
several small scripts over one mega-script so approvals and errors stay
legible). Sketch:

```python
# src/phoenix/server/agents/capabilities/tools/external/execute_ui.py
EXECUTE_UI_PARAMETERS = {
    "type": "object",
    "properties": {
        "script": {
            "type": "string",
            "description": (
                "JavaScript executed in the browser sandbox. Await calls on the "
                "`ui` object discovered via search_ui, e.g. "
                "`return await ui.timeRange.set({timeRangeKey: '7d'})`. "
                "`log(msg)` emits progress; the return value becomes the output."
            ),
        }
    },
    "required": ["script"],
    "additionalProperties": False,
}
```

Optional refinement: `buildAgentChatRequestBody.ts` already ships per-request
context; including a compact catalog TOC (or full signatures for the most
common ops) lets simple one-action asks skip the `search_ui` round-trip
entirely — the main mitigation for the latency/reliability risk below.

## Example conversion: `set_time_range` → `timeRange.set`

**Deleted** (after full migration):

- `src/phoenix/server/agents/capabilities/tools/external/set_time_range.py`
- `app/src/agent/tools/timeRange/` (constants, hand-rolled parser, tool def)
  and its `toolRegistry.ts` entry

**Added:** `operations/setTimeRange.ts` — one zod schema + descriptor. The
enum that previously lived in three drift-warned places is written down once.

**Handler registration** stays in `TimeRangeContext.tsx`; only the
registration call changes:

```diff
   useEffect(() => {
-    const { registerClientAction, unregisterClientAction } =
-      agentStore.getState();
-    registerClientAction(SET_TIME_RANGE_TOOL_NAME, (input) =>
-      handleSetTimeRange(input as SetTimeRangeInput)
-    );
+    registerUiOperation({
+      descriptor: setTimeRangeOperation,
+      // Input arrives validated: `input` is typed from the zod schema, so
+      // the `as SetTimeRangeInput` cast disappears.
+      handler: handleSetTimeRange,
+    });
     return () => {
-      unregisterClientAction(SET_TIME_RANGE_TOOL_NAME);
+      unregisterUiOperation(setTimeRangeOperation.name);
     };
-  }, [agentStore]);
+  }, []);
```

`handleSetTimeRange` itself — the actual zustand/store-touching logic — is
unchanged.

## Migration plan

1. **Catalog foundations** _(this RFC's shape)_: descriptor type, typed
   registration, dispatch; move onto the agent store; convert 2–3 ops
   (`timeRange.set`, `spansFilter.set`, one approval op to prove
   await-suspension). Legacy tools keep working — both paths can share a
   handler.
2. **Meta-tools behind a capability**: add `ui.metaTools` to
   `capabilities.ts` (experimental-settings). When on, the server advertises
   `search_ui`/`execute_ui` and suppresses the migrated per-op tools.
   Per-inner-call chat rendering lands here.
3. **Mechanical migration** of the remaining client-action tools; dataset
   tools follow if desired. `bash`, `render_generative_ui`, `ask_user`,
   `get_route_info` stay native.
4. **Eval gate, then flip**: run `evals/pxi/` datasets and the PXI Playwright
   suites under both modes (assertions change from "called `set_time_range`"
   to "`execute_ui` script called `timeRange.set`"). Flip the default, delete
   the per-tool Python modules and legacy client plumbing.

## Risks

| Risk                                                       | Mitigation                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Simple one-action asks now cost search→execute round-trips | Catalog TOC / common-op signatures in advertised instructions; evals gate the flip                                 |
| Chat UX regresses to opaque script cards                   | Per-inner-call cards from descriptor `uiBehavior` (phase 2, before flip)                                           |
| Script hangs or loops                                      | Worker `terminate()` on wall-clock budget; call budget; both main-thread-enforced                                  |
| Approval waits burn script budget                          | Timer pauses during approval-kind calls                                                                            |
| Strict CSP deployments break `new Function`                | Detect at startup; clear tool error; QuickJS-wasm as escape hatch                                                  |
| Worker mistaken for a security boundary                    | Documented as execution boundary only; global hygiene is defense-in-depth; authority lives in main-thread dispatch |

## What's on this branch

Compiling, tested, and **inert** — nothing is registered in
`toolRegistry.ts`, no server changes, no existing code touched:

| File                                            | Contents                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `types.ts`                                      | `UiOperationDescriptor`, handler types, `defineUiOperation`           |
| `catalog.ts`                                    | known-ops list, mounted-handler registry, search, signature rendering |
| `dispatch.ts`                                   | per-call choke point: lookup → mounted → validate → invoke            |
| `operations/setTimeRange.ts`                    | the converted example operation                                       |
| `runtime/protocol.ts`                           | postMessage protocol types                                            |
| `runtime/uiScriptWorker.ts`                     | worker bootstrap: hygiene, `ui` proxy, script eval                    |
| `runtime/uiScriptBridge.ts`                     | spawn/RPC/limits/approval-pause/terminate                             |
| `searchUiAgentTool.ts`, `executeUiAgentTool.ts` | the two meta-tools (unregistered)                                     |
| `__tests__/uiOperations.test.ts`                | schema parity, dispatch, search, bridge protocol                      |
