# Plan: remove `session_id` from `agent_sessions` (body-scoped chat route)

Branch: `agent/persist-agent-session-messages`. The `agent_sessions` /
`agent_session_messages` / `agent_session_snapshots` schema is **unreleased**
(this branch only, not `origin/main`), so we edit the existing migration
`e767d3c57f32` in place — no data migration, no additive ALTERs.

## Goal

Collapse the **dual identity** on `agent_sessions` to one. Today each row has:

- **`id`** — server-assigned integer PK ([models.py:3121](src/phoenix/db/models.py#L3121)
  via `HasId`), exposed to GraphQL as the Relay global ID.
- **`session_id`** — a **client-generated UUID** string
  (`String, unique, nullable=False`, [models.py:3123](src/phoenix/db/models.py#L3123)),
  minted in the browser and used as the chat URL path segment.

Drop `session_id`; the server owns the id and hands it back to the client.

## Chosen approach — agent-scoped route, session id in the body

```
POST /agents/{agent_id}/chat
  body: { …, agentSessionId?: GlobalID | null, id: <AI-SDK chat id>, messages, … }
  • agentSessionId absent/null → create a new session row (server allocates the id)
  • agentSessionId present      → continue that session (ownership-checked)
  • the new session's global id is streamed back via SessionCreatedChunk
```

This keeps today's UX exactly: lazy creation on first send, no junk rows, and no
extra round-trip. It **reuses machinery that already exists** — the client
already learns the persisted id from the stream (`onData` →
`setSessionPersisted`, [useAgentChat.ts:214-220](app/src/components/agent/useAgentChat.ts#L214)),
and `SessionCreatedChunk` already exists to deliver it. The URL loses its session
segment and `chatApiUrl` becomes a static, agent-scoped constant.

### Why a new body field, not `id`

The request body **already has an `id`**: `SubmitMessage.id`
([request_types.py:404](src/phoenix/db/types/data_stream_protocol/request_types.py#L404))
/ `RegenerateMessage.id` ([412](src/phoenix/db/types/data_stream_protocol/request_types.py#L412)),
which the frontend sets to the **AI SDK chat id = the client-local UUID**
([buildAgentChatRequestBody.ts:131](app/src/agent/chat/buildAgentChatRequestBody.ts#L131)).
That `id` is the AI SDK's own chat identity (fixed at `Chat` construction, used
for its internal message routing) — overloading it with the server global id
would mean rebuilding the `Chat` instance and conflating two concepts. So the
server session id gets its **own** optional field, `agentSessionId`, injected
from the store's `relayId`. `body.id` (the client UUID) stays client-only and is
ignored for persistence — except optionally as an idempotency hint (see Open
risks).

### Decisions

| Decision | Choice |
|---|---|
| Route | `POST /agents/{agent_id}/chat` — no session in the path. |
| Session id in body | New field `agentSessionId` (`GlobalID \| null`), **distinct** from the existing `id`. |
| Creation | Lazy on first send when `agentSessionId` is null — server inserts, returns id via `SessionCreatedChunk`. |
| Id returned to client | Reuse `SessionCreatedChunk` (its `data.id` is already consumed by the client). |
| First-send idempotency | **(a) Drop `session_id` entirely and accept the rare retry-dup.** No dedup column survives. |
| PK type | Unchanged integer PK, **kept auto-incrementing so ids are never reused after delete** (see below). Client-supplied UUID PK rejected (huge blast radius: `HasId`, Relay, cursors, FKs). |

### Auto-incrementing, never-reused ids (already satisfied — preserve it)

Because the global id becomes the *only* external handle, a deleted session's id
must never be handed to a later session. This already holds on both dialects and
must be **preserved** when editing the migration:

- **SQLite:** `AgentSession.__table_args__` carries `dict(sqlite_autoincrement=True)`
  ([models.py:3151](src/phoenix/db/models.py#L3151)) and the migration passes
  `sqlite_autoincrement=True`
  ([e767d3c57f32:76](src/phoenix/db/migrations/versions/e767d3c57f32_create_agent_sessions_and_agent_session_.py#L76)).
  The `AUTOINCREMENT` keyword makes SQLite track the high-water mark in
  `sqlite_sequence`, so a rowid is never reused even after the max row is deleted.
  *Without* it SQLite would reuse the largest freed rowid.
- **PostgreSQL:** the integer PK (`HasId.id`, [models.py:700](src/phoenix/db/models.py#L700))
  is backed by a sequence (identity), which is monotonic and never reuses values
  after delete/rollback.

**Guardrail for the migration edit:** only delete the `session_id` column line —
do **not** remove `sqlite_autoincrement=True` and do **not** set
`autoincrement=False` on the PK. Add a test that creates a session, deletes it,
creates another, and asserts the second id is strictly greater (SQLite is the
case that would regress).

**Alternative (not chosen): session-scoped URL + explicit `createAgentSession`
mutation.** Keeps `POST /agents/{agent_id}/sessions/{id}/chat` with `{id}` as the
global id, but adds a create round-trip on first send and makes
`SessionCreatedChunk` redundant. Documented in git history of this file if we
need to revisit.

---

## Why `session_id` exists (context)

`session_id` is load-bearing, not redundant naming. The client UUID is the
`ON CONFLICT` key in `_claim_agent_session`
([agents.py:1185-1212](src/phoenix/server/api/routers/agents.py#L1185)), which
provides three things this plan must preserve or consciously drop:

1. **Lazy create on first send, no junk rows** — the upsert only fires when
   `messages` is non-empty. *Preserved:* server creates the row on the first send
   with `agentSessionId=null`, under the same guard.
2. **Local-first, zero round-trip** — client streams immediately. *Preserved:*
   the route is still hit only on send; the id comes back in-stream.
3. **Idempotent retry-safe first send** — a reconnect reuses the UUID and hits
   `DO NOTHING`, so no duplicate. *At risk:* see Open risks.

`session_id` also doubles as the **OTEL session id**
(`using_session`, [agents.py:1462](src/phoenix/server/api/routers/agents.py#L1462),
[1729](src/phoenix/server/api/routers/agents.py#L1729),
[1778](src/phoenix/server/api/routers/agents.py#L1778)) — those become `str(rowid)`.

---

## Work plan

### Task 1 — Request body: add `agentSessionId`

- Add to `_ChatMessageMixin`
  ([agents.py:293-317](src/phoenix/server/api/routers/agents.py#L293)):
  ```python
  agent_session_id: str | None = Field(default=None, alias="agentSessionId")
  ```
  (Both `ChatSubmitMessage` and `ChatRegenerateMessage` inherit it. `str` here,
  parsed to a rowid via `from_global_id_with_expected_type`; keep it a plain
  string on the wire so the OpenAPI client stays simple.)
- Frontend `buildAgentChatRequestBody`
  ([buildAgentChatRequestBody.ts:106-137](app/src/agent/chat/buildAgentChatRequestBody.ts#L106)):
  add an `agentSessionId` input and emit it in the returned body. Source it from
  the active session's `relayId` in the store (`null` until persisted). Add a
  `relayId` param through the `prepareSendMessagesRequest` call site
  ([useAgentChat.ts:151-178](app/src/components/agent/useAgentChat.ts#L151)),
  reading `store.getState().sessionMap[sessionId]?.relayId`.

### Task 2 — Chat route: agent-scoped, create-or-continue

- **Route** ([agents.py:1491-1497](src/phoenix/server/api/routers/agents.py#L1491)):
  `@router.post("/agents/{agent_id}/sessions/{session_id}/chat")` →
  `@router.post("/agents/{agent_id}/chat")`; drop the `session_id: str` path
  param.
- **Replace `_claim_agent_session`** ([1185](src/phoenix/server/api/routers/agents.py#L1185))
  with `_create_or_load_agent_session(session, *, agent_session_id: str | None,
  user_id, has_messages) -> AgentSession | None`:
  - `agent_session_id is None` and `has_messages`: `INSERT` a new row
    (title `""`, `user_id`), return it. (No conflict key needed.)
  - `agent_session_id` provided: parse → rowid, `SELECT … WHERE id = rowid`,
    ownership check → 404 if missing/foreign (same shape as today).
  - Drop `insert_on_conflict` / `OnConflict` from this path.
- **Claim call site** ([1569-1587](src/phoenix/server/api/routers/agents.py#L1569)):
  pass `body.agent_session_id`. Build `SessionCreatedData` from the row as today.
- **OTEL** ([1462](src/phoenix/server/api/routers/agents.py#L1462),
  [1729](src/phoenix/server/api/routers/agents.py#L1729),
  [1778](src/phoenix/server/api/routers/agents.py#L1778)) and the persist/log
  calls ([1862-1882](src/phoenix/server/api/routers/agents.py#L1862)): the local
  `session_id` variable becomes the rowid (as `str`); rename to
  `agent_session_rowid` for clarity and feed `str(rowid)` to `using_session`.
- **`_update_agent_session` / `_persist_agent_session_turn`**
  ([1215](src/phoenix/server/api/routers/agents.py#L1215),
  [1262](src/phoenix/server/api/routers/agents.py#L1262)): re-key from
  `session_id: str` to `agent_session_rowid: int` (they already resolve/use the
  rowid downstream).

### Task 3 — `SessionCreatedChunk` returns the id

- `SessionCreatedData` ([220-228](src/phoenix/server/api/routers/agents.py#L220)):
  drop the `session_id` field; keep `id`, `title`, `created_at`, `updated_at`.
- Keep emitting `SessionCreatedChunk`
  ([1803-1809](src/phoenix/server/api/routers/agents.py#L1803)) — it's now the
  **sole** channel that tells the client its persisted id. It's emitted right
  after the opening `StartChunk`, so the client learns the id at the very start
  of the stream; the repeated-ack semantics still let a reconnect reconcile.
- Frontend `onData` ([useAgentChat.ts:214-221](app/src/components/agent/useAgentChat.ts#L214))
  already maps `data-session-created` → `setSessionPersisted(sessionId,
  data.id)`. **No change** — this is the reuse.

### Task 4 — DB / migration

- **ORM** ([models.py:3123](src/phoenix/db/models.py#L3123)): delete the
  `session_id` column. Nothing else on the model references it (the index is
  `user_id, updated_at`).
- **Migration** `e767d3c57f32`: remove **only** line 55
  ([:55](src/phoenix/db/migrations/versions/e767d3c57f32_create_agent_sessions_and_agent_session_.py#L55));
  the `unique=True` there is the only implicit index tied to it. **Keep**
  `sqlite_autoincrement=True` ([:76](src/phoenix/db/migrations/versions/e767d3c57f32_create_agent_sessions_and_agent_session_.py#L76))
  and leave the PK untouched so ids stay non-reusable (see "Auto-incrementing…").
- Regenerate DDL: `make schema-ddl`; confirm the column is gone and re-running is
  a no-op.

### Task 5 — GraphQL

- **Type** ([types/AgentSession.py](src/phoenix/server/api/types/AgentSession.py)):
  remove the `session_id` field ([17-19](src/phoenix/server/api/types/AgentSession.py#L17))
  and the `session_id=` kwarg in `to_gql_agent_session`
  ([54](src/phoenix/server/api/types/AgentSession.py#L54)). `messages` resolver
  already keys on `id` — unchanged.
- **Query** ([queries.py:1681-1693](src/phoenix/server/api/queries.py#L1681)):
  replace `agent_session(session_id: str)` with `agent_session(id: GlobalID)`, or
  give `AgentSession` a `resolve_node` and use the generic `node(id:)`
  ([queries.py:1011](src/phoenix/server/api/queries.py#L1011)). Keep the
  owner-scope filter.
- **Delete mutation**
  ([agent_session_mutations.py:16-54](src/phoenix/server/api/mutations/agent_session_mutations.py#L16)):
  `DeleteAgentSessionInput.session_id: str` → `id: GlobalID`; look up by rowid;
  drop `session_id` from the payload. FK cascade still removes messages +
  snapshot.

### Task 6 — Frontend wiring

- **`chatApiUrl`**
  ([useAgentChatPanelState.ts:11, 86-97](app/src/components/agent/useAgentChatPanelState.ts#L86)):
  becomes a static agent-scoped constant `"/agents/{agent_id}/chat"` (fill
  `agent_id`), independent of `activeSessionId`. The template import
  ([:11](app/src/components/agent/useAgentChatPanelState.ts#L11)) drops
  `{session_id}`.
- **Session ↔ server matching**
  ([AgentSessionsResource.tsx:119-179](app/src/components/agent/AgentSessionsResource.tsx#L119)):
  the `agentSessions` fragment loses `sessionId`; match server rows to local
  sessions by `relayId` (`node.id`) instead of `node.sessionId`. The store keeps
  its own client-local key for pre-persistence UI state — never sent as identity.
- **Transcript load**
  ([AgentSessionsResource.tsx:380-393](app/src/components/agent/AgentSessionsResource.tsx#L380)):
  `agentSession(sessionId:)` → `node(id:)` / `agentSession(id:)`.
- **Delete** ([218-229](app/src/components/agent/AgentSessionsResource.tsx#L218)):
  pass the relay id to the re-keyed mutation.
- Regenerate artifacts: OpenAPI path type
  ([v1.ts:1474](app/src/api/__generated__/v1.ts#L1474) — the
  `/agents/{agent_id}/sessions/{session_id}/chat` entry becomes
  `/agents/{agent_id}/chat`) and the Relay `__generated__` files.

### Out of scope

`POST /agents/server/sessions/{session_id}/chat`
([agents.py:1350](src/phoenix/server/api/routers/agents.py#L1350)) — the PXI-CLI
endpoint. Its `session_id` is a pure OTEL label; it never touches
`agent_sessions`, so the column drop doesn't affect it. Optionally flatten it to
`/agents/server/chat` with the OTEL session id in the body for symmetry — a
separate change.

---

## Tests to update

- [tests/unit/server/agents/test_agents_router.py](tests/unit/server/agents/test_agents_router.py)
  (~52 `session_id`/`sessions/` refs): POST to `/agents/{agent_id}/chat` with and
  without `agentSessionId`; assert a new row + `SessionCreatedChunk.data.id` on
  create; assert continue-by-id and 404 for a foreign/missing id.
- [tests/unit/server/api/routers/test_agents.py](tests/unit/server/api/routers/test_agents.py):
  `_claim_agent_session` → `_create_or_load_agent_session` unit tests (create vs
  continue vs foreign).
- [tests/unit/server/api/types/test_AgentSession.py](tests/unit/server/api/types/test_AgentSession.py):
  drop `session_id` from seeds/assertions; look up by global id.
- [tests/unit/server/api/mutations/test_agent_session_mutations.py](tests/unit/server/api/mutations/test_agent_session_mutations.py):
  re-key delete to `id`; keep the cascade assertion.
- Frontend: `buildAgentChatRequestBody.test.ts` (assert `agentSessionId` emitted /
  omitted), `agentStore.test.ts` (`setSessionPersisted`), and the
  `AgentSessionsResource` / `useAgentChat` specs assuming `sessionId`-keyed
  URLs/queries.

## Suggested ordering

1. **Task 5** GraphQL + **Task 4** ORM/migration — establish the id-based
   read/delete contract; regenerate GraphQL types + DDL.
2. **Task 1–3** body field + route + `_create_or_load_agent_session` +
   `SessionCreatedData` trim.
3. **Task 6** frontend; regenerate OpenAPI/Relay artifacts.
4. **Tests** alongside each step; fresh-DB migration check at the end.

## Verification

- `alembic upgrade head` clean on SQLite **and** Postgres; `make schema-ddl`
  shows only the `session_id` drop and re-running is a no-op.
- Id non-reuse: create → delete → create leaves the second id strictly greater
  (assert on SQLite).
- Backend unit tests green.
- Manual/E2E: first send (`agentSessionId` null) creates a row and streams its
  id; the client persists it and the next turn continues the same row; resume by
  global id restores messages + bash state; delete cascades all three tables; a
  foreign id returns 404.

## Open risks / notes

- **First-send idempotency — accepted regression (decision (a)).** Today a
  retried first send is deduped by the client UUID conflict key. With
  server-allocated ids and `session_id` gone, if the client disconnects before
  processing the early `SessionCreatedChunk` and then retries with `agentSessionId`
  still null, the server creates a **second** row. We accept this: the window is
  narrow (row committed but client never saw the opening chunk), and the orphan is
  a deletable, empty-ish session — not data loss. `SessionCreatedChunk` is emitted
  right after `StartChunk` to keep the window as small as possible.
- **OTEL session ids** change from client UUID to `str(rowid)` for the assistant
  agent — confirm no downstream consumer keys on the UUID shape.
- **`body.id` remains the AI SDK chat id** (client UUID); it is not the session
  identity and must not be treated as such server-side (except as the option-(b)
  idempotency hint).
