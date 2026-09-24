---
name: daytona
description: Creates and manages isolated cloud sandboxes (secure code execution environments with dedicated runtimes) on the Daytona platform. Use when a task needs an isolated runtime, sandbox, secure compute, or Daytona SDK/API/CLI operations. Covers Python, TypeScript, Java, Go, and Ruby SDKs.
---

## What is Daytona

Daytona provides **full composable computers** — **sandboxes** — for AI agents. Each sandbox is an isolated runtime environment with its own kernel, filesystem, network stack, and dedicated vCPU, RAM, and disk. Agents can install packages, run servers, compile code, and manage processes inside sandboxes.

Sandboxes are built from OCI-compliant images or snapshots. Any language or tool that runs on Linux works.

**Scope:** This skill covers Daytona Cloud (`app.daytona.io`).

## Before You Start

Before writing any Daytona code, verify setup:

1. **SDK installed?** Check that the Daytona SDK is installed for the user's language (e.g. `pip show daytona` or check `package.json` for `@daytona/sdk`). If not, install it.
2. **API key set?** Check `DAYTONA_API_KEY` in the shell environment or in environment files. If not set, tell the user they need an API key and point them to [Daytona Dashboard > API Keys](https://app.daytona.io/dashboard/keys) to create one.

## SDK Essentials — Python

### Installation

```bash
pip install daytona
```

### Create client and sandbox

```python
from daytona import Daytona

# Uses DAYTONA_API_KEY env var
daytona = Daytona()

# Create a sandbox with defaults (1 vCPU, 1GB RAM, 3GB disk)
sandbox = daytona.create()
```

```python
from daytona import Daytona, CreateSandboxFromImageParams, Image, Resources

daytona = Daytona()

# Create with a custom image, name, and resources
sandbox = daytona.create(CreateSandboxFromImageParams(
    image=Image.debian_slim("3.12"),
    name="my-sandbox",
    resources=Resources(cpu=2, memory=4, disk=8),
))
```

### Execute commands

Both `exec` and `code_run` return an `ExecuteResponse` with `.result` (stdout) and `.exit_code`.
`code_run` executes in the sandbox's language runtime (set at creation via `language=` param, defaults to `"python"`). Supported: `python`, `typescript`, `javascript`.

```python
# Run a shell command
response = sandbox.process.exec("echo 'Hello, World!'")
print(response.result)     # "Hello, World!"
print(response.exit_code)  # 0

# Run Python code (stateless)
response = sandbox.process.code_run('''
import json
data = {"key": "value"}
print(json.dumps(data, indent=2))
''')
print(response.result)
print(response.exit_code)  # 0 on success, non-zero on error
```

### File operations

```python
# Write a file
sandbox.fs.upload_file(b"Hello, Daytona!", "/home/daytona/data.txt")

# Read a file
content = sandbox.fs.download_file("/home/daytona/data.txt")
print(content.decode())

# List files
files = sandbox.fs.list_files("workspace")
for f in files:
    print(f"{f.name} ({'dir' if f.is_dir else f.size})")
```

### Sandbox lifecycle

```python
# Pause and resume later
sandbox.stop()          # frees CPU/RAM, keeps disk
sandbox.start()         # ready to use again

# Long-term storage (must be stopped first)
sandbox.stop()
sandbox.archive()       # cold storage, no quota impact

# Resume a previous sandbox by ID or name
sandbox = daytona.get("sandbox-id-or-name")
sandbox.start()

# Permanently remove
sandbox.delete()
```

Wrap Daytona calls with `DaytonaError` for error handling. For async, use `AsyncDaytona` (async context manager). For full Python SDK reference, see [python-sdk/README.md](./references/python-sdk/README.md).

## SDK Essentials — TypeScript

The TypeScript SDK (`@daytona/sdk`) mirrors the Python API. Key differences: `executeCommand` instead of `exec`, `codeRun` instead of `code_run`, `uploadFile`/`downloadFile`/`listFiles` for file ops, `DaytonaError` for error handling. Install with `npm install @daytona/sdk`.

For full TypeScript SDK reference and examples, see [typescript-sdk/README.md](./references/typescript-sdk/README.md).

## Common Patterns

### Custom environments and snapshots

When the user needs specific packages, tools, or a custom OS in their sandbox, define a custom image with the `Image` builder. If the user will create multiple sandboxes with the same setup, offer to build a **snapshot** — snapshots bake dependencies into a reusable template so subsequent sandboxes start quickly with everything pre-installed.

**Note:** Snapshots are built from image definitions, not from live sandbox state. You cannot snapshot a running sandbox to capture its current filesystem.

Define images with the `Image` builder:

```python
from daytona import Image

# Debian with Python packages
image = Image.debian_slim("3.12").pip_install(["pandas", "numpy", "scikit-learn"])

# With system packages and shell commands
image = (Image.debian_slim("3.12")
    .run_commands("apt-get update && apt-get install -y curl git",
                   "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -")
    .pip_install(["flask"])
    .env({"APP_ENV": "production"}))

# From a Dockerfile
image = Image.from_dockerfile("./Dockerfile")

# From a registry image directly
image = Image.base("node:20-slim")
```

```typescript
import { Image } from '@daytona/sdk'

const image = Image.debianSlim('3.12').pipInstall(['pandas', 'numpy', 'scikit-learn'])

const image = Image.debianSlim('3.12')
    .runCommands('apt-get update && apt-get install -y curl git',
                 'curl -fsSL https://deb.nodesource.com/setup_20.x | bash -')
    .pipInstall(['flask'])
    .env({ APP_ENV: 'production' })

const image = Image.fromDockerfile('./Dockerfile')

const image = Image.base('node:20-slim')
```

Create a one-off sandbox directly from an image:

```python
from daytona import Daytona, CreateSandboxFromImageParams, Image

daytona = Daytona()
image = Image.debian_slim("3.12").pip_install(["flask"])
sandbox = daytona.create(CreateSandboxFromImageParams(image=image))
```

```typescript
const sandbox = await daytona.create({ image })
```

Or build a snapshot for reuse (recommended if creating multiple sandboxes with the same setup):

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams, CreateSnapshotParams, Image

daytona = Daytona()

# One-time: build a snapshot
image = Image.debian_slim("3.12").pip_install(["pandas", "numpy", "scikit-learn"])
snapshot = daytona.snapshot.create(CreateSnapshotParams(
    name="data-science",
    image=image,
))

# Every time after: fast start from snapshot
sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    snapshot=snapshot.name,
))
response = sandbox.process.code_run("import pandas; print(pandas.__version__)")
```

```typescript
const snapshot = await daytona.snapshot.create({
    name: 'data-science',
    image: Image.debianSlim('3.12').pipInstall(['pandas', 'numpy', 'scikit-learn']),
})

