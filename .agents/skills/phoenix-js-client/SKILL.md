---
name: phoenix-js-client
description: Add or modify methods in the Phoenix TypeScript/JavaScript client SDK. Use when implementing new SDK methods, adding parameters to existing client methods, updating the JS client to match REST API changes, or regenerating generated TypeScript types from the OpenAPI schema. Triggers on tasks involving js/packages/phoenix-client, TypeScript client methods, or generated API types.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: TypeScript
  internal: true
---

# Phoenix JavaScript/TypeScript Client

The Phoenix JS client (`@arizeai/phoenix-client`) is a TypeScript SDK that wraps the Phoenix REST API. Resource implementations live under `js/packages/phoenix-client/src/`. TypeScript types are **generated** from `schemas/openapi.json` via `openapi-typescript` and must be regenerated whenever the REST API schema changes.

## Key Locations

| Item | Path |
|---|---|
| Resource implementations | `js/packages/phoenix-client/src/` |
| Generated types (do not edit) | `js/packages/phoenix-client/src/__generated__/api/v1.ts` |
| Unit tests | `js/packages/phoenix-client/test/` |
| Build + generate command | `pnpm run build` (from package dir) |
| Generate types only | `pnpm run generate` (from package dir) |

## Workflow

### Adding or changing a client method

1. **Ensure `schemas/openapi.json` is up to date** — if the REST API changed, rebuild it first:
   ```bash
   tox run -e build_openapi_schema
   ```

2. **Regenerate TypeScript types and build**:
   ```bash
   cd js/packages/phoenix-client
   pnpm run build
   ```
   `build` runs a `prebuild` hook that calls `openapi-typescript` to regenerate `src/__generated__/api/v1.ts` before compiling. Alternatively, to regenerate types without a full build:
   ```bash
   pnpm run generate
   ```
   Commit the updated `src/__generated__/api/v1.ts`.

3. **Update the resource implementation**, using the freshly generated types for request/response shapes:

   ```typescript
   export interface DeleteExperimentParams {
     experimentId: string;
     deleteProject?: boolean; // optional params use `?`
   }

   export async function deleteExperiment({
     client,
     experimentId,
     deleteProject,
   }: DeleteExperimentParams & { client: PhoenixClient }): Promise<void> {
     await client.DELETE("/v1/experiments/{experiment_id}", {
       params: {
         path: { experiment_id: experimentId },
         // Only include query params when defined to avoid sending `undefined`
         ...(deleteProject !== undefined && { query: { delete_project: deleteProject } }),
       },
     });
   }
   ```

4. **Add unit tests** in `js/packages/phoenix-client/test/<resource>/`:

   ```typescript
   import { describe, it, expect, vi } from "vitest";

   describe("deleteExperiment", () => {
     it("omits delete_project when not provided", () => { ... });
     it("passes delete_project=true when specified", () => { ... });
     it("passes delete_project=false when specified", () => { ... });
   });
   ```

## Testing

```bash
# From js/packages/phoenix-client
pnpm test

# Watch mode
pnpm test:watch

# Type check only
pnpm typecheck
```

## Non-Obvious Notes

- **Generated types are checked in**: `src/__generated__/api/v1.ts` is committed. After schema changes, always regenerate and commit. Do not hand-edit this file.
- **Schema must be fresh first**: `pnpm run generate` reads from `schemas/openapi.json` at the repo root. If you run it before rebuilding the schema, the generated types will be stale.
- **`prebuild` auto-generates**: Running `pnpm run build` always regenerates types first via the `prebuild` hook. You don't need to run `generate` separately before `build`.
- **Spread undefined carefully**: When a query parameter is optional, avoid sending it as `undefined` in the request. Use a conditional spread (`...(param !== undefined && { query: { param } })`) so the field is omitted entirely when not provided.
- **snake_case for API params, camelCase for TypeScript**: REST API query params use `snake_case` (e.g., `delete_project`). Expose them as `camelCase` in the TypeScript interface (e.g., `deleteProject`) and map when building the request.
- **Changesets required**: Any change inside `js/` requires a changeset. After making changes, run `pnpm changeset` from the `js/` directory to create one before submitting a PR.
- **Test framework is Vitest**: Tests use `vitest` (not Jest). The test runner is configured at the workspace level; no `vitest.config.ts` is needed in the package.
