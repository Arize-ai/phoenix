# Linux Sandboxes (Python SDK)

Linux virtual machine sandboxes, their capabilities, use cases, and architecture.

Linux sandboxes are **Linux virtual machines (VMs)**. Each sandbox is a virtual machine, a microVM, that runs its own Linux kernel on shared physical hardware and has its own operating system, files, network connection, and fixed amount of processor, memory, and disk. The hardware enforces the boundary and isolation between sandboxes.

Daytona runs each Linux sandbox as a Firecracker microVM with its own guest kernel, on a host it shares with other sandboxes. Code inside it sees a Linux operating system with a shell, filesystem, and network, and nothing of the host or other sandboxes. Its filesystem and memory live on the host while the sandbox exists. Deleting the sandbox or losing the host discards both.

Use Linux sandboxes to run code from AI agents, coding agents, reinforcement learning environments, and users in isolation from your infrastructure and from each other.

| **Component**  | **Description**                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **Sandbox**    | An isolated Linux machine that runs code.                                                                      |
| **Host**       | The physical server that runs many sandboxes at once.                                                          |
| **Guest**      | The operating system that runs inside a sandbox, as opposed to the operating system of the host.               |
| **Kernel**     | The core of an operating system, which manages memory, processes, files, and devices.                          |
| **Hypervisor** | Software on the host that creates virtual machines and keeps them separated from each other and from the host. |
| **Image**      | A packaged filesystem that defines what software a sandbox starts with.                                        |
| **Snapshot**   | A saved copy of the memory and disk of a sandbox at one point in time.                                         |

## Contents

