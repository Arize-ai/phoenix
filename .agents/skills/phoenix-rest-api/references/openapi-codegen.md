# OpenAPI & Codegen

Run `make openapi` after any endpoint change. Generates:
- `schemas/openapi.json`
- `packages/phoenix-client/src/phoenix/client/__generated__/v1/__init__.py` (Python TypedDict)
- `js/packages/phoenix-client/src/__generated__/api/v1.ts` (TypeScript)

Commit all three with your endpoint changes.

CI runs `openapi-diff` on PRs modifying the schema. **Incompatible** = removed endpoints/fields, changed types, renamed operationIds. **Compatible** = new endpoints, new optional fields, new schemas/enum values.