const sandbox = await daytona.create({ snapshot: snapshot.name })
```

For the full `Image` builder API, see `./references/<lang>-sdk/declarative-builder.md`. For snapshot management, see `./references/<lang>-sdk/snapshots.md`.

### Long-running task pattern

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.create()

# ... clone repo, install deps, etc.

# Start a test suite in the background
sandbox.process.exec("nohup pytest --tb=short > /home/daytona/test.log 2>&1 &")

# Check progress later
response = sandbox.process.exec("tail -5 /home/daytona/test.log")
print(response.result)

# Download the full report when done
report = sandbox.fs.download_file("/home/daytona/test.log")
```

### Preview URLs

Sandboxes expose HTTP services via preview URLs. Previews are token-authenticated by default, or public if `public=True` (Python) / `public: true` (TypeScript) at sandbox creation.

- **Token-authenticated** — returns `.url` and `.token` (send as `x-daytona-preview-token` header)
  - Python: `sandbox.get_preview_link(port)` | TypeScript: `sandbox.getPreviewLink(port)` | Go: `sandbox.GetPreviewLink(port)` | Ruby: `sandbox.get_preview_link(port)`
- **Signed URL (shareable)** — token embedded in URL, no headers needed
  - Python: `sandbox.create_signed_preview_url(port, expires_in_seconds=3600)` | TypeScript: `sandbox.getSignedPreviewUrl(port, 3600)` | Go: `sandbox.GetSignedPreviewLink(port, 3600)` | Ruby: `sandbox.create_signed_preview_url(port, expires_in_seconds: 3600)`

For details, see `./references/<lang>-sdk/preview.md`.

## Sandbox Limits & Constraints

| Constraint | Default | Maximum |
|-----------|---------|---------|
| vCPU per sandbox | 1 | 4 |
| RAM per sandbox | 1 GB | 8 GB |
| Disk per sandbox | 3 GiB | 10 GB |

