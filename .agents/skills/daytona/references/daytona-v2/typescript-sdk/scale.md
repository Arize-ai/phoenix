# Scale (TypeScript SDK)

Sandbox scalability and concurrency.

Scale is the amount of work that sandboxes can take on: how many sandboxes run at the same time, and how many resources each sandbox can use. A sandbox scales up when it gets more resources, and a fleet scales out when more sandboxes run in parallel.

Sandboxes are designed to be created and operated at high volume. Scale is measured in sandboxes: how many run at the same time, and how much compute each one can use.

Scale a single sandbox up by bursting beyond its guaranteed resources. Scale a fleet out by running many sandboxes at once, and run multiple processes concurrently in each sandbox. The size of a fleet is limited per sandbox and per organization.

| **Dimension**          | **What scales**                              | **Methods**                                                                                                                                                                                           |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sandbox** <br /> (vertical)     | vCPU, RAM, and disk of a single sandbox      | [**Custom resources**](./sandboxes.md#resources) <br /> [**Resource limits**](./limits.md#sandbox-limits)                                                                          |
| **Fleet** <br /> (horizontal)     | Number of sandboxes running simultaneously | [**Snapshot fan-out**](./snapshots.md)                                                                                                             |
| **Workload** <br /> (concurrency) | Concurrent processes in a sandbox | [**Sessions**](./process-execution.md#session-operations) <br /> [**Background commands**](./process-execution.md#start-a-background-process) <br /> [**PTY sessions**](./pty.md) |

## Contents

- [Sandbox scaling](#sandbox-scaling)
- [Fleet scaling](#fleet-scaling)
- [Workload concurrency](#workload-concurrency)
- [Capacity and throughput](#capacity-and-throughput)

## Sandbox scaling

Sandbox scaling, or vertical scaling, is the sizing of a single sandbox: how much processor, memory, and disk it can use. A sandbox scales up when it gets more of these resources.

The resources of a sandbox are fixed when the sandbox is created, and no operation resizes them. The requested resources are a guaranteed floor that is reserved when the sandbox is placed. Beyond that floor, the sandbox uses idle host capacity up to its resource limits.

Size the guarantee for the average use of the sandbox, and let bursting absorb the peaks. For a fixed shape with no bursting, make every limit equal to its guarantee. The resources of a sandbox are **vCPU**, **memory**, and **disk**. Without set [limits](./limits.md#sandbox-limits), its CPU, memory, and disk burst up to the [sandbox limits](./limits.md#sandbox-limits) of your plan.

**Custom resources:**

Guarantee CPU, memory, and disk when creating a sandbox.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

// Guarantee 2 cores, 4 GiB of RAM, and 16 GiB of disk for the sandbox
const sandbox = await daytona.v2.create({
  resources: { cpu: 2, memory: 4, disk: 16 },
})
```

| **Parameter** | **Description** |
| --- | --- |
| `resources` | Sets the guaranteed and maximum CPU, memory, and disk of the sandbox.<br />**Example:** `{ cpu: 2, memory: 4, disk: 16 }` |
| `cpu` | Sets the guaranteed CPU in cores.<br />**Default:** one core per 8 GiB of guaranteed memory, at least `0.5`<br />**Minimum:** `0.125`<br />**Maximum:** the CPU limit |
| `memory` | Sets the guaranteed memory in GiB.<br />**Default:** `1`<br />**Minimum:** `0.5`<br />**Maximum:** the memory limit |
| `disk` | Sets the guaranteed writable disk in GiB.<br />**Default:** `0.5`, or `10` when the CPU or memory guarantee is set<br />**Minimum:** `10`<br />**Maximum:** the disk limit |

> **Notes:**
>
> - **Permissions:** The request requires the `write:sandboxes` permission.
> - **Results:** The returned sandbox has no resources until it is read again.
> - **Behaviour:** A guarantee below its minimum is raised to the minimum when any guarantee is set. The CPU guarantee is raised to at least one core per 8 GiB of guaranteed memory.

**Burst ceilings:**

A sandbox bursts beyond its guarantee up to the [sandbox limits](./limits.md#sandbox-limits) of your plan; a value above them is rejected. The per-sandbox core and memory limits lower those ceilings and cannot raise them. CPU guarantees can be fractional, as small as 0.125 cores. Usage above the guarantee is billed as measured; see [billing](../platform/billing.md).

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

// Guarantee half a core and 2 GiB, and burst up to 2 cores (4 vCPUs) and 8 GiB
const sandbox = await daytona.v2.create({
  resources: { cpu: 0.5, cpuMax: 2, memory: 2, memoryMax: 8 },
})
```

| **Parameter** | **Description** |
| --- | --- |
| `cpu` | Sets the guaranteed CPU in cores.<br />**Default:** one core per 8 GiB of guaranteed memory, at least `0.5`<br />**Minimum:** `0.125`<br />**Maximum:** the CPU limit |
| `cpuMax` | Sets the CPU limit in cores.<br />**Default:** the [sandbox limit](./limits.md#sandbox-limits)<br />**Minimum:** `0.5`<br />**Maximum:** the [sandbox limit](./limits.md#sandbox-limits)<br />**Format:** a multiple of `0.5` |
| `memory` | Sets the guaranteed memory in GiB.<br />**Default:** `1`<br />**Minimum:** `0.5`<br />**Maximum:** the memory limit |
| `memoryMax` | Sets the memory limit in GiB.<br />**Default:** the [sandbox limit](./limits.md#sandbox-limits)<br />**Minimum:** `0.25`<br />**Maximum:** the [sandbox limit](./limits.md#sandbox-limits) |

> **Notes:**
>
> - **Permissions:** The request requires the `write:sandboxes` permission.
> - **Results:** The returned sandbox has no resources until it is read again.
> - **Behaviour:** The sandbox boots with its CPU limit, so the CPU count inside the sandbox is the limit in vCPUs, 2 per core. A memory limit below the default memory guarantee lowers the guarantee when memory is not set.

## Fleet scaling

Fleet scaling, or horizontal scaling, raises how many sandboxes run at once. Instead of packing unrelated work into one sandbox, each user, task, or agent gets its own.

The unit of fleet scaling is the sandbox. Each sandbox is a hardware-isolated virtual machine with its own guaranteed resources, so a failure inside one sandbox does not affect the others.

Create one sandbox per user, task, or agent when work arrives, and delete it when the work is done. Creation is fast and asynchronous, so a fleet scales on demand. [Snapshot fan-out](./snapshots.md) starts each unit of work from the memory and disk of one prepared snapshot, so any number of identical sandboxes run from the same state. It works with Linux sandboxes, while macOS sandboxes start from a disk image instead, as [macOS snapshots](./macos-sandboxes.md#filesystem-snapshot) describes.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

async function runTask(shard: number): Promise<string> {
  // Each task gets its own isolated sandbox from the same snapshot
  const sandbox = await daytona.v2.createFromSnapshot('my-snapshot')
  const response = await sandbox.process.run(`python3 run.py --shard ${shard}`)

  // Delete the sandbox when the task is done
  await sandbox.delete()
  return response.stdout
}

// Create and run 20 sandboxes concurrently from the same snapshot
const results = await Promise.all(
  Array.from({ length: 20 }, (_, i) => runTask(i))
)
console.log(results)
```

| **Parameter** | **Description** |
| --- | --- |
| `snapshot` | Sets the snapshot that createFromSnapshot() restores from.<br />**Required**<br />**Format:** a snapshot name or ID<br />**Example:** `'my-snapshot'` |

> **Notes:**
>
> - **Permissions:** The requests require the `write:sandboxes` and `delete:sandboxes` permissions.
> - **Prerequisites:** The examples restore a snapshot named my-snapshot, so [create it](./snapshots.md#create-snapshots) first from a sandbox that holds the run.py script that each task runs. The snapshot must be ready.

## Workload concurrency

Workload concurrency is the running of several processes at the same time in one sandbox. The operating system shares the CPU cores between the processes, so their work overlaps in time even when there are more processes than cores.

The processes in a sandbox share the filesystem and network of the sandbox. Every command in a sandbox runs as a process, which either runs to completion before the caller continues or keeps running in the background while the caller moves on.

Run an API server, a database, and background workers side by side in one sandbox, and reach their exposed ports through [previews](./preview.md). Run starts a process and waits for it, while start returns a handle immediately and the process continues in the background. [Sessions](./process-execution.md#session-operations) are shared shells: commands in a session run sequentially and share state, so parallelism comes from separate sessions or background processes. [Pseudo terminal (PTY) sessions](./pty.md) add interactive terminals.

**Concurrent processes:**

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

// Start the server as a background process; the handle returns immediately
await sandbox.process.start('python3 -m http.server 8000')

// Other commands run concurrently in the same sandbox
const response = await sandbox.process.run({
  argv: ['python3', '-c', "import time, urllib.request as u; time.sleep(1); print(u.urlopen('http://localhost:8000').status)"],
})
console.log(response.stdout)
```

| **Parameter** | **Description** |
| --- | --- |
| `argv` | Sets the argument vector that run() executes without a shell.<br />**Example:** `['python3', '-c', 'print(1)']` |

**Background commands:**

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

// start returns a handle immediately while the command runs in the background
const handle = await sandbox.process.start('pip install numpy')

// Wait for completion and read the exit code later
const result = await handle.wait()
console.log(result.exitCode)
```

## Capacity and throughput

Capacity is the amount of compute a system can hand out, and throughput is the rate at which it takes on new work. Both set an upper bound on how far a system scales.

The size of a fleet of sandboxes is limited per sandbox and per organization. Each sandbox is held to platform and plan caps. An organization is held to a maximum number of concurrent sandboxes, and its spending is held to its credit balance.

Plan a fleet within the [resources](./sandboxes.md#resources) of each sandbox and the [organization limits](./limits.md#organization-limits) and [credit balance](../platform/billing.md) of your organization. Creates are rejected when the balance is exhausted. Release capacity as [reclaim capacity](#reclaim-capacity) describes, and keep creates efficient as [operate at scale](#operate-at-scale) describes.

| **Control**                                   | **What it limits**                                                            | **Scope**    |
| --------------------------------------------- | ----------------------------------------------------------------------------- | ------------ |
| [**Resources**](./sandboxes.md#resources) | Maximum vCPU, memory, and disk of a single sandbox                            | Sandbox      |
| [**Concurrent sandboxes**](./limits.md#organization-limits) | Sandboxes that hold or are about to hold compute: `100` on Starter, `5000` on Team | Organization |
| [**Credits**](../platform/billing.md)               | Spending across sandboxes; creates are rejected when the balance is exhausted | Organization |

### Reclaim capacity

Reclaim capacity to make compute and storage available to new work. A sandbox that has finished its work but still holds its resources keeps them from every other sandbox.

A sandbox holds its compute and storage until it is deleted. The platform reclaims a spot sandbox automatically whenever it needs the capacity.

Delete sandboxes when their work is done to release compute and storage. See [preemption](./preemption.md) for how and when the platform reclaims [spot sandboxes](./preemption.md#spot-sandboxes).

### Operate at scale

Operate at scale to keep an application efficient at high creation rates. At those rates, every retried create and every repeated status check is another request.

A create retried with the same idempotency key returns the same sandbox instead of a new one. A wait on a sandbox holds one connection open until the sandbox reaches its target state.

Make creates safe to retry with an [idempotency key](./linux-sandboxes.md#idempotency), and wait with long-polls, not tight polling. The SDKs wait on create until the sandbox runs, for up to 60 seconds by default. On the API, `wait` long-polls one sandbox, and the batch wait endpoint waits on many sandboxes over one connection. It returns once one of them reaches the target state or a terminal state, so repeat it with the IDs that are still starting until none remain.

**API:**

```bash
# Wait for one sandbox to reach running without tight polling
curl 'https://api.daytona.com/sandboxes/{sandboxId}?wait=running' \
  --header 'Authorization: Bearer YOUR_API_KEY'

# Wait on a batch over one connection (up to 200 IDs). Each request blocks for up to
# timeout_ms and returns when the first sandbox reaches running or stops starting,
# so repeat it with the IDs that are still starting, at most 10 times.
ids='{sandboxId1},{sandboxId2},{sandboxId3}'
for attempt in $(seq 10); do
  batch=$(curl --silent --show-error --fail-with-body \
    "https://api.daytona.com/sandboxes/batch-wait?ids=$ids&wait=running&timeout_ms=60000" \
    --header 'Authorization: Bearer YOUR_API_KEY') || { echo "$batch" >&2; exit 1; }
  # A sandbox that is neither starting nor running, such as failed or lost, will not start
  stopped=$(echo "$batch" | jq -r '.sandboxes[] | select(.status | IN("queued", "pending", "assigned", "booting", "running") | not) | "\(.id) \(.status)"')
  [ -z "$stopped" ] || { echo "$stopped" >&2; exit 1; }
  ids=$(echo "$batch" | jq -r '[.sandboxes[] | select(.status | IN("queued", "pending", "assigned", "booting")) | .id] | join(",")')
  [ -n "$ids" ] || break
done
[ -z "$ids" ] || { echo "Still starting: $ids" >&2; exit 1; }
```

| **Field** | **Description** |
| --- | --- |
| `ids` | Sets the sandboxes that the batch wait waits on. The response lists each of them that belongs to the project with its current status, and leaves out other IDs.<br />**Required**<br />**Format:** a comma-separated list of up to 200 sandbox IDs |
| `timeout_ms` | Sets the time in milliseconds that one batch wait request blocks.<br />**Example:** `60000` |
| `wait` | Sets the state to wait for.<br />**Example:** `running` |
