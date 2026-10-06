## Contents

- Installation
- Getting Started
- Configuration
- Real-time state updates
- Multiple runtime support
- Reference



The Daytona TypeScript SDK provides a powerful interface for programmatically interacting with Daytona Sandboxes.

## Installation

Install the Daytona TypeScript SDK using npm:

```bash
npm install @daytona/sdk
```

Or using yarn:

```bash
yarn add @daytona/sdk
```

## Getting Started

### Create a Sandbox

Create a Daytona Sandbox to run your code securely in an isolated environment. The following snippet is an example “Hello World” program that runs securely inside a Daytona Sandbox.

```typescript
import { Daytona } from '@daytona/sdk'

async function main() {
  // Initialize the SDK (uses environment variables by default)
  const daytona = new Daytona()

  // Create a new sandbox
  const sandbox = await daytona.create({
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

The Daytona SDK can be configured using environment variables or by passing options to the constructor:

```typescript
import { Daytona } from '@daytona/sdk';

// Using environment variables (DAYTONA_API_KEY, DAYTONA_API_URL, DAYTONA_TARGET)
const daytona = new Daytona();

// Using explicit configuration
const daytona = new Daytona({
  apiKey: 'YOUR_API_KEY',
  apiUrl: 'https://app.daytona.io/api',
  target: 'us'
});
```

For more information on configuring the Daytona SDK, see [API keys](../../SKILL.md#authentication#authentication).

## Real-time state updates

Starting with SDK version **0.198.0**, the SDK streams sandbox state changes over a WebSocket (Socket.IO) connection by default. Sandbox lifecycle operations that wait on a state change (start, stop, pause, resize, snapshot, delete with `wait`) complete as soon as the server pushes the new state, instead of waiting for the next polling interval.

Each `Daytona` client opens a single WebSocket connection shared by all of its sandboxes. A sparse polling safety net runs alongside the event stream, so a missed event never hangs a waiting operation. Note: The connection never keeps Node.js or Bun processes alive.

The WebSocket handshake carries `source` and `sdkVersion` query parameters, equivalent to the `X-Daytona-Source` and `X-Daytona-SDK-Version` REST headers. The SDK collects no client-side telemetry.

### Polling fallback

If the WebSocket connection cannot be established, for example when a proxy, firewall, or network policy blocks it, the SDK falls back to polling automatically. Connection setup runs in the background and never throws, so no error handling is required.

The WebSocket endpoint derives from the configured API URL, including custom base paths, so reverse proxy deployments such as `https://host/prefix/api` work without additional configuration.

### Opt out of event streaming
> **Caution: Deprecated**
> Polling-only mode is deprecated and will be removed in a future release. Because the SDK falls back to polling automatically, opting out is only needed in environments that prohibit WebSocket connections by policy.

In polling-only mode the SDK never opens a WebSocket connection. Sandbox state is observed exclusively by polling the REST API, with the same cadence as SDK versions before event streaming.

To opt out, set the `DAYTONA_USE_DEPRECATED_POLLING` environment variable:

```bash
export DAYTONA_USE_DEPRECATED_POLLING=true
```

Or pass `useDeprecatedPolling` when initializing the client. The explicit configuration option always takes precedence over the environment variable; the environment variable applies only when the option is unset.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona({ useDeprecatedPolling: true })
```

See the [`DaytonaConfig` reference](./daytona.md#daytonaconfig) for details.

## Multiple runtime support

The TypeScript SDK ships as a dual ESM/CJS package and works out of the box in **Node.js**, **Bun**, **Next.js**, **Nuxt.js**, **Remix**, **Vite SSR**, **AWS Lambda**, and **Azure Functions** without any extra configuration.

For **Cloudflare Workers**, set the Node.js compatibility flag in your `wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]
```

For **Deno**, install with `deno add npm:@daytona/sdk` or import directly with the `npm:` specifier:

```typescript
import { Daytona, Image } from 'npm:@daytona/sdk'
```

For **browser apps with Vite** (or any browser bundler), install [`vite-plugin-node-polyfills`](https://www.npmjs.com/package/vite-plugin-node-polyfills) and add it to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [nodePolyfills({ globals: { Buffer: true, process: true, global: true } })],
})
```

The SDK uses Node's `Buffer` for binary data (downloaded files, multipart bodies). Browsers don't ship `Buffer`, so the polyfill provides it. Without it, basic operations like `Image.base()` and `daytona.list()` still work, but methods that handle binary payloads (`fs.downloadFile`, `fs.downloadFiles`) will throw.

Some runtimes don't expose the full set of Node.js APIs (browsers and edge runtimes have no filesystem, no `crypto`, etc.). Methods that depend on those APIs throw a clear runtime error instead of silently producing wrong results.

## Reference

The TypeScript SDK reference documents the following modules:

- [Charts](./charts.md)
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
- [Secret](./secret.md)
- [Snapshot](./snapshot.md)
- [Volume](./volume.md)
- [WarmPool](./warm-pool.md)