- [Use cases](#use-cases)
- [Connect to the API](#connect-to-the-api)
- [Create a Linux sandbox](#create-a-linux-sandbox)
- [Resources](#resources)
- [Regions](#regions)
- [Lifecycle](#lifecycle)
- [Persistence](#persistence)
- [Snapshots](#snapshots)
- [Images](#images)
- [CPU architectures](#cpu-architectures)
- [CPU types](#cpu-types)
- [Spot](#spot)
- [Volumes](#volumes)
- [Network](#network)
- [Ports](#ports)
- [Secrets](#secrets)
- [Names](#names)
- [Labels](#labels)
- [Idempotency](#idempotency)
- [Logs](#logs)
- [Permissions](#permissions)

## Use cases

Sandboxes are used wherever code must run in a real environment, but you cannot trust the code or you cannot afford for it to affect anything else.

- **Code execution for AI agents.** An agent writes code, runs it in a sandbox, reads the output, and decides what to do next. The sandbox gives the agent a real shell and filesystem while keeping its actions away from your infrastructure. Once the agent is done, a delete discards the sandbox's filesystem and memory.

- **Coding agents.** An agent clones a repository, installs dependencies, edits files, runs the test suite, and opens a pull request, all inside one sandbox. The sandbox keeps its filesystem on its host until it is deleted. A filesystem snapshot saves that filesystem as an image, and new sandboxes boot from it with the captured files.

- **Reinforcement learning (RL).** Training runs create very large numbers of identical environments, run one episode in each, score the result, and discard the environment. Fast creation from a shared snapshot keeps the cost of each environment low. A restored sandbox resumes the captured processes and memory instead of booting.

- **Untrusted user code.** Online coding platforms, grading systems, and plugin hosts run code submitted by users without exposing other users or the service. Each sandbox is a microVM with its own Linux kernel. The hardware enforces the boundary between sandboxes.

- **Development environments.** A developer gets a preconfigured machine from an image, connects over SSH or from an editor, and previews web applications through a URL. Requests through SSH, VNC, and preview URLs count as activity for the idle timeout. A reset of the idle timer keeps the sandbox alive during work that Daytona does not count as activity.

## Connect to the API

Connect to the API to send the requests that create and manage sandboxes. A connection to a service needs its address and a credential, and reading both from the environment keeps them out of the source code that calls the service.

Linux sandboxes live behind the Daytona API, which the SDKs and the CLI connect to by default. It authenticates with a project API key.

Connect before you create a Linux sandbox programmatically. [Create a project API key](./api-keys.md#create-an-api-key) from the dashboard, then set it in the [environment](./authentication.md#environment-variables). Install SDK 2.x and the latest CLI with the commands in the tabs.

| **Service**     | **Address**                   |
| --------------- | ----------------------------- |
| **Dashboard**   | **`https://app.daytona.com`** |
| **Daytona API** | **`https://api.daytona.com`** |

```python
from daytona import Daytona

daytona = Daytona()  # reads DAYTONA_API_KEY
```

> **Notes:**
>
> - **Prerequisites:** The SDK must be installed with `pip install "daytona>=2,<3"`, on Python 3.10 or later. The environment must set DAYTONA_API_KEY to a project API key. DAYTONA_V2_API_URL can stay unset, because the SDK defaults to `https://api.daytona.com`.
> - **Compatibility:** The SDK takes memory and disk in GiB and every timeout in seconds.
> - **Clients:** AsyncDaytona has the same methods, called with await.

## Create a Linux sandbox

Create a Linux sandbox to get a microVM: a virtual machine placed on a host that boots a guest kernel with a root filesystem from an image. A microVM provides only the devices a server needs, so many of them fit on one host at the same time.

A Linux sandbox is the default sandbox type: a Firecracker microVM with a fixed amount of processor, memory, and disk reserved for it on its host. It starts from the files and configuration of its [image](./images.md), so every sandbox created from the same image begins in the same state. Packages it installs and files it writes after boot stay in that sandbox only.

Create a Linux sandbox from the dashboard or programmatically. The sections below set its image, CPU, resources, region, timeouts, persistence, and the other options of a create.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.com/dashboard/sandboxes)
2. Click **Create**
3. Select **Linux sandbox**
4. Click **Create**

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
```

| **Parameter** | **Description** |
| --- | --- |
| `cpu_arch` | Sets the CPU architecture.<br />**Default:** the region's default architecture, or `amd64` if the region sets none<br />**Value:** `amd64` or `arm64`<br />**Example:** `"arm64"` |
| `create_timeout_seconds` | Sets how many seconds the sandbox has to reach running before it is deleted.<br />**Default:** `3600`<br />**Minimum:** `1`<br />**Maximum:** `86400`<br />**Value:** `-1` for the maximum<br />**Example:** `600` |
| `env` | Sets environment variables inside the sandbox.<br />**Format:** names of letters, digits, and underscores that do not start with a digit, and values of at most 64 KiB<br />**Example:** `{"LOG_LEVEL": "debug"}` |
| `idempotency_key` | Makes a retried create return the same sandbox.<br />**Default:** a key derived from name if set, otherwise a new key for each call<br />**Minimum:** 1 character<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `"run-42-create"` |
| `image` | Sets the registered image that the sandbox starts from.<br />**Default:** the platform image whose default field is true in the [image list](./images.md#list-images)<br />**Format:** an image name or ID<br />**Example:** `"python-3.12-slim"` |
| `labels` | Attaches key-value metadata to the sandbox.<br />**Maximum:** 100 labels<br />**Format:** a non-empty key and a value of at most 512 bytes each<br />**Example:** `{"team": "research"}` |
| `lifecycle_policy` | Sets the timeouts of the sandbox.<br />**Example:** `{"timeout_seconds": 3600, "on_timeout": "delete"}` |
| `timeout_seconds` | Sets the wall-clock lifetime of the sandbox in seconds.<br />**Default:** the project or platform default, if one is enabled<br />**Minimum:** `1`<br />**Maximum:** `86400`, unless the organization or its plan sets a different maximum |
| `on_timeout` | Sets the action when the timeout elapses.<br />**Default:** `"delete"`<br />**Value:** `"delete"` |
| `idle_expiry_seconds` | Sets the seconds without activity before the idle action fires.<br />**Default:** none, unless the project sets one<br />**Minimum:** `60`<br />**Maximum:** `2147483647` |
| `on_idle_timeout` | Sets the action when the idle timeout elapses.<br />**Value:** `"delete"` |
| `name` | Sets the display name.<br />**Default:** a generated name, sandbox- followed by 8 hexadecimal characters<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-<br />**Example:** `"my-sandbox"` |
| `network_policy` | Sets the outbound network policy.<br />**Example:** `{"block_all": True, "allow_domains": ["pypi.org"]}` |
| `block_all` | Denies all egress that is not explicitly allowed.<br />**Default:** `True` when allow_domains is set, otherwise `False` |
| `allow_domains` | Allows egress to hostnames or wildcard domains.<br />**Maximum:** 128 domains and CIDR blocks combined<br />**Format:** hostnames, or wildcard domains, which match their subdomains only<br />**Example:** `["pypi.org", "*.github.com"]` |
| `allow_cidrs` | Allows egress to IPv4 addresses or CIDR blocks, on any port.<br />**Maximum:** 128 domains and CIDR blocks combined<br />**Format:** public IPv4 addresses or CIDR blocks<br />**Example:** `["1.1.1.1/32"]` |
| `ports` | Forwards inbound ports to the sandbox.<br />**Maximum:** 32 mappings<br />**Format:** PortMapping objects with a port from `1` to `65535` and a proto of `tcp` or `udp`, which defaults to `tcp`<br />**Example:** `[PortMapping(port=8080)]` |
| `region` | Sets the region.<br />**Default:** the project's default region, then the organization's, then `earth`<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, `us-east-iad-1`, or the ID of a [BYOC region](./bring-your-own-compute.md) of the organization<br />**Example:** `"earth"` |
| `resources` | Sets the guaranteed and maximum CPU, memory, and disk of the sandbox.<br />**Example:** `Resources(cpu=2, memory=4)` |
| `cpu` | Sets the guaranteed CPU in cores.<br />**Default:** one core per 8 GiB of guaranteed memory, at least `0.5`<br />**Minimum:** `0.125`<br />**Maximum:** the CPU limit |
| `memory` | Sets the guaranteed memory in GiB.<br />**Default:** `1`<br />**Minimum:** `0.5`<br />**Maximum:** the memory limit |
| `disk` | Sets the guaranteed writable disk in GiB.<br />**Default:** `0.5`, or `10` when the CPU or memory guarantee is set<br />**Minimum:** `10`<br />**Maximum:** the disk limit |
| `cpu_max` | Sets the CPU limit in cores.<br />**Default:** the [sandbox limit](./limits.md#sandbox-limits)<br />**Minimum:** `0.5`<br />**Maximum:** the [sandbox limit](./limits.md#sandbox-limits)<br />**Format:** a multiple of `0.5` |
| `memory_max` | Sets the memory limit in GiB.<br />**Default:** the [sandbox limit](./limits.md#sandbox-limits)<br />**Minimum:** `0.25`<br />**Maximum:** the [sandbox limit](./limits.md#sandbox-limits) |
| `disk_max` | Sets the writable disk limit in GiB.<br />**Default:** the [sandbox limit](./limits.md#sandbox-limits)<br />**Minimum:** `0.5`<br />**Maximum:** the [sandbox limit](./limits.md#sandbox-limits) |
| `secrets` | Attaches project secrets by name.<br />**Example:** `["GITHUB_TOKEN"]` |
| `spot` | Places the sandbox on discounted, reclaimable capacity.<br />**Default:** `False` |
| `user` | Sets the default OS user inside the sandbox.<br />**Default:** the image's USER, or `root` if the image sets none, sets root, or sets a numeric user ID<br />**Format:** a lowercase letter or underscore, followed by up to 31 lowercase letters, digits, underscores, periods, or hyphens<br />**Example:** `"daytona"` |
| `volumes` | Attaches volumes to the sandbox.<br />**Maximum:** 8 volumes<br />**Example:** `[VolumeMount(volume_id="my-volume", mount_path="/data")]` |
| `volume_id` | Sets the volume to attach.<br />**Required**<br />**Format:** a volume name or ID<br />**Example:** `"my-volume"` |
| `mount_path` | Sets the directory where the volume is mounted.<br />**Required**<br />**Format:** an absolute path with no .. component, other than / and not on or beneath /bin, /boot, /dev, /etc, /lib, /lib32, /lib64, /mnt/scratch, /overlay, /proc, /sbin, /sys, or /usr<br />**Example:** `"/data"` |
| `wait_seconds` | Sets how many seconds create waits for the sandbox to start.<br />**Default:** `60`<br />**Value:** `0` for no wait<br />**Example:** `120` |

## Resources

Resources are the processor cores, memory, and disk space that a sandbox reserves to run code.

| **Linux** | **Default** | **Minimum** | **Maximum** |
| --- | --- | --- | --- |
| **CPU** | 0.5 cores | 0.125 cores | [Limits](./limits.md#sandbox-limits) |
| **Memory** | 1 GiB (1024 MiB) | 0.5 GiB (512 MiB) | [Limits](./limits.md#sandbox-limits) |
| **Disk** | 0.5 GiB (512 MiB)<br />or 10 GiB (10240 MiB) when CPU or memory is set | 10 GiB (10240 MiB) | [Limits](./limits.md#sandbox-limits) |

```python
from daytona import Daytona
from daytona.v2 import Resources

daytona = Daytona()
sandbox = daytona.v2.create(
    resources=Resources(cpu=2, memory=4, disk=20, cpu_max=4, memory_max=8, disk_max=40),
)
```

| **Parameter** | **Description** |
| --- | --- |
| `resources` | Sets the guaranteed and maximum CPU, memory, and disk of the sandbox.<br />**Example:** `Resources(cpu=2, memory=4)` |
| `cpu` | Sets the guaranteed CPU in cores.<br />**Default:** one core per 8 GiB of guaranteed memory, at least `0.5`<br />**Minimum:** `0.125`<br />**Maximum:** the CPU limit |
| `memory` | Sets the guaranteed memory in GiB.<br />**Default:** `1`<br />**Minimum:** `0.5`<br />**Maximum:** the memory limit |
| `disk` | Sets the guaranteed writable disk in GiB.<br />**Default:** `0.5`, or `10` when the CPU or memory guarantee is set<br />**Minimum:** `10`<br />**Maximum:** the disk limit |
| `cpu_max` | Sets the CPU limit in cores.<br />**Default:** the [sandbox limit](./limits.md#sandbox-limits)<br />**Minimum:** `0.5`<br />**Maximum:** the [sandbox limit](./limits.md#sandbox-limits)<br />**Format:** a multiple of `0.5` |
| `memory_max` | Sets the memory limit in GiB.<br />**Default:** the [sandbox limit](./limits.md#sandbox-limits)<br />**Minimum:** `0.25`<br />**Maximum:** the [sandbox limit](./limits.md#sandbox-limits) |
| `disk_max` | Sets the writable disk limit in GiB.<br />**Default:** the [sandbox limit](./limits.md#sandbox-limits)<br />**Minimum:** `0.5`<br />**Maximum:** the [sandbox limit](./limits.md#sandbox-limits) |

## Regions

[Regions](./regions.md) are geographic or logical areas in which sandboxes run. Every sandbox runs in a region. A create request can name one, and Daytona places the sandbox on capacity there.

| **Region** | **ID** | **Multiplier** |
| --- | --- | --- |
| **Earth** | `earth` | 1.0× |
| `└─` **United States** | `us` | 1.15× |
| `   └─` **US East** | `us-east` | 1.75× |
| `      ├─` **Ashburn** | `us-east-ash-1` | 2.0× |
| `      ├─` **Boston** | `us-east-bos-1` | 2.0× |
| `      └─` **N. Virginia** | `us-east-iad-1` | 2.0× |

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(region="earth")
```

## Lifecycle

A sandbox lifecycle is the set of states that a sandbox moves through from creation to deletion. A sandbox changes state when a user acts on it, or on its own when a timeout elapses. The actions it accepts, and what it keeps across them, depend on its type.

| **Lifecycle**              | **Linux** |
| -------------------------- | --------- |
| **Stop and start**         | ✗         |
| **Pause and resume**       | ✗         |
| **Fork**                   | ✗         |
| **Delete**                 | ✓         |
| **Filesystem persistence** | ✗         |
| **Memory persistence**     | ✗         |
| **Spot (Preemption)**      | ✓         |

**Sandbox states:**

| **State**        | **API status**                 | **Description**                                                                 |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| **`queued`**     | **`queued`**                   | The create request is recorded and waits for its image before it is published for placement. |
| **`creating`**   | **`pending`**, **`assigned`**  | The sandbox waits for a host, and the host it is placed on prepares its image.  |
| **`starting`**   | **`booting`**                  | The microVM is booting and will be ready to use.                                |
| **`started`**    | **`running`**                  | The sandbox is running and ready to accept requests.                            |
| **`destroying`** | **`deleting`**                 | The sandbox is being deleted.                                                   |
| **`destroyed`**  | **`deleted`**                  | The sandbox and its storage are removed.                                        |
| **`error`**      | **`failed`**, **`lost`**       | The image build, create, or boot failed, or the host or microVM of the sandbox was lost. |
| **`unknown`**    |                                | The SDK does not recognize the status the API reports.                          |

**State transitions:**

| **Initial state** | **Target state** | **Trigger**                                                                        |
| ----------------- | ---------------- | ---------------------------------------------------------------------------------- |
| **`queued`**      | **`creating`**   | The image is ready and the create request is published for placement.             |
| **`creating`**    | **`starting`**   | The host has prepared the image and boots the microVM.                             |
| **`starting`**    | **`started`**    | The sandbox finishes booting and accepts requests.                                 |
| **`creating`**, **`starting`**, **`started`** | **`destroying`** | A delete is requested, a timeout elapses, or the platform reclaims a spot sandbox. |
| **`queued`**, **`creating`**, **`error`** | **`destroyed`** | A delete is requested for a sandbox with no running microVM, so it skips **`destroying`**. |
| **`started`**     | **`destroyed`**  | The microVM shuts down on its own.                                                 |
| **`destroying`**  | **`destroyed`**  | The sandbox is removed and its resources are released.                             |
| **`queued`**, **`creating`**, **`starting`** | **`error`** | The image build, create, or boot fails.                               |
| **`creating`**, **`starting`**, **`started`**, **`destroying`** | **`error`** | The host of the sandbox is lost.                       |

### Wait for state

Wait for a sandbox to reach a state before a step that needs that state. A wait is a call that blocks until a resource reaches a target state or a time limit passes, without polling.

A wait on a Linux sandbox returns as soon as the sandbox reaches one of the target states. It stops early in a state from which the target is unreachable, such as the error or destroyed state.

Wait for the started state after a create that returns at once. The SDKs use the states in the [sandbox states](#lifecycle) table, so their started state matches the running status the CLI and API report.

```python
from daytona import Daytona

daytona = Daytona()

# Return from create without waiting for the sandbox to start
sandbox = daytona.v2.create(wait_seconds=0)

# Block until the sandbox is started; returns the sandbox
sandbox.wait(until="started", timeout=60)

# Block until the sandbox is in one of the listed states
sandbox.wait(until=["starting", "started"], timeout=60)
```

| **Parameter** | **Description** |
| --- | --- |
| `timeout` | Sets the wait limit in seconds.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `120` |
| `until` | Sets one state or a list of states, and wait() returns on any of them.<br />**Default:** `"started"`<br />**Value:** `queued`, `starting`, `started`, `pausing`, `paused`, `stopping`, `stopped`, `destroying`, or `destroyed`<br />**Example:** `"stopped"` |

### Timeouts

Timeouts are timers that end a sandbox automatically after a set interval. They keep a sandbox that fails to start, outlives its work, or goes unused from holding resources.

A Linux sandbox has three timeouts, and each one deletes the sandbox when it elapses. The create timeout limits how long the sandbox has to start running, the lifetime timeout limits how long it exists after it starts, and the idle timeout limits how long it goes without activity. Requests, connections, and running commands count as activity and restart the idle countdown.

Set a create timeout to delete a sandbox that does not start in time. Set a lifetime timeout to cap how long it runs, and an idle timeout to delete it once unused. Without the last two, the project's [lifecycle defaults](./projects.md#lifecycle-defaults) apply. Change them later with an [update](#update).

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(
    create_timeout_seconds=600,
    lifecycle_policy={
        "timeout_seconds": 86400,
        "on_timeout": "delete",
        "idle_expiry_seconds": 3600,
        "on_idle_timeout": "delete",
    },
)
```

| **Parameter** | **Description** |
| --- | --- |
| `create_timeout_seconds` | Sets how many seconds the sandbox has to reach running before it is deleted.<br />**Default:** `3600`<br />**Minimum:** `1`<br />**Maximum:** `86400`<br />**Value:** `-1` for the maximum<br />**Example:** `600` |
| `lifecycle_policy` | Sets the timeouts of the sandbox.<br />**Example:** `{"timeout_seconds": 3600, "on_timeout": "delete"}` |
| `timeout_seconds` | Sets the wall-clock lifetime of the sandbox in seconds.<br />**Default:** the project or platform default, if one is enabled<br />**Minimum:** `1`<br />**Maximum:** `86400`, unless the organization or its plan sets a different maximum |
| `on_timeout` | Sets the action when the timeout elapses.<br />**Default:** `"delete"`<br />**Value:** `"delete"` |
| `idle_expiry_seconds` | Sets the seconds without activity before the idle action fires.<br />**Default:** none, unless the project sets one<br />**Minimum:** `60`<br />**Maximum:** `2147483647` |
| `on_idle_timeout` | Sets the action when the idle timeout elapses.<br />**Value:** `"delete"` |

##### Reset the idle timer

Reset the idle timer to count a sandbox as active without sending it a request. An idle timer measures the time since the last activity and fires its action when that time reaches the idle timeout.

A reset of the idle timer of a Linux sandbox counts as activity, so the idle timeout counts again from the reset. The lifetime timeout keeps its deadline. A reset works in every state except deleting and deleted, and a sandbox without an idle timeout returns no idle deadline.

Reset the idle timer during work that does not count as activity, such as a job outside the sandbox that returns to it later. To change the length of the idle timeout instead, [update](#update) the sandbox. A reset needs a project API key, so code inside the sandbox cannot keep its own sandbox running with a sandbox token.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(lifecycle_policy={"idle_expiry_seconds": 3600, "on_idle_timeout": "delete"})

lifecycle = sandbox.reset_idle_timer()
print(lifecycle.last_activity_at, lifecycle.idle_timeout_at)
```

### Update

Update a sandbox to change its timeouts after it is created. An update is a partial change to an existing resource: it sets the fields it names and keeps the rest.

An update of a Linux sandbox changes its lifetime and idle timeouts in place, without recreating the sandbox. A new lifetime timeout counts from the update, not from the start of the sandbox.

Update a sandbox to move its lifetime timeout, or to set or clear its idle timeout. Both [timeouts](#timeouts) only delete, and updating a deleting or deleted sandbox fails.

```python
from daytona import Daytona
from daytona.v2 import DISABLED

daytona = Daytona()
sandbox = daytona.v2.create()

# Delete the sandbox after 30 minutes without activity; omitted fields keep their current value
lifecycle = sandbox.update_lifecycle_policy(idle_expiry_seconds=1800, on_idle_timeout="delete")
print(lifecycle.idle_expiry_seconds, lifecycle.on_idle_timeout)

# Re-anchor the timeout to 1 hour from now
lifecycle = sandbox.update_lifecycle_policy(timeout_seconds=3600)
print(lifecycle.timeout_at)

# Clear the idle timeout
lifecycle = sandbox.update_lifecycle_policy(idle_expiry_seconds=DISABLED)
```

| **Parameter** | **Description** |
| --- | --- |
| `idle_expiry_seconds` | Sets the seconds without activity before the idle action.<br />**Minimum:** `60`<br />**Maximum:** `2147483647`<br />**Value:** `DISABLED` for no idle timeout<br />**Example:** `1800` |
| `on_idle_timeout` | Sets the idle action.<br />**Value:** `"delete"` |
| `on_timeout` | Sets the timeout action.<br />**Value:** `"delete"` |
| `timeout_seconds` | Sets the seconds until the timeout, counted from now.<br />**Minimum:** `1`<br />**Maximum:** `86400`, unless the organization or its plan sets a different maximum<br />**Example:** `3600` |

### Delete

Delete a sandbox to remove it and release its resources. Deletion removes a resource permanently, together with the data stored only in it.

Deletion of a Linux sandbox works in any state and discards its filesystem and memory once the teardown finishes. Images and snapshots captured from the sandbox remain.

Delete a sandbox when its work is done. To keep files from it, take a [filesystem snapshot](#filesystem-snapshot) or write the files to a [volume](./volumes.md) or other storage outside the sandbox before you delete it. The sandbox moves from deleting to deleted when the teardown finishes. The API returns once teardown starts, and the SDKs and the CLI wait until the sandbox is deleted.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

sandbox.delete()

# Delete by sandbox ID, without fetching the sandbox first
daytona.v2.delete("{sandboxId}")
```

| **Parameter** | **Description** |
| --- | --- |
| `sandbox` | Sets the sandbox that daytona.v2.delete() deletes.<br />**Required**<br />**Format:** a sandbox handle or ID<br />**Example:** `sandbox` |
| `timeout` | Sets how many seconds the call waits for the sandbox to be deleted.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `120` |

## Persistence

[Persistence](./persistence.md) is how long the state of a sandbox lasts: the files on its disk, and the processes and data in its memory. State that persists outlives the events that would otherwise discard it.

### Filesystem persistence

Filesystem persistence keeps the contents of a sandbox's disk, such as installed packages and build artifacts. A sandbox that starts from a preserved filesystem has its environment intact, with nothing to reinstall or rebuild.

### Memory persistence

Memory persistence keeps the runtime state of a sandbox: its running processes and everything loaded in memory. A sandbox that starts from preserved memory continues from the point it was saved, with its processes still running, instead of a clean boot.

## Snapshots

[Snapshots](./snapshots.md) are saved copies of a sandbox at one point in time. A new sandbox starts from a snapshot instead of a clean install, so the setup that many sandboxes share runs only once.

### Filesystem snapshot

A [filesystem snapshot](./images.md#capture-images) is a copy of the disk of a sandbox at one point in time, without its processes or memory. A sandbox started from it boots with the captured files.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.process.run("pip install requests")

# Capture the filesystem; the sandbox keeps running
image = sandbox.capture_image(name="my-env")

# Wait until the capture is ready, then boot new sandboxes from it
while image.status not in ("ready", "failed"):
    image = daytona.v2.images.get(image.id, wait="ready")
if image.status == "failed":
    raise RuntimeError(image.error)
clone = daytona.v2.create("my-env")
```

| **Parameter** | **Description** |
| --- | --- |
| `idle_expiry_seconds` | Sets how many seconds an anonymous image can go without a sandbox create before deletion.<br />**Default:** the server maximum<br />**Minimum:** `1`<br />**Maximum:** the server maximum<br />**Value:** `-1` for the maximum |
| `image` | Sets the image that create() boots the new sandbox from, by name or img_ ID.<br />**Example:** `"my-env"` |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, and not the names cache or search<br />**Example:** `"my-env"` |
| `wait` | Holds the request until the image is ready.<br />**Value:** `"ready"` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be a running Linux sandbox.
> - **Effects:** The sandbox keeps running while it is captured.
> - **Lifetime:** A named image stays until it is deleted. An anonymous image is deleted once no sandbox is created from it for its idle window, 7 days by default.

### Memory snapshot

A [memory snapshot](./snapshots.md) is a copy of the memory and disk of a sandbox at one point in time, with its running processes. A sandbox restored from it continues from that point instead of booting.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Capture the memory and disk of the running sandbox
snapshot = sandbox.create_snapshot("my-snapshot")

# Wait until the capture is ready
while snapshot.status not in ("ready", "failed"):
    snapshot = daytona.v2.snapshots.get(snapshot.id, wait="ready")
if snapshot.status == "failed":
    raise RuntimeError(snapshot.error)

# Resume the captured processes and memory in a new sandbox
restored = daytona.v2.create_from_snapshot("my-snapshot", labels={"team": "research"})
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the snapshot name.<br />**Required**<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, and not the name search<br />**Example:** `"my-snapshot"` |
| `snapshot` | Sets the snapshot that create_from_snapshot() restores from.<br />**Required**<br />**Format:** a snapshot name or ID<br />**Example:** `"my-snapshot"` |
| `labels` | Attaches key-value metadata to the restored sandbox.<br />**Example:** `{"team": "research"}` |
| `wait` | Holds the request until the snapshot is ready.<br />**Value:** `"ready"` |

> **Notes:**
>
> - **Prerequisites:** The source sandbox must be running. The source sandbox must be persistent, served from a warm template, or restored from a memory snapshot.
> - **Compatibility:** A sandbox created from a filesystem snapshot, or an ephemeral sandbox with volumes attached, cannot be captured. A snapshot restores only on a host with the same CPU model and hypervisor version as the source. It restores in another region only where cross-region restore is enabled and the source sandbox was not persistent.
> - **Behaviour:** A restore runs on the host that captured the snapshot when possible, otherwise on a matching host of the region. The restored sandbox has the CPU, memory, and disk of the source.

## Images

[Images](./images.md) are packaged filesystems, together with the configuration a program needs to start: environment variables, a working directory, and a command. An image is built once and read many times, so every sandbox started from it begins in the same state. An image defines the operating system, tools, and files that a sandbox starts with.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create("python-3.12-slim")
print(sandbox.image)
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the registered image that the sandbox starts from.<br />**Default:** the platform image whose default field is true in the [image list](./images.md#list-images)<br />**Format:** an image name or ID<br />**Example:** `"python-3.12-slim"` |

## CPU architectures

CPU architectures are the instruction sets that processors run, and a program compiled for one architecture does not run on another. Servers use amd64 (x86-64) or arm64 (AArch64).

The CPU architecture of a Linux sandbox decides which compiled programs can run inside it, and a program built for the other architecture does not run. It is set when the sandbox is created, and a sandbox created without one takes the architecture of its region.

Set the CPU architecture to match the programs the sandbox runs. A Linux sandbox runs on amd64 or arm64. Without one, a sandbox gets its region's default, or amd64 if it sets none.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(cpu_arch="arm64")
```

| **Parameter** | **Description** |
| --- | --- |
| `cpu_arch` | Sets the CPU architecture.<br />**Default:** the region's default architecture, or `amd64` if the region sets none<br />**Value:** `amd64` or `arm64`<br />**Example:** `"arm64"` |

## CPU types

CPU types are the processor models that hosts are built with. Models of the same architecture run the same programs but differ in speed and in the instructions they support.

A CPU type is a processor model that a Linux sandbox can request when it is created. Each type belongs to one architecture, so requesting a CPU type also sets the sandbox's architecture.

List the CPU types available in a region before you request one. Each CPU type belongs to amd64 or arm64 and has a tier, its rank within that architecture, starting at 1 for the lowest.

**CLI:**

```bash
# List CPU types
daytona cpu-type list

# Check CPU type availability in a region
daytona cpu-type list --region us-east-ash-1
```

| **Flag** | **Description** |
| --- | --- |
| `--region` | Checks availability in one region.<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, or `us-east-iad-1`<br />**Example:** `us-east-ash-1` |

> **Notes:**
>
> - **Results:** The output is a table in a terminal and JSON elsewhere, unless the output format is set.

**API:**

```bash
# List CPU types
curl 'https://api.daytona.com/cpu-catalog' \
  --header 'Authorization: Bearer YOUR_API_KEY'

# Check CPU type availability in a region
curl 'https://api.daytona.com/cpu-catalog?region_ids=us-east-ash-1' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `region_ids` | Sets the regions to check availability in.<br />**Default:** every region that the answering workload cell hosts<br />**Maximum:** 64 region IDs<br />**Format:** a comma-separated list of region IDs<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, or `us-east-iad-1`<br />**Example:** `us-east-ash-1` |

## Spot

[Spot sandboxes](./preemption.md#spot-sandboxes) are sandboxes on spot capacity, which is sold at a lower price and can be reclaimed from a running sandbox. They are the preemptible tier of compute.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(spot=True)
```

| **Parameter** | **Description** |
| --- | --- |
| `spot` | Places the sandbox on discounted, reclaimable capacity.<br />**Default:** `False` |

## Volumes

[Volumes](./volumes.md) are storage that exists independently of any one sandbox that uses it.

```python
from daytona import Daytona
from daytona.v2 import VolumeMount

daytona = Daytona()
daytona.v2.volumes.create(name="my-volume")

sandbox = daytona.v2.create(
    volumes=[VolumeMount(volume_id="my-volume", mount_path="/data")],
)
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the volume name.<br />**Required**<br />**Example:** `"my-volume"` |
| `volumes` | Attaches volumes to the sandbox.<br />**Maximum:** 8 volumes<br />**Example:** `[VolumeMount(volume_id="my-volume", mount_path="/data")]` |
| `volume_id` | Sets the volume to attach.<br />**Required**<br />**Format:** a volume name or ID<br />**Example:** `"my-volume"` |
| `mount_path` | Sets the directory where the volume is mounted.<br />**Required**<br />**Format:** an absolute path with no .. component, other than / and not on or beneath /bin, /boot, /dev, /etc, /lib, /lib32, /lib64, /mnt/scratch, /overlay, /proc, /sbin, /sys, or /usr<br />**Example:** `"/data"` |

## Network

[Network limits](./network-limits.md) are rules that decide which network destinations a sandbox can reach. They are enforced outside the sandbox, so untrusted code inside it cannot lift them.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(
    network_policy={"block_all": True, "allow_domains": ["pypi.org", "*.github.com"]},
)
```

| **Parameter** | **Description** |
| --- | --- |
| `network_policy` | Sets the outbound network policy.<br />**Example:** `{"block_all": True, "allow_domains": ["pypi.org"]}` |
| `block_all` | Denies all egress that is not explicitly allowed.<br />**Default:** `True` when allow_domains is set, otherwise `False` |
| `allow_domains` | Allows egress to hostnames or wildcard domains.<br />**Maximum:** 128 domains and CIDR blocks combined<br />**Format:** hostnames, or wildcard domains, which match their subdomains only<br />**Example:** `["pypi.org", "*.github.com"]` |
| `allow_cidrs` | Allows egress to IPv4 addresses or CIDR blocks, on any port.<br />**Maximum:** 128 domains and CIDR blocks combined<br />**Format:** public IPv4 addresses or CIDR blocks<br />**Example:** `["1.1.1.1/32"]` |

## Ports

Ports are numbered endpoints on a network address that let a program accept connections, one port per service, such as 22 for SSH or 443 for HTTPS. Each port carries a transport protocol: TCP for ordered streams of data, or UDP for individual messages.

Port forwarding on a Linux sandbox forwards inbound connections to ports inside the sandbox. The ports to forward are set when the sandbox is created, and each forwarded port lets a service in the sandbox accept connections from outside it.

Forward a port for each service in the sandbox that must accept inbound connections. A sandbox forwards up to 32 ports, each a number from 1 to 65535 with the TCP or UDP protocol. A port mapping with no protocol set uses TCP by default.

```python
from daytona import Daytona
from daytona.v2 import PortMapping

daytona = Daytona()
sandbox = daytona.v2.create(
    ports=[PortMapping(port=8080), PortMapping(port=5353, proto="udp")],
)
```

| **Parameter** | **Description** |
| --- | --- |
| `ports` | Forwards inbound ports to the sandbox.<br />**Maximum:** 32 mappings<br />**Format:** PortMapping objects with a port from `1` to `65535` and a proto of `tcp` or `udp`, which defaults to `tcp`<br />**Example:** `[PortMapping(port=8080)]` |

## Secrets

[Secrets](./secrets.md) store sensitive values such as API keys, tokens, and passwords for use across your sandboxes. They let sandbox code authenticate to external services without hardcoding credentials into your source, snapshots, or sandbox environment variables.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(secrets=["GITHUB_TOKEN"])
```

| **Parameter** | **Description** |
| --- | --- |
| `secrets` | Attaches project secrets by name.<br />**Example:** `["GITHUB_TOKEN"]` |

> **Notes:**
>
> - **Prerequisites:** The secrets must exist in the project.

## Names

Names are human-readable identifiers that people and programs use to refer to a resource instead of its generated ID. A name describes what a resource is for, such as the user, task, or run it belongs to, and stays readable in lists, logs, and dashboards.

The name of a Linux sandbox is a display name set when it is created, next to the generated ID of the sandbox. It tells the people who read lists and logs what the sandbox is for, and a sandbox created without a name is given a generated one.

Set a name to find the sandbox by its purpose in lists, logs, and the dashboard. A generated name is sandbox- plus 8 hex digits. A name has 1 to 128 letters, digits, periods, underscores, and hyphens, and does not start with a period or a reserved prefix such as sbx_ or vol_.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(name="my-sandbox")
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the display name.<br />**Default:** a generated name, sandbox- followed by 8 hexadecimal characters<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-<br />**Example:** `"my-sandbox"` |

## Labels

Labels are key-value pairs that describe a resource, such as the team, environment, or run it belongs to. Tools filter, group, and search resources by their labels without reading them.

Labels on a Linux sandbox are key-value metadata attached when the sandbox is created, such as the team or run that it belongs to. Tools filter and group sandboxes by them.

Set labels to filter and group the sandboxes of one team, environment, or run. A sandbox holds up to 100 labels, each with a non-empty key and a value of at most 512 bytes.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(labels={"team": "research", "run": "42"})
```

| **Parameter** | **Description** |
| --- | --- |
| `labels` | Attaches key-value metadata to the sandbox.<br />**Maximum:** 100 labels<br />**Format:** a non-empty key and a value of at most 512 bytes each<br />**Example:** `{"team": "research"}` |

## Idempotency

Idempotency keys are unique values that a client sends with a request so that a retry of the request takes effect only once. When a response is lost, the client resends the request with the same key and gets the result of the first attempt instead of a duplicate.

An idempotency key on the create of a Linux sandbox makes a retried create return the same sandbox instead of a second one. The client sends the key with the create, and every retry that carries the same key gets the sandbox of the first attempt.

Set an idempotency key on any create a client may retry, up to 256 printable ASCII characters. Without a key, the SDKs and CLI derive one from the sandbox name if set, or a new key per call.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(idempotency_key="run-42-create")
```

| **Parameter** | **Description** |
| --- | --- |
| `idempotency_key` | Makes a retried create return the same sandbox.<br />**Default:** a key derived from name if set, otherwise a new key for each call<br />**Minimum:** 1 character<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `"run-42-create"` |

## Logs

Logs are the text output that a program or operating system writes as it runs. They show what happened inside a sandbox after the fact.

**CLI:**

```bash
# Serial console log of the microVM
daytona sandbox logs {sandboxId}
```

| **Flag** | **Description** |
| --- | --- |
| `--entrypoint` | Reads the entrypoint log instead of the serial console log. |
| `--follow` | Polls for new log output until interrupted. |

> **Notes:**
>
> - **Results:** The log is the serial console output of the microVM, so it shows how the sandbox booted or why it failed to. The output of the [entrypoint process](./process-execution.md#entrypoint-process) and of an [image build](./images.md#build-logs) are read on their own pages.
> - **Behaviour:** While the sandbox runs, the log is read live from its host. In any other state, the persisted log is returned.

**API:**

```bash
# Serial console log of the microVM
curl 'https://api.daytona.com/sandboxes/{sandboxId}/console-logs' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

> **Notes:**
>
> - **Results:** The log is the serial console output of the microVM, so it shows how the sandbox booted or why it failed to. The output of the [entrypoint process](./process-execution.md#entrypoint-process) and of an [image build](./images.md#build-logs) are read on their own pages.
> - **Behaviour:** While the sandbox runs, the log is read live from its host. In any other state, the persisted log is returned.

## Permissions

Linux sandboxes use the sandbox permissions of their project, and snapshots use the image and snapshot permissions. You can grant each to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

Updating a timeout whose current or new action is delete, and resetting the idle timer of a sandbox whose idle action is delete, also require the permission to delete sandboxes. Attaching secrets at create requires the permission to read secrets. The [audit logs](./audit-logs.md) record sandbox creates, lifecycle changes, deletes, and snapshots.

| **Permission**         | **Grants**                                                                        |
| ---------------------- | --------------------------------------------------------------------------------- |
| **`read:sandboxes`**   | Get sandboxes and wait for their state                                            |
| **`write:sandboxes`**  | Create and update sandboxes, and reset their idle timers                          |
| **`delete:sandboxes`** | Delete sandboxes, and update timeouts or reset idle timers whose action is delete |
| **`write:images`**     | Capture filesystem snapshots as images, together with `write:sandboxes`           |
| **`write:snapshots`**  | Create memory snapshots, together with `write:sandboxes`                          |
