## Contents

- Sandbox
- ListSandboxesQuery
- SandboxMetrics
- See Also




## Sandbox

Represents a Daytona Sandbox.

**Properties**:

- `autoArchiveInterval?` _number_ - Auto-archive interval in minutes
- `autoDeleteInterval?` _number_ - Auto-delete interval in minutes
- `autoDestroyAt?` _string_ - When the Sandbox will be automatically destroyed (only set when a TTL is configured)
- `autoPauseInterval?` _number_ - Auto-pause interval in minutes
- `autoStopInterval?` _number_ - Auto-stop interval in minutes
- `backupCreatedAt?` _string_ - When the backup was created (not returned by list results;
    call `refreshData()` on each item to populate)
- `backupState?` _SandboxBackupStateEnum_ - Current state of Sandbox backup
- `buildInfo?` _BuildInfo_ - Build information for the Sandbox if it was created from dynamic build
    (not returned by list results; call `refreshData()` on each item to populate)
- `codeInterpreter` _CodeInterpreter_ - Stateful interpreter interface for executing code.
    Currently supports only Python. For other languages, use the `process.codeRun` method.
- `computerUse` _ComputerUse_ - Computer use operations interface for desktop automation
- `cpu` _number_ - Number of CPUs allocated to the Sandbox
- `createdAt?` _string_ - When the Sandbox was created
- `daemonVersion?` _string_ - The version of the daemon running in the Sandbox
- `desiredState?` _SandboxDesiredState_ - The state the system is driving the Sandbox toward
- `disk` _number_ - Amount of disk space allocated to the Sandbox in GiB
- `domainAllowList?` _string_ - Comma-separated list of allowed domains for the Sandbox
    (not returned by list results; call `refreshData()` on each item to populate)
- `env?` _Record\<string, string\>_ - Environment variables set in the Sandbox
    (not returned by list results; call `refreshData()` on each item to populate)
- `errorReason?` _string_ - Error message if Sandbox is in error state
- `fs` _FileSystem_ - File system operations interface
- `git` _Git_ - Git operations interface
- `gpu` _number_ - Number of GPUs allocated to the Sandbox
- `gpuType?` _GpuType_ - The GPU type assigned to the Sandbox
- `id` _string_ - Unique identifier for the Sandbox
- `labels` _Record\<string, string\>_ - Custom labels attached to the Sandbox
- `lastActivityAt?` _string_ - When the Sandbox last had activity
- `linkedSandboxId?` _string_ - ID of the Sandbox this Sandbox is linked to. When set, the Sandbox is co-located on the same runner as the linked Sandbox.
    (not returned by list results; call `refreshData()` on each item to populate)
- `memory` _number_ - Amount of memory allocated to the Sandbox in GiB
- `name` _string_
- `networkAllowList?` _string_ - Comma-separated list of allowed CIDR network addresses for the Sandbox
    (not returned by list results; call `refreshData()` on each item to populate)
- `networkBlockAll?` _boolean_ - Whether to block all network access for the Sandbox
    (not returned by list results; call `refreshData()` on each item to populate)
- `organizationId` _string_ - Organization ID of the Sandbox
- `otelEndpointOverride?` _string_ - OTel collector endpoint override for the Sandbox. When set, sandbox OTel
    data is sent to this endpoint instead of the default collector and is not available in the Daytona analytics API or
    dashboard. (not returned by list results; call `refreshData()` on each item to populate)
- `outboundProxyUrl?` _string_ - Outbound proxy URL to route the Sandbox HTTP(S) traffic through. Applied via the HTTP(S)_PROXY environment variables (convenience routing, not a security boundary on its own); combine with domainAllowList for unbypassable network-layer enforcement.
    (not returned by list results; call `refreshData()` on each item to populate)
- `process` _Process_ - Process execution interface
- `public` _boolean_ - Whether the Sandbox is publicly accessible
- `recoverable?` _boolean_ - Whether the Sandbox error is recoverable.
- `sandboxClass?` _SandboxClass_ - The class of the Sandbox (e.g., "linux-vm", "container")
- `snapshot?` _string_ - Daytona snapshot used to create the Sandbox
- `spot?` _boolean_ - Whether this is a spot GPU Sandbox. Spot Sandboxes may be instantly terminated to free
    capacity for on-demand GPU Sandboxes
