# Testing

## Unit vs Integration

- **Unit tests** (`tests/unit/`): Use for Pydantic validation, OpenAPI schema assertions, and pure logic that needs no running server. Unit tests use in-process ASGI testing (`create_app()` + `httpx.AsyncClient`) with `authentication_enabled=False`.
- **Integration tests** (`tests/integration/`): Use for CRUD operations, encryption roundtrips, authorization, and any test that verifies behavior across API boundaries (e.g. write via REST, read via GraphQL). Integration tests spawn a real Phoenix subprocess with auth enabled.

**Rule of thumb**: if the test creates, reads, updates, or deletes data through an HTTP endpoint, it MUST be an integration test. Do NOT put CRUD or auth tests in `tests/unit/`.

## Integration Test Structure

Each feature gets its own package under `tests/integration/<feature>/` with:
- `__init__.py` — empty package marker
- `conftest.py` — package-scoped `_env` and `_app` fixtures
- `test_<feature>.py` — test classes

### conftest.py Template

```python
from typing import Iterator, Mapping
import pytest
from .._helpers import _AppInfo, _server

@pytest.fixture(scope="package")
def _env(
    _env_ports: Mapping[str, str],
    _env_database: Mapping[str, str],
    _env_auth: Mapping[str, str],
) -> dict[str, str]:
    return {**_env_ports, **_env_database, **_env_auth}

@pytest.fixture(scope="package")
def _app(_env: dict[str, str]) -> Iterator[_AppInfo]:
    with _server(_AppInfo(_env)) as app:
        yield app
```

Include `_env_smtp` only if the feature involves email. The `_env_auth` fixture sets `PHOENIX_ENABLE_AUTH=true`, `PHOENIX_SECRET` (for encryption), and `PHOENIX_ADMIN_SECRET`.

### Key Helpers (from `tests/integration/_helpers.py`)

| Helper | Purpose |
|--------|---------|
| `_httpx_client(app, auth)` | Create httpx.Client with auth. Pass `app.admin_secret`, a `_User`, or `None` (no auth). `_User` objects are auto-logged-in. |
| `_gql(app, auth, query=, variables=)` | POST to `/graphql`, returns `(json_dict, headers)` |
| `_get_user(app, role)` | Create a user with the given role (from root conftest) |
| `_ADMIN`, `_MEMBER`, `_VIEWER` | `UserRoleInput` constants for role-based testing |

### Test Isolation

Since the server is package-scoped (shared across tests), use random keys/names per test for isolation:
```python
key = f"MY_PREFIX_{token_hex(4)}"
```
Always clean up in a `try/finally` block.

## Required Test Coverage

Every endpoint MUST test:
- **CRUD operations**: Create, read, update, delete through the actual HTTP stack
- **E2E data verification**: Write through one API surface, read back through another (e.g. REST write → GraphQL query). Never assert on raw DB bytes when you can verify through the API.
- **Authorization**: admin_secret (200), logged-in admin (200), member (403), viewer (403), unauthenticated (403)
- **Validation**: Invalid inputs return 422 with helpful messages

Every endpoint MUST be added to one of three lists in `tests/integration/_helpers.py`: `_COMMON_RESOURCE_ENDPOINTS`, `_ADMIN_ONLY_ENDPOINTS`, or `_VIEWER_BLOCKED_WRITE_OPERATIONS`. Format: `(status_code, "METHOD", "v1/path")`.

**Path normalization**: The `_ensure_endpoint_coverage_is_exhaustive()` function normalizes paths to match against the router. Use `fake-id-{}` for ID path params and `test-tag` for non-ID path params like tag names. These get normalized to `{id}` for comparison. Using other placeholder values (e.g. `fake-tag`) will cause a mismatch.

## Anti-patterns

- **Shallow encryption assertions**: Don't write `assert stored_value != plaintext`. Instead, write through the API and read back the decrypted value through GraphQL.
- **Direct DB assertions for CRUD**: Prefer reading back through the API over querying the database directly. DB assertions are acceptable for verifying hard deletes (record no longer exists).
- **`authentication_enabled=False` for auth tests**: Always test with auth enabled in integration tests. The unit test harness disables auth — that's why CRUD/auth tests don't belong there.
