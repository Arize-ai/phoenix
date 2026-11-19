# Sandboxes (Python SDK)

Isolated virtual machines for autonomous agents, code execution, and model training.

A sandbox is a hardware-isolated virtual machine with its own kernel, filesystem, network stack, and allocated vCPU, RAM, and disk, with isolation enforced by the hypervisor.

Sandboxes run as [Linux](#linux-sandboxes) (default), [Windows](#windows-sandboxes), [macOS](#macos-sandboxes), or [GPU](#gpu-sandboxes)-accelerated virtual machines. Every sandbox moves through a lifecycle of several states. While a sandbox runs, it exposes a toolbox for code, command, and process execution, sessions, filesystem and git operations, computer use, language server protocol support, and log streaming.

Use sandboxes to run code written by an agent, or to spin up thousands of identical sandboxes for evaluation and reinforcement learning workflows.

| **Concept**    | **Description**                                                                              |
| -------------- | -------------------------------------------------------------------------------------------- |
| **Sandbox**    | An isolated, dedicated virtual machine.                                                      |
| **Image**      | The packaged filesystem that a sandbox boots from.                                           |
| **Resources**  | The CPU, memory, and disk allocated to a sandbox.                                            |
| **Lifecycle**  | The states a sandbox can be in and the transitions between them.                             |
| **Ephemeral**  | A sandbox whose filesystem is discarded when the sandbox is deleted.                         |
| **Persistent** | A sandbox that keeps its disk across stop and start.                                         |
| **Toolbox**    | The set of operations that run inside a sandbox, such as commands, file operations, and Git. |

## Contents

- [Create sandboxes](#create-sandboxes)
- [Resources](#resources)
- [Regions](#regions)
- [Hardware virtualization](#hardware-virtualization)
- [Sandbox lifecycle](#sandbox-lifecycle)
- [Sandbox operations](#sandbox-operations)
- [Permissions](#permissions)

## Create sandboxes

Daytona provides methods to create sandboxes from the dashboard or programmatically. Creation allocates a new resource and gives it an identity that later requests use to reach it.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.com/dashboard/sandboxes)
2. Click **Create**
3. Select **[Linux sandbox](#linux-sandboxes)**, **[Windows sandbox](../platform/windows-sandboxes.md)**, **[GPU sandbox](../platform/gpu-sandboxes.md)**, or **[macOS sandbox](./macos-sandboxes.md)**
4. Click **Create**

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
```

### Linux sandboxes

[Linux sandboxes](./linux-sandboxes.md) are Firecracker microVMs that run their own Linux kernel, and they are the default sandbox type. A Linux sandbox boots from an image that you import from a container registry, build from a Dockerfile, or capture from another sandbox. It can also start from a snapshot of another Linux sandbox. Each sandbox runs on an amd64 or arm64 CPU.

### Windows sandboxes

[Windows sandboxes](../platform/windows-sandboxes.md) are virtual machines running Windows Server 2022. A Windows sandbox starts from a prepared base image, or from an image captured from another Windows sandbox. Commands run in PowerShell, and the desktop uses the remote desktop protocol.

### macOS sandboxes

[macOS sandboxes](./macos-sandboxes.md) are virtual machines running macOS on Apple silicon Mac computers. A macOS sandbox starts from a macOS image. A create request can set the sandbox's cores, memory and disk, up to the whole Mac. By default it gets half of the Mac's cores, memory and sandbox disk, so two sandboxes can share one Mac.

### GPU sandboxes

[GPU sandboxes](../platform/gpu-sandboxes.md) have one or more dedicated NVIDIA or AMD GPUs attached for GPU acceleration, model inference, training, fine-tuning, and reinforcement learning. A GPU sandbox is ephemeral and can be saved as a checkpoint that includes its processes, memory, and GPU memory, and the checkpoint can be resumed in a new GPU sandbox.

| **Vendor**  | **GPU models**                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| **NVIDIA**  | **H100**, **H200**, **B200**, **B300**, **RTX Pro 6000**, **RTX 4090**, **RTX 5090**, and **L40S**              |
| **AMD**     | **Instinct MI355X**                                                                                             |

## Resources

[Resources](./linux-sandboxes.md#resources) are the CPU, memory, and disk of a sandbox. Linux sandboxes have **0.5 cores**, **1024MiB memory**, and **512MiB disk** by default. A Linux sandbox guarantees at most **16 cores**, **32GiB memory**, and **256GiB disk**. A macOS sandbox takes its [size](./macos-sandboxes.md#sizes) from its Mac reservation.

CPU is measured and billed in cores, from fractions of a core up to many. One core is **2 vCPUs**, or **1 vCPU** on macOS. Each resource has a guarantee and a limit. A sandbox can always use its guarantee and takes more as needed, up to the limit, with no manual resize.

Set the **limit** at create time, and set it equal to the guarantee to fix the sandbox's size. The CPU guarantee is at least **1 core** for every **8GiB** of guaranteed memory. When a create guarantees more memory than its CPU guarantee covers, Daytona raises the CPU guarantee to that floor. A sandbox that guarantees **16GiB** memory therefore reserves and is billed for at least **2 cores**.

```python
from daytona import Daytona
from daytona.v2 import Resources

daytona = Daytona()
sandbox = daytona.v2.create(
    # memory and disk are GiB: 2 maps to memory_mib=2048, 20 to disk_mib=20480
    resources=Resources(cpu=1, memory=2, disk=20, cpu_max=2, memory_max=4, disk_max=40),
)
```

| **Parameter** | **Description** |
| --- | --- |
| `resources` | Sets the guaranteed and maximum CPU, memory, and disk of the sandbox.<br />**Example:** `Resources(cpu=2, memory=4)` |
| `cpu` | Sets the guaranteed CPU in cores.<br />**Default:** one core per 8 GiB of guaranteed memory, at least `0.5`<br />**Minimum:** `0.125`<br />**Maximum:** the CPU limit, at most `16` |
| `memory` | Sets the guaranteed memory in GiB.<br />**Default:** `1`<br />**Minimum:** `0.5`<br />**Maximum:** the memory limit, at most `32` |
| `disk` | Sets the guaranteed writable disk in GiB.<br />**Default:** `0.5`<br />**Minimum:** `10`<br />**Maximum:** the disk limit, at most `256` |
| `cpu_max` | Sets the CPU limit in cores.<br />**Default:** the platform maximum or the plan cap, whichever is lower<br />**Minimum:** `0.5`<br />**Maximum:** `16`<br />**Format:** a multiple of `0.5` |
| `memory_max` | Sets the memory limit in GiB.<br />**Default:** the platform maximum or the plan cap, whichever is lower<br />**Minimum:** `0.25`<br />**Maximum:** `32` |
| `disk_max` | Sets the writable disk limit in GiB.<br />**Default:** `256`<br />**Minimum:** `0.5`<br />**Maximum:** `256` |

## Regions

[Regions](./regions.md) are geographic or logical areas in which sandboxes run. Every sandbox runs in a region. A create request can name one, and Daytona places the sandbox on capacity there.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(region="earth")
```

## Hardware virtualization

Server processors include instructions for running virtual machines directly on the hardware. A virtual machine monitor uses these instructions to create a guest with its own virtual processors, memory, and devices. The processor rejects any access from a guest to host memory or to another guest's memory. Linux, Windows, and macOS sandboxes run as virtual machines, each on the virtual machine monitor that its operating system needs.

| **Sandbox**                               | **Host**               | **Runtime**                              |
| ----------------------------------------- | ---------------------- | ---------------------------------------- |
| [**Linux**](./linux-sandboxes.md)     | Linux with KVM         | Firecracker virtual machine              |
| [**Windows**](../platform/windows-sandboxes.md) | Linux with KVM         | Cloud Hypervisor virtual machine         |
| [**macOS**](./macos-sandboxes.md)     | Mac with Apple silicon | Virtualization framework virtual machine |

**Linux** exposes the processor's virtualization through the Kernel-based Virtual Machine (KVM). Linux sandboxes run on Firecracker, a virtual machine monitor built to run many small, short-lived virtual machines on one host. Firecracker provides only the devices a server needs: virtual disks, a network card, and a serial console. Each Linux sandbox runs as one Firecracker process on a host, in its own network namespace, with its own virtual processors and memory.

**Windows** sandboxes also use KVM, but Firecracker does not support Windows guests. Windows sandboxes run on **Cloud Hypervisor**, a virtual machine monitor with a small device model that can start an operating system from firmware. Each Windows sandbox runs as one Cloud Hypervisor process in its own network namespace, with its own virtual processors and memory.

**macOS sandboxes** run on Macs, because Apple's license allows macOS virtual machines only on Apple hardware. Apple silicon includes hardware support for virtual machines, which macOS exposes through Apple's Virtualization framework. Each macOS sandbox runs as its own virtual machine on its Mac, with its own virtual processors, memory, disk, and network card.

## Sandbox lifecycle

A sandbox lifecycle is the set of states that a sandbox moves through, from its creation to its deletion. Each state reflects the status of the sandbox.

A sandbox changes state in response to user actions, or on its own when one of its timeouts elapses. The actions that a sandbox accepts, and what it keeps across them, depend on its type.

Pick the sandbox type by the lifecycle actions that your work needs, such as stopping and starting a sandbox or pausing it with its memory. The lifecycle of [Linux](./linux-sandboxes.md#lifecycle), [Windows](../platform/windows-sandboxes.md), [GPU](../platform/gpu-sandboxes.md), and [macOS](./macos-sandboxes.md#lifecycle) sandboxes lists the states and transitions of each type.

| **Feature**                | **Linux**       | **Windows**      | **macOS**        | **GPU**      |
| -------------------------- | --------------- | ---------------- | ---------------- | ------------ |
| **Stop and start**         | ✗               | ✓ persistent     | ✓ persistent     | ✗            |
| **Pause and resume**       | ✗               | ✗                | ✓ persistent     | ✗            |
| **Fork**                   | ✗               | ✗                | ✓ persistent     | ✗            |
| **Delete**                 | ✓               | ✓                | ✓                | ✓            |
| **Filesystem persistence** | ✗               | ✓                | ✓                | ✗            |
| **Memory persistence**     | ✗               | ✗                | ✓ persistent     | ✗            |
| **Memory snapshot**        | ✓ warm template | ✗                | ✗                | ✓ checkpoint |
| **Filesystem snapshot**    | ✓               | ✓ block snapshot | ✓ persistent     | ✗            |
| **Spot (Preemption)**      | ✓               | ✓                | ✗                | ✗            |
| **Network policy**         | ✓               | ✗                | ✓                | ✗            |
| **Desktop**                | ✓               | ✓ RDP            | ✓ Screen Sharing | ✗            |

## Sandbox operations

Operations on sandboxes are the reads and updates made on sandboxes that already exist. They find sandboxes, read their current state and configuration, and update their metadata.

An operation on sandboxes acts on the sandboxes of a single project. It does not change the state of a sandbox or touch anything running inside it.

Use the operations below to find a sandbox and read or update it. To stop, pause, fork, or delete a sandbox, see [lifecycle](#sandbox-lifecycle). To run commands or work with files in a sandbox, use the toolbox.

### List sandboxes

List sandboxes to see the sandboxes of a project with their IDs, names, and states. A paginated list returns a large collection in pages, and each page continues where the last one ended.

A list of sandboxes covers one project and returns its sandboxes one page at a time.

Use a list to find a sandbox whose ID you do not know, and [search](#search-sandboxes) to filter by name, state, class, labels, or resources. A list takes a page size and a cursor, and the CLI also takes a region. Where the deployment serves search, the SDKs and the CLI read its index, which covers every region but can miss a sandbox created a moment ago. To read your own writes, use [get](#get-a-sandbox).

```python
from daytona import Daytona

daytona = Daytona()
page = daytona.v2.list()
for sandbox in page.items:
    print(sandbox.id, sandbox.name, sandbox.state)
```

| **Parameter** | **Description** |
| --- | --- |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `cursor` | Continues from a previous page.<br />**Format:** the next_cursor of a previous page |

##### Iterate over all sandboxes

Iterate over all sandboxes to read every sandbox of the project without handling page cursors. Iteration over a paginated list reads one page after another until no page remains.

Iteration over the sandboxes of a project yields the sandboxes of every page in turn, and it ends after the last page, when the server returns no cursor.

Use iteration when a script needs every sandbox of the project rather than one page. The SDK iterators fetch each page as the last one ends, and the CLI `--all` flag follows every page.

```python
from daytona import Daytona

daytona = Daytona()
for sandbox in daytona.v2.iter():
    print(sandbox.id, sandbox.name, sandbox.state)
```

### Search sandboxes

Search sandboxes to find the ones that match a text query or a set of filters. A search matches stored resources against the query and filters and returns them sorted, one page at a time.

A search of sandboxes covers the project in every region and reads an eventually consistent central index, not the sandboxes themselves. Deleted sandboxes are left out of the results.

Use a search to find sandboxes by text, or by their state, class, or labels. Filters combine with AND. A create, update, or delete becomes searchable about 2 to 3 seconds after it is committed, so a sandbox created a moment ago may be missing. To read your own writes, use [get](#get-a-sandbox).

```python
from daytona import Daytona

daytona = Daytona()

# Free text over name and image, or an exact sandbox id
page = daytona.v2.search(q="my-sandbox")
for sandbox in page.items:
    print(sandbox.id, sandbox.name, sandbox.state)
```

| **Parameter** | **Description** |
| --- | --- |
| `q` | Matches free text against the name and image, or one sandbox ID exactly.<br />**Example:** `"my-sandbox"` |
| `states` | Filters by state.<br />**Format:** one state or a list of states<br />**Value:** `queued`, `creating`, `starting`, `started`, `pausing`, `paused`, `stopping`, `stopped`, `destroying`, `destroyed`, or `error`<br />**Example:** `"started"` |
| `sort` | Sets the sort field.<br />**Default:** `created_at`<br />**Value:** `created_at`, `updated_at`, `last_activity_at`, `name`, `cores`, `memory_mib`, or `disk_mib`<br />**Example:** `"name"` |
| `order` | Sets the sort order.<br />**Default:** `desc`<br />**Value:** `asc` or `desc`<br />**Example:** `"asc"` |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `cursor` | Continues from a previous page.<br />**Format:** the next_cursor of a previous page with the same filters and sort |

### Get a sandbox

Get a sandbox by its ID to read its current state, resources, labels, and lifecycle settings. A get reads one resource by its identifier and changes nothing on the server.

A get of a sandbox reads it from the control plane directly, not from the search index, so the result reflects a change as soon as the change is made.

Use a get to read a sandbox right after a change, which [search](#search-sandboxes) can miss for a few seconds. Store the sandbox ID, or the sandbox data as JSON, to get the sandbox again later.

```python
from daytona import Daytona

daytona = Daytona()

# Fetch the sandbox from the control plane
sandbox = daytona.v2.get("{sandboxId}")
print(sandbox.state, sandbox.cpu, sandbox.memory, sandbox.disk)

# Store the sandbox data as JSON; it carries no URL or credential
saved = sandbox.to_json()  # {"sandboxId": "...", "name": "...", "state": "...", ...}

# Later, get the sandbox again by its ID
sandbox = daytona.v2.get(saved["sandboxId"])
```

| **Parameter** | **Description** |
| --- | --- |
| `sandbox_id` | Sets the sandbox to get.<br />**Required**<br />**Format:** a sandbox ID |

##### Refresh a sandbox

Refresh a sandbox to update a local object with the current data of the sandbox. A refresh replaces the fields that a client holds with the values the server holds now.

A refresh of a sandbox reads it from the control plane and updates the object in place. Until then, the object keeps the fields from the request that returned it, so its state, resources, and labels can be out of date after a change made by another client.

Refresh a sandbox before you act on its state or labels when another client may have changed them. Lifecycle operations such as start and stop refresh the object when they finish.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Re-read the sandbox from the control plane
sandbox.refresh_data()
print(sandbox.state, sandbox.labels)
```

### Find sandboxes by name

Find sandboxes by name to look them up without their IDs. A name lookup returns every resource whose name matches exactly, because a name, unlike an ID, need not be unique.

The name of a sandbox is the name label it was created with. A sandbox whose labels no longer include the name label drops out of name lookups and of searches that filter on that label.

Find a sandbox by name to reuse it instead of creating a new one. The result is a list, newest first, and is empty when no sandbox matches. The lookup reads the [search](#search-sandboxes) index, so a sandbox created a moment ago can be missing. The SDKs and the CLI keep the name label when they replace labels, and an API label update without it removes it.

```python
from daytona import Daytona

daytona = Daytona()

# Reuse a named sandbox, or create it when none exists
found = daytona.v2.find_by_name("my-sandbox")
sandbox = found[0] if found else daytona.v2.create(name="my-sandbox")
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Matches the sandbox name exactly.<br />**Required**<br />**Example:** `"my-sandbox"` |
| `region` | Sets the region whose API endpoint the lookup goes through.<br />**Default:** the default region<br />**Format:** a listed region ID<br />**Value:** `"local"` for the default region |

### Create an access token

Create an access token to give a person or program limited access to one sandbox. An access token is a short-lived credential that grants a fixed set of operations on one resource.

An access token of a sandbox works only for that sandbox, and only for the operations and private preview ports it grants. It lasts until it expires and cannot be refreshed or revoked. A client that holds it cannot use it to create other credentials.

Create an access token for a collaborator, CI job, or browser instead of a project API key. The token lasts one hour by default and at most 24 hours. Create a new one when it expires.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Grant file system and SSH access for 15 minutes
token = sandbox.create_access_token(operations=["toolbox:fs", "ssh"], ttl_seconds=900)
print(token.access_token, token.expires_at)
```

| **Parameter** | **Description** |
| --- | --- |
| `operations` | Sets the operations that the token grants.<br />**Default:** every operation that the API key can grant<br />**Value:** any of `toolbox`, `toolbox:exec`, `toolbox:fs`, `toolbox:git`, `toolbox:lsp`, `desktop`, `ssh`, `sandbox:stop`, `sandbox:pause`, and `sandbox:delete`, or `[]` for preview ports only<br />**Example:** `["toolbox:fs", "ssh"]` |
| `ports` | Sets the private preview ports that the token can reach.<br />**Default:** all ports<br />**Maximum:** 128 ports<br />**Format:** ports from `1` to `65535`, except the sandbox daemon ports 2280, 2281, and 22220<br />**Value:** `[]` for no ports<br />**Example:** `[3000]` |
| `ttl_seconds` | Sets the token lifetime in seconds.<br />**Default:** `3600`<br />**Minimum:** `1`<br />**Maximum:** `86400` |

### Label sandboxes

Label sandboxes to group them and find them again. Labels are key-value strings attached to a resource, used to group resources and to select them in queries.

The labels of a sandbox are stored with it as one set. A label update replaces the whole set, and it removes any label that is left out of the new label set.

Label sandboxes to filter them by key and value when you [search](#search-sandboxes). A sandbox holds at most 100 labels, and each key and each value holds at most 512 bytes.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Replace the full label set
labels = sandbox.set_labels({"team": "research"})
print(labels)
```

| **Parameter** | **Description** |
| --- | --- |
| `labels` | Replaces the labels of the sandbox, except the name label when the new set omits it.<br />**Required**<br />**Maximum:** 100 labels<br />**Format:** a non-empty key and a value of at most 512 bytes each<br />**Value:** `{}` for no labels other than the name label<br />**Example:** `{"team": "research"}` |

### Metrics

Metrics are measurements of how much CPU, memory, and disk is in use at one moment. They show whether a sandbox has spare capacity or is close to its limits.

The metrics of a sandbox are measured inside it by the toolbox and returned as one snapshot per request. Memory in use excludes memory the operating system can reclaim on demand, such as the file cache, and disk usage is measured on the filesystem that holds the sandbox working directory. CPU utilization is the share of total CPU capacity in use across all CPUs since the previous metrics request to the sandbox, from any client.

Read the metrics of a running sandbox to check its resource usage. The first metrics request after the toolbox starts measures CPU utilization over about 100 milliseconds instead.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

metrics = sandbox.metrics()
print(metrics.cpu_utilization, metrics.memory_usage_bytes, metrics.disk_usage_bytes)
```

### Logs

Logs are the text output that a program or operating system writes as it runs. A serial console log holds what the kernel and the boot process of a virtual machine print to its serial console.

The serial console log of a sandbox is the console output of its microVM. While the sandbox runs, the log is read live from its host; in any other state, the persisted log is returned.

Read the serial console log to see how a sandbox booted, or why it failed to. To read the output of the entrypoint process instead, see [entrypoint logs](#entrypoint-logs).

**CLI:**

```bash
# Serial console log of the microVM
daytona sandbox logs {sandboxId}
```

| **Flag** | **Description** |
| --- | --- |
| `--follow` | Polls for new log output until interrupted. |
| `--entrypoint` | Reads the entrypoint log instead of the serial console log. |

**API:**

```bash
# Serial console log of the microVM
curl 'https://api.daytona.com/sandboxes/{sandboxId}/console-logs' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

##### Entrypoint logs

Entrypoint logs are the output of the entrypoint, the process that an image runs when a sandbox starts from it. They show what the main process of a sandbox printed.

The entrypoint log of a sandbox is the text output of its entrypoint process. While the sandbox runs, the log is read live; in any other state, the persisted log is returned.

Read the entrypoint log to check the output of the entrypoint process in one request. To page through the log or follow it, read the [entrypoint process](./process-execution.md#entrypoint-process) through the toolbox.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

print(sandbox.entrypoint_logs())
```

##### Build logs

Build logs are the output of an image build: each step of a Dockerfile and what it prints. They show which step of a build failed, and the error it printed.

The build log of a sandbox is the output of its image build from a Dockerfile, kept even when the build failed before the sandbox was placed. When the sandbox reuses an image built earlier, the log is the output of that original build. A sandbox from a registry image has no build log.

Read the build log of a sandbox to check its image build, or follow it to stream the output until the build finishes. To read the log of an image without a sandbox, see [image build logs](./images.md#build-logs). Stopping the reader of a followed log does not stop the build itself.

```python
from daytona import Daytona
from daytona.v2 import ImageBuilder

daytona = Daytona()
sandbox = daytona.v2.create_from_build(ImageBuilder.from_dockerfile("FROM python:3.12-slim"))

# Output retained so far, as text
print(sandbox.build_logs())

# Stream output until the build finishes
result = sandbox.follow_build_logs(on_logs=lambda chunk: print(chunk, end=""))
print(result.status, result.reason)
```

| **Parameter** | **Description** |
| --- | --- |
| `on_logs` | Receives each chunk of decoded output.<br />**Required**<br />**Example:** `lambda chunk: print(chunk, end="")` |
| `cursor` | Resumes after the output that a previous follow returned.<br />**Format:** the cursor of a previous follow result |
| `timeout` | Sets the follow limit in seconds.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `600` |

## Permissions

Sandboxes are scoped to a project. An API key reaches only its own project's sandboxes. Three sandbox permissions govern access, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

Setting, changing, or clearing a delete action in a lifecycle policy also requires the permission to delete sandboxes, and so do resetting the idle timer of a sandbox whose idle action is delete and creating an access token that can delete the sandbox. Attaching, reading, or replacing the secrets of a sandbox requires the permission to read secrets. Capturing images and memory snapshots also requires the permission to [write images or snapshots](./linux-sandboxes.md#permissions). The [audit logs](./audit-logs.md) record sandbox creates, lifecycle changes, deletes, and access token creation.

| **Permission**         | **Grants**                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **`read:sandboxes`**   | List, search, and get sandboxes, and read their logs, usage, and exposed ports                                                          |
| **`write:sandboxes`**  | Create, start, stop, pause, resume, fork, and label sandboxes, change their lifecycle policy, create access tokens, and use the toolbox |
| **`delete:sandboxes`** | Delete sandboxes                                                                                                                        |
