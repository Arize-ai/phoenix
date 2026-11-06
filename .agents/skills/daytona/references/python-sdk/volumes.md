## Contents

- Create volumes
- Wait for a volume to be ready
- Mount volumes
- Work with volumes
- Get a volume by name
- Get a volume by ID
- List volumes
- Delete volumes
- Share data between sandboxes
- Mount multiple volumes to one sandbox
- Multi-tenant isolation with subpaths
- Limitations
- Pricing & Limits




Volumes are FUSE-based mounts that provide shared file access across Daytona sandboxes. They enable sandboxes to read from large files instantly - no need to upload files manually to each sandbox. Volume data is stored in an S3-compatible object store.

A sandbox reads and writes a mounted volume like any local directory, and the contents persist independently of the sandbox lifecycle. Use volumes to share datasets, model weights, build caches, or application state between sandboxes, scope per-user or per-tenant data with a `subpath`, and combine multiple volumes in the same sandbox at different mount paths.

- multiple volumes can be mounted to a single sandbox
- a single volume can be mounted to multiple sandboxes

## Create volumes

Create a volume.

For persistent per-user, per-tenant, or per-workspace storage, use one shared volume per use case, environment, or project (for example a volume for staging and another for production), and set a dedicated `subpath` when you create each sandbox. The sandbox sees only that prefix inside the volume; it cannot access sibling subpaths.

This is the default pattern we recommend because it:

