
## Sandbox

Represents a Daytona Sandbox instance.

Exposes lifecycle controls and operation facades for process execution, file-system access,
and Git. State changes are streamed over WebSocket by default with polling as a safety net,
or observed by polling only when the deprecated polling mode is enabled.

**Properties**:

- `process` _Process_ - Process execution interface for this Sandbox.
- `fs` _FileSystem_ - File-system operations interface for this Sandbox.
- `git` _Git_ - Git operations interface for this Sandbox.
- `computerUse` _ComputerUse_ - Computer use (desktop automation) interface for this Sandbox.
- `codeInterpreter` _CodeInterpreter_ - Stateful code interpreter for this Sandbox (Python).

### Methods

#### createLspServer()
```java
public LspServer createLspServer(String languageId, String pathToProject)
```

Creates an LSP server instance for the specified language and project.

**Parameters**:

- `languageId` _String_ - language server to start (e.g. "typescript", "python", "go")
- `pathToProject` _String_ - absolute path to the project root inside the sandbox

**Returns**:

- `LspServer` - a new `LspServer` configured for the given language

#### start()
```java
public void start()
```

Starts this Sandbox with default timeout.

**Throws**:

- `DaytonaException` - if the Sandbox fails to start

#### start()
```java
public void start(long timeoutSeconds)
```

Starts this Sandbox and waits for readiness.

**Parameters**:

- `timeoutSeconds` _long_ - maximum seconds to wait; `0` disables timeout

**Throws**:

- `DaytonaException` - if start fails or times out

#### stop()
```java
public void stop()
```

Stops this Sandbox with default timeout.

**Throws**:

- `DaytonaException` - if the Sandbox fails to stop

#### stop()
```java
public void stop(long timeoutSeconds)
```

Stops this Sandbox and waits until fully stopped.

**Parameters**:

- `timeoutSeconds` _long_ - maximum seconds to wait; `0` disables timeout

**Throws**:

- `DaytonaException` - if stop fails or times out

#### waitUntilStopped()
```java
public void waitUntilStopped(long timeoutSeconds)
```

Waits until Sandbox reaches `stopped` (or `destroyed`) state.

**Parameters**:

- `timeoutSeconds` _long_ - maximum seconds to wait; `0` disables timeout

**Throws**:

- `DaytonaException` - if timeout is invalid, state becomes error, or timeout expires

#### delete()
```java
public void delete()
```

Deletes this Sandbox.

Fires the delete API call and returns immediately without waiting for the
Sandbox to reach the `destroyed` state. Use `#delete(long, boolean)`
with `wait=true` to block until destruction completes.

**Throws**:

- `DaytonaException` - if the delete API call fails

#### delete()
```java
public void delete(long timeoutSeconds)
```

Deletes this Sandbox.

Fires the delete API call and returns immediately. Use
`#delete(long, boolean)` with `wait=true` to block until destroyed.

**Parameters**:

- `timeoutSeconds` _long_ - timeout for the HTTP request (and for waiting when `wait` is true in `#delete(long, boolean)`)

**Throws**:

- `DaytonaException` - if the delete API call fails

#### delete()
```java
public void delete(long timeoutSeconds, boolean wait)
```

Deletes this Sandbox, optionally waiting for it to reach the `destroyed` state.

**Parameters**:

- `timeoutSeconds` _long_ - maximum seconds to wait when `wait` is true; `0` disables timeout. Ignored when `wait` is false.
- `wait` _boolean_ - if `true`, block until the Sandbox is destroyed

**Throws**:

- `DaytonaException` - if deletion fails or times out

#### setLabels()
```java
public Map<String, String> setLabels(Map<String, String> labels)
```

Replaces Sandbox labels.

**Parameters**:

- `labels` _Map\<String, String\>_ - label map to apply

**Returns**:

- `Map\<String, String\>` - updated labels

**Throws**:

- `DaytonaException` - if label update fails

#### setAutostopInterval()
```java
public void setAutostopInterval(int minutes)
```

Sets Sandbox auto-stop interval.

**Parameters**:

- `minutes` _int_ - idle minutes before automatic stop

**Throws**:

- `DaytonaException` - if the update fails

#### setAutoPauseInterval()
```java
public void setAutoPauseInterval(int minutes)
```

