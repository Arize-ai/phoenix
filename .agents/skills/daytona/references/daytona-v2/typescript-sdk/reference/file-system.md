# FileSystem (TypeScript SDK reference)

## Contents

- [FileSystemService](#filesystemservice)
- [FilesystemEventType](#filesystemeventtype)
- [DownloadFileOptions](#downloadfileoptions)
- [FilesystemEvent](#filesystemevent)
- [ListFilesOptions](#listfilesoptions)
- [MkdirOptions](#mkdiroptions)
- [PresignedUrlOptions](#presignedurloptions)
- [ReadFileOptions](#readfileoptions)
- [ReadManyOptions](#readmanyoptions)
- [RemoveOptions](#removeoptions)
- [TransferProgressCallback](#transferprogresscallback)
- [UploadFileOptions](#uploadfileoptions)
- [WatchDirOptions](#watchdiroptions)
- [WatchHandle](#watchhandle)
- [WriteFileOptions](#writefileoptions)
- [WriteManyOptions](#writemanyoptions)
- [FileSearchResult](#filesearchresult)
- [SearchResult](#searchresult)
- [SearchSandboxesOptions](#searchsandboxesoptions)
- [SearchSort](#searchsort)
- [SearchOrder](#searchorder)
- [SearchTimestamp](#searchtimestamp)
- [SearchTotalRelation](#searchtotalrelation)
- [FileInfo](#fileinfo)
- [FileMatch](#filematch)
- [ReplaceResult](#replaceresult)
- [FilePermissionsOptions](#filepermissionsoptions)
- [BulkWriteFile](#bulkwritefile)
- [BulkWriteResult](#bulkwriteresult)
- [BulkReadError](#bulkreaderror)
- [BulkReadResult](#bulkreadresult)
- [SIGNED\_FILE\_MAX\_TTL\_SECONDS](#signedfilemaxttlseconds)

## FileSystemService

Sandbox filesystem namespace (`sandbox.fs`). All sandbox paths must be
absolute strings starting with `/`; relative paths throw `BadRequestError`.
Local upload/download paths are exempt.

### Constructors

#### Constructor

```ts
new FileSystemService(token: Internal, ...init: never[]): FileSystemService;
```

Built by the SDK: get it from `sandbox.fs`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `FileSystemService`

### Methods

#### chmod()

```ts
chmod(path: string, permissions: FilePermissionsOptions): Promise<void>;
```

Set file permissions and ownership.

**Parameters**:

- `path` _string_
- `permissions` _FilePermissionsOptions_

**Returns**:

- `Promise<void>`

#### downloadFile()

```ts
downloadFile(
   remotePath: string,
   localPath: string,
   options: DownloadFileOptions = {}): Promise<void>;
```

Stream a sandbox file to disk via an exclusive random temp file in the destination directory, renaming on success. Progress callback errors are swallowed. Node.js only.

**Parameters**:

- `remotePath` _string_
- `localPath` _string_
- `options` _DownloadFileOptions = \{\}_

**Returns**:

- `Promise<void>`

#### glob()

```ts
glob(path: string, pattern: string): Promise<FileSearchResult<string>>;
```

Return the paths of files under `path` whose base name matches the glob
`pattern`. Directories below `path` that the sandbox user cannot read are
not searched; `skipped` lists their absolute paths (at most 1000). Only an
unreadable `path` itself throws `FileAccessDeniedError`.

**Parameters**:

- `path` _string_
- `pattern` _string_

**Returns**:

- `Promise<FileSearchResult<string>>`

#### grep()

```ts
grep(path: string, pattern: string): Promise<FileSearchResult<FileMatch>>;
```

Search file contents under `path` for the literal substring `pattern`;
returns matches with one-based line numbers, as the sandbox user sees
them. Directories and files below `path` that the sandbox user cannot read
are not searched; `skipped` lists their absolute paths (at most 1000). Only
an unreadable `path` itself throws `FileAccessDeniedError`.

**Parameters**:

- `path` _string_
- `pattern` _string_

**Returns**:

- `Promise<FileSearchResult<FileMatch>>`

#### list()

```ts
list(path: string, options: ListFilesOptions = {}): Promise<ListResult<FileInfo>>;
```

List a directory: one page of `{ items, nextCursor }`.

**Parameters**:

- `path` _string_
- `options` _ListFilesOptions = \{\}_

**Returns**:

- `Promise<ListResult<FileInfo>>`

#### mkdir()

```ts
mkdir(path: string, options: MkdirOptions = {}): Promise<void>;
```

**Parameters**:

- `path` _string_
- `options` _MkdirOptions = \{\}_

**Returns**:

- `Promise<void>`

#### move()

```ts
move(source: string, destination: string): Promise<void>;
```

**Parameters**:

- `source` _string_
- `destination` _string_

**Returns**:

- `Promise<void>`

#### presignedDownloadUrl()

```ts
presignedDownloadUrl(path: string, options: PresignedUrlOptions = {}): Promise<string>;
```

Pre-signed download URL for a sandbox file. The signature is minted by the
API; `expiresInSeconds` must be between 1 and
`SIGNED_FILE_MAX_TTL_SECONDS` (7 days).

**Parameters**:

- `path` _string_
- `options` _PresignedUrlOptions = \{\}_

**Returns**:

- `Promise<string>`

#### presignedUploadUrl()

```ts
presignedUploadUrl(path: string, options: PresignedUrlOptions = {}): Promise<string>;
```

Pre-signed upload URL for a sandbox file. The signature is minted by the
API; `expiresInSeconds` must be between 1 and
`SIGNED_FILE_MAX_TTL_SECONDS` (7 days).

**Parameters**:

- `path` _string_
- `options` _PresignedUrlOptions = \{\}_

**Returns**:

- `Promise<string>`

#### readBytes()

```ts
readBytes(path: string, options?: ReadFileOptions): Promise<Uint8Array>;
```

Read a file as bytes, holding the whole file in memory. A file transfer:
no total deadline, but it fails with `ClientTimeoutError` once no bytes
move for the request timeout (a request timeout of `0` leaves it
unbounded). The body is capped by the client's `maxResponseBytes` or this
call's (see `ReadFileOptions`). For large files, or content from a
sandbox you do not trust, use `downloadFile()`, which streams to disk with
progress and cancellation; it is Node.js-only, so in a browser the
in-memory reads and `presignedDownloadUrl()` are the options.

**Parameters**:

- `path` _string_
- `options?` _ReadFileOptions_

**Returns**:

- `Promise<Uint8Array>`

#### readMany()

```ts
readMany(paths: readonly string[], options?: ReadManyOptions): Promise<BulkReadResult>;
```

Read several files in one multipart response; a missing file is an entry
in `errors`, not a failure. The whole response is held in memory, with the
bounds of `readBytes`; `maxResponseBytes` caps the whole multipart
body. For large files, or content from a sandbox you do not trust, use
`downloadFile()`, which streams to disk with progress and cancellation;
it is Node.js-only, so in a browser the in-memory reads and
`presignedDownloadUrl()` are the options.

**Parameters**:

- `paths` _readonly string\[\]_
- `options?` _ReadManyOptions_

**Returns**:

- `Promise<BulkReadResult>`

#### readText()

```ts
readText(path: string, options?: ReadFileOptions): Promise<string>;
```

Read a UTF-8 text file into memory, with the bounds of `readBytes`.
Decoding is strict (invalid UTF-8 throws a `TypeError`) and a leading
byte-order mark is kept as `\uFEFF`.

**Parameters**:

- `path` _string_
- `options?` _ReadFileOptions_

**Returns**:

- `Promise<string>`

#### remove()

```ts
remove(path: string, options: RemoveOptions = {}): Promise<void>;
```

**Parameters**:

- `path` _string_
- `options` _RemoveOptions = \{\}_

**Returns**:

- `Promise<void>`

#### replace()

```ts
replace(
   files: readonly string[],
   pattern: string,
   newValue: string): Promise<ListResult<ReplaceResult>>;
```

Replace the literal substring `pattern` with `newValue` in `files`.

**Parameters**:

- `files` _readonly string\[\]_
- `pattern` _string_
- `newValue` _string_

**Returns**:

- `Promise<ListResult<ReplaceResult>>`

#### stat()

```ts
stat(path: string): Promise<FileInfo>;
```

Return file metadata.

**Parameters**:

- `path` _string_

**Returns**:

- `Promise<FileInfo>`

#### uploadFile()

```ts
uploadFile(
   localPath: string,
   remotePath: string,
   options: UploadFileOptions = {}): Promise<void>;
```

Stream a local file to the sandbox without buffering the full body in memory. Progress callback errors are swallowed. Node.js only.

**Parameters**:

- `localPath` _string_
- `remotePath` _string_
- `options` _UploadFileOptions = \{\}_

**Returns**:

- `Promise<void>`

#### watchDir()

```ts
watchDir(
   path: string,
   onEvent: (event: FilesystemEvent) => void | Promise<void>,
   options: WatchDirOptions = {}): Promise<WatchHandle>;
```

Watch `path` for changes, calling `onEvent` for each one. Resolves once
the watch is established. Callbacks run one at a time, in order, and are
awaited; a failing `onEvent` or `onOverflow` ends the watch with that
error. `onExit` runs once when the watch ends; its own failure is ignored.
A failure before the watch starts rejects this call and does not call
`onExit`. Callbacks are held until this call has returned its handle, so
after a direct `await watchDir(...)` a callback can call `stop()` on it;
when the promise is not awaited directly (inside `Promise.all`, or awaited
later), signal the code that holds the handle and call `stop()` there. A
stream that sends more than 4096 events, or more than 1 MiB, before
`start` rejects this call with `BadRequestError`. After `start` an event
larger than the client's `maxResponseBytes` ends the watch with
`PayloadTooLargeError`.

**Parameters**:

- `path` _string_
- `onEvent` _(event: FilesystemEvent) = \> void \| Promise\<void\>, options: WatchDirOptions = \{\}_

**Returns**:

- `Promise<WatchHandle>`

#### writeBytes()

```ts
writeBytes(
   path: string,
   data: Uint8Array | ArrayBuffer | ArrayBufferView,
   options: WriteFileOptions = {}): Promise<void>;
```

Write a buffer or view's exact bytes to an absolute path, optionally atomically.

**Parameters**:

- `path` _string_
- `data` _Uint8Array \| ArrayBuffer \| ArrayBufferView_
- `options` _WriteFileOptions = \{\}_

**Returns**:

- `Promise<void>`

#### writeMany()

```ts
writeMany(
   files: Readonly<Record<string, Uint8Array | ArrayBuffer | ArrayBufferView>>,
   options: WriteManyOptions = {}): Promise<BulkWriteResult>;
```

Write absolute paths mapped to buffers or views in one request.

**Parameters**:

- `files` _Readonly\<Record\<string, Uint8Array \| ArrayBuffer \| ArrayBufferView\>\>_
- `options` _WriteManyOptions = \{\}_

**Returns**:

- `Promise<BulkWriteResult>`

#### writeText()

```ts
writeText(path: string, text: string, options: WriteFileOptions = {}): Promise<void>;
```

Write a UTF-8 text file.

**Parameters**:

- `path` _string_
- `text` _string_
- `options` _WriteFileOptions = \{\}_

**Returns**:

- `Promise<void>`

***

## FilesystemEventType

```ts
type FilesystemEventType = 'create' | 'write' | 'remove' | 'rename' | 'chmod' | (string & {})
```

What changed in a watched directory. An open vocabulary: a kind a later
sandbox reports is passed through as its string.

***

## DownloadFileOptions

**Properties**:

- `onProgress?` _TransferProgressCallback_
- `signal?` _AbortSignal_

***

## FilesystemEvent

**Properties**:

- `type` _FilesystemEventType_
- `name` _string_
- `isDir` _boolean_
- `timestampMs` _number_ - When the change happened, in Unix milliseconds.

***

## ListFilesOptions

**Properties**:

- `depth?` _number_ - How many directory levels to list; the sandbox default is 1.

***

## MkdirOptions

**Properties**:

- `mode?` _string_ - Octal permission bits; default `'0755'`.

***

## PresignedUrlOptions

**Properties**:

- `expiresInSeconds?` _number_ - Whole seconds, 1 to `SIGNED_FILE_MAX_TTL_SECONDS`; default 3600.

***

## ReadFileOptions

Options of the in-memory file reads (`readBytes`, `readText`).

`maxResponseBytes` replaces the client's cap on the response body for this
call (`undefined` or `null` keep the client's cap, `0` means no limit, and any other value (negative, fractional, boolean, string, above `Number.MAX_SAFE_INTEGER`) is a `BadRequestError`).
A body over it is refused with `PayloadTooLargeError` before it is read in
full. For large files, or content from a sandbox you don't trust, use
`downloadFile()` (Node.js), which streams to disk.

**Properties**:

- `maxResponseBytes?` _number \| null_

***

## ReadManyOptions

Options of `readMany`: `maxResponseBytes` caps the whole multipart body, as
in `ReadFileOptions`.

**Properties**:

- `maxResponseBytes?` _number \| null_

***

## RemoveOptions

**Properties**:

- `recursive?` _boolean_ - Remove a directory and everything in it.

***

## TransferProgressCallback

***

## UploadFileOptions

**Properties**:

- `onProgress?` _TransferProgressCallback_
- `signal?` _AbortSignal_
- `atomic?` _boolean_

***

## WatchDirOptions

**Properties**:

- `recursive?` _boolean_
- `onExit?` _(error?: Error) =\> void \| Promise\<void\>_ - Runs once when a watch `watchDir()` returned ends: no error after `stop()`,
  else the error that ended it. Its own failure is ignored.
- `onOverflow?` _() =\> void \| Promise\<void\>_ - The sandbox dropped events.

***

## WatchHandle

A running directory watch, returned by `fs.watchDir()`. Callbacks run one
at a time, in order, and are awaited. A failing `onEvent` or `onOverflow`
ends the watch: that error becomes `exitError` and is passed to `onExit`.

**Properties**:

- `exitError` _Error \| undefined_ - Why the watch ended: `undefined` while running or after `stop()`.

### Methods

#### stop()

```ts
stop(): Promise<void>;
```

Stop the watch. Resolves once a callback already running, and `onExit`,
have finished; a callback (or `onExit`) may call `stop()` on its own
watch without waiting for itself. In runtimes without `AsyncLocalStorage`
(browsers), a callback or `onExit` that stops its own watch after an
`await` must not await that `stop()`.

**Returns**:

- `Promise<void>`

#### waitForExit()

```ts
waitForExit(): Promise<Error | undefined>;
```

Wait until the watch ends; resolves with `exitError`.

**Returns**:

- `Promise<Error | undefined>`

***

## WriteFileOptions

**Properties**:

- `atomic?` _boolean_ - Write to a temporary file and rename it into place.

***

## WriteManyOptions

**Properties**:

- `atomic?` _boolean_ - Write each file to a temporary file and rename it into place.

***

## FileSearchResult

The result of `sandbox.fs.glob()` / `sandbox.fs.grep()`: one page (no
`nextCursor`) plus `skipped`, the absolute paths below the searched root
that the sandbox user cannot read, so they were not searched (at most 1000;
empty when nothing was skipped).

**Extends**: `ListResult<T>`

**Properties**:

- `skipped` _readonly string\[\]_

***

## SearchResult

One page of `GET /sandboxes/search` (`Daytona.search()`).

`total` is exact when `totalRelation === 'eq'` and a lower bound when it is
`'gte'`.

**Properties**:

- `items` _readonly T\[\]_
- `nextCursor?` _string_
- `total` _number_
- `totalRelation` _SearchTotalRelation_
- `rawTotalRelation` _string_

***

## SearchSandboxesOptions

Every `Daytona.search()` option (`GET /sandboxes/search`).

**Properties**:

- `q?` _string_ - Free text over name and image; also an exact match when it is a sandbox id.
- `states?` _Exclude\<SandboxState, 'unknown'\> \| readonly Exclude\<SandboxState, 'unknown'\>\[\]_ - SDK lifecycle states; `creating` and `error` each match multiple server states.
- `sandboxClass?` _SandboxClass \| readonly SandboxClass\[\]_ - A single value or a list (any-of).
- `region?` _string \| readonly string\[\]_ - A single value or a list (any-of) over region IDs. A region that contains
  other regions (a geo group, or `earth`) matches every region inside it; an
  unknown region is a `BadRequestError` from the API.
- `imageRef?` _string_
- `imageRefPrefix?` _string_
- `labels?` _Readonly\<Record\<string, string\>\>_ - Containment: every listed label must match.
- `spot?` _boolean_
- `forkedFrom?` _string_ - Sandboxes forked from this sandbox id.
- `minCores?` _number_ - Inclusive bounds on `cores_max` (the CPU limit), in cores (1 core = 2 vCPUs).
- `maxCores?` _number_
- `minMemoryMib?` _number_
- `maxMemoryMib?` _number_
- `minDiskMib?` _number_
- `maxDiskMib?` _number_
- `createdStartAt?` _SearchTimestamp_
- `createdEndAt?` _SearchTimestamp_
- `updatedStartAt?` _SearchTimestamp_
- `updatedEndAt?` _SearchTimestamp_
- `lastActivityStartAt?` _SearchTimestamp_
- `lastActivityEndAt?` _SearchTimestamp_
- `sort?` _SearchSort_ - Defaults to `created_at`.
- `order?` _SearchOrder_ - Defaults to `desc`.
- `namePrefix?` _string_ - Server-side prefix on the name.
- `idPrefix?` _string_ - Server-side prefix on the id.
- `limit?` _number_ - An integer from 1 to 200; anything else is `BadRequestError` before any request.
- `cursor?` _string_ - Opaque; bound to the filter + sort that produced it.

***

## SearchSort

```ts
type SearchSort = 'created_at' | 'updated_at' | 'last_activity_at' | 'name' | 'cores' | 'memory_mib' | 'disk_mib'
```

***

## SearchOrder

```ts
type SearchOrder = 'asc' | 'desc'
```

***

## SearchTimestamp

```ts
type SearchTimestamp = Date | string
```

A search bound: an RFC 3339 timestamp without a leap second (year 0001-9999,
a real calendar date), checked and sent exactly as written; or a `Date`,
sent in UTC (`toISOString()`), so its UTC instant must fall in years 0001-9999.

***

## SearchTotalRelation

```ts
type SearchTotalRelation = (typeof API_SEARCH_TOTAL_RELATIONS)[number] | 'unknown'
```

***

## FileInfo

One filesystem entry (`fs.list()` / `fs.stat()`).

**Properties**:

- `name` _string_
- `path` _string_
- `size` _number_
- `isDir` _boolean_
- `mode` _string_ - Symbolic file mode, e.g. `-rw-r--r--`.
- `permissions` _string_ - Octal permission bits, e.g. `0644`.
- `owner` _string_
- `group` _string_
- `modifiedAt` _string_ - RFC 3339 modification time.
- `modTime` _string_ - The modification time as the sandbox formats it; prefer `modifiedAt`.

***

## FileMatch

One matching line from `fs.grep()`.

**Properties**:

- `file` _string_
- `line` _number_ - One-based line number.
- `content` _string_

***

## ReplaceResult

One file's outcome from `fs.replace()`.

**Properties**:

- `file` _string_
- `success` _boolean_
- `error?` _string_

***

## FilePermissionsOptions

**Properties**:

- `mode?` _string_
- `owner?` _string_
- `group?` _string_

***

## BulkWriteFile

**Properties**:

- `path` _string_
- `bytes` _number_

***

## BulkWriteResult

**Properties**:

- `files` _readonly BulkWriteFile\[\]_
- `errors` _readonly string\[\]_

***

## BulkReadError

**Properties**:

- `path` _string_
- `code?` _string_
- `message` _string_
- `source?` _string_

***

## BulkReadResult

**Properties**:

- `files` _Readonly\<Record\<string, Uint8Array\>\>_
- `errors` _readonly BulkReadError\[\]_

***

## SIGNED\_FILE\_MAX\_TTL\_SECONDS

```ts
const SIGNED_FILE_MAX_TTL_SECONDS = 604_800
```

Server ceiling on a pre-signed file URL's lifetime (7 days). The API rejects
an `expires` further ahead than this, so the SDK refuses it before the
request; never-expiring links do not exist.