- `spotEvictedAt?` _string_ - When the Sandbox was evicted by spot preemption
- `state?` _SandboxState_ - Current state of the Sandbox (e.g., "started", "stopped")
- `target` _string_ - Target location of the runner where the Sandbox runs
- `toolboxProxyUrl` _string_
- `updatedAt?` _string_ - When the Sandbox was last updated
- `user` _string_ - OS user running in the Sandbox
- `volumes?` _SandboxVolume\[\]_ - Volumes attached to the Sandbox (not returned by
    list results; call `refreshData()` on each item to populate)
- `warmPoolId?` _string_ - ID of the warm pool this Sandbox waits in; set only while it is an unclaimed member



### Constructors

#### Constructor

```ts
new Sandbox(
   sandboxDto: SandboxListItem | Sandbox,
   clientConfig: Configuration,
   axiosInstance: AxiosInstance,
   sandboxApi: SandboxApi,
   getAnalyticsApiUrl: () => Promise<string>,
   subscriptionManager: EventSubscriptionManager,
   requestTimeoutMs?: number
): Sandbox;
```

Creates a new Sandbox instance.

Internal: obtain sandboxes via Daytona.create, Daytona.get, or
Daytona.list rather than constructing directly.

**Parameters**:

- `sandboxDto` _SandboxListItem \| Sandbox_ - The API Sandbox instance
- `clientConfig` _Configuration_
- `axiosInstance` _AxiosInstance_
- `sandboxApi` _SandboxApi_ - API client for Sandbox operations
- `getAnalyticsApiUrl` _\(\) =\> Promise\<string\>_
- `subscriptionManager` _EventSubscriptionManager_ - Event subscription manager for real-time updates
- `requestTimeoutMs?` _number_


**Returns**:

- `Sandbox`

### Methods

#### ~~\_experimental\_createSnapshot()~~

```ts
_experimental_createSnapshot(name: string, timeout?: number): Promise<void>;
```

**Parameters**:

- `name` _string_ - Name for the new snapshot
- `timeout?` _number = 60_ - Maximum time to wait in seconds. 0 means no timeout.
    Defaults to 60-second timeout.


**Returns**:

- `Promise<void>`

##### Deprecated

Use `createSnapshot` instead. This method will be removed in a future version.

##### See

Sandbox.createSnapshot

#### ~~\_experimental\_fork()~~

```ts
_experimental_fork(params?: ForkSandboxParams, timeout?: number): Promise<Sandbox>;
```

**Parameters**:

- `params?` _ForkSandboxParams_
- `timeout?` _number = 60_


**Returns**:

- `Promise<Sandbox>`

##### Deprecated

Use `fork` instead. This method will be removed in a future version.

##### See

Sandbox.fork

#### archive()

```ts
archive(): Promise<void>;
```

Archives the sandbox, making it inactive and preserving its state. When sandboxes are archived, the entire filesystem
state is moved to cost-effective object storage, making it possible to keep sandboxes available for an extended period.
The tradeoff between archived and stopped states is that starting an archived sandbox takes more time, depending on its size.
Sandbox must be stopped before archiving.

**Returns**:

- `Promise<void>`

#### createLspServer()

```ts
createLspServer(languageId: string, pathToProject: string): Promise<LspServer>;
```

Creates a new Language Server Protocol (LSP) server instance.

The LSP server provides language-specific features like code completion,
diagnostics, and more.

**Parameters**:

- `languageId` _string_ - The language server type (e.g., "typescript")
- `pathToProject` _string_ - Path to the project root directory. Relative paths are resolved based on the sandbox working directory.


**Returns**:

- `Promise<LspServer>` - A new LSP server instance configured for the specified language

**Example:**

```ts
const lsp = await sandbox.createLspServer('typescript', 'workspace/project');
```

#### createSnapshot()

```ts
createSnapshot(name: string, timeout?: number): Promise<void>;
```

Creates a snapshot from the current state of the Sandbox.

This captures the Sandbox's filesystem into a reusable snapshot that can be
used to create new Sandboxes. The Sandbox will temporarily enter a
'snapshotting' state and return to its previous state when complete.

