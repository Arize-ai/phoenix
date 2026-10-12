## Contents

- AsyncSandbox
- Resources
- ListSandboxesQuery
- SandboxMetrics


> For the sync version, see [sync/sandbox.md](../sync/sandbox.md)


## AsyncSandbox

```python
@with_events
class AsyncSandbox(SandboxDto)
```

Represents a Daytona Sandbox.

**Attributes**:

- `fs` _AsyncFileSystem_ - File system operations interface.
- `git` _AsyncGit_ - Git operations interface.
- `process` _AsyncProcess_ - Process execution interface.
- `computer_use` _AsyncComputerUse_ - Computer use operations interface for desktop automation.
- `code_interpreter` _AsyncCodeInterpreter_ - Stateful interpreter interface for executing code.
  Currently supports only Python. For other languages, use the `process.code_run` interface.
- `id` _str_ - Unique identifier for the Sandbox.
- `name` _str_ - Name of the Sandbox.
- `organization_id` _str_ - Organization ID of the Sandbox.
- `snapshot` _str | None_ - Daytona snapshot used to create the Sandbox.
- `user` _str_ - OS user running in the Sandbox.
- `env` _dict[str, str] | None_ - Environment variables set in the Sandbox (not returned by list
  results; call `refresh_data()` on each item to populate).
- `labels` _dict[str, str]_ - Custom labels attached to the Sandbox.
- `public` _bool_ - Whether the Sandbox is publicly accessible.
- `target` _str_ - Target location of the runner where the Sandbox runs.
- `cpu` _int_ - Number of CPUs allocated to the Sandbox.
- `gpu` _int_ - Number of GPUs allocated to the Sandbox.
- `spot` _bool_ - Whether this is a spot GPU Sandbox. Spot Sandboxes may be instantly terminated
  to free capacity for on-demand GPU Sandboxes.
- `spot_evicted_at` _str | None_ - When the Sandbox was evicted by spot preemption.
- `gpu_type` _GpuType | None_ - The GPU type assigned to the Sandbox.
- `memory` _int_ - Amount of memory allocated to the Sandbox in GiB.
- `disk` _int_ - Amount of disk space allocated to the Sandbox in GiB.
- `state` _SandboxState | None_ - Current state of the Sandbox (e.g., "started", "stopped").
- `desired_state` _SandboxDesiredState | None_ - The desired state of the Sandbox.
- `error_reason` _str | None_ - Error message if Sandbox is in error state.
- `recoverable` _bool | None_ - Whether the Sandbox error is recoverable.
- `backup_state` _str | None_ - Current state of Sandbox backup.
- `backup_created_at` _str | None_ - When the backup was created (not returned by list results;
  call `refresh_data()` on each item to populate).
- `auto_stop_interval` _int | None_ - Auto-stop interval in minutes.
- `auto_pause_interval` _int | None_ - Auto-pause interval in minutes (0 means disabled).
  Only supported for sandbox classes that support pausing.
  At most one of auto_stop_interval and auto_pause_interval may be non-zero.
- `auto_archive_interval` _int | None_ - Auto-archive interval in minutes.
- `auto_delete_interval` _int | None_ - Auto-delete interval in minutes.
- `volumes` _list[SandboxVolume] | None_ - Volumes attached to the Sandbox (not returned by list
  results; call `refresh_data()` on each item to populate).
- `build_info` _BuildInfo | None_ - Build information for the Sandbox if it was created from
  dynamic build (not returned by list results; call `refresh_data()` on each item to populate).
- `created_at` _str | None_ - When the Sandbox was created.
- `updated_at` _str | None_ - When the Sandbox was last updated.
- `last_activity_at` _str | None_ - When the Sandbox last had activity.
- `auto_destroy_at` _str | None_ - When the Sandbox will be automatically destroyed (only set when a TTL
  is configured).
- `network_block_all` _bool | None_ - Whether to block all network access for the Sandbox
  (not returned by list results; call `refresh_data()` on each item to populate).
- `network_allow_list` _str | None_ - Comma-separated list of allowed CIDR network addresses for
  the Sandbox (not returned by list results; call `refresh_data()` on each item to populate).
- `domain_allow_list` _str | None_ - Comma-separated list of allowed domains for
  the Sandbox (not returned by list results; call `refresh_data()` on each item to populate).
- `outbound_proxy_url` _str | None_ - Outbound proxy URL to route the Sandbox HTTP(S) traffic through.
  Applied via the HTTP(S)_PROXY environment variables (convenience routing, not a security boundary on
  its own); combine with domain_allow_list for unbypassable network-layer enforcement. (not returned by
  list results; call `refresh_data()` on each item to populate).
