# REST Endpoint Patterns

## Design Principles

These are the non-negotiable conventions for the Phoenix REST API.

### Communication & Versioning

- All endpoints communicate over **JSON** unless the URL specifies otherwise (e.g., `/csv`, `/jsonl`).
- The API is **versioned** under `/v1/`. Backward-incompatible changes go under a new version prefix (`/v2/`).

### HTTP Methods

Use methods according to their semantics defined in [RFC 9110 (HTTP Semantics)](https://httpwg.org/specs/rfc9110.html#methods):

| Method | Semantics | Reference |
|--------|-----------|-----------|
| `GET` | Retrieve a representation of a resource | [RFC 9110 §9.3.1](https://httpwg.org/specs/rfc9110.html#GET) |
| `POST` | Create new resources and sub-resources | [RFC 9110 §9.3.3](https://httpwg.org/specs/rfc9110.html#POST) |
| `PUT` | Replace an existing resource entirely | [RFC 9110 §9.3.4](https://httpwg.org/specs/rfc9110.html#PUT) |
| `PATCH` | Apply a partial update to a resource | [RFC 5789](https://httpwg.org/specs/rfc5789.html) |
| `DELETE` | Delete an existing resource | [RFC 9110 §9.3.5](https://httpwg.org/specs/rfc9110.html#DELETE) |

### Status Codes

Use status codes according to [RFC 9110 §15 (Status Codes)](https://httpwg.org/specs/rfc9110.html#status.codes):

- **2xx** — success; the request was received, understood, and accepted
- **4xx** — client error; the request contains bad syntax or cannot be fulfilled
- **5xx** — server error; the server failed to fulfill a valid request

### Path Structure

- Use **plural nouns** for resources (`/datasets`, `/users`, `/experiments`), never verbs.
- Specific resources are identified by a **globally unique identifier** consistent with the GraphQL API: `/datasets/:dataset_id`
- Sub-resources nest under their parent: `/datasets/:dataset_id/examples`, `/projects/:project_id/spans`

### Query Parameters

- Use query parameters for **filtering, sorting, and pagination**.
- Parameter names use **snake_case** with `_` as separator (e.g., `dataset_version_id`, `next_cursor`).

### Pagination

- Use **cursor-based pagination**. Each response includes a `next_cursor` field pointing to the next page.
- Never use offset-based pagination.

### Response Format

- All responses are a JSON object with a **`data` key** wrapping the payload.
- Payload field names use **snake_case** for easy translation to Python/TypeScript objects.
- Single-resource responses: `{"data": {...}}`
- Collection responses: `{"data": [...], "next_cursor": "..."}`

## Directory Structure

```
src/phoenix/server/api/routers/v1/
  __init__.py        # create_v1_router() — registers all routers, adds auth dependencies
  models.py          # V1RoutesBaseModel (Pydantic base with datetime encoding, UNDEFINED filtering)
  utils.py           # ResponseBody, PaginatedResponseBody, RequestBody, add_errors_to_responses
  users.py           # Example: full CRUD + discriminated union patterns
  projects.py        # Example: project-scoped endpoints
  spans.py           # Example: complex query endpoints
```

## Adding a New Endpoint

### 1. Define Pydantic Models

All models extend `V1RoutesBaseModel` from `models.py`:

```python
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import ResponseBody, add_errors_to_responses

class MyData(V1RoutesBaseModel):
    name: str
    value: int

class GetMyDataResponseBody(ResponseBody[MyData]):
    pass
```

**Key conventions:**
- Response bodies wrap data in `ResponseBody[T]` (returns `{"data": {...}}`)
- Paginated responses use `PaginatedResponseBody[T]` (returns `{"data": [...], "next_cursor": ...}`)
- Request bodies use `RequestBody[T]` (accepts `{"data": {...}}`)
- Use `UNDEFINED` sentinel from `phoenix.db.types.db_helper_types` for optional fields that should be excluded from JSON when not set
- For discriminated unions, use `Annotated[Union[...], Field(..., discriminator="field_name")]`

### 2. Define the Route

```python
from fastapi import APIRouter, Depends, HTTPException, Request

router = APIRouter(tags=["my-resource"])

@router.get(
    "/my-resource",
    operation_id="getMyResource",          # camelCase, used in generated clients
    summary="Short description",
    description="Longer description for OpenAPI docs.",
    response_description="What the response contains.",
    responses=add_errors_to_responses([
        {"status_code": 404, "description": "Resource not found."},
        422,                                # status code only, no description
    ]),
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def get_my_resource(request: Request) -> GetMyDataResponseBody:
    ...
```

**Standard decorator kwargs** (always include):
- `operation_id` — camelCase, becomes the function name in generated clients
- `response_model_by_alias=True`
- `response_model_exclude_unset=True`
- `response_model_exclude_defaults=True`

### 3. Register the Router

In `src/phoenix/server/api/routers/v1/__init__.py`:

```python
from .my_resource import router as my_resource_router

# Inside create_v1_router():
router.include_router(my_resource_router)
```

### 4. Authorization

**Admin-only endpoints** — add `dependencies=[Depends(require_admin)]` to the route:
```python
from phoenix.server.authorization import require_admin

@router.post("/users", dependencies=[Depends(require_admin)])
```

**Auth-aware endpoints** — check `request.app.state.authentication_enabled`:
```python
from phoenix.server.bearer_auth import PhoenixUser

if request.app.state.authentication_enabled:
    if not isinstance(request.user, PhoenixUser):
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = int(request.user.identity)
```

**Read-only protection** is automatic — `prevent_access_in_read_only_mode` is a router-level dependency.

**Viewer restrictions** are automatic for non-GET requests via `restrict_access_by_viewers`.

### 5. Database Access

```python
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from phoenix.db import models

async with request.app.state.db() as session:
    result = await session.scalar(
        select(models.MyModel).options(joinedload(models.MyModel.relation)).filter_by(id=id_)
    )
```

### 6. GlobalID Handling

Phoenix uses Strawberry Relay GlobalIDs for entity identification:

```python
from strawberry.relay import GlobalID
from phoenix.server.api.types.node import from_global_id_with_expected_type

# Create a GlobalID string
id_str = str(GlobalID("User", str(db_user.id)))

# Parse and validate a GlobalID from input
try:
    id_ = from_global_id_with_expected_type(GlobalID.from_id(user_id), "User")
except Exception:
    raise HTTPException(status_code=422, detail=f"Invalid GlobalID format: {user_id}")
```
