## Contents

- Daytona
- CodeLanguage
- CreateSandboxBaseParams
- CreateSandboxFromImageParams
- CreateSandboxFromSnapshotParams
- DaytonaConfig
- Resources
- VolumeMount
- ForkSandboxParams
- CODE\_TOOLBOX\_LANGUAGE\_LABEL
- See Also




## Daytona

Main class for interacting with the Daytona API.
Provides methods for creating, managing, and interacting with Daytona Sandboxes.
Can be initialized either with explicit configuration or using environment variables.

**Properties**:

- `secret` _SecretService_ - Service for managing Daytona Secrets
- `snapshot` _SnapshotService_ - Service for managing Daytona Snapshots
- `volume` _VolumeService_ - Service for managing Daytona Volumes
- `warmPool` _WarmPoolService_ - Service for managing Daytona Warm Pools



**Examples:**

```ts
// Using environment variables
// Uses DAYTONA_API_KEY, DAYTONA_API_URL, DAYTONA_TARGET
const daytona = new Daytona();
const sandbox = await daytona.create();
```

```ts
// Using explicit configuration
const config: DaytonaConfig = {
    apiKey: "your-api-key",
    apiUrl: "https://your-api.com",
    target: "us"
};
const daytona = new Daytona(config);
```

```ts
// Disposes daytona and flushes traces when done
await using daytona = new Daytona({
  otelEnabled: true,
});
@class
```

### Implements

- `AsyncDisposable`

### Constructors

#### Constructor

```ts
new Daytona(config?: DaytonaConfig): Daytona;
```

Creates a new Daytona client instance.

**Parameters**:

- `config?` _DaytonaConfig_ - Configuration options


**Returns**:

- `Daytona`

**Throws**:

When no credentials are provided (neither API key nor JWT token)

When JWT token is provided without an organization ID

### Methods

#### ~~\_experimental\_fork()~~

```ts
_experimental_fork(
   sandbox: Sandbox,
   params?: ForkSandboxParams,
   timeout?: number
): Promise<Sandbox>;
```

**Parameters**:

- `sandbox` _Sandbox_
- `params?` _ForkSandboxParams_
- `timeout?` _number = 60_


**Returns**:

- `Promise<Sandbox>`

##### Deprecated

Use `fork` instead. This method will be removed in a future version.

##### See

Daytona.fork

#### \[asyncDispose\]()

```ts
asyncDispose: Promise<void>;
```

**Returns**:

- `Promise<void>`

##### Implementation of

```ts
AsyncDisposable.[asyncDispose]
```

#### create()

##### Call Signature

```ts
create(params?: CreateSandboxFromSnapshotParams, options?: {
  timeout?: number;
}): Promise<Sandbox>;
```

Creates Sandboxes from specified or default snapshot. You can specify various parameters,
including language, image, environment variables, and volumes.

**Parameters**:

- `params?` _CreateSandboxFromSnapshotParams_ - Parameters for Sandbox creation from snapshot
- `options?` _Options for the create operation_
- `timeout?` _number_ - Timeout in seconds (0 means no timeout, default is 60)

**Returns**:

- `Promise<Sandbox>` - The created Sandbox instance

**Examples:**

```ts
const sandbox = await daytona.create();
```

```ts
// Create a custom sandbox
const params: CreateSandboxFromSnapshotParams = {
    language: 'typescript',
    snapshot: 'my-snapshot-id',
    envVars: {
        NODE_ENV: 'development',
        DEBUG: 'true'
    },
    autoStopInterval: 60,
    autoArchiveInterval: 60,
    autoDeleteInterval: 120
};
const sandbox = await daytona.create(params, { timeout: 100 });
```

##### Call Signature

```ts
create(params?: CreateSandboxFromImageParams, options?: {
  onSnapshotCreateLogs?: (chunk: string) => void;
  timeout?: number;
}): Promise<Sandbox>;
```

Creates Sandboxes from specified image available on some registry or declarative Daytona Image. You can specify various parameters,
including resources, language, image, environment variables, and volumes. Daytona creates snapshot from
provided image and uses it to create Sandbox.

**Parameters**:

- `params?` _CreateSandboxFromImageParams_ - Parameters for Sandbox creation from image
- `options?` _Options for the create operation_
- `onSnapshotCreateLogs?` _\(chunk: string\) =\> void_ - Callback function to handle snapshot creation logs.
- `timeout?` _number_ - Timeout in seconds (0 means no timeout, default is 60)

**Returns**:

- `Promise<Sandbox>` - The created Sandbox instance

**Examples:**

