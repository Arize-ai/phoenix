# Process Execution (Python SDK)

Run shell commands and manage long-running processes in your sandboxes.

Process execution is the running of shell commands and programs inside a sandbox, from one-off commands that return an exit code to long-running servers in the background. A package install, a build, or a tool call of an agent changes the sandbox and not the host that sent it.

Daytona runs shell commands and long-running processes in sandboxes, isolated from the application that sends them. A command runs and returns its result, or starts in the background and keeps running while the application controls it. Sessions keep the working directory and environment variables across the commands that run in them.

Use process execution to install packages, build, and run tests, give an agent shell commands as tools, and run servers and workers in the background. To run Python, TypeScript, and JavaScript code, see [code execution](./code-execution.md). For interactive terminals, see [pseudo terminal (PTY)](./pty.md). For real-time logs from long-running processes, see [log streaming](./log-streaming.md).

## Contents

- [Use cases](#use-cases)
- [Command execution](#command-execution)
- [Process control](#process-control)
- [Session operations](#session-operations)
- [Resource management](#resource-management)
- [Permissions](#permissions)

## Use cases

Process execution is used for shell commands and programs rather than code snippets.

- **Build and test.** Package installs, compilers, and test runners run in the sandbox, and their exit code and output return to the application. When a run times out, the result has no exit code and the command keeps running. The result holds stdout, stderr, and the output of both channels in recorded order.

- **Agent tools.** An agent runs shell commands as tools and reads their results. The commands run inside the sandbox, isolated from the application that hosts the agent. Python, TypeScript, and JavaScript snippets run through code execution instead.

- **Servers and workers.** A web server or worker starts as a background process, and the application checks its state, reads its logs, or stops it through its handle. By default, a process keeps its record and logs for 10 to 11 minutes after it exits. A process started through the API with a name keeps them until it is deleted. A retention option overrides either default.

- **Multi-step shell work.** A session keeps the working directory and environment variables, so a sequence of commands runs as it does in one terminal. Commands in a session run one at a time and in order. A session survives pause and resume, but not stop and start.

- **Reconnects.** An application reconnects to a process it started earlier and continues to read its output. Any client with the sandbox ID and the process ID can wait for the process, read its logs, or stop it. A process name resolves only while the process runs, and the ID still works after it exits.

## Command execution

Command execution is the running of a single command until it exits, with its exit code and output returned to the program that sent the command. The caller waits for the result and acts on it, for example by stopping a build when a test fails.

A command in a sandbox runs as an ordinary process inside the sandbox, isolated from the application that sends it. Its exit code and output return to the application when it exits.

Use command execution for work that finishes, such as installs, builds, and tests. To keep a program running while the application does other work, [start a background process](#start-a-background-process). To keep the shell state between commands, run the commands in a [session](#session-operations).

### Execute commands

Execute a command to run it to completion and get its result. A command is a line of shell input that starts a program, and the program reports success or failure through its exit code.

An executed command in a sandbox holds the caller until the command exits or the wait time elapses. A command that still runs when the wait time elapses keeps running in the sandbox.

Use command execution for commands that finish in a known time, such as installs and tests. The result holds the exit code, stdout, stderr, and the output of both channels in recorded order. When the wait time elapses first, the result has no exit code and the command keeps running, so [wait for the process](#wait-for-a-process) and read its logs separately.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

response = sandbox.process.run("ls -la")
print(response.exit_code, response.stdout)
```

| **Parameter** | **Description** |
| --- | --- |
| `timeout` | Sets how many seconds run() waits for the command to exit.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `60` |

### Set the user and shell

Set the user and shell to control which account runs a command and which program interprets it. An operating system user owns the processes it starts, and a shell is the program that parses a command line and starts the programs that it names.

A command in a sandbox runs as a user of its image, under a shell from that image.

Set the user to run a command as a specific account, and set the shell when the command needs the syntax of a specific shell. The user must exist in the image, and the shell must be installed in it. The CLI has no shell setting, so run the shell as the program instead.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

response = sandbox.process.run("whoami", user="nobody", shell="bash")
print(response.output)
```

| **Parameter** | **Description** |
| --- | --- |
| `shell` | Sets the shell that runs the command.<br />**Default:** `bash`, or `sh` if bash is not installed<br />**Format:** a path, or a name looked up on PATH<br />**Example:** `"sh"` |
| `user` | Sets the OS user that runs the command.<br />**Example:** `"nobody"` |

> **Notes:**
>
> - **Prerequisites:** The user must exist in the image, and the shell must be installed in it.

### Update the environment

Update the environment to change the variables that new processes start with. Environment variables are named values that a process inherits from the process that starts it, and programs read them for settings such as paths and log levels.

The environment of a sandbox applies to every process that starts in it after the update. Processes and sessions that already run keep the environment they started with.

Update the environment to set or remove variables for later commands, PTYs, sessions, and the git commands that [git operations](./git-operations.md) run. Removing a variable affects variables set through an earlier update or when the sandbox was created, and variables defined by the image stay.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Processes started after this call inherit the change
sandbox.update_env({"LOG_LEVEL": "debug"}, unset=["HTTP_PROXY"])

response = sandbox.process.run("echo $LOG_LEVEL")
print(response.stdout)
```

| **Parameter** | **Description** |
| --- | --- |
| `env` | Adds or replaces environment variables.<br />**Maximum:** under 128 KiB per KEY=VALUE entry, 1 MiB for all variables added to the sandbox, and for the whole environment 32,767 UTF-16 characters on Windows or 512 KiB on macOS<br />**Format:** non-empty names without =, NUL, or line breaks, not starting with RLP_ or DAYTONA_, and values without NUL<br />**Rules:** no name that is also in unset<br />**Example:** `{"LOG_LEVEL": "debug"}` |
| `unset` | Removes environment variables set by an earlier update or when the sandbox was created.<br />**Format:** names in the same format as in env<br />**Rules:** no name that is also in env<br />**Example:** `["HTTP_PROXY"]` |

> **Notes:**
>
> - **Compatibility:** The names starting with DAYTONA_ that an update accepts are DAYTONA_SANDBOX_TOKEN, DAYTONA_API_URL, DAYTONA_OTEL_ENDPOINT, DAYTONA_DOCKER_START, DAYTONA_FN_PORT, and DAYTONA_FN_HANDLER.

### Execute interactive commands

Execute an interactive command to send it input while it runs. Standard input, or stdin, is the stream a program reads its input from, and closing it signals the end of the input.

An interactive command in a sandbox starts with its standard input open and accepts input only while it runs. A command that has exited no longer accepts input.

Use an interactive command for programs that read their input from stdin, such as filters. Start the command with stdin open, write input to it, and close stdin when the command has received all of its input. The CLI writes piped input to the command and then ends the input. For an interactive terminal, use a [pseudo terminal (PTY)](./pty.md) instead.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.process.start("tr a-z A-Z", stdin="open")

# Send input to the command, then end it
handle.write_stdin("hello\n")
handle.close_stdin()

wait = handle.wait()
page = handle.logs()
for frame in page.items:
    print(f"[{frame.channel}]: {frame.data}")
print(wait.exit_code)
```

| **Parameter** | **Description** |
| --- | --- |
| `stdin` | Sets whether the command accepts input after it starts.<br />**Default:** `"closed"`<br />**Value:** `"open"` or `"closed"`<br />**Example:** `"open"` |

> **Notes:**
>
> - **Order:** Write the input and close stdin while the command runs; an exited process accepts no input.

## Process control

Process control is the management of a program after it starts, while it runs in the background. The program that started a process keeps its identifier and uses it to observe or end the process.

A process in a sandbox runs inside the sandbox and is not tied to the client that started it. Its state stays readable after it exits for as long as the sandbox keeps its record, and its output stays readable for as long as its log retention policy allows.

Use process control for servers, workers, and long jobs that run while the application does other work. Start with [start a background process](#start-a-background-process), then [wait for the process](#wait-for-a-process), [stop the process](#stop-a-process), or [reconnect to the process](#reconnect-to-a-process) from another worker or process.

### Start a background process

Start a background process to run a program without waiting for it to exit. A background process runs alongside the program that started it, which goes on with other work.

A background process in a sandbox runs until it exits or is stopped. How long its record and logs stay after it exits depends on its log retention policy.

Use a background process for servers, workers, and long builds. The SDKs return a handle that waits for the process, reads its logs, and stops it. Give related processes a tag to [list](#list-processes) them and [stop them by tag](#stop-processes-by-tag) as one group. The CLI does not start background processes, and its process commands take the ID of an existing process, which [list processes](#list-processes) returns.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.process.start("python -m http.server 8000", tag="web")
print(handle.id)
```

| **Parameter** | **Description** |
| --- | --- |
| `tag` | Groups the process with others for [listing](#list-processes) and [stopping by tag](#stop-processes-by-tag).<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, other than a single or double period<br />**Example:** `"web"` |

### List processes

List processes to see what runs in a sandbox and what has finished. A process list shows the processes of a sandbox at one moment, with the ID and state of each.

The process list of a sandbox covers its running and finished processes. Commands that run in sessions appear in the list as processes of their own.

List processes to find the ID of a process that another client started, or to check what still runs. Filter the list by state, kind, session, name, PID, or tag. Without a state filter, the list holds processes in every state. A name filter matches every retained process that was started with that name, including processes that have already exited.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

running = sandbox.process.list(state="running")
for info in running.items:
    print(info.id, info.name, info.state, info.pid)

# Only the processes started with the tag
web = sandbox.process.list(tag="web")
```

| **Parameter** | **Description** |
| --- | --- |
| `state` | Filters by state.<br />**Default:** `"all"`<br />**Value:** `"running"`, `"terminal"`, or `"all"`<br />**Example:** `"running"` |
| `tag` | Filters by tag.<br />**Example:** `"web"` |

### Process states

Process states are the stages a process passes through from its creation to its end. A finished process records how it ended, such as a normal exit with an exit code or a stop by a signal.

A process in a sandbox has a record from the moment it is requested, before it runs, and the record keeps the final state of the process after it finishes.

Check the state and the reason of a process to tell a normal exit from a stop, a timeout, or a failure. A process that has ended is in the terminal state, and its reason says how it ended.

| **State**          | **Meaning**                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| **`starting`**     | The record exists; the process has not been spawned yet. A command in a session stays in this state while the commands ahead of it finish. A [code execution](./code-execution.md) stays in it while its language kernel is installed and started, with progress reported on the `setup` log channel. |
| **`provisioning`** | Reserved. The API and the SDK types define this state, and no process enters it.                      |
| **`running`**      | The process has a PID and is executing.                                                               |
| **`terminal`**     | The process has finished. `reason`, `exitCode`, and `signal` describe how.                            |

| **Reason**      | **Meaning**                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| **`exited`**    | Exited on its own; `exitCode` is set. A code execution that raised an exception exits with `1`.               |
| **`signaled`**  | Killed by a signal; `signal` is set. The SDKs and the CLI report bare names (`TERM`, `KILL`), and the API reports `SIGTERM`, `SIGKILL`. |
| **`timed_out`** | The `timeoutMs` set at start elapsed and the process was stopped. A standalone process reports `signal` as `SIGKILL`, and a command in a session reports no signal. Also returned by `wait` itself when its own long-poll window elapses first, with no `exitCode`. |
| **`lost`**      | The process disappeared without the daemon observing its exit, for example after a sandbox stop and start, or when its session was deleted while it was still running. |
| **`failed`**    | The process could not be started or ran into a daemon-side error.                                             |

### Log retention

Log retention is the period for which a sandbox keeps the output and the run record of a program after it ends. A longer period keeps the output readable later and uses more storage.

The log retention of a process in a sandbox is set when the process starts. Once the record of a process is removed, the process can no longer be waited on or read.

Choose how long the record and logs of a process are kept after it exits. Keep them until cleanup when the logs must stay readable, and discard the logs when only the exit result matters. For the size caps and the eviction of retained output, see [log streaming](./log-streaming.md#log-retention).

| **Policy**          | **Behavior**                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **`until_cleanup`** | Kept until the process is deleted (`DELETE /processes/{id}`). Default for API requests that set `name`, for sessions, and for the SDK `pty` namespace. |
| **`on_exit_ttl`**   | Kept for 10 to 11 minutes after exit, then removed. Default for API requests without `name`, other than sessions, and for the SDK `start` and `run` methods. The `run` method does not accept `none`. |
| **`none`**          | Logs are discarded as soon as the process exits and can no longer be read. The record is kept for the same 10 to 11 minutes, so `wait` still returns the exit result. |

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Keep the record and logs until delete() is called
handle = sandbox.process.start("pip list", keep_logs="until_cleanup")
handle.wait()

for frame in handle.logs().items:
    print(frame.data, end="")
handle.delete()
```

| **Parameter** | **Description** |
| --- | --- |
| `keep_logs` | Sets how long the record and logs are kept after the process exits.<br />**Default:** `"on_exit_ttl"`<br />**Value:** `"until_cleanup"`, `"on_exit_ttl"`, or `"none"`<br />**Example:** `"until_cleanup"` |

### Wait for a process

Wait for a process to get its result once it finishes. A wait holds the caller until the process ends or a time limit passes, and then reports how the process ended.

A wait on a process in a sandbox returns the exit result of the process and does not end the process. A wait that times out leaves the process running.

Wait for a process before a step that needs its result. Without a timeout, the SDKs wait until the process ends, the API waits 60 seconds, and the CLI waits 10 minutes. If the wait time elapses first, the result has the timed-out reason and no exit code, and the process keeps running.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.process.start("pip install requests")

# Wait up to 2 minutes; without timeout, wait() blocks until the process is terminal
result = handle.wait(timeout=120)
print(result.reason, result.exit_code)
```

| **Parameter** | **Description** |
| --- | --- |
| `timeout` | Sets how many seconds wait() waits for the process to exit.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `120` |

### Stop a process

Stop a process to end it before it finishes. A signal is a message the operating system sends to a process. Most programs exit on the terminate signal, and the kill signal ends a process at once.

A stopped process in a sandbox ends in the terminal state and records the signal that stopped it.

Stop a process when its work is done or it no longer responds. The SDKs send the terminate signal by default. For a process that ignores it, set an escalation signal, sent if the process still runs after a wait of up to 10 minutes. The escalation signal is the kill signal by default.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.process.start("python -m http.server 8000")

# Sends SIGTERM
handle.kill()
```

| **Parameter** | **Description** |
| --- | --- |
| `escalate_after` | Sets how many seconds to wait before sending the escalation signal to a process that still runs.<br />**Minimum:** `0`<br />**Maximum:** `600`<br />**Example:** `5` |
| `escalate_to` | Sets the escalation signal.<br />**Default:** `"KILL"`<br />**Value:** `"TERM"`, `"KILL"`, `"INT"`, `"HUP"`, `"QUIT"`, `"USR1"`, or `"USR2"`<br />**Example:** `"QUIT"` |
| `signal` | Sets the signal to send.<br />**Default:** `"TERM"`<br />**Value:** `"TERM"`, `"KILL"`, `"INT"`, `"HUP"`, `"QUIT"`, `"USR1"`, or `"USR2"`<br />**Example:** `"INT"` |

### Stop processes by tag

Stop processes by tag to end a group of related processes in one call. A tag is a label attached to related processes, so that they can be found and handled as one group.

A stop by tag in a sandbox reaches every process started with the tag and everything those processes started. The stop also includes descendants that detached from them and the survivors of tagged processes that already exited.

Stop processes by tag when a task that started several processes ends. The call returns once none of them is still running, with the IDs of the tagged processes it stopped. Processes whose records were deleted or expired are stopped too but not listed, so an empty list does not mean that nothing was stopped. The call does not delete the records or logs, which stay for as long as the log retention setting of each of the processes allows.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

sandbox.process.start("python -m http.server 8000", tag="web")
sandbox.process.start("python -m http.server 8001", tag="web")

stopped = sandbox.process.kill_all(tag="web", timeout=30)
print(stopped)
```

| **Parameter** | **Description** |
| --- | --- |
| `tag` | Sets the tag of the processes to stop. The tag can be used again right after the call.<br />**Required**<br />**Example:** `"web"` |
| `timeout` | Sets how many seconds the call waits for the processes to exit.<br />**Default:** `10`<br />**Minimum:** more than `0`<br />**Maximum:** `60` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be a Linux sandbox with process containment.
> - **Recovery:** The call is safe to repeat when processes under the tag are still running at the timeout, or when another start or stop under that tag is still in progress.

### Reconnect to a process

Reconnect to a process to control it from a client other than the one that started it. Reconnecting attaches a new client to a running process through an identifier that the first client kept.

A reconnected client reaches the same process in the sandbox as the client that started it, and reads the output that the process has written so far.

Reconnect from another worker or process to wait for a process, read its logs, or stop it. Processes are addressed by ID, so any client with the sandbox ID and the process ID can reconnect. A process name resolves only while the process runs, and the ID still works after it exits. To reconnect to an interpreter context, see [reconnect to a context](./code-execution.md#reconnect-to-a-context).

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Worker A: start the process and persist the handle
handle = sandbox.process.start("pip install requests")
saved = handle.to_json()  # {"sandboxId": "...", "processId": "...", "kind": "exec"}

# Worker B: reconnect and wait for the same process
handle = sandbox.process.connect(saved)
result = handle.wait()
```

| **Parameter** | **Description** |
| --- | --- |
| `process` | Sets the process that connect() reconnects to.<br />**Required**<br />**Format:** the dict from to_json(), a process ID, or the name of a running process |

> **Notes:**
>
> - **Lifetime:** A process name resolves only while the process runs, so reconnect by ID after it exits.
> - **Clients:** `connect()` sends no request.

### Entrypoint process

An entrypoint process is the program that an image names to run when a sandbox starts from it. An image names it so that every instance started from the image runs the same program first.

The entrypoint of a sandbox is a system process, read like any other process but not changed.

Get the details and logs of the entrypoint process to see what the sandbox started with and what it wrote. The entrypoint process cannot be signaled, written to, or deleted. The SDKs, the CLI, and the API also read the entrypoint logs that the control plane stores.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Entrypoint process details
info = sandbox.process.get("entrypoint")
print(f"Command: {info.argv or info.shell_command}")

# Entrypoint logs
handle = sandbox.process.connect("entrypoint")
for frame in handle.logs().items:
    print(f"[{frame.channel}]: {frame.data}")

# Control-plane entrypoint logs
print(sandbox.entrypoint_logs())
```

## Session operations

A session is a long-lived shell that runs the commands sent to it. Its commands run one at a time, in order, and share shell state, such as the working directory, exported variables, and functions.

A session in a sandbox is a long-running shell process, and each command in it is an ordinary process with its own logs and exit code. Interrupting a command stops only that command, and the session keeps running. A session survives pause and resume, but not stop and start.

Use a session for multi-step shell work that depends on the state that earlier commands leave. For parallel commands, use separate sessions or [background processes](#start-a-background-process) instead. Each command in a session has its own timeout and receives its own signals. To run code in a language kernel instead of a shell, use [interpreter contexts](./code-execution.md#interpreter-contexts).

### Create a session

Create a session to get a shell that keeps its state across commands. A shell starts with a working directory and a set of environment variables, and the commands it runs inherit both.

A session in a sandbox applies its working directory and environment variables to its commands.

Create a session for commands that share state. Give the session a name to address it by that name instead of its ID while it runs. The CLI does not create sessions or run commands in them, and its process commands take the ID of an existing session, which [list sessions](#list-sessions) returns.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

session = sandbox.process.create_session(cwd="/tmp", env={"CI": "1"}, name="build-session")
print(session.id)
```

| **Parameter** | **Description** |
| --- | --- |
| `cwd` | Sets the working directory of the shell.<br />**Default:** the sandbox's default working directory<br />**Example:** `"/tmp"` |
| `env` | Sets environment variables for the shell.<br />**Example:** `{"CI": "1"}` |
| `login` | Starts the shell as a login shell. |
| `name` | Sets a name that replaces the session ID in requests while the session runs.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, other than a single or double period, entrypoint, or dockerd<br />**Example:** `"build-session"` |
| `shell` | Sets the shell of the session.<br />**Default:** `bash`, or `sh` if bash is not installed<br />**Format:** a path or name of a POSIX shell<br />**Value:** `bash`, `sh`, `dash`, `zsh`, or `ksh`<br />**Example:** `"zsh"` |
| `tag` | Sets the tag that every command in the session takes.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, other than a single or double period<br />**Example:** `"build"` |

> **Notes:**
>
> - **Prerequisites:** The shell must be installed in the image.

### Execute session commands

Execute session commands to run a sequence of commands in the same shell. A shell keeps the changes that one command makes, such as a new working directory or an exported variable, and the next command that runs in the shell sees them.

A command in a session of a sandbox waits until the commands ahead of it finish, then runs in the shell of the session, with the settings of the session.

Execute session commands when each step depends on the shell state that the steps before it set. A command timeout starts when the command starts, after any commands queued ahead of it. When the timeout elapses, Daytona stops the command, and the session continues. If the command still runs 5 seconds later, Daytona ends the session and its background processes.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

with sandbox.process.create_session() as session:
    # Shell state persists between commands
    session.run("cd /tmp && export STAGE=dev")
    result = session.run("pwd && echo $STAGE", execution_timeout=30)
    print(result.stdout)

    # Interrupt one command; the session keeps running
    command = session.start("sleep 600")
    command.kill(signal="INT")
```

| **Parameter** | **Description** |
| --- | --- |
| `execution_timeout` | Sets how many seconds the command can run before Daytona stops it.<br />**Value:** `0` for no limit<br />**Example:** `30` |
| `name` | Sets a name for the command process.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, other than a single or double period, entrypoint, or dockerd<br />**Example:** `"print-stage"` |
| `timeout` | Sets how many seconds run() waits for the command to exit.<br />**Default:** no limit<br />**Value:** `0` for no limit<br />**Example:** `60` |

### Reconnect to a session

Reconnect to a session to run commands in it from a client other than the one that created it. Reconnecting attaches a new client to a running shell through an identifier the first client kept.

A reconnected client works in the same session shell in the sandbox, with the working directory and variables that earlier commands in the session left.

Reconnect from another worker to continue multi-step shell work. Sessions are addressed by ID, so any client with the sandbox ID and the session ID can run commands in the session and read its status. Reconnecting sends no request, and the next call on the session does.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Worker A: create the session and persist it
session = sandbox.process.create_session()
session.run("cd /tmp")
saved = session.to_json()  # {"sandboxId": "...", "sessionId": "..."}

# Worker B: reconnect and run in the same shell
session = sandbox.process.connect_session(saved)
result = session.run("pwd")
```

| **Parameter** | **Description** |
| --- | --- |
| `session` | Sets the session that connect_session() reconnects to.<br />**Required**<br />**Format:** the dict from to_json(), or a session ID |

> **Notes:**
>
> - **Clients:** Reconnect through the process module of the sandbox that the session belongs to.

### Get session status

Get session status to see whether a session still runs and where its shell works. A shell tracks its current working directory, which changes with each command that changes directory.

The status of a session in a sandbox reflects its shell at the time of the request, including the state and the current working directory of the shell.

Get the status of a session before a command that depends on its working directory, and list its commands to review what it ran. List the commands with the session filter of [list processes](#list-processes), which returns each command together with its exit code.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
session = sandbox.process.create_session()
session.run("cd /tmp")

info = session.get()
print(info.state, info.cwd)

listed = sandbox.process.list(session_id=session.id)
for proc in listed.items:
    print(f"Process: {proc.id}, Command: {proc.shell_command}, Exit Code: {proc.exit_code}")
```

| **Parameter** | **Description** |
| --- | --- |
| `session_id` | Filters by the session that the processes ran in. |

### List sessions

List sessions to find the shell sessions in a sandbox and their states. A session list is a process list narrowed to shells, with the ID and state of each.

A session in a sandbox is a process of its own kind, so the session list is a filtered process list.

List sessions to find a session that another client created, then [reconnect to the session](#reconnect-to-a-session). Filter the process list by the session kind to get the list.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
session = sandbox.process.create_session()

sessions = sandbox.process.list(kind="session")
for proc in sessions.items:
    print(proc.id, proc.state)
```

| **Parameter** | **Description** |
| --- | --- |
| `kind` | Filters by process kind.<br />**Value:** `"exec"`, `"pty"`, `"code"`, or `"session"`<br />**Example:** `"session"` |

### Get session command

Get a session command to read the details of one command that a session ran. Each command that a shell runs ends with its own exit code, separate from the shell itself.

A command in a session of a sandbox is a process with a record of its own.

Get a command that ran in a session by its process ID to check its command line and exit code. Find the process ID with the session filter of [list processes](#list-processes). A command that still runs can also be addressed by the name it was given instead of its ID.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
session = sandbox.process.create_session()
session.run("echo hello")

listed = sandbox.process.list(session_id=session.id)
command = sandbox.process.get(listed.items[0].id)
print(f"Command: {command.shell_command}, Exit Code: {command.exit_code}")
```

| **Parameter** | **Description** |
| --- | --- |
| `process_id` | Sets the command process that get() returns.<br />**Required**<br />**Format:** a process ID, or the name of a running process |

### Delete a session

Delete a session to end its shell when the work in the session is done. Ending a shell also ends the commands that the shell started and that still run.

A deleted session is gone from the sandbox, together with the records of its commands.

Delete a session to end its shell, stop its running commands, and remove its command records. A command that runs when its session is deleted ends with the [lost reason](#process-states).

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
session = sandbox.process.create_session()

session.delete()
```

## Resource management

Resource management is the release of what a program holds once the program no longer needs it, such as memory, files, and stored records. A resource that is never released stays reserved, and leaks of this kind add up until no space is left.

A process in a sandbox that is kept until cleanup holds its record and logs until it is deleted. Deleting the process removes both, and stops the process first if it still runs.

Delete a process kept until cleanup when you no longer need its record and logs. The API applies this policy to sessions and to named processes. The SDKs apply it to PTYs and sessions, and to other processes only when the request sets it. The entrypoint process cannot be deleted.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.process.start("sleep 3600", name="my-process", keep_logs="until_cleanup")
try:
    pass  # Do work...
finally:
    handle.delete()  # kills the process if it is still running
```

| **Parameter** | **Description** |
| --- | --- |
| `keep_logs` | Sets how long the record and logs are kept after the process exits.<br />**Default:** `"on_exit_ttl"`<br />**Value:** `"until_cleanup"`, `"on_exit_ttl"`, or `"none"`<br />**Example:** `"until_cleanup"` |
| `name` | Sets a name that replaces the process ID in requests while the process runs.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, other than a single or double period, entrypoint, or dockerd<br />**Example:** `"my-process"` |

## Permissions

Process execution runs through the toolbox of a sandbox. Toolbox access is governed by one project permission, and access to the control-plane entrypoint logs by another. You can grant both permissions to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

A [sandbox access token](./sandboxes.md#create-an-access-token) with the toolbox:exec operation grants toolbox access to a single sandbox, without an API key. The sandbox read permission alone does not grant toolbox access.

| **Permission**        | **Grants**                                                        |
| --------------------- | ----------------------------------------------------------------- |
| **`write:sandboxes`** | Run commands, processes, and sessions, and update the environment |
| **`read:sandboxes`**  | Read the control-plane entrypoint logs                            |
