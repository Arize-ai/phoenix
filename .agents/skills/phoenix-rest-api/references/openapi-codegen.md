# OpenAPI Schema & Client Codegen

## Overview

REST endpoint changes require regenerating three artifacts:
1. **OpenAPI schema** — `schemas/openapi.json`
2. **Python client types** — `packages/phoenix-client/src/phoenix/client/__generated__/v1/__init__.py`
3. **TypeScript client types** — `js/packages/phoenix-client/src/__generated__/api/v1.ts`

## Commands

```bash
# Full workflow: schema + Python + TypeScript (preferred)
make openapi

# Individual steps (rarely needed)
make schema-openapi          # Only regenerate schemas/openapi.json
make codegen-python-client   # Only regenerate Python types
make codegen-ts-client       # Only regenerate TypeScript types
```

**Always run `make openapi` after modifying any REST endpoint, model, or route registration.**

## How It Works

### Schema Generation (`make schema-openapi`)

- Script: `scripts/ci/compile_openapi_schema.py`
- Uses FastAPI's `get_openapi()` on the v1 router created by `create_v1_router(authentication_enabled=False)`
- Output: `schemas/openapi.json` (OpenAPI 3.1.0)

### Python Codegen (`make codegen-python-client`)

1. `datamodel-codegen` converts `schemas/openapi.json` into Python dataclasses
2. `packages/phoenix-client/scripts/codegen/transform.py` transforms dataclasses into `TypedDict` classes
3. `ruff format` + `ruff check --fix` clean up the output
4. Output: `packages/phoenix-client/src/phoenix/client/__generated__/v1/__init__.py`

The generated file contains `TypedDict` classes used in integration tests (e.g., `v1.LocalUser`, `v1.GetUsersResponseBody`).

### TypeScript Codegen (`make codegen-ts-client`)

- Uses `openapi-typescript` (v7.x) with flags `--empty-objects-unknown=true --default-non-nullable=false`
- Output: `js/packages/phoenix-client/src/__generated__/api/v1.ts`

## CI: Backward Compatibility

`.github/workflows/openapi-schema.yaml` runs on PRs that modify `schemas/openapi.json`:
- Uses `openapitools/openapi-diff` Docker image
- **Fails on incompatible changes** (removed endpoints, removed required fields, changed types)
- Compatible changes pass (new endpoints, new optional fields, new response types)

### What Counts as Incompatible

- Removing an endpoint or HTTP method
- Removing a required field from a response
- Changing a field's type
- Renaming an `operationId`

### What Is Compatible

- Adding new endpoints
- Adding new optional fields to responses
- Adding new response models/schemas
- Adding new enum values to discriminated unions

## Checklist

After modifying REST endpoints:

1. Run `make openapi`
2. Verify new types appear in both generated files
3. Commit all three generated files alongside the endpoint changes
4. CI will verify backward compatibility on the PR
