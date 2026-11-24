# Snapshots (Python SDK)

Captures of the memory and disk of a running sandbox that new sandboxes resume from.

Snapshots are saved copies of a sandbox at one point in time. A new sandbox starts from a snapshot instead of a clean install, so the setup that many sandboxes share runs only once.

Daytona saves a snapshot as a running sandbox frozen at one moment, under a name and apart from the sandbox it came from. A sandbox restored from it is a new sandbox that picks up the captured processes and memory where they stopped, with the CPU, memory, and disk of the source. The snapshot outlives its source, so deleting the source sandbox leaves it in place.

Use snapshots to start sandboxes with a server, kernel, or model already loaded, or to branch several sandboxes from one state. To save only the filesystem of a sandbox, [capture an image](./images.md#capture-images) instead. To name a registry image or a Dockerfile build, [pull](./images.md#pull-images) or [build](./images.md#build-images) an image.

| **Concept**       | **Description**                                                                         |
| ----------------- | --------------------------------------------------------------------------------------- |
| **Snapshot**      | A capture of the memory, processes, and disk of a running sandbox at one point in time. |
| **Full snapshot** | A snapshot of both the memory and the disk of a sandbox.                                |
| **Checkpoint**    | A snapshot of the processes, memory, and GPU memory of a running GPU workload.          |
| **Restore**       | The creation of a new sandbox that continues from a snapshot.                           |
| **Region**        | The geographic area where a snapshot is stored.                                         |

## Contents

- [Use cases](#use-cases)
- [Create snapshots](#create-snapshots)
- [Restore snapshots](#restore-snapshots)
- [Operations](#operations)
- [Permissions](#permissions)

## Use cases

Snapshots let a new sandbox resume a running state without booting and repeating its setup.

- **Checkpoints of running work.** A full snapshot saves the memory and disk of a running sandbox. A restore resumes the captured processes instead of starting them again. The capture runs in the background, and the source sandbox keeps running if the capture fails.

- **Fast starts for slow-booting programs.** A full snapshot taken after a server, a kernel, or a model has loaded restores with that program already running. New sandboxes skip the load time. The program must run in a Linux sandbox that is persistent, served from a warm template, or restored from a memory snapshot.

- **Evaluation and reinforcement learning (RL).** Each test case or episode resumes from the same snapshot. Results do not depend on another run. Every restored sandbox keeps the CPU, memory, and disk of the source, so each run gets the same resources.

- **Long GPU jobs.** A checkpoint saves a GPU job together with its GPU memory. A new GPU sandbox resumes the job from the point it was saved. The checkpoint restores on any GPU host in the region that meets the restore requirements.

- **Parallel attempts from one state.** Several sandboxes restore from the same snapshot, and each continues on its own. An agent tries several approaches from one point without repeating the setup. The snapshot cannot be deleted while a sandbox restored from it exists.

## Create snapshots

Create a snapshot to copy the memory and disk of a running sandbox at one point in time. The copy holds everything the sandbox needs to continue from there: processes, memory, and files.

A snapshot is taken from a running sandbox. The sandbox is paused while its memory and disk are captured and resumes afterwards, so a failed capture leaves the source running as before.

Create a snapshot of a running sandbox and wait until it is ready, then [restore it](#restore-snapshots) into new sandboxes. Deleting the source sandbox during the capture fails the snapshot. The source can be a persistent sandbox, one served from a warm template, or one restored from a memory snapshot. The snapshot starts as pending, is building while the host captures the sandbox, and becomes ready when the capture of the sandbox finishes.

```python
from daytona import Daytona

daytona = Daytona()
# Snapshot capture needs a sandbox that is persistent, served from a warm template,
# or restored from a memory snapshot
sandbox = daytona.v2.create()

snapshot = sandbox.create_snapshot("my-snapshot")
print(snapshot.id, snapshot.kind, snapshot.status)
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the snapshot name.<br />**Required**<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, and not the name search<br />**Example:** `"my-snapshot"` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be running. The sandbox must be persistent, served from a warm template, or restored from a memory snapshot.
> - **Compatibility:** A sandbox created from a filesystem snapshot, or an ephemeral sandbox with volumes attached, cannot be captured. Windows and macOS sandboxes cannot be captured.
> - **Polling:** Repeat daytona.v2.snapshots.get() with wait set to `"ready"` until the status is `ready` or `failed`.

| **Kind**         | **Captures**                                         | **Restore behavior**                                                                                                                                                  |
| ---------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`full`**       | Memory and disk of a Linux sandbox                   | Resumes the captured processes and memory. Requires a sandbox that is persistent, served from a warm template, or restored from a memory snapshot. Restores in its home region. Where cross-region restore is enabled, a snapshot of a sandbox that is not persistent also restores in a region whose hosts have the same CPU model and hypervisor version. |
| **`checkpoint`** | Processes, memory, and GPU memory of a GPU sandbox   | Resumes in a new GPU sandbox. See [GPU sandboxes](../platform/gpu-sandboxes.md).                                                                                          |

| **Status**      | **Meaning**                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending`   | Accepted; the capture job is queued on the sandbox's host.                                                                                                                  |
| `building`  | The host is pausing, copying, and packing the sandbox state.                                                                                                                |
| `ready`     | Restorable.                                                                                                                                                                 |
| `failed`    | `error` carries the reason. The source sandbox keeps running.                                                                                                     |

## Restore snapshots

Restore a snapshot to load the captured memory and disk into a new sandbox, which continues from the captured point. The same snapshot can be restored many times, and each restore produces an identical copy of the captured state.

A restored sandbox is a new sandbox that continues the processes and memory of the source, with its CPU, memory, disk, and persistence. The snapshot depends on the CPU model and hypervisor version of the host it was captured on.

Restore a snapshot once for a fast start, or many times to branch several sandboxes from one state. The restore runs on the capturing host when that host can take it, and otherwise on another host of the region with the same CPU model and hypervisor version. Where cross-region restore is enabled, a restore in another region waits while the snapshot is copied.

```python
from daytona import Daytona

daytona = Daytona()

sandbox = daytona.v2.create_from_snapshot("my-snapshot")
```

| **Parameter** | **Description** |
| --- | --- |
| `snapshot` | Sets the snapshot to restore from.<br />**Required**<br />**Format:** a snapshot name or ID<br />**Example:** `"my-snapshot"` |
| `create_timeout_seconds` | Sets how many seconds the sandbox has to reach running before it is deleted.<br />**Default:** `3600`<br />**Minimum:** `1`<br />**Maximum:** `86400`<br />**Value:** `-1` for the maximum<br />**Example:** `600` |
| `idempotency_key` | Makes a retried create return the same sandbox.<br />**Default:** a key derived from name if set, otherwise a new key for each call<br />**Minimum:** 1 character<br />**Maximum:** 256 characters<br />**Format:** printable ASCII<br />**Example:** `"run-42-restore"` |
| `labels` | Attaches key-value metadata to the sandbox.<br />**Maximum:** 100 labels<br />**Format:** a non-empty key and a value of at most 512 bytes each<br />**Example:** `{"team": "research"}` |
| `lifecycle_policy` | Sets the timeouts of the sandbox.<br />**Format:** timeout_seconds and on_timeout, and idle_expiry_seconds and on_idle_timeout<br />**Example:** `{"timeout_seconds": 3600, "on_timeout": "delete"}` |
| `name` | Sets the display name of the sandbox.<br />**Default:** a generated name, sandbox- followed by 8 hexadecimal characters<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix such as sbx_ or img_<br />**Example:** `"my-sandbox"` |
| `ports` | Forwards inbound ports to the sandbox.<br />**Maximum:** 32 mappings<br />**Format:** PortMapping objects with a port from `1` to `65535` and a proto of `tcp` or `udp`, which defaults to `tcp`<br />**Example:** `[PortMapping(port=8080)]` |
| `region` | Sets the region of the sandbox.<br />**Default:** the snapshot's home region<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, `us-east-iad-1`, or the ID of a [BYOC region](./bring-your-own-compute.md) of the organization<br />**Example:** `"earth"` |
| `wait_seconds` | Sets how many seconds the call waits for the sandbox to start.<br />**Default:** `60`<br />**Value:** `0` for no wait<br />**Example:** `120` |

> **Notes:**
>
> - **Prerequisites:** The snapshot must be ready.

## Operations

Operations on snapshots act on captures that already exist in a project. They read what the project holds and remove what it no longer needs, separately from their source sandboxes.

A snapshot lives in its project under a unique name, independent of its source sandbox, so deleting the source does not affect it. It stays in place while a sandbox restored from it exists.

Use the operations below to list the snapshots of a project, get one by ID or name, and delete the ones you no longer restore from. The status of a snapshot shows whether a capture is still in progress, ready to restore, or failed. Each operation requires the matching snapshot [permission](#permissions).

### List snapshots

List snapshots to see their name, kind, status, and home region. A paginated list returns a large collection in pages, and each page continues where the previous one ended.

A list of snapshots covers one project and returns its snapshots one page at a time. Each entry holds the same details that a get of the snapshot returns.

Use a list to find the name or ID of a snapshot to [restore](#restore-snapshots), or to check the status of recent captures. To read every page, [iterate over all snapshots](#iterate-over-all-snapshots). The SDKs and the CLI list from the search index, so a snapshot captured moments before a list can be missing from it until the index includes the snapshot.

**Snapshot fields:**

| **Field**          | **Description**                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`           | Snapshot ID.                                                                                                                               |
| `name`         | Unique name within the project. Used for restore.                                                                                          |
| `class`        | `linux`. The SDKs name it `sandbox_class` in Python and `sandboxClass` in TypeScript.                                         |
| `kind`         | `full` for Linux, or `checkpoint` for GPU.                                                                                             |
| `status`       | `pending`, `building`, `ready`, or `failed`.                                                                                               |
| `sandbox_id`   | The ID of the source sandbox. It stays after the source sandbox is deleted, and becomes `null` once Daytona purges the record of the deleted sandbox. |
| `region_id`    | Home region. The SDKs name it `region`.                                                                                                    |
| `region_ids`   | The home region, followed by every other region that holds a copy of the snapshot. The SDKs name it `available_in` in Python and `availableIn` in TypeScript. |
| `bytes`        | Always `null`, because the size of the captured disk is not returned.                                                                      |
| `memory_bytes` | Size of the captured memory in bytes, set when a `full` snapshot is `ready` and `null` for a `checkpoint` snapshot. The SDKs name it `memoryBytes` in TypeScript. |
| `error`        | Failure reason when `status` is `failed`.                                                                                                  |
| `created_at`   | Time the snapshot was created.                                                                                                             |
| `updated_at`   | Time of the last change to the snapshot.                                                                                                   |
| `cursor`       | Resumes the list after this snapshot when passed as `cursor`. The API and the CLI return it only in a list.                                 |

```python
from daytona import Daytona

daytona = Daytona()

page = daytona.v2.snapshots.list()
for snapshot in page.items:
    print(snapshot.name, snapshot.kind, snapshot.status)
```

| **Parameter** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `name` | Filters by exact snapshot name.<br />**Example:** `"my-snapshot"` |
| `sandbox_id` | Filters by the sandbox the snapshots were captured from.<br />**Format:** a sandbox ID<br />**Example:** `sandbox.id` |

> **Notes:**
>
> - **Results:** A snapshot captured moments before can be missing from the list until the search index has it. Each snapshot uses the API field names, except where the description of a field says otherwise.

##### Iterate over all snapshots

Iterate over all snapshots to read every page of the list in one pass. Iteration over a paginated list reads one page after another until no page remains.

Iteration over the snapshots of a project yields the snapshots of every page in turn. Each page continues where the previous one ended, and the iteration ends after the last page.

Use iteration when a script needs every snapshot of the project rather than one page. The SDKs and the CLI follow every page for you, and the API returns one page for each request.

```python
from daytona import Daytona

daytona = Daytona()

for snapshot in daytona.v2.snapshots.iter():
    print(snapshot.name, snapshot.kind, snapshot.status)
```

### Get a snapshot

Get a snapshot to read its kind, status, size, and regions, naming it by ID or by name. A get reads one resource by its identifier and changes nothing on the server.

A get of a snapshot returns the same details as a list, for one snapshot. The status in those details shows whether the snapshot can be restored yet or whether its capture is still in progress. The size in those details covers the memory that a full snapshot captured, not its disk.

Use a get to follow a capture: repeat it with wait set to ready until the status is ready or failed. The name search cannot get a snapshot, and a value that matches the ID of one snapshot and the name of another is refused. A ready snapshot can be restored, and a failed one holds the reason in its error.

```python
from daytona import Daytona

daytona = Daytona()

snapshot = daytona.v2.snapshots.get("{snapshotId}")
print(snapshot.kind, snapshot.status, snapshot.memory_bytes)
```

| **Parameter** | **Description** |
| --- | --- |
| `snapshot_id` | Sets the snapshot to get.<br />**Required**<br />**Format:** a snapshot ID, or a snapshot name other than search<br />**Example:** `"my-snapshot"` |

### Delete snapshots

Delete a snapshot to remove a captured state that is no longer restored. Deletion removes a resource permanently, together with the data stored only in it.

A snapshot cannot be deleted while a sandbox restored from it exists, including one whose deletion has not finished. Deleting the source sandbox does not affect its snapshots.

Delete the sandboxes restored from a snapshot first, then delete the snapshot from the dashboard or programmatically. The [audit logs](./audit-logs.md) record each snapshot delete.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/snapshots)
2. Open the actions menu of a snapshot and click **Delete**
3. Click **Delete** to confirm

```python
from daytona import Daytona

daytona = Daytona()

daytona.v2.snapshots.delete("{snapshotId}")
```

| **Parameter** | **Description** |
| --- | --- |
| `snapshot_id` | Sets the snapshot to delete.<br />**Required**<br />**Format:** a snapshot name or ID<br />**Example:** `"my-snapshot"` |

> **Notes:**
>
> - **Prerequisites:** Every sandbox restored from the snapshot must be fully deleted.

## Permissions

Snapshots are scoped to a project. Three permissions govern access to them, and you can grant each one to an [organization role](./organizations.md#roles) or to an [API key](./api-keys.md).

Restoring a snapshot creates a sandbox, so it requires the permission to create sandboxes, and creating a snapshot of a sandbox requires the permission to write sandboxes as well as snapshots. The [audit logs](./audit-logs.md) record snapshot creates and deletes.

| **Permission**         | **Grants**             |
| ---------------------- | ---------------------- |
| **`read:snapshots`**   | List and get snapshots |
| **`write:snapshots`**  | Create snapshots       |
| **`delete:snapshots`** | Delete snapshots       |
