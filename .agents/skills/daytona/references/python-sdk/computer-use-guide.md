## Contents

- Start Computer Use
- Stop Computer Use
- Get status
- Get process status
- Restart process
- Get process logs
- Get process errors
- Mouse operations
- Keyboard operations
- Accessibility operations
- Screenshot operations
- Screen Recording
- Display operations




Computer Use enables programmatic control of desktop environments within sandboxes. It provides mouse, keyboard, screenshot, screen recording, and display operations for automating GUI interactions and testing desktop applications.

Computer Use and [VNC](./vnc-access.md) work together to enable both manual and automated desktop interactions. VNC provides the visual interface for users to manually interact with the desktop, while Computer Use provides the programmatic API for AI agents to automate operations.

Computer Use is available for **Linux** and **Windows** through Daytona. For **macOS** sandboxes and Computer Use, see [macOS sandboxes](./sandboxes.md#macos-sandboxes).
> **Note: Custom snapshots**
> Default snapshots include the packages required for Computer Use. Sandboxes created from custom images or custom snapshots, including custom [Linux VM snapshots](./snapshots.md#vm-snapshots), need the [VNC and desktop packages](./vnc-access.md#required-packages) installed in the image.

## Start Computer Use

Start all computer use processes (Xvfb, xfce4, x11vnc, novnc) in the Sandbox.

```python
result = sandbox.computer_use.start()
print("Computer use processes started:", result.message)
```

## Stop Computer Use

Stop all computer use processes in the Sandbox.

```python
result = sandbox.computer_use.stop()
print("Computer use processes stopped:", result.message)
```

## Get status

Get the status of all computer use processes.

```python
response = sandbox.computer_use.get_status()
print("Computer use status:", response.status)
```

## Get process status

Get the status of a specific VNC process.

```python
xvfb_status = sandbox.computer_use.get_process_status("xvfb")
novnc_status = sandbox.computer_use.get_process_status("novnc")
```

## Restart process

Restart a specific VNC process.

```python
result = sandbox.computer_use.restart_process("xfce4")
print("XFCE4 process restarted:", result.message)
```

## Get process logs

Get logs for a specific VNC process.

```python
logs = sandbox.computer_use.get_process_logs("novnc")
print("NoVNC logs:", logs)
```

## Get process errors

Get error logs for a specific VNC process.

```python
errors = sandbox.computer_use.get_process_errors("x11vnc")
print("X11VNC errors:", errors)
```

## Mouse operations

### Click

Click the mouse at the specified coordinates. `button` is one of `left`, `right`, or `middle` (case-insensitive; defaults to `left`); other values return an error.

```python
# Single left click
result = sandbox.computer_use.mouse.click(100, 200)

# Double click
double_click = sandbox.computer_use.mouse.click(100, 200, "left", True)

# Right click
right_click = sandbox.computer_use.mouse.click(100, 200, "right")
```

### Move

Move the mouse cursor to the specified coordinates.

```python
result = sandbox.computer_use.mouse.move(100, 200)
print(f"Mouse moved to: {result.x}, {result.y}")
```

### Drag

Drag the mouse from start coordinates to end coordinates.

```python
result = sandbox.computer_use.mouse.drag(50, 50, 150, 150)
print(f"Drag ended at {result.x}, {result.y}")
```

### Hold and release button

Press and hold a mouse button, then release it. The button stays held until a matching release call, which lets you compose press-move-release gestures such as marquee selection or drawing strokes. When X and Y coordinates are provided, the cursor moves to that position before the button is pressed or released; when omitted, the action happens at the current cursor position. Button is one of left (default), right, or middle.

To hold a modifier key during the gesture, wrap it with the keyboard [hold and release](#hold-and-release-key) calls.

```python
# Press the left button at (100, 200) and release it at (300, 400)
sandbox.computer_use.mouse.down(100, 200)
result = sandbox.computer_use.mouse.up(300, 400)
print(f"Released at {result.x}, {result.y}")

# Press and release the right button at the current cursor position
sandbox.computer_use.mouse.down(button="right")
sandbox.computer_use.mouse.up(button="right")
```

### Scroll

Scroll the mouse wheel at the specified coordinates. `direction` is `up` or `down` (other values return an error). `amount` is the number of scroll wheel ticks to send — one tick is roughly one notch of a physical mouse wheel, which moves a few lines in most apps. Defaults to 1 if omitted.

```python
# Scroll up
scroll_up = sandbox.computer_use.mouse.scroll(100, 200, "up", 3)

# Scroll down
scroll_down = sandbox.computer_use.mouse.scroll(100, 200, "down", 5)
```

### Get position

Get the current mouse cursor position.

```python
position = sandbox.computer_use.mouse.get_position()
print(f"Mouse is at: {position.x}, {position.y}")
```

## Keyboard operations

### Type

Types arbitrary text, including uppercase letters, symbols, and non-ASCII characters. Newlines (`\n`, `\r`, `\r\n`) are translated into Enter key presses; literal tab and other control characters are rejected.

```python
sandbox.computer_use.keyboard.type("Hello, World!")

# With delay between characters
sandbox.computer_use.keyboard.type("Slow typing", 100)
```

### Press

Press a key with optional modifiers.

```python
# Press Enter
sandbox.computer_use.keyboard.press("enter")

# Press Ctrl+C
sandbox.computer_use.keyboard.press("c", ["ctrl"])

# Press Ctrl+Shift+T
sandbox.computer_use.keyboard.press("t", ["ctrl", "shift"])
```

### Hotkey

Press a hotkey combination.

```python
# Copy
sandbox.computer_use.keyboard.hotkey("ctrl+c")

# Paste
sandbox.computer_use.keyboard.hotkey("ctrl+v")

# Alt+Tab
sandbox.computer_use.keyboard.hotkey("alt+tab")
```

### Hold and release key

Press and hold a key, then release it. The key stays held until a matching release call, which lets you hold a modifier such as shift across several mouse or keyboard actions. Keys use the same names as [press](#press), listed in [supported keys](#supported-keys). Release the key in a finally block (or the language equivalent) so a failed action does not leave the key held.

```python
# Hold Shift while clicking two points, then release it
sandbox.computer_use.keyboard.down("shift")
try:
    sandbox.computer_use.mouse.click(100, 200)
    sandbox.computer_use.mouse.click(100, 300)
finally:
    sandbox.computer_use.keyboard.up("shift")
```

### Supported keys

`keyboard.press()`, `keyboard.hotkey()`, `keyboard.down()`, and `keyboard.up()` are case-insensitive for named keys. The following are supported:

| Category           | Keys                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Modifiers          | `ctrl`, `alt`, `shift`, `cmd`                                                                                                   |
| Editing            | `enter`, `escape`, `tab`, `backspace`, `delete`, `space`                                                                        |
| Navigation         | `home`, `end`, `pageup`, `pagedown`, `insert`, arrow keys (`up`, `down`, `left`, `right`)                                       |
| Function keys      | `f1` through `f24`                                                                                                              |
| Numpad             | `num0`–`num9`, `num_plus`, `num_minus`, `num_asterisk`, `num_slash`, `num_decimal`, `num_enter`, `num_equal`, `num_lock`        |
| Letters and digits | `a`–`z` (case-insensitive), `0`–`9`                                                                                             |
| Punctuation        | `` ` `` `-` `=` `[` `]` `\` `;` `'` `,` `.` `/`                                                                                 |
| Other              | `capslock`, `menu`                                                                                                              |

Common aliases like `Return` → `enter`, `control` → `ctrl`, `command` / `meta` / `win` → `cmd`, and `option` → `alt` are normalized automatically. Unsupported or malformed inputs return an error, sometimes with a suggested alternative.

## Accessibility operations

Use Linux accessibility operations to inspect the AT-SPI tree and interact with UI elements by node ID. Start Computer Use before calling accessibility methods.
> **Note: App accessibility support**
> Accessibility operations read the semantic UI information that applications expose over AT-SPI. Apps or custom widgets that do not expose accessibility objects may return sparse nodes, generic roles, or no actionable nodes; mouse, keyboard, and screenshot operations remain available for those cases.

### Get tree

Read an accessibility tree for the focused app, a specific process, or all apps.

```python
# Focused app
focused_tree = sandbox.computer_use.accessibility.get_tree(scope="focused", max_depth=2)

# Specific process
process_tree = sandbox.computer_use.accessibility.get_tree(
    scope="pid",
    pid=1234,
    max_depth=2,
)

# All apps
desktop_tree = sandbox.computer_use.accessibility.get_tree(scope="all", max_depth=2)
```

### Find nodes

Search the accessibility tree by role, accessible name, state, and scope.

```python
# Find buttons by accessible name
buttons = sandbox.computer_use.accessibility.find_nodes(
    scope="focused",
    role="button",
    name="Submit",
    name_match="substring",
    limit=10,
)

# Find text entries in a process
entries = sandbox.computer_use.accessibility.find_nodes(
    scope="pid",
    pid=1234,
    role="entry",
    states=["enabled", "focusable"],
    limit=10,
)

# Find visible nodes across all apps
visible_nodes = sandbox.computer_use.accessibility.find_nodes(
    scope="all",
    states=["visible"],
    limit=20,
)
```

### Focus node

Move keyboard focus to a node returned by `get_tree` or `find_nodes`.

```python
sandbox.computer_use.accessibility.focus_node("node-id")
```

### Invoke node

Run a node action, such as pressing a button.

```python
# Invoke the primary action
sandbox.computer_use.accessibility.invoke_node("node-id")

# Invoke a named action
sandbox.computer_use.accessibility.invoke_node("node-id", action="click")
```

### Set node value

Write text or value content to nodes that support value changes.

```python
sandbox.computer_use.accessibility.set_node_value("node-id", "hello")
```

## Screenshot operations

### Take full screen

Take a screenshot of the entire screen.

```python
screenshot = sandbox.computer_use.screenshot.take_full_screen()
print(f"Screenshot captured, base64 length: {len(screenshot.screenshot)}")

# With cursor visible
with_cursor = sandbox.computer_use.screenshot.take_full_screen(True)
```

### Take region

Take a screenshot of a specific region.

```python
from daytona import ScreenshotRegion

region = ScreenshotRegion(x=100, y=100, width=300, height=200)
screenshot = sandbox.computer_use.screenshot.take_region(region)
print(f"Captured {region.width}x{region.height} region, base64 length: {len(screenshot.screenshot)}")
```

### Take compressed

Take a compressed screenshot of the entire screen.

```python
from daytona import ScreenshotOptions

# Default compression
screenshot = sandbox.computer_use.screenshot.take_compressed()

# High quality JPEG
jpeg = sandbox.computer_use.screenshot.take_compressed(
    ScreenshotOptions(fmt="jpeg", quality=95, show_cursor=True)
)

# Scaled down PNG
scaled = sandbox.computer_use.screenshot.take_compressed(
    ScreenshotOptions(fmt="png", scale=0.5)
)
```

### Take compressed region

Take a compressed screenshot of a specific region.

```python
from daytona import ScreenshotRegion, ScreenshotOptions

region = ScreenshotRegion(x=0, y=0, width=800, height=600)
screenshot = sandbox.computer_use.screenshot.take_compressed_region(
    region,
    ScreenshotOptions(fmt="jpeg", quality=80, show_cursor=True)
)
print(f"Compressed size: {screenshot.size_bytes} bytes")
```

## Screen Recording

Computer Use supports screen recording capabilities, allowing you to capture desktop sessions for debugging, documentation, or automation workflows.

### Configure Recording Directory

By default, recordings are saved to `~/.daytona/recordings`. You can specify a custom directory by passing the `DAYTONA_RECORDINGS_DIR` environment variable when creating a sandbox:

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        snapshot="daytonaio/sandbox:0.6.0",
        name="my-sandbox",
        env_vars={"DAYTONA_RECORDINGS_DIR": "/home/daytona/my-recordings"}
    )
)
```

### Start Recording

Start a new screen recording session with an optional label:

```python
# Start recording with a custom label
recording = sandbox.computer_use.recording.start("test-1")
print(f"Recording started: {recording.id}")
print(f"File path: {recording.file_path}")
```

### Stop Recording

Stop an active recording session by providing the recording ID:

```python
# Stop the recording
stopped_recording = sandbox.computer_use.recording.stop(recording.id)
print(f"Recording stopped: {stopped_recording.duration_seconds} seconds")
print(f"Saved to: {stopped_recording.file_path}")
```

### List Recordings

Get a list of all recordings in the sandbox:

```python
recordings_list = sandbox.computer_use.recording.list()
print(f"Total recordings: {len(recordings_list.recordings)}")
for rec in recordings_list.recordings:
    print(f"- {rec.file_name}: {rec.duration_seconds}s ({rec.size_bytes} bytes)")
```

### Get Recording

Get details about a specific recording:

```python
recording_detail = sandbox.computer_use.recording.get("recording-id")
print(f"Recording: {recording_detail.file_name}")
print(f"Status: {recording_detail.status}")
print(f"Duration: {recording_detail.duration_seconds}s")
```

### Delete Recording

Delete a recording by ID:

```python
sandbox.computer_use.recording.delete("recording-id")
print("Recording deleted successfully")
```

### Download Recording

Download a recording file from the sandbox to your local machine. The file is streamed efficiently without loading the entire content into memory, making it suitable for large recordings.

```python
# Download recording to local file
sandbox.computer_use.recording.download(recording.id, "local_recording.mp4")
print("Recording downloaded successfully")

# Or with custom path
import os
download_path = os.path.join("recordings", f"recording_{recording.id}.mp4")
sandbox.computer_use.recording.download(recording.id, download_path)
```
> **Tip: Streaming Downloads**
> All SDK implementations stream the recording file directly to disk without loading the entire content into memory. This allows you to download large recordings (hundreds of MB or even GB) efficiently without running out of memory.
>
> - **Python**: Streams in 64KB chunks using `httpx`
> - **TypeScript**: Uses Node.js `pipeline()` with backpressure handling
> - **Ruby**: Uses Typhoeus streaming with `on_body` callbacks
> - **Go**: Uses `io.Copy()` with 32KB internal buffer
> - **Java**: The OpenAPI client streams the response body into a temporary file via OkHttp

### Recording Dashboard

Every sandbox includes a built-in recording dashboard for managing screen recordings through a web interface. The dashboard allows you to view, download, and delete recordings without writing code.

To access the recording dashboard:

1. Navigate to your sandboxes in the Daytona Dashboard
2. Click the action menu (three dots) for your sandbox
3. Select <Button>Screen Recordings</Button> from the dropdown menu

The recording dashboard provides:
- List of all recordings with metadata (name, duration, file size, creation time)
- Playback controls for reviewing recordings
- Download functionality to save recordings locally
- Delete options for managing storage
> **Tip:**
> The recording dashboard runs on a private port and is automatically secured. No additional authentication is required once you access it through the Daytona Dashboard.

## Display operations

### Configure desktop resolution

By default, the virtual desktop runs at **1024x768**. Choose a different resolution by passing the `VNC_RESOLUTION` environment variable when creating a sandbox. Use the `<width>x<height>` format; widths from 640 to 7680 pixels and heights from 480 to 4320 pixels are supported.

```python
from daytona import Daytona, CreateSandboxFromSnapshotParams

daytona = Daytona()
sandbox = daytona.create(
    CreateSandboxFromSnapshotParams(
        env_vars={"VNC_RESOLUTION": "1920x1080"}
    )
)
```

You can also bake a resolution into a snapshot image with `ENV VNC_RESOLUTION=1920x1080` in its Dockerfile. A value passed at creation takes precedence over the image's `ENV`, which takes precedence over the `1024x768` default. Invalid values fall back to the default.

The virtual display's framebuffer is allocated when the X server starts, so the resolution can only be set when creating the sandbox. Restarting display processes or stopping and starting the sandbox keeps the original geometry; create a new sandbox to use a different resolution.

Pick the resolution to match what your agent assumes. Agents that emit normalized coordinates scale them by an assumed screen size, so a desktop that differs from that assumption displaces every click. Verify the live geometry with [Get info](#get-info) below.
> **Note:**
> `VNC_RESOLUTION` applies to Linux container sandboxes (the default sandbox class). Linux VM and Windows sandboxes currently run at a fixed resolution. Creating a sandbox with custom environment variables also bypasses pre-warmed sandbox pools, so allocation can take slightly longer.

### Get info

Get information about the displays.

```python
info = sandbox.computer_use.display.get_info()
displays = info.displays or []
print(f"Total displays: {len(displays)}")
for i, display in enumerate(displays):
    print(f"Display {i}: {display.width}x{display.height} at {display.x},{display.y}")
```

### Get windows

Get the list of open windows.

```python
windows = sandbox.computer_use.display.get_windows()
window_list = windows.windows or []
print(f"Found {len(window_list)} open windows:")
for window in window_list:
    print(f"- {window.title} (ID: {window.id})")
```
