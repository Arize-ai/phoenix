# Python SDK Reference

Interact with Daytona Sandboxes using the Python SDK

The Daytona Python SDK provides two root clients for interacting with Daytona Sandboxes:

- `Daytona`: synchronous client; each call blocks until it completes
- `AsyncDaytona`: asynchronous client with the same methods; methods are coroutines and must be awaited

Every operation goes through a version namespace: `daytona.v2` for the Daytona v2 API, or `daytona.v0` for the Daytona v0 API. The root client is the only way to build a namespace client. Resource types such as `Sandbox` and `ImageBuilder` are imported from `daytona.v2`.

## Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Configuration](#configuration)

## Installation

Install the Daytona Python SDK using pip. The SDK requires Python 3.10 or later.

```bash
pip install daytona==2.0.0a13
```

Install the extras for OpenTelemetry request spans or the `daytona.v0` namespace:

```bash
pip install 'daytona[otel]==2.0.0a13'
pip install 'daytona[v0-sdk]==2.0.0a13'
```

## Getting Started

### Create a Sandbox

Create a Daytona Sandbox to run your code securely in an isolated environment. The following snippet is an example "Hello World" program that runs securely inside a Daytona Sandbox.

**Sync:**

```python
from daytona import Daytona

def main():
    # Initialize the SDK (reads DAYTONA_API_KEY from the environment)
    with Daytona() as daytona:
        # Create a new sandbox
        sandbox = daytona.v2.create(wait_seconds=60)

        # Execute a command
        result = sandbox.exec("echo 'Hello, World!'")
        print(result.output)

        daytona.v2.delete(sandbox)

if __name__ == "__main__":
    main()
```

**Async:**

```python
import asyncio
from daytona import AsyncDaytona

async def main():
    # Initialize the SDK (reads DAYTONA_API_KEY from the environment)
    async with AsyncDaytona() as daytona:
        # Create a new sandbox
        sandbox = await daytona.v2.create(wait_seconds=60)

        # Execute a command
        result = await sandbox.exec("echo 'Hello, World!'")
        print(result.output)

        await daytona.v2.delete(sandbox)

if __name__ == "__main__":
    asyncio.run(main())
```

`with Daytona(...)` and `async with AsyncDaytona(...)` release the client's connections when the block ends. Close the root client, not `daytona.v2` directly: a namespace client closed on its own stays cached and fails on later calls.

## Configuration

The Daytona SDK can be configured using environment variables or by passing a `DaytonaConfig` to the constructor. Fields left unset are read from the environment. Configure exactly one credential: `api_key`, or `jwt_token` scoped with `project_id` for `daytona.v2` or `organization_id` for `daytona.v0`.

- `api_key`: a project API key; falls back to `DAYTONA_API_KEY`
- `jwt_token`: a signed-in user's JWT, exchanged for a short-lived project-scoped token; falls back to `DAYTONA_JWT_TOKEN`
- `project_id`: scopes `jwt_token` to a project for `daytona.v2`; falls back to `DAYTONA_PROJECT_ID`
- `organization_id`: scopes `jwt_token` to an organization for `daytona.v0`; falls back to `DAYTONA_ORGANIZATION_ID`
- `request_timeout`: per-request HTTP timeout in seconds for `daytona.v2`
- `connection_pool_maxsize`: maximum number of live and keep-alive HTTP connections
- `otel_enabled`: emits client spans when `daytona[otel]` is installed; falls back to `DAYTONA_OTEL_ENABLED`

`DaytonaConfig` has no API URL or region field, and passing `api_url` or `toolbox_url` raises a `TypeError`. Pass `region=` to each `daytona.v2` create. `DAYTONA_V2_API_URL`, else `DAYTONA_API_URL`, overrides the `daytona.v2` API endpoint; `daytona.v0` ignores both. The `target` field is deprecated and applies only to `daytona.v0`.

**Sync:**

```python
from daytona import Daytona, DaytonaConfig

# Using environment variables (DAYTONA_API_KEY)
with Daytona() as daytona:
    sandbox = daytona.v2.create()

# Using explicit configuration
config = DaytonaConfig(
    api_key="YOUR_API_KEY",
    request_timeout=30,
)
with Daytona(config) as daytona:
    sandbox = daytona.v2.create(region="us")
```

**Async:**

```python
import asyncio
from daytona import AsyncDaytona, DaytonaConfig

async def main():
    # Using environment variables (DAYTONA_API_KEY)
    async with AsyncDaytona() as daytona:
        sandbox = await daytona.v2.create()

    # Using explicit configuration
    config = DaytonaConfig(
        api_key="YOUR_API_KEY",
        request_timeout=30,
    )
    async with AsyncDaytona(config) as daytona:
        sandbox = await daytona.v2.create(region="us")

if __name__ == "__main__":
    asyncio.run(main())
```

For more information on configuring the Daytona SDK, see [authentication](./authentication.md). See the [`DaytonaConfig` reference](./reference/daytona.md#daytonaconfig) for details.
