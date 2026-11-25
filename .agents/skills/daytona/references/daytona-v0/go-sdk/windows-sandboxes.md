## Contents

- Use cases
- Create a Windows sandbox
- Filesystem snapshot
- Memory snapshot
- Filesystem persistence
- Memory persistence
- Desktop
- Shell
- Lifecycle
- See Also




Daytona provides **Windows sandboxes** for AI agents that need a Windows operating system. Each Windows sandbox runs its own Windows kernel with a dedicated filesystem, network stack, and allocated vCPU, RAM, and disk.

Agents and developers can install software, run Windows applications, run commands in the command prompt or PowerShell, and control the desktop through Computer Use.

| **Term**                | **Description**                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Sandbox**             | An isolated Windows environment created on demand to run code.                                                               |
| **Windows VM**          | A sandbox that runs as a virtual machine with its own Windows kernel. The hardware enforces the boundary between sandboxes.   |
| **Sandbox class**       | The runtime of a sandbox. Windows sandboxes use the Windows class, set by the snapshot.                                      |
| **Snapshot**            | A pre-configured template that new sandboxes start from.                                                                     |
| **Toolbox**             | The Daytona daemon inside the sandbox that serves file, Git, process, and Computer Use requests.                              |
| **Shell**               | The program the toolbox runs commands with. The command prompt by default, or PowerShell when configured.                    |
> **Note: Access**
> Windows sandboxes are available to [Tier 3 and higher organizations](../platform/limits.md#tiers). <br /> Contact [support@daytona.io](mailto:support@daytona.io) to request access.

## Use cases

Windows sandboxes are used when the software, the test, or the task requires Windows.

- **Computer-use agents on Windows**: an agent operates Windows applications through screenshots, mouse and keyboard input, and the accessibility tree with [Computer Use](./computer-use-guide.md), for tasks that exist only in Windows software.
- **Windows-only software**: programs, installers, and command-line tools that have no Linux version run in an isolated machine instead of on a shared Windows server.
- **Build and test on Windows**: code, scripts, and installers are built or tested on a clean Windows machine for each run, so results do not depend on leftover state.
- **PowerShell and automation**: PowerShell scripts and Windows administration tasks run against a real Windows installation before they reach production machines.
- **Evaluation and reinforcement learning (RL)**: each test case or episode gets an identical Windows machine, started from the base snapshot or from a filesystem snapshot you prepared.
- **Long-lived agent sessions**: a Windows sandbox pauses when the agent goes idle and resumes with its processes and memory intact.
- **Branching from a running state**: a Windows sandbox is forked to try several approaches from the same point. Each fork gets its own copy of the filesystem and memory.

## Create a Windows sandbox

Create a Windows sandbox.

| **Snapshot**            | **vCPU** | **Memory** | **Storage** |
| ----------------------- | -------- | ---------- | ----------- |
| **`windows-small`**     | 1        | 4GiB       | 30GiB       |
| **`windows-medium`**    | 2        | 8GiB       | 50GiB       |
| **`windows-large`**     | 4        | 16GiB      | 50GiB       |

**Default:**

Create a Windows sandbox from a default snapshot. The snapshot sets the sandbox resources.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Click <Button>Create Sandbox</Button>
3. Select a Windows <Button>Snapshot</Button>: **`windows-small`**, **`windows-medium`**, or **`windows-large`**
4. Click <Button>Create</Button>

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
	_, _ = client.Create(ctx, types.SnapshotParams{
		Snapshot: "windows-small",
	})
}
```

**Custom:**

Create a Windows sandbox from your own snapshot. Windows snapshots are created from an existing Windows sandbox: create a sandbox from a default Windows snapshot, install and configure what you need, then create a [filesystem snapshot](#filesystem-snapshot) or a [memory snapshot](#memory-snapshot) from it. New sandboxes created from that snapshot start with the same environment.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Click <Button>Create Sandbox</Button>
3. Select a Windows <Button>Snapshot</Button>: **`windows-small`**, **`windows-medium`**, or **`windows-large`**
4. Click <Button>Create</Button>
5. Install and configure the software you need in the sandbox
6. Stop the sandbox and create a snapshot from it, for example **`my-windows-snapshot`**
7. Click <Button>Create Sandbox</Button>
8. Select the <Button>Snapshot</Button> **`my-windows-snapshot`**
9. Click <Button>Create</Button>

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
	sandbox, err := client.Create(ctx, types.SnapshotParams{Snapshot: "windows-small"})
	if err != nil {
		panic(err)
	}

	// Install and configure the software you need, then create a snapshot
	if err := sandbox.Stop(ctx); err != nil {
		panic(err)
	}
	if err := sandbox.CreateSnapshot(ctx, "my-windows-snapshot"); err != nil {
		panic(err)
	}

	// Create a Windows sandbox from your snapshot
	_, err = client.Create(ctx, types.SnapshotParams{Snapshot: "my-windows-snapshot"})
	if err != nil {
		panic(err)
	}
}
```

