## Contents

- Filesystem persistence
- Memory persistence
- Persistence beyond a sandbox
- Retention and lifecycle
- Opting out of persistence
- See Also




Daytona sandboxes are persistent by default. Stopping a sandbox does not destroy it: the sandbox keeps its identity, its filesystem, and its configuration, and can be started again at any point with all files, installed packages, and repositories intact. A sandbox is only deleted when you delete it, mark it as [ephemeral](../python-sdk/sandboxes.md#ephemeral-sandboxes), or set an [auto-delete interval](../python-sdk/sandboxes.md#auto-delete-interval).

Persistence operates at three layers:

| **Layer**        | **What is preserved**                                           | **Mechanisms**                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filesystem       | Files, installed packages, cloned repositories, build artifacts | • <u>[**Stop / start**](../python-sdk/sandboxes.md#stop-sandboxes)</u> <br /> • <u>[**Archive**](../python-sdk/sandboxes.md#archive-sandboxes)</u> <br /> • <u>[**Cold snapshots**](../python-sdk/snapshots.md#create-snapshot-from-sandbox)</u>     |
| Memory           | Running processes, open connections, loaded application state   | • <u>[**Pause / resume**](../python-sdk/sandboxes.md#pause--resume-sandboxes)</u> <br /> • <u>[**Hot snapshots**](../python-sdk/snapshots.md#create-snapshot-from-sandbox)</u> <br /> • <u>[**Fork**](../python-sdk/sandboxes.md#fork-sandboxes)</u> |
| External storage | Data that outlives any single sandbox                           | • <u>[**Volumes**](../python-sdk/volumes.md)</u> <br /> • <u>[**Mount external storage**](../python-sdk/mount-external-storage.md)</u>                                                                                                       |

The diagram demonstrates [VM (Linux VM and Windows) sandbox](../python-sdk/sandboxes.md#vm-sandboxes) states and transitions with [filesystem](#filesystem-persistence) and [memory](#memory-persistence) persistence. Container sandboxes preserve the filesystem across stop and start, and do not support pause/resume; memory is cleared on every stop.

## Filesystem persistence

Filesystem persistence keeps the contents of a sandbox's disk: files, installed packages, cloned repositories, and build artifacts. A sandbox with a preserved filesystem starts with its environment intact, with nothing to reinstall or rebuild.

Sandboxes preserve their filesystem across **stop and start** cycles, **archive**, and **snapshots created from a sandbox (cold snapshots)**. Sandbox classes differ in where and how the preserved filesystem is stored while the sandbox is stopped:

| **Sandbox class**                          | **Filesystem persistence**                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container                                  | Filesystem is preserved through <u>[**stop / start**](../python-sdk/sandboxes.md#stop-sandboxes)</u>: it stays on the runner and counts against disk quota while stopped. <u>[**Archive**](../python-sdk/sandboxes.md#archive-sandboxes)</u> moves it to object storage and frees the quota; starting an archived sandbox restores it. Use <u>[**cold snapshots**](../python-sdk/snapshots.md#create-snapshot-from-sandbox)</u> to capture the filesystem. |
| VM sandboxes <br /> (Linux VM and Windows) | Filesystem is preserved through <u>[**stop / start**](../python-sdk/sandboxes.md#stop-sandboxes)</u>: stopping offloads it to nearby storage and releases disk quota, starting restores it. Archive is not needed. Use <u>[**cold snapshots**](../python-sdk/snapshots.md#create-snapshot-from-sandbox)</u> to capture the filesystem.                                                                                                             |
| GPU                                        | Ephemeral by design: deleted on stop, filesystem is not preserved. Use <u>[**volumes**](../python-sdk/volumes.md)</u> to persist results.                                                                                                                                                                                                                                                                                                  |

**Container:**

**Stop / start:**

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.create()

# Write state to the filesystem
sandbox.fs.upload_file(b"intermediate results", "results.txt")

# Stop clears memory; the filesystem is preserved on the runner
sandbox.stop()

# Start returns the filesystem exactly as it was
sandbox.start()
response = sandbox.process.exec("cat results.txt")
print(response.result)  # intermediate results
```

**Archive:**

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.get("my-sandbox")

# Archive a stopped sandbox: the filesystem moves to object storage
# and no longer counts against disk quota
sandbox.stop()
sandbox.archive()

# Start restores the filesystem from object storage
sandbox.start()
```

**Cold snapshot:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
sandbox = daytona.create()

# Prepare the environment to capture
sandbox.process.exec("pip install requests")

# Cold snapshot captures the filesystem of a stopped sandbox
sandbox.stop()
sandbox.create_snapshot("my-env-snapshot")

# Any number of new sandboxes can start from the same snapshot
clone = daytona.create(CreateSandboxFromSnapshotParams(snapshot="my-env-snapshot"))
response = clone.process.exec("pip show requests")
print(response.result)  # requests is already installed
```

**Linux VM:**

**Stop / start:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="daytona-vm-small"))

# Write state to the filesystem
sandbox.fs.upload_file(b"intermediate results", "results.txt")

# Stop clears memory and offloads the filesystem to nearby storage
sandbox.stop()

# Start restores the filesystem exactly as it was
sandbox.start()
response = sandbox.process.exec("cat results.txt")
print(response.result)  # intermediate results
```

**Cold snapshot:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="daytona-vm-small"))

# Prepare the environment to capture
sandbox.process.exec("pip install requests")

# Cold snapshot captures the filesystem of a stopped sandbox
sandbox.stop()
sandbox.create_snapshot("my-vm-env-snapshot")

# Any number of new sandboxes can start from the same snapshot
clone = daytona.create(CreateSandboxFromSnapshotParams(snapshot="my-vm-env-snapshot"))
response = clone.process.exec("pip show requests")
print(response.result)  # requests is already installed
```

**Windows:**

**Stop / start:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="windows-small"))

# Write state to the filesystem
sandbox.fs.upload_file(b"intermediate results", "results.txt")

# Stop clears memory and offloads the filesystem to nearby storage
sandbox.stop()

# Start restores the filesystem exactly as it was
sandbox.start()
```

**Cold snapshot:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="windows-small"))

# Cold snapshot captures the filesystem of a stopped sandbox
sandbox.stop()
sandbox.create_snapshot("my-windows-env-snapshot")

# Any number of new sandboxes can start from the same snapshot
clone = daytona.create(CreateSandboxFromSnapshotParams(snapshot="my-windows-env-snapshot"))
```

**GPU:**

**Persist to volume:**

```python
from daytona import CreateSandboxFromSnapshotParams, Daytona, VolumeMount

daytona = Daytona()
volume = daytona.volume.get("gpu-results", create=True)

# GPU sandboxes are ephemeral: mount a volume to keep results
sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    snapshot="daytona-gpu",
    ephemeral=True,
    volumes=[VolumeMount(volume_id=volume.id, mount_path="/home/daytona/results")],
))

