# Web Terminal (TypeScript SDK)

Interact with your sandboxes using a browser-based web terminal.

A web terminal is a terminal emulator that runs in a browser and connects to a shell inside a sandbox. It makes the sandbox usable from any browser, without a local terminal or SSH client.

Daytona provides a web terminal on the sandbox details page of the dashboard. Each tab of the web terminal is an interactive shell running as a [PTY process](./pty.md) inside the sandbox, and its sessions run until their shell exits, the tab is closed, or the sandbox stops.

Use the web terminal to run commands, manage files, run full-screen programs such as `top` and `vim`, and debug a running sandbox from your browser, without installing local tools. For a shell in a local terminal or an IDE, use [SSH access](./ssh-access.md) instead.

## Contents

- [Use cases](#use-cases)
- [Open the web terminal](#open-the-web-terminal)
- [Manage sessions](#manage-sessions)
- [Shell](#shell)
- [Attach to a session](#attach-to-a-session)
- [Permissions](#permissions)

## Use cases

The web terminal gives a person a sandbox shell in the browser, with no local tools.

- **Command execution.** A person runs shell commands in the sandbox from the sandbox details page. On a Linux sandbox whose desktop is neither starting nor ready, the **Terminal** tab opens by default, so opening the sandbox lands in a shell. On Linux and macOS, the shell is the login shell of the sandbox user, or the first of bash, zsh, and sh found on the PATH. On Windows, it is PowerShell.

- **File management.** A person moves through the file system and views and edits files. **Open terminal here** in the **Files** tab starts a shell in the selected folder. Members without the sandbox write permission do not see the **Files** tab.

- **Full-screen programs.** Programs such as `top`, `vim`, and `htop` work as in a local terminal once the image provides them. Resizing the browser window resizes the terminal in the sandbox. Each session starts at 80x24 and is resized to fit the browser viewport right away.

- **Debugging.** A person reads logs, checks processes, and finds the cause of a problem in a running sandbox. The terminal works only while the sandbox is running, so a stopped sandbox must be started first. Stopping or restarting the sandbox ends every shell, and the **Terminal** tab starts a fresh session once the sandbox runs again. An ephemeral sandbox cannot be stopped, and neither can a GPU sandbox: they run until they are deleted.

- **Shells shared with code.** Each session is a PTY process, so the SDK, the CLI, or the API can attach to the same shell. The browser and the attached client share keystrokes and output. A client finds a session by its name, `web-term-` followed by a number.

## Open the web terminal

Open the web terminal to get a shell in a running sandbox from the browser. A terminal emulator in a web page connects to the remote shell and renders its output as a local terminal does.

The web terminal of a sandbox works only while the sandbox is running. Stopping or restarting the sandbox ends every shell of the web terminal.

Use the web terminal to run commands in a sandbox without local tools. A stopped sandbox must be started first, and the **Terminal** tab starts a fresh session once the sandbox runs again. The sandbox details page opens on the **Terminal** tab for a Linux sandbox whose desktop is neither starting nor ready. Linux sandboxes with a starting or ready desktop, and macOS and Windows sandboxes, open on the **Desktop** tab instead.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.com/dashboard/sandboxes)
2. Locate the running sandbox you want to access
3. Click **Open terminal** in the sandbox row, or select the sandbox's **Terminal** tab

### Open a terminal in a directory

Open a terminal in a directory to start a shell with that directory as its working directory. Every process has a working directory, and a shell resolves relative paths from it.

A terminal opened from a folder of a sandbox is a new session, in a new tab of the **Terminal** tab, with the folder as its working directory from the start.

Open a terminal from the **Files** tab when the work concerns one folder. Members without the sandbox write permission do not see the **Files** tab.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.com/dashboard/sandboxes)
2. Open the sandbox and select its **Files** tab
3. Open the actions menu (**⋯**) of a folder
4. Click **Open terminal here**

## Manage sessions

Manage sessions to keep several shells of one sandbox open side by side. A terminal session is one shell with its own input and output, and a terminal application shows each one in a tab.

Web terminal sessions of a sandbox run until their shell exits, the tab is closed, or the sandbox stops, so a page reload reconnects to the existing shells. A shell that exits on its own, such as after a person types the exit command, closes its tab within a few seconds.

Open a session for each task that needs its own shell, and close a session to stop its shell process. Opening the **Terminal** tab on a sandbox with no sessions creates the first session. Pinned tabs stay fixed on the left of the tab strip, cannot be dragged, and are skipped by **Close others**. Tab order, pinned tabs, and the active tab are remembered in your browser per sandbox, so reopening the sandbox restores the same layout.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.com/dashboard/sandboxes)
2. Open the sandbox and select its **Terminal** tab
3. Click **+** to open another session
4. Click a tab to switch to it
5. Drag a tab to reorder it
6. Right-click a tab to close it, close the others, or pin it

## Shell

A shell is the program that reads commands, runs them, and prints their output. A login shell is the shell that an operating system assigns to a user account.

The shell of a web terminal session is the login shell of the sandbox user on Linux and macOS, and PowerShell on Windows. It runs in a PTY whose size follows the browser viewport.

Run full-screen programs such as top, vim, or htop as in a local terminal. Each session starts an interactive shell at 80x24, fits it to the viewport, and resizes it with the browser window or side panel. On Linux and macOS, the shell falls back to the first of bash, zsh, and sh on the PATH of the sandbox. On Windows, the session runs pwsh.exe, or powershell.exe without PowerShell 7.

## Attach to a session

Attach to a session to share a web terminal shell with a program. Several clients attached to one terminal see the same output, and the keystrokes of each client reach the same shell.

Web terminal sessions are PTY processes, named with a web-term prefix and a number that sets the tab title. Clients attached to one session share its shell, keystrokes, and output.

Attach from code to send input to a shell that a person opened in the browser, and to read its output. The web terminal shows only its own sessions as tabs and does not touch PTY sessions started through the SDK or the API. A live session can also be fetched by its name.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.get('{sandboxId}')

const processes = await sandbox.process.list({ kind: 'pty', state: 'running' })
const session = processes.items.find((info) => info.name?.startsWith('web-term-'))
if (!session) throw new Error('no web terminal session')
console.log(`${session.name}: ${session.id} (cwd ${session.cwd})`)

// Attach to the web terminal session by its process id
const handle = sandbox.pty.connect(session.id)
const connection = await handle.attach()
connection.write('echo "Hello from the SDK"\n')
```

| **Parameter** | **Description** |
| --- | --- |
| `process` | Sets the PTY process to connect to.<br />**Required**<br />**Format:** a process ID or a serialized process handle |
| `data` | Sets the input to write to the terminal.<br />**Required**<br />**Example:** `'echo "Hello from the SDK"\n'` |
| `kind` | Filters by process kind.<br />**Value:** `exec`, `pty`, `code`, or `session`<br />**Example:** `'pty'` |
| `state` | Filters by process state.<br />**Default:** `all`<br />**Value:** `running`, `terminal`, or `all`<br />**Example:** `'running'` |

> **Notes:**
>
> - **Prerequisites:** `attach()` opens a WebSocket and needs a global `WebSocket` in the runtime.
> - **Placeholders:** `{sandboxId}` is the ID of the sandbox whose web terminal is open in the dashboard.

## Permissions

The web terminal is governed by the project's sandbox permissions, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md). Terminal access is restricted to authenticated members of your [organization](./organizations.md) whose role grants the sandbox write permission in the project. Members without it do not see the **Terminal**, **Files**, **Desktop**, or **SSH** tabs, or the terminal icon in the sandbox list.

The terminal is served through the toolbox proxy, which authenticates every request with a short-lived token for the sandbox. A public [preview endpoint](./preview.md) does not expose the terminal.

> **Warning:**
>
> The web terminal provides full shell access to your sandbox. Grant the sandbox write permission only to members who should be able to run arbitrary commands in your sandboxes.

| **Permission**        | **Grants**                                                 |
| --------------------- | ---------------------------------------------------------- |
| **`write:sandboxes`** | Open the web terminal, and list and attach to its sessions |