```ts
const sandbox = await daytona.create({ image: 'debian:12.9' }, { timeout: 90, onSnapshotCreateLogs: console.log });
```

```ts
// Create a custom sandbox
const image = Image.base('alpine:3.18').pipInstall('numpy');
const params: CreateSandboxFromImageParams = {
    language: 'typescript',
    image,
    envVars: {
        NODE_ENV: 'development',
        DEBUG: 'true'
    },
    resources: {
        cpu: 2,
        memory: 4 // 4GB RAM
    },
    autoStopInterval: 60,
    autoArchiveInterval: 60,
    autoDeleteInterval: 120
};
const sandbox = await daytona.create(params, { timeout: 100, onSnapshotCreateLogs: console.log });
```

#### delete()

```ts
delete(
   sandbox: Sandbox,
   timeout?: number,
   wait?: boolean
): Promise<void>;
```

Deletes a Sandbox.

**Parameters**:

- `sandbox` _Sandbox_ - The Sandbox to delete
- `timeout?` _number = 60_ - Timeout in seconds (0 means no timeout, default is 60)
- `wait?` _boolean = false_ - If true, wait until the Sandbox is destroyed (default is false)


**Returns**:

- `Promise<void>`

**Example:**

```ts
const sandbox = await daytona.get('my-sandbox-id');
await daytona.delete(sandbox);
```

#### fork()

```ts
fork(
   sandbox: Sandbox,
   params?: ForkSandboxParams,
   timeout?: number
): Promise<Sandbox>;
```

Forks a Sandbox, creating a new Sandbox with an identical filesystem.

**Parameters**:

- `sandbox` _Sandbox_ - The Sandbox to fork
- `params?` _ForkSandboxParams_ - Fork parameters
- `timeout?` _number = 60_ - Timeout in seconds (0 means no timeout, default is 60)


**Returns**:

- `Promise<Sandbox>` - The forked Sandbox

**Example:**

```ts
const sandbox = await daytona.get('my-sandbox-id');
const forked = await daytona.fork(sandbox, { name: 'my-fork' });
console.log(`Forked sandbox: ${forked.id}`);
```

#### get()

```ts
get(sandboxIdOrName: string): Promise<Sandbox>;
```

Gets a Sandbox by its ID or name.

**Parameters**:

- `sandboxIdOrName` _string_ - The ID or name of the Sandbox to retrieve


**Returns**:

- `Promise<Sandbox>` - The Sandbox

**Example:**

```ts
const sandbox = await daytona.get('my-sandbox-id-or-name');
console.log(`Sandbox state: ${sandbox.state}`);
```

#### list()

```ts
list(query?: ListSandboxesQuery): AsyncIterableIterator<Sandbox>;
```

Iterates over Sandboxes matching the given query.

**Parameters**:

- `query?` _ListSandboxesQuery_ - Optional filters, sorting, and per-page size.


##### Returns

`AsyncIterableIterator`\<`Sandbox`\>

**Example:**

```ts
for await (const sandbox of daytona.list({ labels: { env: 'dev' } })) {
  console.log(sandbox.id)
}
```

#### start()

```ts
start(sandbox: Sandbox, timeout?: number): Promise<void>;
```

Starts a Sandbox and waits for it to be ready.

**Parameters**:

- `sandbox` _Sandbox_ - The Sandbox to start
- `timeout?` _number_ - Optional timeout in seconds (0 means no timeout)


**Returns**:

- `Promise<void>`

**Example:**

```ts
const sandbox = await daytona.get('my-sandbox-id');
// Wait up to 60 seconds for the sandbox to start
await daytona.start(sandbox, 60);
```

#### stop()

```ts
stop(sandbox: Sandbox): Promise<void>;
```

Stops a Sandbox.

**Parameters**:

- `sandbox` _Sandbox_ - The Sandbox to stop


**Returns**:

- `Promise<void>`

**Example:**

```ts
const sandbox = await daytona.get('my-sandbox-id');
await daytona.stop(sandbox);
```
## CodeLanguage

Supported programming languages for code execution

Python is used as the default sandbox language when no language is explicitly specified.

**Enum Members**:

- `JAVASCRIPT` ("javascript")
- `PYTHON` ("python")
- `TYPESCRIPT` ("typescript")

## CreateSandboxBaseParams

Base parameters for creating a new Sandbox.

**Properties**:

