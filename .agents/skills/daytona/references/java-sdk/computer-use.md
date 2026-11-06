
## ComputerUse

Desktop automation operations for a Sandbox.

Provides a Java facade for computer-use features including desktop session management,
screenshots, mouse and keyboard automation, display/window inspection, and screen recording.

### Methods

#### start()
```java
public ComputerUseStartResponse start()
```

Starts the computer-use desktop stack (VNC/noVNC and related processes).

**Returns**:

- `ComputerUseStartResponse` - start response containing process status details

#### stop()
```java
public ComputerUseStopResponse stop()
```

Stops all computer-use desktop processes.

**Returns**:

- `ComputerUseStopResponse` - stop response containing process status details

#### getStatus()
```java
public ComputerUseStatusResponse getStatus()
```

Returns current computer-use status.

**Returns**:

- `ComputerUseStatusResponse` - overall computer-use status

#### getAccessibilityTree()
```java
public AccessibilityTreeResponse getAccessibilityTree()
```

Fetches the focused AT-SPI accessibility tree.

**Returns**:

- `AccessibilityTreeResponse` - accessibility tree response

#### getAccessibilityTree()
```java
public AccessibilityTreeResponse getAccessibilityTree(String scope, Integer pid, Integer maxDepth)
```

Fetches an AT-SPI accessibility tree.

**Parameters**:

- `scope` _String_ - scope to inspect (`focused`, `pid`, or `all`)
- `pid` _Integer_ - process ID when `scope` is `pid`
- `maxDepth` _Integer_ - max tree depth (`0` for root only)

**Returns**:

- `AccessibilityTreeResponse` - accessibility tree response

#### findAccessibilityNodes()
```java
public AccessibilityNodesResponse findAccessibilityNodes()
```

Finds AT-SPI accessibility nodes without filters.

**Returns**:

- `AccessibilityNodesResponse` - matching accessibility nodes

#### findAccessibilityNodes()
```java
public AccessibilityNodesResponse findAccessibilityNodes(FindAccessibilityNodesRequest request)
```

Finds AT-SPI accessibility nodes using a generated toolbox request.

**Parameters**:

- `request` _FindAccessibilityNodesRequest_ - generated accessibility find request

**Returns**:

- `AccessibilityNodesResponse` - matching accessibility nodes

#### focusAccessibilityNode()
```java
public void focusAccessibilityNode(String id)
```

Focuses an AT-SPI accessibility node.

**Parameters**:

- `id` _String_ - accessibility node ID

#### invokeAccessibilityNode()
```java
public void invokeAccessibilityNode(String id)
```

Invokes an AT-SPI accessibility node's primary action.

**Parameters**:

- `id` _String_ - accessibility node ID

#### invokeAccessibilityNode()
```java
public void invokeAccessibilityNode(String id, String action)
```

Invokes an AT-SPI accessibility node action.

**Parameters**:

- `id` _String_ - accessibility node ID
- `action` _String_ - action name, or `null` for the primary action

#### setAccessibilityNodeValue()
```java
public void setAccessibilityNodeValue(String id, String value)
```

Sets an AT-SPI accessibility node value.

**Parameters**:

- `id` _String_ - accessibility node ID
- `value` _String_ - value to write

#### takeScreenshot()
```java
public ScreenshotResponse takeScreenshot()
```

Captures a full-screen screenshot without cursor.

**Returns**:

- `ScreenshotResponse` - screenshot payload (base64 image and metadata)

#### takeScreenshot()
```java
public ScreenshotResponse takeScreenshot(boolean showCursor)
```

Captures a full-screen screenshot.

**Parameters**:

- `showCursor` _boolean_ - whether to render cursor in the screenshot

**Returns**:

- `ScreenshotResponse` - screenshot payload (base64 image and metadata)

#### takeRegionScreenshot()
```java
public ScreenshotResponse takeRegionScreenshot(int x, int y, int width, int height)
```

Captures a screenshot of a rectangular region without cursor.

**Parameters**:

- `x` _int_ - region top-left X coordinate
- `y` _int_ - region top-left Y coordinate
- `width` _int_ - region width in pixels
- `height` _int_ - region height in pixels

**Returns**:

- `ScreenshotResponse` - region screenshot payload

