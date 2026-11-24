# Sandboxes (TypeScript SDK)

Isolated virtual machines for autonomous agents, code execution, and model training.

A sandbox is a hardware-isolated virtual machine with its own kernel, filesystem, network stack, and allocated vCPU, RAM, and disk, with isolation enforced by the hypervisor.

Sandboxes run as [Linux](#linux-sandboxes) (default), [Windows](#windows-sandboxes), [macOS](#macos-sandboxes), or [GPU](#gpu-sandboxes)-accelerated virtual machines. Every sandbox moves through a lifecycle of several states. While a sandbox runs, it exposes a [toolbox](#toolbox) for code, command, and process execution, sessions, filesystem and git operations, computer use, and log streaming.

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
- [Hardware virtualization](#hardware-virtualization)
- [Features](#features)
- [Lifecycle](#lifecycle)
- [Resources](#resources)
- [Regions](#regions)
- [Toolbox](#toolbox)
- [Operations](#operations)
- [Permissions](#permissions)

## Create sandboxes

Daytona provides methods to create sandboxes from the dashboard or programmatically.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.com/dashboard/sandboxes)
2. Click **Create**
3. Select **[Linux sandbox](#linux-sandboxes)**, **[Windows sandbox](../platform/windows-sandboxes.md)**, **[GPU sandbox](../platform/gpu-sandboxes.md)**, or **[macOS sandbox](./macos-sandboxes.md)**
4. Click **Create**

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
```

### Linux sandboxes

[Linux sandboxes](./linux-sandboxes.md) are Firecracker microVMs that run their own Linux kernel, and they are the default sandbox type. A Linux sandbox boots from an image or from a snapshot of another Linux sandbox. Each sandbox runs on an amd64 or arm64 CPU.

### Windows sandboxes

[Windows sandboxes](../platform/windows-sandboxes.md) are virtual machines running Windows Server 2022. A Windows sandbox starts from a prepared base image, or from an image captured from another Windows sandbox. Commands run in PowerShell, and the desktop uses the remote desktop protocol.

### macOS sandboxes

[macOS sandboxes](./macos-sandboxes.md) are virtual machines running macOS on Apple silicon Mac computers. A create request can set the sandbox's cores, memory, and disk, up to the whole Mac. On a model that runs two sandboxes, a sandbox gets half of the Mac's cores and memory by default, so two sandboxes share one Mac.

### GPU sandboxes

[GPU sandboxes](../platform/gpu-sandboxes.md) have one or more dedicated NVIDIA or AMD GPUs attached for GPU acceleration, model inference, training, fine-tuning, and reinforcement learning. A GPU sandbox is ephemeral, and a checkpoint saves its processes, memory, and GPU memory. The checkpoint resumes in a new GPU sandbox.

| **Vendor**  | **GPU models**                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| **NVIDIA**  | **H100**, **H200**, **B200**, **B300**, **RTX Pro 6000**, **RTX 4090**, **RTX 5090**, **L40S**              |
| **AMD**     | **Instinct MI355X**                                                                                             |

## Hardware virtualization

Server processors include instructions for running virtual machines directly on the hardware. A virtual machine monitor uses these instructions to create a guest with its own virtual processors, memory, and devices. The processor rejects any access from a guest to host memory or to another guest's memory.

| **Sandbox**                               | **Host**               | **Runtime**                              |
| ----------------------------------------- | ---------------------- | ---------------------------------------- |
| [**Linux**](./linux-sandboxes.md)     | Linux with KVM         | Firecracker virtual machine              |
| [**Windows**](../platform/windows-sandboxes.md) | Linux with KVM         | Cloud Hypervisor virtual machine         |
| [**macOS**](./macos-sandboxes.md)     | Mac with Apple silicon | Virtualization framework virtual machine |

**Linux** exposes the processor's virtualization through the Kernel-based Virtual Machine (KVM). Linux sandboxes run on Firecracker, a virtual machine monitor built to run many small, short-lived virtual machines on one host. Firecracker provides only the devices a server needs: virtual disks, a network card, and a serial console. Each Linux sandbox runs as one Firecracker process on a host, in its own network namespace, with its own virtual processors and memory.

**Windows** sandboxes also use KVM, but Firecracker does not support Windows guests. Windows sandboxes run on **Cloud Hypervisor**, a virtual machine monitor with a small device model that can start an operating system from firmware. Each Windows sandbox runs as one Cloud Hypervisor process in its own network namespace, with its own virtual processors and memory.

**macOS** sandboxes run on Macs, because Apple's license allows macOS virtual machines only on Apple hardware. Apple silicon includes hardware support for virtual machines, which macOS exposes through Apple's Virtualization framework. Each macOS sandbox runs as its own virtual machine on its Mac, with its own virtual processors, memory, disk, and network card.

## Features

Features are the capabilities that a sandbox provides on top of its compute. They extend what an agent, a program, or a person can do with the code that runs inside it. Which features a sandbox has depends on its type.

| **Feature**                | [**Linux**](./linux-sandboxes.md) | [**Windows**](../platform/windows-sandboxes.md) | [**macOS**](./macos-sandboxes.md) | [**GPU**](../platform/gpu-sandboxes.md) |
| -------------------------- | --------- | ----------- | --------- | ------- |
| **Desktop**                | ✓         | ✓           | ✓         | ✗       |
| **File system**            | ✓         | ✓         | ✓         | ✓         |
| **Filesystem snapshot**    | ✓         | ✓           | ✓         | ✗       |
| **Git**                    | ✓         | ✓         | ✓         | ✓         |
| **Memory snapshot**        | ✓         | ✗           | ✗         | ✓       |
| **Network policy**         | ✓         | ✗           | ✓         | ✗       |
| **Process execution**      | ✓         | ✓         | ✓         | ✓         |
| **PTY**                    | ✓         | ✓         | ✓         | ✓         |
| **SSH**                    | ✓         | ✓         | ✓         | ✓         |
| **Web terminal**           | ✓         | ✓         | ✓         | ✓         |

## Lifecycle

A sandbox lifecycle is the set of states that a sandbox moves through from creation to deletion. A sandbox changes state when a user acts on it, or on its own when a timeout elapses. The actions it accepts, and what it keeps across them, depend on its type.

| **Lifecycle**              | [**Linux**](./linux-sandboxes.md#lifecycle) | [**Windows**](../platform/windows-sandboxes.md) | [**macOS**](./macos-sandboxes.md#lifecycle) | [**GPU**](../platform/gpu-sandboxes.md) |
| -------------------------- | --------- | ----------- | --------- | ------- |
| **Stop and start**         | ✗         | ✓           | ✓         | ✗       |
| **Pause and resume**       | ✗         | ✗           | ✓         | ✗       |
| **Fork**                   | ✗         | ✗           | ✓         | ✗       |
| **Delete**                 | ✓         | ✓           | ✓         | ✓       |
| **Filesystem persistence** | ✗         | ✓           | ✓         | ✗       |
| **Memory persistence**     | ✗         | ✗           | ✓         | ✗       |
| **Spot**                   | ✓         | ✓           | ✗         | ✗       |

## Resources

Resources are the processor cores, memory, and disk space that a sandbox reserves to run code.

| [**Linux**](./linux-sandboxes.md#resources) | **Default** | **Minimum** | **Maximum** |
| --- | --- | --- | --- |
| **CPU** | 0.5 cores | 0.125 cores | [Limits](./limits.md#sandbox-limits) |
| **Memory** | 1 GiB (1024 MiB) | 0.5 GiB (512 MiB) | [Limits](./limits.md#sandbox-limits) |
| **Disk** | 0.5 GiB (512 MiB)<br />or 10 GiB (10240 MiB) when CPU or memory is set | 10 GiB (10240 MiB) | [Limits](./limits.md#sandbox-limits) |
| **GPU** | None | 1 | [Limits](./limits.md#sandbox-limits) |

| [**macOS**](./macos-sandboxes.md#resources) | **ID** | **Default** | **Minimum** | **Maximum** |
| --- | --- | --- | --- | --- |
| **Apple M4** | `m4-10c-16g` | 10 cores<br />16 GiB memory<br />80 GiB disk | 4 cores<br />4 GiB memory<br />80 GiB disk | 10 cores<br />16 GiB memory<br />80 GiB disk |
| **Apple M4 Pro** | `m4pro-12c-24g` | 6 cores<br />12 GiB memory<br />122 GiB disk | 4 cores<br />4 GiB memory<br />80 GiB disk | 12 cores<br />24 GiB memory<br />276 GiB disk |
| **Apple M4 Pro** | `m4pro-12c-48g` | 6 cores<br />24 GiB memory<br />102 GiB disk | 4 cores<br />4 GiB memory<br />80 GiB disk | 12 cores<br />48 GiB memory<br />236 GiB disk |
| **Apple M5 Pro** | `m5pro-15c-24g` | 7 cores<br />12 GiB memory<br />127 GiB disk | 4 cores<br />4 GiB memory<br />80 GiB disk | 15 cores<br />24 GiB memory<br />287 GiB disk |

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

## Toolbox

A toolbox is the set of services inside a running sandbox that a program outside the sandbox calls to run code and work with files. Each toolbox request goes to the toolbox URL of the sandbox, where a proxy checks the credential and forwards the request to a daemon inside the sandbox.

| **Service**                                              | **Description**                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [**Process execution**](./process-execution.md)         | Runs shell commands and manages long-running processes.                           |
| [**Code execution**](./code-execution.md)               | Runs Python, TypeScript, and JavaScript code through language kernels.            |
| [**File system**](./file-system-operations.md)          | Reads, writes, and manages files and directories.                                 |
| [**Git**](./git-operations.md)                          | Clones repositories and runs Git operations on them.                              |
| [**PTY**](./pty.md)                                     | Opens interactive pseudo terminal sessions.                                       |
| [**Log streaming**](./log-streaming.md)                 | Streams the output of a process while the process runs.                           |
| [**Computer use**](./computer-use.md)                   | Controls the desktop of the sandbox with the mouse, keyboard, and screenshots.   |

| **URL** | **Description** |
| --- | --- |
| **Toolbox URL** | The toolbox_proxy_url field of the sandbox, which each region sets and which does not follow from the region ID.<br />**Format:** `https://{proxyHost}/toolbox`<br />**Example:** `https://proxy.ash-1.us-east.daytona.app/toolbox` |
| **Sandbox toolbox URL** | The toolbox URL with the sandbox ID appended, which the SDKs and the CLI send every toolbox request to.<br />**Format:** `{toolboxProxyUrl}/{sandboxId}`<br />**Example:** `https://proxy.ash-1.us-east.daytona.app/toolbox/{sandboxId}` |
| **Request URL** | The address of one [Toolbox API](../api/README.md#toolbox-api) endpoint, called with an API key or a [sandbox access token](#create-an-access-token).<br />**Format:** `{toolboxProxyUrl}/{sandboxId}/{path}`<br />**Example:** `https://proxy.ash-1.us-east.daytona.app/toolbox/{sandboxId}/processes` |
| **WebSocket URL** | The request URL with `wss://` in place of `https://`, for streams such as PTY.<br />**Format:** `wss://{proxyHost}/toolbox/{sandboxId}/{path}`<br />**Example:** `wss://proxy.ash-1.us-east.daytona.app/toolbox/{sandboxId}/{path}` |

## Operations

Operations are the reads and updates made on resources that already exist. A list reads a scope page by page, and a get reads one resource by its identifier.

An operation on sandboxes acts on the sandboxes of a single project. It does not change the state of a sandbox or touch anything running inside it.

Use the operations below to find a sandbox and read or update it. To stop, pause, fork, or delete a sandbox, see [lifecycle](#lifecycle). To run commands or work with files in a sandbox, use the [toolbox](#toolbox).

### List sandboxes

List sandboxes to see the sandboxes of a project with their IDs, names, and states. A paginated list returns a large collection in pages, and each page continues where the last one ended.

A list of sandboxes covers one project and returns its sandboxes one page at a time.

Use a list to find a sandbox whose ID you do not know, and [search](#search-sandboxes) to filter by name, state, class, labels, or resources. A list takes a page size and a cursor, and the CLI also takes a region. Where the deployment serves search, the SDKs and the CLI read its index, which covers every region but can miss a sandbox created a moment ago. To read your own writes, use [get](#get-a-sandbox).

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const page = await daytona.v2.list()
for (const sandbox of page.items) {
  console.log(sandbox.id, sandbox.name, sandbox.state)
}
```

| **Parameter** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page.<br />**Format:** the nextCursor of a previous page |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

##### Iterate over all sandboxes

Iterate over all sandboxes to read every sandbox of the project without handling page cursors. Iteration over a paginated list reads one page after another until no page remains.

Iteration over the sandboxes of a project yields the sandboxes of every page in turn, and it ends after the last page, when the server returns no cursor.

Use iteration when a script needs every sandbox of the project rather than one page. The SDK iterators fetch each page as the last one ends, and the CLI `--all` flag follows every page.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
for await (const sandbox of daytona.v2.iter()) {
  console.log(sandbox.id, sandbox.name, sandbox.state)
}
```

### Search sandboxes

Search sandboxes to find the ones that match a text query or a set of filters. A search matches stored resources against the query and filters and returns them sorted, one page at a time.

A search of sandboxes covers the project in every region and reads an eventually consistent central index, not the sandboxes themselves. Deleted sandboxes are left out of the results.

Use a search to find sandboxes by text, or by their state, class, or labels. Filters combine with AND. A create, update, or delete becomes searchable about 2 to 3 seconds after it is committed, so a sandbox created a moment ago may be missing. To read your own writes, use [get](#get-a-sandbox).

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

// Free text over name and image, or an exact sandbox id
const page = await daytona.v2.search({ q: 'my-sandbox' })
for (const sandbox of page.items) {
  console.log(sandbox.id, sandbox.name, sandbox.state)
}
```

| **Parameter** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page.<br />**Format:** the nextCursor of a previous page with the same filters and sort |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `order` | Sets the sort order.<br />**Default:** `desc`<br />**Value:** `asc` or `desc`<br />**Example:** `'asc'` |
| `q` | Matches free text against the name and image, or one sandbox ID exactly.<br />**Example:** `'my-sandbox'` |
| `sort` | Sets the sort field.<br />**Default:** `created_at`<br />**Value:** `created_at`, `updated_at`, `last_activity_at`, `name`, `cores`, `memory_mib`, or `disk_mib`<br />**Example:** `'name'` |
| `states` | Filters by state.<br />**Format:** one state or a list of states<br />**Value:** `queued`, `creating`, `starting`, `started`, `pausing`, `paused`, `stopping`, `stopped`, `destroying`, `destroyed`, or `error`<br />**Example:** `'started'` |

### Get a sandbox

Get a sandbox by its ID to read its current state, resources, labels, and lifecycle settings. A get reads one resource by its identifier and changes nothing on the server.

A get of a sandbox reads it from the control plane directly, not from the search index, so the result reflects a change as soon as the change is made.

Use a get to read a sandbox right after a change, which [search](#search-sandboxes) can miss for a few seconds. Store the sandbox ID, or the sandbox data as JSON, to get the sandbox again later.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

// Fetch the sandbox from the control plane
const sandbox = await daytona.v2.get('{sandboxId}')
console.log(sandbox.state, sandbox.cpu, sandbox.memory, sandbox.disk)

// Store the sandbox data as JSON; it carries no URL or credential
const saved = sandbox.toJSON() // { sandboxId: '...', name: '...', state: '...', ... }

// Later, get the sandbox again by its ID
const again = await daytona.v2.get(saved.sandboxId)
```

| **Parameter** | **Description** |
| --- | --- |
| `id` | Sets the sandbox to get.<br />**Required**<br />**Format:** a sandbox ID |
| `toolboxUrl` | Sets the URL that the sandbox sends its toolbox requests and its credential to, in place of the [sandbox toolbox URL](#toolbox). Pass only a URL you control.<br />**Default:** the sandbox toolbox URL<br />**Format:** a URL that already holds the sandbox ID, or that holds `{sandboxId}` or `{sandbox_id}` in its path, which the SDK replaces with the sandbox ID<br />**Example:** `'https://proxy.example.com/toolbox/{sandboxId}'` |

> **Notes:**
>
> - **Results:** A macOS sandbox also holds the ID of the Mac reservation it runs on, so the result shows which reservation it uses.

##### Refresh a sandbox

Refresh a sandbox to update a local object with the current data of the sandbox. A refresh replaces the fields that a client holds with the values the server holds now.

A refresh of a sandbox reads it from the control plane and updates the object in place. Until then, the object keeps the fields from the request that returned it, so its state, resources, and labels can be out of date after a change made by another client.

Refresh a sandbox before you act on its state or labels when another client may have changed them. Lifecycle operations such as start and stop refresh the object when they finish.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

// Re-read the sandbox from the control plane
await sandbox.refreshData()
console.log(sandbox.state, sandbox.labels)
```

### Find sandboxes by name

Find sandboxes by name to look them up without their IDs. A name lookup returns every resource whose name matches exactly, because a name, unlike an ID, need not be unique.

The name of a sandbox is the name label it was created with. A sandbox whose labels no longer include the name label drops out of name lookups and of searches that filter on that label.

Find a sandbox by name to reuse it instead of creating a new one. The result is a list, newest first, and is empty when no sandbox matches. The lookup reads the [search](#search-sandboxes) index, so a sandbox created a moment ago can be missing. The SDKs and the CLI keep the name label when they replace labels, and an API label update without it removes it.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

// Reuse a named sandbox, or create it when none exists
const found = await daytona.v2.findByName('my-sandbox')
const sandbox = found[0] ?? (await daytona.v2.create({ name: 'my-sandbox' }))
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Matches the sandbox name exactly.<br />**Required**<br />**Example:** `'my-sandbox'` |
| `region` | Sets the region whose API endpoint the lookup goes through.<br />**Default:** the default region<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, `us-east-iad-1`, or the ID of a [BYOC region](./bring-your-own-compute.md) of the organization, or `'local'` for the default region |

### Create an access token

Create an access token to give a person or program limited access to one sandbox. An access token is a short-lived credential that grants a fixed set of operations on one resource.

An access token of a sandbox works only for that sandbox, and only for the operations and private preview ports it grants. It lasts until it expires and cannot be refreshed or revoked. A client that holds it cannot use it to create other credentials.

Create an access token for a collaborator, CI job, or browser instead of a project API key. The token lasts one hour by default and at most 24 hours. Create a new one when it expires.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

// Grant file system and SSH access for 15 minutes
const token = await sandbox.createAccessToken({ operations: ['toolbox:fs', 'ssh'], ttlSeconds: 900 })
console.log(token.accessToken, token.expiresAt)
```

| **Parameter** | **Description** |
| --- | --- |
| `operations` | Sets the operations that the token grants.<br />**Default:** every operation that the API key can grant<br />**Value:** any of `toolbox`, `toolbox:exec`, `toolbox:fs`, `toolbox:git`, `desktop`, `ssh`, `sandbox:stop`, `sandbox:pause`, and `sandbox:delete`, or `[]` for preview ports only<br />**Example:** `['toolbox:fs', 'ssh']` |
| `ports` | Sets the private preview ports that the token can reach.<br />**Default:** all ports<br />**Maximum:** 128 ports<br />**Format:** ports from `1` to `65535`, except the sandbox daemon ports 2280, 2281, and 22220<br />**Value:** `[]` for no ports<br />**Example:** `[3000]` |
| `ttlSeconds` | Sets the token lifetime in seconds.<br />**Default:** `3600`<br />**Minimum:** `1`<br />**Maximum:** `86400` |

### Label sandboxes

Label sandboxes to group them and find them again. Labels are key-value pairs that describe a resource, such as the team, environment, or run it belongs to.

The labels of a sandbox are stored with it as one set. A label update replaces the whole set, and it removes any label that is left out of the new label set.

Label sandboxes to filter them by key and value when you [search](#search-sandboxes). A sandbox holds at most 100 labels, and each key and each value holds at most 512 bytes.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

// Replace the full label set
const labels = await sandbox.setLabels({ team: 'research' })
console.log(labels)
```

| **Parameter** | **Description** |
| --- | --- |
| `labels` | Replaces the labels of the sandbox, except the name label when the new set omits it.<br />**Required**<br />**Maximum:** 100 labels<br />**Format:** a non-empty key and a value of at most 512 bytes each<br />**Value:** `{}` for no labels other than the name label<br />**Example:** `{ team: 'research' }` |

### Metrics

Metrics are measurements of how much CPU, memory, and disk is in use at one moment. They show whether a sandbox has spare capacity or is close to its limits.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

const metrics = await sandbox.metrics()
console.log(metrics.cpuUtilization, metrics.memoryUsageBytes, metrics.diskUsageBytes)
```

## Permissions

Sandboxes are scoped to a project. An API key reaches only its own project's sandboxes. Three sandbox permissions govern access, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

| **Permission**         | **Grants**                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **`read:sandboxes`**   | List, search, and get sandboxes, and read their logs, usage, and exposed ports                                                          |
| **`write:sandboxes`**  | Create, start, stop, pause, resume, fork, and label sandboxes, change their lifecycle policy, create access tokens, and use the toolbox |
| **`delete:sandboxes`** | Delete sandboxes                                                                                                                        |
