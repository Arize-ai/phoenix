# TypeScript SDK Reference

Interact with Daytona Sandboxes using the TypeScript SDK

The Daytona TypeScript SDK provides the `Daytona` root client for interacting with Daytona Sandboxes. Every operation goes through a version namespace: `daytona.v2` for the Daytona v2 API, or `daytona.v0` for the Daytona v0 API. The root client is the only way to build a namespace client. Resource types, builders, and errors for v2 are imported from `@daytona/sdk/v2`.

## Installation

Install the Daytona TypeScript SDK using npm. The SDK ships ESM and CJS builds with type declarations, and requires Node.js 22.4 or later, or a browser environment with `WebSocket`.

```bash
npm install @daytona/sdk@2.0.0-alpha.13
```

Or using yarn:

```bash
yarn add @daytona/sdk@2.0.0-alpha.13
```

## Getting Started

### Create a Sandbox

Create a Daytona Sandbox to run your code securely in an isolated environment. The following snippet is an example "Hello World" program that runs securely inside a Daytona Sandbox.

```typescript
import { Daytona } from '@daytona/sdk'

async function main() {
  // Initialize the SDK (reads DAYTONA_API_KEY from the environment)
  const daytona = new Daytona()

  // Create a new sandbox
  const sandbox = await daytona.v2.create({ waitSeconds: 60 })

  // Execute a command
  const result = await sandbox.exec('echo "Hello, World!"')
  console.log(result.output)

  await daytona.v2.delete(sandbox)
}

main().catch(console.error)
```

## Configuration

The Daytona SDK can be configured using environment variables or by passing a `DaytonaConfig` to the constructor. Fields left unset are read from the environment. Configure exactly one credential: `apiKey`, or `jwtToken` scoped with `projectId` for `daytona.v2` or `organizationId` for `daytona.v0`.

- `apiKey`: a project API key; falls back to `DAYTONA_API_KEY`
- `jwtToken`: a signed-in user's JWT, exchanged for a short-lived project-scoped token; falls back to `DAYTONA_JWT_TOKEN`
- `projectId`: scopes `jwtToken` to a project for `daytona.v2`; falls back to `DAYTONA_PROJECT_ID`
- `organizationId`: scopes `jwtToken` to an organization for `daytona.v0`; falls back to `DAYTONA_ORGANIZATION_ID`
- `requestTimeout`: per-request HTTP timeout in milliseconds for `daytona.v2`
- `connectionPoolMaxsize`: keep-alive socket pool size for `daytona.v2` requests in Node.js
- `otelEnabled`: runs each SDK HTTP request in a client span; falls back to `DAYTONA_OTEL_ENABLED`

`DaytonaConfig` has no API URL or region field, and the root rejects `apiUrl`. Pass `region` to each `daytona.v2` create. `DAYTONA_V2_API_URL`, else `DAYTONA_API_URL`, overrides the `daytona.v2` API endpoint; `daytona.v0` ignores both. The `target` field is deprecated and applies only to `daytona.v0`.

```typescript
import { Daytona } from '@daytona/sdk'

// Using environment variables (DAYTONA_API_KEY)
const daytona = new Daytona()

// Using explicit configuration
const daytonaWithConfig = new Daytona({
  apiKey: 'YOUR_API_KEY',
  requestTimeout: 30_000,
})
const sandbox = await daytonaWithConfig.v2.create({ region: 'us' })
```

`await daytona.close()` releases the client's connections at once. Closing is optional: in Node.js an idle connection does not keep the process alive.

For more information on configuring the Daytona SDK, see [authentication](./authentication.md). See the [`DaytonaConfig` reference](./reference/daytona.md#daytonaconfig) for details.

## Runtime support

In Node.js builds, the `daytona.v0` namespace loads on first access, and code that only uses `daytona.v2` never loads it. A browser bundle of the root client includes the v0 SDK, because the root is the only way to build a client.

`uploadFile()` and `downloadFile()` stream between the local disk and the sandbox, and are available only in Node.js; in a browser they throw `NotSupportedError`. `daytona.v0` operations that use Node.js APIs, such as file transfers, need Node.js polyfills in a browser bundle, for example [`vite-plugin-node-polyfills`](https://www.npmjs.com/package/vite-plugin-node-polyfills) for `Buffer`, `process`, and `global`.
