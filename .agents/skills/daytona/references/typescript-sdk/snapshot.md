## Contents

- SnapshotService
- ListSnapshotsQuery
- PaginatedSnapshots
- CreateSnapshotParams
- Snapshot
- See Also




## SnapshotService

Service for managing Daytona Snapshots. Can be used to list, get, create and delete Snapshots.

### Constructors

#### Constructor

```ts
new SnapshotService(
   clientConfig: Configuration,
   snapshotsApi: SnapshotsApi,
   objectStorageApi: ObjectStorageApi,
   defaultRegionId?: string
): SnapshotService;
```

**Parameters**:

- `clientConfig` _Configuration_
- `snapshotsApi` _SnapshotsApi_
- `objectStorageApi` _ObjectStorageApi_
- `defaultRegionId?` _string_


**Returns**:

- `SnapshotService`

### Methods

#### activate()

```ts
activate(snapshot: string | Snapshot): Promise<Snapshot>;
```

Activates a snapshot.

**Parameters**:

- `snapshot` _string \| Snapshot_ - Snapshot to activate, or its ID or name


**Returns**:

- `Promise<Snapshot>` - The activated Snapshot instance

#### create()

```ts
create(params: CreateSnapshotParams, options?: {
  onLogs?: (chunk: string) => void;
  timeout?: number;
}): Promise<Snapshot>;
```

Creates and registers a new snapshot from the given Image definition.

**Parameters**:

- `params` _CreateSnapshotParams_ - Parameters for snapshot creation.
- `options?` _Options for the create operation._
- `onLogs?` _\(chunk: string\) =\> void_ - This callback function handles snapshot creation logs.
- `timeout?` _number_ - Default is no timeout. Timeout in seconds (0 means no timeout).


**Returns**:

- `Promise<Snapshot>`

**Example:**

```ts
const image = Image.debianSlim('3.12').pipInstall('numpy');
await daytona.snapshot.create({ name: 'my-snapshot', image: image }, { onLogs: console.log });
```

#### delete()

```ts
delete(snapshot: string | Snapshot): Promise<void>;
```

Deletes a Snapshot.

**Parameters**:

- `snapshot` _string \| Snapshot_ - Snapshot to delete, or its ID or name


**Returns**:

- `Promise<void>`

**Throws**:

If the Snapshot does not exist or cannot be deleted

**Example:**

```ts
const daytona = new Daytona();
await daytona.snapshot.delete("snapshot-name");
console.log("Snapshot deleted successfully");
```

#### get()

```ts
get(idOrName: string): Promise<Snapshot>;
```

Gets a Snapshot by its ID or name.

**Parameters**:

- `idOrName` _string_ - ID or name of the Snapshot to retrieve


**Returns**:

- `Promise<Snapshot>` - The requested Snapshot

**Throws**:

If the Snapshot does not exist or cannot be accessed

**Example:**

```ts
const daytona = new Daytona();
const snapshot = await daytona.snapshot.get("snapshot-name");
console.log(`Snapshot ${snapshot.name} is in state ${snapshot.state}`);
```

#### list()

##### Call Signature

```ts
list(query?: ListSnapshotsQuery): Promise<PaginatedSnapshots>;
```

List paginated list of Snapshots.

**Parameters**:

- `query?` _ListSnapshotsQuery_ - Pagination and filter options

**Returns**:

- `Promise<PaginatedSnapshots>` - Paginated list of Snapshots

**Example:**

```ts
const daytona = new Daytona();
const { items, total, page: currentPage, totalPages } = await daytona.snapshot.list({ page: 2, limit: 10 });
console.log(`Page ${currentPage} of ${totalPages} (${total} snapshots total)`);
items.forEach(snapshot => console.log(`${snapshot.name} (${snapshot.imageName})`));
```

##### Call Signature

```ts
list(page?: number, limit?: number): Promise<PaginatedSnapshots>;
```

List paginated list of Snapshots.

**Parameters**:

- `page?` _number_ - Page number for pagination (starting from 1)
- `limit?` _number_ - Maximum number of items per page

**Returns**:

- `Promise<PaginatedSnapshots>` - Paginated list of Snapshots

###### Deprecated

Use `list(query)` with a ListSnapshotsQuery object instead.

***


## ListSnapshotsQuery

**Properties**:

- `limit?` _number_ - Maximum number of items per page
- `page?` _number_ - Page number for pagination (starting from 1)
- `sourceSandboxId?` _string_ - Filter by the ID of the sandbox the snapshot was created from
## PaginatedSnapshots

Represents a paginated list of Daytona Snapshots.

**Properties**:

- `items` _Snapshot\[\]_ - List of Snapshot instances in the current page.
- `page` _number_ - Current page number.
    - _Inherited from_: `PaginatedSnapshotsDto.page`
- `total` _number_ - Total number of Snapshots across all pages.
    - _Inherited from_: `PaginatedSnapshotsDto.total`
- `totalPages` _number_ - Total number of pages available.

    - _Inherited from_: `PaginatedSnapshotsDto.totalPages`


**Extends:**

- `Omit`\<`PaginatedSnapshotsDto`, `"items"`\>
## CreateSnapshotParams

```ts
type CreateSnapshotParams = {
  entrypoint?: string[];
  image: string | Image;
  name: string;
  regionId?: string;
  resources?: Resources;
  sandboxClass?: SandboxClass;
};
```

**Properties**:

- `entrypoint?` _string\[\]_ - Entrypoint of the snapshot.
- `image` _string \| Image_ - Image of the snapshot. If a string is provided, it should be available on some registry.
    If an Image instance is provided, it will be used to create a new image in Daytona.
- `name` _string_ - Name of the snapshot.
- `regionId?` _string_ - ID of the region where the snapshot will be available. Defaults to organization default region if not specified.
- `resources?` _Resources_ - Resources of the snapshot.
- `sandboxClass?` _SandboxClass_ - Target sandbox class. Determines which runners can host sandboxes created from this snapshot.



Parameters for creating a new snapshot.
## Snapshot

```ts
type Snapshot = SnapshotDto & {
  __brand: "Snapshot";
};
```

Represents a Daytona Snapshot which is a pre-configured sandbox.

### Type Declaration

#### \_\_brand

```ts
__brand: "Snapshot";
```

## See Also
- [Python SDK - snapshot](../python-sdk/sync/snapshot.md)
