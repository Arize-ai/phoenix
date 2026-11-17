# Image (Python SDK reference)

## Contents

- [ImageService](#imageservice)
- [AsyncImageService](#asyncimageservice)
- [ImageListItem](#imagelistitem)
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
- [Image](#image)
- [BuildLogDoneReason](#buildlogdonereason)
- [BuildLogGapReason](#buildloggapreason)
- [BuildLogEvent](#buildlogevent)
- [ImageBuildResponse](#imagebuildresponse)
- [ArtifactRetention](#artifactretention)
- [ImageSource](#imagesource)

## ImageService

```python
class ImageService()
```

Image build/pull/list namespace.

#### ImageService.\_\_init\_\_

```python
def __init__(impl: AsyncImageService, bridge: SyncBridge) -> None
```

#### ImageService.build

```python
def build(builder: ImageBuilder,
          /,
          *,
          name: Optional[str] = None,
          idle_expiry_seconds: Optional[int] = None,
          region: Optional[str] = None,
          cpu_arch: Optional[str] = None,
          timeout: Optional[float] = None) -> Image
```

Build (or import) an image from an `ImageBuilder` declaration.

#### ImageService.delete

```python
def delete(image_id: str) -> None
```

#### ImageService.follow\_build\_logs

```python
def follow_build_logs(image_id: str,
                      *,
                      on_logs: _LogsCallback,
                      on_event: Optional[_EventCallback] = None,
                      cursor: Optional[str] = None,
                      timeout: Optional[float] = None) -> BuildLogFollowResult
```

Observe a submitted image build. Timeout is in seconds, not execution TTL.

#### ImageService.get

```python
def get(image_id: str,
        *,
        wait: Literal['ready'] | None = None,
        timeout: Optional[float] = None) -> Image
```

#### ImageService.iter

```python
def iter(*,
         anonymous: bool = False,
         sandbox_id: Optional[str] = None,
         name: Optional[str] = None,
         cursor: Optional[str] = None,
         limit: Optional[int] = None,
         platform: Optional[Literal['true', 'false', 'any']] = None) -> Iterator[Image]
```

#### ImageService.list

```python
def list(*,
         anonymous: bool = False,
         sandbox_id: Optional[str] = None,
         name: Optional[str] = None,
         cursor: Optional[str] = None,
         limit: Optional[int] = None,
         platform: Optional[Literal['true', 'false', 'any']] = None) -> ListResult[Image]
```

List images (`GET /images`).

#### ImageService.promote

```python
def promote(image_id: str, name: str) -> Image
```

Name an ANONYMOUS image, making it permanent (`PATCH /images/{id}`).

#### ImageService.pull

```python
def pull(image: str,
         *,
         name: Optional[str] = None,
         region: Optional[str] = None,
         wait: bool = True,
         timeout: Optional[float] = None) -> Image
```

Import a registry image, waiting until ready unless `wait=False`.

## AsyncImageService

```python
class AsyncImageService()
```

Image build/pull/list namespace.

#### AsyncImageService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncImageService.follow\_build\_logs

```python
async def follow_build_logs(image_id: str,
                            *,
                            on_logs: _LogsCallback,
                            on_event: Optional[_EventCallback] = None,
                            cursor: Optional[str] = None,
                            timeout: Optional[float] = None) -> BuildLogFollowResult
```

Observe a submitted image build. Timeout is in seconds, not execution TTL.

#### AsyncImageService.build

```python
async def build(builder: ImageBuilder,
                /,
                *,
                name: Optional[str] = None,
                idle_expiry_seconds: Optional[int] = None,
                region: Optional[str] = None,
                cpu_arch: Optional[str] = None,
                timeout: Optional[float] = None) -> Image
```

Build (or import) an image from an `ImageBuilder` declaration.

The builder is the only way to say WHAT to build — `ImageBuilder.
from_dockerfile(...)`, `.from_registry(...)`, or the fluent
`.run_commands` / `.env` / `.workdir` chain — in both SDKs
(parity with TypeScript's `images.build(builder, options)`). `name`
omitted makes the image anonymous; `idle_expiry_seconds` is then its
idle-retention window — deleted once that long has passed without a
sandbox being created from it (every create restarts the clock);
omitted ⇒ the maximum retention supported by the API.

#### AsyncImageService.pull

```python
async def pull(image: str,
               *,
               name: Optional[str] = None,
               region: Optional[str] = None,
               wait: bool = True,
               timeout: Optional[float] = None) -> Image
```

Import a registry image, waiting until ready unless `wait=False`.

`timeout` is the submission and readiness budget in seconds; omitted
or zero waits without a deadline. A failed import raises
`ImageBuildFailedError` with the server's recorded error.

#### AsyncImageService.get

```python
async def get(image_id: str,
              *,
              wait: Literal['ready'] | None = None,
              timeout: Optional[float] = None) -> Image
```

#### AsyncImageService.promote

```python
async def promote(image_id: str, name: str) -> Image
```

Name an ANONYMOUS image, making it permanent (`PATCH /images/{id}`).

Promotion only: an image that already has a name answers 409 — renaming
a named image is not offered (sandboxes reference images by id, so a
rename would silently relabel every sandbox created from it).

#### AsyncImageService.delete

```python
async def delete(image_id: str) -> None
```

#### AsyncImageService.list

```python
async def list(*,
               anonymous: bool = False,
               sandbox_id: Optional[str] = None,
               name: Optional[str] = None,
               cursor: Optional[str] = None,
               limit: Optional[int] = None,
               platform: Optional[Literal['true', 'false', 'any']] = None) -> ListResult[Image]
```

List images (`GET /images`).

`platform` picks the shared images Daytona publishes for every
project: `"false"` (the server default) lists the project's own
images, `"true"` lists only the non-deprecated platform images (the
default one carries `default=True`), and `"any"` lists both.

#### AsyncImageService.iter

```python
async def iter(*,
               anonymous: bool = False,
               sandbox_id: Optional[str] = None,
               name: Optional[str] = None,
               cursor: Optional[str] = None,
               limit: Optional[int] = None,
               platform: Optional[Literal['true', 'false', 'any']] = None) -> AsyncIterator[Image]
```

## ImageListItem

```python
class ImageListItem(BaseModel)
```

An image with its pagination cursor.

**Attributes**:

- `anonymous` _StrictBool = Field(description='Whether the image has no permanent name.')_
- `bytes` _Optional\[StrictInt\] = Field(default=None, description='The image size in bytes, or null until the build completes.')_
- `var_class` _StrictStr = Field(description='The sandbox class supported by the image.', alias='class')_
- `created_at` _datetime = Field(description='When the image was created.')_
- `cursor` _StrictStr = Field(description='Opaque continuation token for the next image in the list.')_
- `default` _StrictBool = Field(description='Whether this is the image a sandbox create without `image` boots.')_
- `deprecated` _StrictBool = Field(description='Whether this platform image is deprecated. A deprecated image is not listed and cannot be used by name, but its ID still resolves.')_
- `disk_mib` _Optional\[StrictInt\] = Field(default=None, description='The disk size in MiB that a macOS sandbox created from this image gets when the create omits `disk_mib`. Set for saved macOS sandbox disks; null for every other image.')_
- `error` _Optional\[StrictStr\] = Field(default=None, description='Build failure reason; null unless `status` is `failed`.')_
- `expires_at` _Optional\[datetime\] = Field(default=None, description='When an anonymous image expires, or null for a permanent image.')_
- `format_outdated` _StrictBool = Field(description='`format_version` is below the current format. Such an image converts on its first Linux sandbox create (which waits `queued` meanwhile) or ahead of time with `POST /images/{id}/convert`; other operations refuse it with `IMAGE_FORMAT_OUTDATED` until then.')_
- `format_version` _StrictInt = Field(description='Image format version: `1` for images imported from Daytona v0, `2` for the current format. See `status` for image readiness.')_
- `id` _StrictStr = Field(description='The image ID.')_
- `imported_from` _Optional\[ImportedFrom\] = None_
- `layer_count` _Optional\[StrictInt\] = Field(default=None, description='The number of filesystem layers, or null until the build completes.')_
- `name` _Optional\[StrictStr\] = Field(default=None, description='The image name, or null for an anonymous image.')_
- `origin` _StrictStr = Field(description='How the image was created.')_
- `platform` _StrictBool = Field(description="Whether the platform publishes this image for every project. A project's own image with the same name takes precedence for that project, and platform images cannot be renamed, converted, or deleted.")_
- `region_id` _StrictStr = Field(description='The home region.')_
- `region_ids` _List\[StrictStr\] = Field(description='Every region where the image is available.')_
- `retention` _ImageRetention_
- `source` _Optional\[ImageSourceValue\] = None_
- `status` _StrictStr = Field(description='The build status.')_
- `updated_at` _datetime = Field(description='When the image was last updated.')_
- `additional_properties` _Dict\[str, Any\] = \{\}_

##### model\_config

```python
model_config = ConfigDict(populate_by_name=True, validate_assignment=True, protected_namespaces=())
```

#### ImageListItem.to\_str

```python
def to_str() -> str
```

Returns the string representation of the model using alias

#### ImageListItem.to\_json

```python
def to_json() -> str
```

Returns the JSON representation of the model using alias

#### ImageListItem.from\_json

```python
@classmethod
def from_json(json_str: str) -> Optional[Self]
```

Create an instance of ImageListItem from a JSON string

#### ImageListItem.to\_dict

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

#### ImageListItem.from\_dict

```python
@classmethod
def from_dict(obj: Optional[Dict[str, Any]]) -> Optional[Self]
```

Create an instance of ImageListItem from a dict

## BuildLogFollowResult

```python
@dataclass(frozen=True)
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
@dataclass(frozen=True)
class BuildLogStateEvent()
```

**Attributes**:

- `status` _str_
- `error` _str \| None = None_
- `deadline_at` _str \| None = None_
- `type` _Literal\['state'\] = 'state'_

## BuildLogChunkEvent

```python
@dataclass(frozen=True)
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
@dataclass(frozen=True)
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
@dataclass(frozen=True)
class BuildLogUnavailableEvent()
```

**Attributes**:

- `reason` _str_
- `type` _Literal\['unavailable'\] = 'unavailable'_

## BuildLogSourceChangedEvent

```python
@dataclass(frozen=True)
class BuildLogSourceChangedEvent()
```

**Attributes**:

- `reason` _str_
- `type` _Literal\['source_changed'\] = 'source_changed'_

## BuildLogDoneEvent

```python
@dataclass(frozen=True)
class BuildLogDoneEvent()
```

**Attributes**:

- `result` _BuildLogFollowResult_
- `type` _Literal\['done'\] = 'done'_

## BuildLogErrorEvent

```python
@dataclass(frozen=True)
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
@dataclass(frozen=True, slots=True)
class ImageBuilder()
```

#### ImageBuilder.from\_registry

```python
@classmethod
def from_registry(ref: str) -> Self
```

#### ImageBuilder.from\_dockerfile

```python
@classmethod
def from_dockerfile(content: str) -> Self
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

#### ImageBuilder.build\_request\_source

```python
def build_request_source() -> tuple[dict[str, str] | None, str | None]
```

#### ImageBuilder.render\_dockerfile

```python
def render_dockerfile() -> str
```

Render the Dockerfile the build request carries.

Byte-identical to TypeScript's `ImageBuilder.toDockerfile()` for the
same builder: one line per layer, a single trailing newline (a POSIX
text file), no trailing whitespace.

## ImageRef

```python
@dataclass(frozen=True, slots=True)
class ImageRef()
```

**Attributes**:

- `id` _str_
- `name` _Optional\[str\] = None_

## Image

```python
@dataclass(frozen=True, slots=True)
class Image()
```

**Attributes**:

- `id` _str_
- `name` _Optional\[str\]_
- `status` _str_
- `region` _str_
- `anonymous` _bool_
- `retention` _ArtifactRetention_
- `var_class` _str_
- `available_in` _list\[str\]_
- `origin` _str_
- `created_at` _Optional\[str\] = None_
- `error` _Optional\[str\] = None_
- `expires_at` _Optional\[str\] = None_
- `source` _Optional\[ImageSource\] = None_
- `bytes` _Optional\[int\] = None_
- `layer_count` _Optional\[int\] = None_
- `cursor` _Optional\[str\] = None_
- `format_version` _Optional\[int\] = None_
- `format_outdated` _bool = False_
- `platform` _bool = False_
- `default` _bool = False_
- `deprecated` _bool = False_
- `updated_at` _Optional\[str\] = None_
- `disk_mib` _Optional\[int\] = None_
- `raw_retention` _str = field(default='', kw_only=True)_

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

## ImageBuildResponse

```python
ImageBuildResponse = _gen.api.AsyncOperation
```

## ArtifactRetention

```python
ArtifactRetention = Literal['permanent', 'idle', 'unknown']
```

## ImageSource

```python
ImageSource = Union[RegistryImageSource, DockerfileImageSource, NamedImageSource, ManifestImageSource]
```
