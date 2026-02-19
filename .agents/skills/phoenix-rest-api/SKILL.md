---
name: phoenix-rest-api
description: Add, modify, or remove REST API endpoints in the Phoenix server. Use when adding query parameters, request body fields, new routes, or changing response shapes in the v1 REST API. Triggers on tasks involving FastAPI routers, endpoint changes, OpenAPI schema updates, or any modification to the HTTP API surface.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: Python
  internal: true
---

# Phoenix REST API

The Phoenix REST API is built with FastAPI. All v1 endpoints live in `src/phoenix/server/api/routers/v1/`. The OpenAPI schema at `schemas/openapi.json` is **generated** from the server code and consumed by both client SDKs — any change to the API surface must be followed by a schema rebuild.

## Key Locations

| Item | Path |
|---|---|
| v1 router directory | `src/phoenix/server/api/routers/v1/` |
| OpenAPI schema (generated) | `schemas/openapi.json` |
| Build command | `tox run -e build_openapi_schema` |

## Workflow

### Adding or changing an endpoint

1. **Modify the router** in `src/phoenix/server/api/routers/v1/<resource>.py`
2. **Rebuild the OpenAPI schema** — this is required for the Python and JS client SDKs to pick up changes:
   ```bash
   tox run -e build_openapi_schema
   ```
3. **Commit `schemas/openapi.json`** along with the router change. Downstream client updates depend on this file.

### Typical FastAPI patterns used in this codebase

```python
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response

router = APIRouter()

@router.delete("/{resource_id}")
async def delete_resource(
    resource_id: str = Path(..., description="The resource ID"),
    delete_related: bool = Query(default=False, description="Also delete related data"),
    session: AsyncSession = Depends(dep_session),
) -> Response:
    ...
```

- Use `Query(default=...)` for optional query parameters
- Use `Path(...)` for required path parameters
- Use Pydantic models for request/response bodies
- Endpoints are `async` (FastAPI + SQLAlchemy async session)

## Testing

Integration tests for API behavior live in `tests/integration/`. Run them with:

```bash
uv run pytest tests/integration -n auto
```

There are no dedicated REST API unit tests — behavior is typically covered by integration tests that exercise the full stack through the Python client.

## Non-Obvious Notes

- **Schema is checked in**: `schemas/openapi.json` is committed to the repo. After changing any endpoint, always rebuild and commit the updated schema. CI may catch drift, but it's easier to keep it fresh.
- **Both client SDKs downstream**: After updating `schemas/openapi.json`, the Python client types and JS client types both need regeneration. See the `phoenix-python-client` and `phoenix-js-client` skills.
- **Async SQLAlchemy**: The server uses async SQLAlchemy sessions via `Depends(dep_session)`. Cascading operations (e.g., deleting a related record when deleting a parent) should be done explicitly in the route handler rather than relying on ORM cascade rules, since the async session context can be tricky with lazy loading.
- **Router registration**: New router files must be registered in the parent router (typically `src/phoenix/server/api/routers/v1/__init__.py` or similar). Check how existing routers are included.
