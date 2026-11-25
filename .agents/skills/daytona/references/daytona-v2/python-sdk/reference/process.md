# Process (Python SDK reference)

## Contents

- [ProcessHandle](#processhandle)
- [AsyncProcessHandle](#asyncprocesshandle)
- [ProcessService](#processservice)
- [AsyncProcessService](#asyncprocessservice)
- [PtyService](#ptyservice)
- [AsyncPtyService](#asyncptyservice)
- [Session](#session)
- [AsyncSession](#asyncsession)
- [TerminalSize](#terminalsize)
- [ProcessInfo](#processinfo)
- [ProcessHandleJSON](#processhandlejson)
- [SessionJSON](#sessionjson)
- [WaitResult](#waitresult)
- [LogFrame](#logframe)
- [StreamLogFrameEvent](#streamlogframeevent)
- [StreamLogStateEvent](#streamlogstateevent)
- [StreamLogWarningEvent](#streamlogwarningevent)
- [StreamLogEofEvent](#streamlogeofevent)
- [LogPage](#logpage)
- [ProcessResult](#processresult)
- [ProcessKind](#processkind)
- [ProcessReportedKind](#processreportedkind)
- [ProcessStateFilter](#processstatefilter)
- [ProcessState](#processstate)
- [LogEncoding](#logencoding)
- [KeepLogs](#keeplogs)
- [RunKeepLogs](#runkeeplogs)
- [StdinMode](#stdinmode)
- [ProcessKeepLogs](#processkeeplogs)
- [ProcessStdinMode](#processstdinmode)
- [ProcessReason](#processreason)
- [ProcessSignal](#processsignal)
- [StreamLogEvent](#streamlogevent)

## ProcessHandle

```python
class ProcessHandle()
```

Handle for one sandbox process.

Returned by `process.start()` / `process.connect()` and the PTY and
session namespaces, never constructed directly. `to_json` gives a
JSON-safe identity that `sandbox.process.connect()` accepts on any worker.

#### ProcessHandle.\_\_init\_\_

```python
def __init__() -> None
```

#### ProcessHandle.sandbox\_id

```python
@property
def sandbox_id() -> str
```

#### ProcessHandle.id

```python
@property
def id() -> str
```

#### ProcessHandle.kind

```python
@property
def kind() -> Optional[ProcessKind]
```

#### ProcessHandle.close\_stdin

```python
def close_stdin() -> None
```

Close the stdin of an exec or PTY process (EOF).

#### ProcessHandle.delete

```python
def delete() -> None
```

Delete the process record and retained logs, stopping it first.

Raises `UnsupportedOperationError` for a running code cell and for a
session command that has not stopped within 5 s: delete its session.

#### ProcessHandle.get

```python
def get() -> ProcessInfo
```

Fetch current process metadata.

#### ProcessHandle.kill

```python
def kill(*,
         signal: ProcessSignal = 'TERM',
         escalate_after: Optional[float] = None,
         escalate_to: ProcessSignal = 'KILL') -> None
```

Send a signal and optional escalation signal.

#### ProcessHandle.logs

```python
def logs(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None,
         encoding: LogEncoding = 'text') -> LogPage
```

Read a cursor-replayable process log page.

With `encoding="base64"` each frame's `data` is standard padded
base64 (RFC 4648 section 4, `+/` alphabet with `=` padding), which
`base64.b64decode` decodes.

#### ProcessHandle.resize

```python
def resize(cols: int, rows: int, /) -> None
```

Resize a PTY process.

`cols` and `rows` are each an integer from 1 to 65535; a Windows
sandbox takes at most 32767 and refuses a larger value with
`daytona.v2.errors.BadRequestError`.

#### ProcessHandle.stream\_logs

```python
def stream_logs(*,
                cursor: Optional[str] = None,
                limit: Optional[int] = None,
                encoding: LogEncoding = 'text') -> Iterator[StreamLogEvent]
```

Follow the process log as it is written, replaying from `cursor`.

Yields one `StreamLogEvent` per server event: `log` (a frame),
`state` (the process became terminal), `warning` (frames before
`first_available_cursor` were evicted) and `eof`. A stream error
raises the typed error for its code. The server ends the stream with
`eof`, so an iteration that ends normally has the whole log; a stream
cut short, or one that ends without `eof`, raises `ConnectionError`:
resume with `stream_logs(cursor=...)` from the last event's cursor.
With `encoding="base64"` each frame's `data` is standard padded
base64, which `base64.b64decode` decodes.

#### ProcessHandle.to\_json

```python
def to_json() -> ProcessHandleJSON
```

Return the handle's JSON-safe identity for `process.connect()`.

#### ProcessHandle.wait

```python
def wait(*, timeout: Optional[float] = None) -> WaitResult
```

Wait for terminal state using the process long-poll contract.

`timeout` is the caller wait budget in seconds; `0` waits
unbounded.

#### ProcessHandle.write\_stdin

```python
def write_stdin(data: Union[str, bytes], /) -> None
```

Write to the stdin of an exec or PTY process created with stdin='open'.

## AsyncProcessHandle

```python
class AsyncProcessHandle()
```

Handle for one sandbox process.

Returned by `process.start()` / `process.connect()` and the PTY and
session namespaces, never constructed directly. `to_json` gives a
JSON-safe identity that `sandbox.process.connect()` accepts on any worker.

#### AsyncProcessHandle.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncProcessHandle.to\_json

```python
def to_json() -> ProcessHandleJSON
```

Return the handle's JSON-safe identity for `process.connect()`.

#### AsyncProcessHandle.get

```python
async def get() -> ProcessInfo
```

Fetch current process metadata.

#### AsyncProcessHandle.wait

```python
async def wait(*, timeout: Optional[float] = None) -> WaitResult
```

Wait for terminal state using the process long-poll contract.

`timeout` is the caller wait budget in seconds; `0` waits
unbounded.

#### AsyncProcessHandle.logs

```python
async def logs(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None,
               encoding: LogEncoding = 'text') -> LogPage
```

Read a cursor-replayable process log page.

With `encoding="base64"` each frame's `data` is standard padded
base64 (RFC 4648 section 4, `+/` alphabet with `=` padding), which
`base64.b64decode` decodes.

#### AsyncProcessHandle.stream\_logs

```python
async def stream_logs(*,
                      cursor: Optional[str] = None,
                      limit: Optional[int] = None,
                      encoding: LogEncoding = 'text') -> AsyncIterator[StreamLogEvent]
```

Follow the process log as it is written, replaying from `cursor`.

Yields one `StreamLogEvent` per server event: `log` (a frame),
`state` (the process became terminal), `warning` (frames before
`first_available_cursor` were evicted) and `eof`. A stream error
raises the typed error for its code. The server ends the stream with
`eof`, so an iteration that ends normally has the whole log; a stream
cut short, or one that ends without `eof`, raises `ConnectionError`:
resume with `stream_logs(cursor=...)` from the last event's cursor.
With `encoding="base64"` each frame's `data` is standard padded
base64, which `base64.b64decode` decodes.

#### AsyncProcessHandle.write\_stdin

```python
async def write_stdin(data: Union[str, bytes], /) -> None
```

Write to the stdin of an exec or PTY process created with stdin='open'.

#### AsyncProcessHandle.close\_stdin

```python
async def close_stdin() -> None
```

Close the stdin of an exec or PTY process (EOF).

#### AsyncProcessHandle.kill

```python
async def kill(*,
               signal: ProcessSignal = 'TERM',
               escalate_after: Optional[float] = None,
               escalate_to: ProcessSignal = 'KILL') -> None
```

Send a signal and optional escalation signal.

#### AsyncProcessHandle.resize

```python
async def resize(cols: int, rows: int, /) -> None
```

Resize a PTY process.

`cols` and `rows` are each an integer from 1 to 65535; a Windows
sandbox takes at most 32767 and refuses a larger value with
`daytona.v2.errors.BadRequestError`.

#### AsyncProcessHandle.delete

```python
async def delete() -> None
```

Delete the process record and retained logs, stopping it first.

Raises `UnsupportedOperationError` for a running code cell and for a
session command that has not stopped within 5 s: delete its session.

## ProcessService

```python
class ProcessService()
```

Sandbox process namespace.

#### ProcessService.\_\_init\_\_

```python
def __init__() -> None
```

#### ProcessService.connect

```python
def connect(process: Union[str, ProcessHandleJSON], /) -> ProcessHandle
```

Reconnect a process by id or by `handle.to_json()`, without a request.

#### ProcessService.connect\_session

```python
def connect_session(session: str | SessionJSON, /) -> Session
```

Reconnect a shell session by id or by `session.to_json()`, without a request.

#### ProcessService.create\_session

```python
def create_session(*,
                   cwd: Optional[str] = None,
                   env: Optional[Mapping[str, str]] = None,
                   shell: Optional[str] = None,
                   login: Optional[bool] = None,
                   name: Optional[str] = None,
                   tag: Optional[str] = None) -> Session
```

Create one persistent shell; cwd and env apply to all its commands.

`shell` must be a POSIX shell (bash, sh, dash, zsh, ksh) on Linux
and macOS; another shell is refused when the session is created.

#### ProcessService.get

```python
def get(process_id: str, /) -> ProcessInfo
```

Fetch current process metadata by id or live name alias.

#### ProcessService.kill\_all

```python
def kill_all(*, tag: str, timeout: Optional[float] = None) -> List[str]
```

Kill every process with the tag and everything those processes started.

Returns their process ids once nothing started under the tag is running,
including detached descendants and survivors of exited processes. The tag
is reusable after this call. Records and logs are kept. Survivors of
deleted or expired records are killed too but not listed.

`tag` is a safe identifier (`[A-Za-z0-9._-]`, 1-128 characters, not
`.` or `..`). `timeout` is how long to wait for them to exit, in
seconds: more than 0 and at most 60 (fractions allowed, default 10).
Anything else raises `BadRequestError` before any request.
Raises `ProcessKillIncompleteError` when some were still running at
the timeout, or another start or kill under the tag was in progress;
retrying is safe. Raises `UnsupportedOperationError` on macOS and
sandboxes without process containment.

#### ProcessService.list

```python
def list(*,
         state: Optional[ProcessStateFilter] = None,
         kind: Optional[ProcessKind] = None,
         session_id: Optional[str] = None,
         name: Optional[str] = None,
         pid: Optional[int] = None,
         tag: Optional[str] = None) -> ListResult[ProcessInfo]
```

#### ProcessService.run

```python
def run(command: Optional[str] = None,
        *,
        argv: Optional[Sequence[str]] = None,
        cwd: Optional[str] = None,
        env: Optional[Mapping[str, str]] = None,
        user: Optional[str] = None,
        shell: Optional[str] = None,
        login: Optional[bool] = None,
        stdin: StdinMode = 'closed',
        timeout: Optional[float] = None,
        execution_timeout: Optional[float] = None,
        name: Optional[str] = None,
        keep_logs: Optional[RunKeepLogs] = None,
        tag: Optional[str] = None) -> ProcessResult
```

Start a process, wait for its shell to exit, and collect its output.

The common case is one round trip: the sandbox starts the process, holds
the request until it exits (or `timeout` expires), and returns the
output inline. A process that outlives the wait window or produces more
output than fits in one page falls back to split calls automatically.

The result holds the output available when the call returns:
its per-process log is bounded, so very large output loses its oldest
frames, and a result that timed out collects only the first few log
pages.

**Shell selection.** A string `command` runs through the sandbox shell
(`bash`, else `sh`; pin another with `shell=`). Quote globs and brackets
(`pip install -e '.[test]'`) so the command means the same under any
shell. Use `argv=` to bypass the shell entirely, which is the safe
form for untrusted arguments. For persistent shell state, use `create_session`.

**Background processes.** The call returns when the shell exits. If the
command forks a background child that holds its output descriptors open
(e.g. `python3 -m http.server 8000 &`), the call waits at most ~2
seconds for output to drain and then returns; output the child writes
later is not part of the result. For a long-running server prefer
`start`, which returns a `ProcessHandle` immediately, or
redirect: `nohup cmd > server.log 2>&1 &`.

:param command: Shell command string; mutually exclusive with `argv`.
:param argv: Argument vector for shell-free execution.
:param cwd: Working directory inside the sandbox.
:param env: Extra environment variables merged into the process environment.
:param shell: Shell binary to use (e.g. `"bash"`); overrides auto-detection.
:param timeout: Caller wait budget in seconds. Omit to wait until the process
    ends. Does not kill the process on expiry.
:param stdin: Only `"closed"` (default): `run()` returns no handle to
    write to, so `"open"` is refused; use `start` for that.
:param execution_timeout: Server-side deadline in seconds. The sandbox kills
    the process tree when this expires. Omitted or `0` means no deadline.
:param keep_logs: How long the sandbox keeps the process log: `"on_exit_ttl"`
    (default) or `"until_cleanup"`. `"none"` is not accepted: the output is
    read back from the log; use `start` for a process without one.
:returns: `daytona.v2.types.ProcessResult` with `stdout`, `stderr`,
    `output`, `logs`, `exit_code`, and `reason`.

Example::

    result = sandbox.process.run("pip install httpx")
    if result.exit_code != 0:
        raise RuntimeError(result.stderr)

#### ProcessService.start

```python
def start(command: Optional[str] = None,
          *,
          argv: Optional[Sequence[str]] = None,
          name: Optional[str] = None,
          cwd: Optional[str] = None,
          env: Optional[Mapping[str, str]] = None,
          user: Optional[str] = None,
          shell: Optional[str] = None,
          login: Optional[bool] = None,
          stdin: StdinMode = 'closed',
          execution_timeout: Optional[float] = None,
          keep_logs: KeepLogs = 'on_exit_ttl',
          tag: Optional[str] = None) -> ProcessHandle
```

Start a detached process and return a handle immediately.

Unlike `run`, this returns as soon as the sandbox has started the
process. Use the returned `ProcessHandle` to stream logs
(`handle.stream_logs()`), wait for exit (`handle.wait()`), or kill
(`handle.kill()`). This is the right choice for long-running servers —
call `start()` once, then poll the port or stream logs to confirm the
server is ready.

**Shell selection.** A string `command` runs through the sandbox shell
(`bash`, else `sh`; pin another with `shell=`). Quote globs and brackets
(`pip install -e '.[test]'`). Use `argv=` to bypass the shell for
untrusted input. For persistent shell state, use `create_session`.

:param command: Shell command string; mutually exclusive with `argv`.
:param argv: Argument vector for shell-free execution.
:param cwd: Working directory inside the sandbox.
:param env: Extra environment variables merged into the process environment.
:param shell: Shell binary to use (e.g. `"bash"`); overrides auto-detection.
:param stdin: `"open"` keeps stdin open for `handle.write_stdin()`;
    `"closed"` (default) gives the process an empty stdin.
:param execution_timeout: Server-side deadline in seconds. The sandbox kills
    the process tree when this expires. Omitted or `0` means no deadline.
:param keep_logs: How long the sandbox keeps the process record and log:
    `"on_exit_ttl"` (default, a while after the process exits),
    `"until_cleanup"` (until it is deleted) or `"none"` (no log).
:returns: Bound `ProcessHandle` — logs, wait, and kill are available
    immediately.

Example — start an HTTP server and wait for it to be ready::

    handle = sandbox.process.start("python3 -m http.server 8000")
    # poll or stream logs; the process keeps running in the background

## AsyncProcessService

```python
class AsyncProcessService()
```

Sandbox process namespace.

#### AsyncProcessService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncProcessService.create\_session

```python
async def create_session(*,
                         cwd: Optional[str] = None,
                         env: Optional[Mapping[str, str]] = None,
                         shell: Optional[str] = None,
                         login: Optional[bool] = None,
                         name: Optional[str] = None,
                         tag: Optional[str] = None) -> AsyncSession
```

Create one persistent shell; cwd and env apply to all its commands.

`shell` must be a POSIX shell (bash, sh, dash, zsh, ksh) on Linux
and macOS; another shell is refused when the session is created.

#### AsyncProcessService.connect\_session

```python
def connect_session(session: str | SessionJSON, /) -> AsyncSession
```

Reconnect a shell session by id or by `session.to_json()`, without a request.

#### AsyncProcessService.start

```python
async def start(command: Optional[str] = None,
                *,
                argv: Optional[Sequence[str]] = None,
                name: Optional[str] = None,
                cwd: Optional[str] = None,
                env: Optional[Mapping[str, str]] = None,
                user: Optional[str] = None,
                shell: Optional[str] = None,
                login: Optional[bool] = None,
                stdin: StdinMode = 'closed',
                execution_timeout: Optional[float] = None,
                keep_logs: KeepLogs = 'on_exit_ttl',
                tag: Optional[str] = None) -> AsyncProcessHandle
```

Start a detached process and return a handle immediately.

Unlike `run`, this returns as soon as the sandbox has started the
process. Use the returned `ProcessHandle` to stream logs
(`handle.stream_logs()`), wait for exit (`handle.wait()`), or kill
(`handle.kill()`). This is the right choice for long-running servers —
call `start()` once, then poll the port or stream logs to confirm the
server is ready.

**Shell selection.** A string `command` runs through the sandbox shell
(`bash`, else `sh`; pin another with `shell=`). Quote globs and brackets
(`pip install -e '.[test]'`). Use `argv=` to bypass the shell for
untrusted input. For persistent shell state, use `create_session`.

:param command: Shell command string; mutually exclusive with `argv`.
:param argv: Argument vector for shell-free execution.
:param cwd: Working directory inside the sandbox.
:param env: Extra environment variables merged into the process environment.
:param shell: Shell binary to use (e.g. `"bash"`); overrides auto-detection.
:param stdin: `"open"` keeps stdin open for `handle.write_stdin()`;
    `"closed"` (default) gives the process an empty stdin.
:param execution_timeout: Server-side deadline in seconds. The sandbox kills
    the process tree when this expires. Omitted or `0` means no deadline.
:param keep_logs: How long the sandbox keeps the process record and log:
    `"on_exit_ttl"` (default, a while after the process exits),
    `"until_cleanup"` (until it is deleted) or `"none"` (no log).
:returns: Bound `ProcessHandle` — logs, wait, and kill are available
    immediately.

Example — start an HTTP server and wait for it to be ready::

    handle = await sandbox.process.start("python3 -m http.server 8000")
    # poll or stream logs; the process keeps running in the background

#### AsyncProcessService.run

```python
async def run(command: Optional[str] = None,
              *,
              argv: Optional[Sequence[str]] = None,
              cwd: Optional[str] = None,
              env: Optional[Mapping[str, str]] = None,
              user: Optional[str] = None,
              shell: Optional[str] = None,
              login: Optional[bool] = None,
              stdin: StdinMode = 'closed',
              timeout: Optional[float] = None,
              execution_timeout: Optional[float] = None,
              name: Optional[str] = None,
              keep_logs: Optional[RunKeepLogs] = None,
              tag: Optional[str] = None) -> ProcessResult
```

Start a process, wait for its shell to exit, and collect its output.

The common case is one round trip: the sandbox starts the process, holds
the request until it exits (or `timeout` expires), and returns the
output inline. A process that outlives the wait window or produces more
output than fits in one page falls back to split calls automatically.

The result holds the output available when the call returns:
its per-process log is bounded, so very large output loses its oldest
frames, and a result that timed out collects only the first few log
pages.

**Shell selection.** A string `command` runs through the sandbox shell
(`bash`, else `sh`; pin another with `shell=`). Quote globs and brackets
(`pip install -e '.[test]'`) so the command means the same under any
shell. Use `argv=` to bypass the shell entirely, which is the safe
form for untrusted arguments. For persistent shell state, use `create_session`.

**Background processes.** The call returns when the shell exits. If the
command forks a background child that holds its output descriptors open
(e.g. `python3 -m http.server 8000 &`), the call waits at most ~2
seconds for output to drain and then returns; output the child writes
later is not part of the result. For a long-running server prefer
`start`, which returns a `ProcessHandle` immediately, or
redirect: `nohup cmd > server.log 2>&1 &`.

:param command: Shell command string; mutually exclusive with `argv`.
:param argv: Argument vector for shell-free execution.
:param cwd: Working directory inside the sandbox.
:param env: Extra environment variables merged into the process environment.
:param shell: Shell binary to use (e.g. `"bash"`); overrides auto-detection.
:param timeout: Caller wait budget in seconds. Omit to wait until the process
    ends. Does not kill the process on expiry.
:param stdin: Only `"closed"` (default): `run()` returns no handle to
    write to, so `"open"` is refused; use `start` for that.
:param execution_timeout: Server-side deadline in seconds. The sandbox kills
    the process tree when this expires. Omitted or `0` means no deadline.
:param keep_logs: How long the sandbox keeps the process log: `"on_exit_ttl"`
    (default) or `"until_cleanup"`. `"none"` is not accepted: the output is
    read back from the log; use `start` for a process without one.
:returns: `daytona.v2.types.ProcessResult` with `stdout`, `stderr`,
    `output`, `logs`, `exit_code`, and `reason`.

Example::

    result = await sandbox.process.run("pip install httpx")
    if result.exit_code != 0:
        raise RuntimeError(result.stderr)

#### AsyncProcessService.connect

```python
def connect(process: Union[str, ProcessHandleJSON], /) -> AsyncProcessHandle
```

Reconnect a process by id or by `handle.to_json()`, without a request.

#### AsyncProcessService.get

```python
async def get(process_id: str, /) -> ProcessInfo
```

Fetch current process metadata by id or live name alias.

#### AsyncProcessService.list

```python
async def list(*,
               state: Optional[ProcessStateFilter] = None,
               kind: Optional[ProcessKind] = None,
               session_id: Optional[str] = None,
               name: Optional[str] = None,
               pid: Optional[int] = None,
               tag: Optional[str] = None) -> ListResult[ProcessInfo]
```

#### AsyncProcessService.kill\_all

```python
async def kill_all(*, tag: str, timeout: Optional[float] = None) -> List[str]
```

Kill every process with the tag and everything those processes started.

Returns their process ids once nothing started under the tag is running,
including detached descendants and survivors of exited processes. The tag
is reusable after this call. Records and logs are kept. Survivors of
deleted or expired records are killed too but not listed.

`tag` is a safe identifier (`[A-Za-z0-9._-]`, 1-128 characters, not
`.` or `..`). `timeout` is how long to wait for them to exit, in
seconds: more than 0 and at most 60 (fractions allowed, default 10).
Anything else raises `BadRequestError` before any request.
Raises `ProcessKillIncompleteError` when some were still running at
the timeout, or another start or kill under the tag was in progress;
retrying is safe. Raises `UnsupportedOperationError` on macOS and
sandboxes without process containment.

## PtyService

```python
class PtyService()
```

PTY namespace: interactive terminals.

#### PtyService.\_\_init\_\_

```python
def __init__() -> None
```

#### PtyService.connect

```python
def connect(process: Union[str, ProcessHandleJSON], /) -> ProcessHandle
```

Reconnect a PTY by id or by `handle.to_json()`, without a request.

#### PtyService.delete

```python
def delete(process: Union[str, ProcessHandleJSON], /) -> None
```

Stop a PTY and delete it and its log.

#### PtyService.list

```python
def list() -> ListResult[ProcessInfo]
```

#### PtyService.start

```python
def start(command: Optional[str] = None,
          *,
          terminal: Optional[TerminalSize] = None,
          cwd: Optional[str] = None,
          env: Optional[Mapping[str, str]] = None,
          name: Optional[str] = None,
          user: Optional[str] = None,
          shell: Optional[str] = None,
          login: Optional[bool] = None,
          stdin: StdinMode = 'open',
          execution_timeout: Optional[float] = None,
          keep_logs: KeepLogs = 'until_cleanup',
          tag: Optional[str] = None) -> ProcessHandle
```

Start a detached PTY process; without `command` it runs the sandbox shell.

`terminal` defaults to 80 columns by 24 rows (see
`daytona.v2.types.TerminalSize` for the limits). `TERM` is
`xterm-256color` unless `env` sets it. `execution_timeout` is a
server-side deadline in seconds; omitted or `0` means no deadline.

## AsyncPtyService

```python
class AsyncPtyService()
```

PTY namespace: interactive terminals.

#### AsyncPtyService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncPtyService.start

```python
async def start(command: Optional[str] = None,
                *,
                terminal: Optional[TerminalSize] = None,
                cwd: Optional[str] = None,
                env: Optional[Mapping[str, str]] = None,
                name: Optional[str] = None,
                user: Optional[str] = None,
                shell: Optional[str] = None,
                login: Optional[bool] = None,
                stdin: StdinMode = 'open',
                execution_timeout: Optional[float] = None,
                keep_logs: KeepLogs = 'until_cleanup',
                tag: Optional[str] = None) -> AsyncProcessHandle
```

Start a detached PTY process; without `command` it runs the sandbox shell.

`terminal` defaults to 80 columns by 24 rows (see
`daytona.v2.types.TerminalSize` for the limits). `TERM` is
`xterm-256color` unless `env` sets it. `execution_timeout` is a
server-side deadline in seconds; omitted or `0` means no deadline.

#### AsyncPtyService.connect

```python
def connect(process: Union[str, ProcessHandleJSON], /) -> AsyncProcessHandle
```

Reconnect a PTY by id or by `handle.to_json()`, without a request.

#### AsyncPtyService.list

```python
async def list() -> ListResult[ProcessInfo]
```

#### AsyncPtyService.delete

```python
async def delete(process: Union[str, ProcessHandleJSON], /) -> None
```

Stop a PTY and delete it and its log.

## Session

```python
class Session()
```

One persistent shell whose commands run one at a time, in order.

Directory changes, exports and functions carry over between commands.
Set cwd and env when calling `process.create_session()`. Interrupt a
running command with `handle.kill(signal="INT")`; the session survives.
Sessions do not survive a sandbox stop/start. After `set -x` or
`set -v`, later commands' stderr also includes the session's command
execution traces.

Returned by `process.create_session()` / `process.connect_session()`,
never constructed directly.

#### Session.\_\_init\_\_

```python
def __init__() -> None
```

#### Session.sandbox\_id

```python
@property
def sandbox_id() -> str
```

#### Session.id

```python
@property
def id() -> str
```

#### Session.delete

```python
def delete() -> None
```

End this shell and remove it and all its commands.

#### Session.get

```python
def get() -> ProcessInfo
```

Fetch session metadata, including the shell's live cwd.

#### Session.run

```python
def run(command: str,
        /,
        *,
        stdin: StdinMode = 'closed',
        timeout: Optional[float] = None,
        execution_timeout: Optional[float] = None,
        name: Optional[str] = None,
        keep_logs: Optional[RunKeepLogs] = None) -> ProcessResult
```

Run a command in this shell and collect output; timeouts are seconds.

`timeout` bounds the caller's wait without stopping the command;
`execution_timeout` stops the command without ending the session
(omitted or `0`: no deadline). `stdin="open"` is refused: use
`start` for a command that reads stdin. A
command that has not stopped 5 s after its timeout (the shell could
not interrupt it and it runs no process to kill) ends the session
instead. In dash, BusyBox `sh` and mksh an interrupt leaves only the
innermost shell function or sourced file, as it does in bash older than
4.4 (macOS's `/bin/bash`) when a DEBUG trap is set.

#### Session.start

```python
def start(command: str,
          /,
          *,
          stdin: StdinMode = 'closed',
          execution_timeout: Optional[float] = None,
          name: Optional[str] = None,
          keep_logs: KeepLogs = 'on_exit_ttl') -> ProcessHandle
```

Queue a command and return its handle without waiting for exit.

Interrupt it with `handle.kill(signal="INT")`; the shell survives.
`execution_timeout` is a server-side deadline in seconds (omitted or
`0`: none); the clock starts when the command starts, after any queued
commands ahead of it. `keep_logs` defaults to `"on_exit_ttl"`, as
for `ProcessService.start`.

#### Session.to\_json

```python
def to_json() -> SessionJSON
```

Return a JSON-safe identity for `process.connect_session()`.

## AsyncSession

```python
class AsyncSession()
```

One persistent shell whose commands run one at a time, in order.

Directory changes, exports and functions carry over between commands.
Set cwd and env when calling `process.create_session()`. Interrupt a
running command with `handle.kill(signal="INT")`; the session survives.
Sessions do not survive a sandbox stop/start. After `set -x` or
`set -v`, later commands' stderr also includes the session's command
execution traces.

Returned by `process.create_session()` / `process.connect_session()`,
never constructed directly.

#### AsyncSession.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncSession.to\_json

```python
def to_json() -> SessionJSON
```

Return a JSON-safe identity for `process.connect_session()`.

#### AsyncSession.run

```python
async def run(command: str,
              /,
              *,
              stdin: StdinMode = 'closed',
              timeout: Optional[float] = None,
              execution_timeout: Optional[float] = None,
              name: Optional[str] = None,
              keep_logs: Optional[RunKeepLogs] = None) -> ProcessResult
```

Run a command in this shell and collect output; timeouts are seconds.

`timeout` bounds the caller's wait without stopping the command;
`execution_timeout` stops the command without ending the session
(omitted or `0`: no deadline). `stdin="open"` is refused: use
`start` for a command that reads stdin. A
command that has not stopped 5 s after its timeout (the shell could
not interrupt it and it runs no process to kill) ends the session
instead. In dash, BusyBox `sh` and mksh an interrupt leaves only the
innermost shell function or sourced file, as it does in bash older than
4.4 (macOS's `/bin/bash`) when a DEBUG trap is set.

#### AsyncSession.start

```python
async def start(command: str,
                /,
                *,
                stdin: StdinMode = 'closed',
                execution_timeout: Optional[float] = None,
                name: Optional[str] = None,
                keep_logs: KeepLogs = 'on_exit_ttl') -> AsyncProcessHandle
```

Queue a command and return its handle without waiting for exit.

Interrupt it with `handle.kill(signal="INT")`; the shell survives.
`execution_timeout` is a server-side deadline in seconds (omitted or
`0`: none); the clock starts when the command starts, after any queued
commands ahead of it. `keep_logs` defaults to `"on_exit_ttl"`, as
for `ProcessService.start`.

#### AsyncSession.get

```python
async def get() -> ProcessInfo
```

Fetch session metadata, including the shell's live cwd.

#### AsyncSession.delete

```python
async def delete() -> None
```

End this shell and remove it and all its commands.

## TerminalSize

```python
@dataclass(frozen=True, kw_only=True)
class TerminalSize()
```

PTY terminal dimensions, in character cells. A size you pass has
`cols` and `rows` each an integer from 1 to 65535 (checked before the
request); a Windows sandbox takes at most 32767 and refuses a larger one
with `daytona.v2.errors.BadRequestError`. A size the sandbox
reports (a process's `terminal`) may be any positive 32-bit integer.

**Attributes**:

- `cols` _int_
- `rows` _int_

## ProcessInfo

```python
@dataclass(frozen=True, kw_only=True)
class ProcessInfo()
```

Process metadata, as `process.get()` / `process.list()` report it.

Enum-backed fields are normalized to the values this release knows plus
`"unknown"`; the wire value is kept on the `raw_*` sibling.
`signal` is a bare name (`"TERM"`), like `WaitResult.signal`.

**Attributes**:

- `id` _str_
- `kind` _ProcessReportedKind_
- `raw_kind` _str_
- `state` _ProcessState_
- `raw_state` _str_
- `cwd` _str_
- `stdin` _ProcessStdinMode_
- `raw_stdin` _str_
- `keep_logs` _ProcessKeepLogs_
- `raw_keep_logs` _str_
- `created_at` _datetime_
- `system` _bool = False_
- `name` _Optional\[str\] = None_
- `tag` _Optional\[str\] = None_ - The tag the process was created with; a session command carries its session's tag. Never changes.
- `pid` _Optional\[int\] = None_
- `session_id` _Optional\[str\] = None_
- `shell_command` _Optional\[str\] = None_
- `argv` _Optional\[tuple\[str, ...\]\] = None_
- `code` _Optional\[str\] = None_
- `language` _Optional\[str\] = None_
- `shell` _Optional\[str\] = None_
- `resolved_shell` _Optional\[str\] = None_
- `login` _Optional\[bool\] = None_
- `user` _Optional\[str\] = None_
- `execution_timeout` _Optional\[float\] = None_ - Server-side deadline in seconds.
- `terminal` _Optional\[TerminalSize\] = None_
- `exit_code` _Optional\[int\] = None_
- `signal` _Optional\[str\] = None_
- `reason` _Optional\[ProcessReason\] = None_
- `raw_reason` _Optional\[str\] = None_
- `started_at` _Optional\[datetime\] = None_
- `exited_at` _Optional\[datetime\] = None_
- `truncated_head` _bool = False_
- `first_available_cursor` _Optional\[str\] = None_
- `last_cursor` _Optional\[str\] = None_

## ProcessHandleJSON

```python
class ProcessHandleJSON(TypedDict)
```

A process handle's serialized identity (`handle.to_json()`).

Reconnect with `sandbox.process.connect(value)`; the same camelCase
shape the TypeScript SDK produces and reads.

**Attributes**:

- `sandboxId` _str_
- `processId` _str_
- `kind` _NotRequired\[ProcessKind\]_

## SessionJSON

```python
class SessionJSON(TypedDict)
```

A shell session's serialized identity (`session.to_json()`).

Reconnect with `sandbox.process.connect_session(value)`.

**Attributes**:

- `sandboxId` _str_
- `sessionId` _str_

## WaitResult

```python
@dataclass(frozen=True, kw_only=True)
class WaitResult()
```

How a process ended, or `reason="timed_out"` when the wait expired first.

`exit_code` and `signal` are set only when the sandbox reported them;
the SDK never fills them in. `reason` is normalized (`"unknown"` for a
value this release does not know, kept on `raw_reason`).

**Attributes**:

- `reason` _ProcessReason_
- `exit_code` _Optional\[int\] = None_
- `signal` _Optional\[str\] = None_
- `raw_reason` _Optional\[str\] = None_

## LogFrame

```python
@dataclass(frozen=True, kw_only=True)
class LogFrame()
```

One replayable process log frame.

**Attributes**:

- `cursor` _str_
- `channel` _str_
- `data` _str_
- `timestamp_ms` _int_ - When the frame was written, in Unix milliseconds.

## StreamLogFrameEvent

```python
@dataclass(frozen=True, kw_only=True)
class StreamLogFrameEvent()
```

`stream_logs()`: one log frame.

**Attributes**:

- `frame` _LogFrame_
- `cursor` _str_
- `type` _Literal\['log'\] = 'log'_

## StreamLogStateEvent

```python
@dataclass(frozen=True, kw_only=True)
class StreamLogStateEvent()
```

`stream_logs()`: the process became terminal.

**Attributes**:

- `result` _WaitResult_
- `cursor` _str_
- `type` _Literal\['state'\] = 'state'_

## StreamLogWarningEvent

```python
@dataclass(frozen=True, kw_only=True)
class StreamLogWarningEvent()
```

`stream_logs()`: frames before `first_available_cursor` were evicted.

**Attributes**:

- `message` _str_
- `cursor` _str_
- `first_available_cursor` _str_
- `type` _Literal\['warning'\] = 'warning'_

## StreamLogEofEvent

```python
@dataclass(frozen=True, kw_only=True)
class StreamLogEofEvent()
```

`stream_logs()`: the log is complete; the stream ends after this event.

**Attributes**:

- `cursor` _str_
- `type` _Literal\['eof'\] = 'eof'_

## LogPage

```python
@dataclass(frozen=True, kw_only=True)
class LogPage()
```

A cursor-addressed process log page.

**Attributes**:

- `items` _tuple\[LogFrame, ...\]_
- `next_cursor` _str_ - The cursor to pass to the next `logs()` call to continue after this page.
- `truncated_head` _bool_ - Whether retention removed frames older than this page.
- `eof` _bool_ - Whether the process has ended and no frame follows this page.
- `first_available_cursor` _Optional\[str\] = None_ - The cursor of the oldest frame still kept, when older ones were removed.

## ProcessResult

```python
@dataclass(frozen=True, kw_only=True)
class ProcessResult(WaitResult)
```

`process.run()` result: how the process ended plus its collected output.

**Attributes**:

- `process_id` _str_
- `stdout` _str = ''_
- `stderr` _str = ''_
- `output` _str = ''_
- `logs` _tuple\[LogFrame, ...\] = ()_ - The log frames the output was collected from.

## ProcessKind

```python
ProcessKind = Literal['exec', 'pty', 'code', 'session']
```

## ProcessReportedKind

```python
ProcessReportedKind = Literal['exec', 'pty', 'code', 'session', 'unknown']
```

## ProcessStateFilter

```python
ProcessStateFilter = Literal['running', 'terminal', 'all']
```

## ProcessState

```python
ProcessState = Literal['starting', 'provisioning', 'running', 'terminal', 'unknown']
```

## LogEncoding

```python
LogEncoding = Literal['text', 'base64']
```

## KeepLogs

```python
KeepLogs = Literal['until_cleanup', 'on_exit_ttl', 'none']
```

## RunKeepLogs

```python
RunKeepLogs = Literal['until_cleanup', 'on_exit_ttl']
```

## StdinMode

```python
StdinMode = Literal['closed', 'open']
```

## ProcessKeepLogs

```python
ProcessKeepLogs = Literal['until_cleanup', 'on_exit_ttl', 'none', 'unknown']
```

## ProcessStdinMode

```python
ProcessStdinMode = Literal['closed', 'open', 'unknown']
```

## ProcessReason

```python
ProcessReason = Literal['exited', 'signaled', 'timed_out', 'lost', 'failed', 'unknown']
```

## ProcessSignal

```python
ProcessSignal = Literal['TERM', 'KILL', 'INT', 'HUP', 'QUIT', 'USR1', 'USR2']
```

## StreamLogEvent

```python
StreamLogEvent = Union[StreamLogFrameEvent, StreamLogStateEvent, StreamLogWarningEvent, StreamLogEofEvent]
```
