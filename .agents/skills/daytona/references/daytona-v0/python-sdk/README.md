## Contents

- Installation
- Getting Started
- Configuration
- Real-time state updates
- Async Python SDK
- Reference




The Daytona Python SDK provides a robust interface for programmatically interacting with Daytona Sandboxes.

## Installation

This reference documents the Daytona v0 API, which Python SDK 2.x exposes as the `v0` namespace (`Daytona().v0`). The module pages show the 0.x SDK's examples; see [Reference](#reference) for how they map to SDK 2.x. Install SDK 2.x with the `v0-sdk` extra using pip:

```bash
pip install "daytona[v0-sdk]>=2,<3"
```

Or using poetry:

```bash
poetry add "daytona[v0-sdk]>=2,<3"
```

SDK 2.x connects to Daytona Cloud. To use a custom API URL, stay on SDK 0.x (`pip install "daytona<1"`) and call the client methods on `Daytona()` directly. For the changes between the versions, see [Upgrade to v2](./upgrade-to-v2.md).

## Getting Started

### Create a Sandbox

Create a Daytona Sandbox to run your code securely in an isolated environment. The following snippet is an example "Hello World" program that runs securely inside a Daytona Sandbox.

**Sync:**

```python
from daytona import Daytona

def main():
    # Initialize the SDK (uses environment variables by default)
    daytona = Daytona()

    # Create a new sandbox
    sandbox = daytona.v0.create()

    # Execute a command
    response = sandbox.process.exec("echo 'Hello, World!'")
    print(response.result)

if __name__ == "__main__":
    main()
```

**Async:**

```python
import asyncio
from daytona import AsyncDaytona

async def main():
    # Initialize the SDK (uses environment variables by default)
    async with AsyncDaytona() as daytona:
        # Create a new sandbox
        sandbox = await daytona.v0.create()

        # Execute a command
        response = await sandbox.process.exec("echo 'Hello, World!'")
        print(response.result)

if __name__ == "__main__":
    asyncio.run(main())
```

## Configuration

The Daytona SDK can be configured using environment variables or by passing options to the constructor. The `v0` namespace reads `DAYTONA_API_KEY` and `DAYTONA_TARGET` from the environment. To create a sandbox in a specific region, pass `target` to the create call:

**Sync:**

```python
from daytona import Daytona, DaytonaConfig
from daytona.v0 import CreateSandboxFromSnapshotParams

# Using environment variables (DAYTONA_API_KEY, DAYTONA_TARGET)
daytona = Daytona()

# Using explicit configuration
config = DaytonaConfig(api_key="YOUR_API_KEY")
daytona = Daytona(config)

# Creating a sandbox in a specific region
sandbox = daytona.v0.create(CreateSandboxFromSnapshotParams(target="us"))
```

**Async:**

```python
import asyncio
from daytona import AsyncDaytona, DaytonaConfig
from daytona.v0 import CreateSandboxFromSnapshotParams

async def main():
    # Using environment variables (DAYTONA_API_KEY, DAYTONA_TARGET)
    async with AsyncDaytona() as daytona:
        # Your async code here
        pass

    # Using explicit configuration
    config = DaytonaConfig(api_key="YOUR_API_KEY")
    async with AsyncDaytona(config) as daytona:
        # Creating a sandbox in a specific region
        sandbox = await daytona.v0.create(CreateSandboxFromSnapshotParams(target="us"))

if __name__ == "__main__":
    asyncio.run(main())
```

