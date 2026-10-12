## Contents

- ComputerUse
- Mouse
- Keyboard
- Screenshot
- Display
- RecordingService
- Accessibility
- ScreenshotRegion
- ScreenshotOptions


> For the async version, see [async/computer-use.md](../async/computer-use.md)


## ComputerUse

```python
class ComputerUse()
```

Computer Use functionality for interacting with the desktop environment.

Provides access to mouse, keyboard, screenshot, display, recording, and accessibility operations
for automating desktop interactions within a sandbox.

**Attributes**:

- `mouse` _Mouse_ - Mouse operations interface.
- `keyboard` _Keyboard_ - Keyboard operations interface.
- `screenshot` _Screenshot_ - Screenshot operations interface.
- `display` _Display_ - Display operations interface.
- `recording` _RecordingService_ - Screen recording operations interface.
- `accessibility` _Accessibility_ - Accessibility operations interface.

#### ComputerUse.start

```python
@intercept_errors(message_prefix="Failed to start computer use: ")
@with_instrumentation()
def start(request_timeout: float | None = None) -> ComputerUseStartResponse
```

Starts all computer use processes (Xvfb, xfce4, x11vnc, novnc).

**Arguments**:

- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ComputerUseStartResponse` - Computer use start response.


**Example**:

```python
result = sandbox.computer_use.start()
print("Computer use processes started:", result.message)
```

#### ComputerUse.stop

```python
@intercept_errors(message_prefix="Failed to stop computer use: ")
@with_instrumentation()
def stop(request_timeout: float | None = None) -> ComputerUseStopResponse
```

Stops all computer use processes.

**Arguments**:

- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ComputerUseStopResponse` - Computer use stop response.


**Example**:

```python
result = sandbox.computer_use.stop()
print("Computer use processes stopped:", result.message)
```

#### ComputerUse.get\_status

```python
@intercept_errors(message_prefix="Failed to get computer use status: ")
@with_instrumentation()
def get_status(
        request_timeout: float | None = None) -> ComputerUseStatusResponse
```

Gets the status of all computer use processes.

**Arguments**:

- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ComputerUseStatusResponse` - Status information about all VNC desktop processes.


**Example**:

```python
response = sandbox.computer_use.get_status()
print("Computer use status:", response.status)
```

#### ComputerUse.get\_process\_status

```python
@intercept_errors(message_prefix="Failed to get process status: ")
@with_instrumentation()
def get_process_status(
        process_name: str,
        request_timeout: float | None = None) -> ProcessStatusResponse
```

Gets the status of a specific VNC process.

**Arguments**:

- `process_name` _str_ - Name of the process to check.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ProcessStatusResponse` - Status information about the specific process.


**Example**:

```python
xvfb_status = sandbox.computer_use.get_process_status("xvfb")
no_vnc_status = sandbox.computer_use.get_process_status("novnc")
```

#### ComputerUse.restart\_process

```python
@intercept_errors(message_prefix="Failed to restart process: ")
@with_instrumentation()
def restart_process(
        process_name: str,
        request_timeout: float | None = None) -> ProcessRestartResponse
```

Restarts a specific VNC process.

**Arguments**:

- `process_name` _str_ - Name of the process to restart.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ProcessRestartResponse` - Process restart response.


**Example**:

```python
result = sandbox.computer_use.restart_process("xfce4")
print("XFCE4 process restarted:", result.message)
```

#### ComputerUse.get\_process\_logs

```python
@intercept_errors(message_prefix="Failed to get process logs: ")
@with_instrumentation()
def get_process_logs(
        process_name: str,
        request_timeout: float | None = None) -> ProcessLogsResponse
```

Gets logs for a specific VNC process.

**Arguments**:

- `process_name` _str_ - Name of the process to get logs for.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ProcessLogsResponse` - Process logs.


**Example**:

```python
logs = sandbox.computer_use.get_process_logs("novnc")
print("NoVNC logs:", logs)
```

#### ComputerUse.get\_process\_errors

```python
@intercept_errors(message_prefix="Failed to get process errors: ")
@with_instrumentation()
def get_process_errors(
        process_name: str,
        request_timeout: float | None = None) -> ProcessErrorsResponse
```

