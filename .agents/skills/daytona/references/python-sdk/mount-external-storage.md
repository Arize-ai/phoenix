## Contents

- Mount an Amazon S3 bucket
- Mount a Cloudflare R2 bucket
- Mount a Tigris bucket
- Mount a Supabase Storage bucket
- Mount a Google Cloud Storage bucket
- Mount an Azure Blob container
- Mount a Box folder
- Mount an Archil disk
- Mount a MesaFS filesystem
- Mount a TiDB Cloud Filesystem
- Unmount




Mount object storage (Amazon S3, Cloudflare R2, Tigris, Supabase Storage, Google Cloud Storage, Azure Blob), cloud storage like Box, and filesystems like Archil, MesaFS, and TiDB Cloud Filesystem into a Daytona sandbox as a regular directory. The sandbox reads from and writes to the bucket as if it were a local directory, so existing tools, scripts, and agents work without changes. This is useful for bringing in datasets, model weights, or build artifacts that already live in your own cloud account.

External storage mounts and [Daytona Volumes](./volumes.md) are complementary FUSE-based mechanisms — both expose remote object storage as a regular sandbox directory, both can be shared across sandboxes, and both persist beyond any individual sandbox's lifetime. The main distinction is **where the data physically lives**: Daytona Volumes are hosted on Daytona's own S3-compatible object store, while external mounts connect to a bucket or filesystem hosted on another provider (Amazon S3, Cloudflare R2, Tigris, Supabase Storage, GCS, Azure Blob, Box, Archil, MesaFS, TiDB Cloud Filesystem).

External storage is mounted using FUSE. Daytona supports two approaches, and each provider section below shows both — pick whichever fits your workflow:

- **Pre-built snapshot** — build a [snapshot](./snapshots.md) once with the FUSE tool (`mount-s3`, `gcsfuse`, `blobfuse2`, `box-mount`) built-in, then launch every sandbox from that snapshot. Cold starts are fast and predictable. Best for production.
- **Runtime install** — launch a default sandbox and `apt-get install` the FUSE tool when the sandbox starts. Adds time to sandbox startup, but you don't manage snapshots. Best for quick experiments.

Both approaches end with the same mount command and the same usage — the only difference is when the FUSE tool gets installed.

## Mount an Amazon S3 bucket