**Parameters**:

- `name` _string_ - Name for the new snapshot
- `timeout?` _number = 60_ - Maximum time to wait in seconds. 0 means no timeout.
    Defaults to 60-second timeout.


**Returns**:

- `Promise<void>`

**Throws**:

- If timeout is a negative number

- If the snapshot operation fails or times out

**Example:**

```ts
const sandbox = await daytona.get('my-sandbox');
await sandbox.createSnapshot('my-snapshot');
console.log('Snapshot created successfully');
```

#### createSshAccess()

```ts
createSshAccess(expiresInMinutes?: number): Promise<SshAccessDto>;
```

Creates an SSH access token for the sandbox.

**Parameters**:

- `expiresInMinutes?` _number_ - The number of minutes the SSH access token will be valid for.


**Returns**:

- `Promise<SshAccessDto>` - The SSH access token.

#### delete()

```ts
delete(timeout?: number, wait?: boolean): Promise<void>;
```

Deletes the Sandbox.

By default this returns as soon as the deletion request is accepted (matching
historical behavior). Pass `wait = true` to block until the Sandbox reaches
the 'destroyed' state.

**Parameters**:

- `timeout?` _number = 60_ - Timeout in seconds for the request — and, when
    `wait` is true, for reaching 'destroyed'. 0 means no timeout.
    Defaults to 60-second timeout.
- `wait?` _boolean = false_ - If true, wait until the Sandbox is destroyed. Defaults to false.


**Returns**:

- `Promise<void>`

#### downloadUrl()

```ts
downloadUrl(path: string, ttlSeconds?: number): Promise<string>;
```

Creates a pre-signed URL for downloading a file from the Sandbox.

The URL works with any HTTP client without auth headers and stays valid across
sandbox restarts (downloads succeed only while the sandbox is running). The signing
key is cached locally for up to 15 seconds; if the key was rotated from another
client, URLs may be rejected until the cache refreshes.

**Parameters**:

- `path` _string_ - Path to the file in the Sandbox.
- `ttlSeconds?` _number_ - How long the URL stays valid, in seconds. Defaults to 3600. Zero or negative means the URL never expires.


**Returns**:

- `Promise<string>` - Pre-signed download URL.

**Example:**

```typescript
const url = await sandbox.downloadUrl('/home/user/report.pdf')
// curl "$url" -o report.pdf
```

#### expireSignedPreviewUrl()

```ts
expireSignedPreviewUrl(port: number, token: string): Promise<void>;
```

Expires a signed preview url for the sandbox at the specified port.

**Parameters**:

- `port` _number_ - The port to expire the signed preview url on.
- `token` _string_ - The token to expire the signed preview url on.


**Returns**:

- `Promise<void>`

#### fork()

```ts
fork(params?: ForkSandboxParams, timeout?: number): Promise<Sandbox>;
```

Forks the Sandbox, creating a new Sandbox with an identical filesystem.

The forked Sandbox is a copy-on-write clone of the original. It starts
with the same disk contents but operates independently from that point on.

**Parameters**:

- `params?` _ForkSandboxParams_ - Fork parameters
- `timeout?` _number = 60_ - Maximum time to wait in seconds. 0 means no timeout.
    Defaults to 60-second timeout.


**Returns**:

- `Promise<Sandbox>` - The forked Sandbox.

**Throws**:

- If timeout is a negative number

- If the fork operation fails or times out

**Example:**

```ts
const sandbox = await daytona.get('my-sandbox');
const forked = await sandbox.fork({ name: 'my-fork' });
console.log(`Forked sandbox: ${forked.id}`);
```

#### getMetrics()

```ts
getMetrics(start?: Date, end?: Date): Promise<SandboxMetrics[]>;
```

Gets historical time-series resource usage metrics for the Sandbox.

**Parameters**:

- `start?` _Date_ - Start of the time range. Defaults to the Sandbox creation time.
- `end?` _Date_ - End of the time range. Defaults to the current time.


**Returns**:

- `Promise<SandboxMetrics[]>` - Time-ordered usage samples over the requested range.

**Example:**

