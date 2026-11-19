# ComputerUse (Python SDK reference)

## Contents

- [ComputerUseService](#computeruseservice)
- [AsyncComputerUseService](#asynccomputeruseservice)
- [A11yService](#a11yservice)
- [AsyncA11yService](#asynca11yservice)
- [AddonProcessesService](#addonprocessesservice)
- [AsyncAddonProcessesService](#asyncaddonprocessesservice)
- [DisplayService](#displayservice)
- [AsyncDisplayService](#asyncdisplayservice)
- [KeyboardService](#keyboardservice)
- [AsyncKeyboardService](#asynckeyboardservice)
- [MouseService](#mouseservice)
- [AsyncMouseService](#asyncmouseservice)
- [RecordingService](#recordingservice)
- [AsyncRecordingService](#asyncrecordingservice)
- [ScreenService](#screenservice)
- [AsyncScreenService](#asyncscreenservice)
- [ComputerUseDesktopFailure](#computerusedesktopfailure)
- [ComputerUseNotStartedStatus](#computerusenotstartedstatus)
- [ComputerUseStartingStatus](#computerusestartingstatus)
- [ComputerUseReadyStatus](#computerusereadystatus)
- [ComputerUseFailedStatus](#computerusefailedstatus)
- [ComputerUseUnknownStatus](#computeruseunknownstatus)
- [ComputerUseResolution](#computeruseresolution)
- [ComputerUseRestartResponse](#computeruserestartresponse)
- [ComputerUseProcessStatus](#computeruseprocessstatus)
- [ComputerUseProcessRunningStatus](#computeruseprocessrunningstatus)
- [ComputerUsePoint](#computerusepoint)
- [ComputerUseRegion](#computeruseregion)
- [ComputerUseDisplay](#computerusedisplay)
- [ComputerUseWindow](#computerusewindow)
- [ComputerUseAccessibilityBounds](#computeruseaccessibilitybounds)
- [ComputerUseAccessibilityNode](#computeruseaccessibilitynode)
- [ComputerUseRecording](#computeruserecording)
- [ComputerUseMouseButton](#computerusemousebutton)
- [ComputerUseScrollDirection](#computerusescrolldirection)
- [ComputerUseScreenshotFormat](#computerusescreenshotformat)
- [ComputerUseKeyboardModifier](#computerusekeyboardmodifier)
- [ComputerUseA11yScope](#computerusea11yscope)
- [ComputerUseA11yNameMatch](#computerusea11ynamematch)
- [ComputerUseActivityStatus](#computeruseactivitystatus)
- [ComputerUseDesktopState](#computerusedesktopstate)
- [ComputerUseDesktopFailureCode](#computerusedesktopfailurecode)
- [ComputerUseStatusResponse](#computerusestatusresponse)
- [ComputerUseLifecycleResponse](#computeruselifecycleresponse)
- [ComputerUseProcessRestartResponse](#computeruseprocessrestartresponse)
- [ComputerUseProcessLogsResponse](#computeruseprocesslogsresponse)
- [ComputerUseProcessErrorsResponse](#computeruseprocesserrorsresponse)
- [ComputerUseScreenshotResponse](#computerusescreenshotresponse)
- [ComputerUseScrollResponse](#computerusescrollresponse)
- [ComputerUseDisplayInfoResponse](#computerusedisplayinforesponse)
- [ComputerUseDisplayWindowsResponse](#computerusedisplaywindowsresponse)
- [ComputerUseA11yTreeResponse](#computerusea11ytreeresponse)
- [ComputerUseA11yFindResponse](#computerusea11yfindresponse)
- [ComputerUseRecordingsResponse](#computeruserecordingsresponse)

## ComputerUseService

```python
class ComputerUseService()
```

Synchronous ComputerUseService.

#### ComputerUseService.\_\_init\_\_

```python
def __init__() -> None
```

#### ComputerUseService.service

```python
@property
def service() -> AddonProcessesService
```

#### ComputerUseService.mouse

```python
@property
def mouse() -> MouseService
```

#### ComputerUseService.keyboard

```python
@property
def keyboard() -> KeyboardService
```

#### ComputerUseService.screen

```python
@property
def screen() -> ScreenService
```

#### ComputerUseService.display

```python
@property
def display() -> DisplayService
```

#### ComputerUseService.a11y

```python
@property
def a11y() -> A11yService
```

#### ComputerUseService.recording

```python
@property
def recording() -> RecordingService
```

#### ComputerUseService.restart

```python
def restart(*,
            resolution: ComputerUseResolution | None = None) -> ComputerUseRestartResponse
```

Restart the desktop, at `resolution` when given (kept for later
starts). Omitted, it restarts at its current resolution. Linux sandboxes
only: other platforms raise `UnsupportedOperationError` for a
`resolution`.

#### ComputerUseService.start

```python
def start(*,
          resolution: ComputerUseResolution | None = None) -> ComputerUseLifecycleResult
```

Start the desktop.

`resolution` selects its size (1024x768, 1280x720 or 1920x1080) and is
kept for later starts and restarts. Omitted, the desktop uses the
resolution it last started at, or 1280x720. Starting a running desktop at
a different resolution raises `ConflictError`; call `restart` with
the new resolution instead. Linux sandboxes only: other platforms raise
`UnsupportedOperationError` for a `resolution`.

#### ComputerUseService.status

```python
def status() -> ComputerUseStatusResponse
```

#### ComputerUseService.stop

```python
def stop() -> ComputerUseLifecycleResult
```

## AsyncComputerUseService

```python
class AsyncComputerUseService()
```

#### AsyncComputerUseService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncComputerUseService.status

```python
async def status() -> ComputerUseStatusResponse
```

#### AsyncComputerUseService.start

```python
async def start(*,
                resolution: ComputerUseResolution | None = None) -> ComputerUseLifecycleResult
```

Start the desktop.

`resolution` selects its size (1024x768, 1280x720 or 1920x1080) and is
kept for later starts and restarts. Omitted, the desktop uses the
resolution it last started at, or 1280x720. Starting a running desktop at
a different resolution raises `ConflictError`; call `restart` with
the new resolution instead. Linux sandboxes only: other platforms raise
`UnsupportedOperationError` for a `resolution`.

#### AsyncComputerUseService.stop

```python
async def stop() -> ComputerUseLifecycleResult
```

#### AsyncComputerUseService.restart

```python
async def restart(*,
                  resolution: ComputerUseResolution | None = None) -> ComputerUseRestartResponse
```

Restart the desktop, at `resolution` when given (kept for later
starts). Omitted, it restarts at its current resolution. Linux sandboxes
only: other platforms raise `UnsupportedOperationError` for a
`resolution`.

## A11yService

```python
class A11yService()
```

Synchronous A11yService.

#### A11yService.\_\_init\_\_

```python
def __init__() -> None
```

#### A11yService.find

```python
def find(*,
         scope: ComputerUseA11yScope,
         pid: int | None = None,
         role: str | None = None,
         name: str | None = None,
         name_match: ComputerUseA11yNameMatch | None = None,
         states: Sequence[str] | None = None,
         limit: int | None = None) -> ComputerUseA11yFindResult
```

#### A11yService.focus

```python
def focus(*, id: str) -> None
```

#### A11yService.invoke

```python
def invoke(*, id: str, action: str | None = None) -> None
```

#### A11yService.set\_value

```python
def set_value(*, id: str, value: str) -> None
```

#### A11yService.tree

```python
def tree(*,
         scope: ComputerUseA11yScope,
         pid: int | None = None,
         max_depth: int | None = None) -> ComputerUseA11yTree
```

Read the accessibility tree, at most 256 levels below the root.

`max_depth` is how many levels below the root to return: an integer
from 0 to 256 (the SDK's cap), default 256. A deeper UI comes back cut
at that depth with `truncated` set; `-1` (unbounded) is refused.

## AsyncA11yService

```python
class AsyncA11yService()
```

#### AsyncA11yService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncA11yService.tree

```python
async def tree(*,
               scope: ComputerUseA11yScope,
               pid: int | None = None,
               max_depth: int | None = None) -> ComputerUseA11yTree
```

Read the accessibility tree, at most 256 levels below the root.

`max_depth` is how many levels below the root to return: an integer
from 0 to 256 (the SDK's cap), default 256. A deeper UI comes back cut
at that depth with `truncated` set; `-1` (unbounded) is refused.

#### AsyncA11yService.find

```python
async def find(*,
               scope: ComputerUseA11yScope,
               pid: int | None = None,
               role: str | None = None,
               name: str | None = None,
               name_match: ComputerUseA11yNameMatch | None = None,
               states: Sequence[str] | None = None,
               limit: int | None = None) -> ComputerUseA11yFindResult
```

#### AsyncA11yService.focus

```python
async def focus(*, id: str) -> None
```

#### AsyncA11yService.invoke

```python
async def invoke(*, id: str, action: str | None = None) -> None
```

#### AsyncA11yService.set\_value

```python
async def set_value(*, id: str, value: str) -> None
```

## AddonProcessesService

```python
class AddonProcessesService()
```

Synchronous AddonProcessesService.

#### AddonProcessesService.\_\_init\_\_

```python
def __init__() -> None
```

#### AddonProcessesService.errors

```python
def errors(name: str, /) -> ComputerUseProcessErrors
```

#### AddonProcessesService.logs

```python
def logs(name: str, /) -> ComputerUseProcessLogs
```

#### AddonProcessesService.restart

```python
def restart(name: str, /) -> ComputerUseProcessRestartResult
```

#### AddonProcessesService.status

```python
@overload
def status() -> dict[str, ComputerUseProcessStatus]
```

#### AddonProcessesService.status

```python
@overload
def status(name: str, /) -> ComputerUseProcessRunningStatus
```

## AsyncAddonProcessesService

```python
class AsyncAddonProcessesService()
```

#### AsyncAddonProcessesService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncAddonProcessesService.status

```python
@overload
async def status() -> dict[str, ComputerUseProcessStatus]
```

#### AsyncAddonProcessesService.status

```python
@overload
async def status(name: str, /) -> ComputerUseProcessRunningStatus
```

#### AsyncAddonProcessesService.restart

```python
async def restart(name: str, /) -> ComputerUseProcessRestartResult
```

#### AsyncAddonProcessesService.logs

```python
async def logs(name: str, /) -> ComputerUseProcessLogs
```

#### AsyncAddonProcessesService.errors

```python
async def errors(name: str, /) -> ComputerUseProcessErrors
```

## DisplayService

```python
class DisplayService()
```

Synchronous DisplayService.

#### DisplayService.\_\_init\_\_

```python
def __init__() -> None
```

#### DisplayService.info

```python
def info() -> ComputerUseDisplayInfo
```

#### DisplayService.windows

```python
def windows() -> ComputerUseDisplayWindows
```

## AsyncDisplayService

```python
class AsyncDisplayService()
```

#### AsyncDisplayService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncDisplayService.info

```python
async def info() -> ComputerUseDisplayInfo
```

#### AsyncDisplayService.windows

```python
async def windows() -> ComputerUseDisplayWindows
```

## KeyboardService

```python
class KeyboardService()
```

Synchronous KeyboardService.

#### KeyboardService.\_\_init\_\_

```python
def __init__() -> None
```

#### KeyboardService.hotkey

```python
def hotkey(*, keys: str) -> None
```

#### KeyboardService.key

```python
def key(*,
        key: str,
        modifiers: Sequence[ComputerUseKeyboardModifier] | None = None) -> None
```

#### KeyboardService.type

```python
def type(*, text: str, delay: float | None = None) -> None
```

Type `text`; `delay` is the pause between key presses in seconds.

## AsyncKeyboardService

```python
class AsyncKeyboardService()
```

#### AsyncKeyboardService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncKeyboardService.type

```python
async def type(*, text: str, delay: float | None = None) -> None
```

Type `text`; `delay` is the pause between key presses in seconds.

#### AsyncKeyboardService.key

```python
async def key(*,
              key: str,
              modifiers: Sequence[ComputerUseKeyboardModifier] | None = None) -> None
```

#### AsyncKeyboardService.hotkey

```python
async def hotkey(*, keys: str) -> None
```

## MouseService

```python
class MouseService()
```

Synchronous MouseService.

#### MouseService.\_\_init\_\_

```python
def __init__() -> None
```

#### MouseService.click

```python
def click(*,
          x: int,
          y: int,
          button: ComputerUseMouseButton | None = None,
          double: bool | None = None) -> ComputerUsePoint
```

#### MouseService.drag

```python
def drag(*,
         start_x: int,
         start_y: int,
         end_x: int,
         end_y: int,
         button: ComputerUseMouseButton | None = None) -> ComputerUsePoint
```

#### MouseService.move

```python
def move(*, x: int, y: int) -> ComputerUsePoint
```

#### MouseService.position

```python
def position() -> ComputerUsePoint
```

#### MouseService.scroll

```python
def scroll(*,
           x: int,
           y: int,
           direction: ComputerUseScrollDirection,
           amount: int | None = None) -> ComputerUseScrollResult
```

## AsyncMouseService

```python
class AsyncMouseService()
```

#### AsyncMouseService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncMouseService.position

```python
async def position() -> ComputerUsePoint
```

#### AsyncMouseService.move

```python
async def move(*, x: int, y: int) -> ComputerUsePoint
```

#### AsyncMouseService.click

```python
async def click(*,
                x: int,
                y: int,
                button: ComputerUseMouseButton | None = None,
                double: bool | None = None) -> ComputerUsePoint
```

#### AsyncMouseService.drag

```python
async def drag(*,
               start_x: int,
               start_y: int,
               end_x: int,
               end_y: int,
               button: ComputerUseMouseButton | None = None) -> ComputerUsePoint
```

#### AsyncMouseService.scroll

```python
async def scroll(*,
                 x: int,
                 y: int,
                 direction: ComputerUseScrollDirection,
                 amount: int | None = None) -> ComputerUseScrollResult
```

## RecordingService

```python
class RecordingService()
```

Synchronous RecordingService.

#### RecordingService.\_\_init\_\_

```python
def __init__() -> None
```

#### RecordingService.delete

```python
def delete(id: str, /) -> None
```

#### RecordingService.download

```python
def download(id: str, /, *, max_response_bytes: Optional[int] = None) -> bytes
```

Download a recording, holding the whole file in memory.

No total deadline (it fails only when no bytes move for the client's
`request_timeout`; with a `request_timeout` of `0`, nothing
bounds it). `max_response_bytes` replaces the client's cap
on the body for this call (`None` keeps the client's cap, `0` means
no limit, and any other value (negative, fractional, boolean, string,
above 2**53 - 1) is a `BadRequestError`); a larger recording raises
`PayloadTooLargeError` before it is read in full. For a large
recording, or one from a sandbox you do not trust, download its
`file_path` with `sandbox.fs.download_file()`, which streams to disk
with progress and cancellation.

#### RecordingService.get

```python
def get(id: str, /) -> ComputerUseRecording
```

#### RecordingService.list

```python
def list() -> ComputerUseRecordingList
```

#### RecordingService.start

```python
def start(*, label: str | None = None) -> ComputerUseRecording
```

#### RecordingService.stop

```python
def stop(*, id: str) -> ComputerUseRecording
```

## AsyncRecordingService

```python
class AsyncRecordingService()
```

#### AsyncRecordingService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncRecordingService.start

```python
async def start(*, label: str | None = None) -> ComputerUseRecording
```

#### AsyncRecordingService.stop

```python
async def stop(*, id: str) -> ComputerUseRecording
```

#### AsyncRecordingService.list

```python
async def list() -> ComputerUseRecordingList
```

#### AsyncRecordingService.get

```python
async def get(id: str, /) -> ComputerUseRecording
```

#### AsyncRecordingService.download

```python
async def download(id: str, /, *, max_response_bytes: Optional[int] = None) -> bytes
```

Download a recording, holding the whole file in memory.

No total deadline (it fails only when no bytes move for the client's
`request_timeout`; with a `request_timeout` of `0`, nothing
bounds it). `max_response_bytes` replaces the client's cap
on the body for this call (`None` keeps the client's cap, `0` means
no limit, and any other value (negative, fractional, boolean, string,
above 2**53 - 1) is a `BadRequestError`); a larger recording raises
`PayloadTooLargeError` before it is read in full. For a large
recording, or one from a sandbox you do not trust, download its
`file_path` with `sandbox.fs.download_file()`, which streams to disk
with progress and cancellation.

#### AsyncRecordingService.delete

```python
async def delete(id: str, /) -> None
```

## ScreenService

```python
class ScreenService()
```

Synchronous ScreenService.

#### ScreenService.\_\_init\_\_

```python
def __init__() -> None
```

#### ScreenService.screenshot

```python
def screenshot(*,
               region: ComputerUseRegion | None = None,
               format: ComputerUseScreenshotFormat | None = None,
               quality: int | None = None,
               scale: float | None = None,
               show_cursor: bool | None = None) -> ComputerUseScreenshot
```

Capture the screen, or `region` of it.

Setting any of `format`, `quality` or `scale` returns a compressed image.

## AsyncScreenService

```python
class AsyncScreenService()
```

#### AsyncScreenService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncScreenService.screenshot

```python
async def screenshot(*,
                     region: ComputerUseRegion | None = None,
                     format: ComputerUseScreenshotFormat | None = None,
                     quality: int | None = None,
                     scale: float | None = None,
                     show_cursor: bool | None = None) -> ComputerUseScreenshot
```

Capture the screen, or `region` of it.

Setting any of `format`, `quality` or `scale` returns a compressed image.

## ComputerUseDesktopFailure

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseDesktopFailure()
```

**Attributes**:

- `code` _ComputerUseDesktopFailureCode_
- `raw_code` _str_
- `message` _str_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseNotStartedStatus

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseNotStartedStatus()
```

**Attributes**:

- `status` _Literal\['inactive'\] = 'inactive'_
- `desktop` _Literal\['not_started'\] = 'not_started'_
- `cause` _None = None_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseStartingStatus

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseStartingStatus()
```

**Attributes**:

- `status` _Literal\['inactive'\] = 'inactive'_
- `desktop` _Literal\['starting'\] = 'starting'_
- `cause` _None = None_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseReadyStatus

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseReadyStatus()
```

**Attributes**:

- `status` _Literal\['active'\] = 'active'_
- `desktop` _Literal\['ready'\] = 'ready'_
- `cause` _None = None_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseFailedStatus

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseFailedStatus()
```

**Attributes**:

- `cause` _ComputerUseDesktopFailure_
- `status` _Literal\['inactive'\] = 'inactive'_
- `desktop` _Literal\['failed'\] = 'failed'_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseUnknownStatus

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseUnknownStatus()
```

A (status, desktop) pair this SDK release does not recognize.
raw_status / raw_desktop carry the API values or combination;
the recognized variants need no raw sibling, since
their typed values are the wire values. cause is the failure the API
attached to the unrecognized state, when it sent one.

**Attributes**:

- `raw_status` _str_
- `raw_desktop` _str_
- `status` _Literal\['unknown'\] = 'unknown'_
- `desktop` _Literal\['unknown'\] = 'unknown'_
- `cause` _Optional\[ComputerUseDesktopFailure\] = None_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseResolution

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseResolution()
```

A desktop resolution in pixels: 1024x768, 1280x720 or 1920x1080.

**Attributes**:

- `width` _int_
- `height` _int_

## ComputerUseRestartResponse

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseRestartResponse()
```

**Attributes**:

- `message` _str_
- `status` _Literal\['active'\] = 'active'_
- `desktop` _Literal\['ready'\] = 'ready'_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseProcessStatus

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseProcessStatus()
```

**Attributes**:

- `running` _bool_
- `priority` _int_
- `auto_restart` _bool_
- `failed` _bool_
- `restart_attempts` _int_
- `restart_backoff` _float_ - The current restart backoff, in seconds.
- `status` _str_
- `pid` _Optional\[int\] = None_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseProcessRunningStatus

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseProcessRunningStatus()
```

**Attributes**:

- `process_name` _str_
- `running` _bool_

## ComputerUsePoint

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUsePoint()
```

**Attributes**:

- `x` _int_
- `y` _int_

## ComputerUseRegion

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseRegion()
```

A screen rectangle for `screen.screenshot(region=...)`.

**Attributes**:

- `x` _int_
- `y` _int_
- `width` _int_
- `height` _int_

## ComputerUseDisplay

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseDisplay()
```

**Attributes**:

- `id` _int_
- `x` _int_
- `y` _int_
- `width` _int_
- `height` _int_
- `is_active` _bool_

## ComputerUseWindow

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseWindow()
```

**Attributes**:

- `id` _int_
- `title` _str_
- `x` _int_
- `y` _int_
- `width` _int_
- `height` _int_
- `is_active` _bool_

## ComputerUseAccessibilityBounds

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseAccessibilityBounds()
```

**Attributes**:

- `x` _int_
- `y` _int_
- `width` _int_
- `height` _int_

## ComputerUseAccessibilityNode

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseAccessibilityNode()
```

**Attributes**:

- `id` _str_
- `role` _str_
- `name` _str_
- `bounds` _ComputerUseAccessibilityBounds_
- `states` _tuple\[str, ...\]_
- `description` _Optional\[str\] = None_
- `actions` _Optional\[tuple\[str, ...\]\] = None_
- `children` _Optional\[tuple\[ComputerUseAccessibilityNode, ...\]\] = None_
- `value` _Optional\[str\] = None_
- `value_truncated` _bool = False_

## ComputerUseRecording

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ComputerUseRecording()
```

**Attributes**:

- `id` _str_
- `file_name` _str_
- `file_path` _str_
- `start_time` _datetime_
- `status` _str_
- `end_time` _Optional\[datetime\] = None_
- `duration_seconds` _Optional\[float\] = None_
- `size_bytes` _Optional\[int\] = None_

## ComputerUseMouseButton

```python
ComputerUseMouseButton = Literal['left', 'right', 'middle']
```

## ComputerUseScrollDirection

```python
ComputerUseScrollDirection = Literal['up', 'down']
```

## ComputerUseScreenshotFormat

```python
ComputerUseScreenshotFormat = Literal['png', 'jpeg']
```

## ComputerUseKeyboardModifier

```python
ComputerUseKeyboardModifier = Literal['ctrl', 'alt', 'shift', 'cmd']
```

## ComputerUseA11yScope

```python
ComputerUseA11yScope = Literal['focused', 'pid', 'all']
```

## ComputerUseA11yNameMatch

```python
ComputerUseA11yNameMatch = Literal['exact', 'substring', 'regex']
```

## ComputerUseActivityStatus

```python
ComputerUseActivityStatus = Literal['active', 'inactive', 'unknown']
```

## ComputerUseDesktopState

```python
ComputerUseDesktopState = Literal['not_started', 'starting', 'ready', 'failed', 'unknown']
```

## ComputerUseDesktopFailureCode

```python
ComputerUseDesktopFailureCode = Literal['desktop_exited', 'addon_crashed', 'start_failed', 'start_interrupted', 'session_ended', 'session_replaced', 'state_corrupt', 'state_persistence_failed', 'unknown']
```

## ComputerUseStatusResponse

```python
ComputerUseStatusResponse = Union[ComputerUseNotStartedStatus, ComputerUseStartingStatus, ComputerUseReadyStatus, ComputerUseFailedStatus, ComputerUseUnknownStatus]
```

## ComputerUseLifecycleResponse

```python
ComputerUseLifecycleResponse = ComputerUseLifecycleResult
```

## ComputerUseProcessRestartResponse

```python
ComputerUseProcessRestartResponse = ComputerUseProcessRestartResult
```

## ComputerUseProcessLogsResponse

```python
ComputerUseProcessLogsResponse = ComputerUseProcessLogs
```

## ComputerUseProcessErrorsResponse

```python
ComputerUseProcessErrorsResponse = ComputerUseProcessErrors
```

## ComputerUseScreenshotResponse

```python
ComputerUseScreenshotResponse = ComputerUseScreenshot
```

## ComputerUseScrollResponse

```python
ComputerUseScrollResponse = ComputerUseScrollResult
```

## ComputerUseDisplayInfoResponse

```python
ComputerUseDisplayInfoResponse = ComputerUseDisplayInfo
```

## ComputerUseDisplayWindowsResponse

```python
ComputerUseDisplayWindowsResponse = ComputerUseDisplayWindows
```

## ComputerUseA11yTreeResponse

```python
ComputerUseA11yTreeResponse = ComputerUseA11yTree
```

## ComputerUseA11yFindResponse

```python
ComputerUseA11yFindResponse = ComputerUseA11yFindResult
```

## ComputerUseRecordingsResponse

```python
ComputerUseRecordingsResponse = ComputerUseRecordingList
```