Mount an S3 bucket using [Mountpoint for Amazon S3 ↗](https://github.com/awslabs/mountpoint-s3) — AWS's official FUSE client, optimized for high throughput on S3.

**Credentials** — set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in your local environment. The snippets below pass them into the sandbox via `envVars`, and `mount-s3` reads them from there.

### Pre-built snapshot

Build a snapshot with `mount-s3` preinstalled, then launch all S3-enabled sandboxes from that snapshot. This removes per-sandbox package install work, keeps cold starts predictable, and gives you a reusable baseline image for production workloads.

#### Build a snapshot

Create a reusable snapshot that installs `mount-s3` and its system dependencies. After it finishes, every sandbox launched from `fuse-s3` already has the mount binary available.

```python
from daytona import CreateSnapshotParams, Daytona, Image

daytona = Daytona()

image = (
  Image.base("daytonaio/sandbox")
  .run_commands(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends libfuse2 ca-certificates wget",
    'arch="$(dpkg --print-architecture | sed s/amd64/x86_64/)" '
    '&& wget -O /tmp/mount-s3.deb '
    '"https://s3.amazonaws.com/mountpoint-s3-release/latest/${arch}/mount-s3.deb" '
    "&& sudo apt-get install -y /tmp/mount-s3.deb "
    "&& rm /tmp/mount-s3.deb",
  )
)

daytona.snapshot.create(
    CreateSnapshotParams(name="fuse-s3", image=image),
    on_logs=print,
)
```

#### Launch and mount

Pass AWS credentials as environment variables on sandbox creation. `mount-s3` reads them automatically.

```python
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        snapshot="fuse-s3",
        env_vars={
            "AWS_ACCESS_KEY_ID": os.environ["AWS_ACCESS_KEY_ID"],
            "AWS_SECRET_ACCESS_KEY": os.environ["AWS_SECRET_ACCESS_KEY"],
        },
    )
)

mount_path = "/home/daytona/s3"

# mount-s3 daemonizes by default and reads AWS_* from the environment
sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(f"mount-s3 my-bucket {mount_path}")

# Read and write through the mount as if it were a local directory
sandbox.process.exec(f"echo 'hello from Daytona' > {mount_path}/hello.txt")
response = sandbox.process.exec(f"cat {mount_path}/hello.txt")
print(response.result)
```

### Runtime install

Start from a default sandbox and install `mount-s3` during startup before running the mount command. This is useful for quick testing and temporary environments where you do not want to maintain a custom snapshot, with the tradeoff of slower cold starts.

```python
import os
from daytona import CreateSandboxBaseParams, Daytona

daytona = Daytona()

sandbox = daytona.create(
    CreateSandboxBaseParams(
        env_vars={
            "AWS_ACCESS_KEY_ID": os.environ["AWS_ACCESS_KEY_ID"],
            "AWS_SECRET_ACCESS_KEY": os.environ["AWS_SECRET_ACCESS_KEY"],
        },
    )
)

# Install mount-s3 at runtime
sandbox.process.exec(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends libfuse2 ca-certificates wget"
)
sandbox.process.exec(
    'arch="$(dpkg --print-architecture | sed s/amd64/x86_64/)" '
    '&& wget -O /tmp/mount-s3.deb '
    '"https://s3.amazonaws.com/mountpoint-s3-release/latest/${arch}/mount-s3.deb" '
    "&& sudo apt-get install -y /tmp/mount-s3.deb"
)

# Mount and use
mount_path = "/home/daytona/s3"
sandbox.process.exec(f"mkdir -p {mount_path} && mount-s3 my-bucket {mount_path}")
response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

## Mount a Cloudflare R2 bucket

Cloudflare R2 is S3-compatible, so the same `mount-s3` tool works. Pass an explicit `--endpoint-url` pointing at your R2 account.

**Credentials** — set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` in your local environment. R2 is S3-compatible, so the snippets below pass your R2 keys into the sandbox via `envVars` under the `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` names that `mount-s3` expects.

### Pre-built snapshot

Build a snapshot with `mount-s3` preinstalled, then launch all R2-enabled sandboxes from that snapshot. The mount flow stays identical to S3 except for the R2 `--endpoint-url`, and startup remains fast because installation is done once at snapshot build time.

#### Build a snapshot

Create a reusable snapshot that installs the same `mount-s3` tool used for S3. R2 remains S3-compatible, so this snapshot is identical to S3 setup and only the runtime mount command changes.

```python
from daytona import CreateSnapshotParams, Daytona, Image

daytona = Daytona()

image = (
  Image.base("daytonaio/sandbox")
  .run_commands(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends libfuse2 ca-certificates wget",
    'arch="$(dpkg --print-architecture | sed s/amd64/x86_64/)" '
    '&& wget -O /tmp/mount-s3.deb '
    '"https://s3.amazonaws.com/mountpoint-s3-release/latest/${arch}/mount-s3.deb" '
    "&& sudo apt-get install -y /tmp/mount-s3.deb "
    "&& rm /tmp/mount-s3.deb",
  )
)

daytona.snapshot.create(
    CreateSnapshotParams(name="fuse-r2", image=image),
    on_logs=print,
)
```

#### Launch and mount

Pass your R2 credentials into the sandbox as `AWS_*` environment variables and mount with the R2 endpoint URL. This keeps the authentication flow compatible with `mount-s3` while targeting your Cloudflare account.

```python
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

# R2 credentials live in your Cloudflare dashboard under R2 > Manage API Tokens
account_id = os.environ["R2_ACCOUNT_ID"]

sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        snapshot="fuse-r2",
        env_vars={
            "AWS_ACCESS_KEY_ID": os.environ["R2_ACCESS_KEY_ID"],
            "AWS_SECRET_ACCESS_KEY": os.environ["R2_SECRET_ACCESS_KEY"],
        },
    )
)

mount_path = "/home/daytona/r2"

sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(
    f"mount-s3 --endpoint-url https://{account_id}.r2.cloudflarestorage.com "
    f"my-r2-bucket {mount_path}"
)

response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

### Runtime install

Start from a default sandbox and install `mount-s3` during startup, then mount your bucket with the R2 `--endpoint-url`. This path is convenient for prototyping or one-off tasks, but each new sandbox pays the package installation cost.

```python
import os
from daytona import CreateSandboxBaseParams, Daytona

daytona = Daytona()

account_id = os.environ["R2_ACCOUNT_ID"]

sandbox = daytona.create(
    CreateSandboxBaseParams(
        env_vars={
            "AWS_ACCESS_KEY_ID": os.environ["R2_ACCESS_KEY_ID"],
            "AWS_SECRET_ACCESS_KEY": os.environ["R2_SECRET_ACCESS_KEY"],
        },
    )
)

# Install mount-s3
sandbox.process.exec(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends libfuse2 ca-certificates wget"
)
sandbox.process.exec(
    'arch="$(dpkg --print-architecture | sed s/amd64/x86_64/)" '
    '&& wget -O /tmp/mount-s3.deb '
    '"https://s3.amazonaws.com/mountpoint-s3-release/latest/${arch}/mount-s3.deb" '
    "&& sudo apt-get install -y /tmp/mount-s3.deb"
)

# Mount with R2 endpoint
mount_path = "/home/daytona/r2"
sandbox.process.exec(
    f"mkdir -p {mount_path} && "
    f"mount-s3 --endpoint-url https://{account_id}.r2.cloudflarestorage.com "
    f"my-r2-bucket {mount_path}"
)
response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

## Mount a Tigris bucket

Mount a Tigris bucket with the same `mount-s3` tool used for S3. Pass `--endpoint-url https://t3.storage.dev`, because Tigris uses one global endpoint with no per-account subdomain. Tigris also supports bucket snapshots and copy-on-write forks through request headers, so each sandbox can use an isolated writable bucket without duplicating source data.

**Credentials** — set `TIGRIS_STORAGE_ACCESS_KEY_ID` and `TIGRIS_STORAGE_SECRET_ACCESS_KEY` in your local environment. The snippets below pass these into the sandbox via `envVars` under the `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` names that `mount-s3` expects.

### Pre-built snapshot

Build a snapshot with `mount-s3` preinstalled, then launch Tigris sandboxes from that snapshot. The mount flow matches S3 except for the Tigris `--endpoint-url`, and startup stays fast because installation happens once during snapshot build.

#### Build a snapshot

Create a reusable snapshot that installs `mount-s3`. Because Tigris is S3-compatible, this setup matches S3 and only the runtime mount command changes.

```python
from daytona import CreateSnapshotParams, Daytona, Image

daytona = Daytona()

image = (
  Image.base("daytonaio/sandbox")
  .run_commands(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends libfuse2 ca-certificates wget",
    'arch="$(dpkg --print-architecture | sed s/amd64/x86_64/)" '
    '&& wget -O /tmp/mount-s3.deb '
    '"https://s3.amazonaws.com/mountpoint-s3-release/latest/${arch}/mount-s3.deb" '
    "&& sudo apt-get install -y /tmp/mount-s3.deb "
    "&& rm /tmp/mount-s3.deb",
  )
)

daytona.snapshot.create(
    CreateSnapshotParams(name="fuse-tigris", image=image),
    on_logs=print,
)
```

#### Launch and mount

Pass Tigris credentials into the sandbox as `AWS_*` environment variables, then mount with the Tigris endpoint URL. This keeps authentication compatible with `mount-s3` while targeting your Tigris account.

```python
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        snapshot="fuse-tigris",
        env_vars={
            "AWS_ACCESS_KEY_ID": os.environ["TIGRIS_STORAGE_ACCESS_KEY_ID"],
            "AWS_SECRET_ACCESS_KEY": os.environ["TIGRIS_STORAGE_SECRET_ACCESS_KEY"],
        },
    )
)

mount_path = "/home/daytona/tigris"

sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(
    f"mount-s3 --endpoint-url https://t3.storage.dev "
    f"my-tigris-bucket {mount_path}"
)

response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

### Runtime install

Start from a default sandbox, install `mount-s3` during startup, then mount with the Tigris `--endpoint-url`. This path is convenient for prototyping or one-off tasks, but each new sandbox repeats package installation.

```python
import os
from daytona import CreateSandboxBaseParams, Daytona

daytona = Daytona()

sandbox = daytona.create(
    CreateSandboxBaseParams(
        env_vars={
            "AWS_ACCESS_KEY_ID": os.environ["TIGRIS_STORAGE_ACCESS_KEY_ID"],
            "AWS_SECRET_ACCESS_KEY": os.environ["TIGRIS_STORAGE_SECRET_ACCESS_KEY"],
        },
    )
)

# Install mount-s3
sandbox.process.exec(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends libfuse2 ca-certificates wget"
)
sandbox.process.exec(
    'arch="$(dpkg --print-architecture | sed s/amd64/x86_64/)" '
    '&& wget -O /tmp/mount-s3.deb '
    '"https://s3.amazonaws.com/mountpoint-s3-release/latest/${arch}/mount-s3.deb" '
    "&& sudo apt-get install -y /tmp/mount-s3.deb"
)

# Mount with Tigris endpoint
mount_path = "/home/daytona/tigris"
sandbox.process.exec(
    f"mkdir -p {mount_path} && "
    f"mount-s3 --endpoint-url https://t3.storage.dev "
    f"my-tigris-bucket {mount_path}"
)
response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

### Mount a copy-on-write fork per sandbox

A Tigris bucket fork is a new bucket created from a snapshot of a source bucket. The fork shares underlying storage with the source until written to — new writes go only to the fork, and the source bucket and other forks are unaffected. Fork creation is constant-time regardless of source bucket size.

This pattern fits Daytona sandboxes when each sandbox needs a writable copy of a shared dataset (model weights, fixtures, golden data) without duplicating it on every launch.

**Prerequisite** — the source bucket must be created with snapshots enabled. This is a one-time setup, done outside the per-sandbox flow:

```typescript
import { createBucket } from '@tigrisdata/storage'

await createBucket('my-source-bucket', { enableSnapshot: true })
```

In any S3 SDK, send a `CreateBucket` request with the header `X-Tigris-Enable-Snapshot: true`.

The `@tigrisdata/agent-kit` package wraps this workflow as `createForks()`. It snapshots the source bucket and creates one or more forks in a single call. Passing `credentials: { role: 'Editor' }` also creates a scoped access key per fork, so each sandbox can read and write only its own fork bucket instead of the full account.

```typescript
import { createForks, teardownForks } from '@tigrisdata/agent-kit'
import { Daytona } from '@daytona/sdk'

const SOURCE_BUCKET = 'my-source-bucket'

// 1. Snapshot the source and create a fork with a scoped access key
const { data: forkSet, error } = await createForks(SOURCE_BUCKET, 1, {
  credentials: { role: 'Editor' },
})
if (error) throw error
const fork = forkSet.forks[0]

// 2. Launch the sandbox with the fork's scoped credentials
const daytona = new Daytona()
const sandbox = await daytona.create({
  snapshot: 'fuse-tigris',
  envVars: {
    AWS_ACCESS_KEY_ID: fork.credentials!.accessKeyId,
    AWS_SECRET_ACCESS_KEY: fork.credentials!.secretAccessKey,
  },
})

// 3. Mount the fork bucket
const mountPath = '/home/daytona/tigris'
await sandbox.process.executeCommand(`mkdir -p ${mountPath}`)
await sandbox.process.executeCommand(
  `mount-s3 --endpoint-url https://t3.storage.dev ${fork.bucket} ${mountPath}`,
)