Aggregate limits (total vCPU/RAM/disk across all sandboxes) depend on your organization tier:

| Tier | vCPU | RAM | Storage | Requirements |
|------|------|-----|---------|-------------|
| Tier 1 | 10 | 10 GiB | 30 GiB | Email verified |
| Tier 2 | 100 | 200 GiB | 300 GiB | Credit card + $25 top-up + GitHub connected |
| Tier 3 | 250 | 500 GiB | 2000 GiB | Business email + $500 top-up |
| Tier 4 | 500 | 1000 GiB | 5000 GiB | $2000 top-up every 30 days |

**Resource state impact:**
- **Running** sandboxes count against vCPU + RAM + disk
- **Stopped** sandboxes count only against disk
- **Archived** sandboxes have no quota impact (data in cold storage)

### Network access restrictions

**Tier 1 & Tier 2 organizations have restricted network access.** Sandboxes can only reach a whitelist of essential services (package registries, Git hosts, AI APIs, CDNs, etc.). This restriction **cannot be overridden** at the sandbox level — even setting `networkAllowList` won't help if your org is Tier 1/2.

**Tier 3 & Tier 4** get full unrestricted internet access by default, with optional per-sandbox firewall controls.

If your code needs to reach arbitrary URLs (external APIs, custom services, etc.), you need **Tier 3+**. Check your tier at [Daytona Dashboard > Limits](https://app.daytona.io/dashboard/limits).

Essential services available on all tiers include: npm/PyPI/apt registries, GitHub/GitLab/Bitbucket, Docker registries, major AI APIs (Anthropic, OpenAI, Google AI, etc.), S3, Google Cloud Storage, and common dev tools (Vercel, Supabase, Clerk, Sentry, etc.). For the full list, see [network-limits.md](./references/python-sdk/network-limits.md#essential-services). Missing a service? Submit a request at [daytonaio/sandbox-network-whitelist](https://github.com/daytonaio/sandbox-network-whitelist).

View your usage at [Daytona Dashboard > Limits](https://app.daytona.io/dashboard/limits). For full details, see [limits.md](./references/platform/limits.md).

## Quick Decision Tree

| I need to... | Start here |
|---|---|
| Run code/commands in an isolated environment | SDK Essentials above, then `./references/<lang>-sdk/process-code-execution.md` |
| Make sandboxes start faster | `./references/<lang>-sdk/snapshots.md` — build a snapshot from an image definition, create new sandboxes from it |
| Persist data across sandbox runs | `./references/<lang>-sdk/volumes.md` — attach persistent storage that survives sandbox deletion |
| Build a custom environment (specific OS, packages, deps) | `./references/<lang>-sdk/declarative-builder.md` — use the `Image` builder to define custom sandbox images |
| Control what a sandbox can access on the network | `./references/<lang>-sdk/network-limits.md` — per-sandbox firewall rules (Tier 3+ for unrestricted) |
| Interact with a browser or GUI in the sandbox | `./references/<lang>-sdk/computer-use-guide.md` + `./references/<lang>-sdk/vnc-access.md` |
| Run a stateful Python interpreter (persistent variables between calls) | `./references/python-sdk/sync/code-interpreter.md` or `./references/typescript-sdk/code-interpreter.md` |
| Store and retrieve objects (S3-compatible) | `./references/<lang>-sdk/object-storage.md` (Python sync/async, TypeScript, Ruby) |
| SSH into a running sandbox | `./references/<lang>-sdk/ssh-access.md` |

Replace `<lang>-sdk` with: `python-sdk`, `typescript-sdk`, `java-sdk`, `go-sdk`, or `ruby-sdk`.

## SDK Index

### Python SDK (primary)

| File | Description |
|------|-------------|
| [python-sdk/README.md](./references/python-sdk/README.md) | Installation, quickstart, configuration |
| [python-sdk/sync/daytona.md](./references/python-sdk/sync/daytona.md) | Daytona client — create, list, delete sandboxes |
| [python-sdk/sync/sandbox.md](./references/python-sdk/sync/sandbox.md) | Sandbox instance — lifecycle, resources, labels |
| [python-sdk/sync/process.md](./references/python-sdk/sync/process.md) | Execute commands, run code |
| [python-sdk/sync/file-system.md](./references/python-sdk/sync/file-system.md) | File operations — read, write, upload, download |
| [python-sdk/sync/git.md](./references/python-sdk/sync/git.md) | Git operations — clone, commit, push, status |
| [python-sdk/sync/snapshot.md](./references/python-sdk/sync/snapshot.md) | Snapshot management |
| [python-sdk/sync/volume.md](./references/python-sdk/sync/volume.md) | Volume management |
| [python-sdk/sync/code-interpreter.md](./references/python-sdk/sync/code-interpreter.md) | Stateful Python interpreter |
| [python-sdk/sync/computer-use.md](./references/python-sdk/sync/computer-use.md) | Desktop automation (mouse/keyboard/screen) |
| [python-sdk/sync/lsp-server.md](./references/python-sdk/sync/lsp-server.md) | Language Server Protocol |
| [python-sdk/sync/object-storage.md](./references/python-sdk/sync/object-storage.md) | S3-compatible object storage |
| [python-sdk/errors.md](./references/python-sdk/errors.md) | Error types |
| [python-sdk/image.md](./references/python-sdk/image.md) | Custom image definitions |

Async versions mirror the sync API: [python-sdk/async/](./references/python-sdk/async/).

### TypeScript SDK

Flat structure (no sync/async split like Python): [typescript-sdk/README.md](./references/typescript-sdk/README.md). Files: `daytona.md`, `sandbox.md`, `process.md`, `file-system.md`, `git.md`, `snapshot.md`, `volume.md`, `code-interpreter.md`, `computer-use.md`, `lsp-server.md`, `object-storage.md`, `execute-response.md`, `pty-handle.md`, `errors.md`, `image.md`.

### Java SDK, Go SDK & Ruby SDK

All follow the same patterns. Java mirrors TypeScript's flat structure: [java-sdk/README.md](./references/java-sdk/README.md). Go uses a compact single-file structure: [go-sdk/README.md](./references/go-sdk/README.md). Ruby mirrors TypeScript: [ruby-sdk/README.md](./references/ruby-sdk/README.md).

## Feature Guides (per-SDK)

Each SDK folder contains the same set of feature guides with language-specific examples. To find a guide, use `./references/<lang>-sdk/<filename>` (e.g., `./references/python-sdk/sandboxes.md`, `./references/typescript-sdk/snapshots.md`).

| Filename | Topic |
|----------|-------|
| `sandboxes.md` | Sandbox lifecycle — create, start, stop, archive, delete |
| `process-code-execution.md` | Run commands and code, stateful interpreter |
| `file-system-operations.md` | Read, write, upload, download files |
| `git-operations.md` | Clone, commit, push, status |
| `snapshots.md` | Build reusable sandbox templates from image definitions |
| `volumes.md` | Persistent storage across sandboxes |
| `ssh-access.md` | SSH into sandboxes |
| `vnc-access.md` | VNC for desktop sandboxes |
| `computer-use-guide.md` | Desktop automation (mouse/keyboard/screen) |
| `declarative-builder.md` | Custom sandbox images with the Image builder |
| `log-streaming.md` | Stream sandbox logs |
| `network-limits.md` | Network firewall controls |
| `language-server-protocol.md` | IDE-like features (autocomplete, diagnostics) |
| `preview.md` | Preview URLs for exposed ports |
| `pty.md` | PTY/terminal support |
| `regions.md` | Available regions |
| `vpn-connections.md` | VPN connections |

## Platform Reference

| File | Description |
|------|-------------|
| [limits.md](./references/platform/limits.md) | Resource limits, rate limits, tier requirements |
| [organizations.md](./references/platform/organizations.md) | Team management, member roles |
| [billing.md](./references/platform/billing.md) | Usage tracking, pricing |
| [audit-logs.md](./references/platform/audit-logs.md) | Audit logging |
| [linked-accounts.md](./references/platform/linked-accounts.md) | GitHub/GitLab account linking |
| [web-terminal.md](./references/platform/web-terminal.md) | Browser-based terminal access |
| [webhooks.md](./references/platform/webhooks.md) | Webhook events |
| [mcp.md](./references/platform/mcp.md) | MCP integration |
| [cli.md](./references/cli.md) | CLI command reference |

## API Reference

Raw REST API documentation for all Daytona endpoints (sandboxes, snapshots, volumes, toolbox operations, etc.): [api/README.md](./references/api/README.md).
