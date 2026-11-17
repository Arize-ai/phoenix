# Snapshot (Python SDK reference)

## Contents

- [SnapshotService](#snapshotservice)
- [AsyncSnapshotService](#asyncsnapshotservice)
- [Snapshot](#snapshot)

## SnapshotService

```python
class SnapshotService()
```

Sandbox snapshot namespace.

#### SnapshotService.\_\_init\_\_

```python
def __init__(impl: AsyncSnapshotService, bridge: SyncBridge) -> None
```

#### SnapshotService.delete

```python
def delete(snapshot_id: str) -> None
```

Delete a snapshot (409 while sandboxes still depend on it).

#### SnapshotService.get

```python
def get(snapshot_id: str,
        *,
        wait: Optional[Literal['ready']] = None,
        timeout: Optional[float] = None) -> Snapshot
```

#### SnapshotService.iter

```python
def iter(*,
         name: Optional[str] = None,
         sandbox_id: Optional[str] = None,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> Iterator[Snapshot]
```

#### SnapshotService.list

```python
def list(*,
         name: Optional[str] = None,
         sandbox_id: Optional[str] = None,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> ListResult[Snapshot]
```

## AsyncSnapshotService

```python
class AsyncSnapshotService()
```

Sandbox snapshot namespace.

#### AsyncSnapshotService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncSnapshotService.list

```python
async def list(*,
               name: Optional[str] = None,
               sandbox_id: Optional[str] = None,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> ListResult[Snapshot]
```

#### AsyncSnapshotService.iter

```python
async def iter(*,
               name: Optional[str] = None,
               sandbox_id: Optional[str] = None,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> AsyncIterator[Snapshot]
```

#### AsyncSnapshotService.get

```python
async def get(snapshot_id: str,
              *,
              wait: Optional[Literal['ready']] = None,
              timeout: Optional[float] = None) -> Snapshot
```

#### AsyncSnapshotService.delete

```python
async def delete(snapshot_id: str) -> None
```

Delete a snapshot (409 while sandboxes still depend on it).

## Snapshot

```python
@dataclass(frozen=True, slots=True)
class Snapshot()
```

**Attributes**:

- `id` _str_
- `name` _str_
- `status` _str_
- `region` _str_
- `kind` _SnapshotKind_
- `var_class` _str_
- `available_in` _list\[str\]_
- `created_at` _Optional\[str\] = None_
- `error` _Optional\[str\] = None_
- `bytes` _Optional\[int\] = None_
- `memory_bytes` _Optional\[int\] = None_
- `sandbox_id` _Optional\[str\] = None_
- `raw_kind` _str = field(default='', kw_only=True)_
- `cursor` _Optional\[str\] = None_
- `updated_at` _Optional\[str\] = None_