try {
  const response = await sandbox.process.executeCommand(`ls ${mountPath}`)
  console.log(response.result)
} finally {
  await daytona.delete(sandbox)
  await teardownForks(forkSet) // revokes the scoped key and deletes the fork bucket
}
```

To run the same workflow from a language without an `agent-kit` equivalent, use any S3 SDK and send the headers documented below. Send `X-Tigris-Snapshot: true` on `CreateBucket` for the source name, then capture `X-Tigris-Snapshot-Version` from the response. Next, send `CreateBucket` for the fork name with `X-Tigris-Fork-Source-Bucket` and `X-Tigris-Fork-Source-Bucket-Snapshot`. Mount the fork with the same `mount-s3` snippets shown above, replacing the bucket name with the fork bucket.

#### Reference: Tigris-specific headers

These headers drive snapshot and fork operations over the S3 API. Use them with any AWS SDK (boto3, aws-sdk-go-v2, aws-sdk-java-v2, aws-sdk-ruby) by attaching a request interceptor.

| Header                                     | Sent on                                   | Purpose                                                                        |
| ------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------ |
| **`X-Tigris-Enable-Snapshot: true`**       | **`CreateBucket`** (new source)           | Enable snapshots on a new bucket. Required before snapshotting it.             |
| **`X-Tigris-Snapshot: true`**              | **`CreateBucket`** (existing source name) | Take a snapshot of the bucket. Optional **`; name=<label>`** suffix labels it. |
| **`X-Tigris-Snapshot-Version`**            | Response to snapshot create               | Snapshot version ID returned to the caller — pass to fork creation.            |
| **`X-Tigris-Fork-Source-Bucket`**          | **`CreateBucket`** (new fork name)        | Source bucket to fork from.                                                    |
| **`X-Tigris-Fork-Source-Bucket-Snapshot`** | **`CreateBucket`** (new fork name)        | Source snapshot version to fork from.                                          |

Source: [**`tigrisdata/storage`**](https://github.com/tigrisdata/storage). See **`shared/headers.ts`** for the full header set.

## Mount a Supabase Storage bucket

Mount a Supabase Storage bucket with the same `mount-s3` tool used for S3. Supabase Storage is [S3-compatible ↗](https://supabase.com/docs/guides/storage/s3/compatibility) and serves each project at `https://<project_ref>.storage.supabase.co/storage/v1/s3`, so pass that endpoint with `--endpoint-url`, the project's region with `--region`, and `--force-path-style`. The path-style flag is required — Supabase serves all buckets from the project hostname rather than per-bucket subdomains, so `mount-s3`'s default virtual-hosted-style addressing (which prepends the bucket name to the endpoint hostname) fails during TLS negotiation.

