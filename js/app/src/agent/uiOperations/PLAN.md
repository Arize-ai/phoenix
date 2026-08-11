# PXI `search_ui` / `execute_ui` — UI-operation meta-tools

This branch performs the **full migration** of PXI's 34 client-action tools
(the tools that only called a zustand-registered function in the browser)
onto a two-meta-tool architecture:

- **`search_ui`** — searches a client-side _operation catalog_ and returns
  `.d.ts`-style signatures with availability/route hints.
- **`execute_ui`** — runs an agent-authored JavaScript script in a sandboxed
  **web worker**; the script calls operations through a proxied `ui.*` API
  (`await ui.playground.run({})`), and every call round-trips to the main
  thread where validation, capability/session gates, and approval staging
  live.

Design lineage: json-render (schema-described catalog the model composes
against) + codemode (collapse N tools into search-the-API + execute-code).

## What changed, end to end

### Catalog (`app/src/agent/uiOperations/`)

- `types.ts` — `UiOperationDescriptor` (namespaced name, description, zod
  `inputSchema`, `kind: read|write|approval`, `requireSession`, `uiBehavior`,
  availability route hint). The zod schema is now the **only** schema: the
  Python JSON schemas and hand-rolled TS parsers it replaces are deleted.
- `operations/*.ts` — one descriptor per migrated tool, 35 total (34 migrated
  - naming split), grouped per feature. Python `DESCRIPTION`s ported
    verbatim; old tool names in prose rewritten to operation names.
- `catalog.ts` — the known-operations list, search/scoring, and signature
  rendering. **Mounted handlers still live in
  `agentStore.registeredClientActions`**, now keyed by operation name — this
  preserves the store-subscription waiters (`waitForRegisteredClientActions`)
  used by the open-form flows. `registerUiOperation({ agentStore, descriptor,
handler })` is the typed wrapper components use.
- `dispatch.ts` — the per-call choke point: catalog lookup (unknown names get
  did-you-mean suggestions) → capability gate → session gate → mounted check
  (with route hint) → zod validation → handler invocation.
- `runtime/` — the worker sandbox. One fresh worker per `execute_ui` call;
  global hygiene (no fetch/XHR/WebSocket/indexedDB in the realm); nested-Proxy
  `ui` API; main-thread-enforced wall-clock and call budgets;
  `worker.terminate()` on overrun or interrupt. The wall-clock budget
  **pauses** while an approval-kind call awaits the user.

### Operation names

Namespaces: `timeRange.*`, `spansFilter.*`, `playground.prompt.*`,
`playground.prompt.tools.*`, `playground.instance.*`, `playground.model.*`,
`playground.run` (+ `.cancel`, `.readOutput`), `playground.variables.*`,
`playground.messages.*`, `playground.experiment.*`,
`playground.repetitions.*`, `playground.dataset.*`, `evaluators.*`,
`evaluators.code.*`, `evaluators.llm.*`. `search_ui` with an empty query
lists everything.

### Approvals became await points

The seven approval flows (prompt edit/removal, prompt-tools write, save
prompt, load dataset, code/llm evaluator draft edits) now work like this:

1. The operation handler stages the pending entry and returns a **promise
   that stays pending** until the user decides; the script sits parked on
   `await ui.playground.prompt.edit(...)`.
2. The binder modules (`bindPending*Actions`) take an `emitResult` resolver
   instead of the retired `addToolOutput` sender: accept/reject resolve the
   promise with `{ ok: true, output: { status: "accepted" | "rejected", … } }`;
   staleness and navigation-cancel resolve `{ ok: false, error }`.
3. Pending entries are keyed by the **inner call id**
   (`<executeUiToolCallId>:<sequence>`) — the field is still named
   `toolCallId` to limit churn. Interrupt/rewind cleanup
   (`pendingToolStateCleanup.ts`) aborts the script run and clears entries by
   tool-call-id prefix.
4. Bypass edit mode auto-accepts exactly as before (`shouldAutoAccept`).

### Chat rendering

`ToolPart.tsx` renders `execute_ui` with `ExecuteUiToolDetails`: the script,
generic Accept/Reject cards for any child approvals (wired to the same
accept/reject closures), and the run result. The old per-tool cases remain in
the switch so historical transcripts still render. Known follow-up: the
bespoke diff renderings (side-by-side prompt diff, evaluator draft diff) are
replaced by generic summaries in script-child cards for now.

### Rehydration semantics (builds on the pending-approvals branch)

`execute_ui` is **not** `rehydratable`: a script cannot be safely re-run on
session load (it may have already applied writes). Unresolved `execute_ui`
calls are resolved by the existing stale-call path with
`PENDING_TOOL_CALL_NOT_RESTORED_ERROR`, and the model re-issues the script if
still needed.

### Server side (`src/phoenix/server/`)

- `capabilities/tools/external/` — the 34 per-tool modules are deleted;
  `search_ui.py` and `execute_ui.py` are the two new static capabilities.
  Registry membership still drives the `toolExecutionEnvironment: "client"`
  stamp in `routers/agents.py`, so both meta-tools are registered in
  `_EXTERNAL_TOOL_DEFINITIONS_BY_NAME`.
- Instructions: `SEARCH_UI_TOOL_INSTRUCTIONS.xml.j2` /
  `EXECUTE_UI_TOOL_INSTRUCTIONS.xml.j2` teach the search→script loop,
  approval-await semantics, and error recovery.
- Dataset CRUD tools, `ask_user`, `batch_span_annotate`, `patch_experiment`,
  `get_route_info`, `render_generative_ui`, and the annotation-config tools
  are **unchanged** — they were never zustand client actions.

## Testing status

Unit tests that asserted the per-tool architecture (registry contract per
tool name, per-tool schema pins in Python, approval factories' old context
contract) were removed rather than rewritten — new tests land after the
behavior is validated on this branch. Remaining suites pass.

## Known follow-ups

1. Bespoke diff cards for script-child approvals (prompt diff, evaluator
   draft diff) — currently generic summaries.
2. Streaming per-call progress into the `execute_ui` card while the script
   runs (today the card shows script + approvals + final result).
3. PXI evals (`evals/pxi/`) and Playwright suites still assert old tool
   names; they need the "execute_ui script called op X" mapping.
4. CSP hardening: fail with a clear tool error when a strict-CSP deployment
   blocks `new Function` in the worker.
5. Consider advertising the catalog TOC in the request body so simple
   one-action asks skip the `search_ui` round-trip.
