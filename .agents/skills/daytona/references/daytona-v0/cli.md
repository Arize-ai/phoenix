## Contents

- Installation
- daytona-v0
- daytona-v0 archive
- daytona-v0 autocomplete
- daytona-v0 create
- daytona-v0 delete
- daytona-v0 docs
- daytona-v0 exec
- daytona-v0 info
- daytona-v0 list
- daytona-v0 login
- daytona-v0 logout
- daytona-v0 mcp
- daytona-v0 mcp config
- daytona-v0 mcp init
- daytona-v0 mcp start
- daytona-v0 organization
- daytona-v0 organization create
- daytona-v0 organization delete
- daytona-v0 organization list
- daytona-v0 organization members
- daytona-v0 organization use
- daytona-v0 pause
- daytona-v0 preview-url
- daytona-v0 snapshot
- daytona-v0 snapshot activate
- daytona-v0 snapshot create
- daytona-v0 snapshot delete
- daytona-v0 snapshot list
- daytona-v0 snapshot push
- daytona-v0 ssh
- daytona-v0 start
- daytona-v0 stop
- daytona-v0 version
- daytona-v0 volume
- daytona-v0 volume create
- daytona-v0 volume delete
- daytona-v0 volume get
- daytona-v0 volume list
- See Also



Daytona provides command-line access to core features for interacting with Daytona Sandboxes, including managing their lifecycle, snapshots, and more.

The CLI reference lists all commands supported by the `daytona-v0` command-line tool, complete with a description of their behavior, and any supported flags.
You can access this documentation on a per-command basis by appending the `--help`/`-h` flag when invoking `daytona-v0`.

## Installation

