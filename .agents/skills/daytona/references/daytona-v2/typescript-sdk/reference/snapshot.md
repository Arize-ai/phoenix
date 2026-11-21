# Snapshot (TypeScript SDK reference)

## Contents

- [Snapshot](#snapshot)
- [SnapshotsService](#snapshotsservice)
- [ListSnapshotsOptions](#listsnapshotsoptions)

## Snapshot

**Properties**:

- `id` _string_
- `name` _string_
- `sandboxClass` _SnapshotClass_
- `rawSandboxClass` _string_
- `kind` _SnapshotKind_
- `rawKind` _string_
- `availableIn` _readonly string\[\]_
- `region` _string_
- `status` _string_
- `error?` _string_
- `createdAt` _string_
- `updatedAt` _string_
- `bytes?` _number_
- `memoryBytes?` _number_
- `sandboxId?` _string_

### Constructors

#### Constructor

```ts
new Snapshot(token: Internal, init: never): Snapshot;
```

Built by the SDK: get it from the client or a sandbox.

**Parameters**:

- `token` _Internal_
- `init` _never_

**Returns**:

- `Snapshot`

***

## SnapshotsService

### Constructors

#### Constructor

```ts
new SnapshotsService(token: Internal, init: never): SnapshotsService;
```

Built by the SDK: get it from the client or a sandbox.

**Parameters**:

- `token` _Internal_
- `init` _never_

**Returns**:

- `SnapshotsService`

### Methods

#### delete()

```ts
delete(snapshotId: string): Promise<void>;
```

**Parameters**:

- `snapshotId` _string_

**Returns**:

- `Promise<void>`

#### get()

```ts
get(snapshotId: string, options: GetArtifactOptions = {}): Promise<Snapshot>;
```

Fetch a snapshot by ID or name. `'search'` cannot be looked up by name
(`GET /snapshots/search` is the search route): it throws a
`BadRequestError` before any request; read such a snapshot by its ID.

**Parameters**:

- `snapshotId` _string_
- `options` _GetArtifactOptions = \{\}_

**Returns**:

- `Promise<Snapshot>`

#### iter()

```ts
iter(options: ListSnapshotsOptions = {}): AsyncIterable<Snapshot>;
```

**Parameters**:

- `options` _ListSnapshotsOptions = \{\}_

**Returns**:

- `AsyncIterable<Snapshot>`

#### list()

```ts
list(options: ListSnapshotsOptions = {}): Promise<ListResult<Snapshot>>;
```

List snapshots, one page. Reads `GET /snapshots/search` (every region,
eventually consistent: a snapshot you just captured may be missing until
the index catches up; `get()` reads it at once) and, on a deployment without
search, `GET /snapshots`.

**Parameters**:

- `options` _ListSnapshotsOptions = \{\}_

**Returns**:

- `Promise<ListResult<Snapshot>>`

***

## ListSnapshotsOptions

**Properties**:

- `cursor?` _string_
- `limit?` _number_
- `name?` _string_
- `sandboxId?` _string_