- `autoArchiveInterval?` _number_ - Auto-archive interval in minutes (0 means the maximum interval will be used). Default is 7 days.
- `autoDeleteInterval?` _number_ - Auto-delete interval in minutes (negative value means disabled, 0 means delete immediately upon stopping). By default, auto-delete is disabled.
- `autoPauseInterval?` _number_ - Auto-pause interval in minutes (0 means disabled). Only supported for sandbox classes that support pausing. Not allowed for ephemeral sandboxes. At most one of autoStopInterval and autoPauseInterval may be non-zero. For non-ephemeral sandbox classes that support pausing, defaults to 60 minutes (with auto-stop disabled) when neither interval is provided.
- `autoStopInterval?` _number_ - Auto-stop interval in minutes (0 means disabled). Default is 15 minutes (for sandbox classes that support pausing, auto-pause defaults to 60 minutes instead and auto-stop is disabled).
- `domainAllowList?` _string_ - Comma-separated list of allowed domains for the Sandbox
- `envVars?` _Record\<string, string\>_ - Optional environment variables to set in the Sandbox
- `ephemeral?` _boolean_ - Whether the Sandbox should be ephemeral. If true, autoDeleteInterval will be set to 0.
- `labels?` _Record\<string, string\>_ - Sandbox labels
- `language?` _string_ - Programming language for direct code execution. Defaults to "python" if not specified.
- `linkedSandbox?` _string_ - ID or name of an existing sandbox to link the new sandbox to. The new sandbox will be scheduled on the same runner as the linked sandbox so a local network can be established between them. Linked sandboxes must be ephemeral (autoDeleteInterval=0) and cannot themselves be linked to another sandbox.
- `name?` _string_
- `networkAllowList?` _string_ - Comma-separated list of allowed CIDR network addresses for the Sandbox
- `networkBlockAll?` _boolean_ - Whether to block all network access for the Sandbox
- `otelEndpointOverride?` _string_ - OTel collector endpoint override for the Sandbox. When set, sandbox OTel data is sent to this endpoint instead of the default collector and will not be available in the Daytona analytics API or dashboard.
- `outboundProxyUrl?` _string_ - Outbound proxy URL to route the Sandbox HTTP(S) traffic through. Applied via the HTTP(S)_PROXY environment variables (convenience routing, not a security boundary on its own); combine with domainAllowList for unbypassable network-layer enforcement.
- `public?` _boolean_ - Is the Sandbox port preview public
- `secrets?` _Record\<string, string\>_ - Optional map of environment variable name to the name of an existing organization Secret to mount into the Sandbox. The env var is set to the Secret's opaque placeholder; the real value is substituted transparently on outbound requests to the Secret's allowed hosts. Every referenced Secret name must already exist in the organization.
- `spot?` _boolean_ - GPU-only. When true, the Sandbox may be instantly terminated without notice to free GPU capacity for an on-demand (non-spot) GPU Sandbox. Rejected when the Sandbox requests no GPUs.
- `ttlMinutes?` _number_ - Maximum time to live in minutes, counted as wall-clock time since creation regardless of sandbox state (0 means disabled). When it elapses the Sandbox is destroyed, even if it is stopped, paused, or archived.
- `user?` _string_ - Optional os user to use for the Sandbox
- `volumes?` _VolumeMount\[\]_ - Optional array of volumes to mount to the Sandbox
## CreateSandboxFromImageParams

Parameters for creating a new Sandbox.

**Properties**:

- `autoArchiveInterval?` _number_
- `autoDeleteInterval?` _number_
- `autoPauseInterval?` _number_
- `autoStopInterval?` _number_
- `domainAllowList?` _string_
- `envVars?` _Record\<string, string\>_
- `ephemeral?` _boolean_
- `image` _string \| Image_ - Custom Docker image to use for the Sandbox. If an Image object is provided,
    the image will be dynamically built.
- `labels?` _Record\<string, string\>_
- `language?` _string_
- `linkedSandbox?` _string_
- `name?` _string_
- `networkAllowList?` _string_
- `networkBlockAll?` _boolean_
- `otelEndpointOverride?` _string_
- `outboundProxyUrl?` _string_
- `public?` _boolean_
- `resources?` _Resources_ - Resource allocation for the Sandbox. If not provided, sandbox will
    have default resources.
- `secrets?` _Record\<string, string\>_
- `spot?` _boolean_
- `ttlMinutes?` _number_
- `user?` _string_
- `volumes?` _VolumeMount\[\]_
## CreateSandboxFromSnapshotParams

Parameters for creating a new Sandbox from a snapshot.

**Properties**:

