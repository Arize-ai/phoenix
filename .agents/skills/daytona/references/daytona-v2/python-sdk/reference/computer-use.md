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
def __init__(impl: AsyncComputerUseService, bridge: SyncBridge) -> None
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
def restart() -> ComputerUseRestartResponse
```

#### ComputerUseService.start

```python
def start() -> ComputerUseLifecycleResult
```

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
def __init__(transport: AsyncTransport) -> None
```

#### AsyncComputerUseService.status

```python
async def status() -> ComputerUseStatusResponse
```

#### AsyncComputerUseService.start

```python
async def start() -> ComputerUseLifecycleResult
```

#### AsyncComputerUseService.stop

```python
async def stop() -> ComputerUseLifecycleResult
```

#### AsyncComputerUseService.restart

```python
async def restart() -> ComputerUseRestartResponse
```

## A11yService

```python
class A11yService()
```

Synchronous A11yService.

#### A11yService.\_\_init\_\_

```python
def __init__(impl: AsyncA11yService, bridge: SyncBridge) -> None
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

## AsyncA11yService

```python
class AsyncA11yService()
```

#### AsyncA11yService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncA11yService.tree

```python
async def tree(*,
               scope: ComputerUseA11yScope,
               pid: int | None = None,
               max_depth: int | None = None) -> ComputerUseA11yTree
```

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
def __init__(impl: AsyncAddonProcessesService, bridge: SyncBridge) -> None
```

#### AddonProcessesService.errors

```python
def errors(name: str) -> ComputerUseProcessErrors
```

#### AddonProcessesService.logs

```python
def logs(name: str) -> ComputerUseProcessLogs
```

#### AddonProcessesService.restart

```python
def restart(name: str) -> ComputerUseProcessRestartResult
```

#### AddonProcessesService.status

```python
@overload
def status() -> dict[str, ComputerUseProcessStatus]
```

#### AddonProcessesService.status

```python
@overload
def status(name: str) -> ComputerUseProcessRunningStatus
```

## AsyncAddonProcessesService

```python
class AsyncAddonProcessesService()
```

#### AsyncAddonProcessesService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncAddonProcessesService.status

```python
@overload
async def status() -> dict[str, ComputerUseProcessStatus]
```

#### AsyncAddonProcessesService.status

```python
@overload
async def status(name: str) -> ComputerUseProcessRunningStatus
```

#### AsyncAddonProcessesService.restart

```python
async def restart(name: str) -> ComputerUseProcessRestartResult
```

#### AsyncAddonProcessesService.logs

```python
async def logs(name: str) -> ComputerUseProcessLogs
```

#### AsyncAddonProcessesService.errors

```python
async def errors(name: str) -> ComputerUseProcessErrors
```

## DisplayService

```python
class DisplayService()
```

Synchronous DisplayService.

#### DisplayService.\_\_init\_\_

```python
def __init__(impl: AsyncDisplayService, bridge: SyncBridge) -> None
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
def __init__(transport: AsyncTransport) -> None
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
def __init__(impl: AsyncKeyboardService, bridge: SyncBridge) -> None
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
def type(*, text: str, delay: int | None = None) -> None
```

## AsyncKeyboardService

```python
class AsyncKeyboardService()
```

#### AsyncKeyboardService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncKeyboardService.type

```python
async def type(*, text: str, delay: int | None = None) -> None
```

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
def __init__(impl: AsyncMouseService, bridge: SyncBridge) -> None
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
def __init__(transport: AsyncTransport) -> None
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
def __init__(impl: AsyncRecordingService, bridge: SyncBridge) -> None
```

#### RecordingService.delete

```python
def delete(id: str) -> None
```

#### RecordingService.download

```python
def download(id: str) -> bytes
```

#### RecordingService.get

```python
def get(id: str) -> ComputerUseRecording
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
def __init__(transport: AsyncTransport) -> None
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
async def get(id: str) -> ComputerUseRecording
```

#### AsyncRecordingService.download

```python
async def download(id: str) -> bytes
```

#### AsyncRecordingService.delete

```python
async def delete(id: str) -> None
```

## ScreenService

```python
class ScreenService()
```

Synchronous ScreenService.

#### ScreenService.\_\_init\_\_

```python
def __init__(impl: AsyncScreenService, bridge: SyncBridge) -> None
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

