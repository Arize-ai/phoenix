# Docker (Python SDK)

Run Docker Engine inside Daytona sandboxes.

Docker is the container platform that builds images and runs containers, and running it inside a sandbox gives each sandbox its own Docker daemon instead of a daemon on a shared host.

Daytona runs Docker Engine inside a sandbox as a full daemon, so the sandbox builds images and runs containers as a regular Linux server does. When the sandbox image ships Docker Engine, the sandbox starts it on every boot. Docker images, containers, and volumes are stored on the sandbox disk, next to the other files of the sandbox.

Use Docker in a sandbox to run multi-container applications, or to let agents run containers without access to a Docker daemon on your own servers. [Captured images](./images.md#capture-images) and [snapshots](./snapshots.md) keep the Docker data of a sandbox. The next sandbox created from them starts with those Docker images and containers already on its disk and does not pull them again.

## Contents

- [Use cases](#use-cases)
- [Start Docker](#start-docker)
- [Get Docker status](#get-docker-status)
- [Wait for Docker](#wait-for-docker)
- [Docker logs](#docker-logs)
- [Docker storage](#docker-storage)
- [Permissions](#permissions)

## Use cases

Docker is used when a sandbox already runs containers or builds container images.

- **Multi-container applications.** An application with a database, a cache, and its services runs in one sandbox. Docker Engine runs inside the sandbox as on a regular Linux server. Every Linux sandbox has storage prepared for Docker, with no create-time option.

- **Image builds.** CI jobs and agents build container images and test them before a push. Image layers are stored on the sandbox disk, with no separate Docker allowance. A larger disk size at create time stores more images.

- **Integration tests.** Tests start databases and other dependencies as containers and remove them after the run. Docker starts after the sandbox is running, so a test waits for Docker before it starts containers. The wait fails at once when Docker is failed, not present, disabled, unmanaged, or unsupported.

- **Agents that run containers.** An agent pulls and runs containers inside the sandbox, with no access to a Docker daemon on your own servers. The sandbox image must ship Docker Engine, because Daytona does not install it. When the image has only the Docker CLI, the Docker status reports not present.

- **Prepared environments.** Images and containers pulled once are kept by a captured image or a snapshot. The next sandbox does not pull them again. Each sandbox created from the captured image or snapshot gets its own copy of the Docker images, containers, and volumes.

## Start Docker

Start Docker to build images and run containers inside a sandbox. Docker Engine runs as a background daemon, and Docker commands send their requests to it over a local socket.

Docker in a sandbox comes from the sandbox image, and starts in the background after the sandbox is running. A Docker failure leaves the sandbox usable.

Create the sandbox from an image that ships Docker Engine, and wait for Docker to become ready before you run Docker commands. A command sent earlier can fail because Docker is not answering yet. If Docker fails, read the [logs](#docker-logs), fix the configuration, and retry.

```python
from daytona import Daytona

daytona = Daytona()

# Register the official Docker-in-Docker image, which ships Docker Engine
image = daytona.v2.images.pull("docker:dind", name="docker-dind")
while image.status not in ("ready", "failed"):
    image = daytona.v2.images.get(image.id, wait="ready")
if image.status == "failed":
    raise RuntimeError(image.error)

sandbox = daytona.v2.create("docker-dind")

# Block until Docker Engine answers, up to 120 seconds
sandbox.docker.wait_until_ready(timeout=120)

response = sandbox.process.run("docker run --rm hello-world")
print(response.stdout)
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the registry reference that pull() registers.<br />**Required**<br />**Format:** an OCI image reference<br />**Example:** `"docker:dind"` |
| `name` | Sets the image name, which the sandbox starts from.<br />**Example:** `"docker-dind"` |
| `timeout` | Sets how many seconds the wait for Docker lasts.<br />**Default:** `60`<br />**Value:** `0` for no deadline<br />**Example:** `120` |

> **Notes:**
>
> - **Prerequisites:** The image must ship Docker Engine.
> - **Order:** Wait for Docker to be ready before you run Docker commands.

### Start modes

A start mode decides which program starts a service when a sandbox boots, and which program only waits for the service. A container image can start Docker from its own entrypoint, or leave the start of Docker to the sandbox that runs the image.

The Docker start mode is an environment variable that a sandbox reads once per boot. It decides whether the sandbox or the image starts Docker.

Choose how Docker starts when you create the sandbox. The value is case-insensitive, and an unset, empty, or unknown value selects the default automatic mode. Automatic mode does not recognize an entrypoint that starts the daemon another way, such as through a shell command or a process supervisor. The sandbox then starts its own daemon first and the entrypoint's daemon typically fails against it, so set the entrypoint mode for these images.

| **Item**                  | **Value**                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Recognized entrypoint** | `dockerd` with any arguments.                                                                             |
| **Recognized entrypoint** | `dockerd-entrypoint.sh` with no arguments, a flag as the first argument, or `dockerd` as the first argument. |
| **Recognized entrypoint** | `docker-entrypoint.sh` with `dockerd` or `dockerd-entrypoint.sh` as the first argument.                   |
| **Daemon search path**    | `/usr/local/bin`, `/usr/bin`, `/usr/sbin`, `/bin`, and `/sbin`.                                           |
| **Sandbox `PATH`**        | Not searched for the daemon.                                                                              |

| **Value**            | **Behavior**                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto` (default) | A recognized Docker entrypoint starts Docker, and the sandbox only waits for it. Otherwise, when the image has `dockerd` in the daemon search path, the sandbox starts it as root and waits for it before the image entrypoint starts. |
| `entrypoint`     | The image entrypoint starts Docker. The sandbox only waits for the socket and never starts `dockerd` itself.                                                                                                                 |
| `off`            | The sandbox neither starts nor waits for Docker, and the state is `disabled`. The image entrypoint still runs, so a recognized Docker entrypoint still starts Docker; the state is then `unmanaged` with owner `entrypoint`. |

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(
    "docker-dind",
    env={"DAYTONA_DOCKER_START": "entrypoint"},
)
```

| **Parameter** | **Description** |
| --- | --- |
| `env` | Sets environment variables inside the sandbox.<br />**Format:** names of letters, digits, and underscores that do not start with a digit<br />**Example:** `{"DAYTONA_DOCKER_START": "entrypoint"}` |
| `image` | Sets the registered image that the sandbox starts from.<br />**Format:** an image name or ID<br />**Example:** `"docker-dind"` |

## Get Docker status

Get the Docker status to learn whether Docker is ready to run commands. A service status reports where a service is in its startup and, when the service is not ready, the reason.

The Docker status of a sandbox describes where Docker is in the current boot of the sandbox. Reading the status never starts or restarts Docker.

Get the status before you run Docker commands, or after a failure to find its reason. The status is returned immediately. To block until Docker is ready, [wait for Docker](#wait-for-docker) instead.

| **Field**                                | **Description**                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `state`                              | Where Docker is in its startup. See the table below.                                        |
| `owner`                              | Who starts Docker: `daemon` (the sandbox), `entrypoint` (the image), or `none`. |
| `reason`                             | Why the state is what it is, such as a failure cause; `null` when there is nothing to add.  |
| `processId` (`process_id` in Python) | The process with Docker's output, or `null`.                                                |

| **State**             | **Meaning**                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`ready`**           | The Docker socket answers. Docker commands work.                                                                                                                         |
| **`starting`**        | Docker is being started or waited for.                                                                                                                                   |
| **`deferred`**        | Docker startup has not run yet in this boot (reason `gate-closed`), or it is skipped for the whole boot (reason `function-ready-template`).                              |
| **`failed`**          | Docker did not come up (start failure, early exit, or the 30-second timeout), or it exited later (reason `exited`). The sandbox stays usable.                             |
| **`not_present`**     | The image has no `dockerd`. The reason is `cli-only` when the image has only the `docker` CLI.                                                                           |
| **`disabled`**        | `DAYTONA_DOCKER_START` is `off`.                                                                                                                                         |
| **`unmanaged`**       | `DOCKER_HOST` points to a non-local engine, or `DAYTONA_DOCKER_START` is `off` and a recognized Docker entrypoint starts Docker. The sandbox does not check that engine. |
| **`unsupported`**     | Docker storage could not be prepared, for example because the image ships a non-empty `/var/lib/docker`, or the sandbox type has no Docker support.                    |

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create("docker-dind")

status = sandbox.docker.status()
print(status.state, status.owner, status.reason, status.process_id)
```

## Wait for Docker

Wait for Docker to block until it is ready to accept commands. A program that depends on a service checks the service until it answers, or gives up after a time limit.

A wait for Docker in a sandbox ends when Docker is ready, or when Docker reaches a state from which it cannot become ready in the current boot.

Wait for Docker after the sandbox starts and before the first Docker command that runs in the sandbox. The wait polls the Docker status and returns once Docker is ready. It fails at once when Docker is failed, not present, disabled, unmanaged, or unsupported. It fails with a timeout when Docker is not ready by the end of the time budget.

```python
from daytona import Daytona
from daytona.v2 import DockerNotReadyError, DockerWaitTimeoutError

daytona = Daytona()
sandbox = daytona.v2.create("docker-dind")

try:
    status = sandbox.docker.wait_until_ready(timeout=120)
except DockerNotReadyError as e:
    print("Docker cannot start:", e.status.state, e.status.reason)
except DockerWaitTimeoutError as e:
    print("Docker is still starting:", e.status)
```

| **Parameter** | **Description** |
| --- | --- |
| `timeout` | Sets how many seconds the wait lasts.<br />**Default:** `60`<br />**Value:** `0` for no deadline<br />**Example:** `120` |

> **Notes:**
>
> - **Polling:** The wait also ends when Docker is `failed`, `not_present`, `disabled`, `unmanaged`, or `unsupported`, because these states do not become `ready` in the current boot. The wait keeps polling while Docker is `deferred`, and Docker deferred with reason `function-ready-template` stays deferred for the whole boot.

## Docker logs

Docker logs are the output that the Docker daemon writes while it starts and runs, including the errors that stop it from starting or that make it exit later. A daemon runs in the background with no terminal, so its logs are the main record of what it did and why it failed.

The output of Docker in a sandbox is kept in the logs of the process that runs Docker, and the Docker status of the sandbox names that process.

Read the logs when the Docker status reports a failure. When the sandbox starts Docker itself, the process has the fixed name in the examples below, and its logs stay readable after Docker exits. When the image entrypoint starts Docker, its output is in the entrypoint's logs.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create("docker-dind")

status = sandbox.docker.status()
if status.process_id:
    handle = sandbox.process.connect(status.process_id)
    for frame in handle.logs().items:
        print(f"[{frame.channel}]: {frame.data}")
```

| **Parameter** | **Description** |
| --- | --- |
| `process` | Sets the process whose logs to read.<br />**Required**<br />**Format:** a process ID or alias<br />**Example:** `"dockerd"` |

> **Notes:**
>
> - **Results:** When the owner is `entrypoint`, Docker's output is in the logs of the image entrypoint.
> - **Behaviour:** When the status owner is `daemon`, the process alias `dockerd` stays readable after Docker exits.

## Docker storage

Docker storage is the directory tree where Docker keeps image layers, containers, and volumes. Rootful Docker keeps it at standard paths on the disk of the sandbox it runs on.

Docker data in a sandbox lives on its disk, at the standard paths for rootful Docker. Docker shares that disk with everything else in the sandbox, with no separate Docker allowance.

Raise the sandbox disk size at create time to store more images or containers. If either Docker storage path is not empty in the image, or is a symbolic link, the contents are left untouched and Docker storage is not prepared. The Docker storage state then reports it as unsupported, and images that preload Docker data this way are not supported.

| **Path**                  | **Contents**                                                    |
| ------------------------- | --------------------------------------------------------------- |
| **`/var/lib/docker`**     | Docker's image layers, containers, and local volumes.           |
| **`/var/lib/containerd`** | containerd's image content, used by Docker Engine 29 and later. |

### Persistence

Persistence is whether data outlives the process that wrote it. Data held in memory ends with its process, while data written to disk stays until something deletes it.

Docker data is part of the sandbox disk, so it follows the [persistence](./persistence.md) of the sandbox.

Use a captured image or a snapshot to start new sandboxes with Docker data already in place. A boot from a captured image is a reboot: running containers come back stopped and restart per their restart policy. To resume running containers with processes intact, use a snapshot.

| **Operation**                 | **Docker data**                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Images and snapshots**      | Each sandbox created from a [captured image](./images.md#capture-images) or a [snapshot](./snapshots.md#restore-snapshots) gets its own copy of the source's Docker images, containers, and volumes, and can create new ones. |

## Permissions

Docker access runs through the toolbox of a sandbox. Access is governed by one project permission, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

A [sandbox access token](./sandboxes.md#create-an-access-token) with the toolbox operation grants the same access to a single sandbox, without an API key. The sandbox read permission alone does not grant toolbox access.

| **Permission**        | **Grants**                                      |
| --------------------- | ----------------------------------------------- |
| **`write:sandboxes`** | Start Docker, get its status, and read its logs |