## Filesystem snapshot

A filesystem snapshot, also called a cold snapshot, saves the filesystem of a stopped Windows sandbox. A snapshot without the include memory option is a filesystem snapshot.

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
	sandbox, err := client.Create(ctx, types.SnapshotParams{Snapshot: "windows-small"})
	if err != nil {
		panic(err)
	}

	// Write a file to the filesystem
	if err := sandbox.FileSystem.UploadFile(ctx, []byte("done"), "setup.txt"); err != nil {
		panic(err)
	}

	// A filesystem snapshot requires a stopped sandbox
	if err := sandbox.Stop(ctx); err != nil {
		panic(err)
	}
	if err := sandbox.CreateSnapshot(ctx, "my-windows-snapshot"); err != nil {
		panic(err)
	}

	// A sandbox created from the snapshot starts with the same filesystem
	newSandbox, err := client.Create(ctx, types.SnapshotParams{Snapshot: "my-windows-snapshot"})
	if err != nil {
		panic(err)
	}
	content, err := newSandbox.FileSystem.DownloadFile(ctx, "setup.txt", nil)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(content)) // done
}
```

## Memory snapshot

A memory snapshot, also called a hot snapshot, saves the filesystem and memory of a started Windows sandbox. A sandbox created from a memory snapshot starts with its processes and open applications already running.

**API:**

```bash
curl 'https://app.daytona.io/api/sandbox/{sandboxIdOrName}/snapshot' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "name": "my-windows-hot-snapshot",
  "includeMemory": true
}'
```

## Filesystem persistence

Filesystem persistence keeps the contents of a sandbox's disk: files, installed programs, cloned repositories, and build artifacts. A sandbox with a preserved filesystem starts with its environment intact, with nothing to reinstall or rebuild.

Windows sandboxes preserve their filesystem across [stop and start](#stop--start) and [filesystem snapshots](#filesystem-snapshot) created from a sandbox. An [ephemeral sandbox](./sandboxes.md#ephemeral-sandboxes) is deleted on stop, so its filesystem is not kept.

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
	sandbox, err := client.Create(ctx, types.SnapshotParams{Snapshot: "windows-small"})
	if err != nil {
		panic(err)
	}

	// Write a file to the filesystem
	if err := sandbox.FileSystem.UploadFile(ctx, []byte("done"), "setup.txt"); err != nil {
		panic(err)
	}

	// Stop clears memory and moves the filesystem to nearby storage
	if err := sandbox.Stop(ctx); err != nil {
		panic(err)
	}

	// Start restores the filesystem and boots the sandbox
	if err := sandbox.Start(ctx); err != nil {
		panic(err)
	}
	content, err := sandbox.FileSystem.DownloadFile(ctx, "setup.txt", nil)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(content)) // done
}
```

## Memory persistence

Memory persistence keeps the runtime state of a sandbox: running processes, open applications, and everything loaded in RAM. A sandbox with preserved memory continues from the point it was frozen, with processes still running, instead of starting from a clean boot.