#### takeCompressedScreenshot()
```java
public ScreenshotResponse takeCompressedScreenshot(String format, int quality, double scale)
```

Captures a compressed full-screen screenshot.

**Parameters**:

- `format` _String_ - output image format (for example: `png`, `jpeg`, `webp`)
- `quality` _int_ - compression quality (typically 1-100, format dependent)
- `scale` _double_ - screenshot scale factor (for example: `0.5` for 50%)

**Returns**:

- `ScreenshotResponse` - compressed screenshot payload

#### click()
```java
public MouseClickResponse click(int x, int y)
```

Performs a left mouse click at the given coordinates.

**Parameters**:

- `x` _int_ - target X coordinate
- `y` _int_ - target Y coordinate

**Returns**:

- `MouseClickResponse` - click response with resulting cursor position

#### click()
```java
public MouseClickResponse click(int x, int y, String button)
```

Performs a mouse click at the given coordinates with a specific button.

**Parameters**:

- `x` _int_ - target X coordinate
- `y` _int_ - target Y coordinate
- `button` _String_ - button type (`left`, `right`, `middle`)

**Returns**:

- `MouseClickResponse` - click response with resulting cursor position

#### click()
```java
public MouseClickResponse click(int x, int y, String button, Integer clicks, List<String> modifiers)
```

Performs a mouse click with an explicit repeat count and modifier keys.

**Parameters**:

- `x` _int_ - target X coordinate
- `y` _int_ - target Y coordinate
- `button` _String_ - button type (`left`, `right`, `middle`)
- `clicks` _Integer_ - number of clicks to perform, from `1` to `10`, or `null` for a single click
- `modifiers` _List\<String\>_ - modifier keys held for the duration of the click. Canonical names are `ctrl`, `alt`, `shift`, and `cmd`; `null` holds no modifiers

**Returns**:

- `MouseClickResponse` - click response with resulting cursor position

#### doubleClick()
```java
public MouseClickResponse doubleClick(int x, int y)
```

Performs a double left-click at the given coordinates.

**Parameters**:

- `x` _int_ - target X coordinate
- `y` _int_ - target Y coordinate

**Returns**:

- `MouseClickResponse` - click response with resulting cursor position

#### mouseDown()
```java
public MousePositionResponse mouseDown()
```

Presses and holds the left mouse button at the current cursor position.

The button stays held until a matching `mouseUp` call. Modifier keys are not
part of the press itself; hold them with `#keyDown(String)` around the press.

**Returns**:

- `MousePositionResponse` - mouse position after the button press

#### mouseDown()
```java
public MousePositionResponse mouseDown(String button)
```

Presses and holds a mouse button at the current cursor position.

**Parameters**:

- `button` _String_ - button to press (`left`, `right`, `middle`)

**Returns**:

- `MousePositionResponse` - mouse position after the button press

#### mouseDown()
```java
public MousePositionResponse mouseDown(int x, int y)
```

Moves to the given coordinates and presses and holds the left mouse button there.

**Parameters**:

- `x` _int_ - X coordinate to move to before pressing
- `y` _int_ - Y coordinate to move to before pressing

**Returns**:

- `MousePositionResponse` - mouse position after the button press

#### mouseDown()
```java
public MousePositionResponse mouseDown(int x, int y, String button)
```

Moves to the given coordinates and presses and holds a mouse button there.

**Parameters**:

- `x` _int_ - X coordinate to move to before pressing
- `y` _int_ - Y coordinate to move to before pressing
- `button` _String_ - button to press (`left`, `right`, `middle`)

**Returns**:

- `MousePositionResponse` - mouse position after the button press

#### mouseUp()
```java
public MousePositionResponse mouseUp()
```

Releases the left mouse button at the current cursor position.

**Returns**:

- `MousePositionResponse` - mouse position after the button release

#### mouseUp()
```java
public MousePositionResponse mouseUp(String button)
```

Releases a held mouse button at the current cursor position.

**Parameters**:

- `button` _String_ - button to release (`left`, `right`, `middle`)

**Returns**:

- `MousePositionResponse` - mouse position after the button release

#### mouseUp()
```java
public MousePositionResponse mouseUp(int x, int y)
```

Moves to the given coordinates and releases the left mouse button there.

