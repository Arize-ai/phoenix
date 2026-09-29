## Contents

- Installation
- daytona
- daytona archive
- daytona autocomplete
- daytona create
- daytona delete
- daytona docs
- daytona exec
- daytona info
- daytona list
- daytona login
- daytona logout
- daytona mcp
- daytona mcp config
- daytona mcp init
- daytona mcp start
- daytona organization
- daytona organization create
- daytona organization delete
- daytona organization list
- daytona organization members
- daytona organization use
- daytona pause
- daytona preview-url
- daytona snapshot
- daytona snapshot activate
- daytona snapshot create
- daytona snapshot delete
- daytona snapshot list
- daytona snapshot push
- daytona ssh
- daytona start
- daytona stop
- daytona version
- daytona volume
- daytona volume create
- daytona volume delete
- daytona volume get
- daytona volume list
- See Also



Daytona provides command-line access to core features for interacting with Daytona Sandboxes, including managing their lifecycle, snapshots, and more.

The CLI reference lists all commands supported by the `daytona` command-line tool, complete with a description of their behavior, and any supported flags.
You can access this documentation on a per-command basis by appending the `--help`/`-h` flag when invoking `daytona`.

## Installation

Install the Daytona CLI to interact with Daytona sandboxes from the command line.

**Mac:**

```bash
brew install daytonaio/cli/daytona
```

Trust the tap once so routine `brew upgrade` keeps the Daytona CLI up to date. Recent Homebrew versions require third-party taps to be explicitly trusted; without it, a bare `brew upgrade` skips the Daytona tap and the CLI goes stale:

```bash
brew trust daytonaio/cli
```

To upgrade the Daytona CLI to the latest version:

```bash
brew upgrade daytonaio/cli/daytona
```

Alternatively, install directly without Homebrew:

For Apple Silicon (`arm64`):

  ```bash
  sudo curl -fL https://github.com/daytonaio/daytona/releases/latest/download/daytona-darwin-arm64 -o /usr/local/bin/daytona && sudo chmod +x /usr/local/bin/daytona
  ```

For Intel (`amd64`):

  ```bash
  sudo curl -fL https://github.com/daytonaio/daytona/releases/latest/download/daytona-darwin-amd64 -o /usr/local/bin/daytona && sudo chmod +x /usr/local/bin/daytona
  ```

**Linux:**

Choose the command for your Linux architecture. Both commands download the latest binary from GitHub releases and install it to `/usr/local/bin`, overwriting any existing version.

For `amd64` (`x86_64`):

  ```bash
  sudo curl -fL https://github.com/daytonaio/daytona/releases/latest/download/daytona-linux-amd64 -o /usr/local/bin/daytona && sudo chmod +x /usr/local/bin/daytona
  ```

For `arm64` (`aarch64`):

  ```bash
  sudo curl -fL https://github.com/daytonaio/daytona/releases/latest/download/daytona-linux-arm64 -o /usr/local/bin/daytona && sudo chmod +x /usr/local/bin/daytona
  ```

**Windows:**

```bash
powershell -Command "irm https://get.daytona.io/windows | iex"
```

After installing the Daytona CLI, use the `daytona` command to interact with Daytona sandboxes from the command line.

## daytona
Daytona CLI

