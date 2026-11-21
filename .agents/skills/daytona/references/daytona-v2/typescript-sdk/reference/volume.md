# Volume (TypeScript SDK reference)

## Contents

- [VolumesService](#volumesservice)
- [SandboxVolumesService](#sandboxvolumesservice)
- [PullVolumeOptions](#pullvolumeoptions)
- [PullVolumeResult](#pullvolumeresult)
- [ListVolumesOptions](#listvolumesoptions)
- [Volume](#volume)
- [GetVolumeOptions](#getvolumeoptions)
- [CreateVolumeOptions](#createvolumeoptions)
- [DeleteVolumeOptions](#deletevolumeoptions)
- [VolumeMount](#volumemount)
- [VolumeState](#volumestate)
- [VolumeType](#volumetype)
- [PullVolumeStatus](#pullvolumestatus)

## VolumesService

Manage named volumes and attach them with `create({ volumes })`.

### Constructors

#### Constructor

```ts
new VolumesService(token: Internal, init: never): VolumesService;
```

Built by the SDK: get it from the client or a sandbox.

**Parameters**:

- `token` _Internal_
- `init` _never_

**Returns**:

- `VolumesService`

### Methods

#### create()

```ts
create(options: CreateVolumeOptions): Promise<Volume>;
```

Creates a volume; without `type` the server chooses its type.

**Parameters**:

- `options` _CreateVolumeOptions_

**Returns**:

- `Promise<Volume>`

#### delete()

```ts
delete(nameOrId: string, options: DeleteVolumeOptions = {}): Promise<void>;
```

Requests deletion and returns once the API accepts it.

**Parameters**:

- `nameOrId` _string_
- `options` _DeleteVolumeOptions = \{\}_

**Returns**:

- `Promise<void>`

#### get()

```ts
get(nameOrId: string, options: GetVolumeOptions = {}): Promise<Volume>;
```

Get a volume by id or name; optionally create it when absent.

**Parameters**:

- `nameOrId` _string_
- `options` _GetVolumeOptions = \{\}_

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
new SandboxVolumesService(token: Internal, init: never): SandboxVolumesService;
```

Built by the SDK: get it from the client or a sandbox.

**Parameters**:

- `token` _Internal_
- `init` _never_

**Returns**:

- `SandboxVolumesService`

### Methods

#### pull()

```ts
pull(volumeId: string, options: PullVolumeOptions): Promise<PullVolumeResult>;
```

One submission/check only. Pending and errors never trigger automatic retries.
`volumeId` is the attached volume's `vol_` ID or its UUID.

**Parameters**:

- `volumeId` _string_
- `options` _PullVolumeOptions_

**Returns**:

- `Promise<PullVolumeResult>`

***

## PullVolumeOptions

**Properties**:

- `requestId` _string_ - Caller-owned identity. Retain it when checking pending work or retrying.
- `timeoutSeconds?` _number_ - Server wait in seconds (0–30); omitted means 30. Does not cancel work.
  Zero submits a new requestId, or returns a known one's last outcome without
  retrying it; a wait above zero retries pending, unavailable or rate-limited work.

***

## PullVolumeResult

**Properties**:

- `manifestId?` _string_
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
- `sizeGib?` _number_
- `status` _VolumeState_
- `rawStatus` _string_
- `error?` _string_
- `createdAt` _string_
- `updatedAt` _string_
- `lastUsedAt?` _string_
- `options?` _Readonly\<Record\<string, JsonValue\>\>_
- `usedBytes?` _number_
- `usedBytesAt?` _string_

***

## GetVolumeOptions

**Properties**:

- `create?` _boolean_
- `idOnly?` _boolean_

***

## CreateVolumeOptions

**Properties**:

- `name` _string_
- `sizeGib?` _number_ - Disk volumes only; omitted uses the server default.
- `type?` _Exclude\<VolumeType, 'unknown'\>_ - Omitted lets the server choose the volume's type.

***

## DeleteVolumeOptions

**Properties**:

- `idOnly?` _boolean_

***

## VolumeMount

**Properties**:

- `volumeId` _string_
- `mountPath` _string_ - An absolute path with no `..` component. The API normalizes it (repeated
  slashes, `.` components and a trailing slash are removed) and refuses `/`
  and any path on or beneath `/bin`, `/boot`, `/dev`, `/etc`, `/lib`,
  `/lib32`, `/lib64`, `/mnt/scratch`, `/overlay`, `/proc`, `/sbin`, `/sys`
  or `/usr`, or one with a control character: the create throws
  `BadRequestError` (400).
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