```ts
const samples = await sandbox.getMetrics()
for (const s of samples) {
  console.log(`${s.timestamp.toISOString()} CPU: ${s.cpuUsedPct}% mem: ${s.memUsed}/${s.memTotal}`)
}
```

#### getMetricsLatest()

```ts
getMetricsLatest(): Promise<SandboxMetrics>;
```

Gets the most recent resource usage sample directly from the sandbox daemon.

Unlike getMetrics, which returns aggregated historical samples, this returns the
single current reading without going through the telemetry backend.

**Returns**:

- `Promise<SandboxMetrics>` - The current resource usage sample for the sandbox.

**Example:**

```ts
const m = await sandbox.getMetricsLatest()
console.log(`CPU: ${m.cpuUsedPct}%, mem: ${m.memUsed}/${m.memTotal}`)
```

#### getPreviewLink()

```ts
getPreviewLink(port: number): Promise<PortPreviewUrl>;
```

Retrieves the preview link for the sandbox at the specified port. If the port is closed,
it will be opened automatically. For private sandboxes, a token is included to grant access
to the URL.

**Parameters**:

- `port` _number_ - The port to open the preview link on.


**Returns**:

- `Promise<PortPreviewUrl>` - The response object for the preview link, which includes the `url`
    and the `token` (to access private sandboxes).

**Example:**

```ts
const previewLink = await sandbox.getPreviewLink(3000);
console.log(`Preview URL: ${previewLink.url}`);
console.log(`Token: ${previewLink.token}`);
```

#### getSignedPreviewUrl()

```ts
getSignedPreviewUrl(port: number, expiresInSeconds?: number): Promise<SignedPortPreviewUrl>;
```

Retrieves a signed preview url for the sandbox at the specified port.

**Parameters**:

- `port` _number_ - The port to open the preview link on.
- `expiresInSeconds?` _number_ - The number of seconds the signed preview url will be valid for. Defaults to 60 seconds.


**Returns**:

- `Promise<SignedPortPreviewUrl>` - The response object for the signed preview url.

#### getUserHomeDir()

```ts
getUserHomeDir(): Promise<string>;
```

Gets the user's home directory path for the logged in user inside the Sandbox.

**Returns**:

- `Promise<string>` - The absolute path to the Sandbox user's home directory for the logged in user

**Example:**

```ts
const userHomeDir = await sandbox.getUserHomeDir();
console.log(`Sandbox user home: ${userHomeDir}`);
```

#### ~~getUserRootDir()~~

```ts
getUserRootDir(): Promise<string>;
```

**Returns**:

- `Promise<string>`

##### Deprecated

Use `getUserHomeDir` instead. This method will be removed in a future version.

#### getWorkDir()

```ts
getWorkDir(): Promise<string>;
```

Gets the working directory path inside the Sandbox.

**Returns**:

- `Promise<string>` - The absolute path to the Sandbox working directory. Uses the WORKDIR specified
    in the Dockerfile if present, or falling back to the user's home directory if not.

**Example:**

```ts
const workDir = await sandbox.getWorkDir();
console.log(`Sandbox working directory: ${workDir}`);
```

#### pause()

```ts
pause(timeout?: number): Promise<void>;
```

Pauses the Sandbox, freezing all running processes.

The Sandbox will enter a 'pausing' state and transition to 'paused' when
complete. While paused, the Sandbox retains its state in memory but does
not consume CPU cycles.

**Parameters**:

- `timeout?` _number = 60_ - Maximum time to wait in seconds. 0 means no timeout.
    Defaults to 60-second timeout.


**Returns**:

- `Promise<void>`

**Throws**:

- If timeout is a negative number

- If the pause operation fails or times out

**Example:**

```ts
const sandbox = await daytona.get('my-sandbox');
await sandbox.pause();
console.log('Sandbox paused successfully');
```

#### recover()

```ts
recover(timeout?: number): Promise<void>;
```

Recover the Sandbox from a recoverable error and wait for it to be ready.

**Parameters**:

- `timeout?` _number = 60_ - Maximum time to wait in seconds. 0 means no timeout.
    Defaults to 60-second timeout.


**Returns**:

- `Promise<void>`

**Throws**:

- `DaytonaError` - If Sandbox fails to recover or times out

**Example:**

