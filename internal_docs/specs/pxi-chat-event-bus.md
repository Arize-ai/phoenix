# PXI Chat Event Bus — Session Streaming, State Machine, Multi-Client Sync

## Context

Today a PXI chat turn runs **inline in the `POST .../chat` request coroutine** (`src/phoenix/server/api/routers/agents.py:2245`): whoever POSTs owns the stream, client disconnect cancels the turn, nothing is persisted until turn end, and there is no lock — two tabs can both start turns and the loser 409s after burning tokens. There is no way for a second tab, the CLI, or (future) another user to watch an in-flight turn.

This spec introduces a per-session **in-memory event bus** with a lightweight **state machine**, a **detached turn runner**, a subscriber endpoint, and DB-visible session state for **graceful degradation** in multi-instance deployments.

### Decisions

| Decision | Choice |
|---|---|
| Turn execution | Detached background asyncio task; survives client disconnect; only explicit stop cancels |
| Multi-instance | No cross-instance streaming. Non-owning instance = read-only degraded mode + polling. State visible via DB row + heartbeat (10s), auto-release after ~30s staleness |
| Send while busy | Reject with structured 409; no queueing |
| Client-side tools | Originating client only executes; others see pending state |
| Transport | Hybrid: `POST /chat` still returns the SSE stream (bus-backed); new `GET .../events` SSE for other subscribers |
| Late join | Full chunk replay from turn start, then live tail |
| Abnormal end | Persist partial assistant message on **stop AND error** (server resolves dangling tool calls to `output-error`, closes text parts; `interrupted` marker in metadata). Resume = history-replay, same mechanism as existing client-tool continuations |
| Stop | First-class endpoint; any client with session access; works cross-instance (best effort via DB flag, ≤1 heartbeat latency) |
| Lock scope | State machine gates **all** transcript mutations: send, compact, truncate, branch, delete (title edits ungated) |
| Scope | Both agents (`assistant` + `server`), legacy route back-compat, web UI + CLI consume |

---

## Architecture overview

```
POST /chat ──validate──▶ bus.begin_turn() ──▶ TurnRunner (detached asyncio task)
   │                        │                    │ publishes chunks
   └──── SSE response = subscribe(replay) ◀──── SessionChannel
                                                  │  state machine + TurnLog (replay buffer)
GET /events ──▶ subscribe(replay, +state chunks) ─┘  + subscriber queues
POST /stop  ──▶ bus.stop() → runner.request_stop() → partial persist

DB: agent_session_runs row (state, turn_id, instance_id, heartbeat_at, stop_requested_at)
    = cross-instance visibility + lock; heartbeat daemon renews/sweeps
```

## Backend

### New modules

- `src/phoenix/server/agents/event_bus.py` — `AgentSessionEventBus` (registry + `DaemonTask` heartbeat loop, reuse `src/phoenix/server/types.py:84`), `SessionChannel` (state machine, `TurnLog` replay buffer capped ~100k chunks, subscriber `asyncio.Queue`s), `SessionRunState`, `SessionBusyError`, `SessionStateChunk` / `SessionTurnStartedChunk` (transient `data-*` chunks, registered like `SessionSummaryChunk` at `agents.py:227`), per-process `_INSTANCE_ID = uuid4().hex`.
- `src/phoenix/server/agents/turn_runner.py` — `PreparedTurn`, `TurnRunner`, `resolve_dangling_chunks` (partial-persist cleanup).
- `src/phoenix/server/agents/run_locks.py` — atomic claim/release/heartbeat SQL for both dialects (follow the `on_conflict_do_update` dialect-switch pattern of `_upsert_project_sessions`, `agents.py:1195-1229`).

### State machine

States: `idle` (no row) → `streaming` → `persisting` → `idle` | `awaiting_client_tool`; `mutating` for compact/truncate/branch/delete. Guards:

- send while non-idle → 409 busy; continuation send allowed only in `awaiting_client_tool` with matching `assistant_message_id` (reuses semantics of `_merge_messages` `agents.py:1260` / `_update_trailing_assistant_message` `:1419`); idle continuation stays allowed (legacy/post-crash path, existing 409-on-mismatch protects it).
- mutation begin allowed only from idle (or stale row takeover); held via `async with bus.hold_mutation(...)` context manager.
- Claim = single atomic upsert with takeover predicate (`heartbeat_at < now() - 30s`, or awaiting + matching message id for continuations). No row returned ⇒ busy.

### DB schema

New `AgentSessionRun` model in `src/phoenix/db/models.py` (table `agent_session_runs`): `agent_session_id` (FK CASCADE, unique), `turn_id`, `state`, `assistant_message_id`, `origin_client_id`, `instance_id`, `stop_requested_at`, `started_at`, `heartbeat_at` (+ index). Alembic migration under `src/phoenix/db/migrations/versions/` (`down_revision = "e767d3c57f32"`). Rows are ephemeral lock records; downgrade just drops the table.

### `chat` handler rework (`agents.py:1898-2400`)

