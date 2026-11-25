# Python SDK

Install, configure, and use the Python SDK to manage sandboxes from Python.

The Python SDK is a Python library for managing sandboxes from code. It lets a Python program or agent control the lifecycle of a sandbox without writing HTTP requests.

Daytona provides the Python SDK as a synchronous root client and an asynchronous root client with the same methods. Each root client reaches the platform through a version namespace, one for the v2 platform and one for the v0 platform, and builds every namespace client itself. The client holds one credential for both namespaces. It keeps its network connections open until the program closes it.

Use the Python SDK to run sandboxes from Python 3.10 or later, or use the [TypeScript SDK](../typescript-sdk/README.md), the [CLI](../cli/README.md), or the [API](../api/README.md) from other languages. Send every new operation through the v2 namespace, and use the v0 namespace only for code that still depends on the v0 platform. Import resource types, such as Sandbox and ImageBuilder, from daytona.v2.

| **Concept**              | **Description**                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------- |
| **Root client**          | The object a program creates first, which holds the credential and the connections.   |
| **Asynchronous client**  | A client whose methods are coroutines that a program awaits instead of blocking on.   |
| **Version namespace**    | The part of a client that targets one version of the platform interface.              |
| **Client configuration** | The credential and connection settings that a client is created with.                 |

## Contents

- [Install the Python SDK](#install-the-python-sdk)
- [Configure the client](#configure-the-client)
- [Create a sandbox](#create-a-sandbox)
- [Reference](#reference)

## Install the Python SDK

Install the Python SDK to call sandboxes from a Python program. An installation downloads a package and its dependencies into a Python environment.

An installation of the Python SDK holds both version namespaces in one package. Optional extras add the libraries for request tracing and for the v0 namespace.

Install the package with pip into Python 3.10 or later. Add the otel extra to emit OpenTelemetry request spans, or the v0-sdk extra to use the v0 namespace.

**CLI:**

```bash
# The SDK
pip install "daytona>=2,<3"

# With OpenTelemetry request spans
pip install "daytona[otel]>=2,<3"

# With the v0 namespace
pip install "daytona[v0-sdk]>=2,<3"
```

## Configure the client

Configure the client to choose its credential and how it connects to the platform. A configuration is the set of values that a program starts with instead of values written into its code.

A client configuration is copied when the root client is created, so later changes to it have no effect on that client.

Configure the client in code, or leave a field unset to read it from the environment, as [authentication](./authentication.md) describes. Set exactly one credential: an API key, or a JWT scoped to a project for v2 or to an organization for v0. The configuration has no API URL or region field, so pass the region to each v2 create. The [DaytonaConfig reference](./reference/daytona.md#daytonaconfig) lists every field.

**Sync:**

```python
from daytona import Daytona, DaytonaConfig

# Using environment variables (DAYTONA_API_KEY)
with Daytona() as daytona:
    sandbox = daytona.v2.create()
    daytona.v2.delete(sandbox)

# Using explicit configuration
config = DaytonaConfig(
    api_key="YOUR_API_KEY",
    request_timeout=30,
)
with Daytona(config) as daytona:
    sandbox = daytona.v2.create(region="us")
    daytona.v2.delete(sandbox)
```

| **Parameter**             | **Description**                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `api_key`                 | Sets the project API key.<br />**Default:** the value of DAYTONA_API_KEY                                          |
| `jwt_token`               | Sets the JWT of a signed-in user, which the client exchanges for a short-lived project token.<br />**Default:** the value of DAYTONA_JWT_TOKEN |
| `project_id`              | Scopes the JWT to a project for daytona.v2.<br />**Default:** the value of DAYTONA_PROJECT_ID                     |
| `organization_id`         | Scopes the JWT to an organization for daytona.v0.<br />**Default:** the value of DAYTONA_ORGANIZATION_ID           |
| `request_timeout`         | Sets the total time of one daytona.v2 request, in seconds.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `30` |
| `connection_pool_maxsize` | Sets the maximum number of live and keep-alive HTTP connections.<br />**Format:** a positive integer              |
| `otel_enabled`            | Emits client spans when the otel extra is installed.<br />**Default:** the value of DAYTONA_OTEL_ENABLED           |
| `target`                  | Sets the default region of daytona.v0, and is deprecated.                                                         |

> **Notes:**
>
> - The DAYTONA_V2_API_URL environment variable selects the daytona.v2 API endpoint, and the SDK ignores DAYTONA_API_URL.

**Async:**

```python
import asyncio
from daytona import AsyncDaytona, DaytonaConfig

async def main():
    # Using environment variables (DAYTONA_API_KEY)
    async with AsyncDaytona() as daytona:
        sandbox = await daytona.v2.create()
        await daytona.v2.delete(sandbox)

    # Using explicit configuration
    config = DaytonaConfig(
        api_key="YOUR_API_KEY",
        request_timeout=30,
    )
    async with AsyncDaytona(config) as daytona:
        sandbox = await daytona.v2.create(region="us")
        await daytona.v2.delete(sandbox)

if __name__ == "__main__":
    asyncio.run(main())
```

| **Parameter**             | **Description**                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `api_key`                 | Sets the project API key.<br />**Default:** the value of DAYTONA_API_KEY                                          |
| `jwt_token`               | Sets the JWT of a signed-in user, which the client exchanges for a short-lived project token.<br />**Default:** the value of DAYTONA_JWT_TOKEN |
| `project_id`              | Scopes the JWT to a project for daytona.v2.<br />**Default:** the value of DAYTONA_PROJECT_ID                     |
| `organization_id`         | Scopes the JWT to an organization for daytona.v0.<br />**Default:** the value of DAYTONA_ORGANIZATION_ID           |
| `request_timeout`         | Sets the total time of one daytona.v2 request, in seconds.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `30` |
| `connection_pool_maxsize` | Sets the maximum number of live and keep-alive HTTP connections.<br />**Format:** a positive integer              |
| `otel_enabled`            | Emits client spans when the otel extra is installed.<br />**Default:** the value of DAYTONA_OTEL_ENABLED           |
| `target`                  | Sets the default region of daytona.v0, and is deprecated.                                                         |

> **Notes:**
>
> - The DAYTONA_V2_API_URL environment variable selects the daytona.v2 API endpoint, and the SDK ignores DAYTONA_API_URL.

## Create a sandbox

Create a sandbox to run code in an isolated virtual machine. Creation provisions a resource and returns a handle to it once the resource is ready.

A creation of a sandbox returns a sandbox object that the program uses for every later call on that sandbox. Its calls go through the client that created it, so they stop working once that client closes.

Create the sandbox inside a with block, so the root client closes its connections when the block ends. Close the root client, not the v2 namespace: a namespace client closed on its own stays cached and fails on later calls.

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

| **Parameter**  | **Description**                                                                   |
| -------------- | --------------------------------------------------------------------------------- |
| `wait_seconds` | Sets how long the create waits for the sandbox to start, in seconds.<br />**Default:** `60` |

> **Notes:**
>
> - The root client reads the API key from the DAYTONA_API_KEY environment variable when the code passes no configuration.

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

| **Parameter**  | **Description**                                                                   |
| -------------- | --------------------------------------------------------------------------------- |
| `wait_seconds` | Sets how long the create waits for the sandbox to start, in seconds.<br />**Default:** `60` |

> **Notes:**
>
> - The root client reads the API key from the DAYTONA_API_KEY environment variable when the code passes no configuration.

## Reference

A library reference is the documentation of every class, method, and type that a library exposes. It is generated from the source code of the library, so it matches the released package.

The reference of the Python SDK has one page for each part of the client, from the root client to its error types.

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