## AsyncScreenService

```python
class AsyncScreenService()
```

#### AsyncScreenService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
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
@dataclass(frozen=True, slots=True)
class ComputerUseDesktopFailure()
```

**Attributes**:

- `code` _ComputerUseDesktopFailureCode_
- `message` _str_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_
- `raw_code` _Optional\[str\] = None_

## ComputerUseNotStartedStatus

```python
@dataclass(frozen=True, slots=True)
class ComputerUseNotStartedStatus()
```

**Attributes**:

- `status` _Literal\['inactive'\] = 'inactive'_
- `desktop` _Literal\['not_started'\] = 'not_started'_
- `cause` _None = None_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseStartingStatus

```python
@dataclass(frozen=True, slots=True)
class ComputerUseStartingStatus()
```

**Attributes**:

- `status` _Literal\['inactive'\] = 'inactive'_
- `desktop` _Literal\['starting'\] = 'starting'_
- `cause` _None = None_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseReadyStatus

```python
@dataclass(frozen=True, slots=True)
class ComputerUseReadyStatus()
```

**Attributes**:

- `status` _Literal\['active'\] = 'active'_
- `desktop` _Literal\['ready'\] = 'ready'_
- `cause` _None = None_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseFailedStatus

```python
@dataclass(frozen=True, slots=True)
class ComputerUseFailedStatus()
```

**Attributes**:

- `cause` _ComputerUseDesktopFailure_
- `status` _Literal\['inactive'\] = 'inactive'_
- `desktop` _Literal\['failed'\] = 'failed'_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseUnknownStatus

```python
@dataclass(frozen=True, slots=True)
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

## ComputerUseRestartResponse

```python
@dataclass(frozen=True, slots=True)
class ComputerUseRestartResponse()
```

**Attributes**:

- `message` _str_
- `status` _Literal\['active'\] = 'active'_
- `desktop` _Literal\['ready'\] = 'ready'_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseProcessStatus

```python
@dataclass(frozen=True, slots=True)
class ComputerUseProcessStatus()
```

**Attributes**:

- `running` _Optional\[bool\] = None_
- `priority` _Optional\[int\] = None_
- `auto_restart` _Optional\[bool\] = None_
- `pid` _Optional\[int\] = None_
- `failed` _Optional\[bool\] = None_
- `restart_attempts` _Optional\[int\] = None_
- `restart_backoff_ms` _Optional\[int\] = None_
- `status` _Optional\[str\] = None_
- `extra_fields` _Optional\[Dict\[str, JsonValue\]\] = None_

## ComputerUseProcessRunningStatus

```python
@dataclass(frozen=True, slots=True)
class ComputerUseProcessRunningStatus()
```

**Attributes**:

- `process_name` _str_
- `running` _bool_

## ComputerUsePoint

```python
@dataclass(frozen=True, slots=True)
class ComputerUsePoint()
```

**Attributes**:

- `x` _int_
- `y` _int_

## ComputerUseRegion

```python
@dataclass(frozen=True, slots=True)
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
@dataclass(frozen=True, slots=True)
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
@dataclass(frozen=True, slots=True)
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
@dataclass(frozen=True, slots=True)
class ComputerUseAccessibilityBounds()
```

**Attributes**:

- `x` _int_
- `y` _int_
- `width` _int_
- `height` _int_

## ComputerUseAccessibilityNode

```python
@dataclass(frozen=True, slots=True)
class ComputerUseAccessibilityNode()
```

**Attributes**:

- `id` _str_
- `role` _str_
- `name` _str_
- `bounds` _ComputerUseAccessibilityBounds_
- `states` _List\[str\]_
- `description` _Optional\[str\] = None_
- `actions` _Optional\[List\[str\]\] = None_
- `children` _Optional\[List\[ComputerUseAccessibilityNode\]\] = None_
- `value` _Optional\[str\] = None_
- `value_truncated` _bool = False_

## ComputerUseRecording

```python
@dataclass(frozen=True, slots=True)
class ComputerUseRecording()
```

**Attributes**:

- `id` _str_
- `file_name` _str_
- `file_path` _str_
- `start_time` _str_
- `status` _str_
- `end_time` _Optional\[str\] = None_
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