1. `_prepare_turn(...)` — all current validation/history-merge/model+agent construction (lines ~1905-2243) stays in the request coroutine so 404/409/422 surface before spawn. Capture `app.state`/`event_queue` into locals; runner must never touch `request`.
2. Handler: `bus.begin_turn(...)` (409 on busy) → spawn `TurnRunner` (strong task ref on channel) → return `StreamingResponse(event_stream.encode_stream(channel.subscribe(replay=True)))` — wire format byte-identical.
3. `TurnRunner.run()` uses an **inner/outer task split**: stop cancels the inner consume task; the outer task's `finally` runs `_finalize` (never skipped by cancellation). `_finalize`: partial persist (if needed) → publish closing chunks + `TranscriptPersistedChunk` → moved trace-finalize block (root span, `force_flush`, `_persist_db_traces_and_emit_event` — currently `agents.py:2365-2396`) → state transition/row release → wake subscribers → channel GC.
4. Subscriber disconnect only removes its queue — never cancels the runner.
5. **Contract requirement**: the `start` chunk carries the canonical `server_message_id` (`agents.py:2024`) so every client (POST stream and replay) converges on one assistant message id.

### Partial persist (stop/error)

Server-side mirror of the frontend's `addInterruptedToolOutputs` (`app/src/components/agent/useAgentChat.ts:439-492`), done as **synthetic chunks** (`ToolOutputErrorChunk`, `TextEnd`, `ReasoningEnd`) appended before `accumulate_ui_message_chunks_to_ui_messages` (`src/phoenix/server/agents/data_stream_protocol.py:83`) — reuses `_build_generated_assistant_message` (`agents.py:1515`) and `_persist_agent_session_turn` (`:1447`) unchanged. Add optional `interrupted: Literal["stopped","errored"]` to `AssistantMessageMetadata` (`src/phoenix/db/types/data_stream_protocol/phoenix_types.py`). Double-persist guarded by runner flag + single `_finalize` + existing `(session, position)` unique constraint.

### New endpoints (same router/dependency stack, both agents; legacy route delegates unchanged)