# Write results to the volume before the sandbox stops
sandbox.process.exec("cp model-output.json /home/daytona/results/")

# The sandbox is deleted on stop; the volume and its data persist
sandbox.stop()
```

## Memory persistence

Memory persistence keeps the runtime state of a sandbox: running processes, open connections, and everything loaded in RAM. A sandbox with preserved memory continues from the point it was frozen, with processes still running, instead of starting from a clean boot.

Sandboxes preserve their memory across **pause and resume** cycles, **snapshots created from a sandbox (hot snapshots)**, and **forks**. Memory state is cleared on every stop. Sandbox classes differ in whether memory can be preserved without keeping the sandbox running:

| **Sandbox class**                          | **Memory persistence**                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container                                  | Memory persists only while the sandbox is running. Set the <u>[**auto-stop interval**](../python-sdk/sandboxes.md#auto-stop-interval)</u> to `0` to run indefinitely, or relaunch processes after each start. Pause is not supported.                                                                                                                                                 |
| VM sandboxes <br /> (Linux VM and Windows) | Memory is preserved through <u>[**pause / resume**](../python-sdk/sandboxes.md#pause--resume-sandboxes)</u>: pausing freezes the VM with memory intact, resuming continues all processes from the point they were frozen. Use <u>[**hot snapshots**](../python-sdk/snapshots.md#create-snapshot-from-sandbox)</u> or <u>[**forks**](../python-sdk/sandboxes.md#fork-sandboxes)</u> to capture memory. |
| GPU                                        | Ephemeral by design: deleted on stop, and memory is not preserved. Use <u>[**volumes**](../python-sdk/volumes.md)</u> to persist results of a GPU sandbox.                                                                                                                                                                                                                            |

**Linux VM:**

**Pause / resume:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams, SessionExecuteRequest

daytona = Daytona()
sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="daytona-vm-small"))

# Launch a process that holds state in memory
sandbox.process.create_session("server")
sandbox.process.execute_session_command("server", SessionExecuteRequest(
    command="python3 -m http.server 8000",
    run_async=True,
))

# Pause freezes the VM with filesystem and memory intact
sandbox.pause()

# Resume continues all processes from the point they were frozen
sandbox.start()
response = sandbox.process.exec("curl -s http://localhost:8000")
print(response.result)  # the server is still running
```