Sets Sandbox auto-pause interval.

**Parameters**:

- `minutes` _int_ - idle minutes before automatic pause (0 means disabled)

**Throws**:

- `DaytonaException` - if the update fails

#### setAutoArchiveInterval()
```java
public void setAutoArchiveInterval(int minutes)
```

Sets Sandbox auto-archive interval.

**Parameters**:

- `minutes` _int_ - minutes in stopped state before automatic archive

**Throws**:

- `DaytonaException` - if the update fails

#### setAutoDeleteInterval()
```java
public void setAutoDeleteInterval(int minutes)
```

Sets Sandbox auto-delete interval.

**Parameters**:

- `minutes` _int_ - minutes before automatic deletion after stop

**Throws**:

- `DaytonaException` - if the update fails

#### setTtl()
```java
public void setTtl(int ttlMinutes)
```

Sets Sandbox TTL (time to live) in minutes. Set to 0 to disable the TTL.
The deadline is computed server-side; call `#refreshData()` and read the updated
value via `#getAutoDestroyAt()`.

**Parameters**:

- `ttlMinutes` _int_ - minutes until the Sandbox is destroyed, or 0 to disable

**Throws**:

- `IllegalArgumentException` - if ttlMinutes is negative
- `DaytonaException` - if the update fails

#### updateNetworkSettings()
```java
public void updateNetworkSettings(UpdateSandboxNetworkSettings settings)
```

Updates outbound network policy on the runner (block all, restore access, or CIDR allow list).

**Parameters**:

- `settings` _UpdateSandboxNetworkSettings_ - request body; at least one of networkBlockAll or networkAllowList must be set

**Throws**:

- `DaytonaException` - if the update fails

#### updateSecrets()
```java
public void updateSecrets(Map<String, String> secrets)
```

Replaces the set of vault secrets mounted in this Sandbox.

Each key is an environment variable name and each value is the name of an existing
organization Secret. Pass an empty map to detach all secrets. Attached, detached, and
rotated secrets take effect for outbound requests within seconds. New environment
variables are only visible to processes spawned after the update; a Sandbox created
without secrets must be restarted for newly attached secrets to work.

**Parameters**:

- `secrets` _Map\<String, String\>_ - map of environment variable name to organization Secret name

**Throws**:

- `DaytonaException` - if the update fails

#### getUserHomeDir()
```java
public String getUserHomeDir()
```

Returns home directory path for Sandbox user.

**Returns**:

- `String` - absolute home directory path

**Throws**:

- `DaytonaException` - if the request fails

#### getMetricsLatest()
```java
public SandboxMetrics getMetricsLatest()
```

Gets the most recent resource usage sample directly from the sandbox daemon.

Unlike `#getMetrics`, which returns aggregated historical samples, this returns
the single current reading without going through the telemetry backend.

**Returns**:

- `SandboxMetrics` - the current resource usage sample for the sandbox

**Throws**:

- `DaytonaException` - if the request fails

#### getMetrics()
```java
public List<SandboxMetrics> getMetrics(OffsetDateTime start, OffsetDateTime end)
```

Gets historical time-series resource usage metrics for the sandbox.

When the deployment runs a dedicated Analytics API, metrics are fetched from it directly;
otherwise they are fetched through the control-plane telemetry proxy. A `null` start
defaults to the sandbox creation time; a `null` end defaults to the current time.
Samples are returned ordered ascending by timestamp.

**Parameters**:

- `start` _OffsetDateTime_ - start of the time range, or `null` for the sandbox creation time
- `end` _OffsetDateTime_ - end of the time range, or `null` for the current time

**Returns**:

- `List\<SandboxMetrics\>` - time-ordered usage samples over the requested range

**Throws**:

- `DaytonaException` - if the request fails

#### getWorkDir()
```java
public String getWorkDir()
```

Returns current working directory path.

**Returns**:

- `String` - absolute working directory path

**Throws**:

- `DaytonaException` - if the request fails

#### updateEnv()
```java
public void updateEnv(Map<String, String> env)
```

Updates the Sandbox daemon's process environment.

Newly spawned processes, sessions, and PTYs inherit the change; already-running
processes keep their environment.

**Parameters**:

- `env` _Map\<String, String\>_ - environment variables to set in the daemon's process environment

**Throws**:

