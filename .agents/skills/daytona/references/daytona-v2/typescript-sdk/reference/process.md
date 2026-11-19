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
- [ProcessDto](#processdto)
- [WaitResult](#waitresult)
- [ProcessStartOptions](#processstartoptions)
- [ProcessCommand](#processcommand)
- [RunOptions](#runoptions)
- [RunResult](#runresult)
- [LogFrame](#logframe)
- [LogsPage](#logspage)
- [StreamLogEvent](#streamlogevent)
- [LogsOptions](#logsoptions)
- [StreamLogsOptions](#streamlogsoptions)
- [KillOptions](#killoptions)
- [ProcessListOptions](#processlistoptions)

## ProcessHandle

**Properties**:

- `id` _string_
- `sandboxId` _string_
- `kind?` _ProcessKind_

### Constructors

#### Constructor

```ts
new ProcessHandle(
   transport: HttpTransport,
   sandboxId: string,
   processId: string,
   kind?: ProcessKind): ProcessHandle;
```

**Parameters**:

- `transport` _HttpTransport_
- `sandboxId` _string_
- `processId` _string_
- `kind?` _ProcessKind_

**Returns**:

- `ProcessHandle`

### Methods

#### attach()

```ts
attach(): Promise<PtyDuplex>;
```

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
get(): Promise<ProcessDto>;
```

**Returns**:

- `Promise<ProcessDto>`

#### kill()

```ts
kill(options: KillOptions = {}): Promise<void>;
```

**Parameters**:

- `options` _KillOptions = \{\}_

**Returns**:

- `Promise<void>`

#### logs()

```ts
logs(options: LogsOptions = {}): Promise<LogsPage>;
```

**Parameters**:

- `options` _LogsOptions = \{\}_

**Returns**:

- `Promise<LogsPage>`

#### resize()

```ts
resize(cols: number, rows: number): Promise<void>;
```

**Parameters**:

- `cols` _number_
- `rows` _number_

**Returns**:

- `Promise<void>`

#### streamLogs()

```ts
streamLogs(options: StreamLogsOptions = {}): AsyncIterable<StreamLogEvent>;
```

**Parameters**:

- `options` _StreamLogsOptions = \{\}_

**Returns**:

- `AsyncIterable<StreamLogEvent>`

#### toJSON()

```ts
toJSON(): ProcessHandleJSON;
```

**Returns**:

- `ProcessHandleJSON`

#### wait()

```ts
wait(options: WaitProcessOptions = {}): Promise<WaitResult>;
```

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

### Constructors

#### Constructor

```ts
new ProcessService(transport: HttpTransport, sandboxId: string): ProcessService;
```

**Parameters**:

- `transport` _HttpTransport_
- `sandboxId` _string_

**Returns**:

- `ProcessService`

### Methods

#### connect()

```ts
connect(idOrHandle: string | ProcessHandleJSON): ProcessHandle;
```

**Parameters**:

- `idOrHandle` _string \| ProcessHandleJSON_

**Returns**:

- `ProcessHandle`

#### connectSession()

```ts
connectSession(sessionIdOrJSON: string | SessionJSON): Session;
```

Rebind a shell session by id or serialized identity, without a request.

**Parameters**:

- `sessionIdOrJSON` _string \| SessionJSON_

**Returns**:

- `Session`

#### createSession()

```ts
createSession(options: CreateSessionOptions = {}): Promise<Session>;
```

Create one persistent shell. Set its cwd/env here, not on its commands.

**Parameters**:

- `options` _CreateSessionOptions = \{\}_

**Returns**:

- `Promise<Session>`

#### get()

```ts
get(id: string): Promise<ProcessDto>;
```

**Parameters**:

- `id` _string_

**Returns**:

- `Promise<ProcessDto>`

#### list()

```ts
list(options: ProcessListOptions = {}): Promise<ListResult<ProcessDto>>;
```

**Parameters**:

- `options` _ProcessListOptions = \{\}_

**Returns**:

- `Promise<ListResult<ProcessDto>>`

#### run()

```ts
run(command: ProcessCommand, options: RunOptions = {}): Promise<RunResult>;
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

- `Promise<RunResult>` - Output, stdout, stderr, logs and the exit result.

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

### Constructors

#### Constructor

```ts
new PtyService(process: ProcessService): PtyService;
```

**Parameters**:

- `process` _ProcessService_

**Returns**:

- `PtyService`

### Methods

#### attach()

```ts
attach(
   command?: string,
   options: Omit<ProcessStartOptions, 'cmd'> & { terminal?: TerminalSize } = {}): Promise<{ handle: ProcessHandle; connection: PtyDuplex }>;
```

**Parameters**:

- `command?` _string_
- `options` _Omit\<ProcessStartOptions, 'cmd'\> & \{ terminal?: TerminalSize \} = \{\}_

**Returns**:

- `Promise<{ handle: ProcessHandle; connection: PtyDuplex }>`

#### connect()

```ts
connect(idOrHandle: string | ProcessHandleJSON): ProcessHandle;
```

**Parameters**:

- `idOrHandle` _string \| ProcessHandleJSON_

**Returns**:

- `ProcessHandle`

#### delete()

```ts
delete(idOrHandle: string | ProcessHandleJSON): Promise<void>;
```

**Parameters**:

- `idOrHandle` _string \| ProcessHandleJSON_

**Returns**:

- `Promise<void>`

#### list()

```ts
list(): Promise<ListResult<ProcessDto>>;
```

**Returns**:

- `Promise<ListResult<ProcessDto>>`

#### start()

```ts
start(
   command?: string,
   options: Omit<ProcessStartOptions, 'cmd'> & { terminal?: TerminalSize } = {}): Promise<ProcessHandle>;
```

**Parameters**:

- `command?` _string_
- `options` _Omit\<ProcessStartOptions, 'cmd'\> & \{ terminal?: TerminalSize \} = \{\}_

**Returns**:

- `Promise<ProcessHandle>`

***

## Session

One persistent shell. Commands run one at a time, in order; `cd`, exports,
and functions carry over. Set cwd/env with `process.createSession()`.
Interrupt a command with `handle.kill({ signal: 'INT' })`: the session
survives. Sessions survive pause/resume, but not a sandbox stop/start.
After `set -x` or `set -v` in a session, later commands' stderr also includes
the shell wrapper used to run each command.

**Properties**:

- `sandboxId` _string_
- `id` _string_

### Constructors

#### Constructor

```ts
new Session(binding: ProcessBinding, id: string): Session;
```

**Parameters**:

- `binding` _ProcessBinding_
- `id` _string_

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
get(): Promise<ProcessDto>;
```

Read the shell process, including its current working directory.

**Returns**:

- `Promise<ProcessDto>`

#### run()

```ts
run(command: string, options: SessionRunOptions = {}): Promise<RunResult>;
```

Run in this shell, wait, and collect output using the process run path.

**Parameters**:

- `command` _string_
- `options` _SessionRunOptions = \{\}_

**Returns**:

- `Promise<RunResult>`

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

**Returns**:

- `SessionJSON`

***

## PtyDuplex

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

- `cwd?` _string_
- `env?` _Readonly\<Record\<string, string\>\>_
- `shell?` _string_ - A POSIX shell (bash, sh, dash, zsh, ksh) on Linux and macOS; another
  shell is refused when the session is created.
- `login?` _boolean_
- `name?` _string_

***

## SessionRunOptions

**Properties**:

- `stdin?` _'closed' \| 'open'_
- `executionTimeout?` _number_ - Server-side command deadline in milliseconds. The clock starts when the
  command starts, after any queued commands ahead of it.
  The command is stopped and the session survives; a command that has not
  stopped 5 s after its timeout ends the session instead of blocking it.
  In dash, BusyBox `sh` and mksh an interrupt leaves only the innermost shell
  function or sourced file, as it does in bash older than 4.4 (macOS's
  `/bin/bash`) when a DEBUG trap is set.
- `name?` _string_
- `keepLogs?` _KeepLogs_
- `timeout?` _number_ - Caller wait budget in milliseconds; omitted or 0 waits unbounded.

***

## SessionStartOptions

**Properties**:

- `stdin?` _'closed' \| 'open'_
- `executionTimeout?` _number_ - Server-side command deadline in milliseconds. The clock starts when the
  command starts, after any queued commands ahead of it.
  The command is stopped and the session survives; a command that has not
  stopped 5 s after its timeout ends the session instead of blocking it.
  In dash, BusyBox `sh` and mksh an interrupt leaves only the innermost shell
  function or sourced file, as it does in bash older than 4.4 (macOS's
  `/bin/bash`) when a DEBUG trap is set.
- `name?` _string_
- `keepLogs?` _KeepLogs_

***

## SessionJSON

**Properties**:

- `sandboxId` _string_
- `sessionId` _string_

***

## ProcessHandleJSON

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

```ts
type TerminalSize = toolbox.TerminalSize
```

***

## ProcessDto

**Properties**:

- `id` _string_
- `name?` _string_
- `pid?` _number_
- `kind` _ProcessReportedKind_
- `rawKind` _string_
- `state` _ProcessState_
- `rawState` _string_
- `system` _boolean_
- `sessionId?` _string_
- `argv?` _string\[\]_
- `shellCommand?` _string_
- `code?` _string_
- `language?` _string_
- `shell?` _string_
- `resolvedShell?` _string_
- `login?` _boolean_
- `cwd?` _string_
- `user?` _string_
- `stdin?` _ProcessStdinMode_
- `rawStdin?` _string_
- `executionTimeout?` _number_ - Server-managed process deadline in milliseconds.
- `terminal?` _TerminalSize_
- `keepLogs?` _ProcessKeepLogs_
- `rawKeepLogs?` _string_
- `exitCode?` _number_
- `signal?` _string_
- `reason?` _ProcessReason_
- `rawReason?` _string_
- `createdAt?` _string_
- `startedAt?` _string_
- `exitedAt?` _string_
- `truncatedHead?` _boolean_
- `firstAvailableCursor?` _string_
- `lastCursor?` _string_

***

## WaitResult

```ts
type WaitResult =
  | { reason: 'exited'; exitCode: number; signal?: undefined; rawReason?: string }
  | { reason: 'signaled'; signal: string; exitCode?: undefined; rawReason?: string }
  | { reason: 'timed_out'; exitCode?: undefined; signal?: undefined; rawReason?: string }
  | { reason: 'lost' | 'failed'; exitCode?: number; signal?: string; rawReason?: string }
  | { reason: 'unknown'; exitCode?: number; signal?: string; rawReason: string }
```

***

## ProcessStartOptions

**Properties**:

- `cmd?` _string_
- `argv?` _string\[\]_
- `name?` _string_
- `cwd?` _string_
- `env?` _Record\<string, string\>_
- `user?` _string_
- `shell?` _string_
- `login?` _boolean_
- `stdin?` _'closed' \| 'open'_
- `executionTimeout?` _number_ - Server-managed process deadline in milliseconds.
- `terminal?` _TerminalSize_
- `keepLogs?` _KeepLogs_

***

## ProcessCommand

```ts
type ProcessCommand = string | { cmd: string; argv?: never } | { argv: readonly string[]; cmd?: never }
```

What to execute, as the first argument of `process.start()` / `process.run()` /
`sandbox.exec()`: a shell command string, or an object naming exactly one of
`cmd` (shell) or `argv` (exec, no shell — the safe form for untrusted
arguments). Mirrors Python's `command=` / `argv=` keywords.

***

## RunOptions

```ts
type RunOptions = Omit<ProcessStartOptions, 'kind'> & {
  /** Caller wait budget in milliseconds; `0` waits unbounded. */
  timeout?: number
  /** `run()` only creates exec processes; PTYs come from `sandbox.pty.start()` / `attach()`. */
  kind?: 'exec'
}
```

***

## RunResult

```ts
type RunResult = WaitResult & {
  processId: string
  output: string
  stdout: string
  stderr: string
  logs: LogFrame[]
}
```

***

## LogFrame

**Properties**:

- `cursor` _string_
- `channel` _'stdout' \| 'stderr' \| 'pty' \| 'setup' \| string_
- `data` _string_
- `encoding?` _'text' \| 'base64' \| string_
- `timestamp?` _number_

***

## LogsPage

**Extends**: `ListResult<LogFrame>`

**Properties**:

- `truncatedHead?` _boolean_
- `firstAvailableCursor?` _string_

***

## StreamLogEvent

```ts
type StreamLogEvent =
  | { type: 'log'; cursor?: string; frame: LogFrame }
  | { type: 'state'; cursor?: string; result: WaitResult }
  | { type: 'warning'; cursor?: string; message: string; firstAvailableCursor?: string }
  | { type: 'eof'; cursor?: string }
  | { type: 'error'; cursor?: string; error: Error }
```

***

## LogsOptions

**Properties**:

- `cursor?` _string_
- `limit?` _number_
- `encoding?` _'text' \| 'base64'_

***

## StreamLogsOptions

**Properties**:

- `cursor?` _string_
- `limit?` _number_
- `encoding?` _'text' \| 'base64'_
- `signal?` _AbortSignal_

***

## KillOptions

**Properties**:

- `signal?` _ProcessSignal_
- `escalateAfter?` _number_
- `escalateTo?` _ProcessSignal_

***

## ProcessListOptions

**Properties**:

- `state?` _'running' \| 'terminal' \| 'all'_
- `kind?` _ProcessKind_
- `sessionId?` _string_
- `name?` _string_
- `pid?` _number_