Gets error logs for a specific VNC process.

**Arguments**:

- `process_name` _str_ - Name of the process to get error logs for.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ProcessErrorsResponse` - Process error logs.


**Example**:

```python
errors = sandbox.computer_use.get_process_errors("x11vnc")
print("X11VNC errors:", errors)
```

## Mouse

```python
class Mouse()
```

Mouse operations for computer use functionality.

#### Mouse.get\_position

```python
@intercept_errors(message_prefix="Failed to get mouse position: ")
@with_instrumentation()
def get_position(
        request_timeout: float | None = None) -> MousePositionResponse
```

Gets the current mouse cursor position.

**Arguments**:

- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `MousePositionResponse` - Current mouse position with x and y coordinates.


**Example**:

```python
position = sandbox.computer_use.mouse.get_position()
print(f"Mouse is at: {position.x}, {position.y}")
```

#### Mouse.move

```python
@intercept_errors(message_prefix="Failed to move mouse: ")
@with_instrumentation()
def move(x: int,
         y: int,
         request_timeout: float | None = None) -> MousePositionResponse
```

Moves the mouse cursor to the specified coordinates.

**Arguments**:

- `x` _int_ - The x coordinate to move to.
- `y` _int_ - The y coordinate to move to.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `MousePositionResponse` - Position after move.


**Example**:

```python
result = sandbox.computer_use.mouse.move(100, 200)
print(f"Mouse moved to: {result.x}, {result.y}")
```

#### Mouse.click

```python
@intercept_errors(message_prefix="Failed to click mouse: ")
@with_instrumentation()
def click(x: int,
          y: int,
          button: str = "left",
          double: bool = False,
          request_timeout: float | None = None) -> MouseClickResponse
```

Clicks the mouse at the specified coordinates.

**Arguments**:

- `x` _int_ - The x coordinate to click at.
- `y` _int_ - The y coordinate to click at.
- `button` _str_ - The mouse button to click ('left', 'right', 'middle').
- `double` _bool_ - Whether to perform a double-click.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `MouseClickResponse` - Click operation result.


**Example**:

```python
# Single left click
result = sandbox.computer_use.mouse.click(100, 200)

# Double click
double_click = sandbox.computer_use.mouse.click(100, 200, "left", True)

# Right click
right_click = sandbox.computer_use.mouse.click(100, 200, "right")
```

#### Mouse.drag

```python
@intercept_errors(message_prefix="Failed to drag mouse: ")
@with_instrumentation()
def drag(start_x: int,
         start_y: int,
         end_x: int,
         end_y: int,
         button: str = "left",
         request_timeout: float | None = None) -> MouseDragResponse
```

Drags the mouse from start coordinates to end coordinates.

**Arguments**:

- `start_x` _int_ - The starting x coordinate.
- `start_y` _int_ - The starting y coordinate.
- `end_x` _int_ - The ending x coordinate.
- `end_y` _int_ - The ending y coordinate.
- `button` _str_ - The mouse button to use for dragging.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `MouseDragResponse` - Drag operation result.


**Example**:

```python
result = sandbox.computer_use.mouse.drag(50, 50, 150, 150)
print(f"Drag ended at {result.x}, {result.y}")
```

#### Mouse.scroll

```python
@intercept_errors(message_prefix="Failed to scroll mouse: ")
@with_instrumentation()
def scroll(x: int,
           y: int,
           direction: str,
           amount: int = 1,
           request_timeout: float | None = None) -> bool
```

Scrolls the mouse wheel at the specified coordinates.

**Arguments**:

- `x` _int_ - The x coordinate to scroll at.
- `y` _int_ - The y coordinate to scroll at.
- `direction` _str_ - The direction to scroll ('up' or 'down').
- `amount` _int_ - The amount to scroll.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `bool` - Whether the scroll operation was successful.


**Example**:

```python
# Scroll up
scroll_up = sandbox.computer_use.mouse.scroll(100, 200, "up", 3)

# Scroll down
scroll_down = sandbox.computer_use.mouse.scroll(100, 200, "down", 5)
```

## Keyboard

```python
class Keyboard()
```

Keyboard operations for computer use functionality.

#### Keyboard.type

```python
@intercept_errors(message_prefix="Failed to type text: ")
@with_instrumentation()
def type(text: str,
         delay: int | None = None,
         request_timeout: float | None = None) -> None