- `sandbox_class` _str | None_ - The class of the Sandbox.
- `warm_pool_id` _str | None_ - ID of the warm pool this Sandbox waits in; set only while it is
  an unclaimed member.
- `daemon_version` _str | None_ - The version of the daemon running in the Sandbox.
- `otel_endpoint_override` _str | None_ - OTel collector endpoint override for this Sandbox.
  When set, Sandbox OTel data is sent to this endpoint instead of the default collector
  and is not available in the Daytona analytics API or dashboard (not returned by list
  results; call `refresh_data()` on each item to populate).
- `toolbox_proxy_url` _str_ - The toolbox proxy URL for the Sandbox.

##### env: `dict[str, str] | None`

```python
env = None
```

pyright: ignore[reportRedeclaration]

##### network\_block\_all: `bool | None`

```python
network_block_all = None
```

pyright: ignore[reportRedeclaration]

#### AsyncSandbox.\_\_init\_\_

```python
def __init__(sandbox_dto: SandboxDto | SandboxListItem,
             toolbox_api: ApiClient,
             sandbox_api: SandboxApi,
             language: str,
             subscription_manager: AsyncEventSubscriptionManager,
             pool_tracker: AsyncPoolSaturationTracker | None = None,
             analytics_api_url_provider: Callable[[], Awaitable[str | None]]
             | None = None)
```

Initialize a new Sandbox instance.

**Arguments**:

- `sandbox_dto` _SandboxDto | SandboxListItem_ - The sandbox data from the API.
- `toolbox_api` _ApiClient_ - API client for toolbox operations.
- `sandbox_api` _SandboxApi_ - API client for Sandbox operations.
- `language` _str_ - Language code for the Sandbox code_run.
- `subscription_manager` - AsyncEventSubscriptionManager for real-time updates.
- `pool_tracker` _AsyncPoolSaturationTracker | None_ - Tracker for connection pool saturation.

#### AsyncSandbox.refresh\_data

```python
@intercept_errors(message_prefix="Failed to refresh sandbox data: ")
@with_instrumentation()
async def refresh_data(request_timeout: float | None = None) -> None
```

Refreshes the Sandbox data from the API.

**Arguments**:

- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Example**:

```python
await sandbox.refresh_data()
print(f"Sandbox {sandbox.id}:")
print(f"State: {sandbox.state}")
print(f"Resources: {sandbox.cpu} CPU, {sandbox.memory} GiB RAM")
```

#### AsyncSandbox.get\_user\_home\_dir

```python
@intercept_errors(message_prefix="Failed to get user home directory: ")
@with_instrumentation()
async def get_user_home_dir() -> str
```

Gets the user's home directory path inside the Sandbox.

**Returns**:

- `str` - The absolute path to the user's home directory inside the Sandbox.


**Example**:

```python
user_home_dir = await sandbox.get_user_home_dir()
print(f"Sandbox user home: {user_home_dir}")
```

#### AsyncSandbox.get\_work\_dir

```python
@intercept_errors(message_prefix="Failed to get working directory path: ")
@with_instrumentation()
async def get_work_dir() -> str
```

Gets the working directory path inside the Sandbox.

**Returns**:

- `str` - The absolute path to the Sandbox working directory. Uses the WORKDIR specified in
  the Dockerfile if present, or falling back to the user's home directory if not.


**Example**:

```python
work_dir = await sandbox.get_work_dir()
print(f"Sandbox working directory: {work_dir}")
```

#### AsyncSandbox.get\_metrics\_latest

```python
@intercept_errors(message_prefix="Failed to get sandbox metrics: ")
@with_instrumentation()
async def get_metrics_latest() -> SandboxMetrics
```

Gets the most recent resource usage sample directly from the Sandbox daemon.

Unlike :meth:`get_metrics`, which returns aggregated historical samples, this returns
the single current reading without going through the telemetry backend.

**Returns**:

- `SandboxMetrics` - The current CPU, memory, and disk usage sample for the Sandbox.

#### AsyncSandbox.get\_metrics

```python
@intercept_errors(message_prefix="Failed to get sandbox metrics: ")
@with_instrumentation()
async def get_metrics(start: datetime | None = None,
                      end: datetime | None = None) -> list[SandboxMetrics]
```

Gets historical time-series resource usage metrics for the Sandbox.

When the deployment runs a dedicated Analytics API, metrics are fetched from it
directly; otherwise they are fetched through the control-plane telemetry proxy.