Pairing `#mouseDown(int, int)` with this method composes a manual
press-move-release drag.

**Parameters**:

- `x` _int_ - X coordinate to move to before releasing
- `y` _int_ - Y coordinate to move to before releasing

**Returns**:

- `MousePositionResponse` - mouse position after the button release

#### mouseUp()
```java
public MousePositionResponse mouseUp(int x, int y, String button)
```

Moves to the given coordinates and releases a held mouse button there.

**Parameters**:

- `x` _int_ - X coordinate to move to before releasing
- `y` _int_ - Y coordinate to move to before releasing
- `button` _String_ - button to release (`left`, `right`, `middle`)

**Returns**:

- `MousePositionResponse` - mouse position after the button release

#### moveMouse()
```java
public MousePositionResponse moveMouse(int x, int y)
```

Moves the mouse cursor to the given coordinates.

**Parameters**:

- `x` _int_ - target X coordinate
- `y` _int_ - target Y coordinate

**Returns**:

- `MousePositionResponse` - new mouse position

#### getMousePosition()
```java
public MousePositionResponse getMousePosition()
```

Returns current mouse position.

**Returns**:

- `MousePositionResponse` - current mouse cursor coordinates

#### drag()
```java
public MouseDragResponse drag(int startX, int startY, int endX, int endY)
```

Drags the mouse from one point to another using the left button.

**Parameters**:

- `startX` _int_ - drag start X coordinate
- `startY` _int_ - drag start Y coordinate
- `endX` _int_ - drag end X coordinate
- `endY` _int_ - drag end Y coordinate

**Returns**:

- `MouseDragResponse` - drag response with resulting cursor position

#### drag()
```java
public MouseDragResponse drag(int startX, int startY, int endX, int endY, String button)
```

Drags the mouse from one point to another using a specific button.

**Parameters**:

- `startX` _int_ - drag start X coordinate
- `startY` _int_ - drag start Y coordinate
- `endX` _int_ - drag end X coordinate
- `endY` _int_ - drag end Y coordinate
- `button` _String_ - button held for the drag (`left`, `right`, `middle`)

**Returns**:

- `MouseDragResponse` - drag response with resulting cursor position

#### scroll()
```java
public ScrollResponse scroll(int x, int y, int deltaX, int deltaY)
```

Scrolls at the given coordinates.

The current toolbox API supports directional scrolling (`up`/`down`) with an
amount. This method maps `deltaY` to vertical scroll direction and magnitude.
If `deltaY` is `0`, `deltaX` is used as a fallback.

**Parameters**:

- `x` _int_ - anchor X coordinate
- `y` _int_ - anchor Y coordinate
- `deltaX` _int_ - horizontal delta (used only when `deltaY == 0`)
- `deltaY` _int_ - vertical delta

**Returns**:

- `ScrollResponse` - scroll response indicating operation success

#### scroll()
```java
public ScrollResponse scroll(int x, int y, int deltaX, int deltaY, List<String> modifiers)
```

Scrolls at the given coordinates with modifier keys held down.

Delta-to-direction mapping is identical to `#scroll(int, int, int, int)`: this
form only resolves vertical directions (`up`/`down`). Use
`#scroll(int, int, String, int, List)` for horizontal scrolling.

**Parameters**:

- `x` _int_ - anchor X coordinate
- `y` _int_ - anchor Y coordinate
- `deltaX` _int_ - horizontal delta (used only when `deltaY == 0`)
- `deltaY` _int_ - vertical delta
- `modifiers` _List\<String\>_ - modifier keys held for the duration of the scroll. Canonical names are `ctrl`, `alt`, `shift`, and `cmd`; `null` holds no modifiers

**Returns**:

- `ScrollResponse` - scroll response indicating operation success

#### scroll()
```java
public ScrollResponse scroll(int x, int y, String direction, int amount)
```

Scrolls at the given coordinates in an explicit direction.

**Parameters**:

- `x` _int_ - anchor X coordinate
- `y` _int_ - anchor Y coordinate
- `direction` _String_ - scroll direction (`up`, `down`, `left`, `right`)
- `amount` _int_ - number of scroll steps

**Returns**:

- `ScrollResponse` - scroll response indicating operation success