```

Types the specified text.

**Arguments**:

- `text` _str_ - The text to type.
- `delay` _int_ - Delay between characters in milliseconds.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Raises**:

- `DaytonaError` - If the type operation fails.


**Example**:

```python
try:
    sandbox.computer_use.keyboard.type("Hello, World!")
    print(f"Operation success")
except Exception as e:
    print(f"Operation failed: {e}")

# With delay between characters
try:
    sandbox.computer_use.keyboard.type("Slow typing", 100)
    print(f"Operation success")
except Exception as e:
    print(f"Operation failed: {e}")
```

#### Keyboard.press

```python
@intercept_errors(message_prefix="Failed to press key: ")
@with_instrumentation()
def press(key: str,
          modifiers: list[str] | None = None,
          request_timeout: float | None = None) -> None
```

Presses a key with optional modifiers.

**Arguments**:

- `key` _str_ - The key to press. Canonical names include 'enter', 'escape',
  'tab', letters, digits, unshifted punctuation, function keys, and
  grammar-safe numpad names such as 'num_plus'. Named keys are
  case-insensitive, and common aliases such as 'Return' and 'Escape'
  are normalized.
- `modifiers` _list[str]_ - Canonical modifier names are 'ctrl', 'alt',
  'shift', and 'cmd'. Common aliases such as 'control', 'option',
  'meta', and 'win' are normalized.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Raises**:

- `DaytonaError` - If the press operation fails.


**Example**:

```python
# Press Enter
try:
    sandbox.computer_use.keyboard.press("enter")
    print(f"Operation success")
except Exception as e:
    print(f"Operation failed: {e}")

# Press Ctrl+C
try:
    sandbox.computer_use.keyboard.press("c", ["ctrl"])
    print(f"Operation success")

# Press Ctrl+Shift+T
try:
    sandbox.computer_use.keyboard.press("t", ["ctrl", "shift"])
    print(f"Operation success")
except Exception as e:
    print(f"Operation failed: {e}")
```

#### Keyboard.hotkey

```python
@intercept_errors(message_prefix="Failed to press hotkey: ")
@with_instrumentation()
def hotkey(keys: str, request_timeout: float | None = None) -> None
```

Presses a hotkey combination.

**Arguments**:

- `keys` _str_ - A single atomic hotkey chord (e.g., 'ctrl+c', 'alt+tab',
  'cmd+shift+t', 'ctrl + c', 'shift'). Uses the same normalized key
  contract as ``press()``.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Raises**:

- `DaytonaError` - If the hotkey operation fails.


**Example**:

```python
# Copy
try:
    sandbox.computer_use.keyboard.hotkey("ctrl+c")
    print(f"Operation success")
except Exception as e:
    print(f"Operation failed: {e}")

# Paste
try:
    sandbox.computer_use.keyboard.hotkey("ctrl+v")
    print(f"Operation success")
except Exception as e:
    print(f"Operation failed: {e}")

# Alt+Tab
try:
    sandbox.computer_use.keyboard.hotkey("alt+tab")
    print(f"Operation success")
except Exception as e:
    print(f"Operation failed: {e}")
```

## Screenshot

```python
class Screenshot()
```

Screenshot operations for computer use functionality.

#### Screenshot.take\_full\_screen

```python
@intercept_errors(message_prefix="Failed to take screenshot: ")
@with_instrumentation()
def take_full_screen(
        show_cursor: bool = False,
        request_timeout: float | None = None) -> ScreenshotResponse
```

Takes a screenshot of the entire screen.

**Arguments**:

- `show_cursor` _bool_ - Whether to show the cursor in the screenshot.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ScreenshotResponse` - Screenshot data with base64 encoded image.


**Example**:

```python
screenshot = sandbox.computer_use.screenshot.take_full_screen()
print(f"Screenshot size: {screenshot.width}x{screenshot.height}")

# With cursor visible
with_cursor = sandbox.computer_use.screenshot.take_full_screen(True)
```

#### Screenshot.take\_region

