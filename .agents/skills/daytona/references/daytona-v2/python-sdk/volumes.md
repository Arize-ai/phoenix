# Volumes (Python SDK)

Persistent storage that sandboxes attach at creation and that outlives any single sandbox.

Volumes are storage that exists independently of any one sandbox that uses it. A volume is mounted into a sandbox as a directory, and its data outlives the sandbox. A volume carries files between successive sandboxes and lets several sandboxes share it.

Daytona keeps a volume as storage that belongs to a project rather than to any sandbox, mounted inside a sandbox as a directory. Its data stays when the sandbox is deleted, so a later sandbox can attach the volume and continue from what an earlier one wrote. The volume lives until it is deleted, whatever happens to the sandboxes that attach it.

Use volumes to keep files across sandboxes and to share data between sandboxes that run at the same time. A sandbox attaches up to 8 volumes when it is created and keeps them until it is deleted. Linux sandboxes attach disk and bucket volumes, and macOS sandboxes attach only disk volumes. Windows and GPU sandboxes do not attach volumes.

| **Concept**         | **Description**                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| **Volume**          | Storage that mounts in a sandbox as a directory and outlives the sandbox.                        |
| **Disk volume**     | A volume that stores a tree of files as a filesystem.                                            |
| **Bucket volume**   | A volume backed by an object storage bucket, such as an S3 bucket.                               |
| **Managed bucket**  | A bucket that the platform creates and deletes together with its volume.                         |
| **External bucket** | A bucket that its owner creates and manages outside the platform.                                |
| **Mount**           | The attachment of a volume to a directory in a sandbox.                                          |
| **Commit**          | The saving of the changes a sandbox makes on a volume so that other sandboxes can read them.     |
| **Pull**            | The update of the copy of a volume in a sandbox with the changes that other sandboxes committed. |

## Contents

