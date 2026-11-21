# Process (TypeScript SDK reference)

## Contents

- [ProcessHandle](#processhandle)
- [ProcessService](#processservice)
- [PtyService](#ptyservice)
- [Session](#session)
- [PtyDuplex](#ptyduplex)
- [CreateSessionOptions](#createsessionoptions)
- [SessionRunOptions](#sessionrunoptions)
- [SessionStartOptions](#sessionstartoptions)
- [SessionJSON](#sessionjson)
- [ProcessHandleJSON](#processhandlejson)
- [ProcessKind](#processkind)
- [ProcessReportedKind](#processreportedkind)
- [ProcessState](#processstate)
- [ProcessSignal](#processsignal)
- [ProcessReason](#processreason)
- [KeepLogs](#keeplogs)
- [ProcessKeepLogs](#processkeeplogs)
- [ProcessStdinMode](#processstdinmode)
- [TerminalSize](#terminalsize)
- [ProcessInfo](#processinfo)
- [WaitResult](#waitresult)
- [StdinMode](#stdinmode)
- [ProcessStartOptions](#processstartoptions)
- [ProcessCommand](#processcommand)
- [PtyStartOptions](#ptystartoptions)
- [RunKeepLogs](#runkeeplogs)
- [RunOptions](#runoptions)
- [ProcessResult](#processresult)
- [LogFrame](#logframe)
- [LogPage](#logpage)
- [StreamLogEvent](#streamlogevent)
- [StreamLogEofEvent](#streamlogeofevent)
- [StreamLogFrameEvent](#streamlogframeevent)
- [StreamLogStateEvent](#streamlogstateevent)
- [StreamLogWarningEvent](#streamlogwarningevent)
- [LogsOptions](#logsoptions)
- [StreamLogsOptions](#streamlogsoptions)
- [WaitProcessOptions](#waitprocessoptions)
- [KillOptions](#killoptions)
- [ProcessListOptions](#processlistoptions)
- [KillAllOptions](#killalloptions)

## ProcessHandle

Handle for one sandbox process. Returned by `process.start()` /
`process.connect()` and the PTY and session namespaces, never constructed
directly. `toJSON()` gives an identity `sandbox.process.connect()` accepts
on any worker.

**Properties**:

- `id` _string_
- `sandboxId` _string_
- `kind?` _ProcessKind_

### Constructors

#### Constructor

```ts
new ProcessHandle(token: Internal, ...init: never[]): ProcessHandle;
```

Built by the SDK: get it from `sandbox.process.start()` or `connect()`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `ProcessHandle`

### Methods

#### attach()

```ts
attach(): Promise<PtyDuplex>;
```

Connect to a PTY's terminal.

**Returns**:

- `Promise<PtyDuplex>`

#### closeStdin()

```ts
closeStdin(): Promise<void>;
```

Close the stdin of an exec or pty process (EOF).

**Returns**:

- `Promise<void>`

#### delete()

```ts
delete(): Promise<void>;
```

Delete the process and its logs, stopping it first if it is running.
Refused (`UnsupportedOperationError`) for a running code cell, and for a
session command that has not stopped within 5 s: delete its session.

**Returns**:

- `Promise<void>`

#### get()

```ts
get(): Promise<ProcessInfo>;
```

Fetch current process metadata.

**Returns**:

- `Promise<ProcessInfo>`

#### kill()

```ts
kill(options: KillOptions = {}): Promise<void>;
```

Send a signal (default `TERM`), optionally escalating to `escalateTo` after `escalateAfterSeconds`.

**Parameters**:

- `options` _KillOptions = \{\}_

**Returns**:

- `Promise<void>`

#### logs()

```ts
logs(options: LogsOptions = {}): Promise<LogPage>;
```

Read one page of the process log, from `cursor`.

**Parameters**:

- `options` _LogsOptions = \{\}_

**Returns**:

- `Promise<LogPage>`

#### resize()

```ts
resize(cols: number, rows: number): Promise<void>;
```

Resize a PTY. `cols` and `rows` are each an integer from 1 to 65535; a
Windows sandbox takes at most 32767 and refuses a larger value with
`BadRequestError`.

**Parameters**:

- `cols` _number_
- `rows` _number_

**Returns**:

- `Promise<void>`

#### streamLogs()

```ts
streamLogs(options: StreamLogsOptions = {}): AsyncIterable<StreamLogEvent>;
```

Follow the process log as it is written, replaying from `cursor`. Yields
one `StreamLogEvent` per server event: `log` (a frame), `state`
(the process became terminal), `warning` (frames before
`firstAvailableCursor` were evicted) and `eof`. A stream error throws the
typed error for its code. The server ends the stream with `eof`, so an
iteration that ends normally has the whole log; a stream cut short, or one
that ends without `eof`, throws `ConnectionError`: resume with
`streamLogs({ cursor })` from the last event's cursor.

**Parameters**:

- `options` _StreamLogsOptions = \{\}_

**Returns**:

- `AsyncIterable<StreamLogEvent>`

#### toJSON()

```ts
toJSON(): ProcessHandleJSON;
```

The handle's JSON-safe identity, for `sandbox.process.connect()`.

**Returns**:

- `ProcessHandleJSON`

#### wait()

```ts
wait(options: WaitProcessOptions = {}): Promise<WaitResult>;
```

Wait until the process ends. `timeoutSeconds` is the caller's wait budget
(omitted or `0` waits until it ends); on expiry the result is
`{ reason: 'timed_out' }` and the process keeps running.

**Parameters**:

- `options` _WaitProcessOptions = \{\}_

**Returns**:

- `Promise<WaitResult>`

#### writeStdin()

```ts
writeStdin(data: string | Uint8Array): Promise<void>;
```

Write to the stdin of an exec or pty process created with stdin='open'.

**Parameters**:

- `data` _string \| Uint8Array_

**Returns**:

- `Promise<void>`

***

## ProcessService

Sandbox process namespace (`sandbox.process`).

**Properties**:

- `sandboxId` _string_

### Constructors

#### Constructor

```ts
new ProcessService(token: Internal, ...init: never[]): ProcessService;
```

Built by the SDK: get it from `sandbox.process`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `ProcessService`

### Methods

#### connect()

```ts
connect(process: string | ProcessHandleJSON): ProcessHandle;
```

Reconnect a process by id or by `handle.toJSON()`, without a request.

**Parameters**:

- `process` _string \| ProcessHandleJSON_

**Returns**:

- `ProcessHandle`

#### connectSession()

```ts
connectSession(session: string | SessionJSON): Session;
```

Reconnect a shell session by id or by `session.toJSON()`, without a request.

**Parameters**:

- `session` _string \| SessionJSON_

**Returns**:

- `Session`

#### createSession()

```ts
createSession(options: CreateSessionOptions = {}): Promise<Session>;
```

Create one persistent shell; cwd and env apply to all its commands.
`shell` must be a POSIX shell (bash, sh, dash, zsh, ksh) on Linux and
macOS; another shell is refused when the session is created.

**Parameters**:

- `options` _CreateSessionOptions = \{\}_

**Returns**:

- `Promise<Session>`

#### get()

```ts
get(id: string): Promise<ProcessInfo>;
```

Fetch current process metadata by id or live name alias.

**Parameters**:

- `id` _string_

**Returns**:

- `Promise<ProcessInfo>`

#### killAll()

```ts
killAll(options: KillAllOptions): Promise<readonly string[]>;
```

Kill every process created with `tag` and everything those processes
started, including detached descendants and the survivors of tagged
processes that already exited, keeping their records and logs. Returns
the ids of the tagged processes it stopped once none of them is running;
the tag can be used again right away. Processes whose records were
deleted or expired are stopped too but not listed.

**Parameters**:

- `options` _KillAllOptions_

**Returns**:

- `Promise<readonly string[]>`

**Throws**:

ProcessKillIncompleteError when some were still running at the
timeout, or another start or kill under the tag was in progress; calling
again is safe.

**Throws**:

UnsupportedOperationError on macOS and on sandboxes without
process containment.

#### list()

```ts
list(options: ProcessListOptions = {}): Promise<ListResult<ProcessInfo>>;
```

List processes; `tag` keeps only the processes created with that tag.

**Parameters**:

- `options` _ProcessListOptions = \{\}_

**Returns**:

- `Promise<ListResult<ProcessInfo>>`

#### run()

```ts
run(command: ProcessCommand, options: RunOptions = {}): Promise<ProcessResult>;
```

Run a command, wait for its shell to exit, and collect its output.

Normally one round trip: starts, waits, and returns inline logs. Larger
output or a process outliving the wait window falls back to split calls.
Output is bounded by per-process retention; a timed-out result collects
only the first few log pages rather than chasing a live writer.

Strings (or `{ cmd }`) use the sandbox shell (`bash`, else `sh`; override
with `shell`). Quote globs and brackets (`pip install -e '.[test]'`).
`{ argv: [...] }` bypasses the shell for untrusted arguments. For shared
shell state, use `createSession` instead.

Background children holding output descriptors open drain for at most
about two seconds after the shell exits; later output is not included.
Prefer `start` for long-running servers, or redirect their output
(`nohup cmd > server.log 2>&1 &`).

**Parameters**:

- `command` _ProcessCommand_ - Shell command string, `{ cmd }`, or shell-free `{ argv }`.
- `options` _RunOptions = \{\}_

**Returns**:

- `Promise<ProcessResult>` - Output, stdout, stderr, logs and the exit result.

#### start()

```ts
start(
   command: ProcessCommand,
   options: ProcessStartOptions = {}): Promise<ProcessHandle>;
```

Start a detached process and return a handle immediately.

Use `ProcessHandle.streamLogs`, `ProcessHandle.wait`, or
`ProcessHandle.kill` to control it. Prefer this for long-running
servers: start once, then poll the port or stream logs for readiness.

String commands (or `{ cmd }`) run through the sandbox shell (`bash`,
else `sh`; pin another with `shell`). Quote globs and brackets, such as
`pip install -e '.[test]'`. Pass `{ argv: [...] }` to bypass the shell
for untrusted arguments. Plain commands do not share shell state; use
`createSession` for a persistent shell.

**Parameters**:

- `command` _ProcessCommand_ - Shell command string, `{ cmd }`, or shell-free `{ argv }`.
- `options` _ProcessStartOptions = \{\}_

**Returns**:

- `Promise<ProcessHandle>`

***

## PtyService

PTY namespace (`sandbox.pty`): interactive terminals.

### Constructors

#### Constructor

```ts
new PtyService(token: Internal, ...init: never[]): PtyService;
```

Built by the SDK: get it from `sandbox.pty`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `PtyService`

### Methods

#### attach()

```ts
attach(
   command?: string,
   options: PtyStartOptions = {}): Promise<Readonly<{ handle: ProcessHandle; connection: PtyDuplex }>>;
```

Start a PTY and connect to its terminal; if the connection fails, the SDK attempts to delete the PTY (best effort).

**Parameters**:

- `command?` _string_
- `options` _PtyStartOptions = \{\}_

**Returns**:

- `Promise<Readonly<{ handle: ProcessHandle; connection: PtyDuplex }>>`

#### connect()

```ts
connect(process: string | ProcessHandleJSON): ProcessHandle;
```

Reconnect a PTY by id or by `handle.toJSON()`, without a request.

**Parameters**:

- `process` _string \| ProcessHandleJSON_

**Returns**:

- `ProcessHandle`

#### delete()

```ts
delete(process: string | ProcessHandleJSON): Promise<void>;
```

Stop a PTY and delete it and its log.

**Parameters**:

- `process` _string \| ProcessHandleJSON_

**Returns**:

- `Promise<void>`

#### list()

```ts
list(): Promise<ListResult<ProcessInfo>>;
```

**Returns**:

- `Promise<ListResult<ProcessInfo>>`

#### start()

```ts
start(command?: string, options: PtyStartOptions = {}): Promise<ProcessHandle>;
```

Start a detached PTY process; without `command` it runs the sandbox shell.
The terminal defaults to 80×24, and `TERM` is `xterm-256color` unless
`env` sets it.

**Parameters**:

- `command?` _string_
- `options` _PtyStartOptions = \{\}_

**Returns**:

- `Promise<ProcessHandle>`

***

## Session

One persistent shell. Commands run one at a time, in order; `cd`, exports,
and functions carry over. Set cwd/env with `process.createSession()`.
Interrupt a command with `handle.kill({ signal: 'INT' })`: the session
survives. Sessions survive pause/resume, but not a sandbox stop/start.
After `set -x` or `set -v` in a session, later commands' stderr also includes
the shell wrapper used to run each command. Returned by
`process.createSession()` / `process.connectSession()`, never constructed
directly.

**Properties**:

- `sandboxId` _string_
- `id` _string_

### Constructors

#### Constructor

```ts
new Session(token: Internal, ...init: never[]): Session;
```

Built by the SDK: get it from `sandbox.process.createSession()` or `connectSession()`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `Session`

### Methods

#### \[Symbol.asyncDispose\]()

```ts
[Symbol.asyncDispose](): Promise<void>;
```

Deletes the session on scope exit; one already deleted in the scope is fine.

**Returns**:

- `Promise<void>`

#### delete()

```ts
delete(): Promise<void>;
```

End the shell and delete it and all its command records.

**Returns**:

- `Promise<void>`

#### get()

```ts
get(): Promise<ProcessInfo>;
```

Read the shell process, including its current working directory.

**Returns**:

- `Promise<ProcessInfo>`

#### run()

```ts
run(command: string, options: SessionRunOptions = {}): Promise<ProcessResult>;
```

Run in this shell, wait, and collect output using the process run path.

**Parameters**:

- `command` _string_
- `options` _SessionRunOptions = \{\}_

**Returns**:

- `Promise<ProcessResult>`

#### start()

```ts
start(command: string, options: SessionStartOptions = {}): Promise<ProcessHandle>;
```

Queue a command and return its handle without waiting for completion.

**Parameters**:

- `command` _string_
- `options` _SessionStartOptions = \{\}_

**Returns**:

- `Promise<ProcessHandle>`

#### toJSON()

```ts
toJSON(): SessionJSON;
```

The session's JSON-safe identity, for `sandbox.process.connectSession()`.

**Returns**:

- `SessionJSON`

***

## PtyDuplex

A live connection to a PTY's terminal (`handle.attach()`). `close()` disconnects; it does not stop the process.

**Properties**:

- `readable` _AsyncIterable\<Uint8Array\>_

### Methods

#### close()

```ts
close(): void;
```

**Returns**:

- `void`

#### write()

```ts
write(data: string | Uint8Array): void;
```

**Parameters**:

- `data` _string \| Uint8Array_

**Returns**:

- `void`

***

## CreateSessionOptions

Settings for the persistent shell, inherited by every command.

**Properties**:

- `tag?` _string_ - Immutable tag inherited by every command run in this shell.
- `cwd?` _string_
- `env?` _Readonly\<Record\<string, string\>\>_
- `shell?` _string_ - A POSIX shell (bash, sh, dash, zsh, ksh) on Linux and macOS; another
  shell is refused when the session is created.
- `login?` _boolean_
- `name?` _string_

***

## SessionRunOptions

**Extends**: `Omit<SessionStartOptions, 'keepLogs' | 'stdin'>`

**Properties**:

- `stdin?` _'closed'_ - Only `'closed'` (default): `run()` returns no handle to write to; use `start()` for open stdin.
- `keepLogs?` _RunKeepLogs_ - How long the sandbox keeps the command's log (default `'on_exit_ttl'`).
- `timeoutSeconds?` _number_ - Caller wait budget in seconds; omitted or 0 waits unbounded. Expiry does not stop the command.

***

## SessionStartOptions

**Properties**:

- `stdin?` _StdinMode_
- `executionTimeoutSeconds?` _number_ - Server-side command deadline in seconds (omitted or `0`: none). The clock
  starts when the command starts, after any queued commands ahead of it.
  The command is stopped and the session survives; a command that has not
  stopped 5 s after its timeout ends the session instead of blocking it.
  In dash, BusyBox `sh` and mksh an interrupt leaves only the innermost shell
  function or sourced file, as it does in bash older than 4.4 (macOS's
  `/bin/bash`) when a DEBUG trap is set.
- `name?` _string_
- `keepLogs?` _KeepLogs_ - How long the sandbox keeps the command's record and log (default `'on_exit_ttl'`).

***

## SessionJSON

A shell session's serialized identity (`session.toJSON()`), the same shape the Python SDK writes.

**Properties**:

- `sandboxId` _string_
- `sessionId` _string_

***

## ProcessHandleJSON

A process handle's serialized identity (`handle.toJSON()`), the same shape the Python SDK writes. Reconnect with `sandbox.process.connect(value)`.

**Properties**:

- `sandboxId` _string_
- `processId` _string_
- `kind?` _ProcessKind_

***

## ProcessKind

```ts
type ProcessKind = 'exec' | 'pty' | 'code' | 'session'
```

***

## ProcessReportedKind

```ts
type ProcessReportedKind = ProcessKind | 'unknown'
```

***

## ProcessState

```ts
type ProcessState = 'starting' | 'provisioning' | 'running' | 'terminal' | 'unknown'
```

***

## ProcessSignal

```ts
type ProcessSignal = 'TERM' | 'KILL' | 'INT' | 'HUP' | 'QUIT' | 'USR1' | 'USR2'
```

***

## ProcessReason

```ts
type ProcessReason = 'exited' | 'signaled' | 'timed_out' | 'lost' | 'failed' | 'unknown'
```

***

## KeepLogs

```ts
type KeepLogs = 'until_cleanup' | 'on_exit_ttl' | 'none'
```

***

## ProcessKeepLogs

```ts
type ProcessKeepLogs = KeepLogs | 'unknown'
```

***

## ProcessStdinMode

```ts
type ProcessStdinMode = 'closed' | 'open' | 'unknown'
```

***

## TerminalSize

PTY terminal dimensions, in character cells. A size you pass has `cols` and
`rows` each an integer from 1 to 65535 (checked before the request); a
Windows sandbox takes at most 32767 and refuses a larger one with
`BadRequestError`. A size the sandbox reports (a process's `terminal`) may be
any positive 32-bit integer.

**Properties**:

- `cols` _number_
- `rows` _number_

***

## ProcessInfo

Process metadata, as `process.get()` / `process.list()` report it.
Enum-backed fields are normalized to the values this release knows plus
`'unknown'`; the wire value is kept on the `raw*` sibling. `signal` is a
bare name (`'TERM'`), like `WaitResult.signal`. Timestamps are
RFC 3339 strings.

**Properties**:

- `id` _string_
- `kind` _ProcessReportedKind_
- `rawKind` _string_
- `state` _ProcessState_
- `rawState` _string_
- `cwd` _string_
- `stdin` _ProcessStdinMode_
- `rawStdin` _string_
- `keepLogs` _ProcessKeepLogs_
- `rawKeepLogs` _string_
- `createdAt` _string_
- `system` _boolean_
- `name?` _string_
- `tag?` _string_ - The tag the process was created with; a session command carries its session's tag. Never changes.
- `pid?` _number_
- `sessionId?` _string_
- `argv?` _readonly string\[\]_
- `shellCommand?` _string_
- `code?` _string_
- `language?` _string_
- `shell?` _string_
- `resolvedShell?` _string_
- `login?` _boolean_
- `user?` _string_
- `executionTimeoutSeconds?` _number_ - Server-side deadline in seconds.
- `terminal?` _TerminalSize_
- `exitCode?` _number_
- `signal?` _string_
- `reason?` _ProcessReason_
- `rawReason?` _string_
- `startedAt?` _string_
- `exitedAt?` _string_
- `truncatedHead` _boolean_
- `firstAvailableCursor?` _string_
- `lastCursor?` _string_

***

## WaitResult

How a process ended, or `reason: 'timed_out'` when the wait expired first.
`exitCode` and `signal` are set only when the sandbox reported them; the
SDK never fills them in. `reason` is normalized (`'unknown'` for a value
this release does not know, kept on `rawReason`).

**Properties**:

- `reason` _ProcessReason_
- `exitCode?` _number_
- `signal?` _string_
- `rawReason?` _string_

***

## StdinMode

```ts
type StdinMode = 'closed' | 'open'
```

***

## ProcessStartOptions

**Properties**:

- `name?` _string_
- `tag?` _string_ - Groups this process for `list({ tag })` and `killAll({ tag })`: a safe identifier (`[A-Za-z0-9._-]`, 1-128 characters, not `.` or `..`).
- `cwd?` _string_
- `env?` _Readonly\<Record\<string, string\>\>_
- `user?` _string_
- `shell?` _string_
- `login?` _boolean_
- `stdin?` _StdinMode_ - `'open'` keeps stdin open for `handle.writeStdin()`; default `'closed'`.
- `executionTimeoutSeconds?` _number_ - Server-side deadline in seconds; the sandbox kills the process tree when it expires. Omitted or `0` means no deadline.
- `keepLogs?` _KeepLogs_ - How long the sandbox keeps the process record and log (default `'on_exit_ttl'`).

***

## ProcessCommand

```ts
type ProcessCommand = string | { readonly cmd: string; readonly argv?: never } | { readonly argv: readonly string[]; readonly cmd?: never }
```

What to execute, as the first argument of `process.start()` / `process.run()` /
`sandbox.exec()`: a shell command string, or an object naming exactly one of
`cmd` (shell) or `argv` (exec, no shell — the safe form for untrusted
arguments). Mirrors Python's `command=` / `argv=` keywords.

***

## PtyStartOptions

Options of `pty.start()` / `pty.attach()`.

**Properties**:

- `terminal?` _TerminalSize_ - Terminal size; 80 columns by 24 rows when omitted (see `TerminalSize` for the limits).
- `cwd?` _string_
- `env?` _Readonly\<Record\<string, string\>\>_ - Extra environment; `TERM` defaults to `xterm-256color` unless set here.
- `name?` _string_
- `user?` _string_
- `shell?` _string_
- `login?` _boolean_
- `stdin?` _StdinMode_ - Default `'open'`.
- `executionTimeoutSeconds?` _number_ - Server-side deadline in seconds; omitted or `0` means no deadline.
- `keepLogs?` _KeepLogs_ - Default `'until_cleanup'`.
- `tag?` _string_ - Groups the PTY for `list({ tag })` and `killAll({ tag })` (a safe identifier, as for `tag` on start).

***

## RunKeepLogs

```ts
type RunKeepLogs = Exclude<KeepLogs, 'none'>
```

Retention for `run()` / `session.run()` / `sandbox.exec()`: the output is read back from the log, so `'none'` is not accepted.

***

## RunOptions

**Extends**: `Omit<ProcessStartOptions, 'keepLogs' | 'stdin'>`

**Properties**:

- `stdin?` _'closed'_ - Only `'closed'` (default): `run()` returns no handle to write to; use `start()` for open stdin.
- `keepLogs?` _RunKeepLogs_ - How long the sandbox keeps the process log (default `'on_exit_ttl'`).
- `timeoutSeconds?` _number_ - Caller wait budget in seconds; omitted or `0` waits until the process ends. Expiry does not kill the process.

***

## ProcessResult

`process.run()` result: how the process ended plus its collected output.

**Properties**:

- `reason` _ProcessReason_
- `exitCode?` _number_
- `signal?` _string_
- `rawReason?` _string_
- `processId` _string_
- `output` _string_
- `stdout` _string_
- `stderr` _string_
- `logs` _readonly LogFrame\[\]_ - The log frames the output was collected from.

***

## LogFrame

One replayable process log frame.

**Properties**:

- `cursor` _string_
- `channel` _'stdout' \| 'stderr' \| 'pty' \| 'setup' \| (string & \{\})_
- `data` _string_
- `timestampMs` _number_ - When the frame was written, in Unix milliseconds.

***

## LogPage

One page of a process log (`logs()`).

**Properties**:

- `items` _readonly LogFrame\[\]_ - The frames in this page.
- `nextCursor` _string_ - The cursor to pass to the next `logs()` call to continue after this page.
- `truncatedHead` _boolean_ - Whether retention removed frames older than this page.
- `eof` _boolean_ - Whether the process has ended and no frame follows this page.
- `firstAvailableCursor?` _string_ - The cursor of the oldest frame still kept, when older ones were removed.

***

## StreamLogEvent

```ts
type StreamLogEvent = StreamLogFrameEvent | StreamLogStateEvent | StreamLogWarningEvent | StreamLogEofEvent
```

***

## StreamLogEofEvent

`streamLogs()`: the log is complete; the stream ends after this event.

**Properties**:

- `type` _'eof'_
- `cursor` _string_

***

## StreamLogFrameEvent

`streamLogs()`: one log frame.

**Properties**:

- `type` _'log'_
- `cursor` _string_
- `frame` _LogFrame_

***

## StreamLogStateEvent

`streamLogs()`: the process became terminal.

**Properties**:

- `type` _'state'_
- `cursor` _string_
- `result` _WaitResult_

***

## StreamLogWarningEvent

`streamLogs()`: frames before `firstAvailableCursor` were evicted.

**Properties**:

- `type` _'warning'_
- `cursor` _string_
- `message` _string_
- `firstAvailableCursor` _string_

***

## LogsOptions

**Properties**:

- `cursor?` _string_
- `limit?` _number_
- `encoding?` _'text' \| 'base64'_ - `'text'` (default) or `'base64'`: each frame's `data` is then standard
  padded base64 (RFC 4648 section 4, `+/` alphabet with `=` padding), which
  `Buffer.from(data, 'base64')` (Node.js) or `atob(data)` decodes.

***

## StreamLogsOptions

**Properties**:

- `cursor?` _string_
- `limit?` _number_
- `encoding?` _'text' \| 'base64'_ - `'text'` (default) or `'base64'`: each frame's `data` is then standard
  padded base64 (RFC 4648 section 4, `+/` alphabet with `=` padding), which
  `Buffer.from(data, 'base64')` (Node.js) or `atob(data)` decodes.
- `signal?` _AbortSignal_

***

## WaitProcessOptions

**Properties**:

- `timeoutSeconds?` _number_ - Caller wait budget in seconds; omitted or `0` waits until the process ends.

***

## KillOptions

**Properties**:

- `signal?` _ProcessSignal_ - Default `'TERM'`.
- `escalateAfterSeconds?` _number_ - Send `escalateTo` if the process is still running this many seconds later.
- `escalateTo?` _ProcessSignal_ - Default `'KILL'`.

***

## ProcessListOptions

**Properties**:

- `tag?` _string_ - Only processes created with this tag (a safe identifier, as for `tag` on start).
- `state?` _'running' \| 'terminal' \| 'all'_
- `kind?` _ProcessKind_
- `sessionId?` _string_
- `name?` _string_
- `pid?` _number_

***

## KillAllOptions

Options of `process.killAll()`.

**Properties**:

- `tag` _string_ - The tag whose processes to kill: a safe identifier (`[A-Za-z0-9._-]`, 1-128 characters, not `.` or `..`).
- `timeoutSeconds?` _number_ - How long to wait for them to exit, in seconds: more than 0 and at most 60 (default 10).