```python
@intercept_errors(message_prefix="Failed to take region screenshot: ")
@with_instrumentation()
def take_region(region: ScreenshotRegion,
                show_cursor: bool = False,
                request_timeout: float | None = None) -> ScreenshotResponse
```

Takes a screenshot of a specific region.

**Arguments**:

- `region` _ScreenshotRegion_ - The region to capture.
- `show_cursor` _bool_ - Whether to show the cursor in the screenshot.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ScreenshotResponse` - Screenshot data with base64 encoded image.


**Example**:

```python
region = ScreenshotRegion(x=100, y=100, width=300, height=200)
screenshot = sandbox.computer_use.screenshot.take_region(region)
print(f"Captured region: {screenshot.region.width}x{screenshot.region.height}")
```

#### Screenshot.take\_compressed

```python
@intercept_errors(message_prefix="Failed to take compressed screenshot: ")
@with_instrumentation()
def take_compressed(
        options: ScreenshotOptions | None = None,
        request_timeout: float | None = None) -> ScreenshotResponse
```

Takes a compressed screenshot of the entire screen.

**Arguments**:

- `options` _ScreenshotOptions | None_ - Compression and display options.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ScreenshotResponse` - Compressed screenshot data.


**Example**:

```python
# Default compression
screenshot = sandbox.computer_use.screenshot.take_compressed()

# High quality JPEG
jpeg = sandbox.computer_use.screenshot.take_compressed(
    ScreenshotOptions(format="jpeg", quality=95, show_cursor=True)
)

# Scaled down PNG
scaled = sandbox.computer_use.screenshot.take_compressed(
    ScreenshotOptions(format="png", scale=0.5)
)
```

#### Screenshot.take\_compressed\_region

```python
@intercept_errors(
    message_prefix="Failed to take compressed region screenshot: ")
@with_instrumentation()
def take_compressed_region(
        region: ScreenshotRegion,
        options: ScreenshotOptions | None = None,
        request_timeout: float | None = None) -> ScreenshotResponse
```

Takes a compressed screenshot of a specific region.

**Arguments**:

- `region` _ScreenshotRegion_ - The region to capture.
- `options` _ScreenshotOptions | None_ - Compression and display options.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ScreenshotResponse` - Compressed screenshot data.


**Example**:

```python
region = ScreenshotRegion(x=0, y=0, width=800, height=600)
screenshot = sandbox.computer_use.screenshot.take_compressed_region(
    region,
    ScreenshotOptions(format="webp", quality=80, show_cursor=True)
)
print(f"Compressed size: {screenshot.size_bytes} bytes")
```

## Display

```python
class Display()
```

Display operations for computer use functionality.

#### Display.get\_info

```python
@intercept_errors(message_prefix="Failed to get display info: ")
@with_instrumentation()
def get_info(request_timeout: float | None = None) -> DisplayInfoResponse
```

Gets information about the displays.

**Arguments**:

- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `DisplayInfoResponse` - Display information including primary display and all available displays.


**Example**:

```python
info = sandbox.computer_use.display.get_info()
print(f"Primary display: {info.primary_display.width}x{info.primary_display.height}")
print(f"Total displays: {info.total_displays}")
for i, display in enumerate(info.displays):
    print(f"Display {i}: {display.width}x{display.height} at {display.x},{display.y}")
```

#### Display.get\_windows

```python
@intercept_errors(message_prefix="Failed to get windows: ")
@with_instrumentation()
def get_windows(request_timeout: float | None = None) -> WindowsResponse
```

Gets the list of open windows.

**Arguments**:

- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `WindowsResponse` - List of open windows with their IDs and titles.


**Example**:

```python
windows = sandbox.computer_use.display.get_windows()
print(f"Found {windows.count} open windows:")
for window in windows.windows:
    print(f"- {window.title} (ID: {window.id})")
```

## RecordingService

```python
class RecordingService()
```

Recording operations for computer use functionality.

#### RecordingService.start

```python
@intercept_errors(message_prefix="Failed to start recording: ")
@with_instrumentation()
def start(label: str | None = None,
          request_timeout: float | None = None) -> Recording