For more information on configuring the Daytona SDK, see [API keys](../platform/api-keys.md#authentication).

## Real-time state updates

The `v0` namespace streams sandbox state changes over a WebSocket (Socket.IO) connection by default. Sandbox lifecycle operations that wait on a state change (start, stop, pause, resize, snapshot, delete with `wait`) complete as soon as the server pushes the new state, instead of waiting for the next polling interval.

Each `Daytona().v0` or `AsyncDaytona().v0` client opens a single WebSocket connection shared by all of its sandboxes. A sparse polling safety net runs alongside the event stream, so a missed event never hangs a waiting operation.

The WebSocket handshake carries `source` and `sdkVersion` query parameters, equivalent to the `X-Daytona-Source` and `X-Daytona-SDK-Version` REST headers. The SDK collects no client-side telemetry.

### Polling fallback

If the WebSocket connection cannot be established, for example when a proxy, firewall, or network policy blocks it, the SDK falls back to polling automatically. Connection setup runs in the background and never raises an error, so no handling is required.

### Opt out of event streaming
> **Caution: Deprecated**
> Polling-only mode is deprecated and will be removed in a future release. Because the SDK falls back to polling automatically, opting out is only needed in environments that prohibit WebSocket connections by policy.

In polling-only mode the SDK never opens a WebSocket connection. Sandbox state is observed exclusively by polling the REST API, with the same cadence as SDK versions before event streaming.

To opt out, set the `DAYTONA_USE_DEPRECATED_POLLING` environment variable:

```bash
export DAYTONA_USE_DEPRECATED_POLLING=true
```

## Async Python SDK

Daytona provides an additional `DAYTONA_HAPPY_EYEBALLS_DELAY` environment variable for HTTP transport tuning in the async Python SDK. Use it to reduce intermittent async connection failures, such as `aiohttp.ClientConnectorError`, that can occur on dual-stack (IPv4/IPv6) networks.

| Variable                           | Description                                                                 | Required |
| ---------------------------------- | --------------------------------------------------------------------------- | -------- |
| **`DAYTONA_HAPPY_EYEBALLS_DELAY`** | Controls **`aiohttp`** Happy Eyeballs (IPv4/IPv6 connection race) delay in seconds. | No       |

- unset or empty: use `aiohttp` default behavior
- `none` (case-insensitive): disable the IPv4/IPv6 race
- non-negative float (for example `0.25`): set an explicit delay in seconds

```bash
# Disable Happy Eyeballs
export DAYTONA_HAPPY_EYEBALLS_DELAY=none

# Or set an explicit delay in seconds
export DAYTONA_HAPPY_EYEBALLS_DELAY=0.25
```

## Reference
> **Note: SDK 0.x reference**
> The module pages are generated from the 0.x SDK, so their examples call the client on `Daytona()` and show 0.x options. With SDK 2.x, call those methods on `Daytona().v0` or `AsyncDaytona().v0`, import the types from `daytona.v0`, and leave out `api_url`, `server_url`, and `use_deprecated_polling`, which SDK 2.x rejects. Set `DAYTONA_USE_DEPRECATED_POLLING` in the environment instead of the option.

The Python SDK reference documents the following modules:

### Sync

- [CodeInterpreter](./sync/code-interpreter.md)
- [ComputerUse](./sync/computer-use.md)
- [Daytona](./sync/daytona.md)
- [FileSystem](./sync/file-system.md)
- [Git](./sync/git.md)
- [LspServer](./sync/lsp-server.md)
- [ObjectStorage](./sync/object-storage.md)
- [Process](./sync/process.md)
- [Sandbox](./sync/sandbox.md)
- [Secret](./sync/secret.md)
- [Snapshot](./sync/snapshot.md)
- [Volume](./sync/volume.md)

### Async

- [AsyncCodeInterpreter](./async/code-interpreter.md)
- [AsyncComputerUse](./async/computer-use.md)
- [AsyncDaytona](./async/daytona.md)
- [AsyncFileSystem](./async/file-system.md)
- [AsyncGit](./async/git.md)
- [AsyncLspServer](./async/lsp-server.md)
- [AsyncObjectStorage](./async/object-storage.md)
- [AsyncProcess](./async/process.md)
- [AsyncSandbox](./async/sandbox.md)
- [AsyncSecret](./async/secret.md)
- [AsyncSnapshot](./async/snapshot.md)
- [AsyncVolume](./async/volume.md)

### Common

- [Charts](https://www.daytona.io/docs/en/python-sdk/common/charts)
- [Errors](./errors.md)
- [Image](./image.md)
