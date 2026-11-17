# Sandbox (Python SDK reference)

## Contents

- [Sandbox](#sandbox)
- [AsyncSandbox](#asyncsandbox)
- [SandboxEventsConfig](#sandboxeventsconfig)
- [SandboxSecretsInfo](#sandboxsecretsinfo)
- [SandboxInfo](#sandboxinfo)
- [SandboxLifecycle](#sandboxlifecycle)
- [PreviewEndpoint](#previewendpoint)
- [PreviewLink](#previewlink)
- [SignedPreviewLink](#signedpreviewlink)
- [SandboxAccessToken](#sandboxaccesstoken)
- [SandboxSearchFilters](#sandboxsearchfilters)
- [SandboxStateSnapshot](#sandboxstatesnapshot)
- [SystemMetrics](#systemmetrics)
- [SandboxWaitState](#sandboxwaitstate)
- [SandboxClass](#sandboxclass)
- [MacBootMode](#macbootmode)

## Sandbox

```python
class Sandbox()
```

Serializable sandbox handle with process/fs/git/interpreter/pty namespaces.

#### Sandbox.\_\_init\_\_

```python
def __init__(impl: AsyncSandbox, bridge: SyncBridge) -> None
```

#### Sandbox.id

```python
@property
def id() -> str
```

#### Sandbox.name

```python
@property
def name() -> str | None
```

#### Sandbox.state

```python
@property
def state() -> Literal['queued', 'creating', 'starting', 'started', 'pausing', 'paused', 'stopping', 'stopped', 'destroying', 'destroyed', 'error', 'unknown']
```

#### Sandbox.image\_build\_id

```python
@property
def image_build_id() -> str | None
```

#### Sandbox.image

```python
@property
def image() -> ImageRef | None
```

#### Sandbox.snapshot

```python
@property
def snapshot() -> SnapshotRef | None
```

#### Sandbox.target

```python
@property
def target() -> str | None
```

#### Sandbox.region

```python
@property
def region() -> Optional[str]
```

#### Sandbox.labels

```python
@property
def labels() -> Dict[str, str]
```

#### Sandbox.cpu

```python
@property
def cpu() -> Optional[float]
```

#### Sandbox.cpu\_max

```python
@property
def cpu_max() -> Optional[float]
```

#### Sandbox.memory

```python
@property
def memory() -> Optional[float]
```

#### Sandbox.memory\_max

```python
@property
def memory_max() -> Optional[float]
```

#### Sandbox.disk

```python
@property
def disk() -> Optional[float]
```

#### Sandbox.disk\_max

```python
@property
def disk_max() -> Optional[float]
```

#### Sandbox.sandbox\_class

```python
@property
def sandbox_class() -> Optional[SandboxClass]
```

#### Sandbox.persistent

```python
@property
def persistent() -> Optional[bool]
```

#### Sandbox.spot

```python
@property
def spot() -> Optional[bool]
```

#### Sandbox.spot\_evicted\_at

```python
@property
def spot_evicted_at() -> Optional[str]
```

#### Sandbox.lifecycle\_policy

```python
@property
def lifecycle_policy() -> Optional[SandboxLifecycle]
```

#### Sandbox.forked\_from

```python
@property
def forked_from() -> Optional[str]
```

#### Sandbox.reservation\_id

```python
@property
def reservation_id() -> Optional[str]
```

#### Sandbox.user

```python
@property
def user() -> Optional[str]
```

#### Sandbox.error

```python
@property
def error() -> Optional[str]
```

#### Sandbox.error\_reason

```python
@property
def error_reason() -> Optional[str]
```

#### Sandbox.access\_token

```python
@property
def access_token() -> str | None
```

#### Sandbox.access\_token\_expires\_at

```python
@property
def access_token_expires_at() -> str | None
```

#### Sandbox.toolbox\_proxy\_url

```python
@property
def toolbox_proxy_url() -> str | None
```

#### Sandbox.build\_logs

```python
def build_logs() -> str
```

Return retained build output as one-shot text, not a live follower.

#### Sandbox.create\_access\_token

```python
def create_access_token(*,
                        operations: Optional[Sequence[str]] = None,
                        ports: Optional[Sequence[int]] = None,
                        ttl_seconds: Optional[int] = None) -> SandboxAccessToken
```

Mint a scoped, short-lived access token for THIS sandbox.

#### Sandbox.create\_snapshot

```python
def create_snapshot(name: str) -> Snapshot
```

#### Sandbox.delete

```python
def delete() -> None
```

Request sandbox deletion.

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
         terminal: Optional[TerminalSize] = None,
         keep_logs: Optional[KeepLogs] = None) -> ProcessResult
```

Run a command, wait for its shell to exit, and collect its output.

#### Sandbox.follow\_build\_logs

```python
def follow_build_logs(*,
                      on_logs: _LogsCallback,
                      on_event: Optional[_EventCallback] = None,
                      cursor: Optional[str] = None,
                      timeout: Optional[float] = None) -> BuildLogFollowResult
```

Observe this sandbox's build without changing its execution lifetime.

#### Sandbox.fork

```python
def fork(*,
         name: Optional[str] = None,
         memory: Optional[bool] = None,
         timeout: Optional[float] = None) -> Sandbox
```

Fork this sandbox.

#### Sandbox.get\_network\_policy

```python
def get_network_policy() -> NetworkPolicyInfo
```

#### Sandbox.get\_secrets

```python
def get_secrets() -> SandboxSecretsInfo
```

Read this sandbox's attached secret names and their apply state (`GET /sandboxes/{id}/secrets`).

#### Sandbox.metrics

```python
def metrics() -> SystemMetrics
```

#### Sandbox.pause

```python
def pause(*, timeout: float = 60) -> None
```

Pause a macOS sandbox, preserving its memory.

#### Sandbox.refresh\_data

```python
def refresh_data(*,
                 timeout: Optional[float] = None,
                 wait: SandboxWaitState | None = None,
                 wait_timeout_ms: int | None = None) -> None
```

Refresh sandbox fields from the API.

#### Sandbox.replace\_secrets

```python
def replace_secrets(*, secrets: Sequence[str], if_match: str) -> SandboxSecretsInfo
```

Replace the full set of project secrets attached to this sandbox (`PUT /sandboxes/{id}/secrets`).

#### Sandbox.reset\_idle\_timer

```python
def reset_idle_timer() -> SandboxLifecycle
```

Reset this sandbox's idle timer (an explicit out-of-band keepalive).

#### Sandbox.reset\_network\_policy

```python
def reset_network_policy(*, if_match: str) -> NetworkPolicyInfo
```

#### Sandbox.resume

```python
def resume(*, timeout: float = 60) -> None
```

Resume a paused macOS sandbox and wait for started.

#### Sandbox.rotate\_signing\_key

```python
def rotate_signing_key() -> None
```

Rotate the sandbox's signing key, invalidating existing pre-signed URLs.

#### Sandbox.run\_code

```python
def run_code(code: str,
             *,
             language: str = 'python',
             context: Optional[InterpreterContext] = None,
             isolated: bool = False,
             timeout: Optional[float] = None,
             cwd: Optional[str] = None,
             env: Optional[Mapping[str, str]] = None) -> InterpreterResult
```

#### Sandbox.set\_labels

```python
def set_labels(*, labels: Mapping[str, str]) -> Dict[str, str]
```

Replace the sandbox label set; pass `{}` to clear all labels.

#### Sandbox.snapshot\_filesystem

```python
def snapshot_filesystem(*,
                        name: Optional[str] = None,
                        idle: Optional[int] = None) -> Image
```

Snapshot this sandbox's filesystem as a new `Image` (`POST /sandboxes/{id}/images`).

#### Sandbox.start

```python
def start(*, timeout: float = 60) -> None
```

Start a stopped sandbox, or resume a paused one, and wait for started.

#### Sandbox.stop

```python
def stop() -> None
```

Stop a persistent macOS sandbox.

#### Sandbox.to\_json

```python
def to_json() -> Dict[str, JsonValue]
```

The sandbox's data as JSON, without any toolbox URL; resume a stored sandbox with `get(info["sandboxId"])`.

#### Sandbox.update\_env

```python
def update_env(env: Optional[Mapping[str, str]] = None,
               *,
               unset: Sequence[str] = ()) -> None
```

Update SDK-managed environment entries for new processes, PTYs, and sessions.

#### Sandbox.update\_lifecycle\_policy

```python
def update_lifecycle_policy(*,
                            timeout_seconds: Optional[int] = None,
                            on_timeout: Optional[LifecycleAction] = None,
                            idle_expiry_seconds: Optional[int] = None,
                            on_idle_timeout: Optional[LifecycleAction] = None) -> SandboxLifecycle
```

Update this sandbox's lifecycle policy; omitted knobs stay unchanged.

#### Sandbox.update\_network\_policy

```python
def update_network_policy(*,
                          network_policy: NetworkPolicyInput,
                          if_match: str) -> NetworkPolicyInfo
```

#### Sandbox.wait

```python
def wait(*, until: SandboxWaitState = 'started', timeout: Optional[float] = 60) -> Self
```

Wait for one public sandbox state and return `self`.

#### Sandbox.wait\_for\_state

```python
def wait_for_state(states: Sequence[SandboxWaitState],
                   terminal_states: Sequence[SandboxState] = DEFAULT_SANDBOX_TERMINAL_STATES,
                   *,
                   timeout: Optional[float] = None) -> None
```

Wait until the sandbox reaches one of `states`.

#### Sandbox.computer\_use

```python
@property
def computer_use() -> ComputerUseService
```

#### Sandbox.docker

```python
@property
def docker() -> DockerService
```

Docker Engine status inside the sandbox; see `DockerService`.

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

#### Sandbox.interpreter

```python
@property
def interpreter() -> InterpreterService
```

#### Sandbox.lsp

```python
@property
def lsp() -> LspService
```

#### Sandbox.mac\_boot\_mode

```python
@property
def mac_boot_mode() -> Optional[MacBootMode]
```

macOS only: how the sandbox resumed, as reported by the API, or None.

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

#### Sandbox.raw\_state

```python
@property
def raw_state() -> str
```

Wire status string exactly as the server sent it.

#### Sandbox.volumes

```python
@property
def volumes() -> SandboxVolumesService
```

## AsyncSandbox

```python
class AsyncSandbox()
```

Serializable sandbox handle with process/fs/git/interpreter/pty namespaces.

#### AsyncSandbox.\_\_init\_\_

```python
def __init__(info: SandboxInfo,
             api: Optional[AsyncTransport],
             toolbox: Optional[AsyncTransport],
             *,
             toolbox_owner: Optional[AsyncTransport] = None,
             toolbox_url: Optional[str] = None,
             language: Optional[str] = None,
             access_token: Optional[str] = None,
             toolbox_base_url: Optional[str] = None,
             toolbox_token: Optional[str] = None,
             direct_toolbox_url: Optional[str] = None,
             request_timeout: Optional[float] = None,
             access_token_expires_at: Optional[str] = None,
             access_token_caller_supplied: Optional[bool] = None,
             hub: Optional[WaitHub] = None,
             hub_provider: Optional[Callable[[], Optional[WaitHub]]] = None) -> None
```

#### AsyncSandbox.raw\_state

```python
@property
def raw_state() -> str
```

Wire status string exactly as the server sent it.

Informational only — the SDK never branches on this value.  Use
`state` for all flow-control logic; `raw_state` is useful for
logging when `state == "unknown"` (the SDK does not recognize the value).

#### AsyncSandbox.from\_api

```python
@classmethod
def from_api(sandbox_data: SandboxDto | SandboxListItem | Mapping[str, JsonValue],
             api: Optional[AsyncTransport],
             toolbox: Optional[AsyncTransport],
             *,
             toolbox_owner: Optional[AsyncTransport] = None,
             toolbox_url: Optional[str] = None,
             language: Optional[str] = None,
             access_token: Optional[str] = None,
             toolbox_base_url: Optional[str] = None,
             toolbox_token: Optional[str] = None,
             direct_toolbox_url: Optional[str] = None,
             request_timeout: Optional[float] = None,
             access_token_expires_at: Optional[str] = None,
             access_token_caller_supplied: Optional[bool] = None,
             hub: Optional[WaitHub] = None,
             hub_provider: Optional[Callable[[], Optional[WaitHub]]] = None) -> AsyncSandbox
```

Create a sandbox handle from an API response.

An explicitly passed `access_token` is treated as caller-supplied
(never silently replaced by a minted one) unless
`access_token_caller_supplied=False` marks it as the SDK-owned
create-response credential.

A `toolbox_proxy_url` inside `sandbox_data` is ignored unless the SDK's own
refresh/fork paths mark it as a fresh API response, so
stored data never chooses where a credential goes. Pass
`toolbox` or `toolbox_url` to set the toolbox explicitly — the
toolbox credential goes there, so pass only a URL you trust.

#### AsyncSandbox.mac\_boot\_mode

```python
@property
def mac_boot_mode() -> Optional[MacBootMode]
```

macOS only: how the sandbox resumed, as reported by the API, or None.

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

#### AsyncSandbox.lsp

```python
@property
def lsp() -> AsyncLspService
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
               terminal: Optional[TerminalSize] = None,
               keep_logs: Optional[KeepLogs] = None) -> ProcessResult
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
:param execution_timeout: Server-side deadline in seconds. The sandbox kills
    the process tree when this expires.
:returns: `daytona.v2.types.ProcessResult` with `stdout`, `stderr`,
    `output`, `exit_code`, and `reason`.

#### AsyncSandbox.run\_code

```python
async def run_code(code: str,
                   *,
                   language: str = 'python',
                   context: Optional[AsyncInterpreterContext] = None,
                   isolated: bool = False,
                   timeout: Optional[float] = None,
                   cwd: Optional[str] = None,
                   env: Optional[Mapping[str, str]] = None) -> InterpreterResult
```

#### AsyncSandbox.to\_json

```python
def to_json() -> Dict[str, JsonValue]
```

The sandbox's data as JSON, without any toolbox URL; resume a stored sandbox with `get(info["sandboxId"])`.

#### AsyncSandbox.set\_labels

```python
async def set_labels(*, labels: Mapping[str, str]) -> Dict[str, str]
```

Replace the sandbox label set; pass `{}` to clear all labels.

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
async def refresh_data(*,
                       timeout: Optional[float] = None,
                       wait: SandboxWaitState | None = None,
                       wait_timeout_ms: int | None = None) -> None
```

Refresh sandbox fields from the API.

#### AsyncSandbox.wait\_for\_state

```python
async def wait_for_state(states: Sequence[SandboxWaitState],
                         terminal_states: Sequence[SandboxState] = DEFAULT_SANDBOX_TERMINAL_STATES,
                         *,
                         timeout: Optional[float] = None) -> None
```

Wait until the sandbox reaches one of `states`.

`timeout` is the caller wait budget in seconds; `None` and `0`
wait unbounded. If the sandbox reaches a terminal state before any
target state, a typed conflict error is raised with the observed public
sandbox state attached as `error.state`.

#### AsyncSandbox.wait

```python
async def wait(*,
               until: SandboxWaitState = 'started',
               timeout: Optional[float] = 60) -> Self
```

Wait for one public sandbox state and return `self`.

`timeout` is a caller wait budget in seconds. The default is 60;
`None` and `0` wait without a deadline. Timeout raises
`RequestTimeoutError` and a terminal state before `until` raises
`SandboxTerminalStateError`.

#### AsyncSandbox.start

```python
async def start(*, timeout: float = 60) -> None
```

Start a stopped sandbox, or resume a paused one, and wait for started.

#### AsyncSandbox.pause

```python
async def pause(*, timeout: float = 60) -> None
```

Pause a macOS sandbox, preserving its memory.

macOS waits up to `timeout` for `paused` and raises
`SandboxTerminalStateError` if the pause fails. A paused macOS
sandbox keeps its Mac slot but does not keep its reservation renewing.

#### AsyncSandbox.resume

```python
async def resume(*, timeout: float = 60) -> None
```

Resume a paused macOS sandbox and wait for started.

A macOS resume the Mac cannot finish ends `stopped`; this then raises
`SandboxTerminalStateError`.

#### AsyncSandbox.stop

```python
async def stop() -> None
```

Stop a persistent macOS sandbox.

#### AsyncSandbox.fork

```python
async def fork(*,
               name: Optional[str] = None,
               memory: Optional[bool] = None,
               timeout: Optional[float] = None) -> AsyncSandbox
```

Fork this sandbox.

By default the fork continues from the source's memory (running
processes included). `memory=False` copies only the disk, and the
fork boots fresh. Linux forks are created from running sandboxes and
start automatically.

A macOS fork copies the disk only: omit `memory` or pass
`memory=False` (`memory=True` is refused with
`NOT_SUPPORTED_FOR_CLASS`). A fork of a running macOS sandbox boots
with a fresh machine identity; a fork of a paused or stopped one rests
`stopped`. A fork needs available capacity for its size; insufficient
capacity can answer `NO_FREE_SLOT` or `MAC_DISK_FULL`.

With `timeout` (seconds; `0` waits without a deadline), wait for
the state the fork settles in: `started` for a Linux fork, and
`started` or `stopped` for a macOS fork. Without it, return as soon
as the server accepts the fork.

#### AsyncSandbox.delete

```python
async def delete() -> None
```

Request sandbox deletion.

Returning, a `destroyed` state, or a subsequent 404 does not guarantee
that the image can already be deleted. Image deletion may still return 409.

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
`delete:sandboxes` in addition to `write:sandboxes`.

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
`idle_timeout_at=None`), and in any state — a never-started sandbox
already carries its creation-time activity stamp, which the reset
advances.

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

#### AsyncSandbox.snapshot\_filesystem

```python
async def snapshot_filesystem(*,
                              name: Optional[str] = None,
                              idle: Optional[int] = None) -> Image
```

Snapshot this sandbox's filesystem as a new `Image` (`POST /sandboxes/{id}/images`).

The result boots new sandboxes (`daytona.create(image.id)`); a Linux
sandbox keeps running. A macOS
sandbox must be persistent and stopped; it cannot start until the
snapshot is `ready`.

`name` makes the image named and permanent. `idle` (seconds) is the
idle-retention window of an ANONYMOUS capture: it is deleted once that
long has passed without a sandbox being created from it (every create
restarts the clock). Same rule as `images.build`: omitted or `-1` ⇒
the server maximum (7 days by default); above it ⇒ 400. Promote the
image to keep it. `idle` with `name` is a 400.

#### AsyncSandbox.create\_snapshot

```python
async def create_snapshot(name: str) -> Snapshot
```

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
                            on_logs: _LogsCallback,
                            on_event: Optional[_EventCallback] = None,
                            cursor: Optional[str] = None,
                            timeout: Optional[float] = None) -> BuildLogFollowResult
```

Observe this sandbox's build without changing its execution lifetime.

`on_logs` receives decoded output; optional `on_event` receives each
typed `BuildLogEvent`. Either callback may return an awaitable, which
is awaited before the next event. `timeout` (seconds) bounds this
observation only; cancelling the awaiting task closes the stream, not
the build. Discovery failures, including a 404 for a sandbox with no
image build, raise `BuildLogInterruptedError` with the HTTP status
and last cursor. They do not fall back to another log source.

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
`toolbox:exec`, `toolbox:fs`, `toolbox:git`, `toolbox:lsp`,
`desktop`, `ssh`, `sandbox:stop`, `sandbox:pause`,
`sandbox:delete`); omitted means the minter's full grantable set, and
`[]` is a valid ports-only grant. `ports` names the private-preview
ports the token may reach (omitted = all, `[]` = none). `ttl_seconds`
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
@dataclass(frozen=True)
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
@dataclass(frozen=True)
class SandboxSecretsInfo()
```

**Attributes**:

- `secrets` _List\[str\]_
- `desired_revision` _int_
- `etag` _str_
- `http_status` _int_
- `applied_revision` _Optional\[int\] = None_
- `status` _Optional\[str\] = None_
- `error` _Optional\[str\] = None_
- `capture_status` _Optional\[str\] = None_
- `capture_unresolved_count` _Optional\[int\] = None_

## SandboxInfo

```python
@dataclass(frozen=True)
class SandboxInfo()
```

Serializable sandbox DTO.

**Attributes**:

- `id` _str_
- `name` _Optional\[str\] = None_
- `state` _SandboxState = 'unknown'_
- `image` _Optional\[ImageRef\] = None_
- `target` _Optional\[str\] = None_
- `snapshot` _Optional\[SnapshotRef\] = None_
- `image_build_id` _Optional\[str\] = None_
- `region` _Optional\[str\] = field(default=None, kw_only=True)_
- `labels` _Dict\[str, str\] = field(default_factory=dict, kw_only=True)_
- `cpu` _Optional\[float\] = field(default=None, kw_only=True)_
- `cpu_max` _Optional\[float\] = field(default=None, kw_only=True)_
- `memory` _Optional\[float\] = field(default=None, kw_only=True)_
- `memory_max` _Optional\[float\] = field(default=None, kw_only=True)_
- `disk` _Optional\[float\] = field(default=None, kw_only=True)_
- `disk_max` _Optional\[float\] = field(default=None, kw_only=True)_
- `sandbox_class` _Optional\[SandboxClass\] = field(default=None, kw_only=True)_
- `persistent` _Optional\[bool\] = field(default=None, kw_only=True)_
- `spot` _Optional\[bool\] = field(default=None, kw_only=True)_
- `spot_evicted_at` _Optional\[str\] = field(default=None, kw_only=True)_
- `lifecycle_policy` _Optional\[SandboxLifecycle\] = field(default=None, kw_only=True)_
- `forked_from` _Optional\[str\] = field(default=None, kw_only=True)_
- `reservation_id` _Optional\[str\] = field(default=None, kw_only=True)_
- `user` _Optional\[str\] = field(default=None, kw_only=True)_
- `error` _Optional\[str\] = field(default=None, kw_only=True)_

#### SandboxInfo.to\_json

```python
def to_json() -> Dict[str, JsonValue]
```

Return a JSON-safe sandbox-info payload.

#### SandboxInfo.from\_json

```python
@classmethod
def from_json(value: Mapping[str, JsonValue]) -> Self
```

Rehydrate sandbox info from `to_json` output.

## SandboxLifecycle

```python
@dataclass(frozen=True)
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
- `timeout_at` _Optional\[str\] = None_
- `idle_expiry_seconds` _Optional\[int\] = None_
- `on_idle_timeout` _Optional\[str\] = None_
- `idle_timeout_at` _Optional\[str\] = None_
- `last_activity_at` _Optional\[str\] = None_
- `last_activity_source` _Optional\[str\] = None_

## PreviewEndpoint

```python
@dataclass(frozen=True)
class PreviewEndpoint()
```

A sandbox HTTP preview endpoint.

**Attributes**:

- `port` _int_
- `public` _bool_
- `url` _str_
- `created_at` _Optional\[str\] = None_

## PreviewLink

```python
@dataclass(frozen=True)
class PreviewLink()
```

Preview URL plus an access token for one sandbox port.

Send `token` in the `X-Daytona-Preview-Token` header to reach a private
endpoint; without a credential it answers 401. Public endpoints set
`token` to `""` and need no credential.
`expires_at` (RFC 3339) is set when the token's expiry is known, else
`None`.

Example — curl a private endpoint::

    link = await sandbox.ports.preview_link(8080)
    # curl -H "X-Daytona-Preview-Token: \<link.token>" \<link.url>

For a shareable URL that works in a browser without extra headers, use
`daytona.v2.ports.AsyncPortsService.signed_preview_link` instead.

**Attributes**:

- `url` _str = field(repr=False)_
- `token` _str = field(repr=False)_
- `expires_at` _Optional\[str\] = None_

## SignedPreviewLink

```python
@dataclass(frozen=True)
class SignedPreviewLink()
```

Self-contained signed URL for one sandbox port.

The token is embedded in the hostname — no extra headers or credentials are
needed. The link expires at `expires_at` (RFC 3339). Revoke it early with
`daytona.v2.ports.AsyncPortsService.expire_signed_preview_link`.

**Attributes**:

- `url` _str = field(repr=False)_
- `token` _str = field(repr=False)_
- `expires_at` _Optional\[str\] = None_

## SandboxAccessToken

```python
@dataclass(frozen=True)
class SandboxAccessToken()
```

A short-lived per-sandbox access token (`POST …/access-token`).

`access_token` is a bearer for sandbox services (toolbox, SSH,
desktop, private previews) and for the self-service sandbox routes named
by `operations` (`sandbox:stop` / `sandbox:pause` /
`sandbox:delete`). It expires at `expires_at` (RFC 3339) and cannot
be refreshed — mint a fresh one with
`daytona.v2.sandbox.AsyncSandbox.create_access_token` instead. `ports`
is the granted private-preview port set; `None` means every port.

**Attributes**:

- `access_token` _str = field(repr=False)_
- `token_type` _str_
- `expires_at` _str_
- `operations` _Sequence\[str\]_
- `ports` _Optional\[Sequence\[int\]\] = None_

## SandboxSearchFilters

```python
@dataclass(frozen=True, kw_only=True)
class SandboxSearchFilters()
```

The `GET /sandboxes/search` filters shared by `Daytona.search()` and `Daytona.list()`.

`status`, `sandbox_class` and `region` take a single value or a list;
lists are joined with commas on the wire. `labels` is sent as a JSON
object string (containment match); timestamp starts are inclusive and ends
are exclusive.

Every filter is keyword-only; `ListSandboxesQuery` accepts its
pagination parameters positionally.

**Attributes**:

- `q` _Optional\[str\] = None_
- `status` _Optional\[Sequence\[str\]\] = None_
- `sandbox_class` _Optional\[Union\[SandboxClass, Sequence\[SandboxClass\]\]\] = None_
- `region` _Optional\[Sequence\[str\]\] = None_
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

## SandboxStateSnapshot

```python
SandboxStateSnapshot = _gen.api.SnapshotListItem
```

## SystemMetrics

```python
SystemMetrics = _gen.toolbox.Metrics
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