Install the Daytona CLI to interact with Daytona sandboxes from the command line. The Daytona v0 CLI installs as `daytona-v0`, next to the [Daytona v2 CLI](https://www.daytona.com/docs/cli), which installs as `daytona`.

**Mac:**

```bash
brew install daytonaio/cli/daytona-v0
```

To upgrade the Daytona CLI to the latest 0.x version:

```bash
brew upgrade daytonaio/cli/daytona-v0
```

Alternatively, install directly without Homebrew. The script downloads the latest 0.x release, verifies its checksum, and installs it to `/usr/local/bin`, or to `~/.local/bin` if `/usr/local/bin` is not writable:

```bash
curl -fsSL https://raw.githubusercontent.com/daytona/clients/release/v0/cli/install-v0.sh | sh
```

**Linux:**

The script downloads the latest 0.x release, verifies its checksum, and installs it to `/usr/local/bin`, or to `~/.local/bin` if `/usr/local/bin` is not writable:

```bash
curl -fsSL https://raw.githubusercontent.com/daytona/clients/release/v0/cli/install-v0.sh | sh
```

Alternatively, install with Homebrew:

```bash
brew install daytonaio/cli/daytona-v0
```

**Windows:**

The script downloads the latest 0.x release, verifies its checksum, installs it to `%LOCALAPPDATA%\Daytona\bin`, and adds the directory to the user `PATH`. Open a new terminal to use `daytona-v0`:

```bash
powershell -Command "irm https://get.daytona.io/windows-v0 | iex"
```

> **Note:** If you installed the Daytona CLI as `daytona`, install `daytona-v0` and replace `daytona` with `daytona-v0` in your scripts. Since Daytona CLI 2.1.0, the `daytona` command installs the Daytona v2 CLI. To keep a Homebrew `daytona` install on 0.x, run `brew pin daytona` before you upgrade.

After installing the Daytona CLI, use the `daytona-v0` command to interact with Daytona sandboxes from the command line.

## daytona-v0
Daytona CLI

```shell
daytona-v0 [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |
| `--version` | `-v` | Display the version of Daytona |


## daytona-v0 archive
Archive a sandbox

```shell
daytona-v0 archive [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 autocomplete
Adds a completion script for your shell environment

```shell
daytona-v0 autocomplete [bash|zsh|fish|powershell] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |

> **Note:** If using bash shell environment, make sure you have bash-completion installed in order to get full autocompletion functionality.
> Linux Installation: ```sudo apt-get install bash-completion```
> macOS Installation: ```brew install bash-completion```

## daytona-v0 create
Create a new sandbox

```shell
daytona-v0 create [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--auto-archive` |  | Auto-archive interval in minutes (0 means the maximum interval will be used) |
| `--auto-delete` |  | Auto-delete interval in minutes (negative value means disabled, 0 means delete immediately upon stopping) |
| `--auto-pause` |  | Auto-pause interval in minutes (0 means disabled). Only supported for sandbox classes that support pausing. Not allowed for ephemeral sandboxes. Mutually exclusive with --auto-stop |
| `--auto-stop` |  | Auto-stop interval in minutes (0 means disabled). Server default: 15, except for sandbox classes that support pausing where auto-pause defaults to 60 instead |
| `--context` | `-c` | Files or directories to include in the build context (can be specified multiple times) |
| `--cpu` |  | CPU cores allocated to the sandbox |
| `--disk` |  | Disk space allocated to the sandbox in GB |
| `--dockerfile` | `-f` | Path to Dockerfile for Sandbox snapshot |
| `--env` | `-e` | Environment variables (format: KEY=VALUE) |
| `--gpu` |  | GPU units allocated to the sandbox |
| `--kvm` |  | Expose KVM (/dev/kvm) inside the sandbox via nested virtualization. linux-vm snapshots only. Requires the sandbox_kvm feature for the organization. |
| `--label` | `-l` | Labels (format: KEY=VALUE) |
| `--memory` |  | Memory allocated to the sandbox in MB |
| `--name` |  | Name of the sandbox |
| `--network-allow-list` |  | Comma-separated list of allowed CIDR network addresses for the sandbox |
| `--network-block-all` |  | Whether to block all network access for the sandbox |
| `--public` |  | Make sandbox publicly accessible |
| `--queue-timeout` |  | Minutes to wait for runner assignment before the sandbox creation is cancelled (omit to use the organization default) |
| `--snapshot` |  | Snapshot to use for the sandbox |
| `--target` |  | Target region (eu, us) |
| `--ttl` |  | Maximum time to live in minutes, counted as wall-clock time since creation regardless of sandbox state (0 means disabled). When it elapses the sandbox is destroyed, even if it is stopped, paused, or archived |
| `--user` |  | User associated with the sandbox |
| `--volume` | `-v` | Volumes to mount (format: VOLUME_ID_OR_NAME:MOUNT_PATH) |
| `--help` |  | help for daytona-v0 |


## daytona-v0 delete
Delete a sandbox

```shell
daytona-v0 delete [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--all` | `-a` | Delete all sandboxes |
| `--help` |  | help for daytona-v0 |


## daytona-v0 docs
Opens the Daytona documentation in your default browser.

```shell
daytona-v0 docs [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 exec
Execute a command in a sandbox

```shell
daytona-v0 exec [SANDBOX_ID | SANDBOX_NAME] -- [COMMAND] [ARGS...] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--cwd` |  | Working directory for command execution |
| `--timeout` |  | Command timeout in seconds (0 for no timeout) |
| `--help` |  | help for daytona-v0 |


## daytona-v0 info
Get sandbox info

```shell
daytona-v0 info [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--help` |  | help for daytona-v0 |


## daytona-v0 list
List sandboxes

```shell
daytona-v0 list [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--cursor` | `-c` | Cursor for pagination |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--limit` | `-l` | Maximum number of items per page |
| `--help` |  | help for daytona-v0 |


## daytona-v0 login
Log in to Daytona

```shell
daytona-v0 login [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--api-key` |  | API key to use for authentication |
| `--help` |  | help for daytona-v0 |


## daytona-v0 logout
Logout from Daytona

```shell
daytona-v0 logout [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 mcp
Manage Daytona MCP Server

```shell
daytona-v0 mcp [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 mcp config
Outputs JSON configuration for Daytona MCP Server

```shell
daytona-v0 mcp config [AGENT_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 mcp init
Initialize Daytona MCP Server with an agent (currently supported: claude, windsurf, cursor)


```shell
daytona-v0 mcp init [AGENT_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 mcp start
Start Daytona MCP Server

```shell
daytona-v0 mcp start [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 organization
Manage Daytona organizations

```shell
daytona-v0 organization [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 organization create
Create a new organization and set it as active

```shell
daytona-v0 organization create [ORGANIZATION_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--region` | `-r` | Default region (id or name) for the organization |
| `--help` |  | help for daytona-v0 |


## daytona-v0 organization delete
Delete an organization

```shell
daytona-v0 organization delete [ORGANIZATION] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 organization list
List all organizations

```shell
daytona-v0 organization list [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--help` |  | help for daytona-v0 |


## daytona-v0 organization members
List members of an organization

```shell
daytona-v0 organization members [ORGANIZATION] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--help` |  | help for daytona-v0 |


## daytona-v0 organization use
Set active organization

```shell
daytona-v0 organization use [ORGANIZATION] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 pause
Pause a sandbox

```shell
daytona-v0 pause [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 preview-url
Get signed preview URL for a sandbox port

```shell
daytona-v0 preview-url [SANDBOX_ID | SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--expires` |  | URL expiration time in seconds |
| `--port` | `-p` | Port number to get preview URL for (required) |
| `--help` |  | help for daytona-v0 |


## daytona-v0 snapshot
Manage Daytona snapshots

```shell
daytona-v0 snapshot [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 snapshot activate
Activate a snapshot

```shell
daytona-v0 snapshot activate [SNAPSHOT_ID | SNAPSHOT_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 snapshot create
Create a snapshot

```shell
daytona-v0 snapshot create [SNAPSHOT] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--context` | `-c` | Files or directories to include in the build context (can be specified multiple times). If not provided, context will be automatically determined from COPY/ADD commands in the Dockerfile |
| `--cpu` |  | CPU cores that will be allocated to the underlying sandboxes (default: 1) |
| `--disk` |  | Disk space that will be allocated to the underlying sandboxes in GB (default: 3) |
| `--dockerfile` | `-f` | Path to Dockerfile to build |
| `--entrypoint` | `-e` | The entrypoint command for the snapshot |
| `--image` | `-i` | The image name for the snapshot |
| `--memory` |  | Memory that will be allocated to the underlying sandboxes in GB (default: 1) |
| `--region` |  | ID of the region where the snapshot will be available (defaults to organization default region) |
| `--sandbox-class` |  | Target sandbox class for the snapshot. One of: 'container' or 'linux-vm' (defaults to organization/server default) |
| `--help` |  | help for daytona-v0 |


## daytona-v0 snapshot delete
Delete a snapshot

```shell
daytona-v0 snapshot delete [SNAPSHOT_ID | SNAPSHOT_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--all` | `-a` | Delete all snapshots |
| `--help` |  | help for daytona-v0 |


## daytona-v0 snapshot list
List all snapshots

```shell
daytona-v0 snapshot list [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--limit` | `-l` | Maximum number of items per page |
| `--page` | `-p` | Page number for pagination (starting from 1) |
| `--source-sandbox-id` |  | Filter by the ID of the sandbox the snapshot was created from |
| `--help` |  | help for daytona-v0 |


## daytona-v0 snapshot push
Push local snapshot

```shell
daytona-v0 snapshot push [SNAPSHOT] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--cpu` |  | CPU cores that will be allocated to the underlying sandboxes (default: 1) |
| `--disk` |  | Disk space that will be allocated to the underlying sandboxes in GB (default: 3) |
| `--entrypoint` | `-e` | The entrypoint command for the image |
| `--memory` |  | Memory that will be allocated to the underlying sandboxes in GB (default: 1) |
| `--name` | `-n` | Specify the Snapshot name |
| `--region` |  | ID of the region where the snapshot will be available (defaults to organization default region) |
| `--help` |  | help for daytona-v0 |


## daytona-v0 ssh
SSH into a sandbox

```shell
daytona-v0 ssh [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--expires` |  | SSH access token expiration time in minutes |
| `--help` |  | help for daytona-v0 |


## daytona-v0 start
Start a sandbox

```shell
daytona-v0 start [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 stop
Stop a sandbox

```shell
daytona-v0 stop [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--force` | `-f` | Force stop the sandbox using SIGKILL |
| `--help` |  | help for daytona-v0 |


## daytona-v0 version
Print the version number

```shell
daytona-v0 version [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 volume
Manage Daytona volumes

```shell
daytona-v0 volume [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 volume create
Create a volume

```shell
daytona-v0 volume create [NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--size` | `-s` | Size of the volume in GB |
| `--help` |  | help for daytona-v0 |


## daytona-v0 volume delete
Delete a volume

```shell
daytona-v0 volume delete [VOLUME_ID_OR_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona-v0 |


## daytona-v0 volume get
Get volume details

```shell
daytona-v0 volume get [VOLUME_ID_OR_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--help` |  | help for daytona-v0 |


## daytona-v0 volume list
List all volumes

```shell
daytona-v0 volume list [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--help` |  | help for daytona-v0 |

## See Also

- [Python SDK](./python-sdk/README.md)
- [TypeScript SDK](./typescript-sdk/README.md)
- [Java SDK](./java-sdk/README.md)
- [Go SDK](./go-sdk/README.md)
- [Ruby SDK](./ruby-sdk/README.md)