**Credentials** — in the [Supabase dashboard ↗](https://supabase.com/dashboard/project/_/storage/s3), enable **S3 protocol connection** on your project's **Storage** > **S3** page and generate a pair of S3 access keys. Set `SUPABASE_PROJECT_REF` (the `<project_ref>` subdomain of the endpoint shown on that page), `SUPABASE_REGION` (the project's region, e.g. `us-east-1`), `SUPABASE_S3_ACCESS_KEY_ID`, and `SUPABASE_S3_SECRET_ACCESS_KEY` in your local environment. The snippets below pass the keys into the sandbox via `envVars` under the `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` names that `mount-s3` expects. S3 access keys grant full access to every bucket in the project and bypass [Row Level Security ↗](https://supabase.com/docs/guides/storage/security/access-control) policies, so treat them as server-side secrets.

### Pre-built snapshot

Build a snapshot with `mount-s3` preinstalled, then launch Supabase-enabled sandboxes from that snapshot. The mount flow matches S3 except for the Supabase `--endpoint-url`, `--region`, and `--force-path-style` flags, and startup stays fast because installation happens once during snapshot build.

#### Build a snapshot

Create a reusable snapshot that installs `mount-s3`. Because Supabase Storage is S3-compatible, this setup matches S3 and only the runtime mount command changes.

```python
from daytona import CreateSnapshotParams, Daytona, Image

daytona = Daytona()

image = (
  Image.base("daytonaio/sandbox")
  .run_commands(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends libfuse2 ca-certificates wget",
    'arch="$(dpkg --print-architecture | sed s/amd64/x86_64/)" '
    '&& wget -O /tmp/mount-s3.deb '
    '"https://s3.amazonaws.com/mountpoint-s3-release/latest/${arch}/mount-s3.deb" '
    "&& sudo apt-get install -y /tmp/mount-s3.deb "
    "&& rm /tmp/mount-s3.deb",
  )
)

daytona.snapshot.create(
    CreateSnapshotParams(name="fuse-supabase", image=image),
    on_logs=print,
)
```

#### Launch and mount

Pass your Supabase S3 access keys into the sandbox as `AWS_*` environment variables, then mount with the project's S3 endpoint, region, and path-style addressing. This keeps authentication compatible with `mount-s3` while targeting your Supabase project.

```python
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

# S3 endpoint, region, and access keys live in your Supabase dashboard under Storage > S3
project_ref = os.environ["SUPABASE_PROJECT_REF"]
region = os.environ["SUPABASE_REGION"]

sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        snapshot="fuse-supabase",
        env_vars={
            "AWS_ACCESS_KEY_ID": os.environ["SUPABASE_S3_ACCESS_KEY_ID"],
            "AWS_SECRET_ACCESS_KEY": os.environ["SUPABASE_S3_SECRET_ACCESS_KEY"],
        },
    )
)

mount_path = "/home/daytona/supabase"

sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(
    f"mount-s3 --endpoint-url https://{project_ref}.storage.supabase.co/storage/v1/s3 "
    f"--region {region} --force-path-style "
    f"my-supabase-bucket {mount_path}"
)

response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

### Runtime install

Start from a default sandbox, install `mount-s3` during startup, then mount with the Supabase `--endpoint-url`, `--region`, and `--force-path-style` flags. This path is convenient for prototyping or one-off tasks, but each new sandbox repeats package installation.

```python
import os
from daytona import CreateSandboxBaseParams, Daytona

daytona = Daytona()

project_ref = os.environ["SUPABASE_PROJECT_REF"]
region = os.environ["SUPABASE_REGION"]

sandbox = daytona.create(
    CreateSandboxBaseParams(
        env_vars={
            "AWS_ACCESS_KEY_ID": os.environ["SUPABASE_S3_ACCESS_KEY_ID"],
            "AWS_SECRET_ACCESS_KEY": os.environ["SUPABASE_S3_SECRET_ACCESS_KEY"],
        },
    )
)

# Install mount-s3
sandbox.process.exec(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends libfuse2 ca-certificates wget"
)
sandbox.process.exec(
    'arch="$(dpkg --print-architecture | sed s/amd64/x86_64/)" '
    '&& wget -O /tmp/mount-s3.deb '
    '"https://s3.amazonaws.com/mountpoint-s3-release/latest/${arch}/mount-s3.deb" '
    "&& sudo apt-get install -y /tmp/mount-s3.deb"
)

# Mount with Supabase endpoint
mount_path = "/home/daytona/supabase"
sandbox.process.exec(
    f"mkdir -p {mount_path} && "
    f"mount-s3 --endpoint-url https://{project_ref}.storage.supabase.co/storage/v1/s3 "
    f"--region {region} --force-path-style "
    f"my-supabase-bucket {mount_path}"
)
response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

## Mount a Google Cloud Storage bucket

Mount a GCS bucket using [gcsfuse ↗](https://github.com/GoogleCloudPlatform/gcsfuse) — Google's official FUSE client.

**Credentials** — `gcsfuse` reads a service account JSON key file. The snippets below read the key from a local path on your host and upload it into the sandbox via `sandbox.fs`.
> **Note:**
> Daytona's base image is Debian Trixie, but Google has not published a Trixie-specific gcsfuse repository yet. The `gcsfuse-bookworm` repo packages run cleanly on Trixie, so we use them in the snippets below.

### Pre-built snapshot

Build a snapshot with `gcsfuse` preinstalled, then launch all GCS-enabled sandboxes from that snapshot. This avoids repeating apt repository setup and package installation for every sandbox, which makes startup behavior more consistent.

#### Build a snapshot

Create a reusable snapshot that installs `gcsfuse` plus its apt repository configuration. After this step, GCS-enabled sandboxes can mount immediately without repeating package setup.

```python
from daytona import CreateSnapshotParams, Daytona, Image

daytona = Daytona()

image = (
  Image.base("daytonaio/sandbox")
  .run_commands(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends ca-certificates curl gnupg",
    "sudo mkdir -p /etc/apt/keyrings "
    "&& curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg "
    "| sudo gpg --dearmor -o /etc/apt/keyrings/gcsfuse.gpg",
    'echo "deb [signed-by=/etc/apt/keyrings/gcsfuse.gpg] '
    'https://packages.cloud.google.com/apt gcsfuse-bookworm main" '
    "| sudo tee /etc/apt/sources.list.d/gcsfuse.list",
    "sudo apt-get update && sudo apt-get install -y gcsfuse",
  )
)

daytona.snapshot.create(
    CreateSnapshotParams(name="fuse-gcs", image=image),
    on_logs=print,
)
```

#### Launch and mount

`gcsfuse` authenticates to GCS with a service account JSON key. Upload it into the sandbox via `sandbox.fs` and point `gcsfuse` at it with `--key-file`.

```python
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

# GCS_SERVICE_ACCOUNT_KEY holds the full service account JSON as a string
service_account_key = os.environ["GCS_SERVICE_ACCOUNT_KEY"].encode()

sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="fuse-gcs"))

mount_path = "/home/daytona/gcs"
key_path = "/home/daytona/.gcs-key.json"

# Upload the key file into the sandbox
sandbox.fs.upload_file(service_account_key, key_path)
sandbox.process.exec(f"chmod 600 {key_path}")

# Mount the bucket
sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(f"gcsfuse --key-file={key_path} my-gcs-bucket {mount_path}")

# Use the mount
response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

### Runtime install

Start from a default sandbox and install `gcsfuse` when the sandbox starts, then upload the service account key and mount the bucket. This is the fastest way to iterate on setup, but every sandbox repeats install and key staging steps.

```python
import os
from daytona import CreateSandboxBaseParams, Daytona

daytona = Daytona()

# GCS_SERVICE_ACCOUNT_KEY holds the full service account JSON as a string
service_account_key = os.environ["GCS_SERVICE_ACCOUNT_KEY"].encode()

sandbox = daytona.create(CreateSandboxBaseParams())

# Install gcsfuse from the bookworm repo (works on Trixie)
sandbox.process.exec(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends ca-certificates curl gnupg"
)
sandbox.process.exec(
    "sudo mkdir -p /etc/apt/keyrings "
    "&& curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg "
    "| sudo gpg --dearmor -o /etc/apt/keyrings/gcsfuse.gpg"
)
sandbox.process.exec(
    'echo "deb [signed-by=/etc/apt/keyrings/gcsfuse.gpg] '
    'https://packages.cloud.google.com/apt gcsfuse-bookworm main" '
    "| sudo tee /etc/apt/sources.list.d/gcsfuse.list "
    "&& sudo apt-get update && sudo apt-get install -y gcsfuse"
)

# Upload the key and mount
mount_path = "/home/daytona/gcs"
key_path = "/home/daytona/.gcs-key.json"
sandbox.fs.upload_file(service_account_key, key_path)
sandbox.process.exec(f"chmod 600 {key_path}")
sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(f"gcsfuse --key-file={key_path} my-gcs-bucket {mount_path}")

response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

## Mount an Azure Blob container

Mount an Azure Blob container using [blobfuse2 ↗](https://github.com/Azure/azure-storage-fuse) — Microsoft's official FUSE client.

**Credentials** — set `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_CONTAINER`, and `AZURE_STORAGE_ACCOUNT_KEY` in your local environment. The snippets below pass them into the sandbox via `envVars`, and `blobfuse2` reads them from its YAML config.
> **Caution:**
> Daytona's base image is Debian Trixie. Microsoft's `blobfuse2` Bookworm binary links against `libfuse3.so.3`, but Trixie's `fuse3` package bumped the SONAME to `.4`, so `libfuse3.so.3` is missing on disk. The snapshot recipe below creates a compatibility symlink. Without it, `blobfuse2` fails with `libfuse3.so.3: cannot open shared object file`.

### Pre-built snapshot

Build a snapshot with `blobfuse2` and required FUSE compatibility setup preinstalled, then launch all Azure-enabled sandboxes from that snapshot. This is the recommended path for stable environments because dependency and compatibility work runs once during snapshot creation.

#### Build a snapshot

Create a reusable snapshot that installs `blobfuse2`, configures required FUSE dependencies, and applies the Trixie compatibility steps. This ensures Azure mounts work out of the box in sandboxes launched from `fuse-azure`.

```python
from daytona import CreateSnapshotParams, Daytona, Image

daytona = Daytona()

image = (
  Image.base("daytonaio/sandbox")
  .run_commands(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends ca-certificates curl gnupg wget",
    # Microsoft's apt repo (use bookworm packages on Trixie)
    "wget -qO- https://packages.microsoft.com/keys/microsoft.asc "
    "| sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/microsoft.gpg",
    'echo "deb [arch=$(dpkg --print-architecture) '
    'signed-by=/etc/apt/trusted.gpg.d/microsoft.gpg] '
    'https://packages.microsoft.com/debian/12/prod bookworm main" '
    "| sudo tee /etc/apt/sources.list.d/microsoft-prod.list",
    "sudo apt-get update && sudo apt-get install -y blobfuse2 fuse3",
    # libfuse3.so.3 compat symlink for Trixie (see :::caution above)
    'src=$(find /usr/lib /lib -name "libfuse3.so.3.*" -type f 2>/dev/null '
    "| sort -V | tail -1) "
    '&& sudo ln -sfn "$src" "$(dirname "$src")/libfuse3.so.3" '
    "&& sudo ldconfig",
    "sudo touch /etc/fuse.conf "
    '&& grep -qxF "user_allow_other" /etc/fuse.conf '
    '|| echo "user_allow_other" | sudo tee -a /etc/fuse.conf',
  )
)

daytona.snapshot.create(
    CreateSnapshotParams(name="fuse-azure", image=image),
    on_logs=print,
)
```

#### Launch and mount

`blobfuse2` reads its configuration from a YAML file. Build it with your account credentials and upload it into the sandbox.

The YAML below tells `blobfuse2` three things: **where to connect** (the `azstorage:` block — your storage account, the container you want to mount, the endpoint URL, and the auth method), **what to enable** (the `components:` list — the FUSE interface itself, a content cache, a metadata cache, and the Azure backend), and **how to log**. The cache components use sensible defaults when listed without their own top-level config blocks; add explicit `block_cache:` / `attr_cache:` blocks later if you need to tune cache sizes or timeouts. Note that in Azure terminology, a "container" is the equivalent of an S3 bucket — it's specified inside the YAML rather than passed as a command-line argument.

```python
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="fuse-azure"))

mount_path = "/home/daytona/azure"
config_path = "/home/daytona/.blobfuse2.yaml"

account = os.environ["AZURE_STORAGE_ACCOUNT"]
container = os.environ["AZURE_STORAGE_CONTAINER"]
account_key = os.environ["AZURE_STORAGE_ACCOUNT_KEY"]

config = f"""\
allow-other: true
logging:
  type: syslog
  level: log_warning
components:
  - libfuse
  - block_cache
  - attr_cache
  - azstorage
azstorage:
  type: block
  account-name: {account}
  container: {container}
  endpoint: https://{account}.blob.core.windows.net
  auth-type: key
  account-key: {account_key}
"""

sandbox.fs.upload_file(config.encode(), config_path)
sandbox.process.exec(f"chmod 600 {config_path}")

# Mount the container
sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(f"blobfuse2 mount --config-file={config_path} {mount_path}")

# Use the mount
response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

### Runtime install

Start from a default sandbox and install `blobfuse2` during startup before writing the config and mounting the container. This is useful for quick validation and experiments, with the tradeoff of slower cold starts and repeated setup on each sandbox launch.

```python
import os
from daytona import CreateSandboxBaseParams, Daytona

daytona = Daytona()

sandbox = daytona.create(CreateSandboxBaseParams())

# Install blobfuse2
sandbox.process.exec(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends ca-certificates curl gnupg wget"
)
sandbox.process.exec(
    "wget -qO- https://packages.microsoft.com/keys/microsoft.asc "
    "| sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/microsoft.gpg"
)
sandbox.process.exec(
    'echo "deb [arch=$(dpkg --print-architecture) '
    'signed-by=/etc/apt/trusted.gpg.d/microsoft.gpg] '
    'https://packages.microsoft.com/debian/12/prod bookworm main" '
    "| sudo tee /etc/apt/sources.list.d/microsoft-prod.list "
    "&& sudo apt-get update && sudo apt-get install -y blobfuse2 fuse3"
)
# libfuse3.so.3 compat symlink for Trixie
sandbox.process.exec(
    'src=$(find /usr/lib /lib -name "libfuse3.so.3.*" -type f 2>/dev/null '
    "| sort -V | tail -1) "
    '&& sudo ln -sfn "$src" "$(dirname "$src")/libfuse3.so.3" '
    "&& sudo ldconfig"
)

# Build config and mount
mount_path = "/home/daytona/azure"
config_path = "/home/daytona/.blobfuse2.yaml"
account = os.environ["AZURE_STORAGE_ACCOUNT"]
container = os.environ["AZURE_STORAGE_CONTAINER"]
account_key = os.environ["AZURE_STORAGE_ACCOUNT_KEY"]

config = f"""\
allow-other: true
components:
  - libfuse
  - block_cache
  - attr_cache
  - azstorage
azstorage:
  type: block
  account-name: {account}
  container: {container}
  endpoint: https://{account}.blob.core.windows.net
  auth-type: key
  account-key: {account_key}
"""

sandbox.fs.upload_file(config.encode(), config_path)
sandbox.process.exec(f"chmod 600 {config_path}")
sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(f"blobfuse2 mount --config-file={config_path} {mount_path}")

response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

## Mount a Box folder

Mount a Box folder using [Box Mount ↗](https://developer.box.com/guides/box-mount) — Box's official client for agent runtimes. Box Mount runs a background daemon that maps a Box folder to a local directory and keeps it in continuous two-way sync: writes in the sandbox upload to Box, changes made in Box appear in the sandbox, and simultaneous edits are preserved as conflict copies instead of overwritten. Every operation flows through the Box API as the authenticated identity, so Box permissions, retention, and audit trails apply to everything the sandbox does.
> **Note:**
> Box Mount is in private preview: Box provides the binary and setup guidance to preview participants — request access via the [Box Mount preview form ↗](https://bit.ly/box-mount-preview). Preview workloads are limited to 5 GB and 10,000 files per mount, and applications that save files by replacing them (write-temp-then-rename) create new files instead of new versions. See [known limitations ↗](https://developer.box.com/guides/box-mount#known-limitations).

Box Mount supports two authentication methods: **JWT server authentication** for enterprise-owned Platform Apps — fully non-interactive, the recommended mode for sandboxes — and **OAuth**, which acts as the user who authorized the app. Credentials are supplied through environment variables or a config file; see [configure credentials ↗](https://developer.box.com/guides/box-mount#configure-credentials).

### Install Box Mount

Box Mount ships as a single Linux binary (x86_64 and ARM64). Bake it into a snapshot from your local copy, or upload it into a running sandbox — both end with `box-mount` on the sandbox `PATH`.

#### Pre-built snapshot

Create a reusable snapshot that copies the binary from your local machine into the image — the snippets assume it sits at `./box-mount`; adjust the local path to match the file Box provided. The binary is installed as `agent-mount` with a `box-mount` symlink because current preview binaries resolve their sync engine by the `agent-mount` name. Sandboxes launched from `box-mount` need no further installation. The Java SDK supports `addLocalFile` from `io.daytona:sdk` version `0.214.0`.

```python
from daytona import CreateSnapshotParams, Daytona, Image

daytona = Daytona()

image = (
  Image.base("daytonaio/sandbox")
  .add_local_file("./box-mount", "/usr/local/bin/agent-mount")
  .run_commands(
    "sudo chmod +x /usr/local/bin/agent-mount",
    "sudo ln -s agent-mount /usr/local/bin/box-mount",
  )
)

daytona.snapshot.create(
    CreateSnapshotParams(name="box-mount", image=image),
    on_logs=print,
)
```

#### Runtime install

To skip snapshot management, upload the binary into a running sandbox instead — slower per sandbox, but with no snapshot to maintain:

```python
from daytona import CreateSandboxBaseParams, Daytona

daytona = Daytona()

sandbox = daytona.create(CreateSandboxBaseParams())

with open("./box-mount", "rb") as f:
    sandbox.fs.upload_file(f.read(), "/tmp/box-mount")
sandbox.process.exec(
    "sudo mv /tmp/box-mount /usr/local/bin/agent-mount "
    "&& sudo chmod +x /usr/local/bin/agent-mount "
    "&& sudo ln -s agent-mount /usr/local/bin/box-mount"
)

response = sandbox.process.exec("box-mount --version")
print(response.result)
```

### Mount with JWT server authentication

JWT is the recommended mode for sandboxes: authentication is fully non-interactive, tokens are minted and refreshed in memory from a static config file, and there is nothing to rotate or hand out per sandbox. It requires an app owned by a Box enterprise — on a personal account the generated config contains `"enterpriseID": "0"` and authentication fails.

**Credentials** — create a [Platform App with JWT authentication ↗](https://developer.box.com/guides/authentication/jwt/jwt-setup/) in the Box Developer Console — select **JWT**, not the Client Credentials Grant the console recommends, because Box Mount supports OAuth and JWT only. Go to **Configuration** → **Add and Manage Public Keys**, and click **Generate a Public/Private Keypair** — this downloads the app's config JSON (keypair generation requires 2FA on your Box account). Then have a Box admin [authorize the app ↗](https://developer.box.com/guides/authorization/) for your enterprise. Set `BOX_CONFIG_JSON` in your local environment to the full contents of that JSON file. The snippets below upload it into the sandbox via `sandbox.fs` and point Box Mount at it with the `BOX_AUTH_TYPE` and `BOX_JWT_CONFIG_PATH` environment variables.
> **Note:**
> A JWT app authenticates as a [service account ↗](https://developer.box.com/platform/user-types/) with its own content tree — it does not see any user's files by default. To mount an existing folder, invite the service account's email address (shown in the Developer Console under **General Settings**) as a collaborator on that folder, and pass the folder's ID — the number at the end of its Box URL — to `box-mount mount`.

```python
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

# BOX_CONFIG_JSON holds the full Platform App config JSON as a string
box_config = os.environ["BOX_CONFIG_JSON"].encode()

sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        snapshot="box-mount",
        env_vars={
            "BOX_AUTH_TYPE": "jwt",
            "BOX_JWT_CONFIG_PATH": "/home/daytona/.box-jwt-config.json",
        },
    )
)

mount_path = "/home/daytona/box"

# Upload the config file into the sandbox
sandbox.fs.upload_file(box_config, "/home/daytona/.box-jwt-config.json")
sandbox.process.exec("chmod 600 /home/daytona/.box-jwt-config.json")

# Mount the Box folder (the daemon starts and syncs both ways)
sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(f'box-mount mount "{mount_path}" "123456789"')
sandbox.process.exec("box-mount status")

# Use the mount
sandbox.process.exec(f"echo 'hello from Daytona' > {mount_path}/hello.txt")
response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

To unmount during the sandbox's lifetime, run `box-mount unmount "/home/daytona/box"`; deleting the sandbox tears the daemon down automatically.

### Mount with OAuth

OAuth mode acts as the user who authorized the app, so the mount can never reach content that user cannot. Box Mount reads the OAuth credentials from environment variables — no config upload is needed. To obtain the initial token pair, complete your app's OAuth flow once outside the sandbox; see [Box Mount credentials ↗](https://developer.box.com/guides/box-mount#configure-credentials) and the [OAuth 2.0 setup guide ↗](https://developer.box.com/guides/authentication/oauth2/oauth2-setup/). Set `BOX_CLIENT_ID`, `BOX_CLIENT_SECRET`, `BOX_ACCESS_TOKEN`, and `BOX_REFRESH_TOKEN` in your local environment; the snippets below pass them into the sandbox via `envVars`.

```python
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        snapshot="box-mount",
        env_vars={
            "BOX_CLIENT_ID": os.environ["BOX_CLIENT_ID"],
            "BOX_CLIENT_SECRET": os.environ["BOX_CLIENT_SECRET"],
            "BOX_ACCESS_TOKEN": os.environ["BOX_ACCESS_TOKEN"],
            "BOX_REFRESH_TOKEN": os.environ["BOX_REFRESH_TOKEN"],
        },
    )
)

mount_path = "/home/daytona/box"

# Mount the Box folder (the daemon starts and syncs both ways)
sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(f'box-mount mount "{mount_path}" "123456789"')
sandbox.process.exec("box-mount status")

# Use the mount
sandbox.process.exec(f"echo 'hello from Daytona' > {mount_path}/hello.txt")
response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```
> **Note:**
> Box rotates the refresh token on every renewal (roughly hourly), and Box Mount writes the rotated pair back to its config inside the sandbox — the values you injected go stale after the first refresh. Keep one token chain per sandbox and don't reuse a chain that another integration relies on. For fleets of sandboxes sharing one identity, JWT avoids per-sandbox tokens entirely. A [developer token ↗](https://developer.box.com/guides/authentication/tokens/developer-tokens) passed as `BOX_ACCESS_TOKEN` alone also works for quick tests: it lasts 60 minutes and cannot refresh, so syncing stops when it expires.

## Mount an Archil disk

[Archil ↗](https://archil.com) is an infinite, elastic, POSIX file system that automatically synchronizes to object storage like S3, R2, and Azure Blob. You should use Archil when you need to mount a bucket to your Daytona sandbox, but need higher out-of-the-box performance than traditional FUSE mounts. Archil achieves higher performance by using shared SSD read and write caching in front of your object storage bucket. Archil disks are mounted as regular directories, scale to whatever your sandbox writes (you pay only for what you use), and can be [mounted by many sandboxes at once ↗](https://docs.archil.com/concepts/shared-disks), making them a natural fit for parallel agents that share state.

**Credentials** — set `ARCHIL_MOUNT_TOKEN` (a disk-scoped [mount token ↗](https://docs.archil.com/concepts/disk-users#disk-token-authorization) generated from the disk's **Details** page in the [Archil console ↗](https://console.archil.com)), `ARCHIL_REGION` (the disk's region, e.g. `aws-us-east-1`), and `ARCHIL_DISK` (the owner-qualified disk name, e.g. `myorg/my-disk`, or disk ID like `dsk-0123456789abcdef`) in your local environment. The snippets below pass them into the sandbox via `envVars`, and the `archil` CLI reads them from there.

### Pre-built snapshot

Build a snapshot with the `archil` CLI preinstalled, then launch Archil-enabled sandboxes from that snapshot. You still authenticate and mount at runtime, but installation is no longer part of each sandbox startup sequence.

#### Build a snapshot

Create a reusable snapshot that installs the `archil` CLI. The `daytonaio/sandbox` base image ships Debian Trixie which doesn't include `libfuse2`, and the `archil` CLI links against it, so we apt-install it before the Archil installer. On Trixie the package is named `libfuse2t64`; installing `libfuse2` also works because it is a transitional package that pulls in `libfuse2t64`.

```python
from daytona import CreateSnapshotParams, Daytona, Image

daytona = Daytona()

image = (
  Image.base("daytonaio/sandbox")
  .run_commands(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends libfuse2 ca-certificates",
    "curl -fsSL https://archil.com/install | sh",
  )
)

daytona.snapshot.create(
    CreateSnapshotParams(name="fuse-archil", image=image),
    on_logs=lambda chunk: print(chunk, end="", flush=True),
)
```

#### Launch and mount

Pass `ARCHIL_MOUNT_TOKEN`, `ARCHIL_REGION`, and `ARCHIL_DISK` to the sandbox via `envVars`. Your code then mounts the disk at `/home/daytona/archil` and hands ownership to the `daytona` user so non-root processes can read and write through the mount. The `chown` step works on exclusive (non-shared) mounts only; on mounts created with `--shared` or `--read-only` it fails with `Read-only file system`. See [Shared and read-only mounts](#shared-and-read-only-mounts).

```python
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

mount_path = "/home/daytona/archil"

sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        snapshot="fuse-archil",
        env_vars={
            "ARCHIL_MOUNT_TOKEN": os.environ["ARCHIL_MOUNT_TOKEN"],
            "ARCHIL_REGION": os.environ["ARCHIL_REGION"],
            "ARCHIL_DISK": os.environ["ARCHIL_DISK"],
        },
    )
)

sandbox.process.exec(f"sudo mkdir -p {mount_path}")
sandbox.process.exec(
    f"sudo --preserve-env=ARCHIL_MOUNT_TOKEN archil mount "
    f"$ARCHIL_DISK {mount_path} --region $ARCHIL_REGION"
)
# Exclusive mounts only; on --shared or --read-only mounts this fails
# with "Read-only file system" (see "Shared and read-only mounts" below)
sandbox.process.exec(f"sudo chown daytona:daytona {mount_path}")

# Read and write through the mount as if it were a local directory
response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

To let multiple sandboxes mount the **same** disk concurrently, add `--shared` to `archil mount`. Shared mounts change how permissions and writes behave; see [Shared and read-only mounts](#shared-and-read-only-mounts).

### Runtime install

Start from a default sandbox and install the `archil` CLI during startup before mounting the disk. This is useful when iterating quickly on mount behavior, with the tradeoff of slower cold starts for each sandbox.

```python
import os
from daytona import CreateSandboxBaseParams, Daytona

daytona = Daytona()

mount_path = "/home/daytona/archil"

sandbox = daytona.create(
    CreateSandboxBaseParams(
        env_vars={
            "ARCHIL_MOUNT_TOKEN": os.environ["ARCHIL_MOUNT_TOKEN"],
            "ARCHIL_REGION": os.environ["ARCHIL_REGION"],
            "ARCHIL_DISK": os.environ["ARCHIL_DISK"],
        },
    )
)

sandbox.process.exec(
    "sudo apt-get update "
    "&& sudo apt-get install -y --no-install-recommends libfuse2 ca-certificates"
)
sandbox.process.exec("curl -fsSL https://archil.com/install | sh")

sandbox.process.exec(f"sudo mkdir -p {mount_path}")
sandbox.process.exec(
    f"sudo --preserve-env=ARCHIL_MOUNT_TOKEN archil mount "
    f"$ARCHIL_DISK {mount_path} --region $ARCHIL_REGION"
)
# Exclusive mounts only; on --shared or --read-only mounts this fails
# with "Read-only file system" (see "Shared and read-only mounts" below)
sandbox.process.exec(f"sudo chown daytona:daytona {mount_path}")

response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

### Shared and read-only mounts

The `--shared` and `--read-only` flags produce the same mount behavior: the entire mount is read-only, including `chmod` and `chown`, until `archil checkout <path>` grants a write delegation for that path. This has two consequences for the snippets above:

- **`sudo chown daytona:daytona <mountPath>`** fails with "Read-only file system" on any **`--shared`** or **`--read-only`** mount. On a writable shared mount:

1. Run **`sudo archil checkout <mountPath>`**
2. Run **`chown`**
3. Run **`sudo archil checkin <mountPath>`**

- Ownership and permissions come from the metadata stored on the Archil disk, not from the mount. If a root process wrote files with a restrictive umask, every mount shows them as **`root:root`** with mode **`600`**, and the **`daytona`** user cannot read them.

1. **Fix permissions at the source (recommended)**

    Write with `umask 022` or run `chmod -R a+rX` after writing, so files are readable from the start. For existing data, apply a one-time fix from any client with a writable shared mount:

```bash
sudo --preserve-env=ARCHIL_MOUNT_TOKEN archil mount "$ARCHIL_DISK" /mnt/fix --region "$ARCHIL_REGION" --shared
sudo archil checkout /mnt/fix/data
sudo chmod -R a+rX /mnt/fix/data
sudo archil checkin /mnt/fix/data
```

The permission bits persist on the disk, so every subsequent read-only mount shows the corrected modes.

2. **Re-export with `bindfs` (when the source data cannot be changed)**

    Inside the sandbox, mount a read-only view of the Archil mount that remaps ownership to the **`daytona`** user:

```bash
sudo apt-get install -y bindfs
mkdir -p /home/daytona/archil-view
sudo bindfs --force-user=daytona --force-group=daytona --perms=a+rX \
  /home/daytona/archil /home/daytona/archil-view
```

The **`archil`** CLI requires root to mount and has no uid, gid, or umask override flags, so there is no way to remap ownership at mount time.

### Common pitfalls

Archil works on Tier 3 and Tier 4 sandboxes with default network settings (full egress) without additional configuration. The following failure modes look like Daytona blocking egress but have other causes:

- **Missing `libfuse2`.** The `daytonaio/sandbox` base image ships Debian Trixie, which does not include `libfuse2`, and the `archil` CLI links against it. Install `libfuse2t64` (the Trixie package name; `libfuse2` is a transitional package that pulls it in) before running the Archil installer, or bake both into a [pre-built snapshot](#pre-built-snapshot-6).
- **Egress allowlists break Archil.** A sandbox with a [`domainAllowList`](./network-limits.md) cannot mount Archil disks: the Archil control plane is reached as a bare IP address on port `8100`, which a domain allowlist cannot express. The installer also downloads from `s3.amazonaws.com/archil-client/`, which must be reachable at install time. A [`networkAllowList`](./network-limits.md) (CIDR) can pin Archil's mount and control IP addresses, but those addresses change, so this is fragile and not recommended. Use full egress for sandboxes that mount Archil disks.
- **`api.archil.com` is not a valid endpoint.** The hostname does not resolve (NXDOMAIN), so allowlisting or testing against it fails regardless of network settings. Archil endpoints are region-specific; for `aws-us-east-1` they are `mount.green.us-east-1.aws.prod.archil.com:8100` and `control.green.us-east-1.aws.prod.archil.com:443`. See [Archil troubleshooting ↗](https://docs.archil.com/reference/troubleshooting).
- **The disk is exclusively mounted elsewhere.** An exclusive mount holds a delegation lock on the disk. Mounting from another sandbox fails until the first client unmounts or runs `archil checkin`, or the new mount passes `--shared` (or `--force` to break a stale lock). This is an Archil delegation conflict, not an egress failure.

## Mount a MesaFS filesystem

[MesaFS ↗](https://mesa.dev) is an agent-native versioned filesystem from Mesa, purpose-built for the same workloads Daytona sandboxes run — parallel agent swarms, shared working memory, structured artifacts, and long-lived state across runs. With MesaFS, instead of mounting a cloud bucket, you mount a Mesa **repository**: a Git-compatible versioned working directory with sub-50ms reads/writes, instant fork/branch operations, and unlimited concurrent writers.

The Mesa setup follows the same pattern as the bucket providers but uses the Mesa CLI rather than a FUSE-specific tool: install the CLI in your sandbox, authenticate with your API key, and run `mesa mount --daemonize` to mount your repos at `/home/daytona/mesa/mnt/<org>/<repo>`.

**Credentials** — set `MESA_API_KEY` and `MESA_ORG` (your Mesa organization slug) in your local environment. The snippets below pass them into the sandbox via `envVars`, and the Mesa CLI reads them from there.

### Pre-built snapshot

Build a snapshot with the Mesa CLI preinstalled, then launch Mesa-enabled sandboxes from that snapshot. You still authenticate and mount at runtime, but installation is no longer part of each sandbox startup sequence.

#### Build a snapshot

Create a reusable snapshot that installs the Mesa CLI and enables the FUSE `user_allow_other` setting. Sandboxes launched from `fuse-mesa` can then authenticate and mount repos without repeating install work.

```python
from daytona import CreateSnapshotParams, Daytona, Image

daytona = Daytona()

image = (
  Image.base("daytonaio/sandbox")
  .run_commands(
    "curl -fsSL https://mesa.dev/install.sh | sh",
    "sudo sed -i 's/^#user_allow_other/user_allow_other/' /etc/fuse.conf",
  )
)

daytona.snapshot.create(
    CreateSnapshotParams(name="fuse-mesa", image=image),
    on_logs=lambda chunk: print(chunk, end="", flush=True),
)
```

#### Launch and mount

Pass `MESA_API_KEY` and your Mesa organization slug to the sandbox via `envVars`. Your code then writes a TOML config into the sandbox, authenticates the Mesa CLI, and mounts your repos at `/home/daytona/mesa/mnt/<org>/<repo>`.

```python
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

org = os.environ["MESA_ORG"]
repo = "my-workspace"
mount_path = f"/home/daytona/mesa/mnt/{org}/{repo}"
config_path = "/home/daytona/.config/mesa/config.toml"

sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        snapshot="fuse-mesa",
        env_vars={
            "MESA_API_KEY": os.environ["MESA_API_KEY"],
            "MESA_ORG": org,
        },
    )
)

config = f'''mount-point = "/home/daytona/mesa/mnt"

[secrets]
backend = "plaintext-file"

[organizations.{org}]
'''

sandbox.process.exec(f"mkdir -p $(dirname {config_path})")
sandbox.fs.upload_file(config.encode(), config_path)

sandbox.process.exec("mesa auth set-key --org $MESA_ORG $MESA_API_KEY")
sandbox.process.exec("mesa mount --daemonize")

response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

### Runtime install

Start from a default sandbox and install the Mesa CLI during startup before configuring auth and running `mesa mount --daemonize`. This is useful when iterating quickly on mount behavior, with the tradeoff of slower cold starts for each sandbox.

```python
import os
from daytona import CreateSandboxBaseParams, Daytona

daytona = Daytona()

org = os.environ["MESA_ORG"]
repo = "my-workspace"
mount_path = f"/home/daytona/mesa/mnt/{org}/{repo}"
config_path = "/home/daytona/.config/mesa/config.toml"

sandbox = daytona.create(
    CreateSandboxBaseParams(
        env_vars={
            "MESA_API_KEY": os.environ["MESA_API_KEY"],
            "MESA_ORG": org,
        },
    )
)

sandbox.process.exec("curl -fsSL https://mesa.dev/install.sh | sh")
sandbox.process.exec(
    "sudo sed -i 's/^#user_allow_other/user_allow_other/' /etc/fuse.conf"
)

config = f'''mount-point = "/home/daytona/mesa/mnt"

[secrets]
backend = "plaintext-file"

[organizations.{org}]
'''

sandbox.process.exec(f"mkdir -p $(dirname {config_path})")
sandbox.fs.upload_file(config.encode(), config_path)

sandbox.process.exec("mesa auth set-key --org $MESA_ORG $MESA_API_KEY")
sandbox.process.exec("mesa mount --daemonize")

response = sandbox.process.exec(f"ls {mount_path}")
print(response.result)
```

### Production: scoped ephemeral keys

For non-test workloads, Mesa recommends minting a **short-lived, scoped API key per sandbox session** rather than passing your long-lived `MESA_API_KEY` into the sandbox. Use the [Mesa SDK ↗](https://docs.mesa.dev) on your trusted host to derive an ephemeral key from your long-lived one — the long-lived key never leaves your host process. Mesa SDKs are available for TypeScript, Python, and Rust; for other languages, use the [Mesa REST API ↗](https://docs.mesa.dev/content/api-reference/overview) directly.

```python
import asyncio
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona
from mesa_sdk import Mesa


async def mint_ephemeral_key() -> str:
    async with Mesa(api_key=os.environ["MESA_API_KEY"], org=os.environ["MESA_ORG"]) as mesa:
        key = await mesa.api_keys.create(
            name="sandbox-session",
            scopes=["read", "write"],
            expires_in_seconds=3600,
        )
        return key.key


ephemeral_key = asyncio.run(mint_ephemeral_key())

daytona = Daytona()
sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        snapshot="fuse-mesa",
        env_vars={
            "MESA_API_KEY": ephemeral_key,
            "MESA_ORG": os.environ["MESA_ORG"],
        },
    )
)
```

The rest of the launch flow (writing the TOML config, `mesa auth set-key`, `mesa mount --daemonize`) is unchanged — the sandbox doesn't know whether the key it received is long-lived or ephemeral.

For repo-scoped or path-scoped keys, see Mesa's [auth and permissions guide ↗](https://docs.mesa.dev/content/getting-started/auth-and-permissions). For the full integration recipe, see Mesa's [Daytona guide ↗](https://docs.mesa.dev/content/integration-guides/daytona).

## Mount a TiDB Cloud Filesystem

[TiDB Cloud Filesystem ↗](https://www.pingcap.com/tidb/tidb-cloud-filesystem/) is a serverless, POSIX-compatible filesystem from PingCAP, built for AI agent workloads. Mount the same filesystem in multiple sandboxes, or reuse it across sandbox runs: files persisted to TiDB Cloud Filesystem remain available after a sandbox is deleted.

TiDB Cloud Filesystem is in public preview.

The setup uses the TiDB Cloud CLI (`ti`) rather than a FUSE-specific tool: install `ti` in your sandbox and run `ti fs mount-file-system` to mount the filesystem at `/home/daytona/tidb-fs`. The `daytonaio/sandbox` base image already includes FUSE, so `ti` is the only tool to install.

The mount caches writes locally and uploads them in the background. Run `ti fs drain-file-system` to persist pending writes before another sandbox reads them or before you [delete the sandbox](#clean-up).

**Credentials** — create the filesystem once on your local machine or backend with your TiDB Cloud API key. Create the key in the [TiDB Cloud console ↗](https://tidbcloud.com/) with the **Organization Owner** role; the console shows a public key and a private key. Creating the filesystem returns a filesystem token (`TI_FS_TOKEN`), and `TI_REGION_CODE` is the region you create it in. The snippets below pass both values into the sandbox via `envVars`, and `ti` reads them from there. Keep the API keys on the machine that creates the filesystem.

```bash
curl -fsSL https://github.com/tidbcloud/ti-cli/releases/latest/download/install.sh | sh -s -- --yes
export PATH="$HOME/.ti/bin:$PATH"

export TIDB_CLOUD_PUBLIC_KEY="your-public-key"
export TIDB_CLOUD_PRIVATE_KEY="your-private-key"
export TI_REGION_CODE="aws-us-west-2"

ti configure --non-interactive --region-code "$TI_REGION_CODE"
export TI_FS_TOKEN="$(ti fs create-file-system \
  --display-name daytona-workspace \
  --region "$TI_REGION_CODE" \
  --wait \
  --query fs_token \
  --output text)"
```

The filesystem token grants owner access to the filesystem. For agent workloads, pass a [scoped token](#scoped-tokens-and-read-only-mounts) instead. See the [`ti` CLI repository ↗](https://github.com/tidbcloud/ti-cli) for supported filesystem regions.

### Pre-built snapshot

Build a snapshot with `ti` preinstalled, then launch sandboxes from that snapshot. You still mount at runtime, but installation is no longer part of each sandbox startup sequence.

#### Build a snapshot

Create a reusable snapshot that installs `ti` to `/home/daytona/.ti/bin`. Sandboxes launched from `fuse-tidbfs` can mount the filesystem without repeating install work.

```python
from daytona import CreateSnapshotParams, Daytona, Image

daytona = Daytona()

image = (
  Image.base("daytonaio/sandbox")
  .run_commands(
    "curl -fsSL https://github.com/tidbcloud/ti-cli/releases/latest/download/install.sh | sh -s -- --yes",
    "/home/daytona/.ti/bin/ti --version",
  )
)

daytona.snapshot.create(
    CreateSnapshotParams(name="fuse-tidbfs", image=image),
    on_logs=lambda chunk: print(chunk, end="", flush=True),
)
```

#### Launch and mount

Pass `TI_FS_TOKEN` and `TI_REGION_CODE` to the sandbox via `envVars`. Your code then mounts the filesystem at `/home/daytona/tidb-fs`, writes a file, and drains pending writes so the file is persisted to TiDB Cloud Filesystem.

```python
import os
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

ti = "/home/daytona/.ti/bin/ti"
mount_path = "/home/daytona/tidb-fs"

sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        snapshot="fuse-tidbfs",
        env_vars={
            "TI_FS_TOKEN": os.environ["TI_FS_TOKEN"],
            "TI_REGION_CODE": os.environ["TI_REGION_CODE"],
        },
    )
)

sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(f"{ti} fs mount-file-system --mount-path {mount_path} --driver fuse")

# Write through the mount, then persist pending writes
sandbox.process.exec(f"echo 'hello from Daytona' > {mount_path}/hello.txt")
sandbox.process.exec(f"{ti} fs drain-file-system --mount-path {mount_path} --timeout 60s")

response = sandbox.process.exec(f"cat {mount_path}/hello.txt")
print(response.result)
```

### Runtime install

Start from a default sandbox and install `ti` during startup before mounting the filesystem. This is useful when iterating quickly on mount behavior, with the tradeoff of slower cold starts for each sandbox.

```python
import os
from daytona import CreateSandboxBaseParams, Daytona

daytona = Daytona()

ti = "/home/daytona/.ti/bin/ti"
mount_path = "/home/daytona/tidb-fs"

sandbox = daytona.create(
    CreateSandboxBaseParams(
        env_vars={
            "TI_FS_TOKEN": os.environ["TI_FS_TOKEN"],
            "TI_REGION_CODE": os.environ["TI_REGION_CODE"],
        },
    )
)

sandbox.process.exec(
    "curl -fsSL https://github.com/tidbcloud/ti-cli/releases/latest/download/install.sh | sh -s -- --yes"
)

sandbox.process.exec(f"mkdir -p {mount_path}")
sandbox.process.exec(f"{ti} fs mount-file-system --mount-path {mount_path} --driver fuse")

response = sandbox.process.exec(f"ls -la {mount_path}")
print(response.result)
```

### Share a filesystem across sandboxes

Launch another sandbox with the same `TI_FS_TOKEN` and `TI_REGION_CODE`, then run the same mount commands. Files that the first sandbox drained are available in the new mount, even after the first sandbox is deleted.

Sharing a filesystem does not make overlapping writes transactional. Give each agent its own output paths, and stop writers and drain pending writes before handing files to another sandbox.

### Scoped tokens and read-only mounts

For agent sessions, generate a short-lived token on your trusted host with `ti fs generate-file-system-scoped-token`, and pass it to the sandbox as `TI_FS_TOKEN` instead of the owner token. Each `--allow` option grants operations (`read`, `list`, `search`, `write`, `delete`) on a path prefix, and `--ttl` sets the token lifetime. Choose a lifetime that covers the workload and the final drain.

```bash
export TI_FS_TOKEN="$(ti fs generate-file-system-scoped-token \
  --allow /shared:read,list \
  --ttl 1h \
  --query fs_token \
  --output text)"
```

A token scoped to a subtree can only mount that subtree. Pass the same path as `--remote-path`, and add `--read-only` when the token does not grant `write`:

```bash
/home/daytona/.ti/bin/ti fs mount-file-system \
  --mount-path /home/daytona/tidb-fs \
  --remote-path /shared \
  --driver fuse \
  --read-only
```

Without `--read-only`, the mount accepts writes into the local cache before the service rejects them, and the drain fails.

### Clean up

Stop all processes that write to the mount, drain pending writes, then delete the sandbox. Deleting the sandbox removes the mount and stops its background processes. The snippets below continue from the launch example and only delete the sandbox if the drain succeeds.

```python
response = sandbox.process.exec(f"{ti} fs drain-file-system --mount-path {mount_path} --timeout 60s")
if response.exit_code != 0:
    raise RuntimeError(response.result)

daytona.delete(sandbox)
```

If the drain fails or times out, keep the sandbox running, resolve the error, and retry. Deleting the sandbox discards writes that have not been drained, including when the sandbox is deleted automatically.

### Common pitfalls

- **Mount fails after a successful install.** A successful install does not verify access to the filesystem. Run `/home/daytona/.ti/bin/ti fs list-files --path /` in the sandbox with the same token and region (for a scoped token, use an allowed path) and resolve connection or authorization errors before mounting.
- **Region mismatch.** `TI_REGION_CODE` must match the region the filesystem was created in.
- **Connection errors.** For `aws-us-west-2`, the filesystem endpoint is `https://aws-us-west-2.drive9.ai`. If a request fails before receiving an HTTP response, check the sandbox's [network limits](./network-limits.md).
- **Permission errors.** Mount as the same user that runs your agent, and check that the token allows the requested path and operations. A read-only mount still requires a token with `read` access.

## Unmount

When a sandbox is deleted via `daytona.delete(sandbox)`, the container teardown automatically removes any active FUSE mounts and shuts down their daemons. For normal cleanup, this is all you need — no manual unmount required.

To free a mount path **during** a sandbox's lifetime (for example, to remount with different credentials or before persisting a workspace archive), relocate the mount onto a throwaway path:

```bash
sudo mkdir -p /tmp/.fuse-defunct-$$
sudo mount --move <your-mount-path> /tmp/.fuse-defunct-$$
```

After this, your original mount path is free for remounting. The FUSE daemon stays alive serving the mount at the new path; both the relocated mount and the daemon are cleaned up automatically when the sandbox is deleted.

This works for any FUSE-based mount — verified against `mount-s3`, `gcsfuse`, and `blobfuse2`.
