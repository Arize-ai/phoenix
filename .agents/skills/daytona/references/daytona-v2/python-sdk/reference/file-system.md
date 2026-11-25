# FileSystem (Python SDK reference)

## Contents

- [FileSystemService](#filesystemservice)
- [AsyncFileSystemService](#asyncfilesystemservice)
- [WatchHandle](#watchhandle)
- [AsyncWatchHandle](#asyncwatchhandle)
- [TransferCancelSignal](#transfercancelsignal)
- [FileSearchResult](#filesearchresult)
- [SearchResult](#searchresult)
- [FilesystemEvent](#filesystemevent)
- [BulkWriteFile](#bulkwritefile)
- [BulkWriteResult](#bulkwriteresult)
- [BulkReadError](#bulkreaderror)
- [BulkReadResult](#bulkreadresult)
- [FileInfo](#fileinfo)
- [FileMatch](#filematch)
- [ReplaceResult](#replaceresult)
- [SearchSandboxesOptions](#searchsandboxesoptions)
- [WatchEventCallback](#watcheventcallback)
- [WatchOverflowCallback](#watchoverflowcallback)
- [WatchExitCallback](#watchexitcallback)
- [SIGNED\_FILE\_MAX\_TTL\_SECONDS](#signedfilemaxttlseconds)
- [TransferProgressCallback](#transferprogresscallback)
- [SearchSandboxState](#searchsandboxstate)
- [SearchTotalRelation](#searchtotalrelation)
- [FilesystemEventType](#filesystemeventtype)
- [SearchSort](#searchsort)
- [SearchOrder](#searchorder)
- [SearchTimestamp](#searchtimestamp)

## FileSystemService

```python
class FileSystemService()
```

Sandbox filesystem namespace. All sandbox paths must be absolute strings
starting with `/`; relative paths are refused with `BadRequestError`.
Local upload/download paths are not subject to this rule.

#### FileSystemService.\_\_init\_\_

```python
def __init__() -> None
```

#### FileSystemService.chmod

```python
def chmod(path: str,
          /,
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
                  /,
                  *,
                  on_progress: TransferProgressCallback | None = None,
                  cancel: TransferCancelSignal | None = None) -> None
```

Stream `remote_path` to `local_path` without holding it in memory.

Writes to a unique temporary file in the destination directory and
renames it over `local_path` on success; on an error or a
cancellation that temporary file is removed. `on_progress(bytes,
total)` reports progress (`total` from `Content-Length` when the
sandbox sends it); `cancel` is any object with `is_set()`, checked
between chunks, and raises `TransferCancelledError`.

#### FileSystemService.glob

```python
def glob(path: str, pattern: str, /) -> FileSearchResult[str]
```

Return the paths of files under `path` whose base name matches the glob `pattern`.

Directories below `path` that the sandbox user cannot read are not
searched; `skipped` lists their absolute paths (at most 1000). Only an
unreadable `path` itself raises
`daytona.v2.errors.FileAccessDeniedError`.

#### FileSystemService.grep

```python
def grep(path: str, pattern: str, /) -> FileSearchResult[FileMatch]
```

Search file contents under `path` for the literal substring `pattern`.

Returns matches with one-based line numbers, as the sandbox user sees
them. Directories and files below `path` that the sandbox user cannot
read are not searched; `skipped` lists their absolute paths (at most
1000). Only an unreadable `path` itself raises
`daytona.v2.errors.FileAccessDeniedError`.

#### FileSystemService.list

```python
def list(path: str, /, *, depth: Optional[int] = None) -> ListResult[FileInfo]
```

List directory entries as typed `FileInfo` items (`items`, `next_cursor`).

#### FileSystemService.mkdir

```python
def mkdir(path: str, /, *, mode: str = '0755') -> None
```

Create a directory.

#### FileSystemService.move

```python
def move(source: str, destination: str, /) -> None
```

Move or rename files.

#### FileSystemService.presigned\_download\_url

```python
def presigned_download_url(path: str, /, *, expires_in_seconds: int = 3600) -> str
```

Return a pre-signed download URL for a sandbox file.

The signature is minted by the API; `expires_in_seconds`
must be between 1 and `SIGNED_FILE_MAX_TTL_SECONDS` (7 days).

#### FileSystemService.presigned\_upload\_url

```python
def presigned_upload_url(path: str, /, *, expires_in_seconds: int = 3600) -> str
```

Return a pre-signed upload URL for a sandbox file.

The signature is minted by the API; `expires_in_seconds`
must be between 1 and `SIGNED_FILE_MAX_TTL_SECONDS` (7 days).

#### FileSystemService.read\_bytes

```python
def read_bytes(path: str, /, *, max_response_bytes: Optional[int] = None) -> bytes
```

Read a file as bytes, holding the whole file in memory.

No total deadline (it fails only when no bytes move for the client's
`request_timeout`; with a `request_timeout` of `0`, nothing
bounds it). `max_response_bytes` replaces the client's cap on the
body for this call (`None` keeps the client's cap, `0` means no
limit, and any other value (negative, fractional, boolean, string,
above 2**53 - 1) is a `BadRequestError`); a larger body raises
`PayloadTooLargeError` before it is read in full. For large files, or
content from a sandbox you do not trust, use `download_file`,
which streams to disk with progress and cancellation.

#### FileSystemService.read\_many

```python
def read_many(paths: Sequence[str],
              /,
              *,
              max_response_bytes: Optional[int] = None) -> BulkReadResult
```

Read multiple files, buffering each returned file in memory before returning.

The whole response is held in memory. For large files, or content from a
sandbox you do not trust, use `download_file`, which streams to disk
with progress and cancellation.

Non-200 responses raise the typed SDK error inside the transport;
only a 200 multipart body reaches the parser. The limits are those of
`read_bytes`; `max_response_bytes` applies to the whole
multipart body.

#### FileSystemService.read\_text

```python
def read_text(path: str, /, *, max_response_bytes: Optional[int] = None) -> str
```

Read a UTF-8 text file (see `read_bytes` for its bounds).

Decoding is strict (invalid UTF-8 raises `UnicodeDecodeError`) and a
leading byte-order mark is kept as `\ufeff`.

#### FileSystemService.remove

```python
def remove(path: str, /, *, recursive: bool = False) -> None
```

Remove a file, or a directory with `recursive=True`.

#### FileSystemService.replace

```python
def replace(files: Sequence[str],
            pattern: str,
            new_value: str,
            /) -> ListResult[ReplaceResult]
```

Replace the literal substring `pattern` with `new_value` in `files`.

#### FileSystemService.stat

```python
def stat(path: str, /) -> FileInfo
```

Return file metadata.

#### FileSystemService.upload\_file

```python
def upload_file(local_path: str | os.PathLike[str],
                remote_path: str,
                /,
                *,
                on_progress: TransferProgressCallback | None = None,
                cancel: TransferCancelSignal | None = None,
                atomic: bool = False) -> None
```

Stream a local file into the sandbox without buffering it whole in memory.

#### FileSystemService.watch\_dir

```python
def watch_dir(path: str,
              on_event: WatchEventCallback,
              /,
              *,
              recursive: bool = False,
              on_overflow: Optional[WatchOverflowCallback] = None,
              on_exit: Optional[WatchExitCallback] = None) -> WatchHandle
```

Watch `path` for changes, calling `on_event` for each one.

Returns once the watch is established; callbacks are held until it has
returned its handle (see `WatchHandle` for stopping a watch
from an event). Callbacks (plain or coroutine functions) run one at a
time, in order.
A failing `on_event` or
`on_overflow` ends the watch with that error; `on_exit` runs once
when the watch ends, and its own failure is ignored. A failure before
the watch starts is raised from this call and does not call `on_exit`;
a stream that sends more than 4096 events, or more than 1 MiB, before
`start` is one (`BadRequestError`). After `start` an event larger
than the client's `max_response_bytes` ends the watch with
`PayloadTooLargeError`.

#### FileSystemService.write\_bytes

```python
def write_bytes(path: str, content: Buffer, /, *, atomic: bool = False) -> None
```

Write a bytes-like buffer to an absolute path, optionally atomically.

#### FileSystemService.write\_many

```python
def write_many(files: Mapping[str, Buffer],
               /,
               *,
               atomic: bool = False) -> BulkWriteResult
```

Write absolute paths mapped to bytes-like buffers, optionally atomically per file.

#### FileSystemService.write\_text

```python
def write_text(path: str, content: str, /, *, atomic: bool = False) -> None
```

Write a UTF-8 text file, optionally via temp-file + rename.

## AsyncFileSystemService

```python
class AsyncFileSystemService()
```

Sandbox filesystem namespace. All sandbox paths must be absolute strings
starting with `/`; relative paths are refused with `BadRequestError`.
Local upload/download paths are not subject to this rule.

#### AsyncFileSystemService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncFileSystemService.read\_bytes

```python
async def read_bytes(path: str, /, *, max_response_bytes: Optional[int] = None) -> bytes
```

Read a file as bytes, holding the whole file in memory.

No total deadline (it fails only when no bytes move for the client's
`request_timeout`; with a `request_timeout` of `0`, nothing
bounds it). `max_response_bytes` replaces the client's cap on the
body for this call (`None` keeps the client's cap, `0` means no
limit, and any other value (negative, fractional, boolean, string,
above 2**53 - 1) is a `BadRequestError`); a larger body raises
`PayloadTooLargeError` before it is read in full. For large files, or
content from a sandbox you do not trust, use `download_file`,
which streams to disk with progress and cancellation.

#### AsyncFileSystemService.read\_text

```python
async def read_text(path: str, /, *, max_response_bytes: Optional[int] = None) -> str
```

Read a UTF-8 text file (see `read_bytes` for its bounds).

Decoding is strict (invalid UTF-8 raises `UnicodeDecodeError`) and a
leading byte-order mark is kept as `\ufeff`.

#### AsyncFileSystemService.write\_bytes

```python
async def write_bytes(path: str, content: Buffer, /, *, atomic: bool = False) -> None
```

Write a bytes-like buffer to an absolute path, optionally atomically.

#### AsyncFileSystemService.write\_text

```python
async def write_text(path: str, content: str, /, *, atomic: bool = False) -> None
```

Write a UTF-8 text file, optionally via temp-file + rename.

#### AsyncFileSystemService.presigned\_download\_url

```python
async def presigned_download_url(path: str, /, *, expires_in_seconds: int = 3600) -> str
```

Return a pre-signed download URL for a sandbox file.

The signature is minted by the API; `expires_in_seconds`
must be between 1 and `SIGNED_FILE_MAX_TTL_SECONDS` (7 days).

#### AsyncFileSystemService.presigned\_upload\_url

```python
async def presigned_upload_url(path: str, /, *, expires_in_seconds: int = 3600) -> str
```

Return a pre-signed upload URL for a sandbox file.

The signature is minted by the API; `expires_in_seconds`
must be between 1 and `SIGNED_FILE_MAX_TTL_SECONDS` (7 days).

#### AsyncFileSystemService.write\_many

```python
async def write_many(files: Mapping[str, Buffer],
                     /,
                     *,
                     atomic: bool = False) -> BulkWriteResult
```

Write absolute paths mapped to bytes-like buffers, optionally atomically per file.

#### AsyncFileSystemService.upload\_file

```python
async def upload_file(local_path: str | os.PathLike[str],
                      remote_path: str,
                      /,
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
                        /,
                        *,
                        on_progress: TransferProgressCallback | None = None,
                        cancel: TransferCancelSignal | None = None) -> None
```

Stream `remote_path` to `local_path` without holding it in memory.

Writes to a unique temporary file in the destination directory and
renames it over `local_path` on success; on an error or a
cancellation that temporary file is removed. `on_progress(bytes,
total)` reports progress (`total` from `Content-Length` when the
sandbox sends it); `cancel` is any object with `is_set()`, checked
between chunks, and raises `TransferCancelledError`.

#### AsyncFileSystemService.read\_many

```python
async def read_many(paths: Sequence[str],
                    /,
                    *,
                    max_response_bytes: Optional[int] = None) -> BulkReadResult
```

Read multiple files, buffering each returned file in memory before returning.

The whole response is held in memory. For large files, or content from a
sandbox you do not trust, use `download_file`, which streams to disk
with progress and cancellation.

Non-200 responses raise the typed SDK error inside the transport;
only a 200 multipart body reaches the parser. The limits are those of
`read_bytes`; `max_response_bytes` applies to the whole
multipart body.

#### AsyncFileSystemService.list

```python
async def list(path: str, /, *, depth: Optional[int] = None) -> ListResult[FileInfo]
```

List directory entries as typed `FileInfo` items (`items`, `next_cursor`).

#### AsyncFileSystemService.stat

```python
async def stat(path: str, /) -> FileInfo
```

Return file metadata.

#### AsyncFileSystemService.mkdir

```python
async def mkdir(path: str, /, *, mode: str = '0755') -> None
```

Create a directory.

#### AsyncFileSystemService.remove

```python
async def remove(path: str, /, *, recursive: bool = False) -> None
```

Remove a file, or a directory with `recursive=True`.

#### AsyncFileSystemService.move

```python
async def move(source: str, destination: str, /) -> None
```

Move or rename files.

#### AsyncFileSystemService.grep

```python
async def grep(path: str, pattern: str, /) -> FileSearchResult[FileMatch]
```

Search file contents under `path` for the literal substring `pattern`.

Returns matches with one-based line numbers, as the sandbox user sees
them. Directories and files below `path` that the sandbox user cannot
read are not searched; `skipped` lists their absolute paths (at most
1000). Only an unreadable `path` itself raises
`daytona.v2.errors.FileAccessDeniedError`.

#### AsyncFileSystemService.glob

```python
async def glob(path: str, pattern: str, /) -> FileSearchResult[str]
```

Return the paths of files under `path` whose base name matches the glob `pattern`.

Directories below `path` that the sandbox user cannot read are not
searched; `skipped` lists their absolute paths (at most 1000). Only an
unreadable `path` itself raises
`daytona.v2.errors.FileAccessDeniedError`.

#### AsyncFileSystemService.replace

```python
async def replace(files: Sequence[str],
                  pattern: str,
                  new_value: str,
                  /) -> ListResult[ReplaceResult]
```

Replace the literal substring `pattern` with `new_value` in `files`.

#### AsyncFileSystemService.chmod

```python
async def chmod(path: str,
                /,
                *,
                mode: Optional[str] = None,
                owner: Optional[str] = None,
                group: Optional[str] = None) -> None
```

Set file permissions and ownership.

#### AsyncFileSystemService.watch\_dir

```python
async def watch_dir(path: str,
                    on_event: WatchEventCallback,
                    /,
                    *,
                    recursive: bool = False,
                    on_overflow: Optional[WatchOverflowCallback] = None,
                    on_exit: Optional[WatchExitCallback] = None) -> AsyncWatchHandle
```

Watch `path` for changes, calling `on_event` for each one.

Returns once the watch is established; callbacks are held until it has
returned its handle (see `AsyncWatchHandle` for stopping a watch
from an event). Callbacks (plain or coroutine functions) run one at a
time, in order.
A failing `on_event` or
`on_overflow` ends the watch with that error; `on_exit` runs once
when the watch ends, and its own failure is ignored. A failure before
the watch starts is raised from this call and does not call `on_exit`;
a stream that sends more than 4096 events, or more than 1 MiB, before
`start` is one (`BadRequestError`). After `start` an event larger
than the client's `max_response_bytes` ends the watch with
`PayloadTooLargeError`.

## WatchHandle

```python
class WatchHandle()
```

A running directory watch, returned by `fs.watch_dir()`.

Callbacks run one at a time, in order, and are awaited. A failing event or
overflow callback ends the watch: that error becomes `exit_error`
and is passed to `on_exit`. Never constructed directly.

To stop a watch from an event, signal the code that holds the handle (an
`asyncio.Event`, or a `threading.Event` with the synchronous client)
and call `stop()` there; this works in every case. As a shorthand, after
a direct `watch_dir(...)` a callback can call `stop()` on the
returned handle itself: callbacks are held until `watch_dir()` has
returned its handle. When `watch_dir()` runs inside another task
(`asyncio.gather`, `asyncio.create_task`, or `asyncio.wait_for` on
Python 3.10-3.11), or with the synchronous client, the first events can
reach the callback before the caller holds the handle.

With the synchronous client, callbacks run on the SDK's event-loop thread:
there a callback may call its own watch's `stop()` (which then returns
without waiting), `wait_for_exit()` and `exit_error` (which return the
current exit error), but no other synchronous SDK call (another watch's
included): that raises `BridgeError`.

#### WatchHandle.\_\_init\_\_

```python
def __init__() -> None
```

#### WatchHandle.stop

```python
def stop() -> None
```

Stop the watch, once a running callback and `on_exit` finish (its own callback: at once).

A callback (or `on_exit`) may call `stop()` on its own watch, also
from a task it started; that call returns without waiting for itself.

#### WatchHandle.wait\_for\_exit

```python
def wait_for_exit() -> Exception | None
```

Wait until the watch ends and return `exit_error` (its own callback: at once).

Called by the watch's own callback, it returns the current exit error
without waiting for itself.

#### WatchHandle.exit\_error

```python
@property
def exit_error() -> Exception | None
```

Why the watch ended: `None` while running or after `stop()`.

## AsyncWatchHandle

```python
class AsyncWatchHandle()
```

A running directory watch, returned by `fs.watch_dir()`.

Callbacks run one at a time, in order, and are awaited. A failing event or
overflow callback ends the watch: that error becomes `exit_error`
and is passed to `on_exit`. Never constructed directly.

To stop a watch from an event, signal the code that holds the handle (an
`asyncio.Event`, or a `threading.Event` with the synchronous client)
and call `stop()` there; this works in every case. As a shorthand, after
a direct `await watch_dir(...)` a callback can call `stop()` on the
returned handle itself: callbacks are held until `watch_dir()` has
returned its handle. When `watch_dir()` runs inside another task
(`asyncio.gather`, `asyncio.create_task`, or `asyncio.wait_for` on
Python 3.10-3.11), or with the synchronous client, the first events can
reach the callback before the caller holds the handle.

With the synchronous client, callbacks run on the SDK's event-loop thread:
there a callback may call its own watch's `stop()` (which then returns
without waiting), `wait_for_exit()` and `exit_error` (which return the
current exit error), but no other synchronous SDK call (another watch's
included): that raises `BridgeError`.

#### AsyncWatchHandle.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncWatchHandle.exit\_error

```python
@property
def exit_error() -> Exception | None
```

Why the watch ended: `None` while running or after `stop()`.

#### AsyncWatchHandle.wait\_for\_exit

```python
async def wait_for_exit() -> Exception | None
```

Wait until the watch ends and return `exit_error` (its own callback: at once).

Called by the watch's own callback, it returns the current exit error
without waiting for itself.

#### AsyncWatchHandle.stop

```python
async def stop() -> None
```

Stop the watch, once a running callback and `on_exit` finish (its own callback: at once).

A callback (or `on_exit`) may call `stop()` on its own watch, also
from a task it started; that call returns without waiting for itself.

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

## FileSearchResult

```python
@dataclass(frozen=True, init=False)
class FileSearchResult(ListResult[T])
```

The result of `sandbox.fs.glob()` / `sandbox.fs.grep()`: a
`ListResult` (one page, `next_cursor` always `None`) plus
`skipped`, the absolute paths below the searched root that the sandbox
user cannot read, so they were not searched (at most 1000; empty when
nothing was skipped). Immutable: `skipped` is a tuple.

**Attributes**:

- `skipped` _Tuple\[str, ...\] = ()_

#### FileSearchResult.\_\_init\_\_

```python
def __init__(*,
             items: Iterable[T],
             next_cursor: Optional[str] = None,
             skipped: Iterable[str] = ()) -> None
```

## SearchResult

```python
@dataclass(frozen=True, init=False)
class SearchResult(Generic[T])
```

One page of `GET /sandboxes/search` (`Daytona.search()`).

`total` is exact when `total_relation == "eq"` and a lower bound when it
is `"gte"` (exact counting is capped at 10 000). Immutable, like
`ListResult`.

**Attributes**:

- `items` _Tuple\[T, ...\]_
- `next_cursor` _Optional\[str\] = None_
- `total` _int = 0_
- `total_relation` _SearchTotalRelation = 'eq'_
- `raw_total_relation` _str = 'eq'_

#### SearchResult.\_\_init\_\_

```python
def __init__(*,
             items: Iterable[T],
             next_cursor: Optional[str] = None,
             total: int = 0,
             total_relation: SearchTotalRelation = 'eq',
             raw_total_relation: str = 'eq') -> None
```

## FilesystemEvent

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class FilesystemEvent()
```

**Attributes**:

- `type` _FilesystemEventType_
- `name` _str_
- `is_dir` _bool_
- `timestamp_ms` _int_ - When the change happened, in Unix milliseconds.

## BulkWriteFile

```python
@dataclass(frozen=True, kw_only=True)
class BulkWriteFile()
```

**Attributes**:

- `path` _str_
- `bytes` _int_

## BulkWriteResult

```python
@dataclass(frozen=True, kw_only=True)
class BulkWriteResult()
```

**Attributes**:

- `files` _tuple\[BulkWriteFile, ...\]_ - The files written.
- `errors` _tuple\[str, ...\]_ - One message per file that was not written.

## BulkReadError

```python
@dataclass(frozen=True, kw_only=True)
class BulkReadError()
```

**Attributes**:

- `path` _str_
- `message` _str_
- `code` _Optional\[str\] = None_
- `source` _Optional\[str\] = None_

## BulkReadResult

```python
@dataclass(frozen=True, kw_only=True)
class BulkReadResult()
```

**Attributes**:

- `files` _Dict\[str, bytes\]_
- `errors` _tuple\[BulkReadError, ...\] = ()_

## FileInfo

```python
@dataclass(frozen=True, kw_only=True)
class FileInfo()
```

One filesystem entry (`fs.list()` / `fs.stat()`).

**Attributes**:

- `name` _str_
- `path` _str_
- `size` _int_
- `is_dir` _bool_
- `mode` _str_ - Symbolic file mode, e.g. `-rw-r--r--`.
- `permissions` _str_ - Octal permission bits, e.g. `0644`.
- `owner` _str_
- `group` _str_
- `modified_at` _datetime_
- `mod_time` _str_ - The modification time as the sandbox formats it; prefer `modified_at`.

## FileMatch

```python
@dataclass(frozen=True, kw_only=True)
class FileMatch()
```

One matching line from `fs.grep()`.

**Attributes**:

- `file` _str_
- `line` _int_ - One-based line number.
- `content` _str_

## ReplaceResult

```python
@dataclass(frozen=True, kw_only=True)
class ReplaceResult()
```

One file's outcome from `fs.replace()`.

**Attributes**:

- `file` _str_
- `success` _bool_
- `error` _Optional\[str\] = None_

## SearchSandboxesOptions

```python
@dataclass(frozen=True, kw_only=True)
class SearchSandboxesOptions(SandboxSearchFilters)
```

Every `Daytona.search()` parameter (`GET /sandboxes/search`).

**Attributes**:

- `name_prefix` _Optional\[str\] = None_
- `id_prefix` _Optional\[str\] = None_
- `cursor` _Optional\[str\] = None_
- `limit` _Optional\[int\] = None_

## WatchEventCallback

```python
WatchEventCallback = Callable[[FilesystemEvent], 'None | Awaitable[None]']
```

`watch_dir()` event callback; may be a coroutine function.

## WatchOverflowCallback

```python
WatchOverflowCallback = Callable[[], 'None | Awaitable[None]']
```

`watch_dir()` overflow callback: the sandbox dropped events; may be a coroutine function.

## WatchExitCallback

```python
WatchExitCallback = Callable[[Optional[Exception]], 'None | Awaitable[None]']
```

`watch_dir()` exit callback: `None` after `stop()`, else the error that ended the watch.

## SIGNED\_FILE\_MAX\_TTL\_SECONDS

```python
SIGNED_FILE_MAX_TTL_SECONDS = 604800
```

## TransferProgressCallback

```python
TransferProgressCallback = Callable[[int, Optional[int]], None]
```

## SearchSandboxState

```python
SearchSandboxState = Literal['queued', 'creating', 'starting', 'started', 'pausing', 'paused', 'stopping', 'stopped', 'destroying', 'destroyed', 'error']
```

## SearchTotalRelation

```python
SearchTotalRelation = Literal['eq', 'gte', 'unknown']
```

## FilesystemEventType

```python
FilesystemEventType = Union[Literal['create', 'write', 'remove', 'rename', 'chmod'], str]
```

What changed in a watched directory: `"create"`, `"write"`, `"remove"`,
`"rename"` or `"chmod"` today. An open vocabulary: a kind a later sandbox
reports is passed through as its string.

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

A search bound: an RFC 3339 timestamp without a leap second (year 0001-9999,
a real calendar date), checked and sent exactly as written; or a `datetime`,
sent in UTC, so its UTC instant must fall in years 0001-9999 (a naive one,
whose `utcoffset()` is `None`, is taken as UTC).
