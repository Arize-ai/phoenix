# Daytona CLI

Install the Daytona CLI and look up its commands and flags.

The Daytona CLI is a command-line program for managing sandboxes from a terminal or a script. It lets a person, a shell script, or an agent control sandboxes and the organization that owns them without writing code.

Daytona provides the CLI as one binary for Linux, macOS, and Windows. At a terminal it asks for confirmation before destructive actions, and when its output is piped or redirected it never prompts and writes JSON unless another output format is selected. It acts with one credential at a time, and the server decides what that credential may do. Its login and profiles are saved in a configuration directory on the local computer.

Use the CLI to manage sandboxes from a terminal or a shell script, or use the [Python SDK](../python-sdk/README.md), the [TypeScript SDK](../typescript-sdk/README.md), or the [API](../api/README.md) from code. Run any command with --help or -h to print its description and flags. This reference is generated from the source of the CLI and lists every command and flag.

| **Concept** | **Description**                                                                       |
| ----------- | ------------------------------------------------------------------------------------- |
| **Command** | A word that names an action of a command-line program, followed by its arguments.     |
| **Flag**    | A named option, written with leading hyphens, that changes how a command runs.        |
| **Profile** | A saved set of credentials and settings that a command-line program uses for a call. |

## Contents

- [Install the Daytona CLI](#install-the-daytona-cli)
- [Sections](#sections)
- [daytona](#daytona)

## Install the Daytona CLI

Install the Daytona CLI to run its commands on a local computer. An installation places the program in a directory on the search path of the shell.

An installation of the CLI is one binary for the operating system and architecture of the computer. The installer checks that a new binary runs before it replaces the installed one.

Install the CLI with Homebrew on macOS, or with the install script on Linux, macOS, and Windows. The daytona Homebrew formula and the latest GitHub release install the v2 CLI. The scripts verify the release checksum before they install it.

**Homebrew:**

```bash
brew install daytonaio/cli/daytona

# Keep brew upgrade from skipping the tap
brew trust daytonaio/cli

# Upgrade to the latest release
brew upgrade daytonaio/cli/daytona
```

> **Notes:**
>
> - Recent Homebrew versions skip a third-party tap in a bare brew upgrade until the tap is trusted, so trust it once after the install.

**Linux and macOS:**

```bash
curl -fsSL https://github.com/daytona/clients/releases/latest/download/install.sh | sh
```

| **Flag**    | **Description** |
| ----------- | --------------- |
| `--version` | Sets the release to install.<br />**Default:** the highest stable 2.x release, or the highest 2.x pre-release if no stable one exists<br />**Format:** a release version, with or without a leading v<br />**Example:** `2.1.0` |
| `--dir`     | Sets the directory to install to.<br />**Default:** the value of DAYTONA_INSTALL_DIR, otherwise /usr/local/bin when it is writable, otherwise ~/.local/bin<br />**Example:** `~/bin` |

> **Notes:**
>
> - The script prints a note when the install directory is not on your PATH.

**Windows:**

```powershell
irm https://github.com/daytona/clients/releases/latest/download/install.ps1 | iex
```

| **Variable**          | **Description** |
| --------------------- | --------------- |
| `DAYTONA_VERSION`     | Sets the release to install.<br />**Default:** the highest stable 2.x release, or the highest 2.x pre-release if no stable one exists<br />**Format:** a release version, with or without a leading v<br />**Example:** `2.1.0` |
| `DAYTONA_INSTALL_DIR` | Sets the directory to install to.<br />**Default:** %LOCALAPPDATA%\Daytona\bin<br />**Example:** `C:\Tools\Daytona` |

> **Notes:**
>
> - The script adds the install directory to your user PATH, so open a new terminal after it runs.

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