**Arguments**:

- `start` _datetime | None_ - Start of the time range. Defaults to the Sandbox
  creation time.
- `end` _datetime | None_ - End of the time range. Defaults to the current time.


**Returns**:

- `list[SandboxMetrics]` - Time-ordered usage samples over the requested range.

#### AsyncSandbox.create\_lsp\_server

```python
@with_instrumentation()
def create_lsp_server(language_id: LspLanguageId | LspLanguageIdLiteral,
                      path_to_project: str) -> AsyncLspServer
```

Creates a new Language Server Protocol (LSP) server instance.

The LSP server provides language-specific features like code completion,
diagnostics, and more.

**Arguments**:

- `language_id` _LspLanguageId | LspLanguageIdLiteral_ - The language server type (e.g., LspLanguageId.PYTHON).
- `path_to_project` _str_ - Path to the project root directory. Relative paths are resolved
  based on the sandbox working directory.


**Returns**:

- `LspServer` - A new LSP server instance configured for the specified language.


**Example**:

```python
lsp = sandbox.create_lsp_server("python", "workspace/project")
```

#### AsyncSandbox.set\_labels

```python
@intercept_errors(message_prefix="Failed to set labels: ")
@with_instrumentation()
async def set_labels(labels: dict[str, str],
                     request_timeout: float | None = None) -> dict[str, str]
```

Sets labels for the Sandbox.

Labels are key-value pairs that can be used to organize and identify Sandboxes.

**Arguments**:

- `labels` _dict[str, str]_ - Dictionary of key-value pairs representing Sandbox labels.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

  dict[str, str]: Dictionary containing the updated Sandbox labels.


**Example**:

```python
new_labels = sandbox.set_labels({
    "project": "my-project",
    "environment": "development",
    "team": "backend"
})
print(f"Updated labels: {new_labels}")
```

#### AsyncSandbox.download\_url

```python
@intercept_errors(message_prefix="Failed to create download URL: ")
@with_instrumentation()
async def download_url(path: str, ttl_seconds: int | None = None) -> str
```

Creates a pre-signed URL for downloading a file from the Sandbox.

The URL works with any HTTP client without auth headers and stays valid across
sandbox restarts (downloads succeed only while the sandbox is running). The signing
key is cached locally for up to 15 seconds; if the key was rotated from another
client, URLs may be rejected until the cache refreshes.

**Arguments**:

- `path` _str_ - Path to the file in the Sandbox.
- `ttl_seconds` _int | None_ - How long the URL stays valid, in seconds.
  Defaults to 3600. Zero or negative means the URL never expires.


**Returns**:

- `str` - Pre-signed download URL.


**Example**:

```python
url = await sandbox.download_url("/home/user/report.pdf")
```
```bash
curl "$url" -o report.pdf
```

#### AsyncSandbox.upload\_url

```python
@intercept_errors(message_prefix="Failed to create upload URL: ")
@with_instrumentation()
async def upload_url(path: str, ttl_seconds: int | None = None) -> str
```

Creates a pre-signed URL for uploading a file to the Sandbox.

Send a POST request with the file as multipart/form-data. The URL works with any
HTTP client without auth headers. The signing key is cached locally for up to
15 seconds; if the key was rotated from another client, URLs may be rejected
until the cache refreshes.

**Arguments**:

- `path` _str_ - Destination path for the uploaded file in the Sandbox.
- `ttl_seconds` _int | None_ - How long the URL stays valid, in seconds.
  Defaults to 3600. Zero or negative means the URL never expires.


**Returns**:

- `str` - Pre-signed upload URL.


**Example**:

```python
url = await sandbox.upload_url("/home/user/data.bin")
```
```bash
curl -X POST -F "file=@local.bin" "$url"
```

#### AsyncSandbox.rotate\_signing\_key

```python
@intercept_errors(message_prefix="Failed to rotate signing key: ")
@with_instrumentation()
async def rotate_signing_key() -> None
```

Rotates the sandbox signing key, invalidating all previously signed URLs.

**Example**:

```python
await sandbox.rotate_signing_key()
# all URLs created before this call now return 401
```

#### AsyncSandbox.start

```python
@intercept_errors(message_prefix="Failed to start sandbox: ")
@with_timeout()
@with_instrumentation()
async def start(timeout: float | None = 60)
```

Starts the Sandbox and waits for it to be ready.

**Arguments**:

- `timeout` _float | None_ - Maximum time to wait in seconds. 0 means no timeout. Default is 60 seconds.


**Raises**:

- `DaytonaError` - If timeout is negative. If sandbox fails to start or times out.


