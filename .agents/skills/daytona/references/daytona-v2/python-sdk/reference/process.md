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
- [ProcessInfo](#processinfo)
- [ProcessHandleRef](#processhandleref)
- [WaitResult](#waitresult)
- [LogFrame](#logframe)
- [LogPage](#logpage)
- [ProcessResult](#processresult)
- [TerminalSize](#terminalsize)
- [ProcessKind](#processkind)
- [ProcessInfoKind](#processinfokind)
- [ProcessStateFilter](#processstatefilter)
- [ProcessState](#processstate)
- [KeepLogs](#keeplogs)
- [StdinMode](#stdinmode)
- [ProcessKeepLogs](#processkeeplogs)
- [ProcessStdinMode](#processstdinmode)
- [WaitReason](#waitreason)

## ProcessHandle

```python
class ProcessHandle()
```

Serializable handle for one sandbox process.

#### ProcessHandle.\_\_init\_\_

```python
def __init__(impl: AsyncProcessHandle, bridge: SyncBridge) -> None
```

#### ProcessHandle.sandbox\_id

```python
@property
def sandbox_id() -> str
```

#### ProcessHandle.process\_id

```python
@property
def process_id() -> str
```

#### ProcessHandle.id

```python
@property
def id() -> str
```

#### ProcessHandle.kind

```python
@property
def kind() -> Literal['exec', 'pty', 'code', 'session'] | None
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

#### ProcessHandle.from\_json

```python
@classmethod
def from_json(value: Mapping[str, str]) -> ProcessHandle
```

Rehydrate a handle identity without making a network request.

#### ProcessHandle.get

```python
def get() -> ProcessInfo
```

Fetch current process metadata.

#### ProcessHandle.kill

```python
def kill(*,
         signal: SignalName = 'TERM',
         escalate_after: Optional[float] = None,
         escalate_to: SignalName = 'KILL') -> None
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

#### ProcessHandle.ref

```python
def ref() -> ProcessHandleRef
```

Return a typed handle identity.

#### ProcessHandle.resize

```python
def resize(cols: int, rows: int) -> None
```

Resize a PTY process.

#### ProcessHandle.stream\_logs

```python
def stream_logs(*,
                cursor: Optional[str] = None,
                encoding: LogEncoding = 'text') -> Iterator[LogFrame]
```

Follow process logs with SSE while retaining cursor replay semantics.

#### ProcessHandle.to\_json

```python
def to_json() -> Dict[str, str]
```

Return a JSON-safe handle identity.

#### ProcessHandle.wait

```python
def wait(*, timeout: Optional[float] = None) -> WaitResult
```

Wait for terminal state using the process long-poll contract.

#### ProcessHandle.write\_stdin

```python
def write_stdin(data: Union[str, bytes]) -> None
```

Write to the stdin of an exec or PTY process created with stdin='open'.

## AsyncProcessHandle

```python
class AsyncProcessHandle()
```

Serializable handle for one sandbox process.

#### AsyncProcessHandle.\_\_init\_\_

```python
def __init__(sandbox_id: str,
             process_id: str,
             transport: Optional[AsyncTransport] = None,
             kind: Optional[ProcessKind] = None) -> None
```

#### AsyncProcessHandle.to\_json

```python
def to_json() -> Dict[str, str]
```

Return a JSON-safe handle identity.

#### AsyncProcessHandle.from\_json

```python
@classmethod
def from_json(value: Mapping[str, str]) -> AsyncProcessHandle
```

Rehydrate a handle identity without making a network request.

#### AsyncProcessHandle.ref

```python
def ref() -> ProcessHandleRef
```

Return a typed handle identity.

#### AsyncProcessHandle.bind

```python
def bind(transport: AsyncTransport) -> AsyncProcessHandle
```

Return this handle bound to a transport.

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

#### AsyncProcessHandle.stream\_logs

```python
async def stream_logs(*,
                      cursor: Optional[str] = None,
                      encoding: LogEncoding = 'text') -> AsyncIterator[LogFrame]
```

Follow process logs with SSE while retaining cursor replay semantics.

#### AsyncProcessHandle.write\_stdin

```python
async def write_stdin(data: Union[str, bytes]) -> None
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
               signal: SignalName = 'TERM',
               escalate_after: Optional[float] = None,
               escalate_to: SignalName = 'KILL') -> None
```

Send a signal and optional escalation signal.

#### AsyncProcessHandle.resize

```python
async def resize(cols: int, rows: int) -> None
```

Resize a PTY process.

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
def __init__(impl: AsyncProcessService, bridge: SyncBridge) -> None
```

#### ProcessService.connect

```python
def connect(process_id: Union[str, Mapping[str, str]]) -> ProcessHandle
```

Create a bound process handle without fetching metadata.

#### ProcessService.connect\_session

```python
def connect_session(session_id: str | Mapping[str, object]) -> Session
```

Bind a session id or serialized identity without making a request.

#### ProcessService.create\_session

```python
def create_session(*,
                   cwd: Optional[str] = None,
                   env: Optional[Mapping[str, str]] = None,
                   shell: Optional[str] = None,
                   login: Optional[bool] = None,
                   name: Optional[str] = None) -> Session
```

Create one persistent shell; cwd and env apply to all its commands.

#### ProcessService.get

```python
def get(process_id: str) -> ProcessInfo
```

Fetch current process metadata by id or live name alias.

#### ProcessService.list

```python
def list(*,
         state: Optional[ProcessStateFilter] = None,
         kind: Optional[ProcessKind] = None,
         session_id: Optional[str] = None,
         name: Optional[str] = None,
         pid: Optional[int] = None) -> ListResult[ProcessInfo]
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
        terminal: Optional[TerminalSize] = None,
        keep_logs: Optional[KeepLogs] = None) -> ProcessResult
```

Start a process, wait for its shell to exit, and collect its output.

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
          terminal: Optional[TerminalSize] = None,
          keep_logs: Optional[KeepLogs] = None) -> ProcessHandle
```

Start a detached process and return a handle immediately.

## AsyncProcessService

```python
class AsyncProcessService()
```

Sandbox process namespace.

#### AsyncProcessService.\_\_init\_\_

```python
def __init__(sandbox_id: str,
             transport: AsyncTransport,
             language: Optional[str] = None) -> None
```

#### AsyncProcessService.create\_session

```python
async def create_session(*,
                         cwd: Optional[str] = None,
                         env: Optional[Mapping[str, str]] = None,
                         shell: Optional[str] = None,
                         login: Optional[bool] = None,
                         name: Optional[str] = None) -> AsyncSession
```

Create one persistent shell; cwd and env apply to all its commands.

`shell` must be a POSIX shell (bash, sh, dash, zsh, ksh) on Linux
and macOS; another shell is refused when the session is created.

#### AsyncProcessService.connect\_session

```python
def connect_session(session_id: str | Mapping[str, object]) -> AsyncSession
```

Bind a session id or serialized identity without making a request.

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
                terminal: Optional[TerminalSize] = None,
                keep_logs: Optional[KeepLogs] = None) -> AsyncProcessHandle
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
:param execution_timeout: Server-side deadline in seconds. The sandbox kills
    the process tree when this expires.
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
              terminal: Optional[TerminalSize] = None,
              keep_logs: Optional[KeepLogs] = None) -> ProcessResult
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
:param execution_timeout: Server-side deadline in seconds. The sandbox kills
    the process tree when this expires.
:returns: `daytona.v2.types.ProcessResult` with `stdout`, `stderr`,
    `output`, `exit_code`, and `reason`.

Example::

    result = await sandbox.process.run("pip install httpx")
    if result.exit_code != 0:
        raise RuntimeError(result.stderr)

#### AsyncProcessService.connect

```python
def connect(process_id: Union[str, Mapping[str, str]]) -> AsyncProcessHandle
```

Create a bound process handle without fetching metadata.

#### AsyncProcessService.get

```python
async def get(process_id: str) -> ProcessInfo
```

Fetch current process metadata by id or live name alias.

#### AsyncProcessService.list

```python
async def list(*,
               state: Optional[ProcessStateFilter] = None,
               kind: Optional[ProcessKind] = None,
               session_id: Optional[str] = None,
               name: Optional[str] = None,
               pid: Optional[int] = None) -> ListResult[ProcessInfo]
```

## PtyService

```python
class PtyService()
```

PTY convenience namespace.

#### PtyService.\_\_init\_\_

```python
def __init__(impl: AsyncPtyService, bridge: SyncBridge) -> None
```

#### PtyService.connect

```python
def connect(process_id: str) -> ProcessHandle
```

Create a bound PTY handle.

#### PtyService.delete

```python
def delete(process_id: str) -> None
```

#### PtyService.list

```python
def list() -> ListResult[ProcessInfo]
```

#### PtyService.start

```python
def start(command: Optional[str] = None,
          *,
          cols: int = 80,
          rows: int = 24,
          cwd: Optional[str] = None,
          env: Optional[Mapping[str, str]] = None,
          name: Optional[str] = None) -> ProcessHandle
```

Start a detached PTY process.

## AsyncPtyService

```python
class AsyncPtyService()
```

PTY convenience namespace.

#### AsyncPtyService.\_\_init\_\_

```python
def __init__(process: AsyncProcessService) -> None
```

#### AsyncPtyService.start

```python
async def start(command: Optional[str] = None,
                *,
                cols: int = 80,
                rows: int = 24,
                cwd: Optional[str] = None,
                env: Optional[Mapping[str, str]] = None,
                name: Optional[str] = None) -> AsyncProcessHandle
```

Start a detached PTY process.

#### AsyncPtyService.connect

```python
def connect(process_id: str) -> AsyncProcessHandle
```

Create a bound PTY handle.

#### AsyncPtyService.list

```python
async def list() -> ListResult[ProcessInfo]
```

#### AsyncPtyService.delete

```python
async def delete(process_id: str) -> None
```

## Session

```python
class Session()
```

One persistent shell whose commands run one at a time, in order.

#### Session.\_\_init\_\_

```python
def __init__(impl: AsyncSession, bridge: SyncBridge) -> None
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

#### Session.from\_json

```python
@classmethod
def from_json(value: Mapping[str, object]) -> Session
```

Rehydrate an unbound identity without making a request.

#### Session.get

```python
def get() -> ProcessInfo
```

Fetch session metadata, including the shell's live cwd.

#### Session.run

```python
def run(command: str,
        *,
        stdin: StdinMode = 'closed',
        timeout: Optional[float] = None,
        execution_timeout: Optional[float] = None,
        name: Optional[str] = None,
        keep_logs: Optional[KeepLogs] = None) -> ProcessResult
```

Run a command in this shell and collect output; timeouts are seconds.

#### Session.start

```python
def start(command: str,
          *,
          stdin: StdinMode = 'closed',
          execution_timeout: Optional[float] = None,
          name: Optional[str] = None,
          keep_logs: Optional[KeepLogs] = None) -> ProcessHandle
```

Queue a command and return its handle without waiting for exit.

#### Session.to\_json

```python
def to_json() -> _SessionIdentity
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

#### AsyncSession.\_\_init\_\_

```python
def __init__(sandbox_id: str,
             session_id: str,
             transport: Optional[AsyncTransport] = None) -> None
```

#### AsyncSession.to\_json

```python
def to_json() -> _SessionIdentity
```

Return a JSON-safe identity for `process.connect_session()`.

#### AsyncSession.from\_json

```python
@classmethod
def from_json(value: Mapping[str, object]) -> AsyncSession
```

Rehydrate an unbound identity without making a request.

#### AsyncSession.run

```python
async def run(command: str,
              *,
              stdin: StdinMode = 'closed',
              timeout: Optional[float] = None,
              execution_timeout: Optional[float] = None,
              name: Optional[str] = None,
              keep_logs: Optional[KeepLogs] = None) -> ProcessResult
```

Run a command in this shell and collect output; timeouts are seconds.

`timeout` bounds the caller's wait without stopping the command;
`execution_timeout` stops the command without ending the session. A
command that has not stopped 5 s after its timeout (the shell could
not interrupt it and it runs no process to kill) ends the session
instead. In dash, BusyBox `sh` and mksh an interrupt leaves only the
innermost shell function or sourced file, as it does in bash older than
4.4 (macOS's `/bin/bash`) when a DEBUG trap is set.

#### AsyncSession.start

```python
async def start(command: str,
                *,
                stdin: StdinMode = 'closed',
                execution_timeout: Optional[float] = None,
                name: Optional[str] = None,
                keep_logs: Optional[KeepLogs] = None) -> AsyncProcessHandle
```

Queue a command and return its handle without waiting for exit.

Interrupt it with `handle.kill(signal="INT")`; the shell survives.
`execution_timeout` is a server-side deadline in seconds; the clock
starts when the command starts, after any queued commands ahead of it.

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

## ProcessInfo

```python
@dataclass(frozen=True)
class ProcessInfo()
```

Serializable process information.

**Attributes**:

- `id` _str_
- `kind` _ProcessInfoKind_
- `state` _ProcessState_
- `name` _Optional\[str\] = None_
- `pid` _Optional\[int\] = None_
- `system` _bool = False_
- `session_id` _Optional\[str\] = None_
- `shell_command` _Optional\[str\] = None_
- `argv` _Optional\[List\[str\]\] = None_
- `code` _Optional\[str\] = None_
- `language` _Optional\[str\] = None_
- `shell` _Optional\[str\] = None_
- `resolved_shell` _Optional\[str\] = None_
- `login` _Optional\[bool\] = None_
- `cwd` _Optional\[str\] = None_
- `user` _Optional\[str\] = None_
- `stdin` _Optional\[ProcessStdinMode\] = None_
- `execution_timeout` _Optional\[float\] = None_
- `terminal` _Optional\[TerminalSize\] = None_
- `keep_logs` _Optional\[ProcessKeepLogs\] = None_
- `exit_code` _Optional\[int\] = None_
- `signal` _Optional\[str\] = None_
- `reason` _Optional\[WaitReason\] = None_
- `created_at` _Optional\[str\] = None_
- `started_at` _Optional\[str\] = None_
- `exited_at` _Optional\[str\] = None_
- `truncated_head` _bool = False_
- `first_available_cursor` _Optional\[str\] = None_
- `last_cursor` _Optional\[str\] = None_
- `raw_kind` _Optional\[str\] = None_
- `raw_state` _Optional\[str\] = None_
- `raw_stdin` _Optional\[str\] = None_
- `raw_keep_logs` _Optional\[str\] = None_
- `raw_reason` _Optional\[str\] = None_

## ProcessHandleRef

```python
@dataclass(frozen=True)
class ProcessHandleRef()
```

JSON-safe process handle identity.

**Attributes**:

- `sandbox_id` _str_
- `process_id` _str_
- `kind` _Optional\[ProcessKind\] = None_

## WaitResult

```python
@dataclass(frozen=True)
class WaitResult()
```

Result returned by process wait.

**Attributes**:

- `exit_code` _Optional\[int\] = None_
- `signal` _Optional\[str\] = None_
- `reason` _Optional\[WaitReason\] = None_
- `raw_reason` _Optional\[str\] = None_

## LogFrame

```python
@dataclass(frozen=True)
class LogFrame()
```

One replayable process event.

**Attributes**:

- `cursor` _str_
- `channel` _str_
- `data` _str_
- `timestamp` _Optional\[int\] = None_

## LogPage

```python
@dataclass(frozen=True)
class LogPage()
```

A cursor-addressed process log page.

**Attributes**:

- `items` _List\[LogFrame\]_
- `next_cursor` _Optional\[str\] = None_
- `truncated_head` _bool = False_
- `first_available_cursor` _Optional\[str\] = None_

## ProcessResult

```python
@dataclass(frozen=True)
class ProcessResult()
```

Process run result with collected output.

**Attributes**:

- `process_id` _str_
- `exit_code` _Optional\[int\]_
- `signal` _Optional\[str\]_
- `reason` _Optional\[WaitReason\]_
- `stdout` _str = ''_
- `stderr` _str = ''_
- `output` _str = ''_
- `raw_reason` _Optional\[str\] = None_

## TerminalSize

```python
@dataclass(frozen=True)
class TerminalSize()
```

PTY terminal dimensions.

**Attributes**:

- `cols` _int_
- `rows` _int_

## ProcessKind

```python
ProcessKind = Literal['exec', 'pty', 'code', 'session']
```

## ProcessInfoKind

```python
ProcessInfoKind = Literal['exec', 'pty', 'code', 'session', 'unknown']
```

## ProcessStateFilter

```python
ProcessStateFilter = Literal['running', 'terminal', 'all']
```

## ProcessState

```python
ProcessState = Literal['starting', 'provisioning', 'running', 'terminal', 'unknown']
```

## KeepLogs

```python
KeepLogs = Literal['until_cleanup', 'on_exit_ttl', 'none']
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

## WaitReason

```python
WaitReason = Literal['exited', 'signaled', 'timed_out', 'lost', 'failed', 'unknown']
```