```shell
daytona [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |
| `--version` | `-v` | Display the version of Daytona |


## daytona archive
Archive a sandbox

```shell
daytona archive [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona autocomplete
Adds a completion script for your shell environment

```shell
daytona autocomplete [bash|zsh|fish|powershell] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |

> **Note:** If using bash shell environment, make sure you have bash-completion installed in order to get full autocompletion functionality.
> Linux Installation: ```sudo apt-get install bash-completion```
> macOS Installation: ```brew install bash-completion```

## daytona create
Create a new sandbox

```shell
daytona create [flags]
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
| `--label` | `-l` | Labels (format: KEY=VALUE) |
| `--memory` |  | Memory allocated to the sandbox in MB |
| `--name` |  | Name of the sandbox |
| `--network-allow-list` |  | Comma-separated list of allowed CIDR network addresses for the sandbox |
| `--network-block-all` |  | Whether to block all network access for the sandbox |
| `--public` |  | Make sandbox publicly accessible |
| `--snapshot` |  | Snapshot to use for the sandbox |
| `--target` |  | Target region (eu, us) |
| `--ttl` |  | Maximum time to live in minutes, counted as wall-clock time since creation regardless of sandbox state (0 means disabled). When it elapses the sandbox is destroyed, even if it is stopped, paused, or archived |
| `--user` |  | User associated with the sandbox |
| `--volume` | `-v` | Volumes to mount (format: VOLUME_ID_OR_NAME:MOUNT_PATH) |
| `--help` |  | help for daytona |


## daytona delete
Delete a sandbox

```shell
daytona delete [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--all` | `-a` | Delete all sandboxes |
| `--help` |  | help for daytona |


## daytona docs
Opens the Daytona documentation in your default browser.

```shell
daytona docs [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona exec
Execute a command in a sandbox

```shell
daytona exec [SANDBOX_ID | SANDBOX_NAME] -- [COMMAND] [ARGS...] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--cwd` |  | Working directory for command execution |
| `--timeout` |  | Command timeout in seconds (0 for no timeout) |
| `--help` |  | help for daytona |


## daytona info
Get sandbox info

```shell
daytona info [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--help` |  | help for daytona |


## daytona list
List sandboxes

```shell
daytona list [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--cursor` | `-c` | Cursor for pagination |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--limit` | `-l` | Maximum number of items per page |
| `--help` |  | help for daytona |


## daytona login
Log in to Daytona

```shell
daytona login [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--api-key` |  | API key to use for authentication |
| `--help` |  | help for daytona |


## daytona logout
Logout from Daytona

```shell
daytona logout [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona mcp
Manage Daytona MCP Server

```shell
daytona mcp [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona mcp config
Outputs JSON configuration for Daytona MCP Server

```shell
daytona mcp config [AGENT_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona mcp init
Initialize Daytona MCP Server with an agent (currently supported: claude, windsurf, cursor)


```shell
daytona mcp init [AGENT_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona mcp start
Start Daytona MCP Server

```shell
daytona mcp start [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona organization
Manage Daytona organizations

```shell
daytona organization [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona organization create
Create a new organization and set it as active

```shell
daytona organization create [ORGANIZATION_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--region` | `-r` | Default region (id or name) for the organization |
| `--help` |  | help for daytona |


## daytona organization delete
Delete an organization

```shell
daytona organization delete [ORGANIZATION] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona organization list
List all organizations

```shell
daytona organization list [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--help` |  | help for daytona |


## daytona organization members
List members of an organization

```shell
daytona organization members [ORGANIZATION] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--help` |  | help for daytona |


## daytona organization use
Set active organization

```shell
daytona organization use [ORGANIZATION] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona pause
Pause a sandbox

```shell
daytona pause [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona preview-url
Get signed preview URL for a sandbox port

```shell
daytona preview-url [SANDBOX_ID | SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--expires` |  | URL expiration time in seconds |
| `--port` | `-p` | Port number to get preview URL for (required) |
| `--help` |  | help for daytona |


## daytona snapshot
Manage Daytona snapshots

```shell
daytona snapshot [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona snapshot activate
Activate a snapshot

```shell
daytona snapshot activate [SNAPSHOT_ID | SNAPSHOT_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona snapshot create
Create a snapshot

```shell
daytona snapshot create [SNAPSHOT] [flags]
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
| `--help` |  | help for daytona |


## daytona snapshot delete
Delete a snapshot

```shell
daytona snapshot delete [SNAPSHOT_ID | SNAPSHOT_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--all` | `-a` | Delete all snapshots |
| `--help` |  | help for daytona |


## daytona snapshot list
List all snapshots

```shell
daytona snapshot list [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--limit` | `-l` | Maximum number of items per page |
| `--page` | `-p` | Page number for pagination (starting from 1) |
| `--source-sandbox-id` |  | Filter by the ID of the sandbox the snapshot was created from |
| `--help` |  | help for daytona |


## daytona snapshot push
Push local snapshot

```shell
daytona snapshot push [SNAPSHOT] [flags]
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
| `--help` |  | help for daytona |


## daytona ssh
SSH into a sandbox

```shell
daytona ssh [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--expires` |  | SSH access token expiration time in minutes |
| `--help` |  | help for daytona |


## daytona start
Start a sandbox

```shell
daytona start [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona stop
Stop a sandbox

```shell
daytona stop [SANDBOX_ID] | [SANDBOX_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--force` | `-f` | Force stop the sandbox using SIGKILL |
| `--help` |  | help for daytona |


## daytona version
Print the version number

```shell
daytona version [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona volume
Manage Daytona volumes

```shell
daytona volume [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona volume create
Create a volume

```shell
daytona volume create [NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--size` | `-s` | Size of the volume in GB |
| `--help` |  | help for daytona |


## daytona volume delete
Delete a volume

```shell
daytona volume delete [VOLUME_ID_OR_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--help` |  | help for daytona |


## daytona volume get
Get volume details

```shell
daytona volume get [VOLUME_ID_OR_NAME] [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--help` |  | help for daytona |


## daytona volume list
List all volumes

```shell
daytona volume list [flags]
```

__Flags__
| Long | Short | Description |
| :--- | :---- | :---------- |
| `--format` | `-f` | Output format. Must be one of (yaml, json) |
| `--help` |  | help for daytona |

## See Also

- [Python SDK](./python-sdk/README.md)
- [TypeScript SDK](./typescript-sdk/README.md)
- [Java SDK](./java-sdk/README.md)
- [Go SDK](./go-sdk/README.md)
- [Ruby SDK](./ruby-sdk/README.md)