**Example**:

```python
sandbox = daytona.get("my-sandbox-id")
sandbox.start(timeout=40)  # Wait up to 40 seconds
print("Sandbox started successfully")
```

#### AsyncSandbox.recover

```python
@intercept_errors(message_prefix="Failed to recover sandbox: ")
@with_timeout()
async def recover(timeout: float | None = 60)
```

Recovers the Sandbox from a recoverable error and waits for it to be ready.

**Arguments**:

- `timeout` _float | None_ - Maximum time to wait in seconds. 0 means no timeout. Default is 60 seconds.


**Raises**:

- `DaytonaError` - If timeout is negative. If sandbox fails to recover or times out.


**Example**:

```python
sandbox = daytona.get("my-sandbox-id")
await sandbox.recover(timeout=40)  # Wait up to 40 seconds
print("Sandbox recovered successfully")
```

#### AsyncSandbox.stop

```python
@intercept_errors(message_prefix="Failed to stop sandbox: ")
@with_timeout()
@with_instrumentation()
async def stop(timeout: float | None = 60, force: bool = False)
```

Stops the Sandbox and waits for it to be fully stopped.

**Arguments**:

- `timeout` _float | None_ - Maximum time to wait in seconds. 0 means no timeout. Default is 60 seconds.
- `force` _bool_ - If True, uses SIGKILL instead of SIGTERM to stop the sandbox. Default is False.


**Raises**:

- `DaytonaError` - If timeout is negative; If sandbox fails to stop or times out


**Example**:

```python
sandbox = daytona.get("my-sandbox-id")
await sandbox.stop()
print("Sandbox stopped successfully")
```

#### AsyncSandbox.delete

```python
@intercept_errors(message_prefix="Failed to remove sandbox: ")
@with_timeout()
@with_instrumentation()
async def delete(timeout: float | None = 60, wait: bool = False) -> None
```

Deletes the Sandbox.

By default returns as soon as the deletion request is accepted (fire-and-forget).
Pass ``wait=True`` to block until the Sandbox reaches the 'destroyed' state.

**Arguments**:

- `timeout` _float | None_ - Timeout (in seconds) for the request and, when ``wait``
  is True, for reaching 'destroyed'. 0 means no timeout. Default is 60 seconds.
- `wait` _bool_ - If True, wait until the Sandbox is destroyed. Defaults to False.

#### AsyncSandbox.wait\_for\_sandbox\_start

```python
@intercept_errors(
    message_prefix="Failure during waiting for sandbox to start: ")
@with_timeout()
@with_instrumentation()
async def wait_for_sandbox_start(timeout: float | None = 60) -> None
```

Waits for the Sandbox to reach the 'started' state.

**Arguments**:

- `timeout` _float | None_ - Maximum time to wait in seconds. 0 means no timeout. Default is 60 seconds.


**Raises**:

- `DaytonaError` - If timeout is negative; If Sandbox fails to start or times out;

#### AsyncSandbox.wait\_for\_sandbox\_stop

```python
@intercept_errors(
    message_prefix="Failure during waiting for sandbox to stop: ")
@with_timeout()
@with_instrumentation()
async def wait_for_sandbox_stop(timeout: float | None = 60) -> None
```

Waits for the Sandbox to reach the 'stopped' state.
Treats destroyed as stopped to cover ephemeral sandboxes that are automatically deleted after stopping.

**Arguments**:

- `timeout` _float | None_ - Maximum time to wait in seconds. 0 means no timeout. Default is 60 seconds.


**Raises**:

- `DaytonaError` - If timeout is negative. If Sandbox fails to stop or times out.

#### AsyncSandbox.set\_autostop\_interval

```python
@intercept_errors(message_prefix="Failed to set auto-stop interval: ")
@with_instrumentation()
async def set_autostop_interval(interval: int,
                                request_timeout: float | None = None) -> None
```

Sets the auto-stop interval for the Sandbox.

The Sandbox will automatically stop after being idle (no new events) for the specified interval.
Events include any state changes or interactions with the Sandbox through the SDK.
Interactions using Sandbox Previews are not included.

**Arguments**:

- `interval` _int_ - Number of minutes of inactivity before auto-stopping.
  Set to 0 to disable auto-stop. Defaults to 15.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Raises**:

- `DaytonaValidationError` - If interval is negative


**Example**:

```python
# Auto-stop after 1 hour
sandbox.set_autostop_interval(60)
# Or disable auto-stop
sandbox.set_autostop_interval(0)
```

#### AsyncSandbox.set\_auto\_pause\_interval