```

Starts a new screen recording session.

**Arguments**:

- `label` _str | None_ - Optional custom label for the recording.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `Recording` - Recording start response.


**Example**:

```python
# Start a recording with a label
recording = sandbox.computer_use.recording.start("my-test-recording")
print(f"Recording started: {recording.id}")
print(f"File: {recording.file_path}")
```

#### RecordingService.stop

```python
@intercept_errors(message_prefix="Failed to stop recording: ")
@with_instrumentation()
def stop(recording_id: str, request_timeout: float | None = None) -> Recording
```

Stops an active screen recording session.

**Arguments**:

- `recording_id` _str_ - The ID of the recording to stop.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `Recording` - Recording stop response.


**Example**:

```python
result = sandbox.computer_use.recording.stop(recording.id)
print(f"Recording stopped: {result.duration_seconds} seconds")
print(f"Saved to: {result.file_path}")
```

#### RecordingService.list

```python
@intercept_errors(message_prefix="Failed to list recordings: ")
@with_instrumentation()
def list(request_timeout: float | None = None) -> ListRecordingsResponse
```

Lists all recordings (active and completed).

**Arguments**:

- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `ListRecordingsResponse` - List of all recordings.


**Example**:

```python
recordings = sandbox.computer_use.recording.list()
print(f"Found {len(recordings.recordings)} recordings")
for rec in recordings.recordings:
    print(f"- {rec.file_name}: {rec.status}")
```

#### RecordingService.get

```python
@intercept_errors(message_prefix="Failed to get recording: ")
@with_instrumentation()
def get(recording_id: str, request_timeout: float | None = None) -> Recording
```

Gets details of a specific recording by ID.

**Arguments**:

- `recording_id` _str_ - The ID of the recording to retrieve.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `Recording` - Recording details.


**Example**:

```python
recording = sandbox.computer_use.recording.get(recording_id)
print(f"Recording: {recording.file_name}")
print(f"Status: {recording.status}")
print(f"Duration: {recording.duration_seconds} seconds")
```

#### RecordingService.delete

```python
@intercept_errors(message_prefix="Failed to delete recording: ")
@with_instrumentation()
def delete(recording_id: str, request_timeout: float | None = None) -> None
```

Deletes a recording by ID.

**Arguments**:

- `recording_id` _str_ - The ID of the recording to delete.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Example**:

```python
sandbox.computer_use.recording.delete(recording_id)
print("Recording deleted")
```

#### RecordingService.download

```python
@intercept_errors(message_prefix="Failed to download recording: ")
@with_instrumentation()
def download(recording_id: str, local_path: str) -> None
```

Downloads a recording file from the Sandbox and saves it to a local file.

The file is streamed directly to disk without loading the entire content into memory.

**Arguments**:

- `recording_id` _str_ - The ID of the recording to download.
- `local_path` _str_ - Path to save the recording file locally.


**Example**:

```python
# Download recording to file
sandbox.computer_use.recording.download(recording_id, "local_recording.mp4")
print("Recording downloaded")
```

## Accessibility

```python
class Accessibility()
```

Accessibility operations for computer use functionality.

This service exposes thin wrappers over the toolbox AT-SPI accessibility
API. Start computer use before calling these methods.

#### Accessibility.get\_tree

```python
@intercept_errors(message_prefix="Failed to get accessibility tree: ")
@with_instrumentation()
def get_tree(
        scope: str | None = None,
        pid: int | None = None,
        max_depth: int | None = None,
        request_timeout: float | None = None) -> AccessibilityTreeResponse
```

Fetches the AT-SPI accessibility tree.

**Arguments**:

- `scope` _str | None_ - Tree scope to inspect: ``focused``, ``pid``, or ``all``.
- `pid` _int | None_ - Process ID when ``scope`` is ``pid``.
- `max_depth` _int | None_ - Maximum depth to descend. Use ``0`` for the root only.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `AccessibilityTreeResponse` - Accessibility tree rooted at the requested scope.


**Example**:

```python
tree = sandbox.computer_use.accessibility.get_tree(scope="all", max_depth=3)
print(tree.root.name)
```

#### Accessibility.find\_nodes

```python
@intercept_errors(message_prefix="Failed to find accessibility nodes: ")
@with_instrumentation()
def find_nodes(
        scope: str | None = None,
        pid: int | None = None,
        role: str | None = None,
        name: str | None = None,
        name_match: str | None = None,
        states: list[str] | None = None,
        limit: int | None = None,
        request_timeout: float | None = None) -> AccessibilityNodesResponse
