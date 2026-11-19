# Volume (TypeScript SDK reference)

## Contents

- [VolumeService](#volumeservice)
- [SandboxVolumesService](#sandboxvolumesservice)
- [PullVolumeOptions](#pullvolumeoptions)
- [PullVolumeResult](#pullvolumeresult)
- [ListVolumesOptions](#listvolumesoptions)
- [Volume](#volume)
- [VolumeRefOptions](#volumerefoptions)
- [VolumeMount](#volumemount)
- [VolumeState](#volumestate)
- [VolumeType](#volumetype)
- [PullVolumeStatus](#pullvolumestatus)

## VolumeService

Manage named volumes and attach them with `create({ volumes })`.

### Constructors

#### Constructor

```ts
new VolumeService(api: AxiosInstance): VolumeService;
```

**Parameters**:

- `api` _AxiosInstance_

**Returns**:

- `VolumeService`

### Methods

#### create()

```ts
create(name: string, sizeGib?: number): Promise<Volume>;
```

Creates a disk volume (ready immediately).

**Parameters**:

- `name` _string_
- `sizeGib?` _number_

**Returns**:

- `Promise<Volume>`

#### delete()

```ts
delete(volume: Volume | string, options?: VolumeRefOptions): Promise<void>;
```

Requests deletion and returns once the API accepts it.

**Parameters**:

- `volume` _Volume \| string_
- `options?` _VolumeRefOptions_

**Returns**:

- `Promise<void>`

#### get()

```ts
get(nameOrId: string, create = false, options?: VolumeRefOptions): Promise<Volume>;
```

Get a volume by id or name; optionally create it when absent.

**Parameters**:

- `nameOrId` _string_
- `create` _boolean = false_
- `options?` _VolumeRefOptions_

**Returns**:

- `Promise<Volume>`

#### iter()

```ts
iter(options: ListVolumesOptions = {}): AsyncIterable<Volume>;
```

**Parameters**:

- `options` _ListVolumesOptions = \{\}_

**Returns**:

- `AsyncIterable<Volume>`

#### list()

```ts
list(options: ListVolumesOptions = {}): Promise<ListResult<Volume>>;
```

**Parameters**:

- `options` _ListVolumesOptions = \{\}_

**Returns**:

- `Promise<ListResult<Volume>>`

***

## SandboxVolumesService

Pull attached volumes in this sandbox; distinct from the platform volume service.

### Constructors

#### Constructor

```ts
new SandboxVolumesService(transport: HttpTransport): SandboxVolumesService;
```

**Parameters**:

- `transport` _HttpTransport_

**Returns**:

- `SandboxVolumesService`

### Methods

#### pull()

```ts
pull(volumeId: string, options: PullVolumeOptions): Promise<PullVolumeResult>;
```

One submission/check only. Pending and errors never trigger automatic retries.

**Parameters**:

- `volumeId` _string_
- `options` _PullVolumeOptions_

**Returns**:

- `Promise<PullVolumeResult>`

***

## PullVolumeOptions

**Properties**:

- `requestId` _string_ - Caller-owned identity. Retain it when checking pending work or retrying.
- `timeout?` _number_ - Server wait in milliseconds (0–30000); omitted means 30000. Does not cancel work.
  Zero submits a new requestId, or returns a known one's last outcome without
  retrying it; a wait above zero retries pending, unavailable or rate-limited work.

***

## PullVolumeResult

**Properties**:

- `manifestId` _string \| null_
- `requestId` _string_
- `status` _PullVolumeStatus_
- `rawStatus` _string_

***

## ListVolumesOptions

**Properties**:

- `cursor?` _string_
- `limit?` _number_

***

## Volume

A volume that preserves files between sandboxes.

**Properties**:

- `id` _string_
- `name` _string_
- `type` _VolumeType_
- `rawType` _string_
- `sizeGib?` _number \| null_
- `status` _VolumeState_
- `rawStatus` _string_
- `error?` _string \| null_
- `createdAt` _string_
- `updatedAt` _string_
- `lastUsedAt?` _string \| null_
- `options?` _Readonly\<Record\<string, never\>\>_
- `usedBytes?` _number \| null_
- `usedBytesAt?` _string \| null_

***

## VolumeRefOptions

**Properties**:

- `idOnly?` _boolean_

***

## VolumeMount

**Properties**:

- `volumeId` _string_
- `mountPath` _string_
- `subpath?` _string_
- `readOnly?` _boolean_ - Mount without write access. Only bucket volumes support `true`.

***

## VolumeState

```ts
type VolumeState = (typeof API_VOLUME_STATUSES)[number] | 'unknown'
```

***

## VolumeType

```ts
type VolumeType = (typeof API_VOLUME_TYPES)[number] | 'unknown'
```

***

## PullVolumeStatus

```ts
type PullVolumeStatus = 'pulled' | 'unchanged' | 'pending' | 'unknown'
```