```python
@intercept_errors(message_prefix="Failed to set auto-pause interval: ")
@with_instrumentation()
async def set_auto_pause_interval(interval: int) -> None
```

Sets the auto-pause interval for the Sandbox.

The Sandbox will automatically pause after being idle (no new events) for the specified interval.
Only supported for sandbox classes that support pausing.

**Arguments**:

- `interval` _int_ - Number of minutes of inactivity before auto-pausing.
  Set to 0 to disable auto-pause.


**Raises**:

- `DaytonaValidationError` - If interval is negative


**Example**:

```python
# Auto-pause after 1 hour
await sandbox.set_auto_pause_interval(60)
# Or disable auto-pause
await sandbox.set_auto_pause_interval(0)
```

#### AsyncSandbox.set\_ttl

```python
@intercept_errors(message_prefix="Failed to set TTL: ")
@with_instrumentation()
async def set_ttl(ttl_minutes: int,
                  request_timeout: float | None = None) -> None
```

Sets the TTL (time to live) for the Sandbox.

The Sandbox will be destroyed after the specified number of minutes, counted as
wall-clock time from the current moment, regardless of its state (started, stopped,
paused, or archived). Setting to 0 disables the TTL.

**Arguments**:

- `ttl_minutes` _int_ - Number of minutes until the Sandbox is destroyed.
  Set to 0 to disable the TTL.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Raises**:

- `DaytonaValidationError` - If ttl_minutes is negative


**Example**:

```python
# Set TTL to 1 hour
await sandbox.set_ttl(60)
# Or disable TTL
await sandbox.set_ttl(0)
```

#### AsyncSandbox.set\_auto\_archive\_interval

```python
@intercept_errors(message_prefix="Failed to set auto-archive interval: ")
@with_instrumentation()
async def set_auto_archive_interval(interval: int,
                                    request_timeout: float | None = None
                                    ) -> None
```

Sets the auto-archive interval for the Sandbox.

The Sandbox will automatically archive after being continuously stopped for the specified interval.

**Arguments**:

- `interval` _int_ - Number of minutes after which a continuously stopped Sandbox will be auto-archived.
  Set to 0 for the maximum interval. Default is 7 days.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Raises**:

- `DaytonaValidationError` - If interval is negative


**Example**:

```python
# Auto-archive after 1 hour
sandbox.set_auto_archive_interval(60)
# Or use the maximum interval
sandbox.set_auto_archive_interval(0)
```

#### AsyncSandbox.set\_auto\_delete\_interval

```python
@intercept_errors(message_prefix="Failed to set auto-delete interval: ")
@with_instrumentation()
async def set_auto_delete_interval(interval: int,
                                   request_timeout: float | None = None
                                   ) -> None
```

Sets the auto-delete interval for the Sandbox.

The Sandbox will automatically delete after being continuously stopped for the specified interval.

**Arguments**:

- `interval` _int_ - Number of minutes after which a continuously stopped Sandbox will be auto-deleted.
  Set to negative value to disable auto-delete. Set to 0 to delete immediately upon stopping.
  By default, auto-delete is disabled.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Example**:

```python
# Auto-delete after 1 hour
sandbox.set_auto_delete_interval(60)
# Or delete immediately upon stopping
sandbox.set_auto_delete_interval(0)
# Or disable auto-delete
sandbox.set_auto_delete_interval(-1)
```

#### AsyncSandbox.update\_network\_settings

```python
@intercept_errors(message_prefix="Failed to update network settings: ")
@with_instrumentation()
async def update_network_settings(
        *,
        network_block_all: bool | None = None,
        network_allow_list: str | None = None,
        domain_allow_list: str | None = None,
        request_timeout: float | None = None) -> None
```

Updates outbound network policy on the runner (block all, restore access, or CIDR allow list).

**Arguments**:

- `network_block_all` - When ``True``, blocks all outbound traffic. When ``False``, restores general
  outbound access (and clears a stored allow list).
- `network_allow_list` - Comma-separated IPv4 CIDRs to allow; implies not blocking all.
- `domain_allow_list` - Comma-separated domains to allow; implies not blocking all.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Raises**:

- `DaytonaValidationError` - If neither argument is set.


**Example**:

```python
await sandbox.update_network_settings(network_block_all=True)
await sandbox.update_network_settings(network_block_all=False)
```

#### AsyncSandbox.update\_secrets

```python
@intercept_errors(message_prefix="Failed to update secrets: ")
@with_instrumentation()
async def update_secrets(secrets: dict[str, str]) -> None
```

