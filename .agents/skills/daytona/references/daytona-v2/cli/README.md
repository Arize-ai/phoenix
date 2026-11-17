# CLI

A reference of supported operations using the Daytona CLI.

Daytona provides command-line access to core features for interacting with Daytona Sandboxes, including managing their lifecycle, snapshots, and more.

The CLI reference lists all commands supported by the `daytona` command-line tool, complete with a description of their behavior, and any supported flags.
You can access this documentation on a per-command basis by appending the `--help`/`-h` flag when invoking `daytona`.

## Contents

- [Installation](#installation)
- [Sections](#sections)
- [daytona](#daytona)

## Installation

Install the Daytona CLI to interact with Daytona sandboxes from the command line.

The v2 CLI is released as `2.0.0-alpha.N` versions. The `daytona` Homebrew formula and the `latest` GitHub release install the v0 CLI, so use the commands below.

**Mac:**

```bash
brew install daytonaio/cli/daytona-alpha
```

Trust the tap once so routine `brew upgrade` keeps the Daytona CLI up to date. Recent Homebrew versions require third-party taps to be explicitly trusted; without it, a bare `brew upgrade` skips the Daytona tap and the CLI goes stale:

```bash
brew trust daytonaio/cli
```

To upgrade the Daytona CLI to the latest version:

```bash
brew upgrade daytonaio/cli/daytona-alpha
```

Alternatively, install the Daytona CLI without using Homebrew. The script installs the release set by `--version` after it verifies the release checksum:

```bash
curl -fsSL https://github.com/daytona/clients/releases/download/v2.0.0/install.sh | sh -s -- --version 2.0.0
```

| **Flag** | **Description** |
| --- | --- |
| `--version` | Sets the release to install.<br />**Default:** the highest stable 2.x release, or the highest 2.x pre-release if no stable one exists<br />**Format:** a release version, with or without a leading v<br />**Example:** `2.0.0-alpha.12` |
| `--dir` | Sets the directory to install to.<br />**Default:** /usr/local/bin when it is writable, otherwise ~/.local/bin<br />**Example:** `~/bin` |

**Linux:**

The script installs the release set by `--version` after verifying its checksum. It installs to `/usr/local/bin` when that directory is writable, and to `~/.local/bin` otherwise. Set `DAYTONA_INSTALL_DIR` to choose another directory.

```bash
curl -fsSL https://github.com/daytona/clients/releases/download/v2.0.0/install.sh | sh -s -- --version 2.0.0
```

| **Flag** | **Description** |
| --- | --- |
| `--version` | Sets the release to install.<br />**Default:** the highest stable 2.x release, or the highest 2.x pre-release if no stable one exists<br />**Format:** a release version, with or without a leading v<br />**Example:** `2.0.0-alpha.12` |
| `--dir` | Sets the directory to install to.<br />**Default:** /usr/local/bin when it is writable, otherwise ~/.local/bin<br />**Example:** `~/bin` |

**Windows:**

The script installs the release set by `DAYTONA_VERSION` after verifying its checksum. It installs to `%LOCALAPPDATA%\Daytona\bin` and adds it to your user `PATH`. Then open a new terminal.

```powershell
$env:DAYTONA_VERSION = "2.0.0"; irm https://github.com/daytona/clients/releases/download/v2.0.0/install.ps1 | iex
```

| **Variable** | **Description** |
| --- | --- |
| `DAYTONA_VERSION` | Sets the release to install.<br />**Default:** the highest stable 2.x release, or the highest 2.x pre-release if no stable one exists<br />**Format:** a release version, with or without a leading v<br />**Example:** `2.0.0-alpha.12` |
| `DAYTONA_INSTALL_DIR` | Sets the directory to install to.<br />**Default:** %LOCALAPPDATA%\Daytona\bin<br />**Example:** `C:\Tools\Daytona` |

To install another release, change `--version` or `DAYTONA_VERSION`. Without a version, the scripts install the highest stable 2.x release, or the highest 2.x pre-release if no stable one exists.

After installing the CLI, use the `daytona` command to interact with Daytona sandboxes.

## Sections

The reference groups commands into the following sections. Global flags that apply to every command are listed under [`daytona`](#daytona).

| Section | Commands |
| :------ | :------- |
| [Login and context](./login-and-context.md) | [`daytona login`](./login-and-context.md#daytona-login), [`daytona logout`](./login-and-context.md#daytona-logout), [`daytona profile`](./login-and-context.md#daytona-profile), [`daytona whoami`](./login-and-context.md#daytona-whoami) |
| [Sandboxes and resources](./sandboxes-and-resources.md) | [`daytona cpu-type`](./sandboxes-and-resources.md#daytona-cpu-type), [`daytona image`](./sandboxes-and-resources.md#daytona-image), [`daytona mac-model`](./sandboxes-and-resources.md#daytona-mac-model), [`daytona region`](./sandboxes-and-resources.md#daytona-region), [`daytona reservation`](./sandboxes-and-resources.md#daytona-reservation), [`daytona sandbox`](./sandboxes-and-resources.md#daytona-sandbox), [`daytona snapshot`](./sandboxes-and-resources.md#daytona-snapshot), [`daytona volume`](./sandboxes-and-resources.md#daytona-volume) |
| [Organization management](./organization-management.md) | [`daytona audit`](./organization-management.md#daytona-audit), [`daytona billing`](./organization-management.md#daytona-billing), [`daytona invite`](./organization-management.md#daytona-invite), [`daytona key`](./organization-management.md#daytona-key), [`daytona member`](./organization-management.md#daytona-member), [`daytona org`](./organization-management.md#daytona-org), [`daytona org-key`](./organization-management.md#daytona-org-key), [`daytona project`](./organization-management.md#daytona-project), [`daytona registry`](./organization-management.md#daytona-registry), [`daytona role`](./organization-management.md#daytona-role), [`daytona secret`](./organization-management.md#daytona-secret), [`daytona service-account`](./organization-management.md#daytona-service-account) |
| [Other](./other.md) | [`daytona completion`](./other.md#daytona-completion), [`daytona config`](./other.md#daytona-config), [`daytona docs`](./other.md#daytona-docs), [`daytona version`](./other.md#daytona-version) |

## daytona

Daytona — sandboxes, images, snapshots and your organization, from the terminal

daytona is the command line for the Daytona platform.

At a terminal it is interactive: tables, pickers and a confirmation before
destructive actions. When piped, redirected or run with --output json it is a
strict tool: no prompts, --yes required for destructive verbs, JSON on stdout,
diagnostics on stderr, and an error is one JSON object on stderr.
Authorization is decided by the server; the CLI only presents the credential
you give it.

Get started:

```shell
daytona login                     browser login (or --device on a remote host)
daytona image create py312 --ref python:3.12   import a registry image once
daytona sandbox create --image py312
daytona sandbox exec <id> -- python -c 'print(1)'
daytona sandbox port expose <id> 8080 --public   a preview URL with no credential
daytona docs --full               the whole reference in one page
```

```shell
daytona [flags]
```

__Global flags__

Global flags apply to every command.

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--api-key` |  | `string` |  | static credential sent as-is; disables the saved login for this call (env DAYTONA_API_KEY) |
| `--api-url` |  | `string` |  | API base URL, for test environments (env DAYTONA_V2_API_URL; default https://api.daytona.com) |
| `--debug` |  | `bool` |  | log every request to stderr |
| `--org` |  | `string` |  | organization id or name for this call (env DAYTONA_ORG) |
| `--output` | `-o` | `string` |  | output format: table\|json\|yaml (yml is an alias of yaml; default table at a terminal, json otherwise) |
| `--profile` |  | `string` |  | saved profile to use; it must exist (env DAYTONA_PROFILE) |
| `--project` |  | `string` |  | project id or name for this call (env DAYTONA_PROJECT) |
| `--quiet` | `-q` | `bool` |  | suppress progress and informational output on stderr |
| `--version` | `-v` | `bool` |  | print the CLI version and exit |
| `--yes` | `-y` | `bool` |  | confirm destructive and billable actions; required off a terminal (env DAYTONA_YES=1) |
