## Contents

- Installation
- Getting Started
- Configuration
- Real-time state updates
- Multiple runtime support
- Reference



The Daytona TypeScript SDK provides a powerful interface for programmatically interacting with Daytona Sandboxes.

## Installation

This reference documents the Daytona v0 API, which TypeScript SDK 2.x exposes as the `v0` namespace (`new Daytona().v0`). The module pages show the 0.x SDK's examples; see [Reference](#reference) for how they map to SDK 2.x. The package includes the namespace, so no extra install is required. SDK 2.x requires Node.js 22.15 or later.

Install the Daytona TypeScript SDK using npm:

```bash
npm install @daytona/sdk@2
```

Or using yarn:

```bash
yarn add @daytona/sdk@2
```

SDK 2.x connects to Daytona Cloud. To use a custom API URL, stay on SDK 0.x (`npm install @daytona/sdk@0`) and call the client methods on `new Daytona()` directly. For the changes between the versions, see [Upgrade to v2](./upgrade-to-v2.md).

## Getting Started

### Create a Sandbox

Create a Daytona Sandbox to run your code securely in an isolated environment. The following snippet is an example “Hello World” program that runs securely inside a Daytona Sandbox.

```typescript
import { Daytona } from '@daytona/sdk'

async function main() {
  // Initialize the SDK (uses environment variables by default)
  const daytona = new Daytona()

  // Create a new sandbox
  const sandbox = await daytona.v0.create({
    language: 'typescript',
    envVars: { NODE_ENV: 'development' },
  })

  // Execute a command
  const response = await sandbox.process.executeCommand('echo "Hello, World!"')
  console.log(response.result)
}

main().catch(console.error)
```

## Configuration

The Daytona SDK can be configured using environment variables or by passing options to the constructor. The `v0` namespace reads `DAYTONA_API_KEY` and `DAYTONA_TARGET` from the environment. To create a sandbox in a specific region, pass `target` to the create call:

```typescript
import { Daytona } from '@daytona/sdk'

// Using environment variables (DAYTONA_API_KEY, DAYTONA_TARGET)
const daytona = new Daytona()

// Using explicit configuration
const configured = new Daytona({ apiKey: 'YOUR_API_KEY' })

// Creating a sandbox in a specific region
const sandbox = await configured.v0.create({ target: 'us' })
```

For more information on configuring the Daytona SDK, see [API keys](../platform/api-keys.md#authentication).

## Real-time state updates

The `v0` namespace streams sandbox state changes over a WebSocket (Socket.IO) connection by default. Sandbox lifecycle operations that wait on a state change (start, stop, pause, resize, snapshot, delete with `wait`) complete as soon as the server pushes the new state, instead of waiting for the next polling interval.

Each `new Daytona().v0` client opens a single WebSocket connection shared by all of its sandboxes. A sparse polling safety net runs alongside the event stream, so a missed event never hangs a waiting operation. Note: The connection never keeps Node.js or Bun processes alive.

The WebSocket handshake carries `source` and `sdkVersion` query parameters, equivalent to the `X-Daytona-Source` and `X-Daytona-SDK-Version` REST headers. The SDK collects no client-side telemetry.

### Polling fallback

If the WebSocket connection cannot be established, for example when a proxy, firewall, or network policy blocks it, the SDK falls back to polling automatically. Connection setup runs in the background and never throws, so no error handling is required.

### Opt out of event streaming
> **Caution: Deprecated**
> Polling-only mode is deprecated and will be removed in a future release. Because the SDK falls back to polling automatically, opting out is only needed in environments that prohibit WebSocket connections by policy.

In polling-only mode the SDK never opens a WebSocket connection. Sandbox state is observed exclusively by polling the REST API, with the same cadence as SDK versions before event streaming.

To opt out, set the `DAYTONA_USE_DEPRECATED_POLLING` environment variable:

```bash
export DAYTONA_USE_DEPRECATED_POLLING=true
```

## Multiple runtime support

The TypeScript SDK ships as a dual ESM/CJS package for **Node.js** 22.15 or later and for browser environments with `WebSocket`. Import the v0 resource types, such as `Image`, from `@daytona/sdk/v0`; the client comes from `@daytona/sdk`.

A browser bundle of the root client includes the v0 SDK, so `daytona.v0` works in browsers too. For **browser apps with Vite** (or any browser bundler), install [`vite-plugin-node-polyfills`](https://www.npmjs.com/package/vite-plugin-node-polyfills) and add it to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [nodePolyfills({ globals: { Buffer: true, process: true, global: true } })],
})
```

The SDK uses Node's `Buffer` for binary data (downloaded files, multipart bodies). Browsers don't ship `Buffer`, so the polyfill provides it. Without it, basic operations like `Image.base()` and `daytona.v0.list()` still work, but methods that handle binary payloads (`fs.downloadFile`, `fs.downloadFiles`) will throw.

Some runtimes don't expose the full set of Node.js APIs (browsers and edge runtimes have no filesystem, no `crypto`, etc.). Methods that depend on those APIs throw a clear runtime error instead of silently producing wrong results.

## Reference
> **Note: SDK 0.x reference**
> The module pages are generated from the 0.x SDK, so their examples call the client on `new Daytona()` and show 0.x options. With SDK 2.x, call those methods on `new Daytona().v0`, import the types from `@daytona/sdk/v0`, and leave out `apiUrl`, `serverUrl`, and `useDeprecatedPolling`, which SDK 2.x rejects. Set `DAYTONA_USE_DEPRECATED_POLLING` in the environment instead of the option.

The TypeScript SDK reference documents the following modules:

- [Charts](https://www.daytona.io/docs/en/typescript-sdk/charts)
- [CodeInterpreter](./code-interpreter.md)
- [ComputerUse](./computer-use.md)
- [Daytona](./daytona.md)
- [Errors](./errors.md)
- [ExecuteResponse](./execute-response.md)
- [FileSystem](./file-system.md)
- [Git](./git.md)
- [Image](./image.md)
- [LspServer](./lsp-server.md)
- [ObjectStorage](./object-storage.md)
- [Process](./process.md)
- [Pty](./pty.md)
- [PtyHandle](./pty-handle.md)
- [Sandbox](./sandbox.md)
- [SandboxNode](./sandbox-node.md)
- [Secret](./secret.md)
- [Snapshot](./snapshot.md)
- [Volume](./volume.md)
- [WarmPool](./warm-pool.md)
