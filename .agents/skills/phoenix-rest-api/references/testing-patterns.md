# Testing

Tests in `tests/integration/client/`. Every endpoint MUST test:
- Authenticated access (valid credentials → expected data)
- Unauthenticated access (no credentials → 401)
- Role-based access (non-admin on admin endpoint → 403)
- Auth-disabled mode if behavior differs (separate server with fresh ports)

Helpers: `_httpx_client(_app, _app.admin_secret)` for auth, `_httpx_client(_app)` for no-auth. No-auth server: `_server(_AppInfo({**_env_database, "PHOENIX_PORT": str(next(_ports)), "PHOENIX_GRPC_PORT": str(next(_ports))}))`.

Every endpoint MUST be added to one of three lists in `tests/integration/_helpers.py`: `_COMMON_RESOURCE_ENDPOINTS`, `_ADMIN_ONLY_ENDPOINTS`, or `_VIEWER_BLOCKED_WRITE_OPERATIONS`. Format: `(status_code, "METHOD", "v1/path")`.
