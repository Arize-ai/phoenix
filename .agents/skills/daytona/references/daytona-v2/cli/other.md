# Other

Reference for the daytona completion, config, docs, and version commands.

## Contents

- [Commands](#commands)
- [daytona completion](#daytona-completion)
- [daytona config](#daytona-config)
- [daytona docs](#daytona-docs)
- [daytona version](#daytona-version)

## Commands

This page documents the following commands. Global flags that apply to every command are listed under [`daytona`](./README.md#daytona).

| Command | Description |
| :------ | :---------- |
| [`daytona completion`](#daytona-completion) | Generate the autocompletion script for the specified shell |
| [`daytona config`](#daytona-config) | Read and change CLI settings |
| [`daytona docs`](#daytona-docs) | Print the command reference (--full: every command, one page) |
| [`daytona version`](#daytona-version) | Print the CLI version and, when reachable, the connected API build identity |

## daytona completion

Generate the autocompletion script for the specified shell

Generate the autocompletion script for daytona for the specified shell.
See each sub-command's help for details on how to use the generated script.

```shell
daytona completion
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona completion bash`](#daytona-completion-bash) | Generate the autocompletion script for bash |
| [`daytona completion fish`](#daytona-completion-fish) | Generate the autocompletion script for fish |
| [`daytona completion powershell`](#daytona-completion-powershell) | Generate the autocompletion script for powershell |
| [`daytona completion zsh`](#daytona-completion-zsh) | Generate the autocompletion script for zsh |

### daytona completion bash

Generate the autocompletion script for bash

Generate the autocompletion script for the bash shell.

This script depends on the 'bash-completion' package.
If it is not installed already, you can install it via your OS's package manager.

To load completions in your current shell session:

```shell
source <(daytona completion bash)
```

To load completions for every new session, execute once:

__Linux__

```shell
daytona completion bash > /etc/bash_completion.d/daytona
```

__macOS__

```shell
daytona completion bash > $(brew --prefix)/etc/bash_completion.d/daytona
```

You will need to start a new shell for this setup to take effect.

```shell
daytona completion bash
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--no-descriptions` |  | `bool` |  | disable completion descriptions |

### daytona completion fish

Generate the autocompletion script for fish

Generate the autocompletion script for the fish shell.

To load completions in your current shell session:

```shell
daytona completion fish | source
```

To load completions for every new session, execute once:

```shell
daytona completion fish > ~/.config/fish/completions/daytona.fish
```

You will need to start a new shell for this setup to take effect.

```shell
daytona completion fish [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--no-descriptions` |  | `bool` |  | disable completion descriptions |

### daytona completion powershell

Generate the autocompletion script for powershell

To load completions in your current shell session:

```shell
daytona completion powershell | Out-String | Invoke-Expression
```

To load completions for every new session, add the output of the above command
to your powershell profile.

```shell
daytona completion powershell [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--no-descriptions` |  | `bool` |  | disable completion descriptions |

### daytona completion zsh

Generate the autocompletion script for zsh

Generate the autocompletion script for the zsh shell.

If shell completion is not already enabled in your environment you will need
to enable it.  You can execute the following once:

```shell
echo "autoload -U compinit; compinit" >> ~/.zshrc
```

To load completions in your current shell session:

```shell
source <(daytona completion zsh)
```

To load completions for every new session, execute once:

__Linux__

```shell
daytona completion zsh > "${fpath[1]}/_daytona"
```

__macOS__

```shell
daytona completion zsh > $(brew --prefix)/share/zsh/site-functions/_daytona
```

You will need to start a new shell for this setup to take effect.

```shell
daytona completion zsh [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--no-descriptions` |  | `bool` |  | disable completion descriptions |

## daytona config

Read and change CLI settings

```shell
daytona config
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona config get`](#daytona-config-get) | Print a setting (confirm) |
| [`daytona config path`](#daytona-config-path) | Print the config directory |
| [`daytona config set`](#daytona-config-set) | Change a setting (confirm true\|false — prompts before destructive verbs) |

### daytona config get

Print a setting (confirm)

```shell
daytona config get <key>
```

### daytona config path

Print the config directory

```shell
daytona config path
```

### daytona config set

Change a setting (confirm true|false — prompts before destructive verbs)

Change a setting.

confirm true|false: whether destructive and billable commands ask for confirmation at a terminal.
It affects prompts only: off a terminal (and with --output json or yaml) those commands always
need --yes or DAYTONA_YES=1.

```shell
daytona config set <key> <value>
```

## daytona docs

Print the command reference (--full: every command, one page)

Prints documentation for the CLI. With --full the entire command tree is
rendered as Markdown on stdout — one page an agent or a human can read in a
single pass. With --dir the same reference is written as one Markdown file per
command. --full and --dir cannot be combined.

```shell
daytona docs [flags]
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--dir` |  | `string` |  | write one Markdown file per command into this directory |
| `--full` |  | `bool` |  | render the whole command tree as one Markdown page |

## daytona version

Print the CLI version and, when reachable, the connected API build identity

```shell
daytona version
```