- `autoArchiveInterval?` _number_
- `autoDeleteInterval?` _number_
- `autoPauseInterval?` _number_
- `autoStopInterval?` _number_
- `domainAllowList?` _string_
- `envVars?` _Record\<string, string\>_
- `ephemeral?` _boolean_
- `labels?` _Record\<string, string\>_
- `language?` _string_
- `linkedSandbox?` _string_
- `name?` _string_
- `networkAllowList?` _string_
- `networkBlockAll?` _boolean_
- `otelEndpointOverride?` _string_
- `outboundProxyUrl?` _string_
- `public?` _boolean_
- `secrets?` _Record\<string, string\>_
- `snapshot?` _string_ - Name of the snapshot to use for the Sandbox.
- `spot?` _boolean_
- `ttlMinutes?` _number_
- `user?` _string_
- `volumes?` _VolumeMount\[\]_
## DaytonaConfig

Configuration options for initializing the Daytona client.

**Properties**:

- `\_experimental?` _Record\<string, any\>_ - Configuration for experimental features
- `apiKey?` _string_ - API key for authentication with the Daytona API
- `apiUrl?` _string_ - URL of the Daytona API. Defaults to 'https://app.daytona.io/api'
    if not set here and not set in environment variable DAYTONA_API_URL.
- `jwtToken?` _string_ - JWT token for authentication with the Daytona API. If not set, it must be provided
    via the environment variable `DAYTONA_JWT_TOKEN`, or an API key must be provided instead.
- `organizationId?` _string_ - Organization ID used for JWT-based authentication. Required if a JWT token
    is provided, and must be set either here or in the environment variable `DAYTONA_ORGANIZATION_ID`.
- `otelEnabled?` _boolean_ - OpenTelemetry tracing enabled.
    If set, all SDK operations will be traced.
- `requestTimeoutMs?` _number_ - Maximum time in milliseconds the SDK waits for a single HTTP response before
    failing the request. Applies to the Daytona API client and to the toolbox
    clients of every Sandbox obtained from this Daytona instance. Defaults to
    24 hours; `0` disables the deadline.

    This is a client-side deadline only — it does not cancel the operation on
    the server. Calls that carry their own operation or execution timeout
    (e.g. `create`, `start`, `stop`, `fork`, `process.executeCommand`,
    `process.codeRun`) are not capped by this value; their HTTP wait is
    bounded by that per-call timeout instead.
- ~~`serverUrl?`~~ _string_ - **_Deprecated_** - Use `apiUrl` instead. This property will be removed in future versions.
- `target?` _string_ - Target location for Sandboxes
- ~~`useDeprecatedPolling?`~~ _boolean_ - Observe sandbox state by legacy polling instead of WebSocket event streaming.
    Defaults to `false`, where state changes are streamed over WebSocket. Can also
    be enabled via the `DAYTONA_USE_DEPRECATED_POLLING` environment variable.

    streaming is the default and falls back to polling automatically when
    WebSockets are unavailable.

    - **_Deprecated_** - Polling-only mode will be removed in a future release. Event


**Example:**

```ts
const config: DaytonaConfig = {
    apiKey: "your-api-key",
    apiUrl: "https://your-api.com",
    target: "us"
};
const daytona = new Daytona(config);
```
## Resources

Resource allocation for a Sandbox.

**Properties**:

- `cpu?` _number_ - CPU allocation for the Sandbox in cores
- `disk?` _number_ - Disk space allocation for the Sandbox in GiB
- `gpu?` _number_ - GPU allocation for the Sandbox in units
- `gpuType?` _GpuType \| GpuType\[\]_ - Preferred GPU type for the Sandbox
- `memory?` _number_ - Memory allocation for the Sandbox in GiB



**Example:**

```ts
const resources: SandboxResources = {
    cpu: 2,
    memory: 4,  // 4GiB RAM
    disk: 20    // 20GiB disk
};
```
## VolumeMount

Represents a volume mount for a Sandbox.

**Properties**:

- `mountPath` _string_ - Path on the Sandbox to mount the Volume

- `subpath?` _string_ - Optional subpath within the volume to mount. When specified, only this S3 prefix will be accessible. When omitted, the entire volume is mounted.
    - _Inherited from_: `SandboxVolume.subpath`
- `volumeId` _string_ - ID or name of the Volume to mount



**Extends:**

- `SandboxVolume`
## ForkSandboxParams

```ts
type ForkSandboxParams = {
  name?: string;
};
```

**Properties**:

- `name?` _string_ - Optional name for the forked Sandbox. If not provided, a unique name will be generated.



Parameters for forking a Sandbox.
## CODE\_TOOLBOX\_LANGUAGE\_LABEL

```ts
const CODE_TOOLBOX_LANGUAGE_LABEL: "code-toolbox-language" = 'code-toolbox-language';
```

## See Also
- [Python SDK - daytona](../python-sdk/sync/daytona.md)
