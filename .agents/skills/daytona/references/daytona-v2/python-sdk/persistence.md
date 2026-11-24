# Persistence (Python SDK)

Keeping sandbox state beyond the life of a sandbox.

Persistence is how long the state of a sandbox lasts: the files on its disk, and the processes and data in its memory. State that persists outlives the events that would otherwise discard it.

Sandboxes are ephemeral by default. The writable filesystem of a sandbox exists only while the sandbox does, and deleting a sandbox discards its filesystem, memory, and processes. Persistence carries the files, installed tools, and running state of a sandbox over to the next one.

Keep state beyond a sandbox by capturing it as an [image](./images.md#capture-images) or a [snapshot](./snapshots.md#create-snapshots), or by writing it to external storage, such as a [volume](./volumes.md). Snapshots on this page are Linux snapshots that save memory and disk, and macOS sandboxes have no memory snapshots. A persistent macOS sandbox keeps its disk across stop and start, as [macOS filesystem persistence](./macos-sandboxes.md#filesystem-persistence) describes.

| **Layer**            | **What is preserved**                          | **Methods**                                                                     |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| **Filesystem**       | Files, packages, repositories, build artifacts | [**Image capture**](./images.md#capture-images)                          |
| **Memory**           | Processes, states, in-sandbox connections      | [**Snapshots**](./snapshots.md#create-snapshots)                         |
| **External storage** | Data that outlives any single sandbox          | [**Volumes**](./volumes.md)                                              |

## Contents

- [Use cases](#use-cases)
- [Filesystem persistence](#filesystem-persistence)
- [Memory persistence](#memory-persistence)
- [Persistence beyond a sandbox](#persistence-beyond-a-sandbox)
- [Retention and lifecycle](#retention-and-lifecycle)

## Use cases

Persistence is used when the state of a sandbox must survive past the sandbox itself.

- **Prepared environments.** An image capture keeps installed packages, repositories, and configuration. New sandboxes start from the image with nothing to reinstall or rebuild. Capture works on a stopped persistent macOS sandbox and on a running Linux or Windows sandbox, which keeps running during the capture.

- **Runs from a known state.** A snapshot copies a configured sandbox, so several runs or every agent in a fleet start from the same state. A restored sandbox continues with its processes still running. A snapshot restores in its home region, or, where Daytona has enabled cross-region restore, in another region if the source sandbox was not persistent.

- **Servers that resume without a restart.** A snapshot taken after a server starts keeps the server in memory. A restored sandbox continues with the server already running, instead of starting it again after a clean boot. The restored sandbox gets a fresh IP and port mappings, and connections to hosts outside the sandbox do not continue.

- **Results that outlive the sandbox.** A sandbox writes its output to storage outside the sandbox, such as your own object storage, and the data stays after the sandbox is deleted. Data on a volume also stays, and a later sandbox can attach the same volume and read it. A disk volume mounts as a local filesystem, while a bucket volume writes straight to an S3 bucket.

- **Work that survives timeouts and reclaims.** A timeout or a spot reclaim can delete a sandbox without a request from you, and a host failure loses an ephemeral sandbox, along with its state. Results on a volume or in a captured image stay when that happens. A persistent Windows or macOS sandbox is stopped on a timeout by default and keeps its disk.

## Filesystem persistence

Filesystem persistence keeps the contents of a sandbox's disk, such as installed packages and build artifacts. A sandbox that starts from a preserved filesystem has its environment intact, with nothing to reinstall or rebuild.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Prepare the environment to capture
sandbox.process.run("pip install requests")

# An image capture keeps the filesystem beyond the sandbox
image = sandbox.capture_image(name="my-env")

# Capture runs asynchronously; wait until the image is ready
while image.status not in ("ready", "failed"):
    image = daytona.v2.images.get(image.id, wait="ready")
if image.status == "failed":
    raise RuntimeError(image.error)

# Delete discards the sandbox; the image remains
sandbox.delete()

# Any number of new sandboxes can start from the same image
clone = daytona.v2.create("my-env")
response = clone.process.run("pip show requests")
print(response.stdout)  # requests is already installed
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the image that create() boots the new sandbox from.<br />**Format:** an image name or ID<br />**Example:** `"my-env"` |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, not the names cache or search, and unique among the image and snapshot names of the project<br />**Example:** `"my-env"` |
| `wait` | Holds the request until the image is ready.<br />**Value:** `"ready"` |

> **Notes:**
>
> - **Permissions:** The requests require the `write:sandboxes`, `write:images`, and `delete:sandboxes` permissions.
> - **Prerequisites:** The sandbox must be running.

## Memory persistence

Memory persistence keeps the runtime state of a sandbox: its running processes and everything loaded in memory. A sandbox that starts from preserved memory continues from the point it was saved, with its processes still running, instead of a clean boot.

```python
from daytona import Daytona

daytona = Daytona()
# Snapshot capture needs a persistent sandbox, one served from a warm template, or a restored one
sandbox = daytona.v2.create()

# Start a server that runs in the background
sandbox.process.start("python3 -m http.server 8000")

# A snapshot keeps memory and running processes beyond the sandbox
snapshot = sandbox.create_snapshot("my-snapshot")

# Capture runs asynchronously; wait until the snapshot is ready
while snapshot.status not in ("ready", "failed"):
    snapshot = daytona.v2.snapshots.get(snapshot.id, wait="ready")
if snapshot.status == "failed":
    raise RuntimeError(snapshot.error)

# Delete discards the sandbox; the snapshot remains
sandbox.delete()

# The restored sandbox resumes the server without starting it again
restored = daytona.v2.create_from_snapshot("my-snapshot")
response = restored.process.run(argv=[
    "python3", "-c",
    "import urllib.request; print(urllib.request.urlopen('http://localhost:8000').status)",
])
print(response.stdout)  # 200
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the snapshot name.<br />**Required**<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, not the name search, and unique among the image and snapshot names of the project<br />**Example:** `"my-snapshot"` |
| `snapshot` | Sets the snapshot that create_from_snapshot() restores from.<br />**Required**<br />**Format:** a snapshot name or ID<br />**Example:** `"my-snapshot"` |
| `wait` | Holds the request until the snapshot is ready.<br />**Value:** `"ready"` |

> **Notes:**
>
> - **Permissions:** The requests require the `write:sandboxes`, `write:snapshots`, and `delete:sandboxes` permissions.
> - **Prerequisites:** The source sandbox must be running. The source sandbox must be persistent, served from a warm template, or restored from a memory snapshot. A sandbox created from a captured image, such as `my-env`, or an ephemeral sandbox with a disk volume attached does not qualify.

## Persistence beyond a sandbox

Persistence beyond a sandbox is the keeping of state after the sandbox that held it is deleted. The state survives as a saved copy or as data in storage outside the sandbox.

The state of a sandbox ends with the sandbox. Deleting a sandbox deletes its state, and only a captured copy or data in storage outside the sandbox remains.

Capture an image or a snapshot to start new sandboxes from the state of a sandbox, as [images and snapshots](#images-and-snapshots) describes. Write data to a [volume](#volumes) to keep it for later sandboxes.

### Images and snapshots

Images and snapshots are saved copies of the state of a sandbox. An image holds a filesystem that new sandboxes boot from, and a snapshot holds the memory and disk that a restored sandbox resumes from with its processes still running.

An image or a snapshot of a sandbox covers the sandbox's own state and remains after the sandbox is deleted. Deleting the source sandbox does not delete its snapshots.

Capture an [image](./images.md#capture-images) to boot new sandboxes from a filesystem, and take a [snapshot](./snapshots.md) to resume the captured processes. An image capture saves the filesystem either under a name or as an anonymous image. A snapshot restores on the host that captured it, or on another host with the same Firecracker version and CPU profile. It restores in another region only where cross-region restore is enabled and the source sandbox was not persistent.

### Volumes

[Volumes](./volumes.md) are storage that exists independently of any one sandbox that uses it.

## Retention and lifecycle

Retention is how long a system keeps a resource before it removes the resource, and a lifecycle is the set of states and rules that decide when that happens. A rule such as a timeout can act on a resource without a request from the owner of the resource.

A sandbox is retained until it is deleted, either on a request or when its lifecycle acts on it. A timeout or a platform event can end a sandbox without a request from the user.

Read the results of a sandbox before it is deleted, or keep them on a volume or in a captured image. When a [timeout](./linux-sandboxes.md#timeouts) elapses, the sandbox gets the action that is set for it: delete, or, for a persistent sandbox, stop. By default an ephemeral sandbox is deleted, and a persistent Windows or [macOS](./macos-sandboxes.md#lifecycle) sandbox is stopped. Timeouts and actions come from the lifecycle policy, project lifecycle defaults, or the platform default timeout.

| **Platform event**                                          | **Effect**                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[Spot reclaim](./preemption.md#spot-sandboxes)**         | An ephemeral sandbox is deleted, a persistent Windows sandbox is stopped with its disk kept, and each records the time of the reclaim. |
| **Host failure**                                            | An ephemeral sandbox on the failed host is lost.                                                                                                                                                            |

```python
from daytona import Daytona

daytona = Daytona()

# Create, use, delete
sandbox = daytona.v2.create()

# Run the workload and read the results before deleting
response = sandbox.process.run("python3 -c 'print(1 + 1)'")
print(response.stdout)

# Delete discards the sandbox and all of its state
sandbox.delete()
```

| **Parameter** | **Description** |
| --- | --- |
| `command` | Sets the shell command to run.<br />**Example:** `"python3 -c 'print(1 + 1)'"` |

> **Notes:**
>
> - **Permissions:** The requests require the `write:sandboxes` and `delete:sandboxes` permissions.
