# Sandbox (TypeScript SDK reference)

## Contents

- [Sandbox](#sandbox)
- [UpdateEnvOptions](#updateenvoptions)
- [SandboxEventsConfig](#sandboxeventsconfig)
- [SandboxState](#sandboxstate)
- [SandboxWaitState](#sandboxwaitstate)
- [SandboxClass](#sandboxclass)
- [SandboxLifecycle](#sandboxlifecycle)
- [SandboxHandleJSON](#sandboxhandlejson)
- [WaitOptions](#waitoptions)
- [SandboxSearchFilters](#sandboxsearchfilters)
- [SandboxSecretsInfo](#sandboxsecretsinfo)
- [PreviewEndpoint](#previewendpoint)
- [PreviewLink](#previewlink)
- [SignedPreviewLink](#signedpreviewlink)
- [CreateAccessTokenOptions](#createaccesstokenoptions)
- [SandboxAccessToken](#sandboxaccesstoken)
- [SystemMetrics](#systemmetrics)
- [IfMatchOptions](#ifmatchoptions)
- [ForkOptions](#forkoptions)
- [MacBootMode](#macbootmode)

## Sandbox

### Constructors

#### Constructor

```ts
new Sandbox(token: Internal, init: never): Sandbox;
```

Built by the SDK: get a sandbox from `daytona.v2.create*()`, `get()` or `list()`.

**Parameters**:

- `token` _Internal_
- `init` _never_

**Returns**:

- `Sandbox`

### Methods

#### \[Symbol.asyncDispose\]()

```ts
[Symbol.asyncDispose](): Promise<void>;
```

Dispose by deleting the sandbox when constructed with `autoDelete`.

**Returns**:

- `Promise<void>`

#### accessToken

```ts
get accessToken(): string | undefined;
```

The sandbox-scoped bearer currently used: from create, a caller override, or minting.
Undefined until known; never serialized.

**Returns**:

- `string | undefined`

#### accessTokenExpiresAt

```ts
get accessTokenExpiresAt(): string | undefined;
```

Expiry of `accessToken` (RFC 3339), when known. Undefined for the
opaque `dtnv_` create token (no known expiry) and for
handles without a token.

**Returns**:

- `string | undefined`

#### buildLogs()

```ts
buildLogs(): Promise<string>;
```

Return retained build output as one-shot text, not a live follower.
The body includes the current build state and available output.
A sandbox with no image build (for example a registry image) throws
`NotFoundError`. Output can be incomplete while the build is in progress;
truncation is indicated in the text.
Use followBuildLogs for live output and completeness metadata.

**Returns**:

- `Promise<string>`

#### captureImage()

```ts
captureImage(options: CaptureImageOptions = {}): Promise<Image>;
```

Snapshot this sandbox's filesystem as a new `Image`
(`POST /sandboxes/{id}/images`). The result boots new sandboxes
(`daytona.create(image.id)`); a Linux sandbox keeps running. A macOS sandbox must be persistent and
stopped; the capture answers `DISK_NOT_READY` while its disk is not ready
yet (retry later). The credential needs `write:sandboxes` in addition to
`write:images`; without it the capture throws `ForbiddenError` (403).

**Parameters**:

- `options` _CaptureImageOptions = \{\}_

**Returns**:

- `Promise<Image>`

#### computerUse

```ts
get computerUse(): ComputerUseService;
```

**Returns**:

- `ComputerUseService`

#### cpu

```ts
get cpu(): number | undefined;
```

Reserved CPU (the guarantee), in cores (1 core = 2 vCPUs; a macOS core is one Mac CPU).

**Returns**:

- `number | undefined`

#### cpuMax

```ts
get cpuMax(): number | undefined;
```

CPU limit (the boot shape), in cores; undefined when the API did not report it.

**Returns**:

- `number | undefined`

#### createAccessToken()

```ts
createAccessToken(options: CreateAccessTokenOptions = {}): Promise<SandboxAccessToken>;
```

Mint a scoped, short-lived access token for THIS sandbox.

The token authorizes sandbox services (toolbox, SSH, desktop,
private previews) and the self-service API routes, for exactly the
granted operations and ports — hand it to a collaborator, a CI job, or a
browser instead of a project API key. It expires at `expiresAt`, cannot be
refreshed, and can never mint further credentials; mint a fresh one here
instead. An unknown operation or an over-cap `ttlSeconds` is a 400, never a
silent narrowing.

**Parameters**:

- `options` _CreateAccessTokenOptions = \{\}_

**Returns**:

- `Promise<SandboxAccessToken>`

#### createSnapshot()

```ts
createSnapshot(name: string): Promise<Snapshot>;
```

Capture this sandbox, memory and disk, as a new `Snapshot`
(`POST /sandboxes/{id}/snapshots`). The credential needs `write:sandboxes`
in addition to `write:snapshots`; without it the capture throws
`ForbiddenError` (403).

**Parameters**:

- `name` _string_

**Returns**:

- `Promise<Snapshot>`

#### delete()

```ts
delete(options: LifecycleWaitOptions = {}): Promise<void>;
```

Delete the sandbox and wait until destroyed (or no longer found). An
`error` state throws `SandboxTerminalStateError`; one the events hub
reports is confirmed with one read first, while the wait has budget left
and unless it already came from a full read.
Returning, a `destroyed` state, or a subsequent 404 does not guarantee that
the image can already be deleted. Image deletion may still return 409.

**Parameters**:

- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

#### disk

```ts
get disk(): number | undefined;
```

**Returns**:

- `number | undefined`

#### diskMax

```ts
get diskMax(): number | undefined;
```

**Returns**:

- `number | undefined`

#### docker

```ts
get docker(): DockerService;
```

Docker Engine status inside the sandbox; see `DockerService`.

**Returns**:

- `DockerService`

#### entrypointLogs()

```ts
entrypointLogs(): Promise<string>;
```

Return the sandbox entrypoint log as plain text.

**Returns**:

- `Promise<string>`

#### error

```ts
get error(): string | undefined;
```

**Returns**:

- `string | undefined`

#### exec()

```ts
exec(command: ProcessCommand, options: RunOptions = {}): Promise<ProcessResult>;
```

Run a command, wait for its shell to exit, and collect its output.

A convenience alias for `ProcessService.run` — identical behaviour,
same parameters, same return value.

**Shell selection.** Passing a string runs the command through the sandbox
shell: `bash` when the image has it, else `sh`. Pass `shell` to pin another
interpreter, and quote globs and brackets (`pip install -e '.[test]'`)
so the command means the same under any shell. Pass `{ argv: [...] }` to
bypass the shell entirely, which is the safe form for untrusted arguments.
Use `process.createSession()` when commands need shared shell state.

**Background processes.** The call returns when the shell exits. If the
command launches a background child that holds its output descriptors open
(e.g. `python3 -m http.server 8000 &`), execution waits at most ~2
seconds for output to drain and then returns; output the child writes later
is not part of the result. For a long-running server use
`ProcessService.start`, which returns a `ProcessHandle`
immediately (logs, wait, kill). Alternatively redirect:
`nohup cmd > server.log 2>&1 &`.

**Parameters**:

- `command` _ProcessCommand_ - Shell command string, or `{ argv }` for shell-free execution.
- `options` _RunOptions = \{\}_

**Returns**:

- `Promise<ProcessResult>`

#### followBuildLogs()

```ts
followBuildLogs(options: BuildLogFollowOptions): Promise<BuildLogFollowResult>;
```

Observe this sandbox's build without changing its execution lifetime.
An HTTP error of the initial discovery request, including a 404 for a
sandbox with no image build, throws its typed error (`NotFoundError`, ...)
unchanged; once the follower is running, a failure throws
BuildLogInterruptedError with the last cursor. It does not fall back to
another log source.

**Parameters**:

- `options` _BuildLogFollowOptions_

**Returns**:

- `Promise<BuildLogFollowResult>`

#### fork()

```ts
fork(options: ForkOptions = {}): Promise<Sandbox>;
```

Fork this sandbox and return the fork handle.

By default the fork continues from the source's memory (running processes
included). `memory: false` copies only the disk, after which the fork boots
fresh. A stopped sandbox is always forked
disk-only. Only a fork of a RUNNING sandbox is started automatically; a
fork of a paused source rests `paused` (memory fork, call `resume()`) or
`stopped` (`memory: false`), and a fork of a stopped source rests
`stopped` — call `start()` on those.

A macOS fork copies the disk only: omit `memory` or pass `memory: false`
(`memory: true` is refused with `NOT_SUPPORTED_FOR_CLASS`). A fork of a
running macOS sandbox boots with a fresh machine identity; a fork of a
paused or stopped one rests `stopped`. A macOS fork answers
`DISK_NOT_READY` while the source's disk is not ready yet; retry later.

`waitSeconds` defaults to 60; 0 returns at acceptance without any GET,
and a value above about 24.8 days waits without a deadline. A running
source's fork waits for `started`, past a macOS fork's temporary `stopped`
state while the source releases its disk. A paused or stopped macOS
source's fork waits for `stopped`; Linux uses the resting states above.
Like `create()`, the wait returns the handle when its budget expires or
the fork fails: even the default 60 seconds may return a not-yet-started
handle. Check the returned handle's `state`.

**Parameters**:

- `options` _ForkOptions = \{\}_

**Returns**:

- `Promise<Sandbox>`

#### forkedFrom

```ts
get forkedFrom(): string | undefined;
```

**Returns**:

- `string | undefined`

#### fs

```ts
get fs(): FileSystemService;
```

**Returns**:

- `FileSystemService`

#### getNetworkPolicy()

```ts
getNetworkPolicy(): Promise<NetworkPolicyInfo>;
```

**Returns**:

- `Promise<NetworkPolicyInfo>`

#### getSecrets()

```ts
getSecrets(): Promise<SandboxSecretsInfo>;
```

Read this sandbox's attached secret names and their apply state (`GET /sandboxes/{id}/secrets`).
Returns names and revisions only, never values. `etag` is the `ifMatch` value for
`replaceSecrets`; `status` is `pending` until the sandbox has applied `desiredRevision`.

**Returns**:

- `Promise<SandboxSecretsInfo>`

#### git

```ts
get git(): GitService;
```

**Returns**:

- `GitService`

#### id

```ts
get id(): string;
```

The sandbox id, fixed for the handle's lifetime (read-only at run time too).

**Returns**:

- `string`

#### image

```ts
get image(): ImageRef | undefined;
```

The image the sandbox booted; undefined for a snapshot restore or before it is known.

**Returns**:

- `ImageRef | undefined`

#### imageBuildId

```ts
get imageBuildId(): string | undefined;
```

**Returns**:

- `string | undefined`

#### interpreter

```ts
get interpreter(): InterpreterService;
```

**Returns**:

- `InterpreterService`

#### labels

```ts
get labels(): Readonly<Record<string, string>> | undefined;
```

The sandbox labels; undefined until the API has reported them (a
`create*()` or `fork()` handle whose wait read nothing holds only what the
create response carries: call `refreshData()` to load them). Replace them
with `setLabels()`.

**Returns**:

- `Readonly<Record<string, string>> | undefined`

#### lifecyclePolicy

```ts
get lifecyclePolicy(): SandboxLifecycle | undefined;
```

**Returns**:

- `SandboxLifecycle | undefined`

#### macBootMode

```ts
get macBootMode(): MacBootMode | undefined;
```

macOS only: how the sandbox resumed, as reported by the API. Undefined
for any other class and for a sandbox not resumed since it last booted.

**Returns**:

- `MacBootMode | undefined`

#### memory

```ts
get memory(): number | undefined;
```

**Returns**:

- `number | undefined`

#### memoryMax

```ts
get memoryMax(): number | undefined;
```

**Returns**:

- `number | undefined`

#### metrics()

```ts
metrics(): Promise<SystemMetrics>;
```

A snapshot of the sandbox's CPU, memory and disk usage.

**Returns**:

- `Promise<SystemMetrics>`

#### name

```ts
get name(): string | undefined;
```

**Returns**:

- `string | undefined`

#### pause()

```ts
pause(options: LifecycleWaitOptions = {}): Promise<void>;
```

Pause the sandbox with its memory and wait until it is paused.
A return to started means the pause failed. A paused macOS sandbox keeps
its memory on its Mac. With auto-renew on, it keeps its reservation
renewing; otherwise the sandbox is stopped, with its disk, before the
reservation ends.

**Parameters**:

- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

#### persistent

```ts
get persistent(): boolean | undefined;
```

macOS only: whether the sandbox preserves its disk when stopped; undefined on a
 handle whose metadata has not been loaded yet.

**Returns**:

- `boolean | undefined`

#### ports

```ts
get ports(): PortsService;
```

**Returns**:

- `PortsService`

#### process

```ts
get process(): ProcessService;
```

**Returns**:

- `ProcessService`

#### pty

```ts
get pty(): PtyService;
```

**Returns**:

- `PtyService`

#### rawSandboxClass

```ts
get rawSandboxClass(): string | undefined;
```

**Returns**:

- `string | undefined`

#### rawState

```ts
get rawState(): string | undefined;
```

**Returns**:

- `string | undefined`

#### refreshData()

```ts
refreshData(): Promise<void>;
```

Refresh sandbox metadata from the API.

**Returns**:

- `Promise<void>`

#### region

```ts
get region(): string | undefined;
```

**Returns**:

- `string | undefined`

#### replaceSecrets()

```ts
replaceSecrets(
   secrets: readonly string[],
   options: IfMatchOptions): Promise<SandboxSecretsInfo>;
```

Replace the full set of project secrets attached to this sandbox (`PUT /sandboxes/{id}/secrets`).
`secrets` names project secrets. `ifMatch` is the
`etag` of the last read; a stale one throws `PreconditionFailedError`. The change applies
asynchronously: poll `getSecrets` until `status` is `applied`. Running processes keep their
environment; processes started afterwards see the new names.

**Parameters**:

- `secrets` _readonly string\[\]_
- `options` _IfMatchOptions_

**Returns**:

- `Promise<SandboxSecretsInfo>`

#### reservationId

```ts
get reservationId(): string | undefined;
```

macOS only: the ID of the reservation selected for this sandbox.
Unset before a reservation is selected, and on search results
(`search()`), which omit it; `refreshData()` reads it.

**Returns**:

- `string | undefined`

#### resetIdleTimer()

```ts
resetIdleTimer(): Promise<SandboxLifecycle>;
```

Reset this sandbox's idle timer: an explicit keepalive for work the
platform cannot see.

Bumps the sandbox's activity clock (`lastActivityAt`, attributed
server-side to the `api` source), which restarts the idle countdown —
`idleTimeoutAt` re-anchors to now + `idleExpirySeconds`. The wall-clock
`timeoutAt` is NOT affected. Succeeds whether or not an idle timeout is
armed (an unarmed sandbox echoes `idleTimeoutAt: undefined`), and in any
state but deleting or deleted — a never-started sandbox already carries
its creation-time activity stamp, which the reset advances. A sandbox
that is deleted or being deleted throws `ConflictError` (`CONFLICT`).

The echo is the full post-reset lifecycle, the same shape
`updateLifecyclePolicy()` returns. Advance-only: a newer concurrent activity bump
keeps the clock, and what comes back is the state that won.

**Returns**:

- `Promise<SandboxLifecycle>`

#### resetNetworkPolicy()

```ts
resetNetworkPolicy(options: IfMatchOptions): Promise<NetworkPolicyInfo>;
```

**Parameters**:

- `options` _IfMatchOptions_

**Returns**:

- `Promise<NetworkPolicyInfo>`

#### resume()

```ts
resume(options: LifecycleWaitOptions = {}): Promise<void>;
```

Resume a paused sandbox and wait until it is started.
A return to stopped means the resume failed.

**Parameters**:

- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

#### rotateSigningKey()

```ts
rotateSigningKey(): Promise<void>;
```

Rotate the sandbox's signing key: every pre-signed URL minted so far stops
working within ~30 s; new URLs from presignedDownloadUrl/UploadUrl use the
new key. The key itself is never returned.

**Returns**:

- `Promise<void>`

#### runCode()

```ts
runCode(code: string, options: InterpreterRunOptions = {}): Promise<InterpreterResult>;
```

Execute code and return its result: an alias for `InterpreterService.run`, same options.

**Parameters**:

- `code` _string_
- `options` _InterpreterRunOptions = \{\}_

**Returns**:

- `Promise<InterpreterResult>`

#### sandboxClass

```ts
get sandboxClass(): SandboxClass | 'unknown' | undefined;
```

Undefined before the class is known; future wire classes normalize to `unknown`.

**Returns**:

- `SandboxClass | 'unknown' | undefined`

#### setLabels()

```ts
setLabels(labels: Record<string, string>): Promise<Readonly<Record<string, string>>>;
```

Replace the sandbox's labels; pass `{}` to clear all but `name`. Resolves
to the applied labels. The reserved `name` label, which `findByName()` and
a `name` label search match, is kept unless `labels` sets it: without a
`name` key the sandbox is read first (one more request, which also
refreshes this handle's metadata) and the `name` label it reports, if any,
is sent along (a read without labels reports none); the read and the write are not atomic. The `name` label cannot
be removed. An empty label key is refused with `BadRequestError` before
any request. A sandbox that is deleted or being deleted throws
`ConflictError` (`CONFLICT`); one the API no longer finds throws
`NotFoundError`.

**Parameters**:

- `labels` _Record\<string, string\>_

**Returns**:

- `Promise<Readonly<Record<string, string>>>`

#### snapshot

```ts
get snapshot(): SnapshotRef | undefined;
```

The memory snapshot the sandbox resumed; undefined when it booted an image or before it is known.

**Returns**:

- `SnapshotRef | undefined`

#### spot

```ts
get spot(): boolean | undefined;
```

**Returns**:

- `boolean | undefined`

#### spotEvictedAt

```ts
get spotEvictedAt(): string | undefined;
```

**Returns**:

- `string | undefined`

#### start()

```ts
start(options: LifecycleWaitOptions = {}): Promise<void>;
```

Start a stopped sandbox, or resume a paused one, and wait until it is started.
If stop or pause is still in progress, wait for it to settle before
sending start or resume, using the same timeout budget.

A stopped macOS sandbox starts with its disk and size on any Mac of the
organization; after a start on a different Mac, iCloud asks the user to
sign in again. It throws `ConflictError` with `DISK_NOT_READY` while its
disk is not ready yet (retry later), `NO_FREE_SLOT` when no Mac of the
organization has space for its size, `MAC_DISK_FULL` when the Mac with
space is low on free disk space, and `NO_ACTIVE_RESERVATION` when the
organization has no Mac reservation in the region and auto-reserve is off.
When the organization has no Mac reservation in the region and
auto-reserve is on, the start buys one, so it can fail as a create that
buys one does:
`LimitExceededError` with `limit === 'max_mac_reservations'` at the
organization's Mac reservation limit, `AUTO_RESERVE_LIMIT_REACHED`,
`NO_MAC_AVAILABLE`, `INSUFFICIENT_BALANCE` or `CHARGE_FAILED`.

**Parameters**:

- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

#### state

```ts
get state(): SandboxState;
```

The last observed state; `unknown` before any read and for a state this SDK does not know.

**Returns**:

- `SandboxState`

#### stop()

```ts
stop(options: LifecycleWaitOptions = {}): Promise<void>;
```

Stop the sandbox and wait until it is stopped. While it is stopped, toolbox
calls (process, files, git, …) and its preview URLs answer
`SandboxNotRunningError` (409, `SANDBOX_NOT_RUNNING`); `start()` it first.

**Parameters**:

- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

#### toJSON()

```ts
toJSON(): SandboxHandleJSON;
```

The sandbox's data as JSON. A snapshot, not a way back: resume a stored
sandbox with `daytona.get(info.sandboxId)`. It carries no toolbox URL —
where a credential goes always comes from the API or an explicit
caller option, never from stored data.

**Returns**:

- `SandboxHandleJSON`

#### updateEnv()

```ts
updateEnv(
   env: Record<string, string> = {},
   options: UpdateEnvOptions = {}): Promise<void>;
```

Update the extra environment layer used by processes created after this call.

**Parameters**:

- `env` _Record\<string, string\> = \{\}_
- `options` _UpdateEnvOptions = \{\}_

**Returns**:

- `Promise<void>`

#### updateLifecyclePolicy()

```ts
updateLifecyclePolicy(options: LifecyclePolicyOptions): Promise<SandboxLifecycle>;
```

Update this sandbox's lifecycle policy; omitted knobs stay unchanged.

`timeoutSeconds` re-anchors the deadline from now (`>= 1`; the timeout cannot
be disabled). `idleExpirySeconds: DISABLED` clears the idle pair; arming it on
a sandbox with no idle policy requires `onIdleTimeout`.

Setting either action to `'delete'` — or touching a pair whose current or
resulting action is `'delete'` — requires the API key to hold
`delete:sandboxes` in addition to `write:sandboxes`. A sandbox that is
deleted or being deleted throws `ConflictError` (`CONFLICT`).

**Parameters**:

- `options` _LifecyclePolicyOptions_

**Returns**:

- `Promise<SandboxLifecycle>`

#### updateNetworkPolicy()

```ts
updateNetworkPolicy(
   networkPolicy: NetworkPolicyInput,
   options: IfMatchOptions): Promise<NetworkPolicyInfo>;
```

**Parameters**:

- `networkPolicy` _NetworkPolicyInput_
- `options` _IfMatchOptions_

**Returns**:

- `Promise<NetworkPolicyInfo>`

#### user

```ts
get user(): string | undefined;
```

**Returns**:

- `string | undefined`

#### volumes

```ts
get volumes(): SandboxVolumesService;
```

**Returns**:

- `SandboxVolumesService`

#### wait()

```ts
wait(options: WaitOptions = {}): Promise<this>;
```

Wait for one or more public sandbox states.

`timeoutSeconds` is a caller wait budget in seconds. The default is 60; `0`,
or a value above about 24.8 days (the timer maximum), waits without a deadline. Timeout raises `RequestTimeoutError`, and
a terminal state before the target raises `SandboxTerminalStateError`.
A terminal state the events hub reports is confirmed with one read before it raises,
while the wait has budget left, unless that state already came from a full read or
is `destroyed`. When the events hub has reported nothing decisive, the last part
of a bounded budget (up to 5 s) reads the state from the server, so a state the
hub missed still ends the wait; the same holds for the other lifecycle waits and
the create and fork waits.

**Parameters**:

- `options` _WaitOptions = \{\}_

**Returns**:

- `Promise<this>`

***

## UpdateEnvOptions

**Properties**:

- `unset?` _readonly string\[\]_

***

## SandboxEventsConfig

Configuration for the sandbox-state events hub (WebSocket-based waiting).

`enabled` defaults to `true`. `reconcileIntervalSeconds` defaults to 60;
`0` disables the periodic re-subscribe timer. `idleCloseSeconds` closes the
events socket that long after its last waiter leaves; unset, the socket
stays open. In Node an idle socket does not keep the process alive, so a
script that never calls `daytona.close()` still exits; a runtime where the
socket cannot be released that way (no `ws` package) closes it after
10 seconds instead. `0` keeps the socket open until `close()`.

**Properties**:

- `enabled?` _boolean_ - Enable WebSocket-based waiting; default `true`.
- `reconcileIntervalSeconds?` _number_ - Reconcile timer interval in seconds; default 60; `0` disables. A negative
  or non-finite value is a `BadRequestError`; values above about 24 days
  clamp to that maximum.
- `idleCloseSeconds?` _number_ - Close an idle events socket after this many seconds. Default: never,
  except 10 seconds where an idle socket would keep the process alive.
  `0` = never. A negative or non-finite value is a `BadRequestError`;
  values above about 24 days clamp to that maximum.

***

## SandboxState

```ts
type SandboxState =
  | 'queued'
  | 'creating'
  | 'starting'
  | 'started'
  | 'pausing'
  | 'stopping'
  | 'stopped'
  | 'paused'
  | 'destroying'
  | 'destroyed'
  | 'error'
  | 'unknown'
```

***

## SandboxWaitState

```ts
type SandboxWaitState = Exclude<SandboxState, 'creating' | 'error' | 'unknown'>
```

***

## SandboxClass

```ts
type SandboxClass = 'linux' | 'macos'
```

***

## SandboxLifecycle

Lifecycle policy as the API reports it.

`timeoutSeconds` is the re-arm budget in seconds; `timeoutAt` is the
current absolute deadline it derives.
`timeoutAt`, `idleTimeoutAt`, `lastActivityAt` and `lastActivitySource` are
server-derived and read-only. An action the SDK does not know yet (a newer
server) is passed through as its wire string.

**Properties**:

- `timeoutSeconds?` _number_
- `onTimeout?` _string_
- `timeoutAt?` _string_
- `idleExpirySeconds?` _number_
- `onIdleTimeout?` _string_
- `idleTimeoutAt?` _string_ - When `onIdleTimeout` becomes eligible to fire:
  `lastActivityAt + idleExpirySeconds`, server-derived and read-only.
  Undefined when the idle pair is not armed or the sandbox has never been
  active. Any activity — traffic, SSH, a non-PTY process or code execution
  started through the process API that is still running (`exec`,
  `process.start`, `runCode` and interpreter cells included), or
  `sandbox.resetIdleTimer()` — advances `lastActivityAt` and pushes it.
- `lastActivityAt?` _string_
- `lastActivitySource?` _string_

***

## SandboxHandleJSON

**Properties**:

- `sandboxId` _string_
- `name?` _string_
- `image?` _ImageRef_
- `snapshot?` _SnapshotRef_
- `cpu?` _number_
- `cpuMax?` _number_
- `memory?` _number_
- `memoryMax?` _number_
- `disk?` _number_
- `diskMax?` _number_
- `state?` _SandboxState_
- `rawState?` _string_
- `error?` _string_
- `imageBuildId?` _string_
- `sandboxClass?` _SandboxClass \| 'unknown'_
- `rawSandboxClass?` _string_
- `labels?` _Readonly\<Record\<string, string\>\>_
- `region?` _string_
- `persistent?` _boolean_
- `spot?` _boolean_
- `spotEvictedAt?` _string_
- `lifecyclePolicy?` _SandboxLifecycle_
- `forkedFrom?` _string_
- `reservationId?` _string_
- `user?` _string_

***

## WaitOptions

**Properties**:

- `until?` _SandboxWaitState \| readonly SandboxWaitState\[\]_
- `timeoutSeconds?` _number_

***

## SandboxSearchFilters

Filters for `Daytona.search()`.

`states`, `sandboxClass` and `region` take a single value or a list. `states`
uses the SDK lifecycle names. `labels` is sent as a JSON object string
(containment match); numeric bounds and timestamp starts are inclusive;
timestamp ends are exclusive.

**Properties**:

- `q?` _string_ - Free text over name and image; also an exact match when it is a sandbox id.
- `states?` _Exclude\<SandboxState, 'unknown'\> \| readonly Exclude\<SandboxState, 'unknown'\>\[\]_ - SDK lifecycle states; `creating` and `error` each match multiple server states.
- `sandboxClass?` _SandboxClass \| readonly SandboxClass\[\]_ - A single value or a list (any-of).
- `region?` _string \| readonly string\[\]_ - A single value or a list (any-of) over region IDs. A region that contains
  other regions (a geo group, or `earth`) matches every region inside it; an
  unknown region is a `BadRequestError` from the API.
- `imageRef?` _string_
- `imageRefPrefix?` _string_
- `labels?` _Readonly\<Record\<string, string\>\>_ - Containment: every listed label must match.
- `spot?` _boolean_
- `forkedFrom?` _string_ - Sandboxes forked from this sandbox id.
- `minCores?` _number_ - Inclusive bounds on `cores_max` (the CPU limit), in cores (1 core = 2 vCPUs).
- `maxCores?` _number_
- `minMemoryMib?` _number_
- `maxMemoryMib?` _number_
- `minDiskMib?` _number_
- `maxDiskMib?` _number_
- `createdStartAt?` _SearchTimestamp_
- `createdEndAt?` _SearchTimestamp_
- `updatedStartAt?` _SearchTimestamp_
- `updatedEndAt?` _SearchTimestamp_
- `lastActivityStartAt?` _SearchTimestamp_
- `lastActivityEndAt?` _SearchTimestamp_
- `sort?` _SearchSort_ - Defaults to `created_at`.
- `order?` _SearchOrder_ - Defaults to `desc`.

***

## SandboxSecretsInfo

**Properties**:

- `secrets` _readonly string\[\]_
- `desiredRevision` _number_
- `etag` _string_
- `appliedRevision?` _number_
- `status?` _string_
- `error?` _string_
- `captureStatus?` _string_
- `captureUnresolvedCount?` _number_

***

## PreviewEndpoint

**Properties**:

- `port` _number_
- `public` _boolean_
- `url` _string_
- `createdAt?` _string_

***

## PreviewLink

Preview URL plus an access token for one sandbox port.

Send `token` in the `X-Daytona-Preview-Token` header to reach a private
endpoint; without a credential the request returns 401. When `token` is a
sandbox access token (a JWT) it also works as `Authorization: Bearer` or
`?daytona_token=`; an opaque preview token works only in the header.
Public endpoints set `token` to `''` and need no credential.

For a shareable URL that works in a browser without extra headers, use
`PortsService.signedPreviewLink` instead.

**Example:**

```ts
const link = await sandbox.ports.previewLink(8080)
const response = await fetch(link.url, {
  headers: { 'X-Daytona-Preview-Token': link.token },
})
```

**Properties**:

- `url` _string_
- `token` _string_
- `expiresAt?` _string_ - Absent when the preview token has no readable expiry.

***

## SignedPreviewLink

Self-contained signed URL for one sandbox port.

The token is embedded in the hostname — no extra headers or credentials are
needed. The link expires at `expiresAt` (RFC 3339). Expire it early with
`PortsService.expireSignedPreviewLinks`, which expires every signed
preview link of the sandbox.

**Properties**:

- `url` _string_
- `token` _string_
- `expiresAt` _string_ - When the link stops resolving (RFC 3339). The contract requires it: a
  response without it is a `BadRequestError`.

***

## CreateAccessTokenOptions

Options for `Sandbox.createAccessToken`.

**Properties**:

- `operations?` _readonly string\[\]_ - Requested operation subset (the sandbox-operation vocabulary: `toolbox`,
  `toolbox:exec`, `toolbox:fs`, `toolbox:git`, `desktop`, `ssh`,
  `sandbox:stop`, `sandbox:pause`, `sandbox:delete`). Omitted = the
  minter's full grantable set; `[]` is a valid ports-only grant. Unknown
  operations are a 400, never a silent narrowing. `toolbox:git` without
  `toolbox:exec` covers the git operations except writing git config:
  `git.setConfig()` with such a token throws `ForbiddenError` (403);
  `git.getConfig()` still works.
- `ports?` _readonly number\[\]_ - Private-preview ports the token may reach. Omitted = all; `[]` = none.
  The sandbox daemon's ports 2280, 2281 and 22220 are never preview ports
  and are refused with `BadRequestError` before any request.
- `ttlSeconds?` _number_ - Token lifetime in seconds; omitted = the deployment default, capped server-side.

***

## SandboxAccessToken

A short-lived per-sandbox access token (`POST …/access-token`).

`accessToken` is a bearer for sandbox services (toolbox, SSH, desktop,
 private previews) and for the self-service API routes named by
`operations`. It expires at `expiresAt` (RFC 3339) and cannot be refreshed —
mint a fresh one with `Sandbox.createAccessToken` instead. `ports` is
the granted private-preview port set; `undefined` means every port.

**Properties**:

- `accessToken` _string_
- `tokenType` _string_
- `expiresAt` _string_
- `operations` _readonly string\[\]_
- `ports?` _readonly number\[\]_

***

## SystemMetrics

**Properties**:

- `timestamp` _string_
- `cpuCount` _number_
- `cpuUtilization` _number_
- `memoryUsageBytes` _number_
- `memoryTotalBytes` _number_
- `diskUsageBytes` _number_
- `diskTotalBytes` _number_

***

## IfMatchOptions

**Properties**:

- `ifMatch` _string_

***

## ForkOptions

**Properties**:

- `name?` _string_
- `memory?` _boolean_
- `waitSeconds?` _number_ - Wait budget in seconds; default 60; `0` returns immediately after acceptance; a value above about 24.8 days (the timer maximum) waits with no deadline.
- `autoDelete?` _boolean_

***

## MacBootMode

```ts
type MacBootMode = string
```

How a macOS sandbox resumed, as reported by the API.
