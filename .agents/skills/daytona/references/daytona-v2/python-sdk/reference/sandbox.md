# Sandbox (Python SDK reference)

## Contents

- [Sandbox](#sandbox)
- [AsyncSandbox](#asyncsandbox)
- [SandboxEventsConfig](#sandboxeventsconfig)
- [SandboxSecretsInfo](#sandboxsecretsinfo)
- [SandboxLifecycleJSON](#sandboxlifecyclejson)
- [SandboxHandleJSON](#sandboxhandlejson)
- [SandboxLimits](#sandboxlimits)
- [SandboxResourceLimits](#sandboxresourcelimits)
- [SandboxLifecycle](#sandboxlifecycle)
- [SystemMetrics](#systemmetrics)
- [PreviewEndpoint](#previewendpoint)
- [PreviewLink](#previewlink)
- [SignedPreviewLink](#signedpreviewlink)
- [SandboxAccessToken](#sandboxaccesstoken)
- [SandboxSearchFilters](#sandboxsearchfilters)
- [SandboxState](#sandboxstate)
- [SandboxWaitState](#sandboxwaitstate)
- [SandboxClass](#sandboxclass)
- [MacBootMode](#macbootmode)

## Sandbox

```python
class Sandbox()
```

A sandbox handle with process/fs/git/interpreter/pty namespaces.

Built by the client (`create*()`, `get()`, `list()`, `fork()`); the
constructor is internal. Observed metadata is read-only and changes only
when the SDK reads the sandbox again (`refresh_data()`, a wait).

#### Sandbox.\_\_init\_\_

```python
def __init__() -> None
```

#### Sandbox.build\_logs

```python
def build_logs() -> str
```

Return retained build output as one-shot text, not a live follower.

The body includes a state line and the currently available build tail.
A sandbox with no image build (for example a registry image) raises
`NotFoundError`. Retained-tail truncation is indicated in the text.
Use `follow_build_logs` for live output and completeness metadata.

#### Sandbox.capture\_image

```python
def capture_image(*,
                  name: Optional[str] = None,
                  idle_expiry_seconds: Optional[int] = None) -> Image
```

Capture this sandbox's filesystem as a new `Image` (`POST /sandboxes/{id}/images`).

The result boots new sandboxes (`daytona.create(image.id)`); a Linux
sandbox keeps running. A macOS
sandbox must be persistent and stopped; the capture answers
`DISK_NOT_READY` while its disk is not ready yet (retry later).
The credential needs `write:sandboxes` in addition to `write:images`;
without it the capture raises `ForbiddenError` (403).

`name` makes the image named and permanent (same name rules as
`images.build`; a name that already exists raises
`ImageNameTakenError`). `idle_expiry_seconds` is
the idle-retention window of an ANONYMOUS capture: it is deleted once
that long has passed without a sandbox being created from it (every
create restarts the clock). Same rule as `images.build`: omitted or
`-1` ⇒ the server maximum (7 days by default); above it ⇒ 400.
Promote the image to keep it. `idle_expiry_seconds` with `name` is
a 400. Returns once the API accepts the capture; wait for readiness
with `images.get(image.id, wait="ready")`.

#### Sandbox.create\_access\_token

```python
def create_access_token(*,
                        operations: Optional[Sequence[str]] = None,
                        ports: Optional[Sequence[int]] = None,
                        ttl_seconds: Optional[int] = None) -> SandboxAccessToken
```

Mint a scoped, short-lived access token for THIS sandbox.

The token authorizes sandbox services (toolbox, SSH, desktop,
private previews) and the self-service sandbox routes, for exactly the
granted `operations` and `ports` — hand it to a collaborator, a CI
job, or a browser instead of a project API key.

`operations` is the sandbox-operation vocabulary (`toolbox`,
`toolbox:exec`, `toolbox:fs`, `toolbox:git`, `desktop`,
`ssh`, `sandbox:stop`, `sandbox:pause`, `sandbox:delete`);
omitted means the minter's full grantable set, and `[]` is a valid
ports-only grant. `toolbox:git` without
`toolbox:exec` covers the git operations except writing git config:
`git.set_config()` with such a token raises `ForbiddenError`
(403); `git.get_config()` still works. `ports` names the private-preview
ports the token may reach (omitted = all, `[]` = none); the sandbox
daemon's ports 2280, 2281 and 22220 are never preview ports and are
refused with `daytona.v2.errors.BadRequestError` before any
request. `ttl_seconds`
overrides the deployment's default lifetime, capped server-side; an
unknown operation or an over-cap TTL is a 400, never a silent
narrowing. The token cannot be refreshed and cannot mint further
credentials — mint a fresh one here instead.

#### Sandbox.create\_snapshot

```python
def create_snapshot(name: str, /) -> Snapshot
```

Capture this sandbox, memory and disk, as a new `Snapshot`
(`POST /sandboxes/{id}/snapshots`).

The credential needs `write:sandboxes` in addition to
`write:snapshots`; without it the capture raises
`ForbiddenError` (403).

#### Sandbox.delete

```python
def delete(*, timeout: float = 60) -> None
```

Delete the sandbox and wait until it is `destroyed`.

`timeout` is the wait budget in seconds (default 60; `0`, or a
value above about 24.8 days, = no deadline); running out raises `RequestTimeoutError`, and an
`error` state raises `SandboxTerminalStateError` (one the
events hub reports is confirmed with one read first, while the wait
has budget left and unless it already came from a full read). A 404 while
waiting counts as destroyed. A destroyed sandbox does not guarantee
that its image can already be deleted: image deletion may still
answer 409 for a while.

#### Sandbox.entrypoint\_logs

```python
def entrypoint_logs() -> str
```

Return the sandbox entrypoint-session log as text.

#### Sandbox.exec

```python
def exec(command: Optional[str] = None,
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

Run a command, wait for its shell to exit, and collect its output.

A convenience alias for `process.run` — identical behaviour, same
parameters, same return value.

**Shell selection.** Passing a string `command` runs it through the
sandbox shell: `bash` when the image has it, else `sh`. Pass
`shell=` to pin another interpreter, and quote globs and
brackets (`pip install -e '.[test]'`) so the command means the same
under any shell. Use `argv=` to bypass the shell entirely, which is
the safe form for untrusted arguments. For persistent shell state, use
`process.create_session`.

**Background processes.** The call returns when the shell exits. If the
command launches a background child that holds output open (e.g.
`python3 -m http.server 8000 &`), the call waits at most ~2 seconds
for output to drain and then returns; output the child writes later is not
part of the result. For a long-running server use
`process.start`, which returns a `ProcessHandle` immediately
(logs, wait, kill). Alternatively redirect: `nohup cmd > server.log 2>&1 &`.

:param command: Shell command string; mutually exclusive with `argv`.
:param argv: Argument vector for shell-free execution.
:param cwd: Working directory inside the sandbox.
:param env: Extra environment variables merged into the process environment.
:param shell: Shell binary to use (e.g. `"bash"`); overrides auto-detection.
:param timeout: Caller wait budget in seconds. Omit to wait until the process
    ends. Does not kill the process; use `execution_timeout` for that.
:param stdin: Only `"closed"` (default); `"open"` is refused, as by
    `process.run`.
:param execution_timeout: Server-side deadline in seconds. The sandbox kills
    the process tree when this expires. Omitted or `0` means no deadline.
:param keep_logs: How long the sandbox keeps the process log: `"on_exit_ttl"`
    (default) or `"until_cleanup"`.
:returns: `daytona.v2.types.ProcessResult` with `stdout`, `stderr`,
    `output`, `logs`, `exit_code`, and `reason`.

#### Sandbox.follow\_build\_logs

```python
def follow_build_logs(*,
                      on_logs: BuildLogsCallback,
                      on_event: Optional[BuildLogEventCallback] = None,
                      cursor: Optional[str] = None,
                      timeout: Optional[float] = None) -> BuildLogFollowResult
```

Observe this sandbox's build without changing its execution lifetime.

`on_logs` receives decoded output; optional `on_event` receives each
typed `BuildLogEvent`. Either callback may return an awaitable, which
is awaited before the next event. `timeout` (seconds) bounds this
observation only; cancelling the awaiting task closes the stream, not
the build. An HTTP error of the initial discovery request, including a
404 for a sandbox with no image build, raises its typed error
(`NotFoundError`, ...) unchanged; once the follower is running, a
failure raises `BuildLogInterruptedError` with the last cursor. It
does not fall back to another log source.

#### Sandbox.fork

```python
def fork(*,
         name: Optional[str] = None,
         memory: Optional[bool] = None,
         wait_seconds: float = 60) -> Sandbox
```

Fork this sandbox and return the fork's handle.

By default the fork continues from the source's memory (running
processes included). `memory=False` copies only the disk, and the
fork boots fresh. A macOS fork copies the disk only: omit `memory`
or pass `memory=False` (`memory=True` is refused with
`NOT_SUPPORTED_FOR_CLASS`); a fork of a running macOS sandbox boots
with a fresh machine identity. A macOS fork answers `DISK_NOT_READY`
while the source's disk is not ready yet; retry later.

`wait_seconds` (default 60; `0` returns as soon as the API accepts
the fork; a value above about 24.8 days, the timer maximum, waits with
no deadline) bounds the wait for the state the fork settles in: a fork of
a running source waits for `started`, even if a macOS fork is
temporarily `stopped` while its source releases the disk. A fork of
a paused or stopped macOS source waits for `stopped`. Linux forks
otherwise rest `paused` for a memory fork of a paused source, else
`stopped` (call `start()`). Like `create()`, `fork()` never raises
because of how the wait ended: the default 60-second budget may return
a not-yet-started handle. When the budget runs out or the fork fails,
it returns the handle — check `fork.state`.

#### Sandbox.get\_network\_policy

```python
def get_network_policy() -> NetworkPolicyInfo
```

#### Sandbox.get\_secrets

```python
def get_secrets() -> SandboxSecretsInfo
```

Read this sandbox's attached secret names and their apply state (`GET /sandboxes/{id}/secrets`).

Returns names and revisions only, never values. `etag` is the `If-Match` value for
`replace_secrets`; `status` is `pending` until the sandbox has applied
`desired_revision`.

#### Sandbox.metrics

```python
def metrics() -> SystemMetrics
```

A snapshot of the sandbox's CPU, memory and disk usage.

#### Sandbox.pause

```python
def pause(*, timeout: float = 60) -> None
```

Pause the sandbox with its memory and wait until it is `paused`.

`timeout` is the wait budget in seconds (default 60; `0`, or a
value above about 24.8 days, = no deadline). A pause that fails returns the sandbox to `started`; this
then raises `SandboxTerminalStateError`. A paused macOS sandbox
keeps its memory on its Mac. With auto-renew on, it keeps its
reservation renewing; otherwise the sandbox is stopped, with its disk,
before the reservation ends. Which sandboxes can pause is the API's
decision.

#### Sandbox.refresh\_data

```python
def refresh_data() -> None
```

Read the sandbox's metadata from the API again.

#### Sandbox.replace\_secrets

```python
def replace_secrets(*, secrets: Sequence[str], if_match: str) -> SandboxSecretsInfo
```

Replace the full set of project secrets attached to this sandbox (`PUT /sandboxes/{id}/secrets`).

`secrets` names project secrets; unchanged names remain attached. `if_match` is
the `etag` of the last read; a stale one raises `PreconditionFailedError`. The change
applies asynchronously: poll `get_secrets` until `status` is `applied`. Running
processes keep their environment; processes started afterwards see the new names.

#### Sandbox.reset\_idle\_timer

```python
def reset_idle_timer() -> SandboxLifecycle
```

Reset this sandbox's idle timer (an explicit out-of-band keepalive).

For work the platform cannot see: bumps the sandbox's activity clock
(`last_activity_at`, attributed
server-side to the `api` source), which restarts the idle countdown —
`idle_timeout_at` re-anchors to now + `idle_expiry_seconds`. The
wall-clock `timeout_at` is NOT affected. Succeeds whether or not an
idle timeout is armed (an unarmed sandbox echoes
`idle_timeout_at=None`), and in any state but deleting or deleted —
a never-started sandbox already carries its creation-time activity
stamp, which the reset advances. A sandbox that is deleted or being
deleted raises `ConflictError` (`CONFLICT`).

The echo is the full post-reset lifecycle, the same shape
`update_lifecycle_policy` returns. Advance-only: a newer concurrent
activity bump keeps the clock, and what comes back is the state that
won.

#### Sandbox.reset\_network\_policy

```python
def reset_network_policy(*, if_match: str) -> NetworkPolicyInfo
```

#### Sandbox.resume

```python
def resume(*, timeout: float = 60) -> None
```

Resume a paused sandbox and wait until it is `started`.

`timeout` is the wait budget in seconds (default 60; `0`, or a
value above about 24.8 days, = no deadline). A resume that cannot finish ends `stopped`; this then
raises `SandboxTerminalStateError`.

#### Sandbox.rotate\_signing\_key

```python
def rotate_signing_key() -> None
```

Rotate the sandbox's signing key, invalidating existing pre-signed URLs.

Every pre-signed URL minted so far stops working within ~30 s; new URLs
from `presigned_download_url` / `presigned_upload_url` use the new
key. The key itself is never returned.

Like minting, this requires the API-provided toolbox URL or a
sandbox-scoped URL template, rather than an arbitrary custom endpoint.

#### Sandbox.run\_code

```python
def run_code(code: str,
             /,
             *,
             language: Optional[str] = None,
             context: str | InterpreterContext | InterpreterContextJSON | None = None,
             isolated: bool = False,
             timeout: Optional[float] = None,
             cwd: Optional[str] = None,
             env: Optional[Mapping[str, str]] = None) -> InterpreterResult
```

Execute code and return its result: an alias for `interpreter.run()`, same parameters.

#### Sandbox.set\_labels

```python
def set_labels(labels: Mapping[str, str], /) -> Mapping[str, str]
```

Replace the sandbox's labels; pass `{}` to clear all but `name`.

The reserved `name` label, which `Daytona.find_by_name` and a
`name` label search match, is kept unless `labels` sets it: without
a `name` key the sandbox is read first (one more request, which also
refreshes this handle's metadata) and the `name` label it reports,
if any, is sent along (a read without labels reports none); the read and the write are not atomic. The `name`
label cannot be removed. Returns the labels the API applied, as a fresh
plain `dict` (typed `Mapping`, as `labels` is): changing it
changes nothing. An empty label key is refused with
`daytona.v2.errors.BadRequestError` before any request. A
sandbox that is deleted or being deleted raises
`ConflictError` (`CONFLICT`); one the API no longer finds raises
`NotFoundError`.

#### Sandbox.start

```python
def start(*, timeout: float = 60) -> None
```

Start a stopped sandbox, or resume a paused one, and wait until it is `started`.

`timeout` is the wait budget in seconds (default 60; `0`, or a
value above about 24.8 days, = no deadline); running out raises `RequestTimeoutError`, and a
terminal state raises `SandboxTerminalStateError`. Whether the
sandbox can be started is the API's decision: a refusal surfaces as its
typed error.
If a stop or pause is still in progress, wait for it to settle before
sending start or resume, using the same timeout budget.

A stopped macOS sandbox starts with its disk and size on any Mac of the
organization; after a start on a different Mac, iCloud asks the user to
sign in again. It raises `ConflictError` with
`DISK_NOT_READY` while its disk is not ready yet (retry later),
`NO_FREE_SLOT` when no Mac of the organization has space for its
size, `MAC_DISK_FULL` when the Mac with space is low on free disk
space, and `NO_ACTIVE_RESERVATION` when the organization has no Mac
reservation in the region and auto-reserve is off. When the
organization has no Mac reservation in the region and auto-reserve is
on, the start buys one, so it can fail as a create that buys one does: `LimitExceededError` with
`limit == "max_mac_reservations"` at the organization's Mac
reservation limit, `AUTO_RESERVE_LIMIT_REACHED`,
`NO_MAC_AVAILABLE`, `INSUFFICIENT_BALANCE` or `CHARGE_FAILED`.

#### Sandbox.stop

```python
def stop(*, timeout: float = 60) -> None
```

Stop the sandbox and wait until it is `stopped`.

`timeout` is the wait budget in seconds (default 60; `0`, or a
value above about 24.8 days, = no deadline); running out raises `RequestTimeoutError`, and a
terminal state raises `SandboxTerminalStateError`. Which
sandboxes can stop (today: persistent macOS sandboxes) is the API's
decision; a refusal surfaces as its typed error. While it is stopped,
toolbox calls (process, files, git, …) and its preview URLs answer
`SandboxNotRunningError` (409, `SANDBOX_NOT_RUNNING`);
`start` it first.

#### Sandbox.to\_json

```python
def to_json() -> SandboxHandleJSON
```

The handle's metadata as `SandboxHandleJSON` (camelCase, no URL, no credential).

A snapshot, not a way back: reconnect to a stored sandbox with
`client.get(json["sandboxId"])`. A key is present only when the handle
knows its value; timestamps are RFC 3339 strings.

#### Sandbox.update\_env

```python
def update_env(env: Optional[Mapping[str, str]] = None,
               *,
               unset: Sequence[str] = ()) -> None
```

Update SDK-managed environment entries for new processes, PTYs, and sessions.

Processes, PTYs, and sessions started after this call inherit the updated
environment. Running processes and already-running session kernels keep
their current environment unchanged. `unset` removes only values
previously set through `update_env()`; image-level environment entries
remain untouched.

#### Sandbox.update\_lifecycle\_policy

```python
def update_lifecycle_policy(*,
                            timeout_seconds: Optional[int] = None,
                            on_timeout: Optional[LifecycleAction] = None,
                            idle_expiry_seconds: Optional[int] = None,
                            on_idle_timeout: Optional[LifecycleAction] = None) -> SandboxLifecycle
```

Update this sandbox's lifecycle policy; omitted knobs stay unchanged.

`timeout_seconds` re-anchors the deadline from now (`>= 1`; the timeout
cannot be disabled). `idle_expiry_seconds=DISABLED` clears the idle pair;
arming it on a sandbox with no idle policy requires `on_idle_timeout`.
Setting either action to `"delete"` — or touching a pair whose current
or resulting action is `"delete"` — requires the API key to hold
`delete:sandboxes` in addition to `write:sandboxes`. A sandbox that
is deleted or being deleted raises `ConflictError` (`CONFLICT`).

#### Sandbox.update\_network\_policy

```python
def update_network_policy(*,
                          network_policy: NetworkPolicyInput,
                          if_match: str) -> NetworkPolicyInfo
```

#### Sandbox.wait

```python
def wait(*,
         until: SandboxWaitState | Sequence[SandboxWaitState] = 'started',
         timeout: float = 60) -> Self
```

Wait until the sandbox reaches `until` (one state or any of several) and return `self`.

`timeout` is the wait budget in seconds (default 60; `0`, or a value
above about 24.8 days, waits without a deadline). Running out raises `RequestTimeoutError`;
reaching `destroying`, `destroyed` or `error` first raises
`SandboxTerminalStateError`. A terminal state the events hub
reports is confirmed with one read before it raises, while the wait has
budget left, unless that state already came from a full read or is
`destroyed`. When the events hub has reported nothing decisive, the
last part of a bounded budget (up to 5 s) reads the state from the
server, so a state the hub missed still ends the wait; the same holds
for the other lifecycle waits and the create and fork waits.

#### Sandbox.access\_token

```python
@property
def access_token() -> Optional[str]
```

The sandbox-scoped bearer this handle currently authenticates with.

It comes from the create response (returned only by the first call of
a named get-or-create), a caller override (`get(id, access_token=...)`)
or a token the handle minted; `None` until one is known. Never
serialized by `to_json`.

#### Sandbox.access\_token\_expires\_at

```python
@property
def access_token_expires_at() -> Optional[datetime]
```

Expiry of `access_token`, or `None` when not reported.

#### Sandbox.computer\_use

```python
@property
def computer_use() -> ComputerUseService
```

#### Sandbox.cpu

```python
@property
def cpu() -> Optional[float]
```

Reserved CPU (the guarantee), in cores (1 core = 2 vCPUs; a macOS core is one Mac CPU).

#### Sandbox.cpu\_max

```python
@property
def cpu_max() -> Optional[float]
```

CPU limit (the boot shape), in cores; `None` when the API did not report it.

#### Sandbox.disk

```python
@property
def disk() -> Optional[float]
```

Disk in GiB, exactly the API's MiB / 1024.

#### Sandbox.disk\_max

```python
@property
def disk_max() -> Optional[float]
```

#### Sandbox.docker

```python
@property
def docker() -> DockerService
```

Docker Engine status inside the sandbox; see `DockerService`.

#### Sandbox.error

```python
@property
def error() -> Optional[str]
```

The failure the API recorded, or `None`.

#### Sandbox.forked\_from

```python
@property
def forked_from() -> Optional[str]
```

#### Sandbox.fs

```python
@property
def fs() -> FileSystemService
```

#### Sandbox.git

```python
@property
def git() -> GitService
```

#### Sandbox.id

```python
@property
def id() -> str
```

#### Sandbox.image

```python
@property
def image() -> Optional[ImageRef]
```

The image the sandbox booted, or `None` (a snapshot restore, or not yet known).

#### Sandbox.image\_build\_id

```python
@property
def image_build_id() -> Optional[str]
```

The image build this sandbox booted from, or `None` for other image sources.

#### Sandbox.interpreter

```python
@property
def interpreter() -> InterpreterService
```

#### Sandbox.labels

```python
@property
def labels() -> Optional[Mapping[str, str]]
```

The sandbox labels: a fresh copy on every read (changing it changes
nothing); replace them with `set_labels`. `None` until the API
has reported them: a `create*()` or `fork()` handle whose wait read
nothing holds only what the create response carries (call
`refresh_data` to load them).

#### Sandbox.lifecycle\_policy

```python
@property
def lifecycle_policy() -> Optional[SandboxLifecycle]
```

#### Sandbox.mac\_boot\_mode

```python
@property
def mac_boot_mode() -> Optional[MacBootMode]
```

macOS only: how the sandbox resumed, as reported by the API, or None.

#### Sandbox.memory

```python
@property
def memory() -> Optional[float]
```

Memory in GiB, exactly the API's MiB / 1024 (4608 MiB -> 4.5).

#### Sandbox.memory\_max

```python
@property
def memory_max() -> Optional[float]
```

#### Sandbox.name

```python
@property
def name() -> Optional[str]
```

The sandbox name; `None` until the API reports it.

#### Sandbox.persistent

```python
@property
def persistent() -> Optional[bool]
```

macOS only: whether a stop keeps the disk; `None` until known.

#### Sandbox.ports

```python
@property
def ports() -> PortsService
```

#### Sandbox.process

```python
@property
def process() -> ProcessService
```

#### Sandbox.pty

```python
@property
def pty() -> PtyService
```

#### Sandbox.raw\_sandbox\_class

```python
@property
def raw_sandbox_class() -> Optional[str]
```

The class exactly as the API reported it, or `None` until known.

#### Sandbox.raw\_state

```python
@property
def raw_state() -> Optional[str]
```

Wire status string exactly as the server sent it (`None` before any read).

Informational only — the SDK never branches on this value.  Use
`state` for all flow-control logic; `raw_state` is useful for
logging when `state == "unknown"` (the SDK does not recognize the value).

#### Sandbox.region

```python
@property
def region() -> Optional[str]
```

#### Sandbox.reservation\_id

```python
@property
def reservation_id() -> Optional[str]
```

macOS only: the reservation selected by the current or latest successful claim.

`None` before the first claim, and on search reads (`search()`),
which omit it: `refresh_data()` reads it.

#### Sandbox.sandbox\_class

```python
@property
def sandbox_class() -> Optional[Literal['linux', 'macos', 'unknown']]
```

`"linux"`, `"macos"`, or `"unknown"` for a class this SDK does not know
(see `raw_sandbox_class`); `None` until the class is known.

#### Sandbox.snapshot

```python
@property
def snapshot() -> Optional[SnapshotRef]
```

The memory snapshot this sandbox resumed, or `None` when it booted an image.

#### Sandbox.spot

```python
@property
def spot() -> Optional[bool]
```

#### Sandbox.spot\_evicted\_at

```python
@property
def spot_evicted_at() -> Optional[datetime]
```

#### Sandbox.state

```python
@property
def state() -> SandboxState
```

The last observed state; `"unknown"` before any read and for a state this SDK does not know.

#### Sandbox.user

```python
@property
def user() -> Optional[str]
```

#### Sandbox.volumes

```python
@property
def volumes() -> SandboxVolumesService
```

## AsyncSandbox

```python
class AsyncSandbox()
```

A sandbox handle with process/fs/git/interpreter/pty namespaces.

Built by the client (`create*()`, `get()`, `list()`, `fork()`); the
constructor is internal. Observed metadata is read-only and changes only
when the SDK reads the sandbox again (`refresh_data()`, a wait).

#### AsyncSandbox.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncSandbox.id

```python
@property
def id() -> str
```

#### AsyncSandbox.name

```python
@property
def name() -> Optional[str]
```

The sandbox name; `None` until the API reports it.

#### AsyncSandbox.state

```python
@property
def state() -> SandboxState
```

The last observed state; `"unknown"` before any read and for a state this SDK does not know.

#### AsyncSandbox.raw\_state

```python
@property
def raw_state() -> Optional[str]
```

Wire status string exactly as the server sent it (`None` before any read).

Informational only — the SDK never branches on this value.  Use
`state` for all flow-control logic; `raw_state` is useful for
logging when `state == "unknown"` (the SDK does not recognize the value).

#### AsyncSandbox.image

```python
@property
def image() -> Optional[ImageRef]
```

The image the sandbox booted, or `None` (a snapshot restore, or not yet known).

#### AsyncSandbox.snapshot

```python
@property
def snapshot() -> Optional[SnapshotRef]
```

The memory snapshot this sandbox resumed, or `None` when it booted an image.

#### AsyncSandbox.image\_build\_id

```python
@property
def image_build_id() -> Optional[str]
```

The image build this sandbox booted from, or `None` for other image sources.

#### AsyncSandbox.region

```python
@property
def region() -> Optional[str]
```

#### AsyncSandbox.labels

```python
@property
def labels() -> Optional[Mapping[str, str]]
```

The sandbox labels: a fresh copy on every read (changing it changes
nothing); replace them with `set_labels`. `None` until the API
has reported them: a `create*()` or `fork()` handle whose wait read
nothing holds only what the create response carries (call
`refresh_data` to load them).

#### AsyncSandbox.cpu

```python
@property
def cpu() -> Optional[float]
```

Reserved CPU (the guarantee), in cores (1 core = 2 vCPUs; a macOS core is one Mac CPU).

#### AsyncSandbox.cpu\_max

```python
@property
def cpu_max() -> Optional[float]
```

CPU limit (the boot shape), in cores; `None` when the API did not report it.

#### AsyncSandbox.memory

```python
@property
def memory() -> Optional[float]
```

Memory in GiB, exactly the API's MiB / 1024 (4608 MiB -> 4.5).

#### AsyncSandbox.memory\_max

```python
@property
def memory_max() -> Optional[float]
```

#### AsyncSandbox.disk

```python
@property
def disk() -> Optional[float]
```

Disk in GiB, exactly the API's MiB / 1024.

#### AsyncSandbox.disk\_max

```python
@property
def disk_max() -> Optional[float]
```

#### AsyncSandbox.sandbox\_class

```python
@property
def sandbox_class() -> Optional[Literal['linux', 'macos', 'unknown']]
```

`"linux"`, `"macos"`, or `"unknown"` for a class this SDK does not know
(see `raw_sandbox_class`); `None` until the class is known.

#### AsyncSandbox.raw\_sandbox\_class

```python
@property
def raw_sandbox_class() -> Optional[str]
```

The class exactly as the API reported it, or `None` until known.

#### AsyncSandbox.mac\_boot\_mode

```python
@property
def mac_boot_mode() -> Optional[MacBootMode]
```

macOS only: how the sandbox resumed, as reported by the API, or None.

#### AsyncSandbox.persistent

```python
@property
def persistent() -> Optional[bool]
```

macOS only: whether a stop keeps the disk; `None` until known.

#### AsyncSandbox.spot

```python
@property
def spot() -> Optional[bool]
```

#### AsyncSandbox.spot\_evicted\_at

```python
@property
def spot_evicted_at() -> Optional[datetime]
```

#### AsyncSandbox.lifecycle\_policy

```python
@property
def lifecycle_policy() -> Optional[SandboxLifecycle]
```

#### AsyncSandbox.forked\_from

```python
@property
def forked_from() -> Optional[str]
```

#### AsyncSandbox.reservation\_id

```python
@property
def reservation_id() -> Optional[str]
```

macOS only: the reservation selected by the current or latest successful claim.

`None` before the first claim, and on search reads (`search()`),
which omit it: `refresh_data()` reads it.

#### AsyncSandbox.user

```python
@property
def user() -> Optional[str]
```

#### AsyncSandbox.error

```python
@property
def error() -> Optional[str]
```

The failure the API recorded, or `None`.

#### AsyncSandbox.access\_token

```python
@property
def access_token() -> Optional[str]
```

The sandbox-scoped bearer this handle currently authenticates with.

It comes from the create response (returned only by the first call of
a named get-or-create), a caller override (`get(id, access_token=...)`)
or a token the handle minted; `None` until one is known. Never
serialized by `to_json`.

#### AsyncSandbox.access\_token\_expires\_at

```python
@property
def access_token_expires_at() -> Optional[datetime]
```

Expiry of `access_token`, or `None` when not reported.

#### AsyncSandbox.process

```python
@property
def process() -> AsyncProcessService
```

#### AsyncSandbox.fs

```python
@property
def fs() -> AsyncFileSystemService
```

#### AsyncSandbox.git

```python
@property
def git() -> AsyncGitService
```

#### AsyncSandbox.interpreter

```python
@property
def interpreter() -> AsyncInterpreterService
```

#### AsyncSandbox.pty

```python
@property
def pty() -> AsyncPtyService
```

#### AsyncSandbox.computer\_use

```python
@property
def computer_use() -> AsyncComputerUseService
```

#### AsyncSandbox.docker

```python
@property
def docker() -> AsyncDockerService
```

Docker Engine status inside the sandbox; see `AsyncDockerService`.

#### AsyncSandbox.ports

```python
@property
def ports() -> AsyncPortsService
```

#### AsyncSandbox.volumes

```python
@property
def volumes() -> AsyncSandboxVolumesService
```

#### AsyncSandbox.metrics

```python
async def metrics() -> SystemMetrics
```

A snapshot of the sandbox's CPU, memory and disk usage.

#### AsyncSandbox.exec

```python
async def exec(command: Optional[str] = None,
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

Run a command, wait for its shell to exit, and collect its output.

A convenience alias for `process.run` — identical behaviour, same
parameters, same return value.

**Shell selection.** Passing a string `command` runs it through the
sandbox shell: `bash` when the image has it, else `sh`. Pass
`shell=` to pin another interpreter, and quote globs and
brackets (`pip install -e '.[test]'`) so the command means the same
under any shell. Use `argv=` to bypass the shell entirely, which is
the safe form for untrusted arguments. For persistent shell state, use
`process.create_session`.

**Background processes.** The call returns when the shell exits. If the
command launches a background child that holds output open (e.g.
`python3 -m http.server 8000 &`), the call waits at most ~2 seconds
for output to drain and then returns; output the child writes later is not
part of the result. For a long-running server use
`process.start`, which returns a `ProcessHandle` immediately
(logs, wait, kill). Alternatively redirect: `nohup cmd > server.log 2>&1 &`.

:param command: Shell command string; mutually exclusive with `argv`.
:param argv: Argument vector for shell-free execution.
:param cwd: Working directory inside the sandbox.
:param env: Extra environment variables merged into the process environment.
:param shell: Shell binary to use (e.g. `"bash"`); overrides auto-detection.
:param timeout: Caller wait budget in seconds. Omit to wait until the process
    ends. Does not kill the process; use `execution_timeout` for that.
:param stdin: Only `"closed"` (default); `"open"` is refused, as by
    `process.run`.
:param execution_timeout: Server-side deadline in seconds. The sandbox kills
    the process tree when this expires. Omitted or `0` means no deadline.
:param keep_logs: How long the sandbox keeps the process log: `"on_exit_ttl"`
    (default) or `"until_cleanup"`.
:returns: `daytona.v2.types.ProcessResult` with `stdout`, `stderr`,
    `output`, `logs`, `exit_code`, and `reason`.

#### AsyncSandbox.run\_code

```python
async def run_code(code: str,
                   /,
                   *,
                   language: Optional[str] = None,
                   context: str | AsyncInterpreterContext | InterpreterContextJSON | None = None,
                   isolated: bool = False,
                   timeout: Optional[float] = None,
                   cwd: Optional[str] = None,
                   env: Optional[Mapping[str, str]] = None) -> InterpreterResult
```

Execute code and return its result: an alias for `interpreter.run()`, same parameters.

#### AsyncSandbox.to\_json

```python
def to_json() -> SandboxHandleJSON
```

The handle's metadata as `SandboxHandleJSON` (camelCase, no URL, no credential).

A snapshot, not a way back: reconnect to a stored sandbox with
`client.get(json["sandboxId"])`. A key is present only when the handle
knows its value; timestamps are RFC 3339 strings.

#### AsyncSandbox.set\_labels

```python
async def set_labels(labels: Mapping[str, str], /) -> Mapping[str, str]
```

Replace the sandbox's labels; pass `{}` to clear all but `name`.

The reserved `name` label, which `Daytona.find_by_name` and a
`name` label search match, is kept unless `labels` sets it: without
a `name` key the sandbox is read first (one more request, which also
refreshes this handle's metadata) and the `name` label it reports,
if any, is sent along (a read without labels reports none); the read and the write are not atomic. The `name`
label cannot be removed. Returns the labels the API applied, as a fresh
plain `dict` (typed `Mapping`, as `labels` is): changing it
changes nothing. An empty label key is refused with
`daytona.v2.errors.BadRequestError` before any request. A
sandbox that is deleted or being deleted raises
`ConflictError` (`CONFLICT`); one the API no longer finds raises
`NotFoundError`.

#### AsyncSandbox.entrypoint\_logs

```python
async def entrypoint_logs() -> str
```

Return the sandbox entrypoint-session log as text.

#### AsyncSandbox.update\_env

```python
async def update_env(env: Optional[Mapping[str, str]] = None,
                     *,
                     unset: Sequence[str] = ()) -> None
```

Update SDK-managed environment entries for new processes, PTYs, and sessions.

Processes, PTYs, and sessions started after this call inherit the updated
environment. Running processes and already-running session kernels keep
their current environment unchanged. `unset` removes only values
previously set through `update_env()`; image-level environment entries
remain untouched.

#### AsyncSandbox.refresh\_data

```python
async def refresh_data() -> None
```

Read the sandbox's metadata from the API again.

#### AsyncSandbox.wait

```python
async def wait(*,
               until: SandboxWaitState | Sequence[SandboxWaitState] = 'started',
               timeout: float = 60) -> Self
```

Wait until the sandbox reaches `until` (one state or any of several) and return `self`.

`timeout` is the wait budget in seconds (default 60; `0`, or a value
above about 24.8 days, waits without a deadline). Running out raises `RequestTimeoutError`;
reaching `destroying`, `destroyed` or `error` first raises
`SandboxTerminalStateError`. A terminal state the events hub
reports is confirmed with one read before it raises, while the wait has
budget left, unless that state already came from a full read or is
`destroyed`. When the events hub has reported nothing decisive, the
last part of a bounded budget (up to 5 s) reads the state from the
server, so a state the hub missed still ends the wait; the same holds
for the other lifecycle waits and the create and fork waits.

#### AsyncSandbox.start

```python
async def start(*, timeout: float = 60) -> None
```

Start a stopped sandbox, or resume a paused one, and wait until it is `started`.

`timeout` is the wait budget in seconds (default 60; `0`, or a
value above about 24.8 days, = no deadline); running out raises `RequestTimeoutError`, and a
terminal state raises `SandboxTerminalStateError`. Whether the
sandbox can be started is the API's decision: a refusal surfaces as its
typed error.
If a stop or pause is still in progress, wait for it to settle before
sending start or resume, using the same timeout budget.

A stopped macOS sandbox starts with its disk and size on any Mac of the
organization; after a start on a different Mac, iCloud asks the user to
sign in again. It raises `ConflictError` with
`DISK_NOT_READY` while its disk is not ready yet (retry later),
`NO_FREE_SLOT` when no Mac of the organization has space for its
size, `MAC_DISK_FULL` when the Mac with space is low on free disk
space, and `NO_ACTIVE_RESERVATION` when the organization has no Mac
reservation in the region and auto-reserve is off. When the
organization has no Mac reservation in the region and auto-reserve is
on, the start buys one, so it can fail as a create that buys one does: `LimitExceededError` with
`limit == "max_mac_reservations"` at the organization's Mac
reservation limit, `AUTO_RESERVE_LIMIT_REACHED`,
`NO_MAC_AVAILABLE`, `INSUFFICIENT_BALANCE` or `CHARGE_FAILED`.

#### AsyncSandbox.stop

```python
async def stop(*, timeout: float = 60) -> None
```

Stop the sandbox and wait until it is `stopped`.

`timeout` is the wait budget in seconds (default 60; `0`, or a
value above about 24.8 days, = no deadline); running out raises `RequestTimeoutError`, and a
terminal state raises `SandboxTerminalStateError`. Which
sandboxes can stop (today: persistent macOS sandboxes) is the API's
decision; a refusal surfaces as its typed error. While it is stopped,
toolbox calls (process, files, git, …) and its preview URLs answer
`SandboxNotRunningError` (409, `SANDBOX_NOT_RUNNING`);
`start` it first.

#### AsyncSandbox.pause

```python
async def pause(*, timeout: float = 60) -> None
```

Pause the sandbox with its memory and wait until it is `paused`.

`timeout` is the wait budget in seconds (default 60; `0`, or a
value above about 24.8 days, = no deadline). A pause that fails returns the sandbox to `started`; this
then raises `SandboxTerminalStateError`. A paused macOS sandbox
keeps its memory on its Mac. With auto-renew on, it keeps its
reservation renewing; otherwise the sandbox is stopped, with its disk,
before the reservation ends. Which sandboxes can pause is the API's
decision.

#### AsyncSandbox.resume

```python
async def resume(*, timeout: float = 60) -> None
```

Resume a paused sandbox and wait until it is `started`.

`timeout` is the wait budget in seconds (default 60; `0`, or a
value above about 24.8 days, = no deadline). A resume that cannot finish ends `stopped`; this then
raises `SandboxTerminalStateError`.

#### AsyncSandbox.fork

```python
async def fork(*,
               name: Optional[str] = None,
               memory: Optional[bool] = None,
               wait_seconds: float = 60) -> AsyncSandbox
```

Fork this sandbox and return the fork's handle.

By default the fork continues from the source's memory (running
processes included). `memory=False` copies only the disk, and the
fork boots fresh. A macOS fork copies the disk only: omit `memory`
or pass `memory=False` (`memory=True` is refused with
`NOT_SUPPORTED_FOR_CLASS`); a fork of a running macOS sandbox boots
with a fresh machine identity. A macOS fork answers `DISK_NOT_READY`
while the source's disk is not ready yet; retry later.

`wait_seconds` (default 60; `0` returns as soon as the API accepts
the fork; a value above about 24.8 days, the timer maximum, waits with
no deadline) bounds the wait for the state the fork settles in: a fork of
a running source waits for `started`, even if a macOS fork is
temporarily `stopped` while its source releases the disk. A fork of
a paused or stopped macOS source waits for `stopped`. Linux forks
otherwise rest `paused` for a memory fork of a paused source, else
`stopped` (call `start()`). Like `create()`, `fork()` never raises
because of how the wait ended: the default 60-second budget may return
a not-yet-started handle. When the budget runs out or the fork fails,
it returns the handle — check `fork.state`.

#### AsyncSandbox.delete

```python
async def delete(*, timeout: float = 60) -> None
```

Delete the sandbox and wait until it is `destroyed`.

`timeout` is the wait budget in seconds (default 60; `0`, or a
value above about 24.8 days, = no deadline); running out raises `RequestTimeoutError`, and an
`error` state raises `SandboxTerminalStateError` (one the
events hub reports is confirmed with one read first, while the wait
has budget left and unless it already came from a full read). A 404 while
waiting counts as destroyed. A destroyed sandbox does not guarantee
that its image can already be deleted: image deletion may still
answer 409 for a while.

#### AsyncSandbox.update\_lifecycle\_policy

```python
async def update_lifecycle_policy(*,
                                  timeout_seconds: Optional[int] = None,
                                  on_timeout: Optional[LifecycleAction] = None,
                                  idle_expiry_seconds: Optional[int] = None,
                                  on_idle_timeout: Optional[LifecycleAction] = None) -> SandboxLifecycle
```

Update this sandbox's lifecycle policy; omitted knobs stay unchanged.

`timeout_seconds` re-anchors the deadline from now (`>= 1`; the timeout
cannot be disabled). `idle_expiry_seconds=DISABLED` clears the idle pair;
arming it on a sandbox with no idle policy requires `on_idle_timeout`.
Setting either action to `"delete"` — or touching a pair whose current
or resulting action is `"delete"` — requires the API key to hold
`delete:sandboxes` in addition to `write:sandboxes`. A sandbox that
is deleted or being deleted raises `ConflictError` (`CONFLICT`).

#### AsyncSandbox.reset\_idle\_timer

```python
async def reset_idle_timer() -> SandboxLifecycle
```

Reset this sandbox's idle timer (an explicit out-of-band keepalive).

For work the platform cannot see: bumps the sandbox's activity clock
(`last_activity_at`, attributed
server-side to the `api` source), which restarts the idle countdown —
`idle_timeout_at` re-anchors to now + `idle_expiry_seconds`. The
wall-clock `timeout_at` is NOT affected. Succeeds whether or not an
idle timeout is armed (an unarmed sandbox echoes
`idle_timeout_at=None`), and in any state but deleting or deleted —
a never-started sandbox already carries its creation-time activity
stamp, which the reset advances. A sandbox that is deleted or being
deleted raises `ConflictError` (`CONFLICT`).

The echo is the full post-reset lifecycle, the same shape
`update_lifecycle_policy` returns. Advance-only: a newer concurrent
activity bump keeps the clock, and what comes back is the state that
won.

#### AsyncSandbox.get\_network\_policy

```python
async def get_network_policy() -> NetworkPolicyInfo
```

#### AsyncSandbox.update\_network\_policy

```python
async def update_network_policy(*,
                                network_policy: NetworkPolicyInput,
                                if_match: str) -> NetworkPolicyInfo
```

#### AsyncSandbox.reset\_network\_policy

```python
async def reset_network_policy(*, if_match: str) -> NetworkPolicyInfo
```

#### AsyncSandbox.get\_secrets

```python
async def get_secrets() -> SandboxSecretsInfo
```

Read this sandbox's attached secret names and their apply state (`GET /sandboxes/{id}/secrets`).

Returns names and revisions only, never values. `etag` is the `If-Match` value for
`replace_secrets`; `status` is `pending` until the sandbox has applied
`desired_revision`.

#### AsyncSandbox.replace\_secrets

```python
async def replace_secrets(*,
                          secrets: Sequence[str],
                          if_match: str) -> SandboxSecretsInfo
```

Replace the full set of project secrets attached to this sandbox (`PUT /sandboxes/{id}/secrets`).

`secrets` names project secrets; unchanged names remain attached. `if_match` is
the `etag` of the last read; a stale one raises `PreconditionFailedError`. The change
applies asynchronously: poll `get_secrets` until `status` is `applied`. Running
processes keep their environment; processes started afterwards see the new names.

#### AsyncSandbox.capture\_image

```python
async def capture_image(*,
                        name: Optional[str] = None,
                        idle_expiry_seconds: Optional[int] = None) -> Image
```

Capture this sandbox's filesystem as a new `Image` (`POST /sandboxes/{id}/images`).

The result boots new sandboxes (`daytona.create(image.id)`); a Linux
sandbox keeps running. A macOS
sandbox must be persistent and stopped; the capture answers
`DISK_NOT_READY` while its disk is not ready yet (retry later).
The credential needs `write:sandboxes` in addition to `write:images`;
without it the capture raises `ForbiddenError` (403).

`name` makes the image named and permanent (same name rules as
`images.build`; a name that already exists raises
`ImageNameTakenError`). `idle_expiry_seconds` is
the idle-retention window of an ANONYMOUS capture: it is deleted once
that long has passed without a sandbox being created from it (every
create restarts the clock). Same rule as `images.build`: omitted or
`-1` ⇒ the server maximum (7 days by default); above it ⇒ 400.
Promote the image to keep it. `idle_expiry_seconds` with `name` is
a 400. Returns once the API accepts the capture; wait for readiness
with `images.get(image.id, wait="ready")`.

#### AsyncSandbox.create\_snapshot

```python
async def create_snapshot(name: str, /) -> Snapshot
```

Capture this sandbox, memory and disk, as a new `Snapshot`
(`POST /sandboxes/{id}/snapshots`).

The credential needs `write:sandboxes` in addition to
`write:snapshots`; without it the capture raises
`ForbiddenError` (403).

#### AsyncSandbox.build\_logs

```python
async def build_logs() -> str
```

Return retained build output as one-shot text, not a live follower.

The body includes a state line and the currently available build tail.
A sandbox with no image build (for example a registry image) raises
`NotFoundError`. Retained-tail truncation is indicated in the text.
Use `follow_build_logs` for live output and completeness metadata.

#### AsyncSandbox.follow\_build\_logs

```python
async def follow_build_logs(*,
                            on_logs: BuildLogsCallback,
                            on_event: Optional[BuildLogEventCallback] = None,
                            cursor: Optional[str] = None,
                            timeout: Optional[float] = None) -> BuildLogFollowResult
```

Observe this sandbox's build without changing its execution lifetime.

`on_logs` receives decoded output; optional `on_event` receives each
typed `BuildLogEvent`. Either callback may return an awaitable, which
is awaited before the next event. `timeout` (seconds) bounds this
observation only; cancelling the awaiting task closes the stream, not
the build. An HTTP error of the initial discovery request, including a
404 for a sandbox with no image build, raises its typed error
(`NotFoundError`, ...) unchanged; once the follower is running, a
failure raises `BuildLogInterruptedError` with the last cursor. It
does not fall back to another log source.

#### AsyncSandbox.create\_access\_token

```python
async def create_access_token(*,
                              operations: Optional[Sequence[str]] = None,
                              ports: Optional[Sequence[int]] = None,
                              ttl_seconds: Optional[int] = None) -> SandboxAccessToken
```

Mint a scoped, short-lived access token for THIS sandbox.

The token authorizes sandbox services (toolbox, SSH, desktop,
private previews) and the self-service sandbox routes, for exactly the
granted `operations` and `ports` — hand it to a collaborator, a CI
job, or a browser instead of a project API key.

`operations` is the sandbox-operation vocabulary (`toolbox`,
`toolbox:exec`, `toolbox:fs`, `toolbox:git`, `desktop`,
`ssh`, `sandbox:stop`, `sandbox:pause`, `sandbox:delete`);
omitted means the minter's full grantable set, and `[]` is a valid
ports-only grant. `toolbox:git` without
`toolbox:exec` covers the git operations except writing git config:
`git.set_config()` with such a token raises `ForbiddenError`
(403); `git.get_config()` still works. `ports` names the private-preview
ports the token may reach (omitted = all, `[]` = none); the sandbox
daemon's ports 2280, 2281 and 22220 are never preview ports and are
refused with `daytona.v2.errors.BadRequestError` before any
request. `ttl_seconds`
overrides the deployment's default lifetime, capped server-side; an
unknown operation or an over-cap TTL is a 400, never a silent
narrowing. The token cannot be refreshed and cannot mint further
credentials — mint a fresh one here instead.

#### AsyncSandbox.rotate\_signing\_key

```python
async def rotate_signing_key() -> None
```

Rotate the sandbox's signing key, invalidating existing pre-signed URLs.

Every pre-signed URL minted so far stops working within ~30 s; new URLs
from `presigned_download_url` / `presigned_upload_url` use the new
key. The key itself is never returned.

Like minting, this requires the API-provided toolbox URL or a
sandbox-scoped URL template, rather than an arbitrary custom endpoint.

## SandboxEventsConfig

```python
@dataclass(frozen=True, kw_only=True)
class SandboxEventsConfig()
```

Configuration for the sandbox-state events hub.

`enabled` — set to `False` (or `DAYTONA_SANDBOX_EVENTS=0`) to fall
back to long-poll for every wait.  `reconcile_interval` is in seconds
(`0` / `None` disables the timer).  `idle_close` (seconds) closes
idle sockets; `None` keeps them open indefinitely.

**Attributes**:

- `enabled` _bool = True_
- `reconcile_interval` _Optional\[float\] = 60.0_
- `idle_close` _Optional\[float\] = None_

## SandboxSecretsInfo

```python
@dataclass(frozen=True, kw_only=True)
class SandboxSecretsInfo()
```

**Attributes**:

- `secrets` _tuple\[str, ...\]_
- `desired_revision` _int_
- `etag` _str_
- `applied_revision` _Optional\[int\] = None_
- `status` _Optional\[str\] = None_
- `error` _Optional\[str\] = None_
- `capture_status` _Optional\[str\] = None_
- `capture_unresolved_count` _Optional\[int\] = None_

## SandboxLifecycleJSON

```python
class SandboxLifecycleJSON(TypedDict, total=False)
```

The lifecycle policy inside `SandboxHandleJSON` (timestamps RFC 3339).

**Attributes**:

- `timeoutSeconds` _int_
- `onTimeout` _str_
- `timeoutAt` _str_
- `idleExpirySeconds` _int_
- `onIdleTimeout` _str_
- `idleTimeoutAt` _str_
- `lastActivityAt` _str_
- `lastActivitySource` _str_

## SandboxHandleJSON

```python
class SandboxHandleJSON(TypedDict, total=False)
```

A sandbox handle's metadata as plain JSON: `Sandbox.to_json()`.

The same camelCase shape as the TypeScript SDK's `SandboxHandleJSON`, so a
snapshot stored by one SDK reads the same in the other. A key is present only
when the handle knows its value. It carries no URL and no credential, and it
is a snapshot, not a way back: reconnect with `client.get(json["sandboxId"])`.
Timestamps are RFC 3339 strings.

**Attributes**:

- `sandboxId` _Required\[str\]_
- `name` _str_
- `state` _SandboxState_
- `rawState` _str_
- `image` _ArtifactRefJSON_
- `snapshot` _ArtifactRefJSON_
- `region` _str_
- `labels` _Dict\[str, str\]_
- `cpu` _float_
- `cpuMax` _float_
- `memory` _float_
- `memoryMax` _float_
- `disk` _float_
- `diskMax` _float_
- `sandboxClass` _Literal\['linux', 'macos', 'unknown'\]_
- `rawSandboxClass` _str_
- `persistent` _bool_
- `spot` _bool_
- `spotEvictedAt` _str_
- `lifecyclePolicy` _SandboxLifecycleJSON_
- `forkedFrom` _str_
- `reservationId` _str_
- `user` _str_
- `error` _str_
- `imageBuildId` _str_

## SandboxLimits

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class SandboxLimits()
```

**Attributes**:

- `concurrent` _UsageLimit_
- `total` _UsageLimit_

## SandboxResourceLimits

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class SandboxResourceLimits()
```

Per-sandbox maximums for Linux sandboxes: `cores_max` in cores and `memory_max_mib`.

**Attributes**:

- `max_cores` _float_
- `max_memory_mib` _int_

## SandboxLifecycle

```python
@dataclass(frozen=True, kw_only=True)
class SandboxLifecycle()
```

Lifecycle policy as the API reports it.

`timeout_seconds` is the timeout duration; `timeout_at` is the current absolute deadline it
derives. `idle_timeout_at` is when `on_idle_timeout` becomes eligible
to fire — `last_activity_at + idle_expiry_seconds` — and any activity
(traffic, SSH, a non-PTY process or code execution started through the
process API that is still running — `exec`, `process.start`,
`run_code` and interpreter executions included — or
`AsyncSandbox.reset_idle_timer`) pushes it; `None`
when the idle pair is not armed or the sandbox has never been active.
`timeout_at`, `idle_timeout_at`, `last_activity_at` and
`last_activity_source` are server-derived and read-only. An action the
SDK does not know yet (a newer server) is passed through as its wire
string.

**Attributes**:

- `timeout_seconds` _Optional\[int\] = None_
- `on_timeout` _Optional\[str\] = None_
- `timeout_at` _Optional\[datetime\] = None_
- `idle_expiry_seconds` _Optional\[int\] = None_
- `on_idle_timeout` _Optional\[str\] = None_
- `idle_timeout_at` _Optional\[datetime\] = None_
- `last_activity_at` _Optional\[datetime\] = None_
- `last_activity_source` _Optional\[str\] = None_

## SystemMetrics

```python
@dataclass(frozen=True, kw_only=True)
class SystemMetrics()
```

One snapshot of the sandbox's resource usage (`sandbox.metrics()`).

**Attributes**:

- `timestamp` _datetime_
- `cpu_count` _int_
- `cpu_utilization` _float_ - Fraction of total CPU capacity in use, between 0 and 1.
- `memory_usage_bytes` _int_
- `memory_total_bytes` _int_
- `disk_usage_bytes` _int_
- `disk_total_bytes` _int_

## PreviewEndpoint

```python
@dataclass(frozen=True, kw_only=True)
class PreviewEndpoint()
```

A sandbox HTTP preview endpoint.

**Attributes**:

- `port` _int_
- `public` _bool_
- `url` _str_
- `created_at` _Optional\[datetime\] = None_

## PreviewLink

```python
@dataclass(frozen=True, kw_only=True)
class PreviewLink()
```

Preview URL plus an access token for one sandbox port.

Send `token` in the `X-Daytona-Preview-Token` header to reach a private
endpoint; without a credential it answers 401. Public endpoints set
`token` to `""` and need no credential.
`expires_at` is set when the token's expiry is known, else `None`.

Example — curl a private endpoint::

    link = await sandbox.ports.preview_link(8080)
    # curl -H "X-Daytona-Preview-Token: \<link.token>" \<link.url>

For a shareable URL that works in a browser without extra headers, use
`daytona.v2.ports.AsyncPortsService.signed_preview_link` instead.

**Attributes**:

- `url` _str = field(repr=False)_
- `token` _str = field(repr=False)_
- `expires_at` _Optional\[datetime\] = None_

## SignedPreviewLink

```python
@dataclass(frozen=True, kw_only=True)
class SignedPreviewLink()
```

Self-contained signed URL for one sandbox port.

The token is embedded in the hostname — no extra headers or credentials are
needed. The link expires at `expires_at`, which the contract requires
(a response without it is a `BadRequestError`). Expire it early with
`daytona.v2.ports.AsyncPortsService.expire_signed_preview_links`,
which expires every signed preview link of the sandbox.

**Attributes**:

- `url` _str = field(repr=False)_
- `token` _str = field(repr=False)_
- `expires_at` _datetime_

## SandboxAccessToken

```python
@dataclass(frozen=True, kw_only=True)
class SandboxAccessToken()
```

A short-lived per-sandbox access token (`POST …/access-token`).

`access_token` is a bearer for sandbox services (toolbox, SSH,
desktop, private previews) and for the self-service sandbox routes named
by `operations` (`sandbox:stop` / `sandbox:pause` /
`sandbox:delete`). It expires at `expires_at` and cannot
be refreshed — mint a fresh one with
`daytona.v2.sandbox.AsyncSandbox.create_access_token` instead. `ports`
is the granted private-preview port set; `None` means every port.

**Attributes**:

- `access_token` _str = field(repr=False)_
- `token_type` _str_
- `expires_at` _datetime_
- `operations` _tuple\[str, ...\]_
- `ports` _Optional\[tuple\[int, ...\]\] = None_

## SandboxSearchFilters

```python
@dataclass(frozen=True, kw_only=True)
class SandboxSearchFilters()
```

The `GET /sandboxes/search` filters (`Daytona.search()`).

`states`, `sandbox_class` and `region` take a single value or a list
(any-of); `states` are the SDK's sandbox states (`started`,
`stopped`, ...), sent as the API's status names. `labels` is a
containment match; timestamp starts are inclusive and ends are exclusive.

**Attributes**:

- `q` _Optional\[str\] = None_
- `states` _Optional\[Union\[SearchSandboxState, Sequence\[SearchSandboxState\]\]\] = None_
- `sandbox_class` _Optional\[Union\[SandboxClass, Sequence\[SandboxClass\]\]\] = None_
- `region` _Optional\[Union\[str, Sequence\[str\]\]\] = None_
- `image_ref` _Optional\[str\] = None_
- `image_ref_prefix` _Optional\[str\] = None_
- `labels` _Optional\[Mapping\[str, str\]\] = None_
- `spot` _Optional\[bool\] = None_
- `forked_from` _Optional\[str\] = None_
- `min_cores` _Optional\[float\] = None_
- `max_cores` _Optional\[float\] = None_
- `min_memory_mib` _Optional\[int\] = None_
- `max_memory_mib` _Optional\[int\] = None_
- `min_disk_mib` _Optional\[int\] = None_
- `max_disk_mib` _Optional\[int\] = None_
- `created_start_at` _Optional\[SearchTimestamp\] = None_
- `created_end_at` _Optional\[SearchTimestamp\] = None_
- `updated_start_at` _Optional\[SearchTimestamp\] = None_
- `updated_end_at` _Optional\[SearchTimestamp\] = None_
- `last_activity_start_at` _Optional\[SearchTimestamp\] = None_
- `last_activity_end_at` _Optional\[SearchTimestamp\] = None_
- `sort` _Optional\[SearchSort\] = None_
- `order` _Optional\[SearchOrder\] = None_

## SandboxState

```python
SandboxState = Literal['queued', 'creating', 'starting', 'started', 'pausing', 'paused', 'stopping', 'stopped', 'destroying', 'destroyed', 'error', 'unknown']
```

## SandboxWaitState

```python
SandboxWaitState = Literal['queued', 'starting', 'started', 'pausing', 'paused', 'stopping', 'stopped', 'destroying', 'destroyed']
```

## SandboxClass

```python
SandboxClass = Literal['linux', 'macos']
```

## MacBootMode

```python
MacBootMode = str
```
