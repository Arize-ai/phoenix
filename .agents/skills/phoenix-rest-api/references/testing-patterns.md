# Testing

## Unit vs Integration

- **Unit tests** (`tests/unit/`): Pydantic validation, OpenAPI schema assertions, pure logic. These run in-process with `authentication_enabled=False`.
- **Integration tests** (`tests/integration/`): CRUD, auth, encryption roundtrips, cross-API verification. These spawn a real Phoenix subprocess with auth enabled.

If a test hits an HTTP endpoint to create/read/update/delete data, it belongs in integration.

## Integration Test Pattern

Tests live in `tests/integration/<feature>/` packages. See `tests/integration/secrets/` or `tests/integration/client/` for examples. Each package has a `conftest.py` with package-scoped `_env` and `_app` fixtures.

Key helpers from `tests/integration/_helpers.py`:
- `_httpx_client(app, auth)` — HTTP client. `_User` objects auto-login.
- `_gql(app, auth, query=, variables=)` — GraphQL requests.
- `_get_user(app, role)` — create users with `_ADMIN`, `_MEMBER`, `_VIEWER` roles.

Use `token_hex(4)` in keys/names for test isolation since the server is shared. Clean up in `try/finally`.

## What to Cover

- CRUD through the HTTP stack
- E2E data verification — prefer writing via one API and reading back via another over asserting on raw DB state
- Authorization — admin access, non-admin rejection, unauthenticated rejection
- Validation — invalid inputs return 422

Every endpoint should be added to `_COMMON_RESOURCE_ENDPOINTS`, `_ADMIN_ONLY_ENDPOINTS`, or `_VIEWER_BLOCKED_WRITE_OPERATIONS` in `tests/integration/_helpers.py`.

**Path normalization**: The `_ensure_endpoint_coverage_is_exhaustive()` function normalizes paths to match against the router. Use `fake-id-{}` for ID path params and `test-tag` for non-ID path params like tag names. These get normalized to `{id}` for comparison. Using other placeholder values (e.g. `fake-tag`) will cause a mismatch.
