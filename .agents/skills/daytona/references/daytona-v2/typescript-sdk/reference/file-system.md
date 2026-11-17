# FileSystem (TypeScript SDK reference)

## Contents

- [FileSystemService](#filesystemservice)
- [FilesystemEventType](#filesystemeventtype)
- [DownloadFileOptions](#downloadfileoptions)
- [FilePermissionsParams](#filepermissionsparams)
- [FilesystemEvent](#filesystemevent)
- [Match](#match)
- [PresignedUrlOptions](#presignedurloptions)
- [ReadFileOptions](#readfileoptions)
- [ReadManyOptions](#readmanyoptions)
- [SearchFilesResponse](#searchfilesresponse)
- [TransferProgressCallback](#transferprogresscallback)
- [UploadFileOptions](#uploadfileoptions)
- [WatchDirOptions](#watchdiroptions)
- [WatchHandle](#watchhandle)
- [WriteFileOptions](#writefileoptions)
- [WriteManyOptions](#writemanyoptions)
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

### Constructors

#### Constructor

```ts
new FileSystemService(
   transport: HttpTransport,
   fileUrlSigner?: FileUrlSigner): FileSystemService;
```

**Parameters**:

- `transport` _HttpTransport_
- `fileUrlSigner?` _FileUrlSigner_

**Returns**:

- `FileSystemService`

### Methods

#### chmod()

```ts
chmod(path: string, permissions: FilePermissionsOptions): Promise<void>;
```

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
glob(path: string, pattern: string): Promise<ListResult<string>>;
```

Return the paths of files under `path` whose base name matches the glob `pattern`.

**Parameters**:

- `path` _string_
- `pattern` _string_

**Returns**:

- `Promise<ListResult<string>>`

#### grep()

```ts
grep(path: string, pattern: string): Promise<ListResult<FileMatch>>;
```

Search file contents under `path` for the literal substring `pattern`; returns matches with one-based line numbers.

**Parameters**:

- `path` _string_
- `pattern` _string_

**Returns**:

- `Promise<ListResult<FileMatch>>`

#### list()

```ts
list(path: string, options: { depth?: number } = {}): Promise<ListResult<FileInfo>>;
```

List a directory; response always has `{items,nextCursor}`.

**Parameters**:

- `path` _string_
- `options` _\{ depth?: number \} = \{\}_

**Returns**:

- `Promise<ListResult<FileInfo>>`

#### mkdir()

```ts
mkdir(path: string, options: { mode?: string } = {}): Promise<void>;
```

**Parameters**:

- `path` _string_
- `options` _\{ mode?: string \} = \{\}_

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
readBytes(path: string, _options: ReadFileOptions = {}): Promise<Uint8Array>;
```

**Parameters**:

- `path` _string_
- `_options` _ReadFileOptions = \{\}_

**Returns**:

- `Promise<Uint8Array>`

#### readMany()

```ts
readMany(
   paths: readonly string[],
   _options: ReadManyOptions = {}): Promise<BulkReadResult>;
```

**Parameters**:

- `paths` _readonly string\[\]_
- `_options` _ReadManyOptions = \{\}_

**Returns**:

- `Promise<BulkReadResult>`

#### readText()

```ts
readText(path: string, options: ReadFileOptions = {}): Promise<string>;
```

**Parameters**:

- `path` _string_
- `options` _ReadFileOptions = \{\}_

**Returns**:

- `Promise<string>`

#### remove()

```ts
remove(path: string, options: { recursive?: boolean } = {}): Promise<void>;
```

**Parameters**:

- `path` _string_
- `options` _\{ recursive?: boolean \} = \{\}_

**Returns**:

- `Promise<void>`

#### replace()

```ts
replace(
   files: string[],
   pattern: string,
   newValue: string): Promise<ListResult<ReplaceResult>>;
```

**Parameters**:

- `files` _string\[\]_
- `pattern` _string_
- `newValue` _string_

**Returns**:

- `Promise<ListResult<ReplaceResult>>`

#### stat()

```ts
stat(path: string): Promise<FileInfo>;
```

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

**Parameters**:

- `path` _string_
- `onEvent` _(event: FilesystemEvent) = \> void \| Promise\<void\>, options: WatchDirOptions = \{\}_

**Returns**:

- `Promise<WatchHandle>`

#### writeBytes()

```ts
writeBytes(
   path: string,
   data: Uint8Array,
   options: WriteFileOptions = {}): Promise<void>;
```

**Parameters**:

- `path` _string_
- `data` _Uint8Array_
- `options` _WriteFileOptions = \{\}_

**Returns**:

- `Promise<void>`

#### writeMany()

```ts
writeMany(
   files: Record<string, Uint8Array>,
   options: WriteManyOptions = {}): Promise<BulkWriteResult>;
```

**Parameters**:

- `files` _Record\<string, Uint8Array\>_
- `options` _WriteManyOptions = \{\}_

**Returns**:

- `Promise<BulkWriteResult>`

#### writeText()

```ts
writeText(path: string, text: string, options: WriteFileOptions = {}): Promise<void>;
```

**Parameters**:

- `path` _string_
- `text` _string_
- `options` _WriteFileOptions = \{\}_

**Returns**:

- `Promise<void>`

***

## FilesystemEventType

```ts
enum FilesystemEventType {
  CREATE = 'create',
  WRITE = 'write',
  REMOVE = 'remove',
  RENAME = 'rename',
  CHMOD = 'chmod',
}
```

**Properties**:

- `CREATE` _'create'_
- `WRITE` _'write'_
- `REMOVE` _'remove'_
- `RENAME` _'rename'_
- `CHMOD` _'chmod'_

***

## DownloadFileOptions

**Properties**:

- `onProgress?` _TransferProgressCallback_
- `signal?` _AbortSignal_

***

## FilePermissionsParams

```ts
type FilePermissionsParams = FilePermissionsOptions
```

***

## FilesystemEvent

**Properties**:

- `type` _FilesystemEventType_
- `name` _string_
- `isDir` _boolean_
- `timestamp` _number_

***

## Match

```ts
type Match = FileMatch
```

***

## PresignedUrlOptions

**Properties**:

- `expiresInSeconds?` _number_

***

## ReadFileOptions

***

## ReadManyOptions

***

## SearchFilesResponse

```ts
type SearchFilesResponse = ListResult<string>
```

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
- `onExit?` _(err?: Error) =\> void_
- `onOverflow?` _() =\> void_

***

## WatchHandle

**Properties**:

- `exitError` _Error \| undefined_

### Methods

#### stop()

```ts
stop(): Promise<void>;
```

**Returns**:

- `Promise<void>`

#### waitForExit()

```ts
waitForExit(): Promise<Error | undefined>;
```

**Returns**:

- `Promise<Error | undefined>`

***

## WriteFileOptions

**Properties**:

- `mode?` _string_
- `atomic?` _boolean_

***

## WriteManyOptions

**Properties**:

- `atomic?` _boolean_

***

## SearchResult

One page of `GET /sandboxes/search` (`Daytona.search()`).

`total` is exact when `totalRelation === 'eq'` and a lower bound when it is
`'gte'`.

**Properties**:

- `items` _T\[\]_
- `nextCursor?` _string_
- `total` _number_
- `totalRelation` _SearchTotalRelation_
- `rawTotalRelation` _string_

***

## SearchSandboxesOptions

Every `Daytona.search()` option (`GET /sandboxes/search`).

**Properties**:

- `q?` _string_ - Free text over name and image; also an exact match when it is a sandbox id.
- `status?` _string \| readonly string\[\]_ - A single value or a list (any-of) over the API's lifecycle state names (`running`, `stopped`, ...).
- `sandboxClass?` _SandboxClass \| readonly SandboxClass\[\]_ - A single value or a list (any-of).
- `region?` _string \| readonly string\[\]_ - A single value or a list (any-of) over region slugs.
- `imageRef?` _string_
- `imageRefPrefix?` _string_
- `labels?` _Record\<string, string\>_ - Containment: every listed label must match.
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
- `namePrefix?` _string_ - Server-side prefix on the name (the search form of `list({ name })`).
- `idPrefix?` _string_ - Server-side prefix on the id (the search form of `list({ id })`).
- `limit?` _number_ - Clamped to 1..200 by the server.
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

An RFC 3339 string, or a `Date` (serialized with `toISOString()`, i.e. UTC).

***

## SearchTotalRelation

```ts
type SearchTotalRelation = (typeof API_SEARCH_TOTAL_RELATIONS)[number] | 'unknown'
```

***

## FileInfo

**Properties**:

- `name` _string_
- `path?` _string_
- `isDir` _boolean_
- `size` _number_
- `modTime?` _string_
- `modifiedAt?` _string_
- `mode?` _string_
- `permissions?` _string_
- `owner?` _string_
- `group?` _string_

***

## FileMatch

```ts
type FileMatch = toolbox.Match
```

***

## ReplaceResult

**Properties**:

- `file` _string_
- `success?` _boolean_
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

- `files` _BulkWriteFile\[\]_
- `errors` _string\[\]_

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

- `files` _Record\<string, Uint8Array\>_
- `errors` _BulkReadError\[\]_

***

## SIGNED\_FILE\_MAX\_TTL\_SECONDS

```ts
const SIGNED_FILE_MAX_TTL_SECONDS = 604_800
```

Server ceiling on a pre-signed file URL's lifetime (7 days). The API rejects
an `expires` further ahead than this, so the SDK refuses it before the
request; never-expiring links do not exist.
