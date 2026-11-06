---
name: phoenix-rest-api
user-invocable: false
description: >
  REST API development for Phoenix. Use when adding, modifying, or reviewing
  endpoints in src/phoenix/server/api/routers/v1/.
metadata:
  internal: true
---

# Phoenix REST API

Endpoints: `src/phoenix/server/api/routers/v1/`. Read the relevant reference.

## Checklist — run before committing any endpoint change

1. `make openapi` — regenerate schema + client types, commit all generated files
2. Add endpoint to the correct list in `tests/integration/_helpers.py`:
   - GET → `_COMMON_RESOURCE_ENDPOINTS`
   - Admin-only → `_ADMIN_ONLY_ENDPOINTS`
   - POST/PUT/DELETE → `_VIEWER_BLOCKED_WRITE_OPERATIONS`
   - Path format: use `fake-id-{}` for path params, `test-tag` for tag/name params (these are normalized by `_ensure_endpoint_coverage_is_exhaustive`)
3. `make lint-python` — fix any lint errors before committing

| Reference | When |
|-----------|------|
| `references/endpoint-patterns.md` | Adding or modifying an endpoint |
| `references/openapi-codegen.md` | Regenerating schema or client types |
| `references/testing-patterns.md` | Writing integration tests |