```ts
const sandbox = await daytona.get('my-sandbox-id');
await sandbox.recover();
console.log('Sandbox recovered successfully');
```

#### refreshActivity()

```ts
refreshActivity(): Promise<void>;
```

Refreshes the sandbox activity to reset the timer for automated lifecycle management actions.

This method updates the sandbox's last activity timestamp without changing its state.
It is useful for keeping long-running sessions alive while there is still user activity.

**Returns**:

- `Promise<void>`

**Example:**

```ts
// Keep sandbox activity alive
await sandbox.refreshActivity();
```

#### refreshData()

```ts
refreshData(): Promise<void>;
```

Refreshes the Sandbox data from the API.

**Returns**:

- `Promise<void>`

**Example:**

```ts
await sandbox.refreshData();
console.log(`Sandbox ${sandbox.id}:`);
console.log(`State: ${sandbox.state}`);
console.log(`Resources: ${sandbox.cpu} CPU, ${sandbox.memory} GiB RAM`);
```

#### resize()

```ts
resize(resources: Pick<Resources, "cpu" | "memory" | "disk">, timeout?: number): Promise<void>;
```

Resizes the Sandbox resources.

Changes the CPU, memory, or disk allocation. Hot resize (on a running Sandbox) accepts
only CPU and memory increases. Disk resize requires a stopped Sandbox; disk can only
grow. GPU is not resizable — to change GPU, create a new Sandbox.

**Parameters**:

- `resources` _Pick\<Resources, "cpu" \| "memory" \| "disk"\>_ - New resource configuration (cpu, memory, disk only). Only specified fields are updated.
- `timeout?` _number = 60_ - Timeout in seconds for the resize operation. 0 means no timeout.


**Returns**:

- `Promise<void>`

**Throws**:

If hot-resize constraints are violated, disk resize is attempted on
  a running Sandbox, disk decrease is attempted, no fields are provided, or the operation times out.

**Examples:**

```ts
await sandbox.resize({ cpu: 4, memory: 8 })
```

```ts
await sandbox.stop()
await sandbox.resize({ cpu: 2, memory: 4, disk: 30 })
```

#### revokeSshAccess()

```ts
revokeSshAccess(token: string): Promise<void>;
```

Revokes an SSH access token for the sandbox.

**Parameters**:

- `token` _string_ - The token to revoke.


**Returns**:

- `Promise<void>`

#### rotateSigningKey()

```ts
rotateSigningKey(): Promise<void>;
```

Rotates the sandbox signing key, invalidating all previously signed URLs.

**Returns**:

- `Promise<void>`

#### setAutoArchiveInterval()

```ts
setAutoArchiveInterval(interval: number): Promise<void>;
```

Set the auto-archive interval for the Sandbox.

The Sandbox will automatically archive after being continuously stopped for the specified interval.

**Parameters**:

- `interval` _number_ - Number of minutes after which a continuously stopped Sandbox will be auto-archived.
    Set to 0 for the maximum interval. Default is 7 days.


**Returns**:

- `Promise<void>`

**Throws**:

- `DaytonaError` - If interval is not a non-negative integer

**Example:**

```ts
// Auto-archive after 1 hour
await sandbox.setAutoArchiveInterval(60);
// Or use the maximum interval
await sandbox.setAutoArchiveInterval(0);
```

#### setAutoDeleteInterval()

```ts
setAutoDeleteInterval(interval: number): Promise<void>;
```

Set the auto-delete interval for the Sandbox.

The Sandbox will automatically delete after being continuously stopped for the specified interval.

**Parameters**:

- `interval` _number_ - Number of minutes after which a continuously stopped Sandbox will be auto-deleted.
    Set to negative value to disable auto-delete. Set to 0 to delete immediately upon stopping.
    By default, auto-delete is disabled.


**Returns**:

- `Promise<void>`

**Example:**

```ts
// Auto-delete after 1 hour
await sandbox.setAutoDeleteInterval(60);
// Or delete immediately upon stopping
await sandbox.setAutoDeleteInterval(0);
// Or disable auto-delete
await sandbox.setAutoDeleteInterval(-1);
```

#### setAutoPauseInterval()

```ts
setAutoPauseInterval(interval: number): Promise<void>;
```

