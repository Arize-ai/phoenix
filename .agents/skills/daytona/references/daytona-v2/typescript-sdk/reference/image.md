# Image (TypeScript SDK reference)

## Contents

- [Image](#image)
- [ImageBuilder](#imagebuilder)
- [ImagesService](#imagesservice)
- [BuildFromContextOptions](#buildfromcontextoptions)
- [GetArtifactOptions](#getartifactoptions)
- [ImagePullOptions](#imagepulloptions)
- [ListImagesOptions](#listimagesoptions)
- [BuildContext](#buildcontext)
- [ArtifactRetention](#artifactretention)
- [ImageStatus](#imagestatus)
- [ImageOrigin](#imageorigin)
- [ImageSource](#imagesource)
- [ImageRef](#imageref)
- [BuildImageOptions](#buildimageoptions)
- [CaptureImageOptions](#captureimageoptions)
- [BuildLogGapReason](#buildloggapreason)
- [BuildLogDoneReason](#buildlogdonereason)
- [BuildLogEvent](#buildlogevent)
- [BuildLogFollowOptions](#buildlogfollowoptions)
- [BuildLogFollowResult](#buildlogfollowresult)
- [BuildLogInterruptedErrorOptions](#buildloginterruptederroroptions)

## Image

**Properties**:

- `id` _string_
- `name?` _string_
- `anonymous` _boolean_
- `availableIn` _readonly string\[\]_
- `bytes?` _number_
- `sandboxClass` _string_
- `createdAt` _string_
- `updatedAt` _string_
- `error?` _string_
- `expiresAt?` _string_
- `layerCount?` _number_
- `origin` _ImageOrigin_
- `region` _string_
- `retention` _ArtifactRetention_
- `rawRetention` _string_
- `source?` _ImageSource_
- `status` _ImageStatus_
- `formatVersion?` _number_
- `formatOutdated` _boolean_
- `platform` _boolean_
- `default` _boolean_
- `deprecated` _boolean_
- `diskMib?` _number_

### Constructors

#### Constructor

```ts
new Image(token: Internal, init: never): Image;
```

Built by the SDK: get it from the client or a sandbox.

**Parameters**:

- `token` _Internal_
- `init` _never_

**Returns**:

- `Image`

***

## ImageBuilder

### Methods

#### addLocalDir()

```ts
addLocalDir(localPath: string, remotePath: string): ImageBuilder;
```

**Parameters**:

- `localPath` _string_
- `remotePath` _string_

**Returns**:

- `ImageBuilder`

#### addLocalFile()

```ts
addLocalFile(localPath: string, remotePath: string): ImageBuilder;
```

**Parameters**:

- `localPath` _string_
- `remotePath` _string_

**Returns**:

- `ImageBuilder`

#### cmd()

```ts
cmd(...args: readonly string[]): ImageBuilder;
```

**Parameters**:

- `...args: readonly string[]`

**Returns**:

- `ImageBuilder`

#### debianSlim()

```ts
debianSlim(pythonVersion?: string): ImageBuilder;
```

**Parameters**:

- `pythonVersion?` _string_

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

#### pipInstallFromRequirements()

```ts
pipInstallFromRequirements(path: string): ImageBuilder;
```

**Parameters**:

- `path` _string_

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
new ImagesService(token: Internal, init: never): ImagesService;
```

Built by the SDK: get it from the client or a sandbox.

**Parameters**:

- `token` _Internal_
- `init` _never_

**Returns**:

- `ImagesService`

### Methods

#### build()

```ts
build(builder: ImageBuilder, options: BuildImageOptions = {}): Promise<Image>;
```

Submit a builder without waiting for the image to become ready.
Local files are archived and uploaded first, with the same timeouts as
`buildFromContext`. With local files, `name` and `idleExpirySeconds` cannot
be combined: idle expiry applies only to anonymous images.

**Parameters**:

- `builder` _ImageBuilder_
- `options` _BuildImageOptions = \{\}_

**Returns**:

- `Promise<Image>`

#### buildFromContext()

```ts
buildFromContext(
   context: BuildContext,
   options: BuildFromContextOptions = {}): Promise<Image>;
```

Build an image from a Dockerfile inside a build-context tar archive: its
bytes (an `ArrayBuffer` or any view), a `Blob`, or (Node.js) the path of a
`.tar` file or directory, up to 1 GiB.
Directories honour the Dockerfile-specific ignore file, else `.dockerignore`.
`dockerfile` is the Dockerfile's path inside it (default `Dockerfile`).
The archive is uploaded straight to storage in parts and verified by the
API before the build starts; an identical archive the project already
uploaded is reused without uploading it again. `name` and
`idleExpirySeconds` cannot be combined: idle expiry applies only to
anonymous images. `timeoutSeconds` bounds the build request after the
upload (see `BuildFromContextOptions`). Resolves once the build is
submitted; wait with `get(id, { wait: 'ready' })`.

**Parameters**:

- `context` _BuildContext_
- `options` _BuildFromContextOptions = \{\}_

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
get(imageId: string, options: GetArtifactOptions = {}): Promise<Image>;
```

Fetch an image by ID or name. `'search'` cannot be looked up by name
(`GET /images/search` is the search route): it throws a
`BadRequestError` before any request; read such an image by its ID.

**Parameters**:

- `imageId` _string_
- `options` _GetArtifactOptions = \{\}_

**Returns**:

- `Promise<Image>`

#### iter()

```ts
iter(options: ListImagesOptions = {}): AsyncIterable<Image>;
```

**Parameters**:

- `options` _ListImagesOptions = \{\}_

**Returns**:

- `AsyncIterable<Image>`

#### list()

```ts
list(options: ListImagesOptions = {}): Promise<ListResult<Image>>;
```

List images, one page. Reads `GET /images/search` (every region,
eventually consistent: an image you just created may be missing until
the index catches up; `get()` reads it at once) and, on a deployment without search,
`GET /images`.

**Parameters**:

- `options` _ListImagesOptions = \{\}_

**Returns**:

- `Promise<ListResult<Image>>`

#### promote()

```ts
promote(imageId: string, name: string): Promise<Image>;
```

Name an ANONYMOUS image, making it permanent (`PATCH /images/{id}`).
Promotion only: an image that already has a name answers 409 — renaming a
named image is not offered (sandboxes reference images by id, so a rename
would silently relabel every sandbox created from it). A name that already
exists throws `ImageNameTakenError`; a reserved prefix (`img_`, `snap_`,
`sbx_`, `vol_`, `fn_`) throws `ImageNameReservedError`.

**Parameters**:

- `imageId` _string_
- `name` _string_

**Returns**:

- `Promise<Image>`

#### pull()

```ts
pull(ref: string, options: ImagePullOptions = {}): Promise<Image>;
```

Import a registry image and wait until ready by default. Omitted or zero timeoutSeconds, or one above about 24.8 days, is unbounded.

**Parameters**:

- `ref` _string_
- `options` _ImagePullOptions = \{\}_

**Returns**:

- `Promise<Image>`

***

## BuildFromContextOptions

```ts
type BuildFromContextOptions = BuildImageOptions & {
  /** The Dockerfile's path inside the archive (default `Dockerfile`). */
  readonly dockerfile?: string
  /**
   * Bounds the build request that follows the upload, in seconds, replacing
   * the client's request timeout for it; `0`, or a value above about 24.8
   * days, is no limit. The upload keeps its own bounds.
   */
  readonly timeoutSeconds?: number
}
```

***

## GetArtifactOptions

**Properties**:

- `wait?` _'ready'_
- `timeoutSeconds?` _number_ - Total readiness budget in seconds. A positive budget repeats holds of at
  most 60 seconds, pausing up to one second after an early non-terminal
  response, until the artifact settles (`ready`, `failed` or `error`), which
  is returned for the caller to check; a budget above the timer maximum
  waits without a deadline. A budget that runs out first throws
  `RequestTimeoutError`. Omitted or zero sends one hold of the server's
  default length and returns what the server reports.

***

## ImagePullOptions

**Properties**:

- `name?` _string_ - Makes the image named and permanent. It may not start with a resource id
  prefix (`img_`, `snap_`, `sbx_`, `vol_`, `fn_`; `ImageNameReservedError`).
  A name that already exists for different content or import options throws
  `ImageNameTakenError` and changes nothing; an identical named import
  returns the existing image (a failed one is imported again).
- `idleExpirySeconds?` _number_ - Idle-retention window in seconds for an ANONYMOUS image: the image is
  deleted once this long has passed without a sandbox being created from it
  (every create restarts the clock). Only without `name`. Omitted ⇒ the
  server maximum.
- `region?` _string_ - The region, by create's rule: omitted, blank or `local` (any case, any
  surrounding whitespace) uses the project's default region and sends no
  `region_id`; any other value is sent as given and must be printable ASCII
  with no leading or trailing whitespace.
- `cpuArch?` _CpuArch_
- `wait?` _boolean_
- `timeoutSeconds?` _number_ - Total pull budget in seconds; omitted, zero or a value above about 24.8 days is unbounded.

***

## ListImagesOptions

**Properties**:

- `cursor?` _string_
- `limit?` _number_
- `name?` _string_
- `anonymous?` _boolean_
- `sandboxId?` _string_
- `platform?` _'true' \| 'false' \| 'any'_

***

## BuildContext

```ts
type BuildContext = Uint8Array | ArrayBuffer | ArrayBufferView | Blob | string
```

A build context: tar bytes (an `ArrayBuffer` or any view), a `Blob`, or (Node.js) a `.tar` file or directory path.

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
  | { readonly type: 'dockerfile'; readonly dockerfile: string }
  | { readonly type: 'named'; readonly name: string }
  | { readonly type: 'manifest'; readonly name: string }
  | { readonly type: 'unknown'; readonly rawType: string }
```

Where an image came from. `unknown` is a source kind this SDK release does
not know (a later API added it): `rawType` is the wire `source.type`, and the
source's other fields are not read. Handle it as "some other source" rather
than as an error.

***

## ImageRef

**Properties**:

- `id` _string_
- `name?` _string_

***

## BuildImageOptions

**Properties**:

- `name?` _string_ - Makes the image named and permanent. It may not start with a resource id
  prefix (`img_`, `snap_`, `sbx_`, `vol_`, `fn_`; `ImageNameReservedError`).
  A name that already exists for different content or import options throws
  `ImageNameTakenError` and changes nothing; an identical named import
  returns the existing image (a failed one is imported again).
- `idleExpirySeconds?` _number_ - Idle-retention window in seconds for an ANONYMOUS image: the image is
  deleted once this long has passed without a sandbox being created from it
  (every create restarts the clock). Only without `name`. Omitted ⇒ the
  server maximum.
- `region?` _string_ - The region, by create's rule: omitted, blank or `local` (any case, any
  surrounding whitespace) uses the project's default region and sends no
  `region_id`; any other value is sent as given and must be printable ASCII
  with no leading or trailing whitespace.
- `cpuArch?` _CpuArch_

***

## CaptureImageOptions

**Properties**:

- `name?` _string_ - Makes the image named and permanent; same rules as `BuildImageOptions.name`, and a name that already exists throws `ImageNameTakenError`.
- `idleExpirySeconds?` _number_ - Idle-retention window in seconds for an ANONYMOUS capture: deleted once
  this long has passed without a sandbox being created from it. Only without
  `name`. Same rule as `images.build`: omitted or `-1` ⇒ the server maximum
  (7 days by default); above it ⇒ 400. Promote the image to keep it.

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
  | { readonly type: 'state'; readonly status: string; readonly error?: string; readonly deadlineAt?: string }
  | { readonly type: 'log'; readonly dataBase64: string; readonly startOffset: string; readonly nextOffset: string; readonly cursor: string }
  | { readonly type: 'gap'; readonly reason: BuildLogGapReason; readonly rawReason: string; readonly requestedOffset: string; readonly firstAvailableOffset: string; readonly droppedBytes: string; readonly cursor: string }
  | { readonly type: 'unavailable'; readonly reason: string }
  | { readonly type: 'source_changed'; readonly reason: string }
  | { readonly type: 'done'; readonly result: BuildLogFollowResult }
  | { readonly type: 'error'; readonly error: string; readonly code: string; readonly retryable: boolean; readonly traceId?: string }
```

***

## BuildLogFollowOptions

**Properties**:

- `onLogs` _(chunk: string) =\> void \| Promise\<void\>_
- `onEvent?` _(event: BuildLogEvent) =\> void \| Promise\<void\>_
- `cursor?` _string_
- `timeoutSeconds?` _number_ - Total observation budget in seconds; zero, omitted or above about 24.8 days adds no deadline.
- `signal?` _AbortSignal_

***

## BuildLogFollowResult

**Properties**:

- `status` _string_
- `reason` _BuildLogDoneReason_
- `rawReason` _string_
- `cursor?` _string_
- `outputComplete` _boolean_

***

## BuildLogInterruptedErrorOptions

`BuildLogInterruptedError`'s options: the common ones plus the last delivered cursor.

**Properties**:

- `statusCode?` _number_
- `code?` _ErrorCode \| (string & \{\})_
- `source?` _string_
- `traceId?` _string_
- `retryAfterSeconds?` _number_ - `OVERLOADED` / `RATE_LIMITED`: how long to wait before retrying.
- `feature?` _string_ - `FEATURE_NOT_ENABLED`: the feature the organization lacks.
- `entitlement?` _string_ - `ENTITLEMENT_REQUIRED`: the entitlement the organization lacks.
- `replacement?` _string_ - `GONE`: what replaces the removed resource or route.
- `firstAvailableCursor?` _string_ - `CURSOR_EXPIRED`: the oldest cursor still available.
- `stated?` _string_ - `REGION_MISMATCH`: the region the request stated.
- `actual?` _string_ - `REGION_MISMATCH`: the region actually in effect.
- `region?` _string_ - `UNKNOWN_REGION`: the unrecognized region.
- `limit?` _string_ - `LIMIT_EXCEEDED`: machine name of the exhausted organization limit.
- `current?` _number_ - `LIMIT_EXCEEDED`: the organization's current count for that limit.
- `max?` _number_ - `LIMIT_EXCEEDED`, `IDLE_OUT_OF_RANGE`, `CREATE_TTL_OUT_OF_RANGE`: the maximum.
- `maxBytes?` _number_ - `IMAGE_TOO_LARGE` / `SNAPSHOT_TOO_LARGE`: the size limit in bytes.
- `bytes?` _number_ - `IMAGE_TOO_LARGE` / `SNAPSHOT_TOO_LARGE`: the artifact's size in bytes.
- `requestId?` _string_
- `retryAfterMs?` _number_
- `cause?` _unknown_ - The underlying failure, when there is one.
- `cursor?` _string_
