# Images (TypeScript SDK)

Register, build, and capture the images that sandboxes boot from.

Images are packaged filesystems, together with the configuration a program needs to start: environment variables, a working directory, and a command. An image is built once and read many times, so every sandbox started from it begins in the same state. An image defines the operating system, tools, and files that a sandbox starts with.

Daytona keeps images in a project, in a format made for booting, so a sandbox never reaches out to a registry on its own. An image is the starting point of a sandbox: the filesystem it boots from and the configuration its first process starts with. It holds no running processes or memory, so every sandbox created from it starts in the same state.

Use images to preinstall packages, runtimes, and tools once, or to turn a configured sandbox into a template. Register an image by pulling it, building a Dockerfile, or capturing a running sandbox. To start sandboxes with processes already running, use a [snapshot](./snapshots.md) instead. Standard OCI images, such as those built with Docker, are converted on registration to the boot-optimized format that the sandboxes of a project start from.

| **Concept**             | **Description**                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| **Image**               | A packaged filesystem and configuration that a sandbox boots from.                                |
| **Image configuration** | The environment variables, working directory, entrypoint, and command that a sandbox starts with. |
| **Pull**                | The download of an image from a container registry.                                               |
| **Build**               | The creation of an image from the instructions in a Dockerfile.                                   |
| **Capture**             | The creation of an image from the filesystem of a running sandbox.                                |
| **Platform base image** | An image that the platform provides as a starting point for sandboxes.                            |
| **Anonymous image**     | An image without a name, known only by its ID.                                                    |
| **Promotion**           | The naming of an anonymous image so that it is kept.                                              |
| **Status**              | The stage of an image, from its registration until it can boot sandboxes.                         |
| **Region**              | The geographic area where an image is stored.                                                     |

## Contents

