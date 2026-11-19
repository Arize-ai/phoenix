# Image (Python SDK reference)

## Contents

- [ImagesService](#imagesservice)
- [AsyncImagesService](#asyncimagesservice)
- [BuildLogFollowResult](#buildlogfollowresult)
- [BuildLogStateEvent](#buildlogstateevent)
- [BuildLogChunkEvent](#buildlogchunkevent)
- [BuildLogGapEvent](#buildloggapevent)
- [BuildLogUnavailableEvent](#buildlogunavailableevent)
- [BuildLogSourceChangedEvent](#buildlogsourcechangedevent)
- [BuildLogDoneEvent](#buildlogdoneevent)
- [BuildLogErrorEvent](#buildlogerrorevent)
- [ImageBuilder](#imagebuilder)
- [ImageRef](#imageref)
- [ImageBuildLimits](#imagebuildlimits)
- [Image](#image)
- [DockerfileImageSource](#dockerfileimagesource)
- [UnknownImageSource](#unknownimagesource)
- [BuildLogDoneReason](#buildlogdonereason)
- [BuildLogGapReason](#buildloggapreason)
- [BuildLogEvent](#buildlogevent)
- [BuildLogsCallback](#buildlogscallback)
- [BuildLogEventCallback](#buildlogeventcallback)
- [ImageStatus](#imagestatus)
- [ArtifactRetention](#artifactretention)
- [ImageSource](#imagesource)

## ImagesService

```python
class ImagesService()
```

Image build/pull/list namespace.

#### ImagesService.\_\_init\_\_

```python
def __init__() -> None
```

#### ImagesService.build

```python
def build(builder: ImageBuilder,
          /,
          *,
          name: Optional[str] = None,
          idle_expiry_seconds: Optional[int] = None,
          region: Optional[str] = None,
          cpu_arch: Optional[CpuArch] = None) -> Image
```

Build (or import) an image from an `ImageBuilder` declaration.

The builder is the only way to say WHAT to build — `ImageBuilder.
from_dockerfile(...)`, `.from_registry(...)`, or the fluent
`.run_commands` / `.env` / `.workdir` chain — in both SDKs
(parity with TypeScript's `images.build(builder, options)`). `name`
omitted makes the image anonymous; `idle_expiry_seconds` is then its
idle-retention window — deleted once that long has passed without a
sandbox being created from it (every create restarts the clock);
omitted ⇒ the maximum retention supported by the API. A `name` may
not start with a resource id prefix (`img_`, `snap_`, `sbx_`,
`vol_`, `fn_`; `ImageNameReservedError`). A name that already
exists for different content or import options raises
`ImageNameTakenError` and changes nothing; an identical named
import returns the existing image (a failed one is imported again).
`region`
follows create's rule: omitted, blank or `local` (any case, any
surrounding whitespace) uses the project's default region and sends no
`region_id`; any other value is sent as given and must be printable
ASCII with no leading or trailing whitespace. The submission is an
ordinary request, bounded by the client's request timeout; it returns
without waiting for the build (`get(image.id, wait="ready")`).
Local files recorded by the builder are read at build time, archived
deterministically and uploaded as a build context before submission.
Each upload part fails once no bytes move for the client's request
timeout (`0`: never); each completion attempt uses the greater of
that timeout and 600 seconds (`0`: no bound). No total deadline
bounds the upload.
With local files, `name` and `idle_expiry_seconds` cannot be
combined: idle expiry applies only to anonymous images.

#### ImagesService.build\_from\_context

```python
def build_from_context(context: BuildContext,
                       /,
                       *,
                       dockerfile: str = 'Dockerfile',
                       name: Optional[str] = None,
                       idle_expiry_seconds: Optional[int] = None,
                       region: Optional[str] = None,
                       cpu_arch: Optional[CpuArch] = None,
                       timeout: Optional[float] = None) -> Image
```

Build an image from a directory or a build-context tar archive.

`context` is a directory path, archive bytes or the path of a `.tar`
file, up to 1 GiB; `dockerfile` is the Dockerfile's path inside it.
Directories are archived deterministically with BuildKit ignore rules:
`<dockerfile>.dockerignore` takes precedence over `.dockerignore`.
The Dockerfile and the ignore files are always included. The archive
is uploaded straight to storage in parts and verified by the API
before the build starts; an identical archive the project already
uploaded is reused without uploading it again. The other arguments
are those of `build`. `name` and `idle_expiry_seconds`
cannot be combined: idle expiry applies only to anonymous images.
`timeout` bounds the build request that follows the upload, in
seconds, replacing the client's request timeout for it; `0`, or a
value above about 24.8 days, is no limit. The upload keeps its own
bounds. Returns as soon as the build is submitted; wait with
`get` (`wait="ready"`).

#### ImagesService.delete

```python
def delete(image_id: str, /) -> None
```

#### ImagesService.follow\_build\_logs

```python
def follow_build_logs(image_id: str,
                      /,
                      *,
                      on_logs: BuildLogsCallback,
                      on_event: Optional[BuildLogEventCallback] = None,
                      cursor: Optional[str] = None,
                      timeout: Optional[float] = None) -> BuildLogFollowResult
```

Observe a submitted image build. `timeout` is the observation budget
in seconds (not an execution TTL); omitted, `0` or a value above about
24.8 days adds no deadline.

#### ImagesService.get

```python
def get(image_id: str,
        /,
        *,
        wait: Literal['ready'] | None = None,
        timeout: Optional[float] = None) -> Image
```

Fetch an image; `wait="ready"` waits for it to finish building.

With a positive `timeout` (seconds) the wait repeats the server's
long poll (each at most 60 s) until the image is `ready`, `failed`
or `error` and returns it (check its status); a budget above the
timer maximum waits without a deadline. A budget that runs out first
raises `RequestTimeoutError`. Without one (omitted or `0`), a
single long poll of the server's default length returns what the
server reports.

`"search"` cannot be looked up by name (`GET /images/search` is the
search route): it raises `BadRequestError` before any request;
read such an image by its ID.

#### ImagesService.iter

```python
def iter(*,
         anonymous: bool = False,
         sandbox_id: Optional[str] = None,
         name: Optional[str] = None,
         cursor: Optional[str] = None,
         limit: Optional[int] = None,
         platform: Optional[Literal['true', 'false', 'any']] = None) -> Iterator[Image]
```

#### ImagesService.list

```python
def list(*,
         anonymous: bool = False,
         sandbox_id: Optional[str] = None,
         name: Optional[str] = None,
         cursor: Optional[str] = None,
         limit: Optional[int] = None,
         platform: Optional[Literal['true', 'false', 'any']] = None) -> ListResult[Image]
```

List images, one page.

Reads `GET /images/search` (every region, eventually consistent: an
image you just created may be missing until the index catches up; `get`
reads it at once) and, on a deployment without search, `GET /images`.

`platform` picks the shared images Daytona publishes for every
project: `"false"` (the server default) lists the project's own
images, `"true"` lists only the non-deprecated platform images (the
default one carries `default=True`), and `"any"` lists both.

#### ImagesService.promote

```python
def promote(image_id: str, name: str, /) -> Image
```

Name an ANONYMOUS image, making it permanent (`PATCH /images/{id}`).

Promotion only: an image that already has a name answers 409 — renaming
a named image is not offered (sandboxes reference images by id, so a
rename would silently relabel every sandbox created from it). A name
that already exists raises `ImageNameTakenError`; a reserved
prefix (`img_`, `snap_`, `sbx_`, `vol_`, `fn_`) raises
`ImageNameReservedError`.

#### ImagesService.pull

```python
def pull(image: str,
         /,
         *,
         name: Optional[str] = None,
         idle_expiry_seconds: Optional[int] = None,
         region: Optional[str] = None,
         cpu_arch: Optional[CpuArch] = None,
         wait: bool = True,
         timeout: Optional[float] = None) -> Image
```

Import a registry image, waiting until ready unless `wait=False`.

Takes the same image options as `build`. `timeout` is the
total pull budget in seconds (submission and readiness); omitted,
zero or a value above about 24.8 days waits without a deadline. The submission is also bounded by the
client's request timeout. A failed import raises
`ImageBuildFailedError` with the server's recorded error.

## AsyncImagesService

```python
class AsyncImagesService()
```

Image build/pull/list namespace.

#### AsyncImagesService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncImagesService.follow\_build\_logs

```python
async def follow_build_logs(image_id: str,
                            /,
                            *,
                            on_logs: BuildLogsCallback,
                            on_event: Optional[BuildLogEventCallback] = None,
                            cursor: Optional[str] = None,
                            timeout: Optional[float] = None) -> BuildLogFollowResult
```

Observe a submitted image build. `timeout` is the observation budget
in seconds (not an execution TTL); omitted, `0` or a value above about
24.8 days adds no deadline.

#### AsyncImagesService.build

```python
async def build(builder: ImageBuilder,
                /,
                *,
                name: Optional[str] = None,
                idle_expiry_seconds: Optional[int] = None,
                region: Optional[str] = None,
                cpu_arch: Optional[CpuArch] = None) -> Image
```

Build (or import) an image from an `ImageBuilder` declaration.

The builder is the only way to say WHAT to build — `ImageBuilder.
from_dockerfile(...)`, `.from_registry(...)`, or the fluent
`.run_commands` / `.env` / `.workdir` chain — in both SDKs
(parity with TypeScript's `images.build(builder, options)`). `name`
omitted makes the image anonymous; `idle_expiry_seconds` is then its
idle-retention window — deleted once that long has passed without a
sandbox being created from it (every create restarts the clock);
omitted ⇒ the maximum retention supported by the API. A `name` may
not start with a resource id prefix (`img_`, `snap_`, `sbx_`,
`vol_`, `fn_`; `ImageNameReservedError`). A name that already
exists for different content or import options raises
`ImageNameTakenError` and changes nothing; an identical named
import returns the existing image (a failed one is imported again).
`region`
follows create's rule: omitted, blank or `local` (any case, any
surrounding whitespace) uses the project's default region and sends no
`region_id`; any other value is sent as given and must be printable
ASCII with no leading or trailing whitespace. The submission is an
ordinary request, bounded by the client's request timeout; it returns
without waiting for the build (`get(image.id, wait="ready")`).
Local files recorded by the builder are read at build time, archived
deterministically and uploaded as a build context before submission.
Each upload part fails once no bytes move for the client's request
timeout (`0`: never); each completion attempt uses the greater of
that timeout and 600 seconds (`0`: no bound). No total deadline
bounds the upload.
With local files, `name` and `idle_expiry_seconds` cannot be
combined: idle expiry applies only to anonymous images.

#### AsyncImagesService.build\_from\_context

```python
async def build_from_context(context: BuildContext,
                             /,
                             *,
                             dockerfile: str = 'Dockerfile',
                             name: Optional[str] = None,
                             idle_expiry_seconds: Optional[int] = None,
                             region: Optional[str] = None,
                             cpu_arch: Optional[CpuArch] = None,
                             timeout: Optional[float] = None) -> Image
```

Build an image from a directory or a build-context tar archive.

`context` is a directory path, archive bytes or the path of a `.tar`
file, up to 1 GiB; `dockerfile` is the Dockerfile's path inside it.
Directories are archived deterministically with BuildKit ignore rules:
`<dockerfile>.dockerignore` takes precedence over `.dockerignore`.
The Dockerfile and the ignore files are always included. The archive
is uploaded straight to storage in parts and verified by the API
before the build starts; an identical archive the project already
uploaded is reused without uploading it again. The other arguments
are those of `build`. `name` and `idle_expiry_seconds`
cannot be combined: idle expiry applies only to anonymous images.
`timeout` bounds the build request that follows the upload, in
seconds, replacing the client's request timeout for it; `0`, or a
value above about 24.8 days, is no limit. The upload keeps its own
bounds. Returns as soon as the build is submitted; wait with
`get` (`wait="ready"`).

#### AsyncImagesService.pull

```python
async def pull(image: str,
               /,
               *,
               name: Optional[str] = None,
               idle_expiry_seconds: Optional[int] = None,
               region: Optional[str] = None,
               cpu_arch: Optional[CpuArch] = None,
               wait: bool = True,
               timeout: Optional[float] = None) -> Image
```

Import a registry image, waiting until ready unless `wait=False`.

Takes the same image options as `build`. `timeout` is the
total pull budget in seconds (submission and readiness); omitted,
zero or a value above about 24.8 days waits without a deadline. The submission is also bounded by the
client's request timeout. A failed import raises
`ImageBuildFailedError` with the server's recorded error.

#### AsyncImagesService.get

```python
async def get(image_id: str,
              /,
              *,
              wait: Literal['ready'] | None = None,
              timeout: Optional[float] = None) -> Image
```

Fetch an image; `wait="ready"` waits for it to finish building.

With a positive `timeout` (seconds) the wait repeats the server's
long poll (each at most 60 s) until the image is `ready`, `failed`
or `error` and returns it (check its status); a budget above the
timer maximum waits without a deadline. A budget that runs out first
raises `RequestTimeoutError`. Without one (omitted or `0`), a
single long poll of the server's default length returns what the
server reports.

`"search"` cannot be looked up by name (`GET /images/search` is the
search route): it raises `BadRequestError` before any request;
read such an image by its ID.

#### AsyncImagesService.promote

```python
async def promote(image_id: str, name: str, /) -> Image
```

Name an ANONYMOUS image, making it permanent (`PATCH /images/{id}`).

Promotion only: an image that already has a name answers 409 — renaming
a named image is not offered (sandboxes reference images by id, so a
rename would silently relabel every sandbox created from it). A name
that already exists raises `ImageNameTakenError`; a reserved
prefix (`img_`, `snap_`, `sbx_`, `vol_`, `fn_`) raises
`ImageNameReservedError`.

#### AsyncImagesService.delete

```python
async def delete(image_id: str, /) -> None
```

#### AsyncImagesService.list

```python
async def list(*,
               anonymous: bool = False,
               sandbox_id: Optional[str] = None,
               name: Optional[str] = None,
               cursor: Optional[str] = None,
               limit: Optional[int] = None,
               platform: Optional[Literal['true', 'false', 'any']] = None) -> ListResult[Image]
```

List images, one page.

Reads `GET /images/search` (every region, eventually consistent: an
image you just created may be missing until the index catches up; `get`
reads it at once) and, on a deployment without search, `GET /images`.

`platform` picks the shared images Daytona publishes for every
project: `"false"` (the server default) lists the project's own
images, `"true"` lists only the non-deprecated platform images (the
default one carries `default=True`), and `"any"` lists both.

#### AsyncImagesService.iter

```python
async def iter(*,
               anonymous: bool = False,
               sandbox_id: Optional[str] = None,
               name: Optional[str] = None,
               cursor: Optional[str] = None,
               limit: Optional[int] = None,
               platform: Optional[Literal['true', 'false', 'any']] = None) -> AsyncIterator[Image]
```

## BuildLogFollowResult

```python
@dataclass(frozen=True, kw_only=True)
class BuildLogFollowResult()
```

**Attributes**:

- `status` _str_
- `reason` _BuildLogDoneReason_
- `output_complete` _bool_
- `cursor` _str \| None = None_
- `raw_reason` _str \| None = None_

## BuildLogStateEvent

```python
@dataclass(frozen=True, kw_only=True)
class BuildLogStateEvent()
```

**Attributes**:

- `status` _str_
- `error` _str \| None = None_
- `deadline_at` _datetime \| None = None_
- `type` _Literal\['state'\] = 'state'_

## BuildLogChunkEvent

```python
@dataclass(frozen=True, kw_only=True)
class BuildLogChunkEvent()
```

**Attributes**:

- `data_base64` _str_
- `start_offset` _str_
- `next_offset` _str_
- `cursor` _str_
- `type` _Literal\['log'\] = 'log'_

## BuildLogGapEvent

```python
@dataclass(frozen=True, kw_only=True)
class BuildLogGapEvent()
```

**Attributes**:

- `requested_offset` _str_
- `first_available_offset` _str_
- `dropped_bytes` _str_
- `cursor` _str_
- `reason` _BuildLogGapReason = 'truncated'_
- `type` _Literal\['gap'\] = 'gap'_
- `raw_reason` _str \| None = None_

## BuildLogUnavailableEvent

```python
@dataclass(frozen=True, kw_only=True)
class BuildLogUnavailableEvent()
```

**Attributes**:

- `reason` _str_
- `type` _Literal\['unavailable'\] = 'unavailable'_

## BuildLogSourceChangedEvent

```python
@dataclass(frozen=True, kw_only=True)
class BuildLogSourceChangedEvent()
```

**Attributes**:

- `reason` _str_
- `type` _Literal\['source_changed'\] = 'source_changed'_

## BuildLogDoneEvent

```python
@dataclass(frozen=True, kw_only=True)
class BuildLogDoneEvent()
```

**Attributes**:

- `result` _BuildLogFollowResult_
- `type` _Literal\['done'\] = 'done'_

## BuildLogErrorEvent

```python
@dataclass(frozen=True, kw_only=True)
class BuildLogErrorEvent()
```

**Attributes**:

- `error` _str_
- `code` _str_
- `retryable` _bool_
- `trace_id` _str \| None = None_
- `type` _Literal\['error'\] = 'error'_

## ImageBuilder

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ImageBuilder()
```

A declarative image source: build one with `from_registry` or `from_dockerfile`.

#### ImageBuilder.from\_registry

```python
@classmethod
def from_registry(ref: str, /) -> Self
```

#### ImageBuilder.from\_dockerfile

```python
@classmethod
def from_dockerfile(content: str, /) -> Self
```

#### ImageBuilder.debian\_slim

```python
@classmethod
def debian_slim(python_version: str | None = None) -> Self
```

#### ImageBuilder.add\_local\_file

```python
def add_local_file(local_path: str | os.PathLike[str], remote_path: str, /) -> Self
```

#### ImageBuilder.add\_local\_dir

```python
def add_local_dir(local_path: str | os.PathLike[str], remote_path: str, /) -> Self
```

#### ImageBuilder.pip\_install\_from\_requirements

```python
def pip_install_from_requirements(requirements_txt: str | os.PathLike[str], /) -> Self
```

#### ImageBuilder.pip\_install

```python
def pip_install(*packages: str) -> Self
```

#### ImageBuilder.run\_commands

```python
def run_commands(*commands: str) -> Self
```

#### ImageBuilder.env

```python
@overload
def env(name: str, value: str, /) -> Self
```

#### ImageBuilder.env

```python
@overload
def env(values: Mapping[str, str], /) -> Self
```

#### ImageBuilder.workdir

```python
def workdir(path: str, /) -> Self
```

#### ImageBuilder.user

```python
def user(name: str, /) -> Self
```

#### ImageBuilder.cmd

```python
def cmd(*args: str) -> Self
```

#### ImageBuilder.entrypoint

```python
def entrypoint(*args: str) -> Self
```

#### ImageBuilder.to\_dockerfile

```python
def to_dockerfile() -> str
```

Render the Dockerfile the build request carries.

Byte-identical to TypeScript's `ImageBuilder.toDockerfile()` for the
same builder: one line per layer, a single trailing newline (a POSIX
text file), no trailing whitespace.

## ImageRef

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ImageRef()
```

**Attributes**:

- `id` _str_
- `name` _Optional\[str\] = None_

## ImageBuildLimits

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ImageBuildLimits()
```

**Attributes**:

- `concurrent` _UsageLimit_

## Image

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class Image()
```

**Attributes**:

- `id` _str_
- `name` _Optional\[str\]_
- `status` _ImageStatus_
- `region` _str_
- `anonymous` _bool_
- `retention` _ArtifactRetention_
- `raw_retention` _str_
- `sandbox_class` _str_
- `available_in` _tuple\[str, ...\]_
- `origin` _str_
- `created_at` _datetime_
- `updated_at` _datetime_
- `error` _Optional\[str\] = None_
- `expires_at` _Optional\[datetime\] = None_
- `source` _Optional\[ImageSource\] = None_
- `bytes` _Optional\[int\] = None_
- `layer_count` _Optional\[int\] = None_
- `format_version` _Optional\[int\] = None_
- `format_outdated` _bool = False_
- `platform` _bool = False_
- `default` _bool = False_
- `deprecated` _bool = False_
- `disk_mib` _Optional\[int\] = None_

## DockerfileImageSource

```python
@dataclass(frozen=True, kw_only=True, slots=True)
class DockerfileImageSource()
```

An image built from a Dockerfile and its uploaded build context.

**Attributes**:

- `dockerfile` _str_
- `type` _Literal\['dockerfile'\] = 'dockerfile'_

## UnknownImageSource

```python
@dataclass(frozen=True, kw_only=True, slots=True)
class UnknownImageSource()
```

A source kind this SDK release does not know (a later API added it).

`raw_type` is the wire `source.type`; the source's other fields are not
read. Handle it as "some other source" rather than treating it as an error.

**Attributes**:

- `raw_type` _str_
- `type` _Literal\['unknown'\] = 'unknown'_

## BuildLogDoneReason

```python
BuildLogDoneReason = Literal['terminal', 'deadline', 'not_applicable', 'resource_deleted', 'unknown']
```

## BuildLogGapReason

```python
BuildLogGapReason = Literal['truncated', 'unknown']
```

## BuildLogEvent

```python
BuildLogEvent = BuildLogStateEvent | BuildLogChunkEvent | BuildLogGapEvent | BuildLogUnavailableEvent | BuildLogSourceChangedEvent | BuildLogDoneEvent | BuildLogErrorEvent
```

## BuildLogsCallback

```python
BuildLogsCallback = Callable[[str], 'None | Awaitable[None]']
```

Receives decoded build output; may return an awaitable, awaited before the next event.

## BuildLogEventCallback

```python
BuildLogEventCallback = Callable[[BuildLogEvent], 'None | Awaitable[None]']
```

Receives each typed `BuildLogEvent`; may return an awaitable, awaited before the next event.

## ImageStatus

```python
ImageStatus = Union[Literal['pending', 'building', 'ready', 'failed'], str]
```

## ArtifactRetention

```python
ArtifactRetention = Literal['permanent', 'idle', 'unknown']
```

## ImageSource

```python
ImageSource = Union[RegistryImageSource, DockerfileImageSource, NamedImageSource, ManifestImageSource, UnknownImageSource]
```
