# SSH Access (TypeScript SDK)

Access your sandboxes over SSH with a sandbox access token or a project API key.

SSH access is encrypted access to a sandbox over the SSH (Secure Shell) network protocol. Terminals, IDEs, and other local tools use it to edit and run code inside the sandbox.

Daytona provides SSH access to sandboxes through a regional SSH gateway, with no software to install in the sandbox. The gateway authenticates each connection with a sandbox access token or a project API key and passes the session to the SSH server in the sandbox.

Use SSH access to connect VS Code or JetBrains IDEs to a sandbox, or to open a shell inside it from your own terminal. To hand SSH access to a person, a CI job, or another tool, give it an SSH token instead of an API key. The token is limited to a single sandbox.

## Contents

- [Use cases](#use-cases)
- [SSH gateway](#ssh-gateway)
- [Connect to a sandbox](#connect-to-a-sandbox)
- [Run commands and transfer files](#run-commands-and-transfer-files)
- [Forward ports](#forward-ports)
- [Connect from an IDE](#connect-from-an-ide)
- [Session environment](#session-environment)
- [Connection lifetime](#connection-lifetime)
- [Host keys](#host-keys)
- [Permissions](#permissions)

## Use cases

SSH access is used when a local tool needs a shell or a TCP connection inside a sandbox.

- **IDE remote development.** VS Code and JetBrains IDEs connect over SSH, then edit and run code in the sandbox. JetBrains Gateway installs the selected IDE in the sandbox. Each IDE takes the SSH command from the dashboard as its connection URL.

- **Local terminals.** A developer opens a shell in the sandbox from their own terminal, with no software installed in the sandbox. Resizing the local window resizes the remote shell. The session has no idle timeout of its own and stays open while the sandbox runs.

- **File transfer.** `scp` and `sftp` copy files between your computer and the sandbox with the standard OpenSSH clients. Relative paths resolve against the working directory, which is the image's `WORKDIR`, or the home directory when the image sets none or sets `/`. A sandbox created with a default user uses that user's home directory instead.

- **Scripts and pipelines.** A one-shot command returns the exit code of the remote command, with stdout and stderr on separate streams. Input piped into `ssh` reaches the remote command. Closing stdin on the client half-closes the remote stdin, so piped commands end once they consume the input.

- **Local service access.** Local port forwarding connects a local port to a database or web server in the sandbox, without exposing it to the internet. The target address resolves inside the sandbox, so `localhost:8080` reaches a service bound there. Remote forwarding with `-R` is not supported.

## SSH gateway

An SSH gateway is a server that accepts SSH connections for many hosts and forwards each session to its destination host. SSH has no equivalent of a bearer header, so the client cannot send a credential next to the connection the way an HTTP client does.

The SSH gateway of a sandbox serves the sandbox's region and stands between the client and the SSH server inside the sandbox. It accepts the SSH handshake without client authentication and authorizes the connection afterwards, so a rejected connection closes right after the handshake instead of failing with a password prompt.

Connect to the regional SSH gateway of the sandbox with the sandbox ID and a credential in the username, joined by a hash character. The credential is a sandbox access token that allows SSH or a project API key. The gateway accepts either the region-tagged sandbox ID that the API returns or the bare UUID. The gateway then proxies the session to the SSH server inside the sandbox, once the credential is valid for that sandbox.

**CLI:**

```bash
ssh -p 2222 '<sandboxId>#<token>'@<sshGatewayHost>
```

| **Flag** | **Description** |
| --- | --- |
| `-p` | Sets the port of the SSH gateway.<br />**Example:** `2222` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be `running`. The credential must be valid and unexpired, belong to the sandbox's project, and allow SSH to it. The sandbox ID must belong to a known sandbox in a region that the gateway serves. The username must hold a `#` separator with a non-empty sandbox ID before it and a non-empty credential after it, and the gateway splits it on the first `#`. The gateway rejects a connection that fails any of these conditions.
> - **Placeholders:** The SSH gateway host differs by region; the examples here use `<sshGatewayHost>` in its place. Use the host that the **SSH** tab of the dashboard shows, or read the values of the ssh_gateway_host and ssh_gateway_port fields from the [sandbox details](#connect-to-a-sandbox).
> - **Recovery:** The SSH server in the sandbox closes connections until it installs its host key, so retry a connection that closes right after the sandbox starts running.

## Connect to a sandbox

Connect to a sandbox to open an SSH session in it from your own computer. An SSH connection runs from a local client to the sandbox and stays open until one side closes it.

An SSH connection to a sandbox runs through the gateway of its region and stays open while the sandbox runs. The credential in the username decides which sandbox it reaches.

Connect to a running sandbox from the dashboard or programmatically. The dashboard builds an SSH command that carries an access token, which allows SSH to the sandbox and expires after 15 minutes. A new token is created each time the **SSH** tab opens, and the token stays masked until you reveal it. The CLI resolves the SSH gateway and runs the system SSH client, and the API returns the host and port of the gateway for the sandbox's region.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.com/dashboard/sandboxes)
2. Locate the sandbox you want to connect to
3. Select **SSH access** in the options menu (**⋮**), or the sandbox's **SSH** tab
4. Click **Reveal token** to show it, or copy the SSH command, which always holds the full token
5. Run the SSH command in your terminal

**CLI:**

```bash
# Interactive shell
daytona sandbox ssh {sandboxId}

# One-shot command
daytona sandbox ssh {sandboxId} uname -a

# Forward a sandbox port to your machine
daytona sandbox ssh {sandboxId} -L 8080:localhost:8080
```

| **Flag** | **Description** |
| --- | --- |
| `-L` | Forwards a local port to an address that resolves inside the sandbox.<br />**Format:** LOCAL_PORT:HOST:PORT<br />**Example:** `8080:localhost:8080` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be running. The OpenSSH ssh client must be on your PATH.
> - **Clients:** SSH flags after the sandbox ID go to ssh before the destination, up to the first argument that does not start with `-` and is not the value of a flag such as -L or -p. Use `--` to end the SSH flags when the remote command itself starts with `-`. The remaining arguments become the remote command.
> - **Behaviour:** The CLI finds the SSH gateway for the sandbox's region and puts your credential in the username.

**API:**

```bash
# Read the SSH gateway endpoint of the sandbox's region
curl 'https://api.daytona.com/sandboxes/{sandboxId}' \
  --header 'Authorization: Bearer YOUR_API_KEY'

# Connect with the gateway host and port from the response
ssh -p 2222 '<sandboxId>#<token>'@<sshGatewayHost>
```

> **Notes:**
>
> - **Prerequisites:** The sandbox must be running.
> - **Order:** Build the SSH command from the ssh_gateway_host and ssh_gateway_port fields of the response, the sandbox ID, and a [sandbox access token](#create-an-ssh-token) or your API key.
> - **Results:** The ssh_gateway_port field is `2222` unless the deployment configures another. Both fields are absent when the region's gateway cannot be resolved.

### Create an SSH token

Create an SSH token to hand SSH access to one sandbox without sharing a project API key. An access token is a credential that grants a limited set of operations for a limited time.

An SSH token is a sandbox access token for one sandbox whose only operation is SSH. It expires at the end of its lifetime and cannot be renewed or revoked.

Give a token instead of a project API key to a person, a CI job, or another tool that needs SSH access. Create a new token when the old one expires.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

const token = await sandbox.createAccessToken({ operations: ['ssh'], ports: [], ttlSeconds: 3600 })
console.log(`ssh -p 2222 '${sandbox.id}#${token.accessToken}'@<sshGatewayHost>`)
```

| **Parameter** | **Description** |
| --- | --- |
| `operations` | Sets the operations the token allows.<br />**Default:** every operation the caller can grant<br />**Value:** `toolbox`, `toolbox:exec`, `toolbox:fs`, `toolbox:git`, `desktop`, `ssh`, `sandbox:stop`, `sandbox:pause`, or `sandbox:delete`<br />**Example:** `['ssh']` |
| `ports` | Sets the private preview ports the token reaches.<br />**Default:** every private preview port of the sandbox<br />**Format:** a list of up to 128 port numbers from 1 to 65535, other than 2280, 2281, and 22220<br />**Value:** `[]` for no private preview port<br />**Example:** `[]` |
| `ttlSeconds` | Sets the token lifetime in seconds.<br />**Default:** the deployment default, `3600` unless the deployment overrides it<br />**Minimum:** `1`<br />**Maximum:** the deployment cap, `86400` by default |

> **Notes:**
>
> - **Placeholders:** Put the access token after the hash character in the SSH username.
> - **Effects:** The empty list of ports limits the token to SSH, and a token created without a list of ports also reaches every private preview port of the sandbox.
> - **Lifetime:** The gateway checks the token only when a connection opens, so an open session stays connected after the token expires, and a new connection with an expired token is refused.

## Run commands and transfer files

Run commands and transfer files to work in a sandbox from your own terminal, scripts, and pipelines. An SSH client runs one command or an interactive shell on the remote host, and file transfer clients copy files over the same protocol.

A session with a sandbox behaves like a session with any other SSH host. The gateway forwards every SSH channel and channel request to the SSH server inside the sandbox.

Run interactive shells, one-shot commands, scp, and sftp with the standard OpenSSH clients. Exit codes are preserved, so one-shot SSH commands can be used in scripts and pipelines. Standard output and standard error arrive as separate streams, so redirecting standard error on the client side works as with any SSH host. Closing stdin on the client half-closes the remote command's stdin, so piped commands terminate once the input is consumed.

**CLI:**

```bash
# Interactive shell
ssh -p 2222 '<sandboxId>#<token>'@<sshGatewayHost>

# One-shot command
ssh -p 2222 '<sandboxId>#<token>'@<sshGatewayHost> uname -a

# Pipe stdin into a remote command
cat ./input.txt | ssh -p 2222 '<sandboxId>#<token>'@<sshGatewayHost> wc -l

# Copy a file into the sandbox
scp -P 2222 ./file.txt '<sandboxId>#<token>'@<sshGatewayHost>:/tmp/

# Interactive file transfer
sftp -P 2222 '<sandboxId>#<token>'@<sshGatewayHost>
```

| **Flag** | **Description** |
| --- | --- |
| `-p` | Sets the port of the SSH gateway for ssh.<br />**Example:** `2222` |
| `-P` | Sets the port of the SSH gateway for scp and sftp.<br />**Example:** `2222` |

## Forward ports

Forward ports to reach a service in a sandbox from your computer. Local port forwarding listens on a local port and carries each connection through the SSH connection to a remote address.

A forwarded port of a sandbox opens a TCP connection inside the sandbox for every connection to the local port. The target address resolves inside the sandbox, so a target on localhost reaches a service in the sandbox, not one on your computer.

Forward a local port with the `-L` flag to reach a database or web server in the sandbox without exposing it to the internet. `-L 8080:localhost:8080` reaches a service bound to `localhost:8080` in the sandbox. A target port with nothing listening is refused with `open failed: connect failed`, and an unresponsive target times out after 10 seconds. To expose a sandbox port to the internet rather than to your computer, use [preview URLs](./preview.md).

**CLI:**

```bash
# Reach a sandbox web server on http://localhost:8080
ssh -p 2222 -N -L 8080:localhost:8080 '<sandboxId>#<token>'@<sshGatewayHost>
```

| **Flag** | **Description** |
| --- | --- |
| `-L` | Forwards a local port to an address that resolves inside the sandbox.<br />**Format:** LOCAL_PORT:HOST:PORT<br />**Example:** `8080:localhost:8080` |
| `-N` | Runs no remote command, so the connection only forwards ports. |
| `-p` | Sets the port of the SSH gateway.<br />**Example:** `2222` |

> **Notes:**
>
> - **Compatibility:** The gateway rejects remote forwarding with `-R`. The gateway does not support Unix socket forwarding with `-L` or `-R` and socket paths. The gateway does not support agent forwarding with `-A`.

## Connect from an IDE

Connect from an IDE to edit and run code in a sandbox with the tools you use locally. An IDE with remote development support opens files and runs code inside a sandbox over an SSH connection, while its window stays on the local computer.

An IDE reaches a sandbox through the same SSH command as a terminal, which it takes as its connection URL. It edits and runs code in the sandbox over that connection.

Use the sections below to connect VS Code or a JetBrains IDE. Each one takes the [SSH command](#connect-to-a-sandbox) from the dashboard as its connection URL.

### VS Code

VS Code is a code editor that works on remote hosts through its Remote - SSH extension. The extension connects the editor to a host over SSH.

VS Code connects to a sandbox over SSH through its Remote - SSH extension, which takes the SSH command of the sandbox as the connection URL.

Connect VS Code to a sandbox with the Remote - SSH extension. For more information on the extension, see the [VS Code Remote SSH documentation ↗](https://code.visualstudio.com/docs/remote/ssh).

1. Install the [Remote - SSH extension ↗](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)
2. Add a new SSH connection
3. When prompted for the SSH connection URL, paste the [SSH command](#connect-to-a-sandbox)

### JetBrains IDEs

JetBrains IDEs are development environments that connect to remote hosts through JetBrains Gateway. Gateway runs on the local computer and opens the IDE on the remote host.

A JetBrains IDE for a sandbox runs inside the sandbox itself. JetBrains Gateway installs the selected IDE in the sandbox and connects to it over SSH.

Connect a JetBrains IDE with JetBrains Gateway and the [SSH command](#connect-to-a-sandbox) of the sandbox.

1. Download [JetBrains Gateway ↗](https://www.jetbrains.com/remote-development/gateway/)
2. Add a new connection
3. When prompted for the SSH connection URL, paste the [SSH command](#connect-to-a-sandbox)
4. Select the IDE to install in your sandbox

## Session environment

A session environment is the shell, the working directory, and the terminal that a remote login starts in. The server that accepts the login sets them up before the first command runs.

An SSH session on a Linux sandbox lands in the SSH server of the sandbox daemon. The session takes its shell and working directory from the sandbox and its image and has no idle timeout.

Set a default user when you create the sandbox, so that every SSH session of the sandbox starts in the login shell and the home directory of that user.

| **Property**          | **Behavior**                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shell**             | The first of `bash`, then `zsh`, listed in the sandbox's `/etc/shells`, or `sh` when neither is listed. A sandbox created with a default `user` uses that user's login shell when it is executable. Interactive sessions and one-shot commands use the same shell. |
| **Working directory** | The image's `WORKDIR`, or the home directory when the image sets none or sets `/`. A sandbox created with a default `user` uses that user's home directory when it exists. One-shot commands run there, and relative `scp` and `sftp` paths resolve against it.  |
| **Terminal**          | Honors `pty-req` and `window-change`, so resizes reach the shell.                                                                                                   |
| **Idle timeout**      | None. The sandbox lifecycle, not the SSH server, ends idle sessions.                                                                                                |

## Connection lifetime

A connection lifetime is the time from the moment a client connects to the moment either side closes the connection. A network failure can end a connection without either side closing it.

An SSH session on a sandbox stays open for as long as the sandbox is running. The gateway closes the client connection promptly when the sandbox stops running or is deleted, and reconnecting with the same command attaches to the sandbox again.

Wrap ssh in a reconnect loop or use autossh for long interactive sessions. SSH traffic counts toward the [idle timeout](./linux-sandboxes.md#timeouts) once the in-sandbox SSH server answers, and then whenever bytes flow from the client into the sandbox. A one-shot command without a terminal keeps the sandbox active while it runs, but an idle shell, or a terminal command that only produces output, does not. Type into the session or reconnect to reset the idle clock.

**CLI:**

```bash
ssh -p 2222 -o ServerAliveInterval=3 -o ServerAliveCountMax=2 '<sandboxId>#<token>'@<sshGatewayHost>
```

| **Flag** | **Description** |
| --- | --- |
| `-o ServerAliveCountMax` | Sets the number of unanswered keepalive messages before the client closes the connection.<br />**Example:** `2` |
| `-o ServerAliveInterval` | Sets the seconds without data from the gateway before the client sends a keepalive message. Set it with ServerAliveCountMax so that the client detects a dead connection quickly.<br />**Example:** `3` |
| `-p` | Sets the port of the SSH gateway.<br />**Example:** `2222` |

## Host keys

A host key is the key that an SSH server proves its identity with. The client stores the server's public key on the first connection and warns when the key changes.

The host key that a client sees for a sandbox belongs to the SSH gateway of its region, not to the sandbox itself. Each gateway presents one stable host key, and the connection from the gateway to the sandbox runs inside the private overlay network.

Treat a host key change warning for a gateway host you have connected to before as suspicious. The known hosts file holds one entry per gateway host and stays valid across sandboxes and gateway restarts. The in-sandbox SSH server is reachable only from the gateway, not from other sandboxes or the internet.

## Permissions

SSH access is governed by the sandbox permissions of the project. You can grant these permissions to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md). Without an API key, a [sandbox access token](./sandboxes.md#create-an-access-token) with the ssh operation grants SSH access to a single sandbox. Only members whose project API key has the sandbox write permission see the **SSH** tab in the dashboard.

Getting the sandbox to connect to requires the sandbox read permission, and a token that also allows the delete operation requires the sandbox delete permission. SSH access is stateless, with no per-sandbox access list. A sandbox access token reaches only its sandbox and only the operations and private preview ports it allows, until it expires. A project API key reaches every sandbox in the project and the API, so prefer a token for SSH.

> **Warning:**
>
> Anyone with the SSH command can access the sandbox while its credential is valid. Treat it like a secret. A sandbox access token stays valid until it expires and cannot be revoked. To cut off access through an API key, revoke or rotate the key on the [API keys](./api-keys.md) page.

| **Permission**        | **Grants**                                                     |
| --------------------- | -------------------------------------------------------------- |
| **`write:sandboxes`** | Connect over SSH with an API key, and create SSH access tokens |
