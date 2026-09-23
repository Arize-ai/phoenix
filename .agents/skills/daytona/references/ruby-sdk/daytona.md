
## Daytona

Daytona class for Daytona SDK.

### Constructors

#### new Daytona()

```ruby
def initialize(config = Config.new)

```

**Parameters**:

- `config` _Daytona:Config_ - Configuration options. Defaults to Daytona::Config.new

**Returns**:

- `Daytona` - a new instance of Daytona

### Methods

#### config()

```ruby
def config()

```

**Returns**:

- `Daytona:Config`

#### api_client()

```ruby
def api_client()

```

**Returns**:

- `DaytonaApiClient`

#### sandbox_api()

```ruby
def sandbox_api()

```

**Returns**:

- `DaytonaApiClient:SandboxApi`

#### volume()

```ruby
def volume()

```

**Returns**:

- `Daytona:VolumeService`

#### secret()

```ruby
def secret()

```

**Returns**:

- `Daytona:SecretService`

#### warm_pool()

```ruby
def warm_pool()

```

**Returns**:

- `Daytona:WarmPoolService`

#### object_storage_api()

```ruby
def object_storage_api()

```

**Returns**:

- `DaytonaApiClient:ObjectStorageApi`

#### snapshots_api()

```ruby
def snapshots_api()

```

**Returns**:

- `DaytonaApiClient:SnapshotsApi`

#### snapshot()

```ruby
def snapshot()

```

**Returns**:

- `Daytona:SnapshotService`

#### close()

```ruby
def close()

```

Shuts down OTel providers, flushing any pending telemetry data.

**Returns**:

- `void`

#### create()

```ruby
def create(params = nil, on_snapshot_create_logs: nil)

```

Creates a sandbox with the specified parameters

**Parameters**:

- `params` _Daytona:CreateSandboxFromSnapshotParams, Daytona:CreateSandboxFromImageParams, Nil_ - Sandbox creation parameters

**Returns**:

- `Daytona:Sandbox` - The created sandbox

**Raises**:

- `Daytona:Sdk:Error` - If auto_stop_interval, auto_pause_interval, auto_archive_interval, or ttl_minutes is negative,
or if auto_stop_interval and auto_pause_interval are both non-zero

#### delete()

```ruby
def delete(sandbox, wait: false)

```

Deletes a Sandbox.

**Parameters**:

- `sandbox` _Daytona:Sandbox_ -
- `wait` _Boolean_ - When +true+, block until the Sandbox is destroyed.

**Returns**:

- `void`

#### get()

```ruby
def get(id)

```

Gets a Sandbox by its ID.

**Parameters**:

- `id` _String_ -

**Returns**:

- `Daytona:Sandbox`

**Raises**:

- `Daytona:Sdk:Error` -

#### list()

```ruby
def list(query = nil)

```

Iterates over Sandboxes matching the given query.

**Parameters**:

- `query` _Daytona:ListSandboxesQuery, nil_ - Optional filters, sorting, and per-page size.

**Returns**:

- `Enumerator\<Daytona:Sandbox\>`

**Raises**:

- `Daytona:Sdk:Error` -

**Examples:**

```ruby
daytona.list(Daytona::ListSandboxesQuery.new(labels: { 'env' => 'dev' })).each do |sandbox|
  puts sandbox.id
end

```

#### start()

```ruby
def start(sandbox, timeout = Sandbox::DEFAULT_TIMEOUT)

```

Starts a Sandbox and waits for it to be ready.

**Parameters**:

- `sandbox` _Daytona:Sandbox_ -
- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s).

**Returns**:

- `void`

#### stop()

```ruby
def stop(sandbox, timeout = Sandbox::DEFAULT_TIMEOUT)

```

Stops a Sandbox and waits for it to be stopped.

**Parameters**:

- `sandbox` _Daytona:Sandbox_ -
- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s).

**Returns**:

- `void`

## See Also
- [Python SDK - daytona](../python-sdk/sync/daytona.md)
- [TypeScript SDK - daytona](../typescript-sdk/daytona.md)
- [Java SDK - daytona](../java-sdk/daytona.md)
- [Go SDK - daytona](../go-sdk/daytona.md)
