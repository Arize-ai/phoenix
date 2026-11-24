# Pseudo Terminal (PTY) (Python SDK)

Interact with pseudo terminal sessions in your sandboxes.

A pseudo terminal (PTY) is an interactive terminal session inside a sandbox, with a window size and live input and output, as in a local terminal. Shells, editors, and REPLs that need a real terminal run in it, so an agent or a person drives them interactively.

Daytona runs each PTY session as a process under a virtual terminal inside a sandbox, managed like the other processes described in [process execution](./process-execution.md). A client connects to the session and drives its terminal as a person at a keyboard does.

Use PTY sessions for programs that expect a real terminal, such as REPLs and editors. An agent works in one interactive shell that keeps its working directory and variables between commands. A connected client sends input, reads output, and resizes the terminal while the session runs.

## Contents

- [Use cases](#use-cases)
- [Start PTY session](#start-pty-session)
- [Name PTY session](#name-pty-session)
- [Configure shell, user, and timeout](#configure-shell-user-and-timeout)
- [Connect to PTY session](#connect-to-pty-session)
- [List PTY sessions](#list-pty-sessions)
- [Get PTY session info](#get-pty-session-info)
- [Kill PTY session](#kill-pty-session)
- [Resize PTY session](#resize-pty-session)
- [Send input](#send-input)
- [Read output](#read-output)
- [Replay output from a cursor](#replay-output-from-a-cursor)
- [Wait for completion](#wait-for-completion)
- [Interactive commands](#interactive-commands)
- [Long-running processes](#long-running-processes)
- [Resource management](#resource-management)
- [Permissions](#permissions)

## Use cases

PTY sessions are used when a program expects a real terminal.

- **Interactive development.** REPLs, debuggers, and editors that read keystrokes and redraw the screen run in a PTY session. The virtual terminal gives them a terminal size and line discipline, as a real terminal does. The terminal starts at 80 columns by 24 rows unless the start request sets a size.

- **Terminals in web applications.** A browser terminal connects to a PTY session, sends keystrokes, and resizes the session with the window. On each resize, the program in the terminal receives a window size change signal and can redraw. Browsers authenticate the WebSocket connection with the daytona_token query parameter.

- **Builds and tests.** A PTY session runs compilers, test runners, and deploy tools that show progress or colors only when attached to a terminal. A wait for completion returns its exit code, and the CLI exits with the same code. If the wait time elapses first, the result reports a timeout with no exit code, and the session keeps running.

- **Reconnects.** A client that reconnects replays the output from a cursor and sees what it missed. Every output frame carries a cursor, and a read with a cursor returns only the frames after it. Retention can evict old output, and a cursor into evicted output fails.

- **Terminal agents.** An agent works in one interactive shell that keeps its working directory and variables between commands. It reads the output as a terminal shows it, including escape sequences. When a session timeout elapses, the session is killed and reports that it timed out.

## Start PTY session

Start a PTY session to run a shell or a program in a terminal inside a sandbox. A new terminal session opens a pseudo terminal, starts the program on one end, and leaves the other end to the program that controls it, such as a terminal window.

A PTY session belongs to one sandbox and runs as a process inside it, under a virtual terminal with a size in columns and rows. It runs until its program exits or until it is killed.

Use a PTY session for a shell or a program that expects a terminal: with a command it runs that command, and without one an interactive shell. On Linux and macOS that shell is the user's login shell or the first of bash, zsh, and sh in the image, and on Windows it is PowerShell. The SDKs return a session handle, and the SDK examples below that create no sandbox continue from it.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Without a command the PTY runs an interactive shell; the terminal defaults to 80x24
handle = sandbox.pty.start()
print(handle.id)
```

> **Notes:**
>
> - **Lifetime:** The SDKs keep the record and output of an exited session until it is [deleted](#kill-pty-session).

```python
from daytona import Daytona
from daytona.v2 import TerminalSize

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.pty.start("python3 -i", terminal=TerminalSize(cols=100, rows=40))
```

| **Parameter** | **Description** |
| --- | --- |
| `command` | Sets the command that runs in the terminal.<br />**Default:** an interactive shell<br />**Example:** `"python3 -i"` |
| `cwd` | Sets the working directory of the command.<br />**Example:** `"/tmp"` |
| `env` | Sets environment variables for the command.<br />**Example:** `{"TERM": "xterm"}` |
| `keep_logs` | Sets how long the record and output are kept after the session exits.<br />**Default:** `"until_cleanup"`<br />**Value:** `"until_cleanup"`, `"on_exit_ttl"`, or `"none"`<br />**Example:** `"on_exit_ttl"` |
| `name` | Sets a name that replaces the session ID in requests while the session runs.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, other than a single or double period, entrypoint, or dockerd<br />**Example:** `"dev-shell"` |
| `terminal` | Sets the terminal size in columns and rows.<br />**Default:** `TerminalSize(cols=80, rows=24)`<br />**Minimum:** `1` for cols and rows<br />**Maximum:** `65535` for cols and rows, or `32767` on Windows |

> **Notes:**
>
> - **Behaviour:** The TERM variable is `xterm-256color` unless env sets it.

## Name PTY session

Name a PTY session to reach it by a name instead of its ID. A process name is an alias that programs use to find a process without knowing the identifier that the sandbox assigned to it.

The name of a PTY session belongs to the session only while it runs. When the session exits, the name is released for reuse, and the session stays reachable by its ID only.

Use a name so that another client can reach the session without knowing its ID. Names are unique among live processes, so a second live process with the same name is rejected. While the session runs, its name resolves wherever an ID is accepted.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.pty.start(name="dev-shell")

# Names are unique among live processes and resolve wherever an ID is accepted
info = sandbox.process.get("dev-shell")
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets a name that replaces the session ID in requests while the session runs.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, other than a single or double period, entrypoint, or dockerd<br />**Example:** `"dev-shell"` |

> **Notes:**
>
> - **Lifetime:** The name resolves only while the session runs.

## Configure shell, user, and timeout

Configure the shell, user, and timeout of a PTY session to control what runs in the terminal and for how long. A login shell is the shell that an operating system assigns to a user account, and the user that a process runs as decides which files and commands the process can reach.

A PTY session runs as one operating system user of the sandbox, through one shell. Its timeout bounds the life of the session: when the timeout elapses, the session is killed.

Set these options when the default shell or user does not fit the program, or when a session must not run longer than a set time. A shell that cannot be found or a nonexistent user fails the start. When the timeout elapses, the session is killed and reports a timeout.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.pty.start(
    shell="/bin/bash",  # default: login shell, then bash, zsh, sh (Windows: pwsh.exe, then powershell.exe)
    user="root",  # run as another user
    execution_timeout=600,  # SIGKILL after 10 minutes; wait() reports reason "timed_out"
)
```

| **Parameter** | **Description** |
| --- | --- |
| `execution_timeout` | Sets how many seconds the session can run before Daytona kills it.<br />**Value:** `0` for no limit<br />**Example:** `600` |
| `shell` | Sets the shell that runs the session.<br />**Default:** on Linux and macOS, the login shell of the user, or the first of `bash`, `zsh`, and `sh` in the image, and on Windows, `pwsh.exe`, or `powershell.exe` when PowerShell 7 is missing<br />**Format:** a path, or a name looked up on PATH<br />**Example:** `"/bin/bash"` |
| `user` | Sets the OS user that the session runs as.<br />**Example:** `"root"` |

> **Notes:**
>
> - **Prerequisites:** The user must exist in /etc/passwd of the sandbox.
> - **Compatibility:** On Linux and macOS, a session without a shell runs through the login shell of the user, so a user whose login shell is nologin cannot run commands.

## Connect to PTY session

Connect to a PTY session to drive a terminal that already runs. A client connected to a running terminal sends keystrokes to it and receives its output, as a terminal window does.

A connection to a PTY session is a handle on a session that already runs in the sandbox. A live connection carries the output that the session produces after it opens, and nothing from before.

Connect to a session by its ID to continue work that another client started. Connecting creates a handle without contacting the sandbox. The handle sends input to the session, reads its output, resizes it, and stops it. To see earlier output, [replay it from a cursor](#replay-output-from-a-cursor).

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
process_id = sandbox.pty.start().id

handle = sandbox.pty.connect(process_id)
handle.write_stdin('echo "Reconnected"\n')

# The Python SDK has no WebSocket attach. Use write_stdin() and
# stream_logs() instead.
```

| **Parameter** | **Description** |
| --- | --- |
| `process` | Sets the PTY session that connect() reconnects to.<br />**Required**<br />**Format:** the dict from to_json(), a process ID, or the name of a running process |

> **Notes:**
>
> - **Placeholders:** process_id is the ID of the session, from the handle that started it or from [listing PTY sessions](#list-pty-sessions).

## List PTY sessions

List PTY sessions to find the terminals of a sandbox. A process list shows the processes of a sandbox with their state, so a program can pick one to inspect or stop.

The list of PTY sessions of a sandbox holds the sessions that run and the exited sessions that are still retained, each listed with its own current state.

Use the list to find the ID of a session to [connect to](#connect-to-pty-session). Check the current state of each session in the sandbox before you send it input, resize it, or kill it.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Start a session so that the list has an entry
sandbox.pty.start()

processes = sandbox.pty.list()
for info in processes.items:
    print(f"PTY: {info.id} ({info.state})")
    if info.terminal:
        print(f"  Size: {info.terminal.cols}x{info.terminal.rows}")
    print(f"  Working directory: {info.cwd}")
```

## Get PTY session info

Get PTY session info to read the state of one session. Process information describes a running or exited process: its identifier, its state, and how it ended.

The info of a PTY session describes one session, running or exited.

Use the info to check whether a session still runs, and to read its exit code after it exits. The info holds the state, the process ID, the terminal size, and the working directory of the session, and the exit code of the session once its state is terminal.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
handle = sandbox.pty.start()

info = handle.get()
print(f"PTY: {info.id}")
print(f"State: {info.state}")
print(f"PID: {info.pid}")
if info.terminal:
    print(f"Size: {info.terminal.cols}x{info.terminal.rows}")
print(f"Working directory: {info.cwd}")
if info.state == "terminal":
    print(f"Exit code: {info.exit_code}")
```

## Kill PTY session

Kill a PTY session to stop its processes and remove it. A signal stops a process, or asks the process to stop and leaves the choice to its program.

A signal to a PTY session reaches the processes of the session, including its shell. Removing the session deletes its record and output, and removing a session that still runs kills it first.

Stop a session when you no longer need it. An interactive shell ignores the default termination signal, so a session started without a command keeps running unless the signal escalates to a kill. To stop and remove a session in one step, [delete the PTY session](#delete-a-pty-session).

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
handle = sandbox.pty.start()

# Sends SIGTERM, then SIGKILL after 5 seconds if the session is still running
handle.kill(escalate_after=5)

# Removes the process record and logs
handle.delete()
```

| **Parameter** | **Description** |
| --- | --- |
| `escalate_after` | Sets how many seconds to wait before sending the escalation signal to a session that still runs.<br />**Minimum:** `0`<br />**Maximum:** `600`<br />**Example:** `5` |
| `escalate_to` | Sets the escalation signal.<br />**Default:** `"KILL"`<br />**Value:** `"TERM"`, `"KILL"`, `"INT"`, `"HUP"`, `"QUIT"`, `"USR1"`, or `"USR2"`<br />**Example:** `"QUIT"` |
| `signal` | Sets the signal to send.<br />**Default:** `"TERM"`<br />**Value:** `"TERM"`, `"KILL"`, `"INT"`, `"HUP"`, `"QUIT"`, `"USR1"`, or `"USR2"`<br />**Example:** `"INT"` |

### Delete a PTY session

Delete a PTY session to stop it and remove its record in one step. A delete combines the stop of a process with the removal of what the sandbox kept about it.

A delete of a PTY session ends the session and its record together.

Use a delete when no later step in your program needs the session or its output. A running session gets a termination signal, then the session record and its output are removed. Deleting a process that is not a PTY session fails and leaves it running.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
handle = sandbox.pty.start()

sandbox.pty.delete(handle.id)
```

| **Parameter** | **Description** |
| --- | --- |
| `process` | Sets the PTY session to delete.<br />**Required**<br />**Format:** the dict from to_json(), a process ID, or the name of a running process |

## Resize PTY session

Resize a PTY session to change the columns and rows of its terminal. A terminal reports its size to the program inside it, and full-screen programs fit their screen to that size.

The terminal size of a PTY session is part of the session, and the session record reports it.

Resize a running session when the window that shows it changes size, as a browser terminal does. The program in the terminal receives a window size change signal and can redraw. The session record then reports the new size of the terminal.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
handle = sandbox.pty.start()

handle.resize(150, 40)
```

| **Parameter** | **Description** |
| --- | --- |
| `cols` | Sets the number of terminal columns.<br />**Required**<br />**Minimum:** `1`<br />**Maximum:** `65535`, or `32767` on Windows<br />**Example:** `150` |
| `rows` | Sets the number of terminal rows.<br />**Required**<br />**Minimum:** `1`<br />**Maximum:** `65535`, or `32767` on Windows<br />**Example:** `40` |

> **Notes:**
>
> - **Compatibility:** You can resize only PTY sessions.

## Send input

Send input to a PTY session to type into its terminal from a program. A terminal passes the bytes it receives to the program in it, as if a person typed them.

Input to a PTY session reaches its terminal as typed keystrokes, and control keys are single bytes. The terminal has no separate signal for the end of input.

End each command with a newline, as a person presses Enter after a command. Send Ctrl+C as 0x03 and Ctrl+D as 0x04. To signal the end of input, send Ctrl+D.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
handle = sandbox.pty.start()

handle.write_stdin("ls -la\n")
```

| **Parameter** | **Description** |
| --- | --- |
| `data` | Sets the input to send to the terminal.<br />**Required**<br />**Format:** a str, or bytes<br />**Example:** `"ls -la\n"` |

## Read output

Read output to get what a PTY session wrote to its terminal. Terminal output is a stream of bytes that holds text and the escape sequences that set colors and move the cursor.

The output of a PTY session is kept with the session as a sequence of frames, and each frame carries its own cursor. Retention can evict old output.

Read the output to see what a session printed. A read returns one page of up to 1,000 frames by default, and the server clamps the page size that a read requests to between 1 and 5,000 frames. To read past the first page, [replay output from a cursor](#replay-output-from-a-cursor).

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
handle = sandbox.pty.start()

page = handle.logs()
for frame in page.items:
    print(frame.data, end="")
```

| **Parameter** | **Description** |
| --- | --- |
| `encoding` | Sets the encoding of the frame data.<br />**Default:** `"text"`<br />**Value:** `"text"` or `"base64"`<br />**Example:** `"base64"` |
| `limit` | Sets the number of log frames in a page.<br />**Default:** `1000`<br />**Value:** `1` to `5000`, with other values clamped to that range |

> **Notes:**
>
> - **Results:** In text encoding, bytes that are not valid UTF-8 are replaced, and in base64 encoding, the raw bytes are returned unchanged as standard padded base64. A read without a cursor starts at the first frame that the session wrote, so once retention has evicted that frame, read from first_available_cursor instead.

## Replay output from a cursor

Replay output from a cursor to continue reading where an earlier read stopped. A cursor marks a position in a stream, so a reader that stores it resumes there instead of from the start.

An output frame of a PTY session carries a cursor, and a read with a cursor returns the frames after it. Retention can evict old output from the session.

Replay from the last cursor a client processed to resume without gaps or duplicates, such as after a reconnect. A cursor that points into evicted output fails, and the error carries the oldest cursor still available. For how long output is kept, see [log retention](./log-streaming.md#log-retention).

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
handle = sandbox.pty.start("ls -la")
handle.wait(timeout=30)

# Read the first frame and keep its cursor
cursor = handle.logs(limit=1).items[0].cursor

# Every frame carries a cursor; reading resumes strictly after it. An empty page means the read has caught up
while True:
    page = handle.logs(cursor=cursor)
    if not page.items:
        break
    for frame in page.items:
        print(frame.data, end="")
        cursor = frame.cursor
```

| **Parameter** | **Description** |
| --- | --- |
| `cursor` | Sets the cursor that the read continues after.<br />**Format:** a log cursor |

## Wait for completion

Wait for completion to block until a PTY session exits. A program that waits for a process learns when the process ended and how, from its exit code or from the signal that stopped it.

A wait on a PTY session ends when the session exits or when the wait time elapses. The wait itself does not stop the session or change its state.

Wait for the session before a step that needs its result, such as the exit code of a build that must pass. The result holds the exit code, the ending signal if any, and a reason: exited, killed by a signal, timed out, failed to start, or lost. If the wait time elapses first, the result reports a timeout with no exit code, and the session keeps running.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
handle = sandbox.pty.start("ls -la")

result = handle.wait(timeout=30)
print(result.reason, result.exit_code)
```

| **Parameter** | **Description** |
| --- | --- |
| `timeout` | Sets how many seconds wait() waits for the session to exit.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `30` |

> **Notes:**
>
> - **Timeouts:** If the wait time elapses first, the reason is `timed_out` with no signal; the session keeps running.

## Interactive commands

Interactive commands are commands that a person or a program types into a running shell one after another. The shell runs each command and prints a prompt for the next one.

An interactive shell in a PTY session keeps its state between commands, such as the working directory and variables. The state lasts as long as the shell runs.

Run several commands in one interactive shell when a command depends on the state that earlier commands left. Read the output in parallel while you send input. The output stream ends after the shell exits and all of its output is delivered.

```python
import threading

from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.pty.start()

# Print output in the background
def pump():
    for event in handle.stream_logs():
        if event.type == "log":
            print(event.frame.data, end="")

reader = threading.Thread(target=pump, daemon=True)
reader.start()

for command in [
    "pwd",
    "ls -la",
    "echo 'Hello from PTY'",
    "python3 -c 'print(2 + 2)'",
    "exit",
]:
    handle.write_stdin(command + "\n")

result = handle.wait()
reader.join(timeout=5)
print(f"\nShell exited with code: {result.exit_code}")
handle.delete()
```

## Long-running processes

A long-running process is a command that runs until it finishes or until something interrupts it, such as a server or a loop. In a terminal, Ctrl+C interrupts the command in the foreground.

Ctrl+C as input to a PTY session goes through its terminal and interrupts the foreground command, and the shell keeps running. A signal to the session also reaches the shell.

Interrupt a running command with Ctrl+C to get the shell back without ending the session. To end the whole session including its shell, see [kill PTY session](#kill-pty-session).

```python
import time

from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.pty.start()
handle.write_stdin("for i in $(seq 1 100); do echo \"Line $i\"; sleep 1; done\n")

time.sleep(5)
handle.write_stdin("\x03")  # Ctrl+C
handle.write_stdin("exit\n")

result = handle.wait()
for frame in handle.logs().items:
    print(frame.data, end="")
print(f"\nExit code: {result.exit_code}")
handle.delete()
```

## Resource management

Resource management is the cleanup of what a program holds, such as processes, once the program no longer needs it. A cleanup in a final block runs even when a step fails.

An exited PTY session stays in the sandbox as a record with its output. The record and the output last until the session is deleted or its retention ends.

Remove a PTY session when you no longer need it. The SDKs keep the record and output of exited sessions until they are deleted, so delete the session in a final block.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.pty.start()
try:
    handle.write_stdin("echo hello\n")
    handle.write_stdin("exit\n")
    handle.wait(timeout=10)
finally:
    handle.delete()
```

## Permissions

A PTY session runs through the toolbox of a sandbox. Access is governed by one project permission, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

A [sandbox access token](./sandboxes.md#create-an-access-token) with the toolbox:exec operation grants the same access to a single sandbox, without an API key. The sandbox read permission alone does not grant toolbox access.

| **Permission**        | **Grants**                                       |
| --------------------- | ------------------------------------------------ |
| **`write:sandboxes`** | Start, connect to, resize, and kill PTY sessions |