- [Use cases](#use-cases)
- [Create sandboxes from images](#create-sandboxes-from-images)
- [Pull images](#pull-images)
- [Build images](#build-images)
- [Capture images](#capture-images)
- [Promote images](#promote-images)
- [Convert images](#convert-images)
- [Operations](#operations)
- [Permissions](#permissions)

## Use cases

Images are used when many sandboxes need the same software, files, or configuration.

- **Preinstalled dependencies.** Packages, language runtimes, and tools are installed once in a Dockerfile build, and every sandbox from the image starts with them. A repeat build of the same Dockerfile and build context reuses the earlier build instead of running a new one. A Dockerfile that copies local files needs a build context of at most 1 GiB.

- **Configured sandboxes as templates.** A sandbox set up by hand or by an agent is captured, and new sandboxes start from its filesystem. The source sandbox keeps running during the capture. A named capture stays until you delete it.

- **Private application images.** Images that a CI pipeline pushes to a private registry are imported with the project's registry credentials and boot in sandboxes. Pulling the same reference again under the same name returns the existing image and starts no new pull. The API call returns once the pull is queued, and the SDKs and the CLI wait by default until the image is ready.

- **Environments written by agents.** An agent writes a Dockerfile, builds it, and boots sandboxes from the result, without access to your build infrastructure. The SDKs build the image and create the sandbox in one call. A failed build creates no sandbox.

- **Evaluation and reinforcement learning (RL).** Each test case or episode starts in a new sandbox from the same image, so results do not depend on another run. An image holds no running processes or memory, so each run boots from the same files. Runs that need processes already running start from a snapshot instead, which saves memory and disk.

## Create sandboxes from images

Create a sandbox from an image to give it the image's filesystem and start it with the image's configuration. Every sandbox booted from the same image starts in the same state every time.

A sandbox boots only from an image that its project already holds and that is ready, never straight from a registry. Registering an image in the project and booting from it are separate, so the image is in place before any sandbox asks for it.

[Pull](#pull-images), [build](#build-images), or [capture](#capture-images) the image first, and wait until it is ready. Then create a sandbox from the image by name or ID, as in the examples below. Registration runs in the background after each pull, build, or capture, and creating a sandbox from an image that is not ready fails.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

// Register python:3.12-slim under the name python-3.12
let image = await daytona.v2.images.pull('python:3.12-slim', { name: 'python-3.12' })

// Each wait returns after 30 seconds at most; a create from an image that is not ready fails
while (image.status !== 'ready' && image.status !== 'failed') {
  image = await daytona.v2.images.get(image.id, { wait: 'ready' })
}
if (image.status === 'failed') throw new Error(image.error ?? 'image build failed')

const sandbox = await daytona.v2.create('python-3.12')
```

| **Parameter** | **Description** |
| --- | --- |
| `ref` | Sets the registry reference that pull() registers.<br />**Required**<br />**Format:** an OCI image reference<br />**Example:** `'python:3.12-slim'` |
| `image` | Sets the image that create() boots the new sandbox from.<br />**Format:** an image name or ID<br />**Example:** `'python-3.12'` |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, and not the names cache or search<br />**Example:** `'python-3.12'` |
| `timeoutSeconds` | Sets how many seconds get() waits in total for the image to be ready or failed.<br />**Default:** one wait of at most 30 seconds<br />**Value:** `0` for one wait of at most 30 seconds<br />**Example:** `600` |
| `wait` | Holds the get() request until the image is ready or failed.<br />**Value:** `'ready'` |

### Inline Dockerfile

An inline Dockerfile is Dockerfile text sent with a request instead of read from a file. No other files come with it, so its instructions that copy local files have nothing to copy.

A sandbox created from an inline Dockerfile boots from an anonymous image, one with no name that the default image list hides. If the same Dockerfile was built before under a name, the sandbox starts from that image instead. An anonymous image stays while new sandboxes are created from it, and is deleted once it goes unused.

Use an inline Dockerfile to create a sandbox from Dockerfile text without naming an image first. The SDKs build the image and create the sandbox in one call, and a Dockerfile that copies files needs a [build context](#build-context) instead. An anonymous image is deleted once unused for its idle window, and each sandbox create from it restarts the window.

```typescript
import { Daytona } from '@daytona/sdk'
import { ImageBuilder } from '@daytona/sdk/v2'

const daytona = new Daytona()

// Builds an anonymous image from the Dockerfile, then creates the sandbox from it
const sandbox = await daytona.v2.createFromBuild(
  ImageBuilder.fromDockerfile('FROM python:3.12-slim\nRUN pip install requests\n'),
)
```

| **Parameter** | **Description** |
| --- | --- |
| `builder` | Sets the Dockerfile or the steps to build.<br />**Required**<br />**Format:** an ImageBuilder<br />**Example:** `ImageBuilder.fromDockerfile('FROM python:3.12-slim\nRUN pip install requests\n')` |
| `buildTimeoutSeconds` | Sets how many seconds createFromBuild() waits for the build.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `1800` |
| `cpuArch` | Sets the CPU architecture of the build and the sandbox.<br />**Default:** the region's default architecture, or `amd64` if the region sets none<br />**Value:** `amd64` or `arm64`<br />**Example:** `'amd64'` |
| `idleExpirySeconds` | Sets how many seconds the anonymous image can go without a sandbox create before deletion. The window starts when the image is created, so a window shorter than the build deletes the image before it is ready.<br />**Default:** the server maximum of 7 days<br />**Minimum:** `1`<br />**Maximum:** the server maximum<br />**Value:** `-1` for the maximum |
| `region` | Sets the region of the build and the sandbox.<br />**Default:** the project's default region, then the organization's, then the platform's<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, or `us-east-iad-1`<br />**Example:** `'us-east'` |
| `waitSeconds` | Sets how many seconds the create waits for the sandbox to start.<br />**Default:** `60`<br />**Value:** `0` for no wait<br />**Example:** `120` |

> **Notes:**
>
> - **Compatibility:** The other options of create() also apply to the sandbox.

### Windows images

Windows images are images that hold a Windows operating system together with its tools and files. A virtual machine booted from one starts in that operating system.

A Windows sandbox boots only from a Windows image. A platform base image boots in every region, and a Windows image captured in the project boots only in the region it lives in.

Create a [Windows sandbox](../platform/windows-sandboxes.md) from a Windows image to boot it with the operating system, tools, and files that the image defines. Pass the name or ID of a platform base image, or of a Windows image captured in the project, when you create a Windows sandbox through the API.

**API:**

```bash
curl 'https://api.daytona.com/sandboxes/windows' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{ "image": "win2022" }'
```

| **Field** | **Description** |
| --- | --- |
| `image` | Sets the Windows image that the sandbox starts from.<br />**Format:** an image name or ID<br />**Example:** `"win2022"` |

## Pull images

Pull an image to download it from a registry by its reference: a host, a repository, and a tag or digest. A public image can be pulled by any client, and a private image only with credentials.

A pulled image is a copy of the registry image, registered in the project under a name and converted into the format that sandboxes boot from. A name belongs to one image, so pulling the same reference under the same name returns the existing image instead of pulling it again.

Pull an image to boot sandboxes from a public image, or from a private one with a [registry credential](./registries.md) for its host. The SDKs and the CLI wait for the background pull by default. A repeat pull returns the existing image only if it shares the region and CPU architecture and did not fail. A failed pull keeps its name and ID, and pulling again under that name starts a new pull.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const image = await daytona.v2.images.pull('node:22-slim', { name: 'my-awesome-image' })
```

| **Parameter** | **Description** |
| --- | --- |
| `ref` | Sets the registry reference to pull.<br />**Required**<br />**Format:** an OCI image reference<br />**Example:** `'node:22-slim'` |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, and not the names cache or search<br />**Example:** `'my-awesome-image'` |
| `timeoutSeconds` | Sets how many seconds pull() waits in total.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `600` |
| `wait` | Waits until the image is ready or failed.<br />**Default:** `true` |

## Build images

Build an image to run the instructions of a Dockerfile, such as installing packages and copying files, and save the result as a filesystem. The files that the instructions copy come from a build context, a set of files sent along with the Dockerfile.

A built image is registered in the project under a name, like a pulled one, and sandboxes boot from it once it is ready. Builds are deduplicated within a project and region, so the same Dockerfile and build context for the same CPU architecture produce one shared build.

Build an image to preinstall packages and tools for every sandbox from it, with a [build context](#build-context) when the Dockerfile copies local files. The build runs in the background, and is ready at once if an earlier build already finished. An unnamed build that reuses the build of a named image returns that image, which stays permanent. A repeat build under the same name returns the existing image, and a name held by another image is rejected.

```typescript
import { Daytona } from '@daytona/sdk'
import { ImageBuilder } from '@daytona/sdk/v2'

const daytona = new Daytona()

const image = await daytona.v2.images.build(
  ImageBuilder.fromDockerfile('FROM python:3.12-slim\nRUN pip install requests'),
  { name: 'my-built-image' },
)
```

| **Parameter** | **Description** |
| --- | --- |
| `builder` | Sets the Dockerfile or the steps to build.<br />**Required**<br />**Format:** an ImageBuilder<br />**Example:** `ImageBuilder.fromDockerfile('FROM python:3.12-slim\nRUN pip install requests')` |
| `idleExpirySeconds` | Sets how many seconds an anonymous image can go without a sandbox create before deletion.<br />**Default:** the server maximum<br />**Minimum:** `1`<br />**Maximum:** the server maximum<br />**Value:** `-1` for the maximum |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, and not the names cache or search<br />**Example:** `'my-built-image'` |

> **Notes:**
>
> - **Polling:** Wait with `images.get(image.id, { wait: 'ready' })` before you use the image.

### Build context

A build context is a set of files sent along with a Dockerfile. The instructions in the Dockerfile that copy local files read those files from the build context.

The build context of an image is uploaded to the image's home region, and the build runs there. Without a build context, the Dockerfile is sent as text, as in [build images](#build-images).

Use a build context whenever the Dockerfile copies local files into the image. Upload it through the SDKs or the CLI, which accept up to 1 GiB, as in the examples below. A single API request accepts up to 64 MiB, and a larger context goes in parts, as in [large build contexts](#large-build-contexts).

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

// context.tar is a tar archive with the Dockerfile at its root, created from
// the my-app directory with: tar -cf context.tar -C my-app .
const image = await daytona.v2.images.buildFromContext('context.tar', { name: 'my-context-image' })
```

| **Parameter** | **Description** |
| --- | --- |
| `context` | Sets the build context that holds the Dockerfile.<br />**Required**<br />**Minimum:** 1 byte<br />**Maximum:** 1 GiB<br />**Format:** the bytes of a tar archive as an ArrayBuffer, a view, or a Blob, or in Node.js the path of a .tar file or a directory<br />**Example:** `'context.tar'` |
| `dockerfile` | Sets the path of the Dockerfile inside the context.<br />**Default:** `'Dockerfile'`<br />**Example:** `'docker/Dockerfile'` |
| `idleExpirySeconds` | Sets how many seconds an anonymous image can go without a sandbox create before deletion.<br />**Default:** the server maximum<br />**Minimum:** `1`<br />**Maximum:** the server maximum<br />**Value:** `-1` for the maximum |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, and not the names cache or search<br />**Example:** `'my-context-image'` |

> **Notes:**
>
> - **Polling:** Wait with `images.get(image.id, { wait: 'ready' })` before you use the image.

### Large build contexts

Large build contexts are tar archives too large to send together with the build request in a single upload. A multipart upload sends such an archive in parts, and each part is uploaded on its own.

A large build context goes straight to storage in parts and is verified before a build can use it. An upload belongs to one region, and only a build in that region can use it.

Use these API steps to send a build context of up to 1 GiB in parts, as the SDKs and the CLI do. Declare the archive by its size and SHA-256, upload the parts, then complete the upload to verify it. Verification checks the size and SHA-256, the tar format, and the Dockerfile, and deletes an archive that fails. For an archive already verified in the region, the declare request returns that upload and the archive is not sent again.

**API:**

```bash
# Size in bytes and SHA-256 of the archive (on macOS use: shasum -a 256 context.tar)
wc -c < context.tar
sha256sum context.tar

# Declare the upload: replace 10240 with the size from wc and {sha256} with the hash from sha256sum
curl 'https://api.daytona.com/build-contexts' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "bytes": 10240,
  "sha256": "{sha256}"
}'

# When the response has state ready, the archive is already stored: skip to the build
# Otherwise, split the archive into parts of part_size bytes: part 1 is part-aa, part 2 is part-ab, and so on
split -b {partSize} context.tar part-

# Upload each part to its url, without an Authorization header
curl '{partUrl}' --upload-file part-aa

# Verify the uploaded archive
curl 'https://api.daytona.com/build-contexts/{uploadId}/complete' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "region_id": "{regionId}"
}'

# Build from the verified upload
curl 'https://api.daytona.com/images' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "my-context-image",
  "context_upload_id": "{uploadId}"
}'
```

| **Field** | **Description** |
| --- | --- |
| `bytes` | Sets the size of the archive in bytes.<br />**Required**<br />**Minimum:** `1`<br />**Maximum:** `1073741824`<br />**Example:** `10240` |
| `sha256` | Sets the SHA-256 of the archive.<br />**Required**<br />**Format:** 64 lowercase hexadecimal characters |
| `context_upload_id` | Sets the verified upload that the build uses.<br />**Format:** the upload ID that the declare request returned |
| `dockerfile` | Sets the path of the Dockerfile inside the context.<br />**Default:** `"Dockerfile"`<br />**Example:** `"docker/Dockerfile"` |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, and not the names cache or search<br />**Example:** `"my-context-image"` |
| `region_id` | Sets the region of the upload in the declare and complete requests.<br />**Default:** in the declare request, the project's default region, then the organization's, then the platform's<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, or `us-east-iad-1`<br />**Example:** `"us-east"` |

> **Notes:**
>
> - **Order:** When the declare request returns the upload as `ready`, the archive is stored; skip to the build. Pass the region_id from the declare response to the complete request, and build in that region.
> - **Results:** A part URL is a credential, so do not log or share it.
> - **Lifetime:** Upload before urls_expire_at, complete before upload_expires_at, and build before expires_at.
> - **Polling:** Wait with `GET /images/{imageId}?wait=ready` before creating sandboxes.
> - **Clients:** Upload each part to its URL with one PUT of exactly its bytes and no Authorization header.

### Build options

Build options are the settings that decide where an image is built and which CPU architecture it targets. A program compiled for one architecture does not run on another.

An image has one home region, where it is built or pulled, and one CPU architecture, which the sandboxes that boot from it share. Both are set when the image is [built](#build-images) or [pulled](#pull-images), and the same Dockerfile or reference gives a separate image per architecture.

Set the region and the CPU architecture when the image must live in a region other than the default, or run on an architecture other than the region's default.

```typescript
import { Daytona } from '@daytona/sdk'
import { ImageBuilder } from '@daytona/sdk/v2'

const daytona = new Daytona()

const image = await daytona.v2.images.build(
  ImageBuilder.fromDockerfile('FROM python:3.12-slim\nRUN pip install requests'),
  { name: 'my-us-east-image', region: 'us-east', cpuArch: 'amd64' },
)
```

| **Parameter** | **Description** |
| --- | --- |
| `cpuArch` | Sets the CPU architecture of the image.<br />**Default:** the region's default architecture, or `amd64` if the region sets none<br />**Value:** `amd64` or `arm64`<br />**Example:** `'amd64'` |
| `region` | Sets the home region of the image.<br />**Default:** the project's default region, then the organization's, then the platform's<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, `us-east-iad-1`, or `'local'` for the default region<br />**Example:** `'us-east'` |

### Declarative builds

Declarative builds describe an image in code, as a chain of steps, instead of as a Dockerfile. Each step stands for one instruction that the build runs.

A declarative build starts from a registry image, and each step adds one Dockerfile instruction. The steps become a Dockerfile when the build is submitted, so a declarative build is [deduplicated](#build-images) like any other build of the same Dockerfile.

Start from a registry image, chain the steps the image needs, and build it like any other image. Both SDKs render the same steps into the same Dockerfile, so the same build from Python and from TypeScript is deduplicated. A sandbox runs as the image's user, or as root when the image sets none, sets root, or sets a numeric user ID. A user set on sandbox create replaces it.

```typescript
import { Daytona } from '@daytona/sdk'
import { ImageBuilder } from '@daytona/sdk/v2'

const daytona = new Daytona()

const builder = ImageBuilder.fromRegistry('python:3.12-slim')
  .pipInstall('requests', 'numpy>=1.26')
  .runCommands('useradd --create-home app')
  .env({ LOG_LEVEL: 'debug' })
  .user('app')
  .workdir('/home/app')
  .entrypoint('python')
  .cmd('-m', 'http.server', '8080')

const image = await daytona.v2.images.build(builder, { name: 'my-declared-image' })
```

| **Parameter** | **Description** |
| --- | --- |
| `cmd` | Sets the image command, or the default arguments of the entrypoint, rendered as CMD in exec form.<br />**Example:** `'-m', 'http.server', '8080'` |
| `entrypoint` | Sets the image entrypoint, rendered as ENTRYPOINT in exec form.<br />**Example:** `'python'` |
| `env` | Sets environment variables as one ENV step per variable.<br />**Format:** a name and a value, or a record of names to values<br />**Example:** `{ LOG_LEVEL: 'debug' }` |
| `fromRegistry` | Starts the image from a registry image, rendered as FROM.<br />**Format:** an OCI image reference<br />**Example:** `'python:3.12-slim'` |
| `pipInstall` | Adds Python packages as one RUN python -m pip install step.<br />**Format:** one or more pip requirement specifiers<br />**Example:** `'numpy>=1.26'` |
| `runCommands` | Adds shell commands as one RUN step per command.<br />**Example:** `'useradd --create-home app'` |
| `user` | Sets the user for the steps that follow and for sandboxes from the image, rendered as USER.<br />**Example:** `'app'` |
| `workdir` | Sets the working directory, rendered as WORKDIR. A sandbox from an image that sets none, or sets the root directory, starts in the user's home directory.<br />**Example:** `'/home/app'` |

> **Notes:**
>
> - **Clients:** Each method returns a new builder and keeps the original, so one base can start several images.
> - **Behaviour:** A builder from fromRegistry() with no steps registers the registry image as a pull.

##### Add local files

Add local files to copy files and directories from a local computer into an image. A copy step in a build reads files from the build context and writes them to a path in the image.

The local files of a declarative build are packed with its Dockerfile into a build context and uploaded with the build. They are read when the build is submitted, not when they are added to the builder.

Add local files when the image needs code, data, or a requirements file that exists only on your computer. The upload follows the limits of a [build context](#build-context), up to 1 GiB. An added directory leaves out the files that its own .dockerignore excludes.

```typescript
import { mkdirSync, writeFileSync } from 'node:fs'

import { Daytona } from '@daytona/sdk'
import { ImageBuilder } from '@daytona/sdk/v2'

const daytona = new Daytona()

// The local files to add: a requirements file, a script, and a data directory
writeFileSync('requirements.txt', 'requests\n')
writeFileSync('main.py', 'print("Hello from the image")\n')
mkdirSync('data', { recursive: true })
writeFileSync('data/input.csv', 'id,value\n1,42\n')

const builder = ImageBuilder.debianSlim('3.12')
  .pipInstallFromRequirements('requirements.txt')
  .addLocalFile('main.py', '/app/')
  .addLocalDir('data', '/app/data')

const image = await daytona.v2.images.build(builder, { name: 'my-local-files-image' })
```

| **Parameter** | **Description** |
| --- | --- |
| `addLocalDir` | Copies a local directory to a path in the image, rendered as COPY.<br />**Format:** a local directory path, then a path in the image<br />**Example:** `'data', '/app/data'` |
| `addLocalFile` | Copies a local file to a path in the image, rendered as COPY.<br />**Format:** a local file path, then a path in the image that keeps the file name when it ends with `/`<br />**Example:** `'main.py', '/app/'` |
| `debianSlim` | Starts the image from the slim Debian Python image, with gcc, gfortran, and build-essential installed and pip upgraded.<br />**Default:** `'3.13'`<br />**Value:** `'3.10'`, `'3.11'`, `'3.12'`, `'3.13'`, or `'3.14'`<br />**Example:** `'3.12'` |
| `pipInstallFromRequirements` | Copies a local requirements file into the image and installs it as one RUN python -m pip install -r step.<br />**Format:** the path of a local file<br />**Example:** `'requirements.txt'` |

> **Notes:**
>
> - **Prerequisites:** The local files must exist when `images.build()` runs, which reads them.
> - **Compatibility:** Local files work only in Node.js. A build with local files takes a name or idleExpirySeconds, not both.
> - **Polling:** Wait with `images.get(image.id, { wait: 'ready' })` before you use the image.

### Preview the Dockerfile

Preview the Dockerfile of a declarative build to read its instructions before submission. A Dockerfile is a text file of instructions that an image build runs in order.

A preview of a declarative build renders the Dockerfile that a declarative build describes, without submitting the build. It shows the instructions as the build would run them.

Use the preview to review the Dockerfile that the SDK renders before you submit the build. To build through the API instead, send the preview as the Dockerfile of a build request.

```typescript
import { ImageBuilder } from '@daytona/sdk/v2'

const builder = ImageBuilder.fromRegistry('python:3.12-slim').pipInstall('requests')

console.log(builder.toDockerfile())
// FROM python:3.12-slim
// RUN python -m pip install requests
```

## Capture images

Capture an image to copy the filesystem of a sandbox with everything installed or changed since it booted. The image holds files and configuration, without processes or memory.

A captured image turns the work done in one sandbox into the starting point of others. It holds the filesystem of the source at the moment of capture, and sandboxes boot from it like from any other image, with every package and file the source had.

Capture a sandbox set up by hand or by an agent, and boot new sandboxes from the image once the background capture ends. A macOS sandbox is captured as a [filesystem snapshot](./macos-sandboxes.md#filesystem-snapshot), and a GPU sandbox saves its state as a [checkpoint](./snapshots.md) instead. A named capture is permanent until you delete it. An unnamed one is deleted after its idle window, 7 days by default, without a new sandbox created from that image, unless you [promote](#promote-images) it.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.process.run('pip install requests')

let image = await sandbox.captureImage({ name: 'my-env' })

// Wait until the capture is ready, then boot new sandboxes from it
while (image.status !== 'ready' && image.status !== 'failed') {
  image = await daytona.v2.images.get(image.id, { wait: 'ready' })
}
if (image.status === 'failed') throw new Error(image.error ?? 'image build failed')
const clone = await daytona.v2.create('my-env')
```

| **Parameter** | **Description** |
| --- | --- |
| `idleExpirySeconds` | Sets how many seconds an anonymous image can go without a sandbox create before deletion.<br />**Default:** the server maximum<br />**Minimum:** `1`<br />**Maximum:** the server maximum<br />**Value:** `-1` for the maximum |
| `image` | Sets the image that create() boots the new sandbox from.<br />**Format:** an image name or ID<br />**Example:** `'my-env'` |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, and not the names cache or search<br />**Example:** `'my-env'` |
| `wait` | Holds the get() request until the image is ready or failed.<br />**Value:** `'ready'` |

> **Notes:**
>
> - **Prerequisites:** A Linux or Windows sandbox must be running; a macOS sandbox must be persistent and stopped.

## Promote images

Promote an image to give a temporary, unnamed image a name so that it is kept. Unnamed images are removed once they go unused, and named images stay until they are deleted.

An anonymous image is an image registered without a name. It is known only by its ID, the default image list leaves it out, and it is deleted after its idle window. A promoted image is a named image: it is permanent, and the default image list shows it.

Promote an anonymous image by its ID to keep it beyond its idle window. A [capture](#capture-images), a [build](#build-images), or a [pull](#pull-images) without a name registers an anonymous image. Promotion works only on anonymous images, and an image that already has a name cannot be renamed.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const image = await daytona.v2.images.promote('{imageId}', 'my-promoted-env')
console.log(image.name)
```

| **Parameter** | **Description** |
| --- | --- |
| `imageId` | Identifies the anonymous image to name.<br />**Required**<br />**Format:** an image ID |
| `name` | Sets the image name.<br />**Required**<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, and not the names cache or search<br />**Example:** `'my-promoted-env'` |

> **Notes:**
>
> - **Prerequisites:** The image must be anonymous.

## Convert images

Convert an image to change its storage format, not the files it holds. A runtime that reads only a newer format cannot use an image in an older one until it is converted.

Images registered by the v0 migration are stored in an older format until converted. Such an image converts on its first Linux sandbox create, which stays queued during the conversion.

Convert a migrated image before its first use. Converting ahead of time removes the wait from the first create and makes the image usable everywhere. GPU and Windows sandboxes, and builds from the image, refuse it until it is converted.

**API:**

```bash
curl 'https://api.daytona.com/images/{imageId}/convert' \
  --request POST \
  --header 'Authorization: Bearer YOUR_API_KEY'

# Returns on ready or failed, or after timeout_ms; repeat while status is pending or building
curl 'https://api.daytona.com/images/{imageId}?wait=ready&timeout_ms=60000' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `id` | Identifies the image to convert, in the path.<br />**Format:** an image ID or name |
| `timeout_ms` | Sets how many milliseconds the wait request holds.<br />**Default:** `30000`<br />**Minimum:** `0`<br />**Maximum:** `60000` |
| `wait` | Holds the wait request until the image reaches this status.<br />**Value:** an image status, such as `ready`<br />**Example:** `ready` |

> **Notes:**
>
> - **Polling:** Repeat the wait request while the image status is `pending` or `building`.

## Operations

Operations on images act on images that are already registered in a project. They read what the project holds and remove what it no longer needs.

A named image stays in its project until it is deleted. An image stays in place while anything created from it, or built on its files, still exists in the project.

Use the operations below to find an image by ID or name and to delete images that no sandbox uses anymore. Read the logs and status of a build to see whether it failed.

### List images

List images to see the images registered in the project and the status of each. A paginated list returns a large collection in pages, and each page continues where the previous one ended.

A list of images holds the images of the project, newest first, one page at a time. Named images appear in it, and anonymous ones, such as those [inline Dockerfile](#inline-dockerfile) builds create, only on request.

Use a list to find an image by name and check its status. To read every page, [iterate over all images](#iterate-over-all-images). Filter the list by exact image name or by the sandbox that an image was captured from, and page through it with the cursor of the previous page.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const page = await daytona.v2.images.list()
for (const image of page.items) {
  console.log(image.name, image.status)
}
```

| **Parameter** | **Description** |
| --- | --- |
| `anonymous` | Lists anonymous images instead of named images.<br />**Default:** `false` |
| `cursor` | Continues from a previous page.<br />**Format:** the nextCursor of the previous page |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `name` | Filters by exact image name.<br />**Example:** `'my-env'` |
| `platform` | Selects platform images, which Daytona publishes for every project.<br />**Default:** `'false'`<br />**Value:** `'true'` for platform images only, `'false'` for the project's images only, or `'any'` for both<br />**Example:** `'any'` |
| `sandboxId` | Filters by the sandbox that the images were captured from.<br />**Format:** a sandbox ID |

| **Field**         | **Description**                                                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | Image ID (`img_...`), used by the get, promote, convert, build-logs-url, and delete endpoints; returned as `id` when the image is created                                                       |
| `name`            | The name sandboxes reference through `image`                                                                                                                                                    |
| `status`          | `pending`, `building`, `ready`, or `failed`                                                                                                                                                     |
| `error`           | Build failure reason; `null` unless `status` is `failed`                                                                                                                                        |
| `source`          | The build source as submitted: a registry reference, a named image, or a Dockerfile context; `null` for captured images                                                                         |
| `origin`          | How the image was created, such as `registry`, `dockerfile`, or `capture`                                                                                                                       |
| `class`           | Sandbox class the image supports, such as `linux` or `macos`. The SDKs return it as `sandbox_class` (`sandboxClass` in TypeScript) |
| `anonymous`       | `true` when the image has no name                                                                                                                                                               |
| `retention`       | `permanent` for a named image, `idle` for an anonymous image                                                                                                                                    |
| `expires_at`      | When an anonymous image is deleted unless a sandbox create restarts its idle window; `null` for a permanent image                                                                              |
| `region_id`       | Home region the image was built, pulled, or captured in. The SDKs return it as `region` |
| `region_ids`      | Regions that hold a copy of the image right now; the home region is listed only while its own copy is there. Empty until the build finishes and after every copy is evicted. The SDKs return it as `available_in` (`availableIn` in TypeScript) |
| `platform`        | `true` for a platform image that Daytona publishes for every project                                                                                                                            |
| `default`         | `true` for the image that a sandbox create without an image boots                                                                                                                               |
| `deprecated`      | `true` for a deprecated platform image, which is not listed and cannot be used by name; its ID still resolves                                                                                   |
| `bytes`           | Size of the converted image in bytes; `null` until the build completes                                                                                                                          |
| `layer_count`     | Number of layers in the converted image                                                                                                                                                         |
| `disk_mib`        | Disk size in MiB of a macOS sandbox created from the image without `disk_mib`, and the smallest disk such a create accepts; set for images captured from a macOS sandbox, `null` otherwise      |
| `format_version`  | Storage format of the image: `1` for images registered by the migration from Daytona v0, `2` for the current format                                                                             |
| `format_outdated` | `true` when `format_version` is below the current format; [convert](#convert-images) the image before use outside Linux sandboxes                                                               |
| `imported_from`   | Source platform and resource ID of an image imported by the [migration from Daytona v0](../platform/migrate-from-v0.md), as `{"platform": "v0", "id": "..."}`; absent for an image created on Daytona v2 |
| `created_at`      | Creation timestamp                                                                                                                                                                              |
| `updated_at`      | Timestamp of the last change                                                                                                                                                                    |
| `cursor`          | Token to resume the list immediately after this row; returned by list only                                                                                                                      |

##### Iterate over all images

Iterate over all images to read every image in the project without handling page cursors. Iteration over a paginated list reads one page after another until no page remains.

An iteration over images walks the list page by page, fetching a page only when the previous one runs out. A reader sees one sequence of images, not pages.

Use the iterator when a script needs every image of the project rather than one page of the list.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

for await (const image of daytona.v2.images.iter()) {
  console.log(image.name, image.status)
}
```

### Search images

Search images to find the ones that match a text query or a set of filters. A search matches stored resources against the query and filters and returns them sorted, one page at a time.

A search of images covers the project in every region and reads an eventually consistent central index, not the images themselves. It returns the named images of the project unless a filter asks for anonymous or platform images, and never a deprecated platform image.

Use a search to find images by text, or by their status, origin, or region. Filters combine with AND, and a comma-separated list matches any of its values. A change becomes searchable about 2 to 3 seconds after it is committed, so to read your own writes, use [get](#get-an-image).

**API:**

```bash
# Free text over the image name, or an exact image ID
curl 'https://api.daytona.com/images/search?q=my-declared-image' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `anonymous` | Returns anonymous images when `true` and named images when `false`.<br />**Default:** `false` |
| `class` | Filters by the sandbox classes that the image supports.<br />**Format:** a comma-separated list<br />**Value:** `linux`, `windows`, or `macos`<br />**Example:** `linux` |
| `created_end_at` | Filters by creation time, exclusive upper bound.<br />**Format:** an RFC 3339 time<br />**Example:** `2026-02-01T00:00:00Z` |
| `created_start_at` | Filters by creation time, inclusive lower bound.<br />**Format:** an RFC 3339 time<br />**Example:** `2026-01-01T00:00:00Z` |
| `cursor` | Continues from a previous page.<br />**Format:** the next_cursor of a previous page with the same filters and sort |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `name` | Filters by an exact image name.<br />**Example:** `my-declared-image` |
| `name_prefix` | Filters by the start of the image name, case-sensitive.<br />**Example:** `my-` |
| `order` | Sets the sort order.<br />**Default:** `desc`<br />**Value:** `asc` or `desc`<br />**Example:** `asc` |
| `origin` | Filters by how the image was created.<br />**Format:** a comma-separated list<br />**Value:** `registry`, `dockerfile`, `capture`, `windows`, or `macos`<br />**Example:** `capture` |
| `platform` | Returns the images of the project, of the platform, or both.<br />**Default:** `false`<br />**Value:** `false` for the project's, `true` for the platform's, or `any` for both |
| `q` | Matches free text against the image name, or one image ID exactly.<br />**Example:** `my-declared-image` |
| `region_ids` | Filters by home region, and a broader region such as `earth` matches every region inside it.<br />**Default:** every region<br />**Format:** a comma-separated list of region IDs<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, or `us-east-iad-1`<br />**Example:** `us-east` |
| `sandbox_id` | Filters by the sandbox that the image was captured from.<br />**Format:** a sandbox ID |
| `sort` | Sets the sort field.<br />**Default:** `created_at`<br />**Value:** `created_at`, `updated_at`, `name`, or `bytes`<br />**Example:** `name` |
| `status` | Filters by build status.<br />**Format:** a comma-separated list<br />**Value:** `pending`, `building`, `ready`, or `failed`<br />**Example:** `ready` |
| `updated_end_at` | Filters by last-modified time, exclusive upper bound.<br />**Format:** an RFC 3339 time<br />**Example:** `2026-02-01T00:00:00Z` |
| `updated_start_at` | Filters by last-modified time, inclusive lower bound.<br />**Format:** an RFC 3339 time<br />**Example:** `2026-01-01T00:00:00Z` |

### Get an image

Get an image to read the current state of one image in the project. A get reads a single resource by its identifier and changes nothing on the server.

A get of an image finds it by its ID or by its name. It returns the same fields that the [image list](#list-images) shows, including its status and the reason for a failure.

Pass the ID or the name of the image to read it without listing the project. To wait for a build to finish, check its [build status](#build-status) until it is ready or failed.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const image = await daytona.v2.images.get('{imageId}')
console.log(image.name, image.status)
```

| **Parameter** | **Description** |
| --- | --- |
| `imageId` | Identifies the image.<br />**Required**<br />**Format:** an image ID or name |

### Delete images

Delete an image to remove it from the project. Deletion removes a resource permanently, together with any data stored only in that resource.

A delete of an image removes it from its project. The delete is refused for as long as anything that was created from the image, or built on its files, still exists.

Delete the sandboxes created from an image first, then delete the image by its ID or name. Deletion fails while a sandbox created from the image is not deleted. A captured image also cannot be deleted while another capture, sandbox, or snapshot uses its files.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

await daytona.v2.images.delete('{imageId}')
```

| **Parameter** | **Description** |
| --- | --- |
| `imageId` | Identifies the image to delete.<br />**Required**<br />**Format:** an image ID or name |

> **Notes:**
>
> - **Prerequisites:** No sandbox or snapshot may depend on the image.

### Build logs

Build logs are the output of an image build, written while the build runs. They record each step of the build and what it printed, so a failed build can be traced to the step that failed.

Build logs can be read at any time, or followed so that the output arrives as the build writes it and ends with the build. A reader only watches the build, so stopping it does not stop the build.

Read the build logs of an image by its ID or name, and follow them to watch a build while it runs.

```typescript
import { Daytona } from '@daytona/sdk'
import { ImageBuilder } from '@daytona/sdk/v2'

const daytona = new Daytona()

const image = await daytona.v2.images.build(
  ImageBuilder.fromDockerfile('FROM python:3.12-slim\nRUN pip install requests'),
  { name: 'my-built-image' },
)
await daytona.v2.images.followBuildLogs(image.id, { onLogs: (chunk) => { process.stdout.write(chunk) } })
```

| **Parameter** | **Description** |
| --- | --- |
| `imageId` | Identifies the image whose build output to read.<br />**Required**<br />**Format:** an image ID or name |
| `onLogs` | Receives the build output as text.<br />**Required**<br />**Example:** `(chunk) => { process.stdout.write(chunk) }` |
| `cursor` | Continues the follow after the output that a previous follow delivered.<br />**Format:** the cursor of a previous follow |
| `onEvent` | Receives every stream event, including state changes.<br />**Example:** `(event) => { console.log(event.type) }` |
| `timeoutSeconds` | Sets how many seconds the follow runs at most.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `600` |

### Build status

Build status is the progress of an image build, recorded on the image itself. A build runs for some time after it starts, so a program reads the status to learn when the result can be used.

The build status changes as the build runs and settles once the build ends, either ready to boot sandboxes or failed. A failed image records the reason for its failure alongside its status.

Check the status of an image by its ID or name. Wait until it is ready before you create sandboxes, which boot only from a ready image. An image moves from pending to building and ends as ready or failed. A failed image has the failure reason in its `error` field instead of `null`.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const image = await daytona.v2.images.get('{imageId}')
console.log(image.id, image.status, image.error)
```

| **Parameter** | **Description** |
| --- | --- |
| `imageId` | Identifies the image.<br />**Required**<br />**Format:** an image ID or name |

## Permissions

Images are scoped to a project. Three permissions govern access to images, and you can grant each of them to an [organization role](./organizations.md#roles) or to an [API key](./api-keys.md).

Creating a sandbox from an image requires the permission to create sandboxes, and capturing an image of a sandbox requires the permission to write sandboxes as well as images. The [audit logs](./audit-logs.md) record image builds, captures, promotions, conversions, and deletes.

| **Permission**      | **Grants**                                        |
| ------------------- | ------------------------------------------------- |
| **`read:images`**   | List and get images, and read their build logs    |
| **`write:images`**  | Build, pull, capture, promote, and convert images |
| **`delete:images`** | Delete images                                     |
