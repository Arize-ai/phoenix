
## SnapshotService

Service for managing Daytona Snapshots.

Provides operations to create, list, retrieve, and delete snapshots.

### Methods

#### create()
```java
public Snapshot create(String name, String imageName)
```

Creates a snapshot from an existing image reference.

**Parameters**:

- `name` _String_ - snapshot name
- `imageName` _String_ - source image name or tag

**Returns**:

- `Snapshot` - created `Snapshot`

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if the API request fails

#### create()
```java
public Snapshot create(String name, String imageName, SandboxClass sandboxClass)
```

Creates a snapshot from an existing image reference with a target sandbox class.

**Parameters**:

- `name` _String_ - snapshot name
- `imageName` _String_ - source image name or tag
- `sandboxClass` _SandboxClass_ - target sandbox class; `null` for default

**Returns**:

- `Snapshot` - created `Snapshot`

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if the API request fails

#### create()
```java
public Snapshot create(String name, Image image, Consumer<String> onLogs)
```

Creates a snapshot from a declarative `Image` with optional build log streaming.

**Parameters**:

- `name` _String_ - snapshot name
- `image` _Image_ - declarative image definition
- `onLogs` _Consumer\<String\>_ - callback for build log lines; `null` to skip streaming

**Returns**:

- `Snapshot` - created `Snapshot` in active or error state

**Throws**:

- `DaytonaException` - if the API request fails or the build fails

#### create()
```java
public Snapshot create(String name, Image image, io.daytona.sdk.model.Resources resources, Consumer<String> onLogs)
```

Creates a snapshot from a declarative `Image` with resources and optional build log streaming.

**Parameters**:

- `name` _String_ - snapshot name
- `image` _Image_ - declarative image definition
- `resources` _io.daytona.sdk.model.Resources_ - CPU/GPU/memory/disk resources; `null` for defaults
- `onLogs` _Consumer\<String\>_ - callback for build log lines; `null` to skip streaming

**Returns**:

- `Snapshot` - created `Snapshot` in active or error state

**Throws**:

- `DaytonaException` - if the API request fails or the build fails

#### create()
```java
public Snapshot create(String name, Image image, io.daytona.sdk.model.Resources resources, SandboxClass sandboxClass, Consumer<String> onLogs)
```

Creates a snapshot from a declarative `Image` with resources, sandbox class, and optional build log streaming.

**Parameters**:

- `name` _String_ - snapshot name
- `image` _Image_ - declarative image definition
- `resources` _io.daytona.sdk.model.Resources_ - CPU/GPU/memory/disk resources; `null` for defaults
- `sandboxClass` _SandboxClass_ - target sandbox class; `null` for default
- `onLogs` _Consumer\<String\>_ - callback for build log lines; `null` to skip streaming

**Returns**:

- `Snapshot` - created `Snapshot` in active or error state

**Throws**:

- `DaytonaException` - if the API request fails or the build fails

#### list()
```java
public PaginatedSnapshots list(Integer page, Integer limit)
```

Lists snapshots with pagination.
```java
try (Daytona daytona = new Daytona()) {
PaginatedSnapshots page = daytona.snapshot().list(2, 10);
System.out.printf("Page %d of %d (%d snapshots total)%n",
page.getPage(), page.getTotalPages(), page.getTotal());
for (var snapshot : page.getItems()) {
System.out.println(snapshot.getName() + " (" + snapshot.getImageName() + ")");
}
}
```

**Parameters**:

- `page` _Integer_ - page number starting from 1; defaults to 1 when `null`
- `limit` _Integer_ - maximum number of items per page; defaults to 10 when `null`

**Returns**:

- `PaginatedSnapshots` - paginated snapshot result

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if the API request fails

#### list()
```java
public PaginatedSnapshots list(Integer page, Integer limit, String sourceSandboxId)
```

Lists snapshots with pagination, optionally filtered by source sandbox.

**Parameters**:

- `page` _Integer_ - page number starting from 1; defaults to 1 when `null`
- `limit` _Integer_ - maximum number of items per page; defaults to 10 when `null`
- `sourceSandboxId` _String_ - filter by the ID of the sandbox the snapshot was created from; ignored when `null`

**Returns**:

- `PaginatedSnapshots` - paginated snapshot result

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if the API request fails

#### get()
```java
public Snapshot get(String nameOrId)
```

Retrieves a snapshot by name or ID.

**Parameters**:

- `nameOrId` _String_ - snapshot name or identifier

**Returns**:

- `Snapshot` - matching `Snapshot`

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if no snapshot is found or request fails

#### delete()
```java
public void delete(String nameOrId)
```

Deletes a snapshot by ID or name.

Snapshot names may themselves be UUID-formatted, so a UUID-shaped input is first
tried directly against the ID-only delete endpoint (1 call) and only resolved through
the ID-or-name `GET /snapshots` lookup on a 404. Non-UUID input is resolved first (2 calls);
a UUID-formatted name costs 3 calls in the worst case.

**Parameters**:

- `nameOrId` _String_ - snapshot identifier or name

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if deletion fails

#### delete()
```java
public void delete(Snapshot snapshot)
```

Deletes a snapshot using its already-known identifier.

Issues a single delete call — no resolution is performed.

**Parameters**:

- `snapshot` _Snapshot_ - snapshot to delete; its `Snapshot#getId() id` is used verbatim

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if deletion fails

#### activate()
```java
public Snapshot activate(String nameOrId)
```

Activates a snapshot by ID or name.

Snapshot names may themselves be UUID-formatted, so a UUID-shaped input is first
tried directly against the ID-only activate endpoint (1 call) and only resolved through
the ID-or-name `GET /snapshots` lookup on a 404. Non-UUID input is resolved first (2 calls);
a UUID-formatted name costs 3 calls in the worst case.

**Parameters**:

- `nameOrId` _String_ - snapshot identifier or name

**Returns**:

- `Snapshot` - the activated `Snapshot`

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if activation fails or no snapshot is found

#### activate()
```java
public Snapshot activate(Snapshot snapshot)
```

Activates a snapshot using its already-known identifier.

Issues a single activate call — no resolution is performed.

**Parameters**:

- `snapshot` _Snapshot_ - snapshot to activate; its `Snapshot#getId() id` is used verbatim

**Returns**:

- `Snapshot` - the activated `Snapshot`

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if activation fails

## See Also
- [Python SDK - snapshot](../python-sdk/sync/snapshot.md)
- [TypeScript SDK - snapshot](../typescript-sdk/snapshot.md)
