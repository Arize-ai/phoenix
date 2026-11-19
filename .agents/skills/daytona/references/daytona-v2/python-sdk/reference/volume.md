# Volume (Python SDK reference)

## Contents

- [SandboxVolumesService](#sandboxvolumesservice)
- [AsyncSandboxVolumesService](#asyncsandboxvolumesservice)
- [VolumesService](#volumesservice)
- [AsyncVolumesService](#asyncvolumesservice)
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
def __init__() -> None
```

#### SandboxVolumesService.pull

```python
def pull(volume_id: str,
         /,
         *,
         request_id: str,
         timeout: Optional[float] = None) -> PullVolumeResult
```

Submit/check once; timeout is a server wait in seconds (0–30, default 30).

`volume_id` is the attached volume's `vol_` ID or its UUID. Zero
does not wait: it submits a new request_id, or returns a known one's
last outcome without retrying it; a timeout above zero retries pending,
unavailable or rate-limited work. Expiry does not cancel work. Neither
retries nor identities are automatic.

## AsyncSandboxVolumesService

```python
class AsyncSandboxVolumesService()
```

Pull attached volumes, separate from the root platform volume service.

#### AsyncSandboxVolumesService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncSandboxVolumesService.pull

```python
async def pull(volume_id: str,
               /,
               *,
               request_id: str,
               timeout: Optional[float] = None) -> PullVolumeResult
```

Submit/check once; timeout is a server wait in seconds (0–30, default 30).

`volume_id` is the attached volume's `vol_` ID or its UUID. Zero
does not wait: it submits a new request_id, or returns a known one's
last outcome without retrying it; a timeout above zero retries pending,
unavailable or rate-limited work. Expiry does not cancel work. Neither
retries nor identities are automatic.

## VolumesService

```python
class VolumesService()
```

Volume management namespace.

#### VolumesService.\_\_init\_\_

```python
def __init__() -> None
```

#### VolumesService.create

```python
def create(*,
           name: str,
           size_gib: Optional[int] = None,
           type: Optional[Literal['disk', 'bucket']] = None) -> Volume
```

Create a volume.

`type` omitted lets the server choose the volume's type; `size_gib`
(disk volumes only) omitted uses the server default.

#### VolumesService.delete

```python
def delete(name_or_id: str, /, *, id_only: bool = False) -> None
```

Request deletion by id or name and return once the API accepts it; `id_only` disables name lookup.

#### VolumesService.get

```python
def get(name_or_id: str, /, *, create: bool = False, id_only: bool = False) -> Volume
```

Fetch by id or name; `id_only` disables name fallback.

#### VolumesService.iter

```python
def iter(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> Iterator[Volume]
```

#### VolumesService.list

```python
def list(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> ListResult[Volume]
```

List volumes.

## AsyncVolumesService

```python
class AsyncVolumesService()
```

Volume management namespace.

#### AsyncVolumesService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncVolumesService.list

```python
async def list(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> ListResult[Volume]
```

List volumes.

#### AsyncVolumesService.iter

```python
async def iter(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> AsyncIterator[Volume]
```

#### AsyncVolumesService.get

```python
async def get(name_or_id: str,
              /,
              *,
              create: bool = False,
              id_only: bool = False) -> Volume
```

Fetch by id or name; `id_only` disables name fallback.

#### AsyncVolumesService.create

```python
async def create(*,
                 name: str,
                 size_gib: Optional[int] = None,
                 type: Optional[Literal['disk', 'bucket']] = None) -> Volume
```

Create a volume.

`type` omitted lets the server choose the volume's type; `size_gib`
(disk volumes only) omitted uses the server default.

#### AsyncVolumesService.delete

```python
async def delete(name_or_id: str, /, *, id_only: bool = False) -> None
```

Request deletion by id or name and return once the API accepts it; `id_only` disables name lookup.

## PullVolumeResult

```python
@dataclass(frozen=True, kw_only=True)
class PullVolumeResult()
```

**Attributes**:

- `request_id` _str_
- `status` _PullVolumeStatus_
- `raw_status` _str_
- `manifest_id` _Optional\[str\] = None_

## VolumeMount

```python
@dataclass(frozen=True, kw_only=True)
class VolumeMount()
```

Attach a volume to a sandbox.

`mount_path` is an absolute path with no `..` component. The API
normalizes it (repeated slashes, `.` components and a trailing slash are
removed) and refuses `/` and any path on or beneath `/bin`, `/boot`,
`/dev`, `/etc`, `/lib`, `/lib32`, `/lib64`, `/mnt/scratch`,
`/overlay`, `/proc`, `/sbin`, `/sys` or `/usr`, or one with a
control character: the create raises
`daytona.v2.errors.BadRequestError` (400).

**Attributes**:

- `volume_id` _str_
- `mount_path` _str_
- `subpath` _Optional\[str\] = None_
- `read_only` _Optional\[bool\] = None_

## Volume

```python
@dataclass(frozen=True, slots=True, kw_only=True)
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
- `options` _Optional\[Mapping\[str, JsonValue\]\] = None_
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
