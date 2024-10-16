# @arizeai/phoenix-client

This package provides a client for the Phoenix API.

It utililizes [openapi-ts](https://openapi-ts.pages.dev/) to generate the types from the Phoenix OpenAPI spec.

## Installation

```bash
# or yarn, pnpm, bun, etc...
npm install @arizeai/phoenix-client
```

## Configuration

The client will automatically read environment variables from your environment, if available.

The following environment variables are used:

- `PHOENIX_HOST` - The base URL of the Phoenix API.
- `PHOENIX_CLIENT_HEADERS` - Custom headers to add to all requests. A JSON stringified object.

```bash
PHOENIX_HOST=http://localhost:8000 PHOENIX_CLIENT_HEADERS='{"X-Custom-Header": "123"}' pnpx tsx examples/list_datasets.ts
# emits the following request:
# GET http://localhost:8000/v1/datasets
# headers: {
#   "X-Custom-Header": "123",
# }
```

Alternatively, you can pass configuration options to the client directly, and they will be prioritized over environment variables and default values.

```ts
const phoenix = createClient({
  options: {
    baseUrl: "http://localhost:8000",
    headers: {
      "X-Custom-Header": "123",
    },
  },
});
```

## Examples

To run examples, install dependencies using `pnpm` and run:

```bash
pnpm install
pnpx tsx examples/list_datasets.ts
# change the file name to run other examples
```