#### scroll()
```java
public ScrollResponse scroll(int x, int y, String direction, int amount, List<String> modifiers)
```

Scrolls at the given coordinates in an explicit direction with modifier keys held down.

**Parameters**:

- `x` _int_ - anchor X coordinate
- `y` _int_ - anchor Y coordinate
- `direction` _String_ - scroll direction (`up`, `down`, `left`, `right`)
- `amount` _int_ - number of scroll steps
- `modifiers` _List\<String\>_ - modifier keys held for the duration of the scroll. Canonical names are `ctrl`, `alt`, `shift`, and `cmd`; `null` holds no modifiers

**Returns**:

- `ScrollResponse` - scroll response indicating operation success

#### typeText()
```java
public void typeText(String text)
```

Types text using keyboard automation.

**Parameters**:

- `text` _String_ - text to type

#### pressKey()
```java
public void pressKey(String key)
```

Presses a single key.

**Parameters**:

- `key` _String_ - key to press. Canonical names include `enter`, `escape`, `tab`, letters, digits, unshifted punctuation, function keys, and grammar-safe numpad names such as `num_plus`. Named keys are case-insensitive, and common aliases such as `Return` and `Escape` are normalized.

#### pressHotkey()
```java
public void pressHotkey(String... keys)
```

Presses a key combination as a hotkey sequence.

Keys are joined with `+` before being sent (for example,
`pressHotkey("ctrl", "shift", "t") -> "ctrl+shift+t"`). The resulting
value is a single atomic chord and uses the same normalized key contract as
`#pressKey(String)`.

**Parameters**:

- `keys` _String..._ - hotkey parts to combine

#### keyDown()
```java
public void keyDown(String key)
```

Presses and holds a key until a matching `#keyUp(String)` call.

Unlike `#pressHotkey(String...)`, which sends one atomic chord, this leaves the
key physically held so other actions can happen underneath it (for example, holding
`shift` across a drag). Always pair it with `#keyUp(String)`.

**Parameters**:

- `key` _String_ - key to hold down. Modifiers use the canonical names `ctrl`, `alt`, `shift`, and `cmd`; all other keys follow the same normalized contract as `#pressKey(String)`

#### keyUp()
```java
public void keyUp(String key)
```

Releases a key that is currently held down by `#keyDown(String)`.

**Parameters**:

- `key` _String_ - key to release, using the same names accepted by `#keyDown(String)`

#### getDisplayInfo()
```java
public DisplayInfoResponse getDisplayInfo()
```

Returns display configuration information.

**Returns**:

- `DisplayInfoResponse` - display information including available displays and their geometry

#### getWindows()
```java
public WindowsResponse getWindows()
```

Returns currently open windows.

**Returns**:

- `WindowsResponse` - window list and metadata

#### startRecording()
```java
public Recording startRecording()
```

Starts a recording with default options.

**Returns**:

- `Recording` - newly started recording metadata

#### startRecording()
```java
public Recording startRecording(String label)
```

Starts a recording with an optional label.

**Parameters**:

- `label` _String_ - optional recording label

**Returns**:

- `Recording` - newly started recording metadata

#### stopRecording()
```java
public Recording stopRecording(String id)
```

Stops an active recording.

**Parameters**:

- `id` _String_ - recording identifier

**Returns**:

- `Recording` - finalized recording metadata

#### listRecordings()
```java
public ListRecordingsResponse listRecordings()
```

Lists all recordings for the current sandbox session.

**Returns**:

- `ListRecordingsResponse` - recordings list response

#### getRecording()
```java
public Recording getRecording(String id)
```

Returns metadata for a specific recording.

**Parameters**:

- `id` _String_ - recording identifier

**Returns**:

- `Recording` - recording details

#### downloadRecording()
```java
public File downloadRecording(String id)
```

Downloads a recording file.

**Parameters**:

- `id` _String_ - recording identifier

**Returns**:

- `File` - downloaded temporary/local file handle returned by the API client

#### deleteRecording()
```java
public void deleteRecording(String id)
```

Deletes a recording.

**Parameters**:

- `id` _String_ - recording identifier

## See Also
- [Python SDK - computer-use](../python-sdk/sync/computer-use.md)
- [TypeScript SDK - computer-use](../typescript-sdk/computer-use.md)
