# REST API Testing Patterns

## Test Location

Integration tests for REST endpoints live in `tests/integration/client/`.

## Test Infrastructure

### Key Fixtures (from `tests/integration/_helpers.py`)

| Fixture | Scope | Purpose |
|---------|-------|---------|
| `_app` | package | Running Phoenix server with auth enabled |
| `_env_ports` | package | `PHOENIX_PORT`, `PHOENIX_GRPC_PORT` |
| `_env_database` | package | `PHOENIX_SQL_DATABASE_URL` |
| `_env_auth` | package | `PHOENIX_ENABLE_AUTH=true`, `PHOENIX_SECRET`, `PHOENIX_ADMIN_SECRET` |
| `_env_smtp` | package | SMTP config for email tests |

### Helper Functions

```python
from .._helpers import _AppInfo, _httpx_client, _log_in, _server
```

- `_httpx_client(app, auth=None)` — creates an `httpx.Client` with base URL and optional auth
- `_log_in(app, password, email=...)` — logs in and returns tokens
- `_server(app_info)` — context manager that starts a Phoenix server

### Auth Tokens

```python
# Admin access via secret
client = _httpx_client(_app, _app.admin_secret)

# No auth (for testing 401s)
client = _httpx_client(_app)
```

## Writing Tests

### Auth-Enabled Tests

The `_app` fixture in `tests/integration/client/conftest.py` includes `_env_auth`, so auth is always enabled.

```python
class TestMyEndpoint:
    async def test_returns_data(self, _app: _AppInfo) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        response = client.get("v1/my-resource")
        response.raise_for_status()
        data = response.json()["data"]
        assert data["field"] == "expected"

    async def test_returns_401_without_credentials(self, _app: _AppInfo) -> None:
        client = _httpx_client(_app)
        response = client.get("v1/my-resource")
        assert response.status_code == 401
```

### Auth-Disabled Tests

Spin up a separate server without auth env vars:

```python
async def test_works_without_auth(
    self,
    _env_ports: dict[str, str],
    _env_database: dict[str, str],
) -> None:
    from .._helpers import _server

    env = {**_env_ports, **_env_database}
    with _server(_AppInfo(env)) as app:
        client = _httpx_client(app)
        response = client.get("v1/my-resource")
        response.raise_for_status()
```

### Using Generated Types in Tests

```python
from phoenix.client.__generated__ import v1

# TypedDict types for type-safe test assertions
user: v1.LocalUser = response.json()["data"]
```

## Endpoint Coverage

`tests/integration/_helpers.py` maintains three endpoint lists that CI validates for completeness:

| List | Purpose |
|------|---------|
| `_COMMON_RESOURCE_ENDPOINTS` | GET endpoints accessible to all authenticated users |
| `_ADMIN_ONLY_ENDPOINTS` | Endpoints requiring admin role |
| `_VIEWER_BLOCKED_WRITE_OPERATIONS` | Non-GET endpoints blocked for viewers |

**When adding a new endpoint, add it to the appropriate list.** The test `test_all_routes_are_covered` will fail if any route is missing.

Format: `(expected_status_code, "METHOD", "v1/path")` — use `fake-id-{}` for path parameters.

## Running Tests

```bash
# Run specific test file
uv run pytest tests/integration/client/test_users.py -x

# Run a specific test class
uv run pytest tests/integration/client/test_users.py::TestGetViewer -x

# Run all integration tests
make test-python
```
