---
name: phoenix-rest-api
user-invocable: false
description: >
  REST API development for the Phoenix AI observability platform. Use when adding,
  modifying, or reviewing REST endpoints in src/phoenix/server/api/routers/v1/.
  Triggers on tasks involving new endpoints, request/response models, OpenAPI schema
  generation, client codegen, authorization, pagination, or REST integration tests.
metadata:
  internal: true
---

# Phoenix REST API Development

REST endpoints live in `src/phoenix/server/api/routers/v1/`. Each router module defines
endpoints, Pydantic models, and is registered in `__init__.py`. Changes to endpoints
require regenerating the OpenAPI schema and client types.

## Reference Files

Read the relevant file(s) based on the task:

| Reference file | When to read |
|----------------|-------------|
| `references/endpoint-patterns.md` | Adding or modifying a REST endpoint |
| `references/openapi-codegen.md` | Regenerating schema, client types, or CI checks |
| `references/testing-patterns.md` | Writing integration tests for REST endpoints |
