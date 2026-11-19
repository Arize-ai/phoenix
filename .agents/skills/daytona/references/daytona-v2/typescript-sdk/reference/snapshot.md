# Snapshot (TypeScript SDK reference)

## Snapshot

**Properties**:

- `id` _string_
- `name` _string_
- `class` _ArtifactClass_
- `kind` _SnapshotKind_
- `rawKind` _string_
- `availableIn` _string\[\]_
- `region` _string_
- `status` _string_
- `error?` _string \| null_
- `createdAt` _string_
- `updatedAt` _string_
- `memoryBytes?` _number_
- `sandboxId?` _string_

### Constructors

#### Constructor

```ts
new Snapshot(snapshot: api.Snapshot): Snapshot;
```

**Parameters**:

- `snapshot` _api.Snapshot_

**Returns**:

- `Snapshot`

***

## SnapshotsService

### Constructors

#### Constructor

```ts
new SnapshotsService(http: AxiosInstance): SnapshotsService;
```

**Parameters**:

- `http` _AxiosInstance_

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
get(
   snapshotId: string,
   options: { wait?: 'ready'; timeout?: number } = {}): Promise<Snapshot>;
```

**Parameters**:

- `snapshotId` _string_
- `options` _\{ wait?: 'ready'; timeout?: number \} = \{\}_

**Returns**:

- `Promise<Snapshot>`

#### iter()

```ts
iter(
   options: { cursor?: string; limit?: number; name?: string; sandboxId?: string } = {}): AsyncIterable<Snapshot>;
```

**Parameters**:

- `options` _\{ cursor?: string; limit?: number; name?: string; sandboxId?: string \} = \{\}_

**Returns**:

- `AsyncIterable<Snapshot>`

#### list()

```ts
list(
   options: { cursor?: string; limit?: number; name?: string; sandboxId?: string } = {}): Promise<ListResult<Snapshot>>;
```

**Parameters**:

- `options` _\{ cursor?: string; limit?: number; name?: string; sandboxId?: string \} = \{\}_

**Returns**:

- `Promise<ListResult<Snapshot>>`
