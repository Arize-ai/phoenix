# Image (TypeScript SDK reference)

## Contents

- [Image](#image)
- [ImageBuilder](#imagebuilder)
- [ImagesService](#imagesservice)
- [ArtifactClass](#artifactclass)
- [ArtifactRetention](#artifactretention)
- [ImageStatus](#imagestatus)
- [ImageOrigin](#imageorigin)
- [ImageSource](#imagesource)
- [ImageRef](#imageref)
- [BuildImageOptions](#buildimageoptions)
- [CaptureImageOptions](#captureimageoptions)
- [ImageDto](#imagedto)
- [BuildLogGapReason](#buildloggapreason)
- [BuildLogDoneReason](#buildlogdonereason)
- [BuildLogEvent](#buildlogevent)
- [BuildLogFollowOptions](#buildlogfollowoptions)
- [BuildLogFollowResult](#buildlogfollowresult)

## Image

**Properties**:

- `id` _string_
- `name` _string \| null_
- `anonymous` _boolean_
- `availableIn` _string\[\]_
- `bytes?` _number \| null_
- `class` _ArtifactClass_
- `createdAt` _string_
- `updatedAt` _string_
- `error?` _string \| null_
- `expiresAt?` _string \| null_
- `layer_count?` _number \| null_
- `origin` _ImageOrigin_
- `region` _string_
- `retention` _ArtifactRetention_
- `rawRetention` _string_
- `source?` _ImageSource \| null_
- `status` _ImageStatus_
- `formatVersion?` _number_
- `formatOutdated` _boolean_
- `platform` _boolean_
- `default` _boolean_
- `deprecated` _boolean_
- `diskMib` _number \| null_

### Constructors

#### Constructor

```ts
new Image(image: api.ImageListItem): Image;
```

**Parameters**:

- `image` _api.ImageListItem_

**Returns**:

- `Image`

***

## ImageBuilder

### Methods

#### cmd()

```ts
cmd(...args: readonly string[]): ImageBuilder;
```

**Parameters**:

- `...args: readonly string[]`

**Returns**:

- `ImageBuilder`

#### entrypoint()

```ts
entrypoint(...args: readonly string[]): ImageBuilder;
```

**Parameters**:

- `...args: readonly string[]`

**Returns**:

- `ImageBuilder`

#### env()

```ts
env(name: string, value: string): ImageBuilder;
```

**Parameters**:

- `name` _string_
- `value` _string_

**Returns**:

- `ImageBuilder`

#### env()

```ts
env(values: Record<string, string>): ImageBuilder;
```

**Parameters**:

- `values` _Record\<string, string\>_

**Returns**:

- `ImageBuilder`

#### fromDockerfile()

```ts
fromDockerfile(dockerfile: string): ImageBuilder;
```

**Parameters**:

- `dockerfile` _string_

**Returns**:

- `ImageBuilder`

#### fromRegistry()

```ts
fromRegistry(ref: string): ImageBuilder;
```

**Parameters**:

- `ref` _string_

**Returns**:

- `ImageBuilder`

#### pipInstall()

```ts
pipInstall(...packages: readonly string[]): ImageBuilder;
```

**Parameters**:

- `...packages: readonly string[]`

**Returns**:

- `ImageBuilder`

#### runCommands()

```ts
runCommands(...commands: readonly string[]): ImageBuilder;
```

**Parameters**:

- `...commands: readonly string[]`

**Returns**:

- `ImageBuilder`

#### toDockerfile()

```ts
toDockerfile(): string;
```

**Returns**:

- `string`

#### toRequestSource()

```ts
toRequestSource(): { source: NonNullable<api.CreateImageRequest["source"]> } | { dockerfile: string };
```

The `POST /images` source this builder describes (parity with Python's
`ImageBuilder.build_request_source`): a bare registry ref with no steps
is a registry import (`source: {type: 'registry', ref}`) rather than a
Dockerfile build. This avoids an unnecessary build for a plain ref.

**Returns**:

- `{ source: NonNullable<api.CreateImageRequest["source"]> } | { dockerfile: string }`

#### user()

```ts
user(name: string): ImageBuilder;
```

**Parameters**:

- `name` _string_

**Returns**:

- `ImageBuilder`

#### workdir()

```ts
workdir(path: string): ImageBuilder;
```

**Parameters**:

- `path` _string_

**Returns**:

- `ImageBuilder`

***

## ImagesService

### Constructors

#### Constructor

```ts
new ImagesService(
   http: AxiosInstance,
   apiTransport?: HttpTransport | HttpTransportConfig): ImagesService;
```

**Parameters**:

- `http` _AxiosInstance_
- `apiTransport?` _HttpTransport \| HttpTransportConfig_

**Returns**:

- `ImagesService`

### Methods

#### build()

```ts
build(builder: ImageBuilder, options: BuildImageOptions = {}): Promise<Image>;
```

**Parameters**:

- `builder` _ImageBuilder_
- `options` _BuildImageOptions = \{\}_

**Returns**:

- `Promise<Image>`

#### delete()

```ts
delete(imageId: string): Promise<void>;
```

**Parameters**:

- `imageId` _string_

**Returns**:

- `Promise<void>`

#### followBuildLogs()

```ts
followBuildLogs(
   imageId: string,
   options: BuildLogFollowOptions): Promise<BuildLogFollowResult>;
```

**Parameters**:

- `imageId` _string_
- `options` _BuildLogFollowOptions_

**Returns**:

- `Promise<BuildLogFollowResult>`

#### get()

```ts
get(
   imageId: string,
   options: { wait?: 'ready'; timeout?: number } = {}): Promise<Image>;
```

**Parameters**:

- `imageId` _string_
- `options` _\{ wait?: 'ready'; timeout?: number \} = \{\}_

**Returns**:

- `Promise<Image>`

#### iter()

```ts
iter(
   options: { cursor?: string; limit?: number; name?: string; anonymous?: boolean; sandboxId?: string; platform?: 'true' | 'false' | 'any' } = {}): AsyncIterable<Image>;
```

**Parameters**:

- `options` _\{ cursor?: string; limit?: number; name?: string; anonymous?: boolean; sandboxId?: string; platform?: 'true' \| 'false' \| 'any' \} = \{\}_

**Returns**:

- `AsyncIterable<Image>`

#### list()

```ts
list(
   options: { cursor?: string; limit?: number; name?: string; anonymous?: boolean; sandboxId?: string; platform?: 'true' | 'false' | 'any' } = {}): Promise<ListResult<Image>>;
```

**Parameters**:

- `options` _\{ cursor?: string; limit?: number; name?: string; anonymous?: boolean; sandboxId?: string; platform?: 'true' \| 'false' \| 'any' \} = \{\}_

**Returns**:

- `Promise<ListResult<Image>>`

#### promote()

```ts
promote(imageId: string, name: string): Promise<Image>;
```

Name an ANONYMOUS image, making it permanent (`PATCH /images/{id}`).
Promotion only: an image that already has a name answers 409 — renaming a
named image is not offered (sandboxes reference images by id, so a rename
would silently relabel every sandbox created from it).

**Parameters**:

- `imageId` _string_
- `name` _string_

**Returns**:

- `Promise<Image>`

#### pull()

```ts
pull(
   ref: string,
   options: BuildImageOptions & { readonly wait?: boolean; readonly timeout?: number } = {}): Promise<Image>;
```

Import a registry image and wait until ready by default. Timeout is in milliseconds; omitted or zero is unbounded.

**Parameters**:

- `ref` _string_
- `options` _BuildImageOptions & \{ readonly wait?: boolean; readonly timeout?: number \} = \{\}_

**Returns**:

- `Promise<Image>`

***

## ArtifactClass

```ts
type ArtifactClass = 'linux' | (string & {})
```

***

## ArtifactRetention

```ts
type ArtifactRetention = (typeof API_IMAGE_RETENTIONS)[number] | 'unknown'
```

***

## ImageStatus

```ts
type ImageStatus = 'pending' | 'building' | 'ready' | 'failed' | (string & {})
```

***

## ImageOrigin

```ts
type ImageOrigin = 'registry' | 'dockerfile' | 'capture' | (string & {})
```

***

## ImageSource

```ts
type ImageSource =
  | { readonly type: 'registry'; readonly ref: string }
  | { readonly type: 'dockerfile'; readonly contextObject: string; readonly dockerfile: string }
  | { readonly type: 'named'; readonly name: string }
  | { readonly type: 'manifest'; readonly name: string }
```

***

## ImageRef

**Properties**:

- `id` _string_
- `name` _string \| null_

***

## BuildImageOptions

**Properties**:

- `name?` _string_
- `idleExpirySeconds?` _number_ - Idle-retention window in seconds for an ANONYMOUS image: the image is
  deleted once this long has passed without a sandbox being created from it
  (every create restarts the clock). Only without `name`. Omitted ⇒ the
  server maximum.
- `region?` _string_
- `cpuArch?` _CpuArch_

***

## CaptureImageOptions

**Properties**:

- `name?` _string_
- `idleExpirySeconds?` _number_ - Idle-retention window in seconds for an ANONYMOUS capture: deleted once
  this long has passed without a sandbox being created from it. Only without
  `name`. Same rule as `images.build`: omitted or `-1` ⇒ the server maximum
  (7 days by default); above it ⇒ 400. Promote the image to keep it.

***

## ImageDto

**Properties**:

- `id` _string_
- `name` _string \| null_
- `anonymous` _boolean_
- `availableIn` _string\[\]_
- `bytes?` _number \| null_
- `class` _ArtifactClass_
- `createdAt` _string_
- `updatedAt` _string_
- `error?` _string \| null_
- `expiresAt?` _string \| null_
- `origin` _ImageOrigin_
- `region` _string_
- `retention` _ArtifactRetention_
- `rawRetention` _string_
- `source?` _ImageSource \| null_
- `status` _ImageStatus_
- `layer_count?` _number \| null_
- `formatVersion?` _number_ - The image's format generation, as reported by the API. Undefined when
  the API omits this field.
- `formatOutdated` _boolean_ - `formatVersion` is below the current one: the image converts on its first
  Linux sandbox create, or ahead of time with `POST /images/{id}/convert`;
  other operations refuse it with `IMAGE_FORMAT_OUTDATED` until then.
- `platform` _boolean_ - A platform image: published by Daytona and visible to every project.
- `default` _boolean_ - The platform default for its class: the image an imageless `create()` boots.
- `deprecated` _boolean_ - A deprecated platform image: it still boots and resolves by id, but
  `images.list({ platform: 'true' })` no longer lists it.
- `diskMib` _number \| null_ - The disk size in MiB that a sandbox created from this image gets when the
  create omits `disk_mib`. Set for macOS snapshots; null for every other
  image when a disk size is not reported.

***

## BuildLogGapReason

```ts
type BuildLogGapReason = 'truncated' | 'unknown'
```

***

## BuildLogDoneReason

```ts
type BuildLogDoneReason = 'terminal' | 'deadline' | 'not_applicable' | 'resource_deleted' | 'unknown'
```

***

## BuildLogEvent

```ts
type BuildLogEvent =
  | { type: 'state'; status: string; error?: string; deadlineAt?: string }
  | { type: 'log'; dataBase64: string; startOffset: string; nextOffset: string; cursor: string }
  | { type: 'gap'; reason: BuildLogGapReason; rawReason: string; requestedOffset: string; firstAvailableOffset: string; droppedBytes: string; cursor: string }
  | { type: 'unavailable'; reason: string }
  | { type: 'source_changed'; reason: string }
  | { type: 'done'; result: BuildLogFollowResult }
  | { type: 'error'; error: string; code: string; retryable: boolean; traceId?: string }
```

***

## BuildLogFollowOptions

**Properties**:

- `onLogs` _(chunk: string) =\> void \| Promise\<void\>_
- `onEvent?` _(event: BuildLogEvent) =\> void \| Promise\<void\>_
- `cursor?` _string_
- `timeout?` _number_ - Total observation budget in milliseconds; zero/omitted adds no deadline.
- `signal?` _AbortSignal_

***

## BuildLogFollowResult

**Properties**:

- `status` _string_
- `reason` _BuildLogDoneReason_
- `rawReason` _string_
- `cursor?` _string_
- `outputComplete` _boolean_
