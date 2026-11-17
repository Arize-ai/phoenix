# Sandbox (TypeScript SDK reference)

## Contents

- [Sandbox](#sandbox)
- [UpdateEnvOptions](#updateenvoptions)
- [SandboxEventsConfig](#sandboxeventsconfig)
- [SandboxState](#sandboxstate)
- [SandboxWaitState](#sandboxwaitstate)
- [SandboxClass](#sandboxclass)
- [SandboxLifecycle](#sandboxlifecycle)
- [SandboxLifecycleDto](#sandboxlifecycledto)
- [SandboxInfo](#sandboxinfo)
- [SandboxHandleJSON](#sandboxhandlejson)
- [WaitOptions](#waitoptions)
- [WaitForStateOptions](#waitforstateoptions)
- [SandboxSearchFilters](#sandboxsearchfilters)
- [SandboxSecretsInfo](#sandboxsecretsinfo)
- [SandboxStateSnapshot](#sandboxstatesnapshot)
- [SandboxDto](#sandboxdto)
- [PreviewEndpoint](#previewendpoint)
- [PreviewLink](#previewlink)
- [SignedPreviewLink](#signedpreviewlink)
- [CreateAccessTokenOptions](#createaccesstokenoptions)
- [SandboxAccessToken](#sandboxaccesstoken)
- [SystemMetrics](#systemmetrics)
- [MacBootMode](#macbootmode)

## Sandbox

**Properties**:

- `id` _string_
- `toolboxProxyUrl?` _string_
- `name?` _string_
- `image` _ImageRef \| null_
- `snapshot` _SnapshotRef \| null_
- `target?` _string_
- `labels` _Record\<string, string\>_
- `cpu?` _number_ - Reserved CPU (the guarantee), in cores (1 core = 2 vCPUs; a macOS core is one Mac CPU).
- `cpuMax?` _number_ - CPU limit (the boot shape), in cores; undefined when the API did not report it.
- `memory?` _number_
- `memoryMax?` _number_
- `disk?` _number_
- `diskMax?` _number_
- `state?` _SandboxState_
- `rawState?` _string_
- `error?` _string_
- `errorReason?` _string_
- `imageBuildId?` _string_
- `sandboxClass?` _SandboxClass_ - Undefined until fetched, and for a class this SDK does not know (calls that depend on the class then throw).
- `user?` _string_
- `region?` _string_
- `persistent?` _boolean_ - macOS only: whether the sandbox preserves its disk when stopped; undefined on a
  handle whose metadata has not been loaded yet.
- `spot?` _boolean_
- `spotEvictedAt?` _string_
- `lifecyclePolicy?` _SandboxLifecycle_
- `forkedFrom?` _string_
- `reservationId?` _string_ - macOS only: the ID of the reservation selected for this sandbox.
  Unset before a reservation is selected, and on search results
  (`search()`, a search-routed `list()`), which omit it; `refreshData()` reads it.
- `accessToken?` _string_
- `accessTokenExpiresAt?` _string_ - Expiry of `accessToken` (RFC 3339), when known. Undefined for the
  opaque `dtnv_` create token (no known expiry) and for
  handles without a token.

### Constructors

#### Constructor

```ts
new Sandbox(
   sandboxOrId: SandboxDto | SandboxInfo | string,
   api: AxiosInstance | undefined,
   toolboxBaseUrl: string | undefined,
   apiKey: string | undefined,
   target?: string,
   options?: SandboxConnectOptions,
   requestTimeout?: number,
   httpOptions?: HttpClientOptions): Sandbox;
```

Low-level constructor; prefer `daytona.create*()`, `get(id)` or `list()`.
Any toolbox URL inside `sandboxOrId` (a stored `toJSON()` blob or an
API-shaped object) is ignored, so stored data never chooses where the
SDK sends a credential. Pass `options.toolboxUrl` to set one explicitly —
the toolbox credential (the API key, a project token, a minted sandbox
token, or `options.accessToken`) goes there, so pass only a URL you trust.
The third parameter, `toolboxBaseUrl`, is unused: pass the URL as
`options.toolboxUrl`.

**Parameters**:

- `sandboxOrId` _SandboxDto \| SandboxInfo \| string_
- `api` _AxiosInstance \| undefined_
- `toolboxBaseUrl` _string \| undefined_
- `apiKey` _string \| undefined_
- `target?` _string_
- `options?` _SandboxConnectOptions_
- `requestTimeout?` _number_
- `httpOptions?` _HttpClientOptions_

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

#### computerUse

```ts
get computerUse(): ComputerUseService;
```

**Returns**:

- `ComputerUseService`

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

**Parameters**:

- `name` _string_

**Returns**:

- `Promise<Snapshot>`

#### delete()

```ts
delete(): Promise<void>;
```

Request deletion.
Returning, a `destroyed` state, or a subsequent 404 does not guarantee that
the image can already be deleted. Image deletion may still return 409.

**Returns**:

- `Promise<void>`

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

#### exec()

```ts
exec(command: ProcessCommand, options: RunOptions = {}): Promise<RunResult>;
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

- `Promise<RunResult>`

#### followBuildLogs()

```ts
followBuildLogs(options: BuildLogFollowOptions): Promise<BuildLogFollowResult>;
```

Observe this sandbox's build without changing its execution lifetime.
Discovery failures, including a 404 for a sandbox with no image build,
throw BuildLogInterruptedError with the HTTP status and last cursor.
They do not fall back to another log source.

**Parameters**:

- `options` _BuildLogFollowOptions_

**Returns**:

- `Promise<BuildLogFollowResult>`

#### fork()

```ts
fork(
   options: { name?: string; memory?: boolean; timeout?: number } = {}): Promise<Sandbox>;
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
paused or stopped one rests `stopped`. The fork may wait for capacity,
as a create does; insufficient capacity can return `NO_FREE_SLOT`.

**Parameters**:

- `options` _\{ name?: string; memory?: boolean; timeout?: number \} = \{\}_

**Returns**:

- `Promise<Sandbox>`

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

#### interpreter

```ts
get interpreter(): InterpreterService;
```

**Returns**:

- `InterpreterService`

#### lsp

```ts
get lsp(): LspService;
```

**Returns**:

- `LspService`

#### macBootMode

```ts
get macBootMode(): MacBootMode | null;
```

macOS only: how the sandbox resumed, as reported by the API. Null
for any other class and for a sandbox not resumed since it last booted.

**Returns**:

- `MacBootMode | null`

#### metrics()

```ts
metrics(): Promise<SystemMetrics>;
```

**Returns**:

- `Promise<SystemMetrics>`

#### pause()

```ts
pause(options: LifecycleWaitOptions = {}): Promise<void>;
```

Pause a persistent macOS sandbox with its memory. Waits up to `timeout` for `paused` and throws
`SandboxTerminalStateError` if the pause fails. A paused macOS sandbox keeps its Mac slot
but does not keep its reservation renewing.

**Parameters**:

- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

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

#### refreshData()

```ts
refreshData(): Promise<void>;
```

Refresh sandbox metadata from the API.

**Returns**:

- `Promise<void>`

#### replaceSecrets()

```ts
replaceSecrets(
   secrets: readonly string[],
   options: { ifMatch: string }): Promise<SandboxSecretsInfo>;
```

Replace the full set of project secrets attached to this sandbox (`PUT /sandboxes/{id}/secrets`).
`secrets` names project secrets. `ifMatch` is the
`etag` of the last read; a stale one throws `PreconditionFailedError`. The change applies
asynchronously: poll `getSecrets` until `status` is `applied`. Running processes keep their
environment; processes started afterwards see the new names.

**Parameters**:

- `secrets` _readonly string\[\]_
- `options` _\{ ifMatch: string \}_

**Returns**:

- `Promise<SandboxSecretsInfo>`

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
state — a never-started sandbox already carries its creation-time
activity stamp, which the reset advances.

The echo is the full post-reset lifecycle, the same shape
`updateLifecyclePolicy()` returns. Advance-only: a newer concurrent activity bump
keeps the clock, and what comes back is the state that won.

**Returns**:

- `Promise<SandboxLifecycle>`

#### resetNetworkPolicy()

```ts
resetNetworkPolicy(options: { ifMatch: string }): Promise<NetworkPolicyInfo>;
```

**Parameters**:

- `options` _\{ ifMatch: string \}_

**Returns**:

- `Promise<NetworkPolicyInfo>`

#### resume()

```ts
resume(options: LifecycleWaitOptions = {}): Promise<void>;
```

Resume a paused persistent macOS sandbox and wait until it is started. A
macOS resume the Mac cannot finish ends `stopped`; this then throws
`SandboxTerminalStateError`.

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

**Parameters**:

- `code` _string_
- `options` _InterpreterRunOptions = \{\}_

**Returns**:

- `Promise<InterpreterResult>`

#### setLabels()

```ts
setLabels(labels: Record<string, string>): Promise<Record<string, string>>;
```

Replace the sandbox's full label set. Pass `{}` to clear all labels; resolves to the applied labels.

**Parameters**:

- `labels` _Record\<string, string\>_

**Returns**:

- `Promise<Record<string, string>>`

#### snapshotFilesystem()

```ts
snapshotFilesystem(options: CaptureImageOptions = {}): Promise<Image>;
```

Snapshot this sandbox's filesystem as a new `Image`
(`POST /sandboxes/{id}/images`). The result boots new sandboxes
(`daytona.create(image.id)`); a Linux sandbox keeps running. A macOS sandbox must be persistent and
stopped; it cannot start until the snapshot is `ready`.

**Parameters**:

- `options` _CaptureImageOptions = \{\}_

**Returns**:

- `Promise<Image>`

#### start()

```ts
start(options: LifecycleWaitOptions = {}): Promise<void>;
```

Start a stopped sandbox, or resume a paused one, and wait until it is started.

**Parameters**:

- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

#### stop()

```ts
stop(): Promise<void>;
```

Stop a persistent macOS sandbox.

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
`delete:sandboxes` in addition to `write:sandboxes`.

**Parameters**:

- `options` _LifecyclePolicyOptions_

**Returns**:

- `Promise<SandboxLifecycle>`

#### updateNetworkPolicy()

```ts
updateNetworkPolicy(
   networkPolicy: NetworkPolicyInput,
   options: { ifMatch: string }): Promise<NetworkPolicyInfo>;
```

**Parameters**:

- `networkPolicy` _NetworkPolicyInput_
- `options` _\{ ifMatch: string \}_

**Returns**:

- `Promise<NetworkPolicyInfo>`

#### volumes

```ts
get volumes(): SandboxVolumesService;
```

**Returns**:

- `SandboxVolumesService`

#### wait()

```ts
wait(options: WaitOptions = {}): Promise<Sandbox>;
```

Wait for one or more public sandbox states.

`timeout` is a caller wait budget in seconds. The default is 60; `0`
waits without a deadline. Timeout raises `RequestTimeoutError`, and
a terminal state before the target raises `SandboxTerminalStateError`.

**Parameters**:

- `options` _WaitOptions = \{\}_

**Returns**:

- `Promise<Sandbox>`

#### waitForState()

```ts
waitForState(
   states: readonly SandboxWaitState[],
   options: WaitForStateOptions = {}): Promise<void>;
```

**Parameters**:

- `states` _readonly SandboxWaitState\[\]_
- `options` _WaitForStateOptions = \{\}_

**Returns**:

- `Promise<void>`

***

## UpdateEnvOptions

**Properties**:

- `unset?` _readonly string\[\]_

***

## SandboxEventsConfig

Configuration for the sandbox-state events hub (WebSocket-based waiting).

`enabled` defaults to `true`. `reconcileIntervalMs` defaults to 60 000 (ms);
`0` disables the periodic re-subscribe timer. `idleCloseMs` closes the
events socket that long after its last waiter leaves; unset, the socket
stays open. In Node an idle socket does not keep the process alive, so a
script that never calls `daytona.close()` still exits; a runtime where the
socket cannot be released that way (no `ws` package) closes it after
10 000 ms instead. `0` keeps the socket open until `close()`.

**Properties**:

- `enabled?` _boolean_ - Enable WebSocket-based waiting; default `true`.
- `reconcileIntervalMs?` _number_ - Reconcile timer interval in ms; default 60 000; 0 disables. Values above 2 147 483 647 clamp to that maximum.
- `idleCloseMs?` _number_ - Close an idle events socket after this many ms; default never (10 000
  where an idle socket would keep the process alive); `0` = never. Values
  above 2 147 483 647 clamp to that maximum.

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

## SandboxLifecycleDto

Wire shape of the lifecycle object on sandbox DTOs and the lifecycle PATCH response.

**Properties**:

- `timeout_seconds?` _number \| null_
- `on_timeout?` _string \| null_
- `timeout_at?` _string \| null_
- `idle_expiry_seconds?` _number \| null_
- `on_idle_timeout?` _string \| null_
- `idle_timeout_at?` _string \| null_
- `last_activity_at?` _string \| null_
- `last_activity_source?` _string \| null_

***

## SandboxInfo

**Properties**:

- `sandboxId` _string_
- `toolboxProxyUrl?` _string_ - Internal: the create path passes the create response's toolbox URL here.
  `toJSON()` never writes it, and the public `Sandbox` constructor ignores it
  — pass `options.toolboxUrl` to set a toolbox URL explicitly.
- `name?` _string_
- `image?` _ImageRef_
- `snapshot?` _SnapshotRef_
- `target?` _string_
- `cpu?` _number_
- `cpuMax?` _number_
- `memory?` _number_
- `memoryMax?` _number_
- `disk?` _number_
- `diskMax?` _number_
- `state?` _SandboxState_
- `error?` _string_
- `imageBuildId?` _string_
- `sandboxClass?` _SandboxClass_
- `labels?` _Record\<string, string\>_
- `region?` _string_
- `persistent?` _boolean_ - macOS only: preserve the sandbox's disk when stopped.
- `spot?` _boolean_
- `spotEvictedAt?` _string_
- `lifecyclePolicy?` _SandboxLifecycle_
- `forkedFrom?` _string_
- `reservationId?` _string_
- `user?` _string_

***

## SandboxHandleJSON

```ts
type SandboxHandleJSON = SandboxInfo
```

***

## WaitOptions

**Properties**:

- `until?` _SandboxWaitState \| readonly SandboxWaitState\[\]_
- `timeout?` _number_

***

## WaitForStateOptions

**Properties**:

- `terminalStates?` _readonly SandboxState\[\]_
- `timeout?` _number_ - Caller wait budget in milliseconds; `0` and `undefined` wait unbounded.

***

## SandboxSearchFilters

The `GET /sandboxes/search` filters shared by `Daytona.search()` and `Daytona.list()`.

`status`, `sandboxClass` and `region` take a single value or a list; lists are
joined with commas on the wire. `labels` is sent as a JSON object string
(containment match); numeric bounds and timestamp starts are inclusive;
timestamp ends are exclusive.

**Properties**:

- `q?` _string_ - Free text over name and image; also an exact match when it is a sandbox id.
- `status?` _string \| readonly string\[\]_ - A single value or a list (any-of) over the API's lifecycle state names (`running`, `stopped`, ...).
- `sandboxClass?` _SandboxClass \| readonly SandboxClass\[\]_ - A single value or a list (any-of).
- `region?` _string \| readonly string\[\]_ - A single value or a list (any-of) over region slugs.
- `imageRef?` _string_
- `imageRefPrefix?` _string_
- `labels?` _Record\<string, string\>_ - Containment: every listed label must match.
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

- `secrets` _string\[\]_
- `desiredRevision` _number_
- `etag` _string_
- `httpStatus` _number_
- `appliedRevision?` _number_
- `status?` _string_
- `error?` _string_
- `captureStatus?` _string_
- `captureUnresolvedCount?` _number_

***

## SandboxStateSnapshot

```ts
type SandboxStateSnapshot = api.Snapshot
```

***

## SandboxDto

**Properties**:

- `id` _string_
- `class?` _SandboxClass \| string_ - Sandbox class (`linux` | `macos`); the authoritative class when present.
- `name?` _string_
- `image?` _api.ImageReference \| null_
- `status?` _string_
- `cpu?` _number_ - Reserved CPU (the guarantee), in cores (1 core = 2 vCPUs).
- `cores_max?` _number \| null_ - CPU limit (the boot shape), in cores, a multiple of 0.5.
- `memory_mib?` _number_
- `memory_max_mib?` _number \| null_
- `disk_mib?` _number_
- `disk_max_mib?` _number \| null_
- `error?` _string \| null_
- `labels?` _unknown_
- `spot?` _boolean \| null_
- `spot_evicted_at?` _string \| null_
- `toolboxProxyUrl?` _string_
- `toolbox_proxy_url?` _string \| null_
- `region_id?` _string_
- `image_build_id?` _string \| null_
- `user?` _string \| null_
- `snapshot?` _api.SnapshotReference \| null_
- `mac_boot_mode?` _string \| null_ - macOS only: set on the `running` that ends a resume; null otherwise.
- `reservation_id?` _string \| null_ - macOS only: the reservation selected for this sandbox. `GET /sandboxes/search` items omit it.
- `persistent?` _boolean \| null_ - macOS only; absent on `GET /sandboxes/batch-wait` items.
- `lifecycle_policy?` _SandboxLifecycleDto \| null_
- `created_at?` _string \| null_ - Present on `GET /sandboxes/search` items; absent
  on the plain list. `created_at` is always set on a search item; the other
  timestamps and `forked_from` are `null` when the sandbox has no such event.
- `updated_at?` _string \| null_
- `last_activity_at?` _string \| null_
- `started_at?` _string \| null_
- `stopped_at?` _string \| null_
- `forked_from?` _string \| null_
- `cursor?` _string_ - Per-item cursor on search results.

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
needed. The link expires at `expiresAt` (RFC 3339). Revoke it early with
`PortsService.expireSignedPreviewLink`.

**Properties**:

- `url` _string_
- `token` _string_
- `expiresAt?` _string_ - Absent when the server response carried no expiry (parity with the Python
  SDK's `expires_at: Optional[str]`).

***

## CreateAccessTokenOptions

Options for `Sandbox.createAccessToken`.

**Properties**:

- `operations?` _readonly string\[\]_ - Requested operation subset (the sandbox-operation vocabulary: `toolbox`,
  `toolbox:exec`, `toolbox:fs`, `toolbox:git`, `toolbox:lsp`, `desktop`,
  `ssh`, `sandbox:stop`, `sandbox:pause`, `sandbox:delete`). Omitted = the
  minter's full grantable set; `[]` is a valid ports-only grant. Unknown
  operations are a 400, never a silent narrowing.
- `ports?` _readonly number\[\]_ - Private-preview ports the token may reach. Omitted = all; `[]` = none.
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

## MacBootMode

```ts
type MacBootMode = string
```

How a macOS sandbox resumed, as reported by the API.
