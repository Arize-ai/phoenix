
## SnapshotService

SnapshotService class for Daytona SDK.

### Constructors

#### new SnapshotService()

```ruby
def initialize(snapshots_api:, object_storage_api:, default_region_id: nil, otel_state: nil)

```

**Parameters**:

- `snapshots_api` _DaytonaApiClient:SnapshotsApi_ - The snapshots API client
- `object_storage_api` _DaytonaApiClient:ObjectStorageApi_ - The object storage API client
- `default_region_id` _String, nil_ - Default region ID for snapshot creation
- `otel_state` _Daytona:OtelState, nil_ -

**Returns**:

- `SnapshotService` - a new instance of SnapshotService

### Methods

#### list()

```ruby
def list(page: nil, limit: nil, source_sandbox_id: nil)

```

List all Snapshots.

**Parameters**:

- `page` _Integer, Nil_ -
- `limit` _Integer, Nil_ -
- `source_sandbox_id` _String, Nil_ - Filter by the ID of the sandbox the snapshot was created from

**Returns**:

- `Daytona:PaginatedResource` - Paginated list of all Snapshots

**Raises**:

- `Daytona:Sdk:Error` -

**Examples:**

```ruby
daytona = Daytona::Daytona.new
page = daytona.snapshot.list(page: 2, limit: 10)
puts "Page #{page.page} of #{page.total_pages} (#{page.total} snapshots total)"
page.items.each { |snapshot| puts "#{snapshot.name} (#{snapshot.image_name})" }

```

#### delete()

```ruby
def delete(snapshot)

```

Delete a Snapshot.

**Parameters**:

- `snapshot` _Daytona:Snapshot, String_ - Snapshot to delete, or its ID or name.
Call cost: 1 API call for a Snapshot object or UUID string; 2 for a name
(resolve, then delete); up to 3 in the worst case for a UUID-formatted name
(the optimistic delete 404s, then resolve + delete).

**Returns**:

- `void`

**Examples:**

```ruby
daytona = Daytona::Daytona.new
snapshot = daytona.snapshot.get("demo")
daytona.snapshot.delete(snapshot)
puts "Snapshot deleted"

```

#### get()

```ruby
def get(name)

```

Get a Snapshot by ID or name.

**Parameters**:

- `name` _String_ - ID or name of the Snapshot to get

**Returns**:

- `Daytona:Snapshot` - The Snapshot object

**Examples:**

```ruby
daytona = Daytona::Daytona.new
snapshot = daytona.snapshot.get("demo")
puts "#{snapshot.name} (#{snapshot.image_name})"

```

#### create()

```ruby
def create(params, on_logs: nil)

```

Creates and registers a new snapshot from the given Image definition.

**Parameters**:

- `params` _Daytona:CreateSnapshotParams_ - Parameters for snapshot creation
- `on_logs` _Proc, Nil_ - Callback proc handling snapshot creation logs

**Returns**:

- `Daytona:Snapshot` - The created snapshot

**Examples:**

```ruby
image = Image.debianSlim('3.12').pipInstall('numpy')
params = CreateSnapshotParams.new(name: 'my-snapshot', image: image)
snapshot = daytona.snapshot.create(params) do |chunk|
  print chunk
end

```

#### activate()

```ruby
def activate(snapshot)

```

Activate a snapshot.

**Parameters**:

- `snapshot` _Daytona:Snapshot, String_ - The Snapshot instance, or its ID or name.
Call cost matches `delete`: 1 for an object or UUID string, 2 for a name,
up to 3 for a UUID-formatted name (optimistic 404 then resolve + activate).

**Returns**:

- `Daytona:Snapshot`

## See Also
- [Python SDK - snapshot](../python-sdk/sync/snapshot.md)
- [TypeScript SDK - snapshot](../typescript-sdk/snapshot.md)
- [Java SDK - snapshot](../java-sdk/snapshot.md)
