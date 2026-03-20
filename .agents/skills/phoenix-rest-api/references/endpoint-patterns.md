# Endpoint Patterns

Keywords per [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) / [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

## Design Rules

- JSON by default. Alternative formats (csv, jsonl) via URL only.
- Versioned under `/v1/`. Breaking changes MUST go under a new prefix.
- HTTP methods per [RFC 9110](https://httpwg.org/specs/rfc9110.html#methods): GET=read, POST=create, PUT=replace, PATCH=partial update, DELETE=remove.
- Status codes per [RFC 9110 §15](https://httpwg.org/specs/rfc9110.html#status.codes). 2xx=success, 4xx=client error, 5xx=server error. MUST NOT mix.
- Plural noun paths: `/datasets/:dataset_id/examples`. No verbs.
- Identifiers MAY be a GraphQL GlobalID or a natural key (e.g. name). SHOULD accept both when multiple exist.
- Query params for filtering/sorting/pagination. snake_case names.
- Cursor-based pagination only. Response: `{"data": [...], "next_cursor": "..."}`.
- All responses wrap payload in `"data"` key. snake_case field names.

## Implementation

Code lives in `src/phoenix/server/api/routers/v1/`. See `users.py` for a complete example.

**Models** — extend `V1RoutesBaseModel`. Wrap with `ResponseBody[T]`, `PaginatedResponseBody[T]`, or `RequestBody[T]`. Use `UNDEFINED` from `phoenix.db.types.db_helper_types` for excludable optional fields. Use `Annotated[Union[...], Field(..., discriminator="field")]` for unions.

**Route decorator** — always include: `operation_id` (camelCase), `response_model_by_alias=True`, `response_model_exclude_unset=True`, `response_model_exclude_defaults=True`.

**Registration** — import router in `__init__.py`, call `router.include_router(...)` inside `create_v1_router()`.

**Auth** — admin-only: `dependencies=[Depends(require_admin)]`. Auth-aware: check `request.app.state.authentication_enabled` then `isinstance(request.user, PhoenixUser)`. Read-only and viewer restrictions are automatic at the router level.

**DB** — `async with request.app.state.db() as session:` with `joinedload` for relationships.

**IDs** — `GlobalID("Type", str(db_id))` to create, `from_global_id_with_expected_type(GlobalID.from_id(input), "Type")` to parse.
