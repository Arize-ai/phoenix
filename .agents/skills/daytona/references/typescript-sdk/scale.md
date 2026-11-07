## Contents

- Sandbox scaling
- Fleet scaling
- Workload concurrency
- Capacity and throughput
- See Also




Daytona sandboxes are designed to be created and operated at high volume. A single sandbox scales up by resizing its reserved resources, a fleet scales out by running many sandboxes at once, and each sandbox runs multiple processes concurrently.

Unlike request-based execution environments, a sandbox is a long-lived computer: processes are not terminated after a request completes, so running services, open connections, and background workers persist until the sandbox stops.

Scale operates along three dimensions:

| **Dimension**            | **What scales**                                  | **Mechanisms**                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sandbox (vertical)       | vCPU, RAM, and disk of a single sandbox          | • <u>[**Custom resources**](./sandboxes.md#resources)</u> <br /> • <u>[**Resize**](./sandboxes.md#resize-sandboxes)</u>                                                                                                                       |
| Fleet (horizontal)       | Number of sandboxes running at the same time     | • <u>[**Snapshot fan-out**](./snapshots.md)</u> <br /> • <u>[**Fork**](./sandboxes.md#fork-sandboxes)</u> <br /> • <u>[**Linked sandboxes**](./sandboxes.md#linked-sandboxes)</u>                                                         |
| Workload (concurrency)   | Concurrent processes inside a single sandbox     | • <u>[**Sessions**](./process-code-execution.md#session-operations)</u> <br /> • <u>[**Async commands**](./process-code-execution.md#session-operations)</u> <br /> • <u>[**PTY sessions**](./pty.md)</u>                                 |

## Sandbox scaling

Sandbox scaling changes the resources of a single sandbox: **vCPU**, **memory**, and **disk**. Resources are reserved when the sandbox is created and can be changed later by resizing.

Resources are set differently depending on how the sandbox is created:

- **From an image**: set **`resources`** on the create parameters
- **From a snapshot**: the sandbox inherits the resources defined on the snapshot

Resizing changes the allocation of an existing sandbox. On a running sandbox, CPU and memory can be increased without interruption. Decreasing CPU or memory, or increasing disk, requires the sandbox to be stopped first. Disk can only grow, and GPU allocation cannot be resized. Every allocation must stay within your organization's per-sandbox limits.

**Custom resources:**

Reserve CPU, memory, and disk when creating a sandbox from an image.

```typescript
import { Daytona, Image } from '@daytona/sdk'

const daytona = new Daytona()

// Reserve 2 vCPUs, 4GiB of RAM, and 8GiB of disk for the sandbox
const sandbox = await daytona.create({
  image: Image.base('ubuntu:22.04'),
  resources: { cpu: 2, memory: 4, disk: 8 },
})
```

**Resize:**

Change the resource allocation of an existing sandbox.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.get('my-sandbox')

// CPU and memory can be increased while the sandbox is running
await sandbox.resize({ cpu: 4, memory: 8 })

// Decreasing CPU or memory, or increasing disk, requires a stopped sandbox
await sandbox.stop()
await sandbox.resize({ cpu: 2, memory: 4, disk: 20 })
await sandbox.start()
```

## Fleet scaling

Fleet scaling raises the number of sandboxes running at the same time. The unit of scale is the sandbox itself: instead of packing unrelated workloads into one environment, create one sandbox per user, task, or agent.

Sandboxes are isolated from each other, so a fleet scales linearly: each new sandbox adds capacity without contention, and a failure in one sandbox does not affect the others.

The mechanisms differ in what state each new sandbox starts with:

| **Mechanism**                                                              | **Starting state**                                                    | **Use**                                                                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| <u>[**Snapshot fan-out**](./snapshots.md)</u>                          | Filesystem from the snapshot; hot snapshots add memory state           | Any number of identical environments from one prepared snapshot                     |
| <u>[**Fork**](./sandboxes.md#fork-sandboxes)</u>                       | Filesystem and memory of a running VM sandbox                          | Branch a live environment into independent copies                                   |
| <u>[**Linked sandboxes**](./sandboxes.md#linked-sandboxes)</u>         | Fresh environment, co-located with a parent on the same runner         | Coordinated groups with a local network between parent and children                 |

**Snapshot fan-out:**

**Snapshot fan-out** is the default pattern: prepare the environment once, capture it as a snapshot, and create any number of sandboxes from it. Each sandbox starts with the environment intact, with nothing to reinstall. Sandboxes created from a [hot snapshot](./snapshots.md#create-snapshot-from-sandbox) start with processes already running.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

async function runTask(shard: number): Promise<string> {
  // Each task gets its own isolated, ephemeral sandbox
  const sandbox = await daytona.create({
    snapshot: 'my-env-snapshot',
    ephemeral: true,
  })
  const response = await sandbox.process.executeCommand(
    `python3 run.py --shard ${shard}`
  )

  // Stop deletes the ephemeral sandbox
  await sandbox.stop()
  return response.result
}

// Create and run 20 sandboxes concurrently from the same snapshot
const results = await Promise.all(
  Array.from({ length: 20 }, (_, i) => runTask(i))
)
console.log(results)
```

**Fork:**

**Forking** duplicates a running VM sandbox, filesystem and memory included, into an independent sandbox. Where snapshot fan-out distributes a prepared baseline, forks branch live state: each fork continues from the exact point the original was at. Forking is supported for [VM sandboxes](./sandboxes.md#vm-sandboxes) only.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.create({ snapshot: 'daytona-vm-small' })

// Prepare live state once: running processes, loaded caches, open connections
await sandbox.process.executeCommand('python3 warmup.py')

// Each fork continues from the same live state, fully independent
const forks = await Promise.all(
  Array.from({ length: 5 }, (_, i) =>
    sandbox.fork({ name: `agent-${i}` })
  )
)
```

**Linked sandboxes:**

**Linked sandboxes** attach ephemeral child sandboxes to a parent. Children are scheduled on the same runner as the parent and share a link network, so the group communicates over local connections. One parent may have many children, and deleting the parent deletes all of them.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const parent = await daytona.create()

// Children are co-located with the parent and share a link network
const children = await Promise.all(
  Array.from({ length: 3 }, () =>
    daytona.create({
      linkedSandbox: parent.id,
      ephemeral: true,
    })
  )
)

// Each sandbox on the link network is reachable by name or ID
const response = await children[0].process.executeCommand(
  `curl http://${parent.name}:3000/`
)
```

## Workload concurrency

Workload concurrency runs multiple processes inside a single sandbox. A single sandbox can run an API server, a database, and background workers side by side: all processes share the sandbox's filesystem and network, and exposed ports are reachable through [previews](./preview.md).

A sandbox runs concurrent processes through [sessions](./process-code-execution.md#session-operations). Each session is an independent shell with its own state: working directory, environment variables, and command history.

Commands within a session run sequentially, so parallelism comes from running multiple sessions. Commands started with `run_async` return immediately and run in the background, and [PTY sessions](./pty.md) add interactive terminals.

**Concurrent sessions:**

Run multiple independent shells in the same sandbox so processes can execute in parallel.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.create()

// Each session is an independent shell inside the same sandbox
await sandbox.process.createSession('server')
await sandbox.process.createSession('worker')

// The server runs in the background while the worker session stays free
await sandbox.process.executeSessionCommand('server', {
  command: 'python3 -m http.server 8000',
  runAsync: true,
})
const response = await sandbox.process.executeSessionCommand('worker', {
  command: 'curl -s http://localhost:8000',
})
console.log(response.output)
```

**Background commands:**

Start a command asynchronously, then poll its status by command ID.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.create()
await sandbox.process.createSession('build')

// Async commands return immediately with a command ID
const command = await sandbox.process.executeSessionCommand('build', {
  command: 'make build',
  runAsync: true,
})

// Check on the command later by its ID
const status = await sandbox.process.getSessionCommand('build', command.cmdId!)
console.log(status.exitCode)
```

## Capacity and throughput

Fleet size and creation rate operate within your organization's limits. Both are [tier-based](../platform/limits.md#tiers) and raised by verification steps or by contacting support.

| **Control**                                                       | **What it limits**                                                    | **Scope**                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------- |
| <u>[**Compute pool**](../platform/limits.md#resources)</u>              | Total vCPU, RAM, and storage across all running sandboxes              | Organization, per region and sandbox class        |
| <u>[**Per-sandbox limits**](../platform/limits.md)</u>   | Maximum vCPU, RAM, and storage of a single sandbox                     | Sandbox                                           |
| <u>[**Rate limits**](../platform/limits.md#rate-limits)</u>             | Sandbox creation, lifecycle operations, and API requests per minute    | Organization                                      |

To scale beyond the shared compute pool, [bring your own compute (BYOC)](../platform/bring-your-own-compute.md) attaches your own runner nodes in custom regions, which have no concurrent resource usage limits.

### Reclaiming capacity

The compute pool is shared by running sandboxes only: stopped, paused, and archived sandboxes free their reserved CPU and memory back to the pool. A fleet can therefore be much larger than the pool, as long as the concurrently running subset fits.

Reclamation runs automatically. [Ephemeral sandboxes](./sandboxes.md#ephemeral-sandboxes) delete themselves on stop, and the [auto-stop, auto-pause, and auto-delete intervals](./sandboxes.md#automated-lifecycle-management) reclaim capacity from idle sandboxes without manual intervention. See [persistence](../platform/persistence.md#retention-and-lifecycle) for details.

### Operating at scale

At high creation rates, two practices keep an application within its rate limits.

- Handle [rate limit errors](../platform/limits.md#rate-limit-errors): the SDKs raise **`DaytonaRateLimitError`** when a limit is exceeded, and the returned headers indicate how long to wait before retrying the request.
- Use [webhooks](../platform/webhooks.md) to track sandbox state changes instead of polling. Webhooks deliver state changes as they happen, so no requests are spent checking for status.

## See Also
- [Python SDK - scale](../python-sdk/scale.md)