- `DaytonaException` - if the update fails

#### updateEnv()
```java
public void updateEnv(Map<String, String> env, List<String> unset)
```

Updates the Sandbox daemon's process environment.

Newly spawned processes, sessions, and PTYs inherit the change; already-running
processes keep their environment.

**Parameters**:

- `env` _Map\<String, String\>_ - environment variables to set in the daemon's process environment; `null` to set none
- `unset` _List\<String\>_ - environment variable names to remove; `null` to remove none

**Throws**:

- `DaytonaException` - if the update fails

#### downloadUrl()
```java
public String downloadUrl(String path, Long ttlSeconds)
```

Creates a pre-signed URL for downloading a file from the Sandbox.

The URL works with any HTTP client without auth headers and stays valid across
sandbox restarts (downloads succeed only while the sandbox is running). The signing
key is cached locally for up to 15 seconds; if the key was rotated from another
client, URLs may be rejected until the cache refreshes.
```java
String url = sandbox.downloadUrl("/home/user/report.pdf", null);
// curl "$url" -o report.pdf
```

**Parameters**:

- `path` _String_ - Path to the file in the Sandbox.
- `ttlSeconds` _Long_ - How long the URL stays valid, in seconds. Defaults to 3600. Zero or negative means never expires.

**Returns**:

- `String` - Pre-signed download URL.

**Throws**:

- `DaytonaException` - if the signing key cannot be fetched.

#### downloadUrl()
```java
public String downloadUrl(String path)
```

Creates a pre-signed URL for downloading a file from the Sandbox.

**Parameters**:

- `path` _String_ - Path to the file in the Sandbox.

**Returns**:

- `String` - Pre-signed download URL.

**Throws**:

- `DaytonaException` - if the signing key cannot be fetched.

#### uploadUrl()
```java
public String uploadUrl(String path, Long ttlSeconds)
```

Creates a pre-signed URL for uploading a file to the Sandbox.

Send a POST request with the file as multipart/form-data. The URL works with any
HTTP client without auth headers. The signing key is cached locally for up to
15 seconds; if the key was rotated from another client, URLs may be rejected
until the cache refreshes.
```java
String url = sandbox.uploadUrl("/home/user/data.bin", null);
// curl -X POST -F "file=@local.bin" "$url"
```

**Parameters**:

- `path` _String_ - Destination path for the uploaded file in the Sandbox.
- `ttlSeconds` _Long_ - How long the URL stays valid, in seconds. Defaults to 3600. Zero or negative means never expires.

**Returns**:

- `String` - Pre-signed upload URL.

**Throws**:

- `DaytonaException` - if the signing key cannot be fetched.

#### uploadUrl()
```java
public String uploadUrl(String path)
```

Creates a pre-signed URL for uploading a file to the Sandbox.

**Parameters**:

- `path` _String_ - Destination path for the uploaded file in the Sandbox.

**Returns**:

- `String` - Pre-signed upload URL.

**Throws**:

- `DaytonaException` - if the signing key cannot be fetched.

#### rotateSigningKey()
```java
public void rotateSigningKey()
```

Rotates the sandbox signing key, invalidating all previously signed URLs.

**Throws**:

- `DaytonaException` - if the signing key rotation fails.

#### waitUntilStarted()
```java
public void waitUntilStarted(long timeoutSeconds)
```

Waits until Sandbox reaches `started` state.

**Parameters**:

- `timeoutSeconds` _long_ - maximum seconds to wait; `0` disables timeout

**Throws**:

- `DaytonaException` - if timeout is invalid, state becomes failure, or timeout expires

#### waitForResizeComplete()
```java
public void waitForResizeComplete(long timeoutSeconds)
```

Waits for a resize operation to complete.

**Parameters**:

- `timeoutSeconds` _long_ - maximum seconds to wait; `0` disables timeout

**Throws**:

- `DaytonaException` - if resize times out or fails

#### refreshData()
```java
public void refreshData()
```

Refreshes local Sandbox fields from latest API state. After refresh, all fields
— including those not returned by `Daytona#list` — are populated.

**Throws**:

- `DaytonaException` - if refresh fails

#### fork()
```java
public Sandbox fork()
```

Forks this Sandbox, creating a new Sandbox with an identical filesystem.
Uses default timeout of 60 seconds.

