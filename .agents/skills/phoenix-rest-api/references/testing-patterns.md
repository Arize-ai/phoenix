# REST API Testing Patterns

Integration tests live in `tests/integration/client/`.

## What to Test

Every REST endpoint MUST have tests covering:

- **Authenticated access** — valid credentials return expected data
- **Unauthenticated access** — missing/invalid credentials return 401
- **Role-based access** — admin-only endpoints return 403 for non-admins; viewer-restricted writes return 403
- **Auth-disabled mode** — if the endpoint behaves differently without auth, test that path with a separate no-auth server

## Key Helpers

```python
from .._helpers import _AppInfo, _httpx_client, _log_in, _server

# Authenticated client (admin)
client = _httpx_client(_app, _app.admin_secret)

# Unauthenticated client
client = _httpx_client(_app)

# No-auth server (fresh ports required to avoid collisions)
env = {**_env_database, "PHOENIX_PORT": str(next(_ports)), "PHOENIX_GRPC_PORT": str(next(_ports))}
with _server(_AppInfo(env)) as app:
    client = _httpx_client(app)
```

## Endpoint Coverage

`tests/integration/_helpers.py` maintains three lists that CI validates for completeness:

| List | Purpose |
|------|---------|
| `_COMMON_RESOURCE_ENDPOINTS` | GET endpoints accessible to all authenticated users |
| `_ADMIN_ONLY_ENDPOINTS` | Endpoints requiring admin role |
| `_VIEWER_BLOCKED_WRITE_OPERATIONS` | Non-GET endpoints blocked for viewers |

**Every new endpoint MUST be added to the appropriate list.** Format: `(expected_status_code, "METHOD", "v1/path")` — use `fake-id-{}` for path parameters.
