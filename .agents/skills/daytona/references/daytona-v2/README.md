# Daytona v2

## What is Daytona v2

Daytona provides sandboxes for agents: hardware-isolated virtual machines, each with its own kernel, filesystem, network stack, and allocated vCPU, RAM, and disk. Sandboxes run as Linux (default, Firecracker microVMs), Windows, macOS, or GPU virtual machines. A running sandbox exposes a toolbox for code and command execution, sessions, file system and git operations, and computer use.

Every sandbox belongs to a **project**. A project API key reaches only the sandboxes, images, snapshots, volumes, and secrets of its own project.

**Scope:** This guide covers Daytona v2 (`app.daytona.com`, `api.daytona.com`). The SDKs are Python `daytona==2.1.0` and TypeScript `@daytona/sdk@2.1.0`.

## Using v0 from the v2 SDK

The v2 SDK also exposes the v0 API as `daytona.v0` (Python needs `pip install 'daytona[v0-sdk]==2.1.0'`). To move an organization's resources from v0, see [migrate-from-v0.md](./platform/migrate-from-v0.md).

## Before You Start

1. **SDK installed?** Check that the v2 SDK is installed: `pip show daytona` reports a `2.x` release, or `package.json` lists `@daytona/sdk` at `2.x`. A `0.x` version is the v0 SDK. Install with `pip install daytona==2.1.0` (Python 3.10 or later) or `npm install @daytona/sdk@2.1.0` (Node.js 22.15 or later).
2. **API key set?** Check `DAYTONA_API_KEY` in the shell environment or in environment files. If it is not set, tell the user to create a project API key at [Daytona Dashboard > API Keys](https://app.daytona.com/dashboard/keys).

## Sandbox Lifetime

A Linux sandbox is deleted automatically when its timeout elapses. When a create sets no timeout, Daytona applies the project's [lifecycle default](./python-sdk/projects.md#lifecycle-defaults), or the platform default if one is enabled. The timeout starts when the sandbox starts running, and activity does not extend it. Set `lifecycle_policy` at create for any sandbox that must live a known length of time. The maximum is 86,400 seconds (24 hours) unless the organization or its plan sets a different maximum; a longer request is refused, not shortened.

Linux sandboxes cannot be stopped, started, paused, or archived. Delete discards the filesystem and memory. To keep state, capture an image, take a snapshot, or write files to a volume. See [persistence.md](./python-sdk/persistence.md).

## SDK Essentials: Python

### Create a client and a sandbox

```python
from daytona import Daytona
from daytona.v2 import Resources

# Reads DAYTONA_API_KEY from the environment; the block closes the client's connections
with Daytona() as daytona:
    sandbox = daytona.v2.create(
        name="my-sandbox",
        resources=Resources(cpu=1, memory=2, disk=20),  # cores, GiB, GiB
        lifecycle_policy={"timeout_seconds": 3600, "on_timeout": "delete"},
    )
    print(sandbox.id, sandbox.state)
```

`create()` waits up to `wait_seconds` (default `60`) for the sandbox to start. If the sandbox has not started in time, or fails, `create()` returns it without raising. Check `sandbox.state` (`started` when ready) or call `sandbox.wait(until="started", timeout=60)`.

For async code, use `AsyncDaytona` with `async with` and `await` every call.

### Run commands

```python
response = sandbox.process.run("ls -la")
print(response.exit_code, response.stdout, response.stderr)

# Run as another user or shell, with a client-side timeout in seconds
response = sandbox.process.run("whoami", user="nobody", shell="bash", timeout=30)
```

When `timeout` elapses, `reason` is `"timed_out"`, `exit_code` is `None`, and the command keeps running.

### Run code

```python
response = sandbox.run_code('print("Hello World")')
print(response.logs.stdout)
if response.error:
    print(response.error.name, response.error.value)
```

`run_code` runs Python (default), TypeScript, or JavaScript through a language kernel. Runs without a context share one kernel per language, so variables persist between runs. Pass `isolated=True` for a run with no shared state, or create an interpreter context with `sandbox.interpreter.create_context(language="python")` for per-user state. See [code-execution.md](./python-sdk/code-execution.md).

### File operations

```python
sandbox.fs.write_text("/home/daytona/workspace/data.txt", "Hello, Daytona!")
print(sandbox.fs.read_text("/home/daytona/workspace/data.txt"))

files = sandbox.fs.list("/home/daytona/workspace")
for f in files.items:
    print(f.name, f.is_dir, f.size)

# Stream large files between local disk and the sandbox
sandbox.fs.upload_file("local.csv", "/home/daytona/workspace/data.csv")
sandbox.fs.download_file("/home/daytona/workspace/result.bin", "result.bin")
```

### Delete

```python
sandbox.delete()

# Or by ID, without fetching the sandbox first
daytona.v2.delete("{sandboxId}")
```

### Find existing sandboxes

```python
sandbox = daytona.v2.get("{sandboxId}")          # reads the control plane, always current
found = daytona.v2.find_by_name("my-sandbox")    # list, newest first; reads the search index
for sandbox in daytona.v2.iter():                # every sandbox in the project
    print(sandbox.id, sandbox.name, sandbox.state)
```

Search and `find_by_name` read an eventually consistent index: a sandbox created 2 to 3 seconds ago can be missing. Use `get` or an unfiltered `list` to read your own writes.

For the full Python SDK, see [python-sdk/README.md](./python-sdk/README.md).

## SDK Essentials: TypeScript

The TypeScript SDK (`@daytona/sdk`) mirrors the Python API with camelCase names. Resource types, builders, and errors for v2 are imported from `@daytona/sdk/v2`.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create({
  lifecyclePolicy: { timeoutSeconds: 3600, onTimeout: 'delete' },
})

const run = await sandbox.process.run('ls -la')
console.log(run.exitCode, run.stdout)

const code = await sandbox.runCode('print("Hello World")')
console.log(code.logs.stdout)

await sandbox.fs.writeText('/home/daytona/workspace/data.txt', 'Hello, Daytona!')
console.log(await sandbox.fs.readText('/home/daytona/workspace/data.txt'))

await sandbox.delete()
```

Examples use top-level `await`, which needs an ES module project (`npm pkg set type=module`). For the full TypeScript SDK, see [typescript-sdk/README.md](./typescript-sdk/README.md).

## Common Patterns

### Custom environments

A sandbox create does not pull from a registry. It boots a registered image by name or ID, or the platform default image when none is given. Register an image first, or build one and create the sandbox in one call.

```python
from daytona import Daytona
from daytona.v2 import ImageBuilder

daytona = Daytona()

# One-off: build an anonymous image from a Dockerfile and create the sandbox from it
sandbox = daytona.v2.create_from_build(
    ImageBuilder.from_dockerfile("FROM python:3.12-slim\nRUN pip install requests\n")
)

# Reusable: build a named image declaratively, then create sandboxes from it by name
builder = (
    ImageBuilder.from_registry("python:3.12-slim")
    .pip_install("requests", "numpy>=1.26")
    .env({"LOG_LEVEL": "debug"})
    .workdir("/app")
)
image = daytona.v2.images.build(builder, name="my-env")
sandbox = daytona.v2.create("my-env")

# Registry image: pull it under a name, wait until ready, then create
image = daytona.v2.images.pull("python:3.12-slim", name="python-3.12")
while image.status not in ("ready", "failed"):
    image = daytona.v2.images.get(image.id, wait="ready")
sandbox = daytona.v2.create("python-3.12")
```

```typescript
import { Daytona } from '@daytona/sdk'
import { ImageBuilder } from '@daytona/sdk/v2'

const daytona = new Daytona()
const sandbox = await daytona.v2.createFromBuild(
  ImageBuilder.fromDockerfile('FROM python:3.12-slim\nRUN pip install requests\n'),
)
```

A create from an image that is not ready fails, so wait for `ready` after a pull, build, or capture. Repeat builds of the same Dockerfile and build context reuse the earlier build. See [images.md](./python-sdk/images.md).

### Capture and reuse state

| Need | Use | Captures |
|---|---|---|
| Start many sandboxes with the same files and packages | `sandbox.capture_image(name=...)`, then `daytona.v2.create(name)` | Filesystem |
| Resume running processes and memory | `sandbox.create_snapshot(name)`, then `daytona.v2.create_from_snapshot(name)` | Memory and disk |
| Keep data across sandboxes | Volumes, attached at create | Files on the volume |

A Linux snapshot requires a running sandbox that is persistent, served from a warm template, or restored from a memory snapshot. Snapshot, image, and capture calls return before the work finishes; wait for status `ready` with `daytona.v2.snapshots.get(id, wait="ready")` or `daytona.v2.images.get(id, wait="ready")`. See [snapshots.md](./python-sdk/snapshots.md) and [volumes.md](./python-sdk/volumes.md).

### Long-running processes

```python
handle = sandbox.process.start("python -m http.server 8000", tag="web")
result = handle.wait(timeout=120)   # returns with reason "timed_out" if still running
for frame in handle.logs().items:
    print(f"[{frame.channel}] {frame.data}", end="")
handle.kill()                        # SIGTERM by default
sandbox.process.kill_all(tag="web")  # stop every process started with the tag

# Persist the handle and reconnect from another worker
saved = handle.to_json()
handle = sandbox.process.connect(saved)
```

Use a session (`sandbox.process.create_session()`) when commands must share the working directory and environment. Toolbox requests and toolbox commands that are still running count as activity for the idle timeout; for work that Daytona does not count as activity, call `sandbox.reset_idle_timer()`. The wall-clock timeout is not affected by activity. See [process-execution.md](./python-sdk/process-execution.md) and [log-streaming.md](./python-sdk/log-streaming.md).

### Preview URLs

Sandboxes expose HTTP services on preview URLs. A port becomes a private endpoint when you first request its preview link.

- **Token-authenticated:** Python `sandbox.ports.preview_link(port)`, TypeScript `sandbox.ports.previewLink(port)`. Returns `.url` and `.token`. Send the token in the `x-daytona-preview-token` header.
- **Signed URL (shareable):** Python `sandbox.ports.signed_preview_link(port, expires_in_seconds=3600)`, TypeScript `sandbox.ports.signedPreviewLink(...)`. The token is embedded in the URL. The server default expiry is 60 seconds, so set it explicitly.
- **Public:** Python `sandbox.ports.expose(port, public=True)`, TypeScript `sandbox.ports.expose(...)`. No credential needed.

See [preview.md](./python-sdk/preview.md).

### Share access to one sandbox

Create a short-lived sandbox access token instead of handing out a project API key. It is limited to the operations and ports you grant, and lasts 1 hour by default and 24 hours at most.

```python
token = sandbox.create_access_token(operations=["toolbox:fs", "ssh"], ttl_seconds=900)
```

## REST API

Platform requests go to `https://api.daytona.com` with `Authorization: Bearer $DAYTONA_API_KEY`. Toolbox requests (processes, files, git, computer use) go to the sandbox's `toolbox_proxy_url` followed by the sandbox ID.

```bash
# Create a sandbox, then wait until it is running
curl 'https://api.daytona.com/sandboxes' --request POST \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $DAYTONA_API_KEY" --data '{}'
curl 'https://api.daytona.com/sandboxes/{sandboxId}?wait=running&timeout_ms=60000' \
  --header "Authorization: Bearer $DAYTONA_API_KEY"

# Run code through the toolbox; {toolboxProxyUrl} is toolbox_proxy_url from the sandbox response
curl '{toolboxProxyUrl}/{sandboxId}/processes?waitMs=30000&logs=text' --request POST \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $DAYTONA_API_KEY" \
  --data '{"kind": "code", "language": "python", "code": "print(\"Hello World\")"}'
```

The API reports detailed statuses (`running`, `failed`, `lost`) where the SDKs report states (`started`, `error`). Lists return `next_cursor`; pass it as `cursor` for the next page. Every endpoint, with its required permission: [api/README.md](./api/README.md).

## Errors

The SDK errors derive from `DaytonaError`, which carries a `code` field (for example `LIMIT_EXCEEDED`, `SESSION_NOT_FOUND`). Import the v2 error classes from `daytona.v2` (Python) or `@daytona/sdk/v2` (TypeScript).

| Error | Cause |
|---|---|
| `RequestTimeoutError` | A wait, such as `sandbox.wait()` or an image wait with `timeout`, ran out |
| `SandboxTerminalStateError` | `sandbox.wait()` saw `destroying`, `destroyed`, or `error` before the target state |
| `LimitExceededError` | An organization limit was reached (HTTP 429, code `LIMIT_EXCEEDED`) |
| `RateLimitError` | The API rate limit was reached (HTTP 429) |
| `BadRequestError` | Invalid arguments, sometimes raised before any request is sent |

An exception raised by code in `run_code` is not an SDK error; it is returned in `response.error`. Full lists: [python-sdk/reference/errors.md](./python-sdk/reference/errors.md), [typescript-sdk/reference/errors.md](./typescript-sdk/reference/errors.md).

## Limits

| Linux sandbox | Default | Minimum |
|---|---|---|
| CPU | 0.5 cores | 0.125 cores |
| Memory | 1 GiB | 0.5 GiB |
| Disk | 0.5 GiB, or 10 GiB when CPU or memory is set | 10 GiB |

`cpu`, `memory`, and `disk` in `Resources` are the guaranteed resources, reserved and billed as a floor. `cpu_max`, `memory_max`, and `disk_max` are the limits the sandbox can use, up to the sandbox limits of the plan. One core is 2 vCPUs, and `cpu_max` is a multiple of 0.5 cores.

| Sandbox limit | Starter | Team | Enterprise |
|---|---|---|---|
| Cores | 64 | 64 | Custom |
| Memory | 128 GiB | 128 GiB | Custom |
| Ephemeral disk | 512 GiB | 1 TiB | 3 TiB |
| GPU cards | 1 | 8 | 8 |
| Session length | 24 hours | 48 hours | Custom |

Organization limits cap members, concurrent sandboxes (Starter 100, Team 5,000), GPU cards, Windows core licenses, and Mac reservations. A request above a limit is rejected. Read the current usage and limits with `daytona.v2.get_limits()`. See [limits.md](./python-sdk/limits.md), [sandboxes.md](./python-sdk/sandboxes.md#resources), and [linux-sandboxes.md](./python-sdk/linux-sandboxes.md#resources).

## Quick Decision Tree

| I need to... | Start here |
|---|---|
| Run code or commands in an isolated environment | SDK Essentials above, then `./<lang>-sdk/process-execution.md` and `code-execution.md` |
| Keep a sandbox alive longer, or delete it when idle | `./<lang>-sdk/linux-sandboxes.md#timeouts` |
| Build a custom environment (packages, OS, Dockerfile) | `./<lang>-sdk/images.md` |
| Start sandboxes with processes already running | `./<lang>-sdk/snapshots.md` |
| Keep files after a sandbox is deleted | `./<lang>-sdk/persistence.md` and `volumes.md` |
| Control outbound network access | `./<lang>-sdk/network-limits.md` |
| Give sandbox code credentials without exposing them | `./<lang>-sdk/secrets.md` |
| Expose an HTTP service | `./<lang>-sdk/preview.md` |
| Drive a desktop or browser | `./<lang>-sdk/computer-use.md` and `vnc-access.md` |
| Run Docker inside a sandbox | `./<lang>-sdk/docker.md` |
| SSH into a sandbox | `./<lang>-sdk/ssh-access.md` |
| Run a macOS, Windows, or GPU sandbox | `./<lang>-sdk/macos-sandboxes.md`, `./platform/windows-sandboxes.md`, `./platform/gpu-sandboxes.md` |
| Use cheaper capacity that can be reclaimed | `./<lang>-sdk/preemption.md` |
| Run thousands of sandboxes concurrently | `./<lang>-sdk/scale.md` |
| Move from Daytona v0 | `./platform/migrate-from-v0.md` |

Replace `<lang>-sdk` with `python-sdk` or `typescript-sdk`.

## Feature Guides (per-SDK)

Each SDK folder holds the same feature guides with examples in that language. Sections that the SDK does not support keep their CLI and API examples. Use `./<lang>-sdk/<filename>`.

| Filename | Topic |
|---|---|
| `quickstart.md` | Install the SDK, create a first sandbox |
| `authentication.md` | Authenticate the SDKs, CLI, and API |
| `sandboxes.md` | Create, list, search, get, label sandboxes; resources; access tokens; metrics; logs |
| `linux-sandboxes.md` | Linux sandbox parameters, lifecycle, wait, delete, timeouts |
| `macos-sandboxes.md` | macOS sandboxes on reserved Macs |
| `isolation.md` | Runtime, network, and project isolation |
| `persistence.md` | Keep filesystem and memory state beyond a sandbox |
| `scale.md` | Sandbox scalability and concurrency |
| `preemption.md` | Spot sandboxes that Daytona can reclaim |
| `snapshots.md` | Capture and restore memory and disk of a running sandbox |
| `images.md` | Pull, build, capture, and convert images |
| `registries.md` | Private container registry credentials |
| `volumes.md` | Persistent storage that outlives a sandbox |
| `regions.md` | Regions where sandboxes run |
| `network-limits.md` | Outbound network policy |
| `file-system-operations.md` | List, read, write, upload, download, search, watch files; presigned URLs |
| `git-operations.md` | Clone, commit, push, status |
| `code-execution.md` | Run Python, TypeScript, JavaScript through kernels; interpreter contexts |
| `process-execution.md` | Commands, background processes, sessions |
| `pty.md` | Pseudo terminal sessions |
| `log-streaming.md` | Stream process logs while they run |
| `computer-use.md` | Desktop automation (mouse, keyboard, screenshots, accessibility tree) |
| `docker.md` | Docker Engine inside a sandbox |
| `web-terminal.md` | Browser terminal |
| `ssh-access.md` | SSH with an access token or API key |
| `vnc-access.md` | Graphical desktop in the browser |
| `vpn-connections.md` | Connect sandboxes to private networks |
| `preview.md` | Preview URLs for exposed ports |
| `secrets.md` | Inject project secrets into sandbox network traffic |
| `audit-logs.md` | Audit log of user actions |
| `opentelemetry.md` | Export logs, traces, and metrics over OpenTelemetry |
| `organizations.md` | Organizations, members, roles |
| `projects.md` | Projects, lifecycle defaults, budgets |
| `api-keys.md` | Project and organization API keys |
| `limits.md` | Sandbox, organization, and rate limits |
| `bring-your-own-compute.md` | Regions whose sandboxes run on hosts in your own Kubernetes cluster |

## SDK Reference

Class and method reference, one file per module, in `./<lang>-sdk/reference/`:

| File | Module |
|---|---|
| `daytona.md` | Root client, `DaytonaConfig`, `daytona.v2` namespace: create, get, list, search, delete |
| `sandbox.md` | Sandbox handle: state, lifecycle, labels, access tokens, metrics |
| `process.md` | Commands, processes, sessions, PTY |
| `interpreter.md` | Code execution and interpreter contexts |
| `file-system.md` | File system operations |
| `git.md` | Git operations |
| `computer-use.md` | Desktop automation |
| `ports.md` | Exposed ports and preview links |
| `docker.md` | Docker Engine status |
| `image.md` | Images and `ImageBuilder` |
| `snapshot.md` | Snapshots |
| `volume.md` | Volumes |
| `secret.md` | Secrets |
| `reservations.md` | Mac reservations for macOS sandboxes |
| `mac-models.md` | Mac model catalog |
| `errors.md`, `shared-errors.md` | Error classes |
| `types.md` | Shared types, such as storage limits and API key context |

Python: [python-sdk/README.md](./python-sdk/README.md). TypeScript: [typescript-sdk/README.md](./typescript-sdk/README.md).

## Platform Reference

| File | Description |
|---|---|
| [agent-skills.md](./platform/agent-skills.md) | Installing this agent skill |
| [architecture.md](./platform/architecture.md) | Platform architecture overview |
| [billing.md](./platform/billing.md) | Billing, wallet, and usage |
| [gpu-sandboxes.md](./platform/gpu-sandboxes.md) | GPU sandboxes and checkpoints |
| [windows-sandboxes.md](./platform/windows-sandboxes.md) | Windows sandboxes |
| [migrate-from-v0.md](./platform/migrate-from-v0.md) | Migration summary and v0 sandbox import |
| [playground.md](./platform/playground.md) | Browser playground for the TypeScript SDK |
| [sso.md](./platform/sso.md) | Single sign-on and directory sync |

## CLI Reference

Install with `brew install daytonaio/cli/daytona` (macOS) or the install script in [cli/README.md](./cli/README.md), then run `daytona login --token "$DAYTONA_API_KEY" --api-url https://api.daytona.com`.

| File | Commands |
|---|---|
| [cli/README.md](./cli/README.md) | Installation and global flags |
| [cli/login-and-context.md](./cli/login-and-context.md) | `login`, `logout`, `profile`, `whoami` |
| [cli/sandboxes-and-resources.md](./cli/sandboxes-and-resources.md) | `sandbox`, `image`, `snapshot`, `volume`, `region`, `reservation`, `cpu-type`, `mac-model` |
| [cli/organization-management.md](./cli/organization-management.md) | `org`, `project`, `member`, `invite`, `role`, `key`, `org-key`, `secret`, `registry`, `service-account`, `audit`, `billing` |
| [cli/other.md](./cli/other.md) | `completion`, `config`, `docs`, `version` |

## API Reference

Endpoint index for the Daytona API and the Toolbox API: [api/README.md](./api/README.md). One file per tag (`api/sandboxes.md`, `api/images.md`, `api/toolbox-processes.md`, ...), with request and response schemas in `api/schemas.md` and `api/toolbox-schemas.md`.