Example usage:
```java
Sandbox forked = sandbox.fork();
System.out.println(forked.getId());
```

**Returns**:

- `Sandbox` - the forked `Sandbox` in started state

**Throws**:

- `DaytonaException` - if the fork operation fails or times out

#### fork()
```java
public Sandbox fork(String name, long timeoutSeconds)
```

Forks this Sandbox, creating a new Sandbox with an identical filesystem.
The forked Sandbox is a copy-on-write clone of the original.

Example usage:
```java
Sandbox forked = sandbox.fork("my-fork", 120);
System.out.println(forked.getId());
```

**Parameters**:

- `name` _String_ - optional name for the forked Sandbox; `null` for auto-generated
- `timeoutSeconds` _long_ - maximum seconds to wait for the forked Sandbox to start; `0` disables timeout

**Returns**:

- `Sandbox` - the forked `Sandbox` in started state

**Throws**:

- `DaytonaException` - if the fork operation fails or times out

#### experimentalFork()
```java
public Sandbox experimentalFork()
```

Forks this Sandbox, creating a new Sandbox with an identical filesystem.
Uses default timeout of 60 seconds.

**Deprecated**: Use `#fork()` instead. This method will be removed in a future version.

**Returns**:

- `Sandbox` - the forked `Sandbox` in started state

**Throws**:

- `DaytonaException` - if the fork operation fails or times out

#### experimentalFork()
```java
public Sandbox experimentalFork(String name, long timeoutSeconds)
```

Forks this Sandbox, creating a new Sandbox with an identical filesystem.
The forked Sandbox is a copy-on-write clone of the original.

**Deprecated**: Use `#fork(String, long)` instead. This method will be removed in a future version.

**Parameters**:

- `name` _String_ - optional name for the forked Sandbox; `null` for auto-generated
- `timeoutSeconds` _long_ - maximum seconds to wait for the forked Sandbox to start; `0` disables timeout

**Returns**:

- `Sandbox` - the forked `Sandbox` in started state

**Throws**:

- `DaytonaException` - if the fork operation fails or times out

#### createSnapshot()
```java
public void createSnapshot(String name)
```

Creates a snapshot from the current state of this Sandbox.
Uses default timeout of 60 seconds.

Example usage:
```java
sandbox.createSnapshot("my-snapshot");
```

**Parameters**:

- `name` _String_ - name for the new snapshot

**Throws**:

- `DaytonaException` - if the snapshot operation fails

#### createSnapshot()
```java
public void createSnapshot(String name, long timeoutSeconds)
```

Creates a snapshot from the current state of this Sandbox.
The Sandbox will temporarily enter a 'snapshotting' state and return to its previous state when complete.

Example usage:
```java
sandbox.createSnapshot("my-snapshot", 120);
```

**Parameters**:

- `name` _String_ - name for the new snapshot
- `timeoutSeconds` _long_ - maximum seconds to wait for the snapshot operation to complete; `0` disables timeout

**Throws**:

- `DaytonaException` - if the snapshot operation fails

#### experimentalCreateSnapshot()
```java
public void experimentalCreateSnapshot(String name)
```

Creates a snapshot from the current state of this Sandbox.
Uses default timeout of 60 seconds.

**Deprecated**: Use `#createSnapshot(String)` instead. This method will be removed in a future version.

**Parameters**:

- `name` _String_ - name for the new snapshot

**Throws**:

- `DaytonaException` - if the snapshot operation fails

#### experimentalCreateSnapshot()
```java
public void experimentalCreateSnapshot(String name, long timeoutSeconds)
```

Creates a snapshot from the current state of this Sandbox.
The Sandbox will temporarily enter a 'snapshotting' state and return to its previous state when complete.

**Deprecated**: Use `#createSnapshot(String, long)` instead. This method will be removed in a future version.

**Parameters**:

- `name` _String_ - name for the new snapshot
- `timeoutSeconds` _long_ - maximum seconds to wait for the snapshot operation to complete; `0` disables timeout

**Throws**:

- `DaytonaException` - if the snapshot operation fails

#### pause()
```java
public void pause() throws DaytonaException
```

Pauses the Sandbox, freezing all running processes.
Uses default timeout of 60 seconds.

**Throws**:

- `DaytonaException` - if the pause operation fails