Updates the set of vault secrets mounted in the Sandbox, replacing the previously mounted set.

Attached, detached and rotated secrets take effect for outbound requests within seconds.
New environment variables only become visible to processes spawned after the update, and a
Sandbox created without any secrets must be restarted for newly attached secrets to work.

**Arguments**:

- `secrets` _dict[str, str]_ - Map of environment variable name to the name of an existing
  organization Secret. Pass an empty dict to detach all secrets.


**Example**:

```python
await sandbox.update_secrets({"ANTHROPIC_API_KEY": "anthropic-prod"})
await sandbox.update_secrets({})  # detach all
```

#### AsyncSandbox.update\_env

```python
@intercept_errors(message_prefix="Failed to update environment: ")
@with_instrumentation()
async def update_env(env: dict[str, str],
                     *,
                     unset: list[str] | None = None) -> None
```

Updates the Sandbox daemon's process environment.

Newly spawned processes, sessions and PTYs inherit the change; already-running processes
keep their environment.

**Arguments**:

- `env` _dict[str, str]_ - Environment variables to set.
- `unset` _list[str] | None_ - Environment variable names to remove before `env` is applied.


**Example**:

```python
await sandbox.update_env({"MY_VAR": "value"}, unset=["OLD_VAR"])
```

#### AsyncSandbox.get\_preview\_link

```python
@intercept_errors(message_prefix="Failed to get preview link: ")
@with_instrumentation()
async def get_preview_link(port: int,
                           request_timeout: float | None = None
                           ) -> PortPreviewUrl
```

Retrieves the preview link for the sandbox at the specified port. If the port is closed,
it will be opened automatically. For private sandboxes, a token is included to grant access
to the URL.

**Arguments**:

- `port` _int_ - The port to open the preview link on.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `PortPreviewUrl` - The response object for the preview link, which includes the `url`
  and the `token` (to access private sandboxes).


**Example**:

```python
preview_link = sandbox.get_preview_link(3000)
print(f"Preview URL: {preview_link.url}")
print(f"Token: {preview_link.token}")
```

#### AsyncSandbox.create\_signed\_preview\_url

```python
@intercept_errors(message_prefix="Failed to create signed preview url: ")
async def create_signed_preview_url(
        port: int,
        expires_in_seconds: int | None = None,
        request_timeout: float | None = None) -> SignedPortPreviewUrl
```

Creates a signed preview URL for the sandbox at the specified port.

**Arguments**:

- `port` _int_ - The port to open the preview link on.
- `expires_in_seconds` _int | None_ - The number of seconds the signed preview
  url will be valid for. Defaults to 60 seconds.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `SignedPortPreviewUrl` - The response object for the signed preview url.

#### AsyncSandbox.expire\_signed\_preview\_url

```python
@intercept_errors(message_prefix="Failed to expire signed preview url: ")
async def expire_signed_preview_url(port: int,
                                    token: str,
                                    request_timeout: float | None = None
                                    ) -> None
```

Expires a signed preview URL for the sandbox at the specified port.

**Arguments**:

- `port` _int_ - The port to expire the signed preview url on.
- `token` _str_ - The token to expire the signed preview url on.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.

#### AsyncSandbox.archive

```python
@intercept_errors(message_prefix="Failed to archive sandbox: ")
@with_instrumentation()
async def archive(request_timeout: float | None = None) -> None
```

Archives the sandbox, making it inactive and preserving its state. When sandboxes are
archived, the entire filesystem state is moved to cost-effective object storage, making it
possible to keep sandboxes available for an extended period. The tradeoff between archived
and stopped states is that starting an archived sandbox takes more time, depending on its size.
Sandbox must be stopped before archiving.

**Arguments**:

- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.

#### AsyncSandbox.resize

```python
@intercept_errors(message_prefix="Failed to resize sandbox: ")
@with_timeout()
@with_instrumentation()
async def resize(resources: Resources, timeout: float | None = 60) -> None
```

Resizes the Sandbox resources.

Changes the CPU, memory, or disk allocation. Hot resize (on a running Sandbox) accepts
only CPU and memory increases. Disk resize requires a stopped Sandbox; disk can only
grow. GPU is not resizable — to change GPU, create a new Sandbox.

**Arguments**:

- `resources` _Resources_ - New resource configuration. Only cpu, memory, and disk are
  applied; setting gpu or gpu_type raises an error.
- `timeout` _Optional[float]_ - Timeout in seconds for the resize operation. 0 means no
  timeout. Default is 60 seconds.


**Raises**:

