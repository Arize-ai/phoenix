# TypeScript SDK

Install, configure, and use the TypeScript SDK to manage sandboxes from TypeScript.

The TypeScript SDK is a TypeScript and JavaScript library for managing sandboxes from code. It lets a program or agent in Node.js or a browser control the lifecycle of a sandbox without writing HTTP requests.

Daytona provides the TypeScript SDK as one asynchronous root client. The root client reaches the platform through a version namespace, one for the v2 platform and one for the v0 platform, and builds every namespace client itself. The client holds one credential for both namespaces. It keeps its network connections open until the program closes it.

Use the TypeScript SDK to run sandboxes from Node.js or a browser, or use the [Python SDK](../python-sdk/README.md), the [CLI](../cli/README.md), or the [API](../api/README.md) from other languages. Send every new operation through the v2 namespace, and use the v0 namespace only for code that still depends on the v0 platform. Import the v2 resource types, builders, and errors from @daytona/sdk/v2.

| **Concept**              | **Description**                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------- |
| **Root client**          | The object a program creates first, which holds the credential and the connections. |
| **Version namespace**    | The part of a client that targets one version of the platform interface.            |
| **Client configuration** | The credential and connection settings that a client is created with.               |

## Contents

- [Install the TypeScript SDK](#install-the-typescript-sdk)
- [Configure the client](#configure-the-client)
- [Create a sandbox](#create-a-sandbox)
- [Reference](#reference)

## Install the TypeScript SDK

Install the TypeScript SDK to call sandboxes from a Node.js or browser program. An installation downloads a package and its dependencies into a project.

An installation of the TypeScript SDK holds both version namespaces in one package, with ESM and CommonJS builds and type declarations.

Install the package with npm or yarn. The package requires Node.js 22.15 or later, or a browser environment with WebSocket.

**CLI:**

```bash
# npm
npm install @daytona/sdk@2

# yarn
yarn add @daytona/sdk@2
```

> **Notes:**
>
> - In Node.js, the v0 namespace loads on first access, and code that only uses daytona.v2 never loads it.
> - A browser bundle of the root client includes the v0 SDK, because the root client is the only way to build a client.
> - The uploadFile() and downloadFile() methods stream between the local disk and the sandbox, and work only in Node.js.
> - The daytona.v0 operations that use Node.js APIs, such as file transfers, need Node.js polyfills in a browser bundle, for example [vite-plugin-node-polyfills](https://www.npmjs.com/package/vite-plugin-node-polyfills) for Buffer, process, and global.

## Configure the client

Configure the client to choose its credential and how it connects to the platform. A configuration is the set of values that a program starts with instead of values written into its code.

A client configuration is copied when the root client is created, so later changes to it have no effect on that client.

Configure the client in code, or leave a field unset to read it from the environment, as [authentication](./authentication.md) describes. Set exactly one credential: an API key, or a JWT scoped to a project for v2 or to an organization for v0. The configuration has no API URL or region field, so pass the region to each v2 create. The [DaytonaConfig reference](./reference/daytona.md#daytonaconfig) lists every field.

**TypeScript:**

```typescript
import { Daytona } from '@daytona/sdk'

// Using environment variables (DAYTONA_API_KEY)
const daytona = new Daytona()

// Using explicit configuration
const daytonaWithConfig = new Daytona({
  apiKey: 'YOUR_API_KEY',
  requestTimeoutSeconds: 30,
})
const sandbox = await daytonaWithConfig.v2.create({ region: 'us' })
await daytonaWithConfig.v2.delete(sandbox)
```

| **Parameter**           | **Description**                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apiKey`                | Sets the project API key.<br />**Default:** the value of DAYTONA_API_KEY                                         |
| `jwtToken`              | Sets the JWT of a signed-in user, which the client exchanges for a short-lived project token.<br />**Default:** the value of DAYTONA_JWT_TOKEN |
| `projectId`             | Scopes the JWT to a project for daytona.v2.<br />**Default:** the value of DAYTONA_PROJECT_ID                    |
| `organizationId`        | Scopes the JWT to an organization for daytona.v0.<br />**Default:** the value of DAYTONA_ORGANIZATION_ID          |
| `requestTimeoutSeconds` | Sets the total time of one daytona.v2 request, in seconds.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `30` |
| `connectionPoolMaxsize` | Sets the keep-alive socket pool size for daytona.v2 requests in Node.js.                                         |
| `otelEnabled`           | Runs each SDK HTTP request in a client span.<br />**Default:** the value of DAYTONA_OTEL_ENABLED                  |
| `target`                | Sets the default region of daytona.v0, and is deprecated.                                                        |

> **Notes:**
>
> - The DAYTONA_V2_API_URL environment variable selects the daytona.v2 API endpoint, and the SDK ignores DAYTONA_API_URL.

## Create a sandbox

Create a sandbox to run code in an isolated virtual machine. Creation provisions a resource and returns a handle to it once the resource is ready.

A creation of a sandbox returns a sandbox object that the program uses for every later call on that sandbox. Its calls go through the client that created it, so they stop working once that client closes.

Create the sandbox from the v2 namespace of the root client. Close the root client to release its connections at once; closing is optional, because in Node.js an idle connection does not keep the process alive.

**TypeScript:**

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

| **Parameter** | **Description**                                                                   |
| ------------- | --------------------------------------------------------------------------------- |
| `waitSeconds` | Sets how long the create waits for the sandbox to start, in seconds.<br />**Default:** `60` |

> **Notes:**
>
> - The root client reads the API key from the DAYTONA_API_KEY environment variable when the code passes no configuration.

## Reference

A library reference is the documentation of every class, method, and type that a library exposes. It is generated from the source code of the library, so it matches the released package.

The reference of the TypeScript SDK has one page for each part of the client, from the root client to its error types.

Open a page to look up the parameters, defaults, and return values of a method.

- [Daytona](./reference/daytona.md)
- [Sandbox](./reference/sandbox.md)
- [FileSystem](./reference/file-system.md)
- [Git](./reference/git.md)
- [Process](./reference/process.md)
- [Interpreter](./reference/interpreter.md)
- [ComputerUse](./reference/computer-use.md)
- [Ports](./reference/ports.md)
- [Docker](./reference/docker.md)
- [Image](./reference/image.md)
- [Snapshot](./reference/snapshot.md)
- [Volume](./reference/volume.md)
- [Reservations](./reference/reservations.md)
- [MacModels](./reference/mac-models.md)
- [Secret](./reference/secret.md)
- [Types](./reference/types.md)
- [Shared errors](./reference/shared-errors.md)
- [Errors](./reference/errors.md)
