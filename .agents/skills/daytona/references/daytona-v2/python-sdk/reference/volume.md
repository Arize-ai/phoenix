# Volume (Python SDK reference)

## Contents

- [SandboxVolumesService](#sandboxvolumesservice)
- [AsyncSandboxVolumesService](#asyncsandboxvolumesservice)
- [VolumeService](#volumeservice)
- [AsyncVolumeService](#asyncvolumeservice)
- [PullVolumeResult](#pullvolumeresult)
- [VolumeMount](#volumemount)
- [Volume](#volume)
- [PullVolumeStatus](#pullvolumestatus)
- [VolumeState](#volumestate)
- [VolumeType](#volumetype)

## SandboxVolumesService

```python
class SandboxVolumesService()
```

Pull attached volumes, separate from the root platform volume service.

#### SandboxVolumesService.\_\_init\_\_

```python
def __init__(impl: AsyncSandboxVolumesService, bridge: SyncBridge) -> None
```

#### SandboxVolumesService.pull

```python
def pull(volume_id: str,
         *,
         request_id: str,
         timeout: Optional[float] = None) -> PullVolumeResult
```

Submit/check once; timeout is a server wait in seconds (0–30, default 30).

## AsyncSandboxVolumesService

```python
class AsyncSandboxVolumesService()
```

Pull attached volumes, separate from the root platform volume service.

#### AsyncSandboxVolumesService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncSandboxVolumesService.pull

```python
async def pull(volume_id: str,
               *,
               request_id: str,
               timeout: Optional[float] = None) -> PullVolumeResult
```

Submit/check once; timeout is a server wait in seconds (0–30, default 30).

Zero does not wait: it submits a new request_id, or returns a known one's
last outcome without retrying it; a timeout above zero retries pending,
unavailable or rate-limited work. Expiry does not cancel work. Neither
retries nor identities are automatic.

## VolumeService

```python
class VolumeService()
```

Volume management namespace.

#### VolumeService.\_\_init\_\_

```python
def __init__(impl: AsyncVolumeService, bridge: SyncBridge) -> None
```

#### VolumeService.create

```python
def create(*, name: str, size_gib: Optional[int] = None) -> Volume
```

Create a volume.

#### VolumeService.delete

```python
def delete(volume_id: str, *, id_only: bool = False) -> None
```

Request deletion and return once the API accepts it.

#### VolumeService.get

```python
def get(name_or_id: str, *, create: bool = False, id_only: bool = False) -> Volume
```

Fetch by id or name; `id_only` disables name fallback.

#### VolumeService.iter

```python
def iter(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> Iterator[Volume]
```

#### VolumeService.list

```python
def list(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> ListResult[Volume]
```

List volumes.

## AsyncVolumeService

```python
class AsyncVolumeService()
```

Volume management namespace.

#### AsyncVolumeService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncVolumeService.list

```python
async def list(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> ListResult[Volume]
```

List volumes.

#### AsyncVolumeService.iter

```python
async def iter(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> AsyncIterator[Volume]
```

#### AsyncVolumeService.get

```python
async def get(name_or_id: str, *, create: bool = False, id_only: bool = False) -> Volume
```

Fetch by id or name; `id_only` disables name fallback.

#### AsyncVolumeService.create

```python
async def create(*, name: str, size_gib: Optional[int] = None) -> Volume
```

Create a volume.

#### AsyncVolumeService.delete

```python
async def delete(volume_id: str, *, id_only: bool = False) -> None
```

Request deletion and return once the API accepts it.

## PullVolumeResult

```python
@dataclass(frozen=True)
class PullVolumeResult()
```

**Attributes**:

- `request_id` _str_
- `status` _PullVolumeStatus_
- `manifest_id` _Optional\[str\]_
- `raw_status` _Optional\[str\] = None_

## VolumeMount

```python
@dataclass(frozen=True)
class VolumeMount()
```

Attach a volume to a sandbox.

**Attributes**:

- `volume_id` _str_
- `mount_path` _str_
- `subpath` _Optional\[str\] = None_
- `read_only` _Optional\[bool\] = None_

## Volume

```python
@dataclass(frozen=True, slots=True)
class Volume()
```

**Attributes**:

- `id` _str_
- `name` _str_
- `type` _VolumeType_
- `raw_type` _str_
- `status` _VolumeState_
- `raw_status` _str_
- `created_at` _datetime_
- `updated_at` _datetime_
- `size_gib` _Optional\[int\] = None_
- `error` _Optional\[str\] = None_
- `last_used_at` _Optional\[datetime\] = None_
- `options` _Optional\[JsonObject\] = None_
- `used_bytes` _Optional\[int\] = None_
- `used_bytes_at` _Optional\[datetime\] = None_

## PullVolumeStatus

```python
PullVolumeStatus = Literal['pulled', 'unchanged', 'pending', 'unknown']
```

## VolumeState

```python
VolumeState = Literal['ready', 'deleting', 'deleted', 'error', 'unknown']
```

## VolumeType

```python
VolumeType = Literal['disk', 'bucket', 'unknown']
```