- `DaytonaError` - If hot-resize constraints are violated, disk resize is attempted on
  a running Sandbox, disk decrease is attempted, no fields are provided, gpu or
  gpu_type is set, or the operation times out.


**Example**:

```python
await sandbox.resize(Resources(cpu=4, memory=8))

await sandbox.stop()
await sandbox.resize(Resources(cpu=2, memory=4, disk=30))
```

#### AsyncSandbox.wait\_for\_resize\_complete

```python
@intercept_errors(
    message_prefix="Failure during waiting for resize to complete: ")
@with_timeout()
@with_instrumentation()
async def wait_for_resize_complete(timeout: float | None = 60) -> None
```

Waits for the Sandbox resize operation to complete.

**Arguments**:

- `timeout` _Optional[float]_ - Maximum time to wait in seconds. 0 means no timeout. Default is 60 seconds.


**Raises**:

- `DaytonaError` - If timeout is negative. If resize operation times out.

#### AsyncSandbox.create\_ssh\_access

```python
@intercept_errors(message_prefix="Failed to create SSH access: ")
@with_instrumentation()
async def create_ssh_access(
        expires_in_minutes: int | None = None,
        request_timeout: float | None = None) -> SshAccessDto
```

Creates an SSH access token for the sandbox.

**Arguments**:

- `expires_in_minutes` _int | None_ - The number of minutes the SSH access token will be valid for.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.

#### AsyncSandbox.revoke\_ssh\_access

```python
@intercept_errors(message_prefix="Failed to revoke SSH access: ")
@with_instrumentation()
async def revoke_ssh_access(token: str,
                            request_timeout: float | None = None) -> None
```

Revokes an SSH access token for the sandbox.

**Arguments**:

- `token` _str_ - The token to revoke.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.

#### AsyncSandbox.validate\_ssh\_access

```python
@intercept_errors(message_prefix="Failed to validate SSH access: ")
@with_instrumentation()
async def validate_ssh_access(
        token: str,
        request_timeout: float | None = None) -> SshAccessValidationDto
```

Validates an SSH access token for the sandbox.

**Arguments**:

- `token` _str_ - The token to validate.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.

#### AsyncSandbox.refresh\_activity

```python
@intercept_errors(message_prefix="Failed to refresh sandbox activity: ")
async def refresh_activity(request_timeout: float | None = None) -> None
```

Refreshes the sandbox activity to reset the timer for automated lifecycle management actions.

This method updates the sandbox's last activity timestamp without changing its state.
It is useful for keeping long-running sessions alive while there is still user activity.

**Arguments**:

- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Example**:

```python
await sandbox.refresh_activity()
```

#### AsyncSandbox.fork

```python
@intercept_errors(message_prefix="Failed to fork sandbox: ")
@with_timeout()
@with_instrumentation()
async def fork(name: str | None = None,
               timeout: float | None = 60) -> "AsyncSandbox"
```

Forks the Sandbox, creating a new Sandbox with an identical filesystem.

The forked Sandbox is a copy-on-write clone of the original. It starts
with the same disk contents but operates independently from that point on.

**Arguments**:

- `name` _str | None_ - Optional name for the forked Sandbox. If not provided, a unique name will be generated.
- `timeout` _float | None_ - Maximum time to wait in seconds. 0 means no timeout. Default is 60 seconds.


**Returns**:

- `AsyncSandbox` - The forked Sandbox.


**Raises**:

- `DaytonaError` - If the fork operation fails or times out.


**Example**:

```python
sandbox = await daytona.get("my-sandbox")
forked = await sandbox.fork(name="my-fork")
print(f"Forked sandbox: {forked.id}")
```

#### AsyncSandbox.create\_snapshot

```python
@intercept_errors(message_prefix="Failed to create snapshot: ")
@with_timeout()
@with_instrumentation()
async def create_snapshot(name: str, timeout: float | None = 60) -> None
```

Creates a snapshot from the current state of the Sandbox.

This captures the Sandbox's filesystem into a reusable snapshot that can be
used to create new Sandboxes. The Sandbox will temporarily enter a
'snapshotting' state and return to its previous state when complete.

**Arguments**:

- `name` _str_ - Name for the new snapshot.
- `timeout` _float | None_ - Maximum time to wait in seconds. 0 means no timeout. Default is 60 seconds.


**Raises**:

- `DaytonaError` - If the snapshot operation fails or times out.


**Example**:

```python
sandbox = await daytona.get("my-sandbox")
await sandbox.create_snapshot("my-snapshot")
print("Snapshot created successfully")
```

#### AsyncSandbox.pause

