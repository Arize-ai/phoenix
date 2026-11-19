# FileSystem (Python SDK reference)

## Contents

- [FileSystemService](#filesystemservice)
- [AsyncFileSystemService](#asyncfilesystemservice)
- [WatchHandle](#watchhandle)
- [AsyncWatchHandle](#asyncwatchhandle)
- [FileInfo](#fileinfo)
- [TransferCancelSignal](#transfercancelsignal)
- [FilesystemEventType](#filesystemeventtype)
- [SearchResult](#searchresult)
- [FilesystemEvent](#filesystemevent)
- [BulkWriteFile](#bulkwritefile)
- [BulkWriteResult](#bulkwriteresult)
- [BulkReadError](#bulkreaderror)
- [BulkReadResult](#bulkreadresult)
- [SearchSandboxesQuery](#searchsandboxesquery)
- [SIGNED\_FILE\_MAX\_TTL\_SECONDS](#signedfilemaxttlseconds)
- [TransferProgressCallback](#transferprogresscallback)
- [SearchTotalRelation](#searchtotalrelation)
- [SearchSort](#searchsort)
- [SearchOrder](#searchorder)
- [SearchTimestamp](#searchtimestamp)

## FileSystemService

```python
class FileSystemService()
```

Sandbox filesystem namespace.

#### FileSystemService.\_\_init\_\_

```python
def __init__(impl: AsyncFileSystemService, bridge: SyncBridge) -> None
```

#### FileSystemService.chmod

```python
def chmod(path: str,
          *,
          mode: Optional[str] = None,
          owner: Optional[str] = None,
          group: Optional[str] = None) -> None
```

Set file permissions and ownership.

#### FileSystemService.download\_file

```python
def download_file(remote_path: str,
                  local_path: str | os.PathLike[str],
                  *,
                  on_progress: TransferProgressCallback | None = None,
                  cancel: TransferCancelSignal | None = None) -> None
```

#### FileSystemService.glob

```python
def glob(path: str, pattern: str) -> ListResult[str]
```

Return the paths of files under `path` whose base name matches the glob `pattern`.

#### FileSystemService.grep

```python
def grep(path: str, pattern: str) -> ListResult
```

Search file contents under `path` for the literal substring `pattern`.

#### FileSystemService.list

```python
def list(path: str, *, depth: Optional[int] = None) -> ListResult[FileInfo]
```

List directory entries as typed `FileInfo` items (`items`, `next_cursor`).

#### FileSystemService.mkdir

```python
def mkdir(path: str, *, mode: str = '755') -> None
```

Create a directory.

#### FileSystemService.move

```python
def move(source: str, destination: str) -> None
```

Move or rename files.

#### FileSystemService.presigned\_download\_url

```python
def presigned_download_url(path: str, *, expires_in_seconds: int = 3600) -> str
```

Return a pre-signed download URL for a sandbox file.

#### FileSystemService.presigned\_upload\_url

```python
def presigned_upload_url(path: str, *, expires_in_seconds: int = 3600) -> str
```

Return a pre-signed upload URL for a sandbox file.

#### FileSystemService.read\_bytes

```python
def read_bytes(path: str) -> bytes
```

Read a file as bytes.

#### FileSystemService.read\_many

```python
def read_many(paths: Sequence[str]) -> BulkReadResult
```

Read multiple files, buffering each returned file in memory before returning.

#### FileSystemService.read\_text

```python
def read_text(path: str) -> str
```

Read a UTF-8 text file.

#### FileSystemService.remove

```python
def remove(path: str, *, recursive: bool = False) -> None
```

Remove a file, or a directory with `recursive=True`.

#### FileSystemService.replace

```python
def replace(files: Sequence[str], pattern: str, new_value: str) -> ListResult
```

Replace text in files.

#### FileSystemService.stat

```python
def stat(path: str) -> FileInfo
```

Return file metadata.

#### FileSystemService.upload\_file

```python
def upload_file(local_path: str | os.PathLike[str],
                remote_path: str,
                *,
                on_progress: TransferProgressCallback | None = None,
                cancel: TransferCancelSignal | None = None,
                atomic: bool = False) -> None
```

Stream a local file into the sandbox without buffering it whole in memory.

#### FileSystemService.watch\_dir

```python
def watch_dir(path: str,
              on_event: Optional[_WatchCallback] = None,
              *,
              recursive: bool = False,
              on_overflow: Optional[_OverflowCallback] = None,
              on_exit: Optional[_ExitCallback] = None) -> WatchHandle
```

#### FileSystemService.write\_bytes

```python
def write_bytes(path: str, content: bytes, *, atomic: bool = False) -> None
```

Write bytes to a file, optionally via temp-file + rename.

#### FileSystemService.write\_many

```python
def write_many(files: Mapping[str, bytes], *, atomic: bool = False) -> BulkWriteResult
```

Write several files in one request, optionally atomically per file.

#### FileSystemService.write\_text

```python
def write_text(path: str, content: str, *, atomic: bool = False) -> None
```

Write a UTF-8 text file, optionally via temp-file + rename.

## AsyncFileSystemService

```python
class AsyncFileSystemService()
```

Sandbox filesystem namespace.

#### AsyncFileSystemService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport,
             *,
             file_url_signer: Optional[FileUrlSigner] = None) -> None
```

#### AsyncFileSystemService.read\_bytes

```python
async def read_bytes(path: str) -> bytes
```

Read a file as bytes.

#### AsyncFileSystemService.read\_text

```python
async def read_text(path: str) -> str
```

Read a UTF-8 text file.

#### AsyncFileSystemService.write\_bytes

```python
async def write_bytes(path: str, content: bytes, *, atomic: bool = False) -> None
```

Write bytes to a file, optionally via temp-file + rename.

#### AsyncFileSystemService.write\_text

```python
async def write_text(path: str, content: str, *, atomic: bool = False) -> None
```

Write a UTF-8 text file, optionally via temp-file + rename.

#### AsyncFileSystemService.presigned\_download\_url

```python
async def presigned_download_url(path: str, *, expires_in_seconds: int = 3600) -> str
```

Return a pre-signed download URL for a sandbox file.

The signature is minted by the API; `expires_in_seconds`
must be between 1 and `SIGNED_FILE_MAX_TTL_SECONDS` (7 days).

#### AsyncFileSystemService.presigned\_upload\_url

```python
async def presigned_upload_url(path: str, *, expires_in_seconds: int = 3600) -> str
```

Return a pre-signed upload URL for a sandbox file.

The signature is minted by the API; `expires_in_seconds`
must be between 1 and `SIGNED_FILE_MAX_TTL_SECONDS` (7 days).

#### AsyncFileSystemService.write\_many

```python
async def write_many(files: Mapping[str, bytes],
                     *,
                     atomic: bool = False) -> BulkWriteResult
```

Write several files in one request, optionally atomically per file.

#### AsyncFileSystemService.upload\_file

```python
async def upload_file(local_path: str | os.PathLike[str],
                      remote_path: str,
                      *,
                      on_progress: TransferProgressCallback | None = None,
                      cancel: TransferCancelSignal | None = None,
                      atomic: bool = False) -> None
```

Stream a local file into the sandbox without buffering it whole in memory.

#### AsyncFileSystemService.download\_file

```python
async def download_file(remote_path: str,
                        local_path: str | os.PathLike[str],
                        *,
                        on_progress: TransferProgressCallback | None = None,
                        cancel: TransferCancelSignal | None = None) -> None
```

#### AsyncFileSystemService.read\_many

```python
async def read_many(paths: Sequence[str]) -> BulkReadResult
```

Read multiple files, buffering each returned file in memory before returning.

Non-200 responses raise the typed SDK error inside the transport;
only a 200 multipart body reaches the parser.

#### AsyncFileSystemService.list

```python
async def list(path: str, *, depth: Optional[int] = None) -> ListResult[FileInfo]
```

List directory entries as typed `FileInfo` items (`items`, `next_cursor`).

#### AsyncFileSystemService.stat

```python
async def stat(path: str) -> FileInfo
```

Return file metadata.

#### AsyncFileSystemService.mkdir

```python
async def mkdir(path: str, *, mode: str = '755') -> None
```

Create a directory.

#### AsyncFileSystemService.remove

```python
async def remove(path: str, *, recursive: bool = False) -> None
```

Remove a file, or a directory with `recursive=True`.

#### AsyncFileSystemService.move

```python
async def move(source: str, destination: str) -> None
```

Move or rename files.

#### AsyncFileSystemService.grep

```python
async def grep(path: str, pattern: str) -> ListResult
```

Search file contents under `path` for the literal substring `pattern`.

Returns matches with one-based line numbers.

#### AsyncFileSystemService.glob

```python
async def glob(path: str, pattern: str) -> ListResult[str]
```

Return the paths of files under `path` whose base name matches the glob `pattern`.

#### AsyncFileSystemService.replace

```python
async def replace(files: Sequence[str], pattern: str, new_value: str) -> ListResult
```

Replace text in files.

#### AsyncFileSystemService.chmod

```python
async def chmod(path: str,
                *,
                mode: Optional[str] = None,
                owner: Optional[str] = None,
                group: Optional[str] = None) -> None
```

Set file permissions and ownership.

#### AsyncFileSystemService.watch\_dir

```python
async def watch_dir(path: str,
                    on_event: Optional[_WatchCallback] = None,
                    *,
                    recursive: bool = False,
                    on_overflow: Optional[_OverflowCallback] = None,
                    on_exit: Optional[_ExitCallback] = None) -> AsyncWatchHandle
```

## WatchHandle

```python
class WatchHandle()
```

A running directory watch.

#### WatchHandle.\_\_init\_\_

```python
def __init__(impl: AsyncWatchHandle, bridge: SyncBridge) -> None
```

#### WatchHandle.attach\_reader

```python
def attach_reader(reader: asyncio.Task[None]) -> None
```

#### WatchHandle.get\_new\_events

```python
def get_new_events() -> list[FilesystemEvent]
```

#### WatchHandle.record\_callback\_error

```python
def record_callback_error(error: Exception) -> None
```

#### WatchHandle.record\_exit

```python
def record_exit(error: Exception | None) -> None
```

#### WatchHandle.record\_overflow

```python
def record_overflow() -> None
```

#### WatchHandle.stop

```python
def stop() -> None
```

#### WatchHandle.wait\_for\_exit

```python
def wait_for_exit() -> Exception | None
```

#### WatchHandle.exit\_error

```python
@property
def exit_error() -> Exception | None
```

#### WatchHandle.last\_callback\_error

```python
@property
def last_callback_error() -> Exception | None
```

#### WatchHandle.overflow\_count

```python
@property
def overflow_count() -> int
```

## AsyncWatchHandle

```python
class AsyncWatchHandle()
```

A running directory watch.

Single-task, single-loop: the reader is one `asyncio.Task` and every
method runs on the same loop, so the sync version's five locks collapse to
plain attributes. Only the exit event survives, because `wait_for_exit`
genuinely waits.

#### AsyncWatchHandle.\_\_init\_\_

```python
def __init__(stream: _LineStream,
             events: asyncio.Queue[FilesystemEvent],
             on_exit: Optional[_ExitCallback] = None) -> None
```

#### AsyncWatchHandle.overflow\_count

```python
@property
def overflow_count() -> int
```

#### AsyncWatchHandle.attach\_reader

```python
def attach_reader(reader: asyncio.Task[None]) -> None
```

#### AsyncWatchHandle.exit\_error

```python
@property
def exit_error() -> Exception | None
```

#### AsyncWatchHandle.last\_callback\_error

```python
@property
def last_callback_error() -> Exception | None
```

#### AsyncWatchHandle.record\_callback\_error

```python
def record_callback_error(error: Exception) -> None
```

#### AsyncWatchHandle.record\_exit

```python
async def record_exit(error: Exception | None) -> None
```

#### AsyncWatchHandle.record\_overflow

```python
def record_overflow() -> None
```

#### AsyncWatchHandle.wait\_for\_exit

```python
async def wait_for_exit() -> Exception | None
```

#### AsyncWatchHandle.get\_new\_events

```python
def get_new_events() -> list[FilesystemEvent]
```

#### AsyncWatchHandle.stop

```python
async def stop() -> None
```

## FileInfo

```python
class FileInfo(BaseModel)
```

One filesystem entry returned by `/files` and `/files/info`.

**Attributes**:

- `group` _StrictStr = Field(description='Numeric group id rendered as a string.')_
- `is_dir` _StrictBool = Field(description='Whether the entry is a directory.', alias='isDir')_
- `mod_time` _StrictStr = Field(description='Last modification time as a formatted string. Prefer `modifiedAt` for RFC 3339 formatting.', alias='modTime')_
- `mode` _StrictStr = Field(description='File mode string, for example `-rw-r--r--` or `drwxr-xr-x`.')_
- `modified_at` _StrictStr = Field(description='RFC 3339 UTC timestamp for the last modification time.', alias='modifiedAt')_
- `name` _StrictStr = Field(description='Base name of the entry.')_
- `owner` _StrictStr = Field(description='Numeric owner id rendered as a string.')_
- `path` _StrictStr = Field(description="Absolute path to the entry, using the sandbox's path syntax.")_
- `permissions` _StrictStr = Field(description='Four-digit octal permissions (`0644`, `0755`, …).')_
- `size` _Annotated\[int, Field(strict=True, ge=0)\] = Field(description='Entry size in bytes.')_
- `additional_properties` _Dict\[str, Any\] = \{\}_

##### model\_config

```python
model_config = ConfigDict(populate_by_name=True, validate_assignment=True, protected_namespaces=())
```

#### FileInfo.to\_str

```python
def to_str() -> str
```

Returns the string representation of the model using alias

#### FileInfo.to\_json

```python
def to_json() -> str
```

Returns the JSON representation of the model using alias

#### FileInfo.from\_json

```python
@classmethod
def from_json(json_str: str) -> Optional[Self]
```

Create an instance of FileInfo from a JSON string

#### FileInfo.to\_dict

```python
def to_dict() -> Dict[str, Any]
```

Return the dictionary representation of the model using alias.

This has the following differences from calling pydantic's
`self.model_dump(by_alias=True)`:

* `None` is only added to the output dict for nullable fields that
  were set at model initialization. Other fields with value `None`
  are ignored.
* Fields in `self.additional_properties` are added to the output dict.

#### FileInfo.from\_dict

```python
@classmethod
def from_dict(obj: Optional[Dict[str, Any]]) -> Optional[Self]
```

Create an instance of FileInfo from a dict

## TransferCancelSignal

```python
class TransferCancelSignal(Protocol)
```

A cancellation signal for file transfers.

`asyncio.Event` and `threading.Event` both satisfy this protocol.

#### TransferCancelSignal.is\_set

```python
def is_set() -> bool
```

## FilesystemEventType

```python
class FilesystemEventType(str, Enum)
```

**Attributes**:

- `CREATE` _'create'_
- `WRITE` _'write'_
- `REMOVE` _'remove'_
- `RENAME` _'rename'_
- `CHMOD` _'chmod'_

## SearchResult

```python
@dataclass(frozen=True)
class SearchResult(Generic[T])
```

One page of `GET /sandboxes/search` (`Daytona.search()`).

`total` is exact when `total_relation == "eq"` and a lower bound when it
is `"gte"` (exact counting is capped at 10 000).

**Attributes**:

- `items` _List\[T\]_
- `next_cursor` _Optional\[str\] = None_
- `total` _int = 0_
- `total_relation` _SearchTotalRelation = 'eq'_
- `raw_total_relation` _str = 'eq'_

## FilesystemEvent

```python
@dataclass(frozen=True, slots=True)
class FilesystemEvent()
```

**Attributes**:

- `type` _FilesystemEventType_
- `name` _str_
- `is_dir` _bool_
- `timestamp` _int_

## BulkWriteFile

```python
@dataclass(frozen=True)
class BulkWriteFile()
```

**Attributes**:

- `path` _str_
- `bytes` _int_

## BulkWriteResult

```python
@dataclass(frozen=True)
class BulkWriteResult()
```

**Attributes**:

- `files` _List\[BulkWriteFile\]_
- `errors` _List\[str\] = field(default_factory=list)_

## BulkReadError

```python
@dataclass(frozen=True)
class BulkReadError()
```

**Attributes**:

- `path` _str_
- `message` _str_
- `code` _Optional\[str\] = None_
- `source` _Optional\[str\] = None_

## BulkReadResult

```python
@dataclass(frozen=True)
class BulkReadResult()
```

**Attributes**:

- `files` _Dict\[str, bytes\]_
- `errors` _List\[BulkReadError\] = field(default_factory=list)_

## SearchSandboxesQuery

```python
@dataclass(frozen=True, kw_only=True)
class SearchSandboxesQuery(SandboxSearchFilters)
```

Every `Daytona.search()` parameter (`GET /sandboxes/search`); keyword-only.

**Attributes**:

- `name_prefix` _Optional\[str\] = None_
- `id_prefix` _Optional\[str\] = None_
- `cursor` _Optional\[str\] = None_
- `limit` _Optional\[int\] = None_

## SIGNED\_FILE\_MAX\_TTL\_SECONDS

```python
SIGNED_FILE_MAX_TTL_SECONDS = 604800
```

## TransferProgressCallback

```python
TransferProgressCallback = Callable[[int, Optional[int]], None]
```

## SearchTotalRelation

```python
SearchTotalRelation = Literal['eq', 'gte', 'unknown']
```

## SearchSort

```python
SearchSort = Literal['created_at', 'updated_at', 'last_activity_at', 'name', 'cores', 'memory_mib', 'disk_mib']
```

## SearchOrder

```python
SearchOrder = Literal['asc', 'desc']
```

## SearchTimestamp

```python
SearchTimestamp = Union[str, datetime]
```

An RFC 3339 string, or a `datetime` (naive values are taken as UTC).
