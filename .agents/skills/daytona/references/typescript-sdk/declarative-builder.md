## Contents

- Build declarative images
- Create pre-built snapshots
- Image configuration
- See Also




Declarative Builder provides a powerful, code-first approach to defining dependencies for Daytona sandboxes. Instead of importing images from a container registry, you can programmatically define them using the Daytona SDK.

The declarative builder system supports two primary workflows:

- [**Declarative images**](#build-declarative-images): build images on demand when creating sandboxes
- [**Pre-built snapshots**](#create-pre-built-snapshots): create and register ready-to-use [snapshots](./snapshots.md)
> **Note:**
> Declarative image and Dockerfile builds are supported for container and GPU sandboxes only. [VM snapshots](./snapshots.md#vm-snapshots) (Linux VM and Windows) cannot be built from a Dockerfile. For a custom Linux VM image, push the image to a public or [private registry](./snapshots.md#snapshots-from-private-registries) and create the snapshot from the image reference, or [create a snapshot from a sandbox](./snapshots.md#create-snapshot-from-sandbox).

## Build declarative images

Create a declarative image by defining the dependencies for the sandbox.

Declarative images are cached for 24 hours, and are automatically reused when running the same script. Thus, subsequent runs on the same runner will be almost instantaneous.

**Container:**

Create a container sandbox from a declarative image.

```typescript
// Define a declarative image with python packages
const declarativeImage = Image.debianSlim('3.12')
  .pipInstall(['requests', 'pytest'])
  .workdir('/home/daytona')

// Create a new sandbox with the declarative image and stream the build logs
const sandbox = await daytona.create(
  {
    image: declarativeImage,
  },
  {
    timeout: 0,
    onSnapshotCreateLogs: console.log,
  }
)
```

**GPU:**

Create a GPU sandbox from a declarative image.

```typescript
// Define a declarative image with python packages
const declarativeImage = Image.debianSlim('3.12')
  .pipInstall(['requests', 'pytest'])
  .workdir('/home/daytona')

// Create a GPU sandbox with the declarative image and stream the build logs
const sandbox = await daytona.create(
  {
    image: declarativeImage,
    autoDeleteInterval: 0,
    resources: { gpu: 1 },
  },
  {
    timeout: 0,
    onSnapshotCreateLogs: console.log,
  }
)
```

## Create pre-built snapshots

Create a pre-built snapshot by building a declarative image and registering it as a [snapshot](./snapshots.md).

**Container:**

1. Create a container snapshot from a declarative image
2. Create a sandbox from that snapshot

```typescript
// Define the declarative image for the snapshot
const image = Image.debianSlim('3.12')
  .pipInstall(['numpy', 'pandas'])
  .workdir('/home/daytona')

// Create and register the snapshot, streaming the build logs
await daytona.snapshot.create(
  {
    name: 'my-snapshot',
    image,
  },
  {
    onLogs: console.log,
  }
)

// Create a new sandbox from the pre-built snapshot
const sandbox = await daytona.create({ snapshot: 'my-snapshot' })
```

**GPU:**

1. Create a GPU snapshot from a declarative image
2. Create a sandbox from that snapshot

```typescript
// Define the declarative image for the GPU snapshot
const image = Image.debianSlim('3.12')
  .pipInstall(['numpy', 'pandas'])
  .workdir('/home/daytona')

// Create and register the GPU snapshot, streaming the build logs
await daytona.snapshot.create(
  {
    name: 'my-gpu-snapshot',
    image,
    resources: { gpu: 1 },
  },
  {
    onLogs: console.log,
  }
)

// Create a new GPU sandbox from the pre-built snapshot
const sandbox = await daytona.create({
  snapshot: 'my-gpu-snapshot',
  autoDeleteInterval: 0,
})
```

## Image configuration

Daytona provides an option to define images programmatically. Chain the methods below to build a complete image definition in a single fluent call.

1. **Select a base image**

    Start from any registry image with `Image.base()`, or use `Image.debian_slim()` for a Python-ready Debian image.

2. **Install Python packages**

    Add packages with `pip_install()`, or install from `requirements.txt` or `pyproject.toml` using `pip_install_from_requirements()` and `pip_install_from_pyproject()`.

3. **Add files and directories**

    Copy local files into the image with `add_local_file()` and `add_local_dir()`.

4. **Configure environment**

    Set environment variables and the working directory with `env()` and `workdir()`.

5. **Install system packages**

    Use `run_commands()` to install OS-level CLI tools and libraries not available through `pip`. Chain `apt-get update`, install, and cache cleanup with `&&` in a single command to minimize Docker layers.

6. **Add additional runtimes**

    Install secondary language runtimes in a single chained `RUN` instruction. The example below adds Node.js 20 alongside Python.

7. **Set up a non-root user**

    Run all installation steps as `root` first, then create the user, fix ownership of the working directory, and switch with the `USER` directive. Commands that write to system locations after switching users will fail with permission errors.

8. **Configure startup**

    Set the container entrypoint and default command with `entrypoint()` and `cmd()`.

```typescript
// 1. Base image
const image = Image.debianSlim('3.12')
  // 2. Python packages
  .pipInstall(['requests', 'pandas'])
  // 3. Local files
  .addLocalFile('package.json', '/home/daytona/package.json')
  .addLocalDir('src', '/home/daytona/src')
  // 4. Environment
  .env({ PROJECT_ROOT: '/home/daytona' })
  .workdir('/home/daytona')
  // 5. System packages
  .runCommands(
    'apt-get update ' +
      '&& apt-get install -y --no-install-recommends git curl ffmpeg jq ' +
      '&& rm -rf /var/lib/apt/lists/*',
  )
  // 6. Additional runtime
  .runCommands(
    'apt-get update ' +
      '&& apt-get install -y --no-install-recommends curl ca-certificates ' +
      '&& curl -fsSL https://deb.nodesource.com/setup_20.x | bash - ' +
      '&& apt-get install -y nodejs ' +
      '&& rm -rf /var/lib/apt/lists/*',
  )
  // 7. Non-root user
  .runCommands(
    'groupadd -r daytona && useradd -r -g daytona -m -d /home/daytona daytona',
    'chown -R daytona:daytona /home/daytona',
  )
  .dockerfileCommands(['USER daytona'])
  // 8. Startup
  .entrypoint(['/bin/bash'])
  .cmd(['/bin/bash'])
```

### Dockerfile integration

Integrate Dockerfiles and custom Dockerfile commands.

```typescript
// Add custom Dockerfile commands
const image = Image.debianSlim('3.12').dockerfileCommands(['RUN echo "Hello, world!"'])

// Use an existing Dockerfile
const image = Image.fromDockerfile('Dockerfile')

// Extend an existing Dockerfile
const image = Image.fromDockerfile("app/Dockerfile").pipInstall(['numpy'])
```

## See Also
- [Python SDK - declarative-builder](../python-sdk/declarative-builder.md)