**Hot snapshot:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams, SessionExecuteRequest

daytona = Daytona()
sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="daytona-vm-small"))

# Launch a process that holds state in memory
sandbox.process.create_session("server")
sandbox.process.execute_session_command("server", SessionExecuteRequest(
    command="python3 -m http.server 8000",
    run_async=True,
))
```

The SDKs create cold snapshots only. Create a hot snapshot of the running VM through the API to capture its filesystem and memory:

```bash
curl 'https://app.daytona.io/api/sandbox/{sandboxIdOrName}/snapshot' \
  --request POST \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "name": "my-vm-snapshot",
  "includeMemory": true
}'
```

Sandboxes created from the hot snapshot start with the process already running:

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
clone = daytona.create(CreateSandboxFromSnapshotParams(snapshot="my-vm-snapshot"))
response = clone.process.exec("curl -s http://localhost:8000")
print(response.result)
```

**Fork:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams, SessionExecuteRequest

daytona = Daytona()
sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="daytona-vm-small"))

# Launch a process that holds state in memory
sandbox.process.create_session("server")
sandbox.process.execute_session_command("server", SessionExecuteRequest(
    command="python3 -m http.server 8000",
    run_async=True,
))

# Fork duplicates the filesystem and memory into an independent sandbox
fork = sandbox.fork(name="my-forked-sandbox")
response = fork.process.exec("curl -s http://localhost:8000")
print(response.result)  # the process is running in the fork as well
```

**Windows:**

**Pause / resume:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="windows-small"))

# Pause freezes the VM with filesystem and memory intact
sandbox.pause()

# Resume continues all processes from the point they were frozen
sandbox.start()
```

**Hot snapshot:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="windows-small"))
```

The SDKs create cold snapshots only. Create a hot snapshot of the running VM through the API to capture its filesystem and memory:

```bash
curl 'https://app.daytona.io/api/sandbox/{sandboxIdOrName}/snapshot' \
  --request POST \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "name": "my-windows-snapshot",
  "includeMemory": true
}'
```

Sandboxes created from the hot snapshot start with processes already running:

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
clone = daytona.create(CreateSandboxFromSnapshotParams(snapshot="my-windows-snapshot"))
```

**Fork:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="windows-small"))

# Fork duplicates the filesystem and memory into an independent sandbox
fork = sandbox.fork(name="my-forked-sandbox")
```

**GPU:**

**Persist to volume:**

```python
from daytona import CreateSandboxFromSnapshotParams, Daytona, VolumeMount

daytona = Daytona()
volume = daytona.volume.get("gpu-results", create=True)

# GPU sandboxes are ephemeral: mount a volume to keep results
sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    snapshot="daytona-gpu",
    ephemeral=True,
    volumes=[VolumeMount(volume_id=volume.id, mount_path="/home/daytona/results")],
))

# Write results to the volume before the sandbox stops
sandbox.process.exec("cp model-output.json /home/daytona/results/")