```python
@intercept_errors(message_prefix="Failed to pause sandbox")
@with_timeout()
@with_instrumentation()
async def pause(timeout: float = 60) -> None
```

Pauses the Sandbox, freezing all running processes.

The Sandbox will enter a 'pausing' state and transition to 'paused' when
complete. While paused, the Sandbox retains its state in memory but does
not consume CPU cycles.

**Arguments**:

- `timeout` - Maximum time to wait in seconds. 0 means no timeout.
  Defaults to 60-second timeout.


**Raises**:

- `DaytonaError` - If timeout is negative or the operation fails/times out.

## Resources

```python
@dataclass
class Resources()
```

Resources configuration for Sandbox.

**Attributes**:

- `cpu` _int | None_ - Number of CPU cores to allocate.
- `memory` _int | None_ - Amount of memory in GiB to allocate.
- `disk` _int | None_ - Amount of disk space in GiB to allocate.
- `gpu` _int | None_ - Number of GPUs to allocate.
- `gpu_type` _GpuType | list[GpuType] | None_ - Preferred GPU type for the Sandbox.


**Example**:

```python
resources = Resources(
    cpu=2,
    memory=4,  # 4GiB RAM
    disk=20,   # 20GiB disk
    gpu=1,
    gpu_type=GpuType.H100,
)
params = CreateSandboxFromImageParams(
    image=Image.debian_slim("3.12"),
    language="python",
    resources=resources
)
```

## ListSandboxesQuery

```python
@dataclass
class ListSandboxesQuery()
```

Query parameters for filtering and sorting when listing Sandboxes.

**Attributes**:

- `limit` - Per-page fetch size. Does NOT limit the total number of
  Sandboxes returned.
- `id` - Filter by ID prefix (case-insensitive).
- `name` - Filter by name prefix (case-insensitive).
- `labels` - Filter by labels.
- `states` - Filter by states.
- `snapshots` - Filter by snapshot names.
- `targets` - Filter by targets.
- `min_cpu` - Filter by minimum CPU.
- `max_cpu` - Filter by maximum CPU.
- `min_memory_gib` - Filter by minimum memory in GiB.
- `max_memory_gib` - Filter by maximum memory in GiB.
- `min_disk_gib` - Filter by minimum disk space in GiB.
- `max_disk_gib` - Filter by maximum disk space in GiB.
- `is_public` - Filter by public status.
- `is_recoverable` - Filter by recoverable status.
- `created_at_after` _datetime_ - Include sandboxes created after this timestamp.
- `created_at_before` _datetime_ - Include sandboxes created before this timestamp.
- `last_activity_after` _datetime_ - Include sandboxes with last activity after this timestamp.
- `last_activity_before` _datetime_ - Include sandboxes with last activity before this timestamp.
- `auto_destroy_at_after` _datetime_ - Include sandboxes scheduled for auto destroy after this timestamp.
- `auto_destroy_at_before` _datetime_ - Include sandboxes scheduled for auto destroy before this timestamp.
- `sort` - Field to sort by.
- `order` - Sort direction.

## SandboxMetrics

```python
@dataclass
class SandboxMetrics()
```

A single point-in-time sample of historical Sandbox resource usage.

Each instance corresponds to one aggregation bucket returned by the telemetry
backend. Use :meth:`Sandbox.get_metrics` to fetch a time-ordered list of these,
or :meth:`Sandbox.get_metrics_latest` for the current sample.

**Attributes**:

- `cpu_count` _int_ - Number of CPU cores allocated to the Sandbox.
- `cpu_used_pct` _float_ - CPU utilization as a percentage of the allocated limit.
- `disk_total` _int_ - Total disk space in bytes.
- `disk_used` _int_ - Used disk space in bytes.
- `mem_total` _int_ - Total memory in bytes.
- `mem_used` _int_ - Used memory in bytes.
- `mem_cache` _int_ - Memory used by the page cache in bytes.
- `timestamp` _datetime_ - Timestamp of this sample.

#### sandbox\_metrics\_from\_system\_metrics

```python
def sandbox_metrics_from_system_metrics(
        system_metrics: _SystemMetrics) -> SandboxMetrics
```

Converts a live daemon ``SystemMetrics`` snapshot into a ``SandboxMetrics`` sample.

#### pivot\_sandbox\_metrics

```python
def pivot_sandbox_metrics(
    points: Iterable[tuple[str | None, str | None, float | None]]
) -> list[SandboxMetrics]
```

Buckets ``(metric_name, timestamp, value)`` triples by timestamp into ``SandboxMetrics`` samples.