Windows sandboxes preserve their memory across [pause and resume](#pause--resume), [memory snapshots](#memory-snapshot) created from a sandbox, and [forks](#fork). Memory state is cleared on every stop.

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
	sandbox, err := client.Create(ctx, types.SnapshotParams{Snapshot: "windows-small"})
	if err != nil {
		panic(err)
	}

	// Start a process that runs in the background
	if err := sandbox.Process.CreateSession(ctx, "keepalive"); err != nil {
		panic(err)
	}
	response, err := sandbox.Process.ExecuteSessionCommand(ctx, "keepalive", "ping -n 3600 127.0.0.1", true, false)
	if err != nil {
		panic(err)
	}

	// Pause keeps the filesystem and memory
	if err := sandbox.Pause(ctx); err != nil {
		panic(err)
	}

	// Start resumes every process from the point where the sandbox paused
	if err := sandbox.Start(ctx); err != nil {
		panic(err)
	}
	command, err := sandbox.Process.GetSessionCommand(ctx, "keepalive", response["cmdId"].(string))
	if err != nil {
		panic(err)
	}
	fmt.Println(command["exitCode"]) // <nil>: the process is still running
}
```

## Desktop

Windows sandboxes support [Computer Use](./computer-use-guide.md) on the Windows desktop: screenshots, mouse and keyboard input, display and window information, the accessibility tree, and screen recordings.

## Shell

The toolbox runs commands with the Windows command prompt by default. To run commands with another shell, such as Windows PowerShell or PowerShell 7, set the following environment variable in the sandbox. The toolbox looks the value up on the PATH and falls back to the command prompt if it is not found. If the toolbox cannot find the command prompt, it uses Windows PowerShell.

| **Environment variable** | **Value**            | **Shell**              |
| ------------------------ | -------------------- | ---------------------- |
| **`DAYTONA_SHELL`**      | **`cmd.exe`**        | Command prompt (default) |
| **`DAYTONA_SHELL`**      | **`powershell.exe`** | Windows PowerShell     |
| **`DAYTONA_SHELL`**      | **`pwsh.exe`**       | PowerShell 7           |

The command prompt rejects command lines longer than 8191 characters. For longer commands, use a [session command](./process-code-execution.md) or PowerShell.

## Lifecycle

Every Windows sandbox moves through a lifecycle. A Windows sandbox can have several different states. Each state reflects the status of your sandbox. A Windows sandbox transitions between states in response to user actions, or automatically when one of its [timeouts](#timeouts) elapses.

| **Feature**                                           | **Persistent** | **Ephemeral** |
| ----------------------------------------------------- | -------------- | ------------- |
| **Stop and start**                    | ✓              | ✗             |
| **Pause and resume**                | ✓              | ✗             |
| **Fork**                                     | ✓              | ✓             |
| **Archive**                                           | ✗              | ✗             |
| **Delete**                                 | ✓              | ✓             |
| **Filesystem persistence** | ✓              | ✗             |
| **Memory persistence**         | ✓              | ✗             |
| **Memory snapshot**               | ✓              | ✓             |
| **Filesystem snapshot**       | ✓              | ✗             |
| **Desktop**                                           | ✓ Computer Use | ✓ Computer Use |

**Sandbox states:**

| **State**            | **Description**                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| **Pulling Snapshot** | The sandbox is pulling a snapshot.                                            |
| **Creating**         | The sandbox is being created.                                                                       |
| **Starting**         | The sandbox is starting.                                                                            |
| **Started**          | The sandbox is running and accepts requests.                                                        |
| **Stopping**         | The sandbox is stopping and does not accept new requests.                                           |
| **Stopped**          | The sandbox is stopped. The filesystem is kept and memory is cleared.                               |
| **Pausing**          | The sandbox is pausing.                                                                             |
| **Paused**           | The sandbox is paused with its filesystem and memory preserved.                                     |
| **Resuming**         | The sandbox is resuming from the paused state.                                                      |
| **Restoring**        | The sandbox is being restored.                                                                      |
| **Resizing**         | The sandbox resources are being changed.                                                            |
| **Snapshotting**     | The sandbox is creating a memory snapshot or a filesystem snapshot.                                       |
| **Forking**          | The sandbox is being forked.                                                               |
| **Deleting**         | The sandbox is being deleted.                                                                       |
| **Deleted**          | The sandbox is deleted.                                                                             |
| **Error**            | The sandbox hit an error. A recoverable error can be recovered. |

**State transitions:**

| **Initial state** | **Target state** | **Trigger**                                                         |
| ----------------- | ---------------- | ------------------------------------------------------------------- |
| **Started**       | **Stopping**     | A stop is requested, or the auto-stop interval elapses.             |
| **Stopping**      | **Stopped**      | The shutdown completes. The filesystem is kept and memory is cleared. |
| **Stopped**       | **Starting**     | A start is requested.                                               |
| **Started**       | **Pausing**      | A pause is requested, or the auto-pause interval elapses.           |
| **Pausing**       | **Paused**       | The filesystem and memory are preserved.                            |
| **Paused**        | **Resuming**     | A start is requested on a paused sandbox.                           |
| **Paused**        | **Stopping**     | A stop is requested on a paused sandbox.                            |
| **Resuming**      | **Started**      | The sandbox resumes from memory and is running.                     |
| **Started**       | **Snapshotting** | A memory snapshot is requested.                                     |
| **Stopped**       | **Snapshotting** | A filesystem snapshot is requested.                                 |
| **Started**       | **Forking**      | A fork is requested.                                                |
| **Started**       | **Deleting**     | A delete is requested, or an ephemeral sandbox is stopped.          |
| **Stopped**       | **Deleting**     | A delete is requested, or the auto-delete interval elapses.         |
| **Deleting**      | **Deleted**      | The sandbox is removed and its resources are released.              |

### Wait for state

Wait until a Windows sandbox reaches the started or stopped state.

```go
err := sandbox.WaitForStart(ctx, 60*time.Second)
err = sandbox.WaitForStop(ctx, 60*time.Second)
```

### Stop / start

Stop a sandbox. The sandbox moves to the **stopped** state when shutdown completes. While a stop is in progress, the sandbox is in the **stopping** state and does not accept new requests.

Stopping shuts down the virtual machine while preserving the filesystem. Memory state is cleared. To preserve running process state without consuming CPU, use [pause / resume](#pause--resume).

Start a sandbox.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Click the stop icon <Button>⏹</Button> next to the sandbox you want to stop
3. Click the start icon <Button>▶</Button> next to the sandbox you want to start

```go
sandbox.Stop(ctx)
sandbox.Start(ctx)
```

### Pause / resume

Pause and resume a sandbox.

The filesystem and memory state are preserved, and CPU is no longer consumed.

```go
sandbox.Pause(ctx)