# The sandbox is deleted on stop; the volume and its data persist
sandbox.stop()
```

## Persistence beyond a sandbox

Filesystem and memory persistence are tied to a single sandbox: deleting the sandbox deletes its state. To persist state beyond the sandbox itself, capture it as a **snapshot**, duplicate it into an independent sandbox with a **fork**, or store data outside any sandbox in a **volume**.

### Snapshots from a sandbox

[Snapshots created from a sandbox](../python-sdk/snapshots.md#create-snapshot-from-sandbox) capture and persist the sandbox's current state, including the filesystem, installed packages, dependencies, and settings. The snapshot saves the state so you can restore it later, and any number of new sandboxes can start from the same snapshot. For snapshots built from an image or Dockerfile, which define a base environment rather than persist an existing sandbox, see [snapshots](../python-sdk/snapshots.md).

A snapshot created from a sandbox captures the filesystem (**cold snapshot**) or the filesystem and memory (**hot snapshot**), depending on the sandbox class:

- **Container sandboxes** can capture the filesystem only (**cold snapshot**)
- **VM sandboxes** (**Linux VM** and **Windows**) can capture the filesystem only (**cold snapshot**) or the filesystem and memory (**hot snapshot**): sandboxes created from a hot snapshot start with processes already running

Snapshots persist independently of the source sandbox: deleting the sandbox does not delete snapshots created from it.

### Forks

[Forking](../python-sdk/sandboxes.md#fork-sandboxes) duplicates a VM sandbox's filesystem and memory into a new, fully independent sandbox. Use forks to branch a live environment: run divergent experiments from the same state, test a risky change without touching the original, or hand each agent in a fleet an identical starting point.

The fork persists independently of the original: it can be started, stopped, and deleted without affecting it. Daytona tracks the fork lineage, forks can be forked again, and a parent cannot be deleted while it has active fork children.

### Volumes

[Volumes](../python-sdk/volumes.md) are S3-backed mounts that persist independently of any sandbox. Data written to a mounted volume survives sandbox deletion and is readable from other sandboxes that mount the same volume. Use volumes for datasets, model weights, build caches, and per-user or per-tenant data scoped with a `subpath`. For data already in your own object storage, [mount external storage](../python-sdk/mount-external-storage.md) directly instead of copying it in.

## Retention and lifecycle

Sandboxes in stopped, paused, and archived states are retained until you delete them. Retention costs are driven by the lifecycle state: see [billing](./billing.md) and [limits](./limits.md) for details.

Auto-stop and auto-pause are mutually exclusive: at most one of the two intervals may be non-zero. VM sandboxes default to auto-pause with auto-stop disabled; container and GPU sandboxes default to auto-stop.

| **Interval**                                                        | **Applies to**                          | **Default**                              | **Effect**                                                                                      |
| ------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| <u>[**Auto-stop**](../python-sdk/sandboxes.md#auto-stop-interval)</u>       | Container and GPU sandboxes             | **`15`** minutes of inactivity           | Stops the sandbox; container sandboxes preserve the filesystem, while GPU sandboxes are deleted |
| <u>[**Auto-pause**](../python-sdk/sandboxes.md#auto-pause-interval)</u>     | VM sandboxes <br /> (Linux VM, Windows) | **`60`** minutes of inactivity           | Pauses the VM sandbox, preserving filesystem and memory                                         |
| <u>[**Auto-archive**](../python-sdk/sandboxes.md#auto-archive-interval)</u> | Container sandboxes                     | **`7`** days stopped (**`30`** days max) | Moves the filesystem to object storage                                                          |
| <u>[**Auto-delete**](../python-sdk/sandboxes.md#auto-delete-interval)</u>   | All sandboxes                           | Disabled                                 | Deletes the sandbox after it has been stopped                                                   |
| <u>[**Wall-clock TTL**](../python-sdk/sandboxes.md#wall-clock-ttl)</u>      | All sandboxes                           | Disabled                                 | Destroys the sandbox after a fixed wall-clock deadline, regardless of state                     |

## Opting out of persistence

Persistence is the default, not a requirement: a sandbox can opt out of it entirely. For workloads where state is not needed after the run, create an [ephemeral sandbox](../python-sdk/sandboxes.md#ephemeral-sandboxes). Ephemeral sandboxes are deleted as soon as they stop, discarding all state, and accrue no stopped-state disk billing.

**Ephemeral:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()

# Ephemeral sandboxes are deleted as soon as they stop
sandbox = daytona.create(CreateSandboxFromSnapshotParams(ephemeral=True))

# Run the workload and read the results before the sandbox stops
response = sandbox.process.exec("python3 run.py")
print(response.result)

# Stop deletes the sandbox and all of its state
sandbox.stop()
```

**Auto-delete interval:**

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()

# Auto-delete removes the sandbox after it has been stopped for 1 hour
sandbox = daytona.create(CreateSandboxFromSnapshotParams(auto_delete_interval=60))

# Set the interval to 0 to delete immediately on stop, same as ephemeral
sandbox.set_auto_delete_interval(0)

# Set the interval to -1 to disable auto-deletion
sandbox.set_auto_delete_interval(-1)
```

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