- `GET /agents/{agent_id}/sessions/{session_id}/events` — SSE. Local channel: initial `SessionStateChunk` (incl. `originClientId`), full replay, live tail across turns (`data-turn-started` opens each turn and carries the submitted user message), 15s keep-alive comments. Row owned elsewhere + fresh: degraded — state-only chunks (`ownedByThisInstance: false, streamAvailable: false`), poll row ~5s. Idle: state chunk, stay open for future turns. Uses a **non-refreshing** session loader (don't bump `expires_at`/`updated_at`).
- `POST /agents/{agent_id}/sessions/{session_id}/stop` — body `{turnId?}`. Local streaming → `request_stop()` → 202; awaiting_client_tool → resolve dangling parts on persisted tail, release → 200; owned elsewhere → set `stop_requested_at` (owner honors ≤10s) → 202 remote; stale → delete row → 200; turn-id mismatch → 409.

### Heartbeat + sweeper (bus `DaemonTask`, entered in `_lifespan` next to `agent_session_sweeper`, `app.py:680`)

- 10s: batch heartbeat UPDATE for owned rows, RETURNING; missing row ⇒ lock lost ⇒ stop runner + dissolve channel; `stop_requested_at` set ⇒ honor stop.
- 30s: sweep foreign rows with stale heartbeats (crashed instance's unpersisted tail is lost — accepted).
- Shutdown: request_stop all channels, wait so partial persists land.

### Mutation gating

Bus on `app.state` + GraphQL `Context` (`src/phoenix/server/api/context.py`). Wrap `compact_agent_session` (`agents.py:1786`) and `truncate/branch/delete` in `src/phoenix/server/api/mutations/agent_session_mutations.py` in `hold_mutation`; `SessionBusyError` → 409 / GraphQL `Conflict`. Busy payload everywhere: `{code: "agent_session_busy", state, turnId, assistantMessageId, ownedByThisInstance}`.

## Frontend (app/)

Verified: `ai@7.0.22` + `@ai-sdk/react@4.0.23` support this natively — `chat.resumeStream()` → `transport.reconnectToStream()`; server `start` chunk messageId overwrites local id (convergence built in); replay into an existing partial message **duplicates parts**, so drop the partial trailing assistant message before resuming.

- **`app/src/agent/chat/sessionEventsBridge.ts` (new)** — one fetch-SSE connection per attached session (`authFetch` + `parseJsonEventStream`/`uiMessageChunkSchema` from `ai`; EventSource can't do cookie-refresh auth). Demuxes: `data-session-state` → store; `data-transcript-persisted` → `transcriptPersistence` coordinator; turn chunks → per-turn `ReadableStream` windows. Triggers `chat.resumeStream()` when a turn is in flight and this client isn't the live originator; suppresses entirely when the local POST stream is active (no double-consume). Reconnect with backoff; replay-from-start makes blips self-heal.
- **`app/src/agent/chat/AgentSessionChatTransport.ts` (new)** — extends `DefaultChatTransport`; `reconnectToStream()` returns the bridge's current turn window (or `null`). `sendMessages` config moves from `createChatForSession` (`useAgentChat.ts:294-325`) verbatim.
- **`AgentChatRuntimeContext.tsx`** — registry entry gains `{eventsBridge, refCount, lingerTimer}`; acquire/release from `useAgentChat` effect; ~30s linger absorbs panel↔slideover moves and strict-mode double-mount.
- **`app/src/store/agentStore.ts`** — new `sessionBusStateBySessionId` slice (`state, turnId, originClientId, degraded, connection`) + selectors (`selectIsSessionBusy` = local status OR bus state). Per-chat `clientId` (`crypto.randomUUID()`), sent in the POST body (`buildAgentChatRequestBody.ts`), echoed by server as `originClientId`.
- **Composer/stop** (`Chat.tsx`): busy-from-elsewhere → disabled composer with "Responding in another window…", stop enabled. Stop (`handleStopWithToolCleanup`, `useAgentChat.ts:494`) now calls the stop endpoint; server does tool cleanup + persist; keep local abort + legacy cleanup as fallback (older server / endpoint error).
- **Client tools**: `onToolCall` executes only when originator (or live local response); guard `sendAutomaticallyWhen` the same way; skip re-execution for toolCallIds already resolved (replay case). Non-originators render existing pending state + hint.
- **Degraded mode**: banner + disabled composer; bridge polls `refetchAgentSession` (`agentSessionRelay.ts:52`) ~4s until idle, then refreshes transcript into the chat.
- **Refresh mid-turn** falls out naturally: new clientId → foreign-turn resume path; busy state blocks re-send.

## CLI (`js/packages/phoenix-cli/src/pxi/`)

- `client.ts`: `subscribeToSessionEvents` (fetch-SSE + same `ai` parsers, per-turn windows into existing `streamAssistantMessage` `:358`), `stopSession`, typed `PxiBusyError` from the 409 payload, `clientId` in request body.
- `App.tsx`: attach/follow on session restore or while idle (remote turn renders live, composer disabled with `remote-streaming` status); `interruptStream` (`:870`) calls stop endpoint first, local abort as fallback.
- Regenerate `@arizeai/phoenix-client` OpenAPI types + `app/src/api/__generated__/v1.ts` (`pnpm generate:openapi`).

## Testing

- **Backend unit** (`tests/unit/server/agents/`): state machine transitions + busy payloads; replay/late-join ordering; claim/takeover/release SQL on both dialects; heartbeat lost-row + remote stop + sweeper; runner stop/error → partial persist with `interrupted` marker and resolved tool parts; success-path wire compatibility; no double persist. Router tests: send-while-busy 409, disconnect-mid-POST still persists, `/events` replay + degraded, `/stop` matrix, mutation gating.
- **Frontend unit** (vitest): bridge demux/window/suppression matrix; transport resume vs POST-stream equivalence, no duplicate parts after drop-partial + re-resume (incl. multi-segment continuation turns); originator guards.
- **Playwright e2e** (`app/tests/pxi/`, phoenix-pxi-playwright patterns): multi-tab sync, stop-from-other-tab, refresh-mid-turn (no duplicate assistant message), degraded mode via `/events` route interception.

## Milestones (each independently shippable)

1. **Schema + locks**: `AgentSessionRun` model, migration, `run_locks.py`, tests. No behavior change.
2. **Bus + detached runner + stop** (core, backend): `event_bus.py`, `turn_runner.py`, chat handler rework, partial persist, `/stop`, heartbeat daemon, lifespan wiring. Env-var kill switch (e.g. `PHOENIX_AGENTS_DETACHED_TURNS`) for one release.
3. **`GET /events`**: state/turn-started chunks, replay endpoint, degraded mode, keep-alive.
4. **Mutation gating + busy-payload polish**, OpenAPI registration.
5. **Web consumption**: types/clientId/store (no-op), then bridge + transport + guards, then busy/stop UX, then degraded UX.
6. **CLI**: subscribe/attach, busy error, stop.
7. **E2E hardening**: Playwright specs, strict-mode/soak of subscription lifecycle.

## Key risks

- **uvicorn multi-worker on one host**: each worker is its own instance ⇒ POST and `/events` can land on different workers → degraded mode without sticky routing. Document; Phoenix commonly runs single-worker.
- **Cancellation vs `finally`-awaits**: the inner/outer task split in `TurnRunner` is load-bearing — don't collapse it.
- **Canonical assistant messageId in `start` chunk** on both streams is required for client convergence — top coordination item between backend and frontend.
- **Replay duplication** if the client doesn't drop its partial trailing message before resume (verified AI SDK behavior) — test hard.
- **Replay buffer memory** on huge bash-agent turns — cap + `streamAvailable: false` degradation.
- **Crashed owner loses the in-flight partial** (chunks are memory-only) — accepted; transcript ends at last persisted turn.
- Pin `ai` minor versions in `app` and `phoenix-cli` (`resumeStream`/`reconnectToStream` are the contract surface).