Set the auto-pause interval for the Sandbox.

The Sandbox will automatically pause after being idle (no new events) for the specified interval.
Events include any state changes or interactions with the Sandbox through the sdk.
Interactions using Sandbox Previews are not included.

Only supported for sandbox classes that support pausing. At most one of the auto-stop
and auto-pause intervals may be non-zero, so disable auto-stop first by setting its
interval to 0.

**Parameters**:

- `interval` _number_ - Number of minutes of inactivity before auto-pausing.
    Set to 0 to disable auto-pause. For pause-supporting sandbox
    classes, creation defaults to 60 minutes when neither interval is provided.


**Returns**:

- `Promise<void>`

**Throws**:

- `DaytonaError` - If interval is not a non-negative integer

**Example:**

```ts
// Auto-pause after 1 hour
await sandbox.setAutoPauseInterval(60);
// Or disable auto-pause
await sandbox.setAutoPauseInterval(0);
```

#### setAutostopInterval()

```ts
setAutostopInterval(interval: number): Promise<void>;
```

Set the auto-stop interval for the Sandbox.

The Sandbox will automatically stop after being idle (no new events) for the specified interval.
Events include any state changes or interactions with the Sandbox through the sdk.
Interactions using Sandbox Previews are not included.

**Parameters**:

- `interval` _number_ - Number of minutes of inactivity before auto-stopping.
    Set to 0 to disable auto-stop. Default is 15 minutes.


**Returns**:

- `Promise<void>`

**Throws**:

- `DaytonaError` - If interval is not a non-negative integer

**Example:**

```ts
// Auto-stop after 1 hour
await sandbox.setAutostopInterval(60);
// Or disable auto-stop
await sandbox.setAutostopInterval(0);
```

#### setLabels()

```ts
setLabels(labels: Record<string, string>): Promise<Record<string, string>>;
```

Sets labels for the Sandbox.

Labels are key-value pairs that can be used to organize and identify Sandboxes.

**Parameters**:

- `labels` _Record\<string, string\>_ - Dictionary of key-value pairs representing Sandbox labels


**Returns**:

- `Promise<Record<string, string>>`

**Example:**

```ts
// Set sandbox labels
await sandbox.setLabels({
  project: 'my-project',
  environment: 'development',
  team: 'backend'
});
```

#### setTtl()

```ts
setTtl(ttlMinutes: number): Promise<void>;
```

Set the TTL (maximum time to live) for the Sandbox.

The Sandbox will be destroyed once the TTL elapses, counted as wall-clock time regardless of the
Sandbox state - even if it is stopped, paused, or archived. Calling this method re-anchors the
deadline from the current time. Call `refreshData()` afterwards to read the updated `autoDestroyAt`.

**Parameters**:

- `ttlMinutes` _number_ - Number of minutes from now after which the Sandbox will be destroyed.
    Set to 0 to disable the TTL.


**Returns**:

- `Promise<void>`

**Throws**:

- `DaytonaError` - If ttlMinutes is not a non-negative integer

**Example:**

```ts
// Destroy the Sandbox 1 hour from now
await sandbox.setTtl(60);
// Or disable the TTL
await sandbox.setTtl(0);
```

#### start()

```ts
start(timeout?: number): Promise<void>;
```

Start the Sandbox.

This method starts the Sandbox and waits for it to be ready.

**Parameters**:

- `timeout?` _number = 60_ - Maximum time to wait in seconds. 0 means no timeout.
    Defaults to 60-second timeout.


**Returns**:

- `Promise<void>`

**Throws**:

- `DaytonaError` - If Sandbox fails to start or times out

**Example:**

```ts
const sandbox = await daytona.getCurrentSandbox('my-sandbox');
await sandbox.start(40);  // Wait up to 40 seconds
console.log('Sandbox started successfully');
```

#### stop()

```ts
stop(timeout?: number, force?: boolean): Promise<void>;
```

Stops the Sandbox.

This method stops the Sandbox and waits for it to be fully stopped.

**Parameters**:

- `timeout?` _number = 60_ - Maximum time to wait in seconds. 0 means no timeout.
    Defaults to 60-second timeout.
