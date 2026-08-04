# Plan: Split agent-session transcript into a paginated `/messages` subresource route

## Context

Commit af6f1d6a5 (#14955) added a cheap sync probe to `GET /agents/{agent_id}/sessions/{session_id}` via an `include_messages` query param. The cost: `AgentSessionData.messages` became `list[PhoenixUIMessage] | None`, forcing every generated client to handle "not requested" vs "empty" (`session.messages ?? []` cast in the CLI), and a shape-toggling boolean param that violates this repo's REST conventions (plural-noun subresources; query params only for filtering/sorting/pagination).

This change replaces the param with a dedicated, cursor-paginated route:

- `GET /agents/{agent_id}/sessions/{session_id}` → always metadata-only (`is_active`, `last_message_id`, timestamps). This *is* the sync probe; no param needed.
- `GET /agents/{agent_id}/sessions/{session_id}/messages` → the transcript, cursor-paginated per repo convention (`{"data": [...], "next_cursor": ...}`).

Pagination now means clients can later fetch only the delta when the tail moves (the natural continuation of #14955) without an API change. It is safe to remove `include_messages` outright: no release tag contains af6f1d6a5, and the only REST consumer is the PXI CLI (the browser uses GraphQL exclusively — `app/src/` has zero `client.GET` call sites; the Relay queries in `app/src/components/agent/agentSessionRelay.ts` are untouched).

**Out of scope (deliberate):** rewiring the CLI/browser polling to fetch deltas — polling still refetches the full transcript when the tail moves. The `PxiSessionClient` interface is preserved so `App.tsx` and its tests don't change.

## Server changes — `src/phoenix/server/api/routers/agents.py`

### 1. `AgentSessionData`

Drop the `messages` field entirely. Keep `is_active` and `last_message_id` (the chat route's optimistic-concurrency check compares against `last_message_id`, so it must remain on the metadata GET). Remove the `include_messages` reference from the field descriptions.

### 2. `get_session`

- Remove the `include_messages` query param and both branches.
- Always metadata-only: no `selectinload`; always compute the tail with the existing scalar subquery (`select(AgentSessionMessage.message_id).where(agent_session_id == rowid).order_by(id.desc()).limit(1)`) — same pattern as the GraphQL resolver in `src/phoenix/server/api/types/AgentSession.py`.
- Keep decorator options as-is; the "AI SDK part types … do not set response_model_exclude_defaults" comment moves to the new messages route, since UIMessage parts no longer flow through this response.

### 3. New route `GET /agents/{agent_id}/sessions/{session_id}/messages`

- Decorator: `operation_id="listAgentSessionMessages"`, `response_model_by_alias=True`, `response_model_exclude_unset=True`, **no** `response_model_exclude_defaults` (carry over the AI SDK comment).
- Response model: `ListAgentSessionMessagesResponseBody(PaginatedResponseBody[PhoenixUIMessage])` (generics from `phoenix.server.api.routers.v1.utils`, already imported).
- Params: `cursor: str | None = Query(None)`, `limit: int = Query(100, gt=0, le=1000)` (generous default — transcripts are usually fetched whole).
- Guards, mirroring `get_session` exactly: unknown agent → 404; `_SERVER_AGENT_ID` + `get_env_phoenix_agents_disable_bash()` → 403; GlobalID parse failure → 422 "Invalid agent session ID"; then a session-existence query filtered by `_get_request_user_id` ownership → 404. (Do **not** use `_refresh_and_load_agent_session` — it bumps `updated_at` and 404s on malformed ids; this is a read.)
- Messages query: `select(AgentSessionMessage).where(agent_session_id == rowid)`, ascending `order_by(id)`, keyset predicate `id > parsed_cursor.rowid` when a cursor is given, `.limit(limit + 1)`.
- Cursor: rowid-only `Cursor(rowid=last.id)` from `phoenix.server.api.types.pagination`. Add a small `_parse_agent_session_message_cursor` helper modeled on `_parse_agent_session_cursor` but without the DATETIME sort-column requirement; 422 "Invalid cursor format" on parse failure. `next_cursor` is set only when `len(rows) > limit` (standard end-of-pages semantics). A future delta-sync can add a non-breaking `after_message_id=<uuid>` param.
- Return `data=[row.message for row in rows]`.

## Codegen

Run `make openapi` after the server change — regenerates `schemas/openapi.json`, `packages/phoenix-client/src/phoenix/client/__generated__/v1/__init__.py`, and the three TS clients (`js/packages/phoenix-client`, `js/packages/phoenix-testing`, `app/src/api`). Commit all artifacts. `messages` disappears from `AgentSessionData` in all of them; the browser app needs nothing beyond the regenerated `v1.ts`.

## CLI changes — `js/packages/phoenix-cli/src/pxi/`

`PxiSessionClient` (`types.ts`) and all types stay unchanged, so `App.tsx` and the `pxiApp.test.tsx` mocks need **zero changes**. Only the REST implementation in `client.ts` changes:

- `getSessionSyncState`: drop `query: { include_messages: false }` — plain GET, keep the probe comment.
- `getSession`: GET session metadata, then page through `GET .../messages` with a `while (next_cursor)` loop accumulating messages. Derive `lastMessageId` from the fetched transcript itself (`messages.at(-1)?.id ?? null`) rather than the metadata response, so the recorded sync tail always matches the transcript actually applied (the two requests are not atomic; the transcript can advance between them — the polling loop already tolerates this class of skew and self-corrects next tick).
- `js/packages/phoenix-client/src/constants/serverRequirements.ts` gates the CLI on server routes (it currently lists the `/chat` path) — add the new messages route following that existing pattern so the CLI fails clearly against older servers.

## Tests

### `tests/unit/server/agents/test_agent_session_routes.py`

Reuse the existing `_insert_agent_session` helper and shared `httpx_client` fixture.

- `TestGetAgentSession`: `test_gets_session_with_ordered_messages` loses its message assertions (keep metadata + `last_message_id`; assert `"messages" not in data`). The two sync-probe tests collapse into plain-GET tests: tail reported / null tail for empty transcript, no `include_messages` param.
- New `TestListAgentSessionMessages`: full ordered transcript with `next_cursor` null; pagination walk (`limit=1`, follow `next_cursor`, no duplicates/gaps, null at end); empty transcript → `[]`; invalid session id → 422; invalid cursor → 422; unknown agent → 404; nonexistent session → 404.

### `tests/integration/auth/test_auth.py`

Extend `test_agent_sessions_are_scoped_to_api_key_owner` to also GET the messages route: 200 for the owner, 404 for another user's key.

`tests/integration/_helpers.py` needs **no** change — the agents router is mounted outside `/v1` and is invisible to `_ensure_endpoint_coverage_is_exhaustive`.

## Verification

1. `make openapi` — regenerate + commit all generated artifacts.
2. `make lint-python`.
3. `uv run pytest tests/unit/server/agents/test_agent_session_routes.py tests/unit/server/api/types/test_AgentSession.py`.
4. CLI: `pnpm -C js/packages/phoenix-cli test` (the `pxiClient.test.ts` fetch stubs must serve the new route: session body without `messages`, a stubbed `/messages` page response; add an assertion on the messages-route URL and a two-page loop case) and the package's typecheck target.
5. End-to-end smoke: start Phoenix, run the PXI CLI, create a session with a couple of turns, quit, relaunch and restore the session (exercises metadata + paginated messages fetch), and leave an idle session open to confirm the 10s probe hits the plain session GET with no transcript payload.
