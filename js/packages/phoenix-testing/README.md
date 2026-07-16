# @arizeai/phoenix-testing

Testing utilities that mock the [Phoenix](https://github.com/Arize-ai/phoenix) server with [MSW (Mock Service Worker)](https://mswjs.io/). Request handlers are generated at runtime from the Phoenix OpenAPI definition (`schemas/openapi.json`, embedded in this package) via [`@mswjs/source`](https://source.mswjs.io/), so every documented endpoint answers with a schema-conformant response without any hand-written mock code.

## Installation

```bash
pnpm add -D @arizeai/phoenix-testing
```

`msw` is included as a dependency — no extra install needed.

## Usage

### Mock every Phoenix endpoint (Node.js test runners)

```ts
// vitest example
import { createPhoenixMockServer } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll } from "vitest";

const server = await createPhoenixMockServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Every operation in the Phoenix OpenAPI definition now responds with data generated from its response schema (or its examples, when present). By default handlers are bound to `http://localhost:6006` — the same default base URL as `@arizeai/phoenix-client` — and can be re-pointed with the `baseUrl` option.

### Pin down specific responses, type-safely

`createPhoenixHttp` returns an [`openapi-msw`](https://github.com/christoph-fricke/openapi-msw) `http` namespace bound to the Phoenix API's `paths`. Paths, path params, request bodies, and response bodies are all type-checked against the OpenAPI definition:

```ts
import { createPhoenixHttp } from "@arizeai/phoenix-testing";

const http = createPhoenixHttp();

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

Handlers passed to `createPhoenixMockServer({ handlers })` or registered with `server.use(...)` take precedence over the generated ones, so a test can pin down exactly the responses it cares about while every other endpoint keeps answering with generated placeholder data.

### Browser / custom setups

The root export is environment-agnostic. To compose the handlers into your own MSW setup (e.g. `setupWorker` in the browser):

```ts
import { createPhoenixOpenApiHandlers } from "@arizeai/phoenix-testing";
import { setupWorker } from "msw/browser";

const worker = setupWorker(...(await createPhoenixOpenApiHandlers()));
```

## API

| Export                                                     | Description                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `createPhoenixMockServer({ baseUrl, handlers })` (`/node`) | MSW server for Node.js with generated handlers for every Phoenix endpoint.           |
| `createPhoenixOpenApiHandlers({ baseUrl })`                | The generated MSW request handlers, for composing into your own setup.               |
| `createPhoenixHttp({ baseUrl })`                           | Type-safe `http` namespace for writing custom Phoenix handler overrides.             |
| `getPhoenixOpenApiDocument({ baseUrl })`                   | A copy of the embedded Phoenix OpenAPI document with `servers` pointed at `baseUrl`. |
| `DEFAULT_PHOENIX_MOCK_BASE_URL`                            | `"http://localhost:6006"` — the default base URL handlers are bound to.              |
| `pathsV1`, `componentsV1`, `operationsV1`                  | OpenAPI types generated from the Phoenix API definition (via `openapi-typescript`).  |

## Regenerating the mocks

The generated OpenAPI types and the embedded OpenAPI document are derived from `schemas/openapi.json` at the repository root:

```bash
pnpm run generate
```

This runs automatically before every build (`prebuild`).