// Resume the paused sandbox
sandbox.Start(ctx)
```

### Fork

Fork a sandbox.

Forking creates a duplicate of a Windows sandbox's filesystem and memory state in a new sandbox. The forked sandbox is fully independent: it can be started, stopped, and deleted without affecting the original.

Daytona tracks the parent-child relationship in a fork tree, so you can trace a fork's lineage back to the sandbox it was created from. You can fork a fork to build branches. The parent sandbox cannot be deleted while it has active fork children.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Click the three-dot menu (**⋮**) next to the started Windows sandbox you want to fork
3. Select <Button>Fork</Button>

```go
name := "my-forked-sandbox"
forked, err := sandbox.Fork(ctx, &name)
if err != nil {
	return err
}
```

### Delete

Delete a sandbox.
> **Note:**
> By default delete is fire-and-forget: it returns as soon as the API accepts the deletion request, without waiting for the sandbox to be destroyed. Pass the `wait` flag to block until the sandbox reaches the destroyed state.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Click <Button>Delete</Button> next to the sandbox you want to delete

```go
err = sandbox.Delete(ctx)

// Block until the sandbox is deleted
err = sandbox.DeleteAndWait(ctx, 60*time.Second)
```

### Timeouts

Daytona stops, pauses, or deletes a Windows sandbox when a timeout elapses. Each timeout is set in minutes. Zero disables auto-stop, auto-pause, and wall-clock TTL. Zero does not disable auto-delete: auto-delete set to zero deletes the sandbox as soon as it stops. To disable auto-delete, set it to -1. Windows sandboxes do not support auto-archive.

| **Interval**                                           | **Default**                                    | **Action**                                             |
| ------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------ |
| **Auto-stop**     | Disabled when auto-pause is active             | Stops the sandbox after inactivity.                    |
| **Auto-pause**                              | 60 minutes when neither interval is set        | Pauses the sandbox after inactivity.                   |
| **Auto-delete** | Not set                                        | Deletes a stopped sandbox.                             |
| **Wall-clock TTL**                      | Not set                                        | Deletes the sandbox at a fixed deadline, in any state. |

#### Auto-pause

The auto-pause interval sets the amount of time after which an idle VM sandbox is automatically [paused](#pause--resume). Auto-pause applies only to [VM sandboxes](./sandboxes.md#vm-sandboxes) and is mutually exclusive with the [auto-stop interval](./sandboxes.md#auto-stop-interval): at most one of the two intervals may be non-zero. Ephemeral sandboxes cannot have auto-pause enabled.

The interval is set in minutes:

- **`0`**: disables the auto-pause functionality
- if neither auto-pause nor auto-stop is set, non-ephemeral sandbox classes that support pausing default to an auto-pause interval of 60 minutes with auto-stop disabled

The sandbox pauses after no new events occur for the specified interval. Events include sandbox state changes and interactions with the sandbox through the SDK. Interactions through [sandbox previews](./preview.md) do not reset the timer.

```go
autoPauseInterval := 60
sandbox, err := client.Create(ctx, types.SnapshotParams{
	Snapshot: "windows-small",
	SandboxBaseParams: types.SandboxBaseParams{
		AutoPauseInterval: &autoPauseInterval,
	},
})
```

#### Wall-clock TTL

The wall-clock TTL (time-to-live) sets a hard upper bound on how long a sandbox may exist. Unlike the [auto-delete interval](./sandboxes.md#auto-delete-interval), which counts time only while the sandbox is stopped, TTL runs as wall-clock time from creation (or from the moment you last set it) and destroys the sandbox in any state: started, stopped, paused, or archived.

Set `ttl_minutes` when creating a sandbox, or update it later. The value is in minutes:

- **`0`**: disables the TTL
- if not set, the sandbox has no TTL deadline

Calling `set_ttl` after creation resets the deadline from the current moment. Use wall-clock TTL for agent sessions, CI jobs, and any sandbox that must not outlive a fixed deadline.

```go
ttlMinutes := 120
sandbox, err := client.Create(ctx, types.SnapshotParams{
	Snapshot: "windows-small",
	SandboxBaseParams: types.SandboxBaseParams{
		TtlMinutes: &ttlMinutes,
	},
})
```

## See Also
- [Python SDK - windows-sandboxes](../python-sdk/windows-sandboxes.md)
- [TypeScript SDK - windows-sandboxes](../typescript-sdk/windows-sandboxes.md)
- [Java SDK - windows-sandboxes](../java-sdk/windows-sandboxes.md)