- [Use cases](#use-cases)
- [Create volumes](#create-volumes)
- [Attach volumes](#attach-volumes)
- [Disk volume data](#disk-volume-data)
- [Pull volume changes](#pull-volume-changes)
- [Bucket volume data](#bucket-volume-data)
- [Operations](#operations)
- [Permissions](#permissions)

## Use cases

Volumes are used when data must outlive a sandbox or be shared between sandboxes.

- **Results that outlive the sandbox.** A sandbox writes its output to a volume, and the data stays after the sandbox is deleted. Deleting the sandbox runs a final commit of its disk volume changes. A sandbox created later attaches the same volume and reads the results once that commit is published, which can be seconds to minutes after the first sandbox reports deleted. Check that the results are present before the next sandbox depends on them.

- **Shared datasets and model weights.** A dataset or a set of weights is written to a volume once, and every sandbox that needs it attaches the volume instead of downloading it again. Several sandboxes can attach the same volume at once. On a bucket volume, every sandbox that has the bucket mounted sees new changes. On a disk volume, give each writing sandbox its own files: a file that several sandboxes write keeps one sandbox's version.

- **Caches across runs.** Package, build, and model caches on a volume carry over to the next sandbox, so it skips the downloads and builds the previous one already did. A new sandbox starts from the latest published commit of a disk volume. A Linux sandbox reads and writes its cache in a private copy of the volume: the first read of a file fetches it from storage, and later reads and all writes run at local disk speed.

- **Data in your own bucket.** An external bucket volume mounts a bucket you already use. Sandbox code reads and writes it as files, and the access keys never enter the sandbox. Deleting the volume leaves the bucket and its objects in place.

- **Read-only inputs.** A bucket volume mounted read-only gives untrusted code access to input data that it cannot change or delete. Daytona enforces the read-only mount outside the sandbox, so even a process running as root cannot write to it. Only bucket volumes support read-only mounts.

## Create volumes

Create a volume to set up named storage before any sandbox uses it. The volume exists on its own, apart from any sandbox, and sandboxes attach it later.

A new volume is named storage that no sandbox uses yet. A disk volume starts empty, and its size caps each Linux sandbox's private copy, not the total data. A bucket volume is backed by a bucket, either one created and deleted with the volume or one that already exists.

Create a disk volume, a [managed bucket volume](#managed-bucket-volumes), or an [external bucket volume](#external-bucket-volumes), then attach it when you create a sandbox. Each volume name is unique in the project.

```python
from daytona import Daytona

daytona = Daytona()
volume = daytona.v2.volumes.create(name="training-data", size_gib=200)
print(volume.id, volume.status)
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the volume name.<br />**Required**<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-<br />**Example:** `"training-data"` |
| `size_gib` | Sets the capacity of each Linux sandbox's copy of a disk volume in GiB.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `1000` |
| `type` | Sets the volume type.<br />**Default:** `"disk"`<br />**Value:** `disk` or `bucket`<br />**Example:** `"bucket"` |

### Managed bucket volumes

Managed bucket volumes are object storage whose bucket the platform provisions for one volume only. The bucket is created together with the volume and is deleted together with it.

A managed bucket starts empty and belongs to its volume, so they share one lifetime: deleting the volume deletes the bucket and every object in it.

Use a managed bucket volume when sandboxes need object storage that no one has to provision. Create it with the bucket type and no bucket settings, and attach it at sandbox create. Traffic to and from a bucket volume is billed per uploaded GiB, per downloaded GiB, and per 1,000 requests, as described on the [billing](../platform/billing.md) page.

```python
from daytona import Daytona

daytona = Daytona()
volume = daytona.v2.volumes.create(name="shared-outputs", type="bucket")
print(volume.id, volume.status)
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the volume name.<br />**Required**<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-<br />**Example:** `"shared-outputs"` |
| `type` | Sets the volume type.<br />**Default:** `"disk"`<br />**Value:** `disk` or `bucket`<br />**Example:** `"bucket"` |

### External bucket volumes

External bucket volumes are mounts of a bucket that its user owns, on AWS S3 or an S3-compatible service. The volume points at the bucket and does not own it.

The volume stores only the bucket settings: no bucket is created for it, and deleting the volume leaves the bucket and its objects in place. The access key and the secret key are read from the project's [secrets](./secrets.md) and used outside the sandbox, so sandbox code reads and writes the bucket through the mount and never receives either of the keys.

Use an external bucket volume to give sandboxes access to data that already lives in your bucket. Create the two project secrets first, then create the volume with the CLI or the API. The Python and TypeScript SDKs do not create external bucket volumes.

| **Endpoint** | **Path style** | **Host in each secret's allowed domains** |
| ------------ | -------------- | ----------------------------------------- |
| Omitted      | `false`        | `<bucket>.s3.<region>.amazonaws.com`      |
| Omitted      | `true`         | `s3.<region>.amazonaws.com`               |
| Set          | `false`        | `<bucket>.<endpoint host>`                |
| Set          | `true`         | `<endpoint host>`                         |

**CLI:**

```bash
daytona volume create corp-data --type bucket --bucket corp-data --bucket-region us-east-1 \
  --prefix datasets/ --access-key-secret AWS_KEY --secret-key-secret AWS_SECRET
```

| **Flag** | **Description** |
| --- | --- |
| `--access-key-secret` | Sets the project secret that holds the access key.<br />**Format:** a project secret name<br />**Example:** `AWS_KEY` |
| `--bucket` | Sets the name of your bucket.<br />**Format:** 3 to 63 lowercase letters, digits, periods, and hyphens, starting and ending with a letter or digit<br />**Example:** `corp-data` |
| `--bucket-region` | Sets the S3 region of the bucket.<br />**Default:** the default bucket region of the deployment<br />**Format:** 1 to 64 lowercase letters, digits, and hyphens<br />**Example:** `us-east-1` |
| `--endpoint` | Sets the endpoint of an S3-compatible service.<br />**Default:** AWS S3<br />**Format:** an http or https URL with a public host<br />**Example:** `https://storage.googleapis.com` |
| `--path-style` | Sends requests with path-style addressing instead of virtual-hosted addressing.<br />**Default:** `false` |
| `--prefix` | Limits the volume to keys under a prefix.<br />**Maximum:** 511 characters<br />**Format:** a relative path with no empty, current-directory, or parent-directory segments<br />**Example:** `datasets/` |
| `--secret-key-secret` | Sets the project secret that holds the secret key.<br />**Format:** a project secret name<br />**Example:** `AWS_SECRET` |
| `--type` | Sets the volume type.<br />**Value:** `disk` or `bucket`<br />**Example:** `bucket` |

> **Notes:**
>
> - **Prerequisites:** Two project secrets must hold the access key and the secret key, each with allowed domains that include the host that requests to the bucket are signed for. See [create a secret](./secrets.md#create-a-secret).

**API:**

```bash
curl 'https://api.daytona.com/volumes' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "corp-data",
  "type": "bucket",
  "bucket": {
    "name": "corp-data",
    "region": "us-east-1",
    "prefix": "datasets/",
    "credentials": {
      "access_key_secret": "AWS_KEY",
      "secret_key_secret": "AWS_SECRET"
    }
  }
}'
```

| **Field** | **Description** |
| --- | --- |
| `type` | Sets the volume type.<br />**Value:** `disk` or `bucket`<br />**Example:** `"bucket"` |
| `bucket.name` | Sets the name of your bucket.<br />**Required**<br />**Format:** 3 to 63 lowercase letters, digits, periods, and hyphens, starting and ending with a letter or digit<br />**Example:** `"corp-data"` |
| `bucket.region` | Sets the S3 region of the bucket.<br />**Default:** the default bucket region of the deployment<br />**Format:** 1 to 64 lowercase letters, digits, and hyphens<br />**Example:** `"us-east-1"` |
| `bucket.endpoint` | Sets the endpoint of an S3-compatible service.<br />**Default:** AWS S3<br />**Format:** an http or https URL with a public host<br />**Example:** `"https://storage.googleapis.com"` |
| `bucket.prefix` | Limits the volume to keys under a prefix.<br />**Maximum:** 511 characters<br />**Format:** a relative path with no empty, current-directory, or parent-directory segments<br />**Example:** `"datasets/"` |
| `bucket.path_style` | Sends requests with path-style addressing instead of virtual-hosted addressing.<br />**Default:** `false` |
| `bucket.credentials.access_key_secret` | Sets the project secret that holds the access key.<br />**Required**<br />**Format:** a project secret name<br />**Example:** `"AWS_KEY"` |
| `bucket.credentials.secret_key_secret` | Sets the project secret that holds the secret key.<br />**Required**<br />**Format:** a project secret name<br />**Example:** `"AWS_SECRET"` |

> **Notes:**
>
> - **Prerequisites:** Two project secrets must hold the access key and the secret key, each with allowed domains that include the host that requests to the bucket are signed for. See [create a secret](./secrets.md#create-a-secret).

## Attach volumes

Attach a volume to make its data appear as a directory at a path inside a sandbox. Programs in the sandbox read and write the volume as ordinary files.

The volumes of a sandbox are part of its definition, fixed for its whole life: they are mounted when the sandbox is created and stay mounted until it is deleted. Each mount places a volume, or part of it, at an absolute path in the sandbox, and never reaches outside the volume it names.

List the volumes in the create request, each by name or ID, and create a new sandbox to change them. The examples attach two disk volumes, training-data and home-dirs, and the external bucket volume corp-data. First create them as in [Create volumes](#create-volumes) and [External bucket volumes](#external-bucket-volumes).

```python
from daytona import Daytona
from daytona.v2 import VolumeMount

daytona = Daytona()
sandbox = daytona.v2.create(
    volumes=[
        VolumeMount(volume_id="training-data", mount_path="/mnt/data"),
        VolumeMount(volume_id="home-dirs", mount_path="/home/alice", subpath="users/alice"),
        VolumeMount(volume_id="corp-data", mount_path="/mnt/corp", read_only=True),
    ],
)
```

| **Parameter** | **Description** |
| --- | --- |
| `volumes` | Attaches volumes to the sandbox.<br />**Maximum:** 8 volumes<br />**Example:** `[VolumeMount(volume_id="training-data", mount_path="/mnt/data")]` |
| `VolumeMount.volume_id` | Sets the volume to mount.<br />**Required**<br />**Format:** a volume name or ID<br />**Example:** `"training-data"` |
| `VolumeMount.mount_path` | Sets the path of the mount inside the sandbox.<br />**Required**<br />**Format:** an absolute path without .., other than / and paths at or under /bin, /boot, /dev, /etc, /lib, /lib32, /lib64, /mnt/scratch, /overlay, /proc, /sbin, /sys, and /usr<br />**Example:** `"/mnt/data"` |
| `VolumeMount.subpath` | Mounts only a part of the volume: a directory of a disk volume, or a key prefix under the prefix of a bucket volume.<br />**Maximum:** 511 characters<br />**Format:** a relative path with no empty, current-directory, or parent-directory segments<br />**Example:** `"users/alice"` |
| `VolumeMount.read_only` | Mounts the volume without write access.<br />**Default:** `False` |

> **Notes:**
>
> - **Prerequisites:** Each volume must exist in the project and have the `ready` status.
> - **Compatibility:** Give each mount a different mount path. A macOS sandbox attaches only disk volumes, read-write, and cannot be persistent with volumes. A sandbox with bucket volumes must be created in a region whose hosts mount bucket volumes. A sandbox with volumes cannot be created from an image not yet available in its region. create_macos() takes the same volumes list to attach disk volumes to a macOS sandbox.
> - **Recovery:** Create the sandbox without volumes, or retry once the image is available.

## Disk volume data

Remote storage cached on a local disk fetches a file from storage on its first read and serves later reads and writes from the local copy. Changes made to the copy reach the storage only when they are written back, so other clients see them later.

A Linux sandbox reads and writes a disk volume as a local ext4 filesystem, in a private copy of the latest published commit that is built when the sandbox starts. The first read of a file fetches it from storage, and later reads and all writes run in the private copy at local disk speed. The sandbox's changes are committed back to the volume in the background and merged into its latest contents, and other sandboxes see them the next time they attach or pull the volume. A macOS sandbox mounts a disk volume over NFS instead, served by the sandbox's host.

Give each writing sandbox its own files, and write files that must stay consistent with each other from one sandbox only. Run the sync command before relying on a recent write in the next commit. A final commit can publish minutes after the sandbox reports stopped or deleted, so check the files before a new sandbox depends on them. A running sandbox sees the changes that other sandboxes commit only after it [pulls the volume](#pull-volume-changes).

| **Data**                                                              | **Commit**                                                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| File contents, directories, symbolic links, and hard links            | Stored.                                                                                                     |
| Permission modes and modification times                               | Stored.                                                                                                     |
| File owners                                                           | Not stored by default, so files come back owned by root, and stored from a Linux sandbox when a deployment setting enables them or the volume already stores them. |
| Named pipes                                                           | Stored from a macOS sandbox, and from a Linux sandbox only when the volume stores file owners.             |
| Sockets, device nodes, and extended attributes                        | Not stored.                                                                                                 |
| Holes in sparse files                                                 | Stored as zeros, so a sparse file takes its full size in each Linux sandbox's copy and in the volume's reported size. |
| Writes since the last commit                                          | Not durable until the next commit, and can be lost if the host fails before it.                             |
| Writes that pause for about 1 second                                  | Committed at most every 5 seconds.                                                                          |
| Writes that never pause for 1 second                                  | Committed only when the sandbox is stopped or deleted.                                                      |
| Final commit at stop or delete                                        | Published a few seconds to several minutes after the sandbox reports stopped or deleted. Until then, a sandbox that attaches the volume sees the previous commit. |

| **Concurrent change**                                           | **Merge result**                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A path changed by only one sandbox                              | That sandbox's version is kept.                                                                                    |
| A path changed by two sandboxes                                 | The version with the newer modification time set by the sandboxes is kept, and the other is discarded and cannot be recovered. |
| A path written by a tool that preserves old modification times, such as an archive extraction | The path can lose to an older edit made in another sandbox.                          |
| A path modified by one sandbox, deleted by another              | The modified version is kept.                                                                                      |
| A path that is a file in one sandbox and a directory in another | The directory is kept, and the file is discarded and cannot be recovered.                                          |
| Files that must stay consistent with each other, such as a database and its write-ahead log or a Git object store | Each path is merged on its own, so the files can end up combined from different sandboxes. |

## Pull volume changes

Pull a volume to bring changes that others committed into a local copy, without restarting the sandbox that holds it. The incoming changes are merged with the local ones.

A pull brings the private copy of a disk volume in a running sandbox up to date with the commits other sandboxes have made. It works in both directions, so the sandbox's own changes are merged in rather than lost, and the sandbox keeps working on the merged copy.

Pull a disk volume when a running sandbox needs changes that others committed. Bucket volumes need no pull, because every read goes to the bucket. A pull that finds no new commits returns without committing local changes. A pull fails if your own file or directory is named .rlp-sync, the uncommitted directory at the mount root where pulls stage changes.

```python
from daytona import Daytona
from daytona.v2 import VolumeMount

daytona = Daytona()
sandbox = daytona.v2.create(volumes=[VolumeMount(volume_id="training-data", mount_path="/mnt/data")])
volume = daytona.v2.volumes.get("training-data")

# Use a new request ID for each pull, and the same ID to read its result
result = sandbox.volumes.pull(volume.id, request_id="refresh-42", timeout=10)
while result.status == "pending":
    result = sandbox.volumes.pull(volume.id, request_id="refresh-42", timeout=10)
print(result.status, result.manifest_id)
```

| **Parameter** | **Description** |
| --- | --- |
| `volume_id` | Sets the attached volume to pull.<br />**Required**<br />**Format:** a volume ID<br />**Example:** `"vol_7fJk2mQpXv9dLc3RtY"` |
| `request_id` | Sets the identity of the pull.<br />**Required**<br />**Format:** 1 to 128 ASCII letters, digits, underscores, and hyphens<br />**Example:** `"refresh-42"` |
| `timeout` | Sets how many seconds the server waits for the pull.<br />**Default:** `30`<br />**Minimum:** `0`<br />**Maximum:** `30`<br />**Value:** `0` for no wait |

> **Notes:**
>
> - **Prerequisites:** The volume must be a disk volume attached to a Linux sandbox.
> - **Limits:** A sandbox starts at most one new pull of a volume per second.
> - **Lifetime:** A request ID returns its earlier definitive result only within the current session.
> - **Polling:** A pull can take longer than its wait. Repeat it with the same request ID while the status is `pending`, which means that the pull has no result yet.
> - **Clients:** Use a new request ID for each pull; an ID with a `pulled` or `unchanged` result returns it again.

## Bucket volume data

Object storage keeps data as whole objects under keys in a bucket, read and written over the network instead of as blocks on a disk. Every client of the bucket sees the same objects.

A bucket volume is the bucket itself, mounted with [Mountpoint for Amazon S3](https://github.com/awslabs/mountpoint-s3): there is no local copy, and each read and write is a request to the bucket. Changes are visible to every sandbox that has the bucket mounted and to any other client of the bucket. Files are S3 objects, so they follow the rules of S3 instead of those of a local filesystem.

Use a bucket volume when other sandboxes and clients must see each change at once, and a disk volume for many small files. Closing a written file returns only after the object is stored, or with an error if the upload fails. A file is written sequentially from the start, and an existing file can be replaced but not modified in place. A bucket volume does not support symbolic links, hard links, or changes to the permissions of a file.

## Operations

Operations on volumes are the reads and deletes made on storage that already exists. They show what storage is held and remove storage that is no longer needed.

A volume exists in its project independently of the sandboxes that attach it, and keeps its data until the volume itself is deleted. It is addressed by name or ID, and its type and status describe whether it holds a disk or a bucket and what state it is in.

Use the operations below to list the volumes of a project, get one by name or ID, and delete the volumes whose data no sandbox in the project needs anymore.

### List volumes

List volumes to see the volumes of a project with their names, types, and statuses. A list returns the stored resources of one kind, one page at a time.

The list reflects the volumes of the project at the time it is read. A volume appears in it from the moment it is created until its deletion is complete.

Use the list to find a volume to attach or to check volume statuses. The list is paginated, newest first, and each page holds the cursor of the next one. Volumes being deleted show the deleting status, and deleted volumes are left out.

```python
from daytona import Daytona

daytona = Daytona()
cursor = None
while True:
    page = daytona.v2.volumes.list(limit=50, cursor=cursor)
    for v in page.items:
        print(v.id, v.name, v.type, v.status)
    cursor = page.next_cursor  # None on the last page
    if cursor is None:
        break
```

| **Parameter** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

##### Iterate over all volumes

Iterate over all volumes to read every volume of the project without handling page cursors. Iteration over a paginated list reads one page after another until no page remains.

The iterator fetches the next page of the list when the current page is exhausted, and it stops at the last page, when the server returns no cursor.

Use the iterator in the Python or TypeScript SDK when a script needs to process every volume of the project in a single loop, one volume at a time.

```python
from daytona import Daytona

daytona = Daytona()
for v in daytona.v2.volumes.iter():
    print(v.id, v.name, v.type, v.status)
```

### Get a volume

Get a volume to read its type, status, size, and options, addressing the volume by its name or ID. A get returns the stored record of a single resource, as the service holds it.

The record of a volume describes the volume as it is stored in the project. The record of a bucket volume names the secrets that hold its keys and never contains the keys themselves.

Use it to check a volume before you attach it, by the same name or ID that sandboxes attach it by. For a disk volume, the response also reports the size of the files at the last commit and when that size was observed, both empty until the first commit. The options of a bucket volume hold the bucket settings and the names of the credential secrets.

```python
from daytona import Daytona

daytona = Daytona()
volume = daytona.v2.volumes.get("training-data")
print(volume.type, volume.status, volume.size_gib, volume.used_bytes, volume.used_bytes_at)

# Create the disk volume if it does not exist
volume = daytona.v2.volumes.get("scratch-cache", create=True)
```

| **Parameter** | **Description** |
| --- | --- |
| `name_or_id` | Sets the volume to get.<br />**Required**<br />**Format:** a volume name or ID<br />**Example:** `"training-data"` |
| `create` | Creates a disk volume with this name and the default size when none exists.<br />**Default:** `False` |
| `id_only` | Resolves the value only as an ID, without a name fallback.<br />**Default:** `False` |

### Delete volumes

Delete a volume by name or ID to remove it from the project once no sandbox needs its data. A delete releases storage that is no longer needed.

A deleted disk volume takes its data with it, and a deleted managed bucket volume takes the bucket and every object in it. A deleted external bucket volume removes only the volume and leaves the bucket that you own and all of its objects in place.

Use deletion to remove storage that no sandbox needs anymore. Before you delete a volume, delete every sandbox that attached it and wait until the final commit of each is complete. Deletion runs in the background: the volume moves to the deleting status and then to deleted.

```python
from daytona import Daytona

daytona = Daytona()
daytona.v2.volumes.delete("training-data")
```

| **Parameter** | **Description** |
| --- | --- |
| `name_or_id` | Sets the volume to delete.<br />**Required**<br />**Format:** a volume name or ID<br />**Example:** `"training-data"` |
| `id_only` | Resolves the value only as an ID, without a name fallback.<br />**Default:** `False` |

> **Notes:**
>
> - **Prerequisites:** Every sandbox that attached the volume must be deleted, and its final commit must be complete.
> - **Lifetime:** The volume is released shortly after the sandbox reports deleted.

## Permissions

Volumes are scoped to a project. A volume cannot be attached to a sandbox in another project. Three permissions govern access. You can grant them to an [organization role](./organizations.md) or an [API key](./api-keys.md).

A create of an external bucket volume also requires permission to read secrets, because the volume references project secrets. A volume pull runs through the toolbox of the sandbox and requires the sandbox write permission. The [audit logs](./audit-logs.md) record volume creates and deletes.

| **Permission**       | **Grants**                                        |
| -------------------- | ------------------------------------------------- |
| **`read:volumes`**   | List and get volumes                              |
| **`write:volumes`**  | Create volumes                                    |
| **`delete:volumes`** | Delete volumes                                    |