- stays within the per-organization volume [limits](#pricing--limits)
- avoids mounting a separate volume for every user or sandbox
- continues to provide strong isolation at the mount boundary

1. Go to [Daytona Volumes ↗](https://app.daytona.io/dashboard/volumes)
2. Click <Button>Create Volume</Button>
3. Enter the volume name
4. Click <Button>Create</Button>

```python
from daytona import Daytona

daytona = Daytona()
volume = daytona.volume.create("my-awesome-volume")
```

## Wait for a volume to be ready

Wait until a newly created volume reaches the `ready` state before mounting it to a sandbox. Mounting a volume that is still provisioning returns an error.

```python
import time

from daytona import Daytona

daytona = Daytona()
volume = daytona.volume.create("my-awesome-volume")

while volume.state != "ready":
    time.sleep(1)
    volume = daytona.volume.get("my-awesome-volume")
```

## Mount volumes

Mount a volume to a sandbox at sandbox creation time.

For per-user or multi-tenant data, pass `subpath` so only the specified folder inside the volume is visible at `mount_path`. Mount the entire volume (omit `subpath`) when every sandbox that uses that volume should see the same tree. The volume must be in the `ready` state.

Volume mount paths must meet the following requirements:

- **Must be absolute paths**: mount paths must start with `/` (e.g., `/home/daytona/volume`)
- **Cannot be root directory**: cannot mount to `/` or `//`
- **No relative path components**: cannot contain `/../`, `/./`, or end with `/..` or `/.`
- **No consecutive slashes**: cannot contain multiple consecutive slashes like `//` (except at the beginning)
- **Cannot mount to system directories**: the following system directories are prohibited: `/proc`, `/sys`, `/dev`, `/boot`, `/etc`, `/bin`, `/sbin`, `/lib`, `/lib64`

When you set `subpath`, the value must meet the following requirements:

- **No leading slash**: subpaths are S3 key prefixes and must not start with `/`
- **No path traversal**: cannot contain `..`
- **No consecutive slashes**: cannot contain `//`

```python
from daytona import CreateSandboxFromSnapshotParams, Daytona, VolumeMount

daytona = Daytona()

# Create a new volume or get an existing one
volume = daytona.volume.get("my-awesome-volume", create=True)

mount_dir = "/home/daytona/volume"

# Recommended for per-user / per-tenant data: one volume, unique subpath per sandbox
params = CreateSandboxFromSnapshotParams(
    language="python",
    volumes=[VolumeMount(volume_id=volume.id, mount_path=mount_dir, subpath="users/alice")],
)
sandbox = daytona.create(params)

# Entire volume at mount path (omit subpath) when all sandboxes should share the same tree
params_full = CreateSandboxFromSnapshotParams(
    language="python",
    volumes=[VolumeMount(volume_id=volume.id, mount_path=mount_dir)],
)
sandbox_shared = daytona.create(params_full)
```

## Work with volumes

Read from and write to a volume just like any other directory in the sandbox file system. Files written to the volume persist beyond the lifecycle of any individual sandbox.

```python
# Write to a file in the mounted volume using the Sandbox file system API
sandbox.fs.upload_file(b"Hello from Daytona volume!", "/home/daytona/volume/example.txt")

# When you're done with the sandbox, you can remove it
# The volume will persist even after the sandbox is removed
sandbox.delete()
```

## Get a volume by name

Get a volume by its name.

```python
daytona.volume.get("my-awesome-volume", create=True)
```

## Get a volume by ID

Get a volume by its ID.

**API:**

```bash
curl 'https://app.daytona.io/api/volumes/<VOLUME_ID>' \
  --header 'Authorization: Bearer <API_KEY>'
```

## List volumes

List all volumes.

```python
daytona.volume.list()
```

## Delete volumes

Delete a volume. Deletion is asynchronous: the volume moves through `pending_delete` and `deleting` before it is removed. Deleted volumes cannot be recovered.

A volume can be deleted only when it is in the `ready` or `error` state and is not mounted by any active sandbox. Attempting to delete a volume that is still in use returns a `409` error.

1. Go to [Daytona Volumes ↗](https://app.daytona.io/dashboard/volumes)
2. Click <Button>Delete</Button> next to the volume you want to delete
3. Confirm the deletion

```python
daytona.volume.delete(volume)
```

## Share data between sandboxes

Share data across sandboxes by mounting the same volume in each one.

A producer sandbox writes to the volume and is then deleted; a separately created consumer sandbox mounts the same volume by ID and reads the data. Volume contents persist independently of any individual sandbox.

Sandboxes that mount the same volume see writes immediately, but FUSE-backed volumes are not transactional. If two sandboxes write to the same path concurrently, the last write wins. Coordinate access in your application when ordering matters.

```python
from daytona import CreateSandboxFromSnapshotParams, Daytona, VolumeMount

daytona = Daytona()
volume = daytona.volume.get("shared-data", create=True)
mount_dir = "/home/daytona/volume"

# Producer: write data into the volume, then delete the sandbox
producer = daytona.create(CreateSandboxFromSnapshotParams(
    language="python",
    volumes=[VolumeMount(volume_id=volume.id, mount_path=mount_dir)],
))
producer.fs.upload_file(b"shared payload", f"{mount_dir}/payload.bin")
producer.delete()

# Consumer: a separate sandbox mounts the same volume by ID and reads the data
consumer = daytona.create(CreateSandboxFromSnapshotParams(
    language="python",
    volumes=[VolumeMount(volume_id=volume.id, mount_path=mount_dir)],
))
data = consumer.fs.download_file(f"{mount_dir}/payload.bin")
print(data.decode())
```

## Mount multiple volumes to one sandbox

Mount more than one volume to a single sandbox by passing entries in the `volumes` list. Use this pattern to combine shared assets, models, or datasets in one volume with separate per-application or per-user state in another, exposed at distinct mount paths.

```python
from daytona import CreateSandboxFromSnapshotParams, Daytona, VolumeMount

daytona = Daytona()
shared_assets = daytona.volume.get("shared-assets", create=True)
logs = daytona.volume.get("logs", create=True)

sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    language="python",
    volumes=[
        VolumeMount(volume_id=shared_assets.id, mount_path="/home/daytona/assets"),
        VolumeMount(volume_id=logs.id, mount_path="/home/daytona/logs"),
    ],
))
```

## Multi-tenant isolation with subpaths

Isolate per-tenant or per-user data inside a single shared volume by setting a unique `subpath` on each sandbox's volume mount. Each sandbox sees only files under its assigned subpath at `mount_path` and cannot read or write sibling subpaths within the same volume. This is the recommended pattern for multi-tenant workloads because it stays within the [per-organization volume limit](#pricing--limits) instead of creating one volume per tenant.

Isolation is enforced at the FUSE mount boundary. Each sandbox sees its assigned subpath as the volume root, so a sandbox mounted at `users/alice` cannot reach `users/bob` through relative paths such as `../bob`.

```python
from daytona import CreateSandboxFromSnapshotParams, Daytona, VolumeMount

daytona = Daytona()
volume = daytona.volume.get("tenants", create=True)
mount_dir = "/home/daytona/data"

# Tenant A
alice_sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    language="python",
    volumes=[VolumeMount(volume_id=volume.id, mount_path=mount_dir, subpath="users/alice")],
))
alice_sandbox.fs.upload_file(b"alice's data", f"{mount_dir}/notes.txt")

# Tenant B sees only its own subpath; alice's notes.txt is invisible
bob_sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    language="python",
    volumes=[VolumeMount(volume_id=volume.id, mount_path=mount_dir, subpath="users/bob")],
))
bob_sandbox.fs.upload_file(b"bob's data", f"{mount_dir}/notes.txt")
```

## Limitations

Since volumes are FUSE-based mounts, they can not be used for applications that require block storage access (like database tables). Volumes are generally slower for both read and write operations compared to the local sandbox file system.

## Pricing & Limits

Daytona volumes are included at no additional cost. Each organization can create up to 100 volumes, and volume data does not count against your storage quota.

You can view your current volume usage in the [Daytona Volumes ↗](https://app.daytona.io/dashboard/volumes).