#### pause()
```java
public void pause(long timeoutSeconds) throws DaytonaException
```

Pauses the Sandbox, freezing all running processes.
Completes when the Sandbox has left the `pausing` state — any non-error
terminal state (paused, stopped, archived, etc.) is accepted.

**Parameters**:

- `timeoutSeconds` _long_ - maximum time to wait in seconds (0 = no timeout)

**Throws**:

- `DaytonaException` - if timeout is negative or the operation fails/times out

#### getId()
```java
public String getId()
```

**Returns**:

- `String` - Sandbox ID.

#### getName()
```java
public String getName()
```

**Returns**:

- `String` - Sandbox name.

#### getOrganizationId()
```java
public String getOrganizationId()
```

**Returns**:

- `String` - organization ID that owns this Sandbox.

#### getSnapshot()
```java
public String getSnapshot()
```

**Returns**:

- `String` - Daytona snapshot used to create this Sandbox, or `null` if none.

#### getUser()
```java
public String getUser()
```

**Returns**:

- `String` - OS user running in the Sandbox.

#### getLabels()
```java
public Map<String, String> getLabels()
```

**Returns**:

- `Map\<String, String\>` - custom labels attached to the Sandbox.

#### getPublic()
```java
public Boolean getPublic()
```

**Returns**:

- `Boolean` - whether the Sandbox HTTP preview is publicly accessible.

#### getTarget()
```java
public String getTarget()
```

**Returns**:

- `String` - target region/environment where the Sandbox runs.

#### getCpu()
```java
public int getCpu()
```

**Returns**:

- `int` - allocated CPU cores.

#### getGpu()
```java
public int getGpu()
```

**Returns**:

- `int` - allocated GPU units.

#### isSpot()
```java
public boolean isSpot()
```

Returns whether this is a spot GPU Sandbox.

Spot Sandboxes may be instantly terminated to free capacity for on-demand GPU Sandboxes.

**Returns**:

- `boolean` - `true` when the Sandbox is preemptible.

#### getSpotEvictedAt()
```java
public String getSpotEvictedAt()
```

**Returns**:

- `String` - when the Sandbox was evicted by spot preemption, or `null` when it was not.

#### getMemory()
```java
public int getMemory()
```

**Returns**:

- `int` - allocated memory in GiB.

#### getDisk()
```java
public int getDisk()
```

**Returns**:

- `int` - allocated disk in GiB.

#### getState()
```java
public String getState()
```

**Returns**:

- `String` - current lifecycle state (e.g. "started", "stopped").

#### getErrorReason()
```java
public String getErrorReason()
```

**Returns**:

- `String` - error message if the Sandbox is in an error state, or `null`.

#### getRecoverable()
```java
public Boolean getRecoverable()
```

**Returns**:

- `Boolean` - whether the Sandbox error is recoverable, or `null` if unknown.

#### getBackupState()
```java
public String getBackupState()
```

**Returns**:

- `String` - current state of the Sandbox backup as a string, or `null`.

#### getAutoStopInterval()
```java
public Integer getAutoStopInterval()
```

**Returns**:

- `Integer` - auto-stop interval in minutes (0 means disabled).

#### getAutoPauseInterval()
```java
public Integer getAutoPauseInterval()
```

**Returns**:

- `Integer` - auto-pause interval in minutes (0 means disabled).

#### getAutoArchiveInterval()
```java
public Integer getAutoArchiveInterval()
```

**Returns**:

- `Integer` - auto-archive interval in minutes.

#### getAutoDeleteInterval()
```java
public Integer getAutoDeleteInterval()
```

**Returns**:

- `Integer` - auto-delete interval in minutes (negative means disabled).

#### getCreatedAt()
```java
public String getCreatedAt()
```

**Returns**:

- `String` - when the Sandbox was created, or `null`.

#### getUpdatedAt()
```java
public String getUpdatedAt()
```

**Returns**:

- `String` - when the Sandbox was last updated, or `null`.

#### getLastActivityAt()
```java
public String getLastActivityAt()
```

**Returns**:

- `String` - when the Sandbox last had activity, or `null`.

#### getAutoDestroyAt()
```java
public String getAutoDestroyAt()
```

**Returns**:

- `String` - when the Sandbox expires, or `null` if no TTL is set.

