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
- See Also




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

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.model.Volume;

public class App {
    public static void main(String[] args) {
        try (Daytona daytona = new Daytona()) {
            Volume volume = daytona.volume().create("my-awesome-volume");
        }
    }
}
```

## Wait for a volume to be ready

Wait until a newly created volume reaches the `ready` state before mounting it to a sandbox. Mounting a volume that is still provisioning returns an error.


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

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.exception.DaytonaNotFoundException;
import io.daytona.sdk.model.CreateSandboxFromSnapshotParams;
import io.daytona.sdk.model.Volume;
import io.daytona.sdk.model.VolumeMount;

import java.util.Collections;

public class App {
    public static void main(String[] args) {
        try (Daytona daytona = new Daytona()) {
            Volume volume;
            try {
                volume = daytona.volume().getByName("my-awesome-volume");
            } catch (DaytonaNotFoundException e) {
                volume = daytona.volume().create("my-awesome-volume");
            }

            String mountDir = "/home/daytona/volume";

            // io.daytona.sdk.model.VolumeMount has no subpath field; use the API for subpath mounts.
            // Mount the entire volume at mountPath:
            CreateSandboxFromSnapshotParams paramsFull = new CreateSandboxFromSnapshotParams();
            paramsFull.setLanguage("python");
            VolumeMount mountFull = new VolumeMount();
            mountFull.setVolumeId(volume.getId());
            mountFull.setMountPath(mountDir);
            paramsFull.setVolumes(Collections.singletonList(mountFull));
            Sandbox sandboxShared = daytona.create(paramsFull);
        }
    }
}
```

## Work with volumes

Read from and write to a volume just like any other directory in the sandbox file system. Files written to the volume persist beyond the lifecycle of any individual sandbox.

```java
import java.nio.charset.StandardCharsets;

// Write to a file in the mounted volume using the Sandbox file system API
sandbox.fs.uploadFile(
    "Hello from Daytona volume!".getBytes(StandardCharsets.UTF_8),
    "/home/daytona/volume/example.txt");

// When you're done with the sandbox, you can remove it
// The volume will persist even after the sandbox is removed
sandbox.delete();
```

## Get a volume by name

Get a volume by its name.

```java
daytona.volume().getByName("my-awesome-volume");
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

```java
daytona.volume().list();
```

## Delete volumes

Delete a volume. Deletion is asynchronous: the volume moves through `pending_delete` and `deleting` before it is removed. Deleted volumes cannot be recovered.

A volume can be deleted only when it is in the `ready` or `error` state and is not mounted by any active sandbox. Attempting to delete a volume that is still in use returns a `409` error.

1. Go to [Daytona Volumes ↗](https://app.daytona.io/dashboard/volumes)
2. Click <Button>Delete</Button> next to the volume you want to delete
3. Confirm the deletion

```java
daytona.volume().delete(volume.getId());
```

## Share data between sandboxes

Share data across sandboxes by mounting the same volume in each one.

A producer sandbox writes to the volume and is then deleted; a separately created consumer sandbox mounts the same volume by ID and reads the data. Volume contents persist independently of any individual sandbox.

Sandboxes that mount the same volume see writes immediately, but FUSE-backed volumes are not transactional. If two sandboxes write to the same path concurrently, the last write wins. Coordinate access in your application when ordering matters.

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.exception.DaytonaNotFoundException;
import io.daytona.sdk.model.CreateSandboxFromSnapshotParams;
import io.daytona.sdk.model.Volume;
import io.daytona.sdk.model.VolumeMount;

import java.nio.charset.StandardCharsets;
import java.util.Collections;

public class App {
    public static void main(String[] args) {
        try (Daytona daytona = new Daytona()) {
            Volume volume;
            try {
                volume = daytona.volume().getByName("shared-data");
            } catch (DaytonaNotFoundException e) {
                volume = daytona.volume().create("shared-data");
            }

            String mountDir = "/home/daytona/volume";

            VolumeMount mount = new VolumeMount();
            mount.setVolumeId(volume.getId());
            mount.setMountPath(mountDir);

            // Producer: write data into the volume, then delete the sandbox
            CreateSandboxFromSnapshotParams producerParams = new CreateSandboxFromSnapshotParams();
            producerParams.setLanguage("python");
            producerParams.setVolumes(Collections.singletonList(mount));
            Sandbox producer = daytona.create(producerParams);
            producer.fs.uploadFile(
                "shared payload".getBytes(StandardCharsets.UTF_8),
                mountDir + "/payload.bin");
            producer.delete();

            // Consumer: a separate sandbox mounts the same volume by ID and reads the data
            CreateSandboxFromSnapshotParams consumerParams = new CreateSandboxFromSnapshotParams();
            consumerParams.setLanguage("python");
            consumerParams.setVolumes(Collections.singletonList(mount));
            Sandbox consumer = daytona.create(consumerParams);
            byte[] data = consumer.fs.downloadFile(mountDir + "/payload.bin");
            System.out.println(new String(data, StandardCharsets.UTF_8));
        }
    }
}
```

## Mount multiple volumes to one sandbox

Mount more than one volume to a single sandbox by passing entries in the `volumes` list. Use this pattern to combine shared assets, models, or datasets in one volume with separate per-application or per-user state in another, exposed at distinct mount paths.

```java
Volume sharedAssets;
try {
    sharedAssets = daytona.volume().getByName("shared-assets");
} catch (DaytonaNotFoundException e) {
    sharedAssets = daytona.volume().create("shared-assets");
}

Volume logs;
try {
    logs = daytona.volume().getByName("logs");
} catch (DaytonaNotFoundException e) {
    logs = daytona.volume().create("logs");
}

VolumeMount assetsMount = new VolumeMount();
assetsMount.setVolumeId(sharedAssets.getId());
assetsMount.setMountPath("/home/daytona/assets");

VolumeMount logsMount = new VolumeMount();
logsMount.setVolumeId(logs.getId());
logsMount.setMountPath("/home/daytona/logs");

CreateSandboxFromSnapshotParams params = new CreateSandboxFromSnapshotParams();
params.setLanguage("python");
params.setVolumes(java.util.Arrays.asList(assetsMount, logsMount));
Sandbox sandbox = daytona.create(params);
```

## Multi-tenant isolation with subpaths

Isolate per-tenant or per-user data inside a single shared volume by setting a unique `subpath` on each sandbox's volume mount. Each sandbox sees only files under its assigned subpath at `mount_path` and cannot read or write sibling subpaths within the same volume. This is the recommended pattern for multi-tenant workloads because it stays within the [per-organization volume limit](#pricing--limits) instead of creating one volume per tenant.

Isolation is enforced at the FUSE mount boundary. Each sandbox sees its assigned subpath as the volume root, so a sandbox mounted at `users/alice` cannot reach `users/bob` through relative paths such as `../bob`.


## Limitations

Since volumes are FUSE-based mounts, they can not be used for applications that require block storage access (like database tables). Volumes are generally slower for both read and write operations compared to the local sandbox file system.

## Pricing & Limits

Daytona volumes are included at no additional cost. Each organization can create up to 100 volumes, and volume data does not count against your storage quota.

You can view your current volume usage in the [Daytona Volumes ↗](https://app.daytona.io/dashboard/volumes).

## See Also
- [Python SDK - volumes](../python-sdk/volumes.md)
- [TypeScript SDK - volumes](../typescript-sdk/volumes.md)