- `force?` _boolean = false_ - If true, uses SIGKILL instead of SIGTERM. Defaults to false.


**Returns**:

- `Promise<void>`

**Example:**

```ts
const sandbox = await daytona.get('my-sandbox-id');
await sandbox.stop();
console.log('Sandbox stopped successfully');
```

#### updateEnv()

```ts
updateEnv(env: Record<string, string>, options?: {
  unset?: string[];
}): Promise<void>;
```

Updates the Sandbox daemon's process environment.

Variables in `env` are set (added or overwritten) and variables listed in `options.unset`
are removed. Newly spawned processes, sessions and PTYs inherit the change; already-running
processes keep their environment.

**Parameters**:

- `env` _Record\<string, string\>_ - Map of environment variable names to values to set.
- `options?` _Optional settings._
- `unset?` _string\[\]_ - Names of environment variables to remove before `env` is applied.


**Returns**:

- `Promise<void>`

**Example:**

```ts
// Set a variable and remove another
await sandbox.updateEnv({ NODE_ENV: 'production' }, { unset: ['DEBUG'] });
```

#### updateNetworkSettings()

```ts
updateNetworkSettings(settings: UpdateSandboxNetworkSettings): Promise<void>;
```

Updates outbound network policy for this sandbox on the runner (for example block all traffic,
restore general internet access, or apply a CIDR allow list) without stopping the sandbox.

This maps to the same mechanism as creating a sandbox with `networkBlockAll` / `networkAllowList` /
`domainAllowList`: the runner applies iptables rules to the sandbox container.

**Parameters**:

- `settings` _UpdateSandboxNetworkSettings_ - At least one of `networkBlockAll`, `networkAllowList` or
    `domainAllowList` must be set.
    Set `networkBlockAll` to `false` to restore outbound access after a block (and clear a stored allow list).


**Returns**:

- `Promise<void>`

**Example:**

```ts
// Pause internet (outbound blocked)
await sandbox.updateNetworkSettings({ networkBlockAll: true });
// Resume internet
await sandbox.updateNetworkSettings({ networkBlockAll: false });
// Allow only specific domains
await sandbox.updateNetworkSettings({ domainAllowList: 'example.com,*.daytona.io' });
```

#### updateSecrets()

```ts
updateSecrets(secrets: Record<string, string>): Promise<void>;
```

Replaces the set of vault secrets mounted in the Sandbox.

Each key is an environment variable name and each value is the name of an existing
organization Secret to mount under that name. The provided map replaces the previously
mounted set — pass an empty object to detach all secrets.

Attached, detached, or rotated secrets take effect for outbound requests within seconds.
However, newly attached env vars only become visible to processes spawned after the update;
already-running processes keep their environment. A Sandbox created without any secrets
must be restarted for newly attached secrets to work.

**Parameters**:

- `secrets` _Record\<string, string\>_ - Map of environment variable name to the name of an
    existing organization Secret. Every referenced Secret name must already exist in the organization.


**Returns**:

- `Promise<void>`

**Example:**

```ts
// Mount two secrets
await sandbox.updateSecrets({ API_KEY: 'my-api-key', DB_PASSWORD: 'prod-db-password' });
// Detach all secrets
await sandbox.updateSecrets({});
```

#### uploadUrl()

```ts
uploadUrl(path: string, ttlSeconds?: number): Promise<string>;
```

Creates a pre-signed URL for uploading a file to the Sandbox.

Send a POST request with the file as multipart/form-data. The URL works with any
HTTP client without auth headers. The signing key is cached locally for up to
15 seconds; if the key was rotated from another client, URLs may be rejected
until the cache refreshes.

**Parameters**:

- `path` _string_ - Destination path for the uploaded file in the Sandbox.
- `ttlSeconds?` _number_ - How long the URL stays valid, in seconds. Defaults to 3600. Zero or negative means the URL never expires.


**Returns**:

- `Promise<string>` - Pre-signed upload URL.

**Example:**

```typescript
const url = await sandbox.uploadUrl('/home/user/data.bin')
// curl -X POST -F "file=@local.bin" "$url"
```

#### validateSshAccess()

```ts
validateSshAccess(token: string): Promise<SshAccessValidationDto>;
```

Validates an SSH access token for the sandbox.