```

Finds AT-SPI accessibility nodes matching the provided filters.

**Arguments**:

- `scope` _str | None_ - Search scope: ``focused``, ``pid``, or ``all``.
- `pid` _int | None_ - Process ID when ``scope`` is ``pid``.
- `role` _str | None_ - Accessibility role to match, such as ``button``.
- `name` _str | None_ - Accessible name to match.
- `name_match` _str | None_ - Name match mode, such as ``exact`` or ``substring``.
- `states` _list[str] | None_ - Required accessibility states.
- `limit` _int | None_ - Maximum number of matches. Use ``0`` to let the API apply its default.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Returns**:

- `AccessibilityNodesResponse` - Matching accessibility nodes.


**Example**:

```python
buttons = sandbox.computer_use.accessibility.find_nodes(
    scope="all",
    role="button",
    name="Submit",
    name_match="substring",
)
print(len(buttons.matches))
```

#### Accessibility.focus\_node

```python
@intercept_errors(message_prefix="Failed to focus accessibility node: ")
@with_instrumentation()
def focus_node(node_id: str, request_timeout: float | None = None) -> None
```

Focuses an AT-SPI accessibility node.

**Arguments**:

- `node_id` _str_ - Accessibility node ID returned by ``get_tree`` or ``find_nodes``.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Raises**:

- `DaytonaError` - If the focus operation fails. API failures may use a more specific subclass.


**Example**:

```python
sandbox.computer_use.accessibility.focus_node(node.id)
```

#### Accessibility.invoke\_node

```python
@intercept_errors(message_prefix="Failed to invoke accessibility node: ")
@with_instrumentation()
def invoke_node(node_id: str,
                action: str | None = None,
                request_timeout: float | None = None) -> None
```

Invokes an AT-SPI accessibility node action.

**Arguments**:

- `node_id` _str_ - Accessibility node ID returned by ``get_tree`` or ``find_nodes``.
- `action` _str | None_ - Action name to invoke. If omitted, the API invokes the primary action.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Raises**:

- `DaytonaError` - If the invoke operation fails. API failures may use a more specific subclass.


**Example**:

```python
sandbox.computer_use.accessibility.invoke_node(node.id, action="click")
```

#### Accessibility.set\_node\_value

```python
@intercept_errors(message_prefix="Failed to set accessibility node value: ")
@with_instrumentation()
def set_node_value(node_id: str,
                   value: str,
                   request_timeout: float | None = None) -> None
```

Sets an AT-SPI accessibility node value.

**Arguments**:

- `node_id` _str_ - Accessibility node ID returned by ``get_tree`` or ``find_nodes``.
- `value` _str_ - Value to write to the node.
- `request_timeout` _float | None_ - Optional client-side request timeout in seconds. Client-side
  only. It bounds how long the SDK waits for the HTTP response and does not cancel
  the operation on the server. Positive values under 1 second are rounded up to 1
  second; 0 disables the client-side timeout and negative values are rejected.


**Raises**:

- `DaytonaError` - If the value update fails. API failures may use a more specific subclass.


**Example**:

```python
sandbox.computer_use.accessibility.set_node_value(node.id, "hello")
```

## ScreenshotRegion

```python
class ScreenshotRegion(BaseModel)
```

Region coordinates for screenshot operations.

**Attributes**:

- `x` _int_ - X coordinate of the region.
- `y` _int_ - Y coordinate of the region.
- `width` _int_ - Width of the region.
- `height` _int_ - Height of the region.

## ScreenshotOptions

```python
class ScreenshotOptions(BaseModel)
```

Options for screenshot compression and display.

**Attributes**:

- `show_cursor` _bool | None_ - Whether to show the cursor in the screenshot.
- `fmt` _str | None_ - Image format (e.g., 'png', 'jpeg', 'webp').
- `quality` _int | None_ - Compression quality (0-100).
- `scale` _float | None_ - Scale factor for the screenshot.