#### getToolboxProxyUrl()
```java
public String getToolboxProxyUrl()
```

**Returns**:

- `String` - toolbox proxy URL.

#### getSandboxClass()
```java
public SandboxClass getSandboxClass()
```

**Returns**:

- `SandboxClass` - sandbox class (e.g. linux-vm, container), or `null` when not set.

#### getWarmPoolId()
```java
public String getWarmPoolId()
```

**Returns**:

- `String` - warm-pool ID the Sandbox belongs to, or `null` when not in a warm pool.

#### getGpuType()
```java
public GpuType getGpuType()
```

**Returns**:

- `GpuType` - GPU type (e.g. H100), or `null` when the Sandbox has no GPU.

#### getDesiredState()
```java
public SandboxDesiredState getDesiredState()
```

**Returns**:

- `SandboxDesiredState` - desired lifecycle state requested by the user, or `null` when not set.

#### getDaemonVersion()
```java
public String getDaemonVersion()
```

**Returns**:

- `String` - version of the Daytona daemon running in the Sandbox, or `null` when unknown.

#### getEnv()
```java
public Map<String, String> getEnv()
```

Returns Sandbox environment variables.

Not returned by `Daytona#list`; call `#refreshData()` on each item to populate.

**Returns**:

- `Map\<String, String\>` - environment map, or `null` if not yet populated

#### getNetworkBlockAll()
```java
public Boolean getNetworkBlockAll()
```

Returns whether all network access is blocked for this Sandbox.

Not returned by `Daytona#list`; call `#refreshData()` on each item to populate.

**Returns**:

- `Boolean` - block-all flag, or `null` if not yet populated

#### getNetworkAllowList()
```java
public String getNetworkAllowList()
```

Returns the comma-separated CIDR allow list, if any.

Not returned by `Daytona#list`; call `#refreshData()` on each item to populate.

**Returns**:

- `String` - allow list, or `null`

#### getDomainAllowList()
```java
public String getDomainAllowList()
```

Returns the comma-separated list of allowed domains, if any.

Not returned by `Daytona#list`; call `#refreshData()` on each item to populate.

**Returns**:

- `String` - allowed domains, or `null`

#### getOutboundProxyUrl()
```java
public String getOutboundProxyUrl()
```

Returns the outbound proxy URL to route the sandbox HTTP(S) traffic through, if any.

Not returned by `Daytona#list`; call `#refreshData()` on each item to populate.
Applied via the HTTP(S)_PROXY environment variables; combine with domainAllowList for
network-layer enforcement.

**Returns**:

- `String` - outbound proxy URL, or `null`

#### getVolumes()
```java
public List<SandboxVolume> getVolumes()
```

Returns volumes attached to the Sandbox.

Not returned by `Daytona#list`; call `#refreshData()` on each item to populate.

**Returns**:

- `List\<SandboxVolume\>` - immutable list of attached volumes, or `null` if not yet populated

#### getBuildInfo()
```java
public BuildInfo getBuildInfo()
```

Returns build information if the Sandbox was created from a dynamic build.

Not returned by `Daytona#list`; call `#refreshData()` on each item to populate.

**Returns**:

- `BuildInfo` - build info, or `null`

#### getBackupCreatedAt()
```java
public String getBackupCreatedAt()
```

Returns the creation timestamp of the last backup.

Not returned by `Daytona#list`; call `#refreshData()` on each item to populate.

**Returns**:

- `String` - backup timestamp, or `null`

#### getOtelEndpointOverride()
```java
public String getOtelEndpointOverride()
```

Returns the OpenTelemetry collector endpoint override for this Sandbox.

Not returned by `Daytona#list`; call `#refreshData()` on each item to populate.

**Returns**:

- `String` - OTel endpoint URL, or `null`

#### getProcess()
```java
public Process getProcess()
```

**Returns**:

- `Process` - process operations facade.

#### getFs()
```java
public FileSystem getFs()
```

**Returns**:

- `FileSystem` - file-system operations facade.

#### getGit()
```java
public Git getGit()
```

**Returns**:

- `Git` - Git operations facade.

## See Also
- [Python SDK - sandbox](../python-sdk/sync/sandbox.md)
- [TypeScript SDK - sandbox](../typescript-sdk/sandbox.md)
