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

```go
package main

import (
	"context"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()

	// Reserve 2 vCPUs, 4GiB of RAM, and 8GiB of disk for the sandbox
	sandbox, err := client.Create(ctx, types.ImageParams{
		Image: "ubuntu:22.04",
		Resources: &types.Resources{
			CPU:    2,
			Memory: 4,
			Disk:   8,
		},
	})
	if err != nil {
		// handle error
	}
	_ = sandbox
}
```

**Resize:**

Change the resource allocation of an existing sandbox.

```go
package main

import (
	"context"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()

	sandbox, err := client.Get(ctx, "my-sandbox")
	if err != nil {
		// handle error
	}

	// CPU and memory can be increased while the sandbox is running
	err = sandbox.Resize(ctx, &types.Resources{CPU: 4, Memory: 8})
	if err != nil {
		// handle error
	}

	// Decreasing CPU or memory, or increasing disk, requires a stopped sandbox
	err = sandbox.Stop(ctx)
	if err != nil {
		// handle error
	}
	err = sandbox.Resize(ctx, &types.Resources{CPU: 2, Memory: 4, Disk: 20})
	if err != nil {
		// handle error
	}
	err = sandbox.Start(ctx)
	if err != nil {
		// handle error
	}
}
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

```go
package main

import (
	"context"
	"fmt"
	"sync"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()

	results := make([]string, 20)
	var wg sync.WaitGroup

	// Create and run 20 sandboxes concurrently from the same snapshot
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(shard int) {
			defer wg.Done()

			// Each task gets its own isolated, ephemeral sandbox
			sandbox, err := client.Create(ctx, types.SnapshotParams{
				Snapshot: "my-env-snapshot",
				SandboxBaseParams: types.SandboxBaseParams{
					Ephemeral: true,
				},
			})
			if err != nil {
				return
			}

			response, err := sandbox.Process.ExecuteCommand(
				ctx, fmt.Sprintf("python3 run.py --shard %d", shard),
			)
			if err != nil {
				return
			}

			// Stop deletes the ephemeral sandbox
			_ = sandbox.Stop(ctx)
			results[shard] = response.Result
		}(i)
	}

	wg.Wait()
	fmt.Println(results)
}
```

**Fork:**

**Forking** duplicates a running VM sandbox, filesystem and memory included, into an independent sandbox. Where snapshot fan-out distributes a prepared baseline, forks branch live state: each fork continues from the exact point the original was at. Forking is supported for [VM sandboxes](./sandboxes.md#vm-sandboxes) only.

```go
package main

import (
	"context"
	"fmt"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()

	sandbox, err := client.Create(ctx, types.SnapshotParams{
		Snapshot: "daytona-vm-small",
	})
	if err != nil {
		// handle error
	}

	// Prepare live state once: running processes, loaded caches, open connections
	_, err = sandbox.Process.ExecuteCommand(ctx, "python3 warmup.py")
	if err != nil {
		// handle error
	}

	// Each fork continues from the same live state, fully independent
	forks := make([]*daytona.Sandbox, 5)
	for i := 0; i < 5; i++ {
		name := fmt.Sprintf("agent-%d", i)
		forks[i], err = sandbox.Fork(ctx, &name)
		if err != nil {
			// handle error
		}
	}
}
```

**Linked sandboxes:**

**Linked sandboxes** attach ephemeral child sandboxes to a parent. Children are scheduled on the same runner as the parent and share a link network, so the group communicates over local connections. One parent may have many children, and deleting the parent deletes all of them.

```go
package main

import (
	"context"
	"fmt"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()

	parent, err := client.Create(ctx, types.SnapshotParams{})
	if err != nil {
		// handle error
	}

	// Children are co-located with the parent and share a link network
	children := make([]*daytona.Sandbox, 3)
	for i := 0; i < 3; i++ {
		children[i], err = client.Create(ctx, types.SnapshotParams{
			SandboxBaseParams: types.SandboxBaseParams{
				LinkedSandbox: parent.ID,
				Ephemeral:     true,
			},
		})
		if err != nil {
			// handle error
		}
	}

	// Each sandbox on the link network is reachable by name or ID
	response, err := children[0].Process.ExecuteCommand(
		ctx, fmt.Sprintf("curl http://%s:3000/", parent.Name),
	)
	if err != nil {
		// handle error
	}
	fmt.Println(response.Result)
}
```

## Workload concurrency

Workload concurrency runs multiple processes inside a single sandbox. A single sandbox can run an API server, a database, and background workers side by side: all processes share the sandbox's filesystem and network, and exposed ports are reachable through [previews](./preview.md).

A sandbox runs concurrent processes through [sessions](./process-code-execution.md#session-operations). Each session is an independent shell with its own state: working directory, environment variables, and command history.

Commands within a session run sequentially, so parallelism comes from running multiple sessions. Commands started with `run_async` return immediately and run in the background, and [PTY sessions](./pty.md) add interactive terminals.

**Concurrent sessions:**

Run multiple independent shells in the same sandbox so processes can execute in parallel.

```go
package main

import (
	"context"
	"fmt"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()

	sandbox, err := client.Create(ctx, types.SnapshotParams{})
	if err != nil {
		// handle error
	}

	// Each session is an independent shell inside the same sandbox
	err = sandbox.Process.CreateSession(ctx, "server")
	if err != nil {
		// handle error
	}
	err = sandbox.Process.CreateSession(ctx, "worker")
	if err != nil {
		// handle error
	}

	// The server runs in the background while the worker session stays free
	_, err = sandbox.Process.ExecuteSessionCommand(
		ctx, "server", "python3 -m http.server 8000", true, false,
	)
	if err != nil {
		// handle error
	}
	response, err := sandbox.Process.ExecuteSessionCommand(
		ctx, "worker", "curl -s http://localhost:8000", false, false,
	)
	if err != nil {
		// handle error
	}
	fmt.Println(response["stdout"])
}
```

**Background commands:**

Start a command asynchronously, then poll its status by command ID.

```go
package main

import (
	"context"
	"fmt"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()

	sandbox, err := client.Create(ctx, types.SnapshotParams{})
	if err != nil {
		// handle error
	}

	err = sandbox.Process.CreateSession(ctx, "build")
	if err != nil {
		// handle error
	}

	// Async commands return immediately with a command ID
	command, err := sandbox.Process.ExecuteSessionCommand(
		ctx, "build", "make build", true, false,
	)
	if err != nil {
		// handle error
	}
	cmdID := command["id"].(string)

	// Check on the command later by its ID
	status, err := sandbox.Process.GetSessionCommand(ctx, "build", cmdID)
	if err != nil {
		// handle error
	}
	fmt.Println(status["exitCode"])
}
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
- [TypeScript SDK - scale](../typescript-sdk/scale.md)
- [Java SDK - scale](../java-sdk/scale.md)
