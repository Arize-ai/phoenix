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

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.model.CreateSandboxFromImageParams;
import io.daytona.sdk.model.Resources;

public class App {
    public static void main(String[] args) {
        try (Daytona daytona = new Daytona()) {
            CreateSandboxFromImageParams params = new CreateSandboxFromImageParams();
            params.setImage("ubuntu:22.04");

            // Reserve 2 vCPUs, 4GiB of RAM, and 8GiB of disk for the sandbox
            Resources resources = new Resources();
            resources.setCpu(2);
            resources.setMemory(4);
            resources.setDisk(8);
            params.setResources(resources);

            Sandbox sandbox = daytona.create(params);
        }
    }
}
```

**Resize:**

Change the resource allocation of an existing sandbox.


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

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.model.CreateSandboxFromSnapshotParams;
import io.daytona.sdk.model.ExecuteResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.IntStream;

public class App {
    public static void main(String[] args) {
        try (Daytona daytona = new Daytona()) {
            // Create and run 20 sandboxes concurrently from the same snapshot
            List<CompletableFuture<String>> futures = IntStream.range(0, 20)
                .mapToObj(shard -> CompletableFuture.supplyAsync(() -> {
                    CreateSandboxFromSnapshotParams params = new CreateSandboxFromSnapshotParams();
                    params.setSnapshot("my-env-snapshot");
                    params.setAutoDeleteInterval(0); // ephemeral

                    // Each task gets its own isolated, ephemeral sandbox
                    Sandbox sandbox = daytona.create(params);
                    ExecuteResponse response = sandbox.getProcess()
                        .executeCommand("python3 run.py --shard " + shard);

                    // Stop deletes the ephemeral sandbox
                    sandbox.stop();
                    return response.getResult();
                }))
                .toList();

            List<String> results = new ArrayList<>();
            for (CompletableFuture<String> future : futures) {
                results.add(future.join());
            }
            System.out.println(results);
        }
    }
}
```

**Fork:**

**Forking** duplicates a running VM sandbox, filesystem and memory included, into an independent sandbox. Where snapshot fan-out distributes a prepared baseline, forks branch live state: each fork continues from the exact point the original was at. Forking is supported for [VM sandboxes](./sandboxes.md#vm-sandboxes) only.

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.model.CreateSandboxFromSnapshotParams;

import java.util.ArrayList;
import java.util.List;

public class App {
    public static void main(String[] args) {
        try (Daytona daytona = new Daytona()) {
            CreateSandboxFromSnapshotParams params = new CreateSandboxFromSnapshotParams();
            params.setSnapshot("daytona-vm-small");
            Sandbox sandbox = daytona.create(params);

            // Prepare live state once: running processes, loaded caches, open connections
            sandbox.getProcess().executeCommand("python3 warmup.py");

            // Each fork continues from the same live state, fully independent
            List<Sandbox> forks = new ArrayList<>();
            for (int i = 0; i < 5; i++) {
                forks.add(sandbox.fork("agent-" + i, 60));
            }
        }
    }
}
```

**Linked sandboxes:**

**Linked sandboxes** attach ephemeral child sandboxes to a parent. Children are scheduled on the same runner as the parent and share a link network, so the group communicates over local connections. One parent may have many children, and deleting the parent deletes all of them.

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.model.CreateSandboxFromSnapshotParams;
import io.daytona.sdk.model.ExecuteResponse;

import java.util.ArrayList;
import java.util.List;

public class App {
    public static void main(String[] args) {
        try (Daytona daytona = new Daytona()) {
            Sandbox parent = daytona.create();

            // Children are co-located with the parent and share a link network
            List<Sandbox> children = new ArrayList<>();
            for (int i = 0; i < 3; i++) {
                CreateSandboxFromSnapshotParams childParams = new CreateSandboxFromSnapshotParams();
                childParams.setLinkedSandbox(parent.getId());
                childParams.setAutoDeleteInterval(0); // linked sandboxes must be ephemeral
                children.add(daytona.create(childParams));
            }

            // Each sandbox on the link network is reachable by name or ID
            ExecuteResponse response = children.get(0).getProcess()
                .executeCommand("curl http://" + parent.getName() + ":3000/");
        }
    }
}
```

## Workload concurrency

Workload concurrency runs multiple processes inside a single sandbox. A single sandbox can run an API server, a database, and background workers side by side: all processes share the sandbox's filesystem and network, and exposed ports are reachable through [previews](./preview.md).

A sandbox runs concurrent processes through [sessions](./process-code-execution.md#session-operations). Each session is an independent shell with its own state: working directory, environment variables, and command history.

Commands within a session run sequentially, so parallelism comes from running multiple sessions. Commands started with `run_async` return immediately and run in the background, and [PTY sessions](./pty.md) add interactive terminals.

**Concurrent sessions:**

Run multiple independent shells in the same sandbox so processes can execute in parallel.

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.model.SessionExecuteRequest;
import io.daytona.sdk.model.SessionExecuteResponse;

public class App {
    public static void main(String[] args) {
        try (Daytona daytona = new Daytona()) {
            Sandbox sandbox = daytona.create();

            // Each session is an independent shell inside the same sandbox
            sandbox.getProcess().createSession("server");
            sandbox.getProcess().createSession("worker");

            // The server runs in the background while the worker session stays free
            sandbox.getProcess().executeSessionCommand(
                "server",
                new SessionExecuteRequest("python3 -m http.server 8000", true)
            );
            SessionExecuteResponse response = sandbox.getProcess().executeSessionCommand(
                "worker",
                new SessionExecuteRequest("curl -s http://localhost:8000", false)
            );
            System.out.println(response.getOutput());
        }
    }
}
```

**Background commands:**

Start a command asynchronously, then poll its status by command ID.

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.model.Command;
import io.daytona.sdk.model.SessionExecuteRequest;
import io.daytona.sdk.model.SessionExecuteResponse;

public class App {
    public static void main(String[] args) {
        try (Daytona daytona = new Daytona()) {
            Sandbox sandbox = daytona.create();
            sandbox.getProcess().createSession("build");

            // Async commands return immediately with a command ID
            SessionExecuteResponse command = sandbox.getProcess().executeSessionCommand(
                "build",
                new SessionExecuteRequest("make build", true)
            );

            // Check on the command later by its ID
            Command status = sandbox.getProcess().getSessionCommand(
                "build",
                command.getCmdId()
            );
            System.out.println(status.getExitCode());
        }
    }
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
