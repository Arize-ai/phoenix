# ComputerUse (TypeScript SDK reference)

## Contents

- [ComputerUseService](#computeruseservice)
- [AddonProcessesService](#addonprocessesservice)
- [A11yService](#a11yservice)
- [DisplayService](#displayservice)
- [KeyboardService](#keyboardservice)
- [MouseService](#mouseservice)
- [RecordingService](#recordingservice)
- [ScreenService](#screenservice)
- [RecordingDownloadOptions](#recordingdownloadoptions)
- [ComputerUseActivityStatus](#computeruseactivitystatus)
- [ComputerUseDesktopState](#computerusedesktopstate)
- [ComputerUseDesktopFailureCode](#computerusedesktopfailurecode)
- [ComputerUseDesktopFailure](#computerusedesktopfailure)
- [ComputerUseFailedStatus](#computerusefailedstatus)
- [ComputerUseNotStartedStatus](#computerusenotstartedstatus)
- [ComputerUseReadyStatus](#computerusereadystatus)
- [ComputerUseRestartResponse](#computeruserestartresponse)
- [ComputerUseStartingStatus](#computerusestartingstatus)
- [ComputerUseUnknownStatus](#computeruseunknownstatus)
- [ComputerUseA11yFindRequest](#computerusea11yfindrequest)
- [ComputerUseA11yFindResponse](#computerusea11yfindresponse)
- [ComputerUseA11yFocusRequest](#computerusea11yfocusrequest)
- [ComputerUseA11yInvokeRequest](#computerusea11yinvokerequest)
- [ComputerUseA11yNameMatch](#computerusea11ynamematch)
- [ComputerUseA11yScope](#computerusea11yscope)
- [ComputerUseA11ySetValueRequest](#computerusea11ysetvaluerequest)
- [ComputerUseA11yTreeOptions](#computerusea11ytreeoptions)
- [ComputerUseA11yTreeResponse](#computerusea11ytreeresponse)
- [ComputerUseAccessibilityBounds](#computeruseaccessibilitybounds)
- [ComputerUseAccessibilityNode](#computeruseaccessibilitynode)
- [ComputerUseDisplay](#computerusedisplay)
- [ComputerUseDisplayInfoResponse](#computerusedisplayinforesponse)
- [ComputerUseDisplayWindowsResponse](#computerusedisplaywindowsresponse)
- [ComputerUseKeyboardHotkeyRequest](#computerusekeyboardhotkeyrequest)
- [ComputerUseKeyboardKeyRequest](#computerusekeyboardkeyrequest)
- [ComputerUseKeyboardModifier](#computerusekeyboardmodifier)
- [ComputerUseKeyboardTypeRequest](#computerusekeyboardtyperequest)
- [ComputerUseLifecycleResponse](#computeruselifecycleresponse)
- [ComputerUseMouseButton](#computerusemousebutton)
- [ComputerUseMouseClickRequest](#computerusemouseclickrequest)
- [ComputerUseMouseDragRequest](#computerusemousedragrequest)
- [ComputerUseMouseMoveRequest](#computerusemousemoverequest)
- [ComputerUseMouseScrollRequest](#computerusemousescrollrequest)
- [ComputerUsePoint](#computerusepoint)
- [ComputerUseProcessErrorsResponse](#computeruseprocesserrorsresponse)
- [ComputerUseProcessLogsResponse](#computeruseprocesslogsresponse)
- [ComputerUseProcessRestartResponse](#computeruseprocessrestartresponse)
- [ComputerUseProcessRunningStatus](#computeruseprocessrunningstatus)
- [ComputerUseProcessStatus](#computeruseprocessstatus)
- [ComputerUseRecording](#computeruserecording)
- [ComputerUseRecordingsResponse](#computeruserecordingsresponse)
- [ComputerUseRecordingStartRequest](#computeruserecordingstartrequest)
- [ComputerUseRecordingStopRequest](#computeruserecordingstoprequest)
- [ComputerUseRegion](#computeruseregion)
- [ComputerUseResolution](#computeruseresolution)
- [ComputerUseStartOptions](#computerusestartoptions)
- [ComputerUseScreenshotFormat](#computerusescreenshotformat)
- [ComputerUseScreenshotOptions](#computerusescreenshotoptions)
- [ComputerUseScreenshotResponse](#computerusescreenshotresponse)
- [ComputerUseScrollDirection](#computerusescrolldirection)
- [ComputerUseScrollResponse](#computerusescrollresponse)
- [ComputerUseStatusResponse](#computerusestatusresponse)
- [ComputerUseWindow](#computerusewindow)

## ComputerUseService

Sandbox computer-use namespace (`sandbox.computerUse`): the desktop and its input devices.

**Properties**:

- `service` _AddonProcessesService_
- `mouse` _MouseService_
- `keyboard` _KeyboardService_
- `screen` _ScreenService_
- `display` _DisplayService_
- `a11y` _A11yService_
- `recording` _RecordingService_

### Constructors

#### Constructor

```ts
new ComputerUseService(token: Internal, ...init: never[]): ComputerUseService;
```

Built by the SDK: get it from `sandbox.computerUse`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `ComputerUseService`

### Methods

#### restart()

```ts
restart(options: ComputerUseStartOptions = {}): Promise<ComputerUseRestartResponse>;
```

Restart the desktop, at `resolution` when given (kept for later starts);
omitted, at its current resolution. Linux sandboxes only: other platforms
throw `UnsupportedOperationError` for a `resolution`.

**Parameters**:

- `options` _ComputerUseStartOptions = \{\}_

**Returns**:

- `Promise<ComputerUseRestartResponse>`

#### start()

```ts
start(options: ComputerUseStartOptions = {}): Promise<ComputerUseLifecycleResponse>;
```

Start the desktop. `resolution` selects its size (1024x768, 1280x720 or
1920x1080) and is kept for later starts and restarts; omitted, the desktop
uses the resolution it last started at, or 1280x720. Starting a running
desktop at a different resolution throws `ConflictError` (restart with it
instead). Linux sandboxes only: other platforms throw
`UnsupportedOperationError` for a `resolution`.

**Parameters**:

- `options` _ComputerUseStartOptions = \{\}_

**Returns**:

- `Promise<ComputerUseLifecycleResponse>`

#### status()

```ts
status(): Promise<ComputerUseStatusResponse>;
```

**Returns**:

- `Promise<ComputerUseStatusResponse>`

#### stop()

```ts
stop(): Promise<ComputerUseLifecycleResponse>;
```

**Returns**:

- `Promise<ComputerUseLifecycleResponse>`

***

## AddonProcessesService

### Constructors

#### Constructor

```ts
new AddonProcessesService(token: Internal, ...init: never[]): AddonProcessesService;
```

Built by the SDK: get it from `sandbox.computerUse`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `AddonProcessesService`

### Methods

#### errors()

```ts
errors(name: string): Promise<ComputerUseProcessErrorsResponse>;
```

**Parameters**:

- `name` _string_

**Returns**:

- `Promise<ComputerUseProcessErrorsResponse>`

#### logs()

```ts
logs(name: string): Promise<ComputerUseProcessLogsResponse>;
```

**Parameters**:

- `name` _string_

**Returns**:

- `Promise<ComputerUseProcessLogsResponse>`

#### restart()

```ts
restart(name: string): Promise<ComputerUseProcessRestartResponse>;
```

**Parameters**:

- `name` _string_

**Returns**:

- `Promise<ComputerUseProcessRestartResponse>`

#### status()

```ts
status(): Promise<Readonly<Record<string, ComputerUseProcessStatus>>>;
```

**Returns**:

- `Promise<Readonly<Record<string, ComputerUseProcessStatus>>>`

#### status()

```ts
status(name: string): Promise<ComputerUseProcessRunningStatus>;
```

**Parameters**:

- `name` _string_

**Returns**:

- `Promise<ComputerUseProcessRunningStatus>`

***

## A11yService

### Constructors

#### Constructor

```ts
new A11yService(token: Internal, ...init: never[]): A11yService;
```

Built by the SDK: get it from `sandbox.computerUse`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `A11yService`

### Methods

#### find()

```ts
find(request: ComputerUseA11yFindRequest): Promise<ComputerUseA11yFindResponse>;
```

**Parameters**:

- `request` _ComputerUseA11yFindRequest_

**Returns**:

- `Promise<ComputerUseA11yFindResponse>`

#### focus()

```ts
focus(request: ComputerUseA11yFocusRequest): Promise<void>;
```

**Parameters**:

- `request` _ComputerUseA11yFocusRequest_

**Returns**:

- `Promise<void>`

#### invoke()

```ts
invoke(request: ComputerUseA11yInvokeRequest): Promise<void>;
```

**Parameters**:

- `request` _ComputerUseA11yInvokeRequest_

**Returns**:

- `Promise<void>`

#### setValue()

```ts
setValue(request: ComputerUseA11ySetValueRequest): Promise<void>;
```

**Parameters**:

- `request` _ComputerUseA11ySetValueRequest_

**Returns**:

- `Promise<void>`

#### tree()

```ts
tree(options: ComputerUseA11yTreeOptions): Promise<ComputerUseA11yTreeResponse>;
```

**Parameters**:

- `options` _ComputerUseA11yTreeOptions_

**Returns**:

- `Promise<ComputerUseA11yTreeResponse>`

***

## DisplayService

### Constructors

#### Constructor

```ts
new DisplayService(token: Internal, ...init: never[]): DisplayService;
```

Built by the SDK: get it from `sandbox.computerUse`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `DisplayService`

### Methods

#### info()

```ts
info(): Promise<ComputerUseDisplayInfoResponse>;
```

**Returns**:

- `Promise<ComputerUseDisplayInfoResponse>`

#### windows()

```ts
windows(): Promise<ComputerUseDisplayWindowsResponse>;
```

**Returns**:

- `Promise<ComputerUseDisplayWindowsResponse>`

***

## KeyboardService

### Constructors

#### Constructor

```ts
new KeyboardService(token: Internal, ...init: never[]): KeyboardService;
```

Built by the SDK: get it from `sandbox.computerUse`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `KeyboardService`

### Methods

#### hotkey()

```ts
hotkey(request: ComputerUseKeyboardHotkeyRequest): Promise<void>;
```

**Parameters**:

- `request` _ComputerUseKeyboardHotkeyRequest_

**Returns**:

- `Promise<void>`

#### key()

```ts
key(request: ComputerUseKeyboardKeyRequest): Promise<void>;
```

**Parameters**:

- `request` _ComputerUseKeyboardKeyRequest_

**Returns**:

- `Promise<void>`

#### type()

```ts
type(request: ComputerUseKeyboardTypeRequest): Promise<void>;
```

**Parameters**:

- `request` _ComputerUseKeyboardTypeRequest_

**Returns**:

- `Promise<void>`

***

## MouseService

### Constructors

#### Constructor

```ts
new MouseService(token: Internal, ...init: never[]): MouseService;
```

Built by the SDK: get it from `sandbox.computerUse`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `MouseService`

### Methods

#### click()

```ts
click(request: ComputerUseMouseClickRequest): Promise<ComputerUsePoint>;
```

**Parameters**:

- `request` _ComputerUseMouseClickRequest_

**Returns**:

- `Promise<ComputerUsePoint>`

#### drag()

```ts
drag(request: ComputerUseMouseDragRequest): Promise<ComputerUsePoint>;
```

**Parameters**:

- `request` _ComputerUseMouseDragRequest_

**Returns**:

- `Promise<ComputerUsePoint>`

#### move()

```ts
move(request: ComputerUseMouseMoveRequest): Promise<ComputerUsePoint>;
```

**Parameters**:

- `request` _ComputerUseMouseMoveRequest_

**Returns**:

- `Promise<ComputerUsePoint>`

#### position()

```ts
position(): Promise<ComputerUsePoint>;
```

**Returns**:

- `Promise<ComputerUsePoint>`

#### scroll()

```ts
scroll(request: ComputerUseMouseScrollRequest): Promise<ComputerUseScrollResponse>;
```

**Parameters**:

- `request` _ComputerUseMouseScrollRequest_

**Returns**:

- `Promise<ComputerUseScrollResponse>`

***

## RecordingService

### Constructors

#### Constructor

```ts
new RecordingService(token: Internal, ...init: never[]): RecordingService;
```

Built by the SDK: get it from `sandbox.computerUse`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `RecordingService`

### Methods

#### delete()

```ts
delete(id: string): Promise<void>;
```

**Parameters**:

- `id` _string_

**Returns**:

- `Promise<void>`

#### download()

```ts
download(id: string, options?: RecordingDownloadOptions): Promise<Uint8Array>;
```

Download a recording, holding the whole file in memory. A file transfer:
no total deadline, but it fails with `ClientTimeoutError` once no bytes
move for the request timeout (a request timeout of `0` leaves it
unbounded). `maxResponseBytes` replaces the client's cap on the body for
this call (`undefined` or `null` keep the client's cap, `0` means no
limit, and any other value (negative, fractional, boolean, string, above
`Number.MAX_SAFE_INTEGER`) is a `BadRequestError`); a larger recording is
refused with `PayloadTooLargeError`. For a large recording, or one from a
sandbox you do not trust, download its `filePath` with
`sandbox.fs.downloadFile()` (Node.js-only), which streams to disk with
progress and cancellation.

**Parameters**:

- `id` _string_
- `options?` _RecordingDownloadOptions_

**Returns**:

- `Promise<Uint8Array>`

#### get()

```ts
get(id: string): Promise<ComputerUseRecording>;
```

**Parameters**:

- `id` _string_

**Returns**:

- `Promise<ComputerUseRecording>`

#### list()

```ts
list(): Promise<ComputerUseRecordingsResponse>;
```

**Returns**:

- `Promise<ComputerUseRecordingsResponse>`

#### start()

```ts
start(request: ComputerUseRecordingStartRequest = {}): Promise<ComputerUseRecording>;
```

**Parameters**:

- `request` _ComputerUseRecordingStartRequest = \{\}_

**Returns**:

- `Promise<ComputerUseRecording>`

#### stop()

```ts
stop(request: ComputerUseRecordingStopRequest): Promise<ComputerUseRecording>;
```

**Parameters**:

- `request` _ComputerUseRecordingStopRequest_

**Returns**:

- `Promise<ComputerUseRecording>`

***

## ScreenService

### Constructors

#### Constructor

```ts
new ScreenService(token: Internal, ...init: never[]): ScreenService;
```

Built by the SDK: get it from `sandbox.computerUse`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `ScreenService`

### Methods

#### screenshot()

```ts
screenshot(
   options: ComputerUseScreenshotOptions = {}): Promise<ComputerUseScreenshotResponse>;
```

Capture the screen, or `options.region` of it. Setting any of `format`,
`quality` or `scale` returns a compressed image.

**Parameters**:

- `options` _ComputerUseScreenshotOptions = \{\}_

**Returns**:

- `Promise<ComputerUseScreenshotResponse>`

***

## RecordingDownloadOptions

Options of `recording.download()`; see its documentation.

**Properties**:

- `maxResponseBytes?` _number \| null_

***

## ComputerUseActivityStatus

```ts
type ComputerUseActivityStatus = 'active' | 'inactive' | 'unknown'
```

***

## ComputerUseDesktopState

```ts
type ComputerUseDesktopState = 'not_started' | 'starting' | 'ready' | 'failed' | 'unknown'
```

***

## ComputerUseDesktopFailureCode

```ts
type ComputerUseDesktopFailureCode =
  | 'desktop_exited'
  | 'addon_crashed'
  | 'start_failed'
  | 'start_interrupted'
  | 'session_ended'
  | 'session_replaced'
  | 'state_corrupt'
  | 'state_persistence_failed'
  | 'unknown'
```

***

## ComputerUseDesktopFailure

**Properties**:

- `code` _ComputerUseDesktopFailureCode_
- `rawCode` _string_
- `message` _string_
- `extraFields?` _Readonly\<Record\<string, unknown\>\>_

***

## ComputerUseFailedStatus

**Properties**:

- `status` _'inactive'_
- `desktop` _'failed'_
- `cause` _ComputerUseDesktopFailure_
- `extraFields?` _Readonly\<Record\<string, unknown\>\>_

***

## ComputerUseNotStartedStatus

**Properties**:

- `status` _'inactive'_
- `desktop` _'not_started'_
- `cause?` _never_
- `extraFields?` _Readonly\<Record\<string, unknown\>\>_

***

## ComputerUseReadyStatus

**Properties**:

- `status` _'active'_
- `desktop` _'ready'_
- `cause?` _never_
- `extraFields?` _Readonly\<Record\<string, unknown\>\>_

***

## ComputerUseRestartResponse

**Properties**:

- `message` _string_
- `status` _'active'_
- `desktop` _'ready'_
- `extraFields?` _Readonly\<Record\<string, unknown\>\>_

***

## ComputerUseStartingStatus

**Properties**:

- `status` _'inactive'_
- `desktop` _'starting'_
- `cause?` _never_
- `extraFields?` _Readonly\<Record\<string, unknown\>\>_

***

## ComputerUseUnknownStatus

A `(status, desktop)` pair this SDK release does not recognize.
`rawStatus` / `rawDesktop` carry the response values; recognized variants need no raw sibling, since
their typed values are the wire values.

**Properties**:

- `status` _'unknown'_
- `desktop` _'unknown'_
- `rawStatus` _string_
- `rawDesktop` _string_
- `cause?` _ComputerUseDesktopFailure_ - The failure attached to the unrecognized state, when present.
- `extraFields?` _Readonly\<Record\<string, unknown\>\>_

***

## ComputerUseA11yFindRequest

**Properties**:

- `scope` _ComputerUseA11yScope_
- `pid?` _number_
- `role?` _string_
- `name?` _string_
- `nameMatch?` _ComputerUseA11yNameMatch_
- `states?` _string\[\]_
- `limit?` _number_

***

## ComputerUseA11yFindResponse

**Properties**:

- `matches` _readonly ComputerUseAccessibilityNode\[\]_
- `truncated` _boolean_

***

## ComputerUseA11yFocusRequest

**Properties**:

- `id` _string_

***

## ComputerUseA11yInvokeRequest

**Properties**:

- `id` _string_
- `action?` _string_

***

## ComputerUseA11yNameMatch

```ts
type ComputerUseA11yNameMatch = 'exact' | 'substring' | 'regex'
```

***

## ComputerUseA11yScope

```ts
type ComputerUseA11yScope = 'focused' | 'pid' | 'all'
```

***

## ComputerUseA11ySetValueRequest

**Properties**:

- `id` _string_
- `value` _string_

***

## ComputerUseA11yTreeOptions

**Properties**:

- `scope` _ComputerUseA11yScope_
- `pid?` _number_
- `maxDepth?` _number_ - How many levels below the root to return: an integer from 0 to 256 (the
  SDK's cap), default 256. A deeper UI comes back cut at that depth with
  `truncated` set; `-1` (unbounded) is refused.

***

## ComputerUseA11yTreeResponse

**Properties**:

- `root` _ComputerUseAccessibilityNode_
- `truncated` _boolean_

***

## ComputerUseAccessibilityBounds

**Properties**:

- `x` _number_
- `y` _number_
- `width` _number_
- `height` _number_

***

## ComputerUseAccessibilityNode

**Properties**:

- `id` _string_
- `role` _string_
- `name` _string_
- `description?` _string_
- `value?` _string_ - A control's current value (macOS). Never set for password fields.
- `valueTruncated` _boolean_ - `value` was cut at the platform's cap. `false` when uncut or not reported; the SDK always fills it.
- `bounds` _ComputerUseAccessibilityBounds_
- `states` _readonly string\[\]_
- `actions?` _readonly string\[\]_
- `children?` _readonly ComputerUseAccessibilityNode\[\]_

***

## ComputerUseDisplay

**Properties**:

- `id` _number_
- `x` _number_
- `y` _number_
- `width` _number_
- `height` _number_
- `isActive` _boolean_

***

## ComputerUseDisplayInfoResponse

**Properties**:

- `displays` _readonly ComputerUseDisplay\[\]_

***

## ComputerUseDisplayWindowsResponse

**Properties**:

- `windows` _readonly ComputerUseWindow\[\]_

***

## ComputerUseKeyboardHotkeyRequest

**Properties**:

- `keys` _string_

***

## ComputerUseKeyboardKeyRequest

**Properties**:

- `key` _string_
- `modifiers?` _ComputerUseKeyboardModifier\[\]_

***

## ComputerUseKeyboardModifier

```ts
type ComputerUseKeyboardModifier = 'ctrl' | 'alt' | 'shift' | 'cmd'
```

***

## ComputerUseKeyboardTypeRequest

**Properties**:

- `text` _string_
- `delaySeconds?` _number_ - Pause between key presses, in seconds.

***

## ComputerUseLifecycleResponse

**Properties**:

- `message` _string_
- `status` _Readonly\<Record\<string, ComputerUseProcessStatus\>\>_

***

## ComputerUseMouseButton

```ts
type ComputerUseMouseButton = 'left' | 'right' | 'middle'
```

***

## ComputerUseMouseClickRequest

**Properties**:

- `x` _number_
- `y` _number_
- `button?` _ComputerUseMouseButton_
- `double?` _boolean_

***

## ComputerUseMouseDragRequest

**Properties**:

- `startX` _number_
- `startY` _number_
- `endX` _number_
- `endY` _number_
- `button?` _ComputerUseMouseButton_ - Default `'left'`.

***

## ComputerUseMouseMoveRequest

**Properties**:

- `x` _number_
- `y` _number_

***

## ComputerUseMouseScrollRequest

**Properties**:

- `x` _number_
- `y` _number_
- `direction` _ComputerUseScrollDirection_
- `amount?` _number_

***

## ComputerUsePoint

**Properties**:

- `x` _number_
- `y` _number_

***

## ComputerUseProcessErrorsResponse

**Properties**:

- `processName` _string_
- `errors` _string_

***

## ComputerUseProcessLogsResponse

**Properties**:

- `processName` _string_
- `logs` _string_

***

## ComputerUseProcessRestartResponse

**Properties**:

- `message` _string_
- `processName` _string_

***

## ComputerUseProcessRunningStatus

**Properties**:

- `processName` _string_
- `running` _boolean_

***

## ComputerUseProcessStatus

**Properties**:

- `running` _boolean_
- `priority` _number_
- `autoRestart` _boolean_
- `pid?` _number_
- `failed` _boolean_
- `restartAttempts` _number_
- `restartBackoffSeconds` _number_ - The current restart backoff, in seconds.
- `status` _string_
- `extraFields?` _Readonly\<Record\<string, unknown\>\>_

***

## ComputerUseRecording

**Properties**:

- `id` _string_
- `fileName` _string_
- `filePath` _string_
- `startTime` _string_
- `endTime?` _string_
- `status` _string_
- `durationSeconds?` _number_
- `sizeBytes?` _number_

***

## ComputerUseRecordingsResponse

**Properties**:

- `recordings` _readonly ComputerUseRecording\[\]_

***

## ComputerUseRecordingStartRequest

**Properties**:

- `label?` _string_

***

## ComputerUseRecordingStopRequest

**Properties**:

- `id` _string_

***

## ComputerUseRegion

**Properties**:

- `x` _number_
- `y` _number_
- `width` _number_
- `height` _number_

***

## ComputerUseResolution

A desktop resolution in pixels: 1024x768, 1280x720 or 1920x1080.

**Properties**:

- `width` _number_
- `height` _number_

***

## ComputerUseStartOptions

Options for `computerUse.start()` and `computerUse.restart()`.

**Properties**:

- `resolution?` _ComputerUseResolution_ - The desktop size (1024x768, 1280x720 or 1920x1080), kept for later starts
  and restarts. Omitted: the resolution the desktop last started at, or
  1280x720. Linux sandboxes only.

***

## ComputerUseScreenshotFormat

```ts
type ComputerUseScreenshotFormat = 'png' | 'jpeg'
```

***

## ComputerUseScreenshotOptions

Options for `screen.screenshot()`. `region` captures only that rectangle;
any of `format` / `quality` / `scale` returns a compressed image.

**Properties**:

- `region?` _ComputerUseRegion_
- `format?` _ComputerUseScreenshotFormat_
- `quality?` _number_
- `scale?` _number_
- `showCursor?` _boolean_

***

## ComputerUseScreenshotResponse

**Properties**:

- `screenshot` _string_ - The image, base64-encoded.
- `sizeBytes` _number_
- `cursorPosition?` _ComputerUsePoint_

***

## ComputerUseScrollDirection

```ts
type ComputerUseScrollDirection = 'up' | 'down'
```

***

## ComputerUseScrollResponse

**Properties**:

- `success` _boolean_

***

## ComputerUseStatusResponse

```ts
type ComputerUseStatusResponse =
  | ComputerUseNotStartedStatus
  | ComputerUseStartingStatus
  | ComputerUseReadyStatus
  | ComputerUseFailedStatus
  | ComputerUseUnknownStatus
```

***

## ComputerUseWindow

**Properties**:

- `id` _number_
- `title` _string_
- `x` _number_
- `y` _number_
- `width` _number_
- `height` _number_
- `isActive` _boolean_
