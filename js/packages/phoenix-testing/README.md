# @arizeai/phoenix-testing

Internal workspace testing utilities that mock the Phoenix server with [MSW (Mock Service Worker)](https://mswjs.io/). Request handlers are generated at runtime from the repository's OpenAPI definition (`schemas/openapi.json`) via [`@mswjs/source`](https://source.mswjs.io/), so every documented endpoint answers with a schema-conformant response without any hand-written mock code.

This package is private and only supported inside the Phoenix pnpm workspace.

## Usage

### Mock every Phoenix endpoint (Node.js test runners)

```ts
// vitest example
import { createMockServer } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll } from "vitest";

const server = await createMockServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Every operation in the Phoenix OpenAPI definition now responds with data generated from its response schema (or its examples, when present). By default handlers are bound to `http://localhost:6006` — the same default base URL as `@arizeai/phoenix-client` — and can be re-pointed with the `baseUrl` option.

### Pin down specific responses, type-safely

`createHttp` returns an [`openapi-msw`](https://github.com/christoph-fricke/openapi-msw) `http` namespace bound to the Phoenix API's `paths`. Paths, path params, request bodies, and response bodies are all type-checked against the OpenAPI definition:

```ts
import { createHttp } from "@arizeai/phoenix-testing";

const http = createHttp();

server.use(
  http.get("/v1/datasets/{id}", ({ params, response }) =>
    response(200).json({
      data: {
        id: params.id,
        name: "my dataset",
        description: null,
        metadata: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        example_count: 7,
      },
    })
  )
);
```

Handlers passed to `createMockServer({ handlers })` or registered with `server.use(...)` take precedence over the generated ones, so a test can pin down exactly the responses it cares about while every other endpoint keeps answering with generated placeholder data.

## API

| Export                                              | Description                                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `createMockServer({ baseUrl, handlers })` (`/node`) | MSW server for Node.js with generated handlers for every Phoenix endpoint.                |
| `Server` (`/node`)                                  | The mock server type returned by `createMockServer`.                                      |
| `createOpenApiHandlers({ baseUrl })`                | The generated MSW request handlers, for composing into your own setup.                    |
| `createHttp({ baseUrl })`                           | Type-safe `http` namespace for writing custom Phoenix handler overrides.                  |
| `getOpenApiDocument({ baseUrl })`                   | A copy of the workspace's Phoenix OpenAPI document with `servers` pointed at `baseUrl`.   |
| `DEFAULT_MOCK_BASE_URL`                             | `"http://localhost:6006"` — the default base URL handlers are bound to.                   |
| `pathsV1`, `componentsV1`, `operationsV1`           | OpenAPI types generated from the Phoenix API definition (via `openapi-typescript`).       |
| `*` (re-exported `msw`)                             | Everything from `msw`, for raw (non-OpenAPI) handlers, e.g. GraphQL or third-party hosts. |

## Regenerating the mocks

The generated OpenAPI types are derived from `schemas/openapi.json` at the repository root:

```bash
pnpm run generate
```

This runs automatically before every build (`prebuild`).
