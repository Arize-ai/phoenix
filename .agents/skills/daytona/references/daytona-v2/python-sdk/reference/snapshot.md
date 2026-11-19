# Snapshot (Python SDK reference)

## Contents

- [SnapshotsService](#snapshotsservice)
- [AsyncSnapshotsService](#asyncsnapshotsservice)
- [Snapshot](#snapshot)

## SnapshotsService

```python
class SnapshotsService()
```

Sandbox snapshot namespace.

#### SnapshotsService.\_\_init\_\_

```python
def __init__() -> None
```

#### SnapshotsService.delete

```python
def delete(snapshot_id: str, /) -> None
```

Delete a snapshot (409 while sandboxes still depend on it).

#### SnapshotsService.get

```python
def get(snapshot_id: str,
        /,
        *,
        wait: Optional[Literal['ready']] = None,
        timeout: Optional[float] = None) -> Snapshot
```

Fetch a snapshot; `wait="ready"` waits as `ImagesService.get` does.

`"search"` cannot be looked up by name (`GET /snapshots/search` is
the search route): it raises `BadRequestError` before any
request; read such a snapshot by its ID.

#### SnapshotsService.iter

```python
def iter(*,
         name: Optional[str] = None,
         sandbox_id: Optional[str] = None,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> Iterator[Snapshot]
```

#### SnapshotsService.list

```python
def list(*,
         name: Optional[str] = None,
         sandbox_id: Optional[str] = None,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> ListResult[Snapshot]
```

List snapshots, one page.

Reads `GET /snapshots/search` (every region, eventually consistent: a
snapshot you just captured may be missing until the index catches up; `get`
reads it at once) and, on a deployment without search,
`GET /snapshots`.

## AsyncSnapshotsService

```python
class AsyncSnapshotsService()
```

Sandbox snapshot namespace.

#### AsyncSnapshotsService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncSnapshotsService.list

```python
async def list(*,
               name: Optional[str] = None,
               sandbox_id: Optional[str] = None,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> ListResult[Snapshot]
```

List snapshots, one page.

Reads `GET /snapshots/search` (every region, eventually consistent: a
snapshot you just captured may be missing until the index catches up; `get`
reads it at once) and, on a deployment without search,
`GET /snapshots`.

#### AsyncSnapshotsService.iter

```python
async def iter(*,
               name: Optional[str] = None,
               sandbox_id: Optional[str] = None,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> AsyncIterator[Snapshot]
```

#### AsyncSnapshotsService.get

```python
async def get(snapshot_id: str,
              /,
              *,
              wait: Optional[Literal['ready']] = None,
              timeout: Optional[float] = None) -> Snapshot
```

Fetch a snapshot; `wait="ready"` waits as `AsyncImagesService.get` does.

`"search"` cannot be looked up by name (`GET /snapshots/search` is
the search route): it raises `BadRequestError` before any
request; read such a snapshot by its ID.

#### AsyncSnapshotsService.delete

```python
async def delete(snapshot_id: str, /) -> None
```

Delete a snapshot (409 while sandboxes still depend on it).

## Snapshot

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class Snapshot()
```

**Attributes**:

- `id` _str_
- `name` _str_
- `status` _str_
- `region` _str_
- `kind` _SnapshotKind_
- `raw_kind` _str_
- `sandbox_class` _SnapshotClass_
- `raw_sandbox_class` _str_
- `available_in` _tuple\[str, ...\]_
- `created_at` _datetime_
- `updated_at` _datetime_
- `error` _Optional\[str\] = None_
- `bytes` _Optional\[int\] = None_
- `memory_bytes` _Optional\[int\] = None_
- `sandbox_id` _Optional\[str\] = None_