**Parameters**:

- `token` _string_ - The token to validate.


**Returns**:

- `Promise<SshAccessValidationDto>` - The SSH access validation result.

#### waitForResizeComplete()

```ts
waitForResizeComplete(timeout?: number): Promise<void>;
```

Waits for the Sandbox resize operation to complete.

This method polls the Sandbox status until the state is no longer 'resizing'.

**Parameters**:

- `timeout?` _number = 60_ - Maximum time to wait in seconds. 0 means no timeout.


**Returns**:

- `Promise<void>`

**Throws**:

- If the sandbox ends up in an error state or resize times out.

#### waitUntilStarted()

```ts
waitUntilStarted(timeout?: number): Promise<void>;
```

Waits for the Sandbox to reach the 'started' state.

This method polls the Sandbox status until it reaches the 'started' state
or encounters an error.

**Parameters**:

- `timeout?` _number = 60_ - Maximum time to wait in seconds. 0 means no timeout.
    Defaults to 60 seconds.


**Returns**:

- `Promise<void>`

**Throws**:

- `DaytonaError` - If the sandbox ends up in an error state or fails to start within the timeout period.

#### waitUntilStopped()

```ts
waitUntilStopped(timeout?: number): Promise<void>;
```

Wait for Sandbox to reach 'stopped' state.

This method polls the Sandbox status until it reaches the 'stopped' state
or encounters an error.

**Parameters**:

- `timeout?` _number = 60_ - Maximum time to wait in seconds. 0 means no timeout.
    Defaults to 60 seconds.


**Returns**:

- `Promise<void>`

**Throws**:

- `DaytonaError` - If the sandbox fails to stop within the timeout period.
## ListSandboxesQuery

**Properties**:

- `autoDestroyAtAfter?` _Date_ - Include sandboxes scheduled for auto destroy after this timestamp
- `autoDestroyAtBefore?` _Date_ - Include sandboxes scheduled for auto destroy before this timestamp
- `createdAtAfter?` _Date_ - Include sandboxes created after this timestamp
- `createdAtBefore?` _Date_ - Include sandboxes created before this timestamp
- `id?` _string_ - Filter by ID prefix (case-insensitive)
- `isPublic?` _boolean_ - Filter by public status
- `isRecoverable?` _boolean_ - Filter by recoverable status
- `labels?` _Record\<string, string\>_ - Filter by labels
- `lastActivityAfter?` _Date_ - Include sandboxes with last activity after this timestamp
- `lastActivityBefore?` _Date_ - Include sandboxes with last activity before this timestamp
- `limit?` _number_ - Per-page fetch size. Does NOT limit the total number of Sandboxes returned.
- `maxCpu?` _number_ - Filter by maximum CPU
- `maxDiskGib?` _number_ - Filter by maximum disk space in GiB
- `maxMemoryGib?` _number_ - Filter by maximum memory in GiB
- `minCpu?` _number_ - Filter by minimum CPU
- `minDiskGib?` _number_ - Filter by minimum disk space in GiB
- `minMemoryGib?` _number_ - Filter by minimum memory in GiB
- `name?` _string_ - Filter by name prefix (case-insensitive)
- `order?` _SandboxListSortDirection_ - Sort direction
- `snapshots?` _string\[\]_ - Filter by snapshot names
- `sort?` _SandboxListSortField_ - Sort by field
- `states?` _SandboxState\[\]_ - Filter by states
- `targets?` _string\[\]_ - Filter by targets
## SandboxMetrics

A single point-in-time sample of historical Sandbox resource usage.

**Properties**:

- `cpuCount` _number_ - Number of CPU cores allocated to the Sandbox.
- `cpuUsedPct` _number_ - CPU utilization as a percentage of the allocated limit.
- `diskTotal` _number_ - Total disk space in bytes.
- `diskUsed` _number_ - Used disk space in bytes.
- `memCache` _number_ - Memory used by the page cache in bytes.
- `memTotal` _number_ - Total memory in bytes.
- `memUsed` _number_ - Used memory in bytes.
- `timestamp` _Date_ - Timestamp of this sample.

## See Also
- [Python SDK - sandbox](../python-sdk/sync/sandbox.md)
