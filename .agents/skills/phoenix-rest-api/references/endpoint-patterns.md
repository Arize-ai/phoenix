# REST Endpoint Patterns

## Notation Conventions and Compliance

The keywords "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
specification are to be interpreted as described in BCP 14
[[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)]
[[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)] when, and only when, they
appear in all capitals, as shown here.

An implementation is compliant if it satisfies all "MUST", "MUST NOT",
"REQUIRED", "SHALL", and "SHALL NOT" requirements defined in this specification.
An implementation that fails to satisfy any such requirement is not compliant.

## Design Principles

### Communication & Versioning

- Endpoints MUST communicate over JSON unless the URL specifies an alternative format (e.g., `/csv`, `/jsonl`).
- The API MUST be versioned under a path prefix (`/v1/`). Backward-incompatible changes MUST be introduced under a new version prefix (e.g., `/v2/`).

### HTTP Methods

Endpoints MUST use HTTP methods according to their semantics as defined in [RFC 9110 (HTTP Semantics)](https://httpwg.org/specs/rfc9110.html#methods):

| Method | Semantics | Reference |
|--------|-----------|-----------|
| `GET` | Retrieve a representation of a resource | [RFC 9110 §9.3.1](https://httpwg.org/specs/rfc9110.html#GET) |
| `POST` | Create new resources and sub-resources | [RFC 9110 §9.3.3](https://httpwg.org/specs/rfc9110.html#POST) |
| `PUT` | Replace an existing resource entirely | [RFC 9110 §9.3.4](https://httpwg.org/specs/rfc9110.html#PUT) |
| `PATCH` | Apply a partial update to a resource | [RFC 5789](https://httpwg.org/specs/rfc5789.html) |
| `DELETE` | Delete an existing resource | [RFC 9110 §9.3.5](https://httpwg.org/specs/rfc9110.html#DELETE) |

### Status Codes

Endpoints MUST use status codes according to [RFC 9110 §15 (Status Codes)](https://httpwg.org/specs/rfc9110.html#status.codes):

- **2xx** — success; the request was received, understood, and accepted
- **4xx** — client error; the request contains bad syntax or cannot be fulfilled
- **5xx** — server error; the server failed to fulfill a valid request

Endpoints MUST NOT return a 2xx status code when the request has failed. Endpoints MUST NOT return a 5xx status code for client errors.

### Path Structure

- Paths MUST use **plural nouns** for resources (`/datasets`, `/users`, `/experiments`). Paths MUST NOT contain verbs.
- Specific resources MUST be identified by a **globally unique identifier**: `/datasets/:dataset_id`
- Sub-resources MUST nest under their parent: `/datasets/:dataset_id/examples`, `/projects/:project_id/spans`
- A resource identifier MAY be a union of the GraphQL GlobalID or another natural unique identifier (e.g., a name). When a resource has multiple unique identifiers, the endpoint SHOULD accept both — the server resolves whichever form the client provides. For example, `/projects/:project_identifier` accepts either a GlobalID (`UHJvamVjdDox`) or a project name (`my-project`).

### Query Parameters

- Filtering, sorting, and pagination SHOULD be expressed as query parameters.
- Query parameter names MUST use **snake_case** with `_` as separator (e.g., `dataset_version_id`, `next_cursor`).

### Pagination

- Collection endpoints MUST use **cursor-based pagination**. Each response SHALL include a `next_cursor` field pointing to the next page of results (or `null` when no more pages exist).
- Endpoints MUST NOT use offset-based pagination.

### Response Format

- All JSON responses MUST be an object with a **`data`** key wrapping the payload.
- Payload field names MUST use **snake_case** for easy translation to language-native objects.
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
