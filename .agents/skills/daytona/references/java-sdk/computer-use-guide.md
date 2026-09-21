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
- See Also




Computer Use enables programmatic control of desktop environments within sandboxes. It provides mouse, keyboard, screenshot, screen recording, and display operations for automating GUI interactions and testing desktop applications.

Computer Use and [VNC](./vnc-access.md) work together to enable both manual and automated desktop interactions. VNC provides the visual interface for users to manually interact with the desktop, while Computer Use provides the programmatic API for AI agents to automate operations.

Computer Use is available for **Linux** and **Windows** through Daytona. For **macOS** sandboxes and Computer Use, use [use.computer ↗](https://use.computer).
> **Note: macOS sandboxes**
> macOS sandboxes are available at [use.computer ↗](https://use.computer). See the [use.computer API documentation ↗](https://use.computer/docs) to create and control a macOS sandbox.

## Start Computer Use

Start all computer use processes (Xvfb, xfce4, x11vnc, novnc) in the Sandbox.

```java
var result = sandbox.computerUse.start();
System.out.println("Computer use processes started: " + result.getMessage());
```

## Stop Computer Use

Stop all computer use processes in the Sandbox.

```java
var result = sandbox.computerUse.stop();
System.out.println("Computer use processes stopped: " + result.getMessage());
```

## Get status

Get the status of all computer use processes.

```java
var response = sandbox.computerUse.getStatus();
System.out.println("Computer use status: " + response.getStatus());
```

## Get process status

Get the status of a specific VNC process.


## Restart process

Restart a specific VNC process.


## Get process logs

Get logs for a specific VNC process.


## Get process errors

Get error logs for a specific VNC process.


## Mouse operations

### Click

Click the mouse at the specified coordinates. `button` is one of `left`, `right`, or `middle` (case-insensitive; defaults to `left`); other values return an error.

```java
// Single left click
sandbox.computerUse.click(100, 200);

// Double click
sandbox.computerUse.doubleClick(100, 200);

// Right click
sandbox.computerUse.click(100, 200, "right");
```

### Move

Move the mouse cursor to the specified coordinates.

```java
var result = sandbox.computerUse.moveMouse(100, 200);
System.out.println("Mouse moved to: " + result.getX() + ", " + result.getY());
```

### Drag

Drag the mouse from start coordinates to end coordinates.

```java
var result = sandbox.computerUse.drag(50, 50, 150, 150);
System.out.println("Drag ended at: " + result.getX() + ", " + result.getY());
```

### Scroll

Scroll the mouse wheel at the specified coordinates. `direction` is `up` or `down` (other values return an error). `amount` is the number of scroll wheel ticks to send — one tick is roughly one notch of a physical mouse wheel, which moves a few lines in most apps. Defaults to 1 if omitted.

```java
// Scroll up (negative vertical delta maps to "up")
sandbox.computerUse.scroll(100, 200, 0, -3);

// Scroll down
sandbox.computerUse.scroll(100, 200, 0, 5);
```

### Get position

Get the current mouse cursor position.

```java
var position = sandbox.computerUse.getMousePosition();
System.out.println("Mouse is at: " + position.getX() + ", " + position.getY());
```

## Keyboard operations

### Type

Types arbitrary text, including uppercase letters, symbols, and non-ASCII characters. Newlines (`\n`, `\r`, `\r\n`) are translated into Enter key presses; literal tab and other control characters are rejected.

```java
sandbox.computerUse.typeText("Hello, World!");
```

### Press

Press a key with optional modifiers.

```java
// Press Enter
sandbox.computerUse.pressKey("enter");

// Press Ctrl+C
sandbox.computerUse.pressHotkey("ctrl", "c");

// Press Ctrl+Shift+T
sandbox.computerUse.pressHotkey("ctrl", "shift", "t");
```

### Hotkey

Press a hotkey combination.

```java
// Copy
sandbox.computerUse.pressHotkey("ctrl", "c");

// Paste
sandbox.computerUse.pressHotkey("ctrl", "v");

// Alt+Tab
sandbox.computerUse.pressHotkey("alt", "tab");
```

### Supported keys

`keyboard.press()` and `keyboard.hotkey()` are case-insensitive for named keys. The following are supported:

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

```java
// Focused app
var focusedTree = sandbox.computerUse.getAccessibilityTree("focused", null, 2);

// Specific process
var processTree = sandbox.computerUse.getAccessibilityTree("pid", 1234, 2);

// All apps
var desktopTree = sandbox.computerUse.getAccessibilityTree("all", null, 2);
```

### Find nodes

Search the accessibility tree by role, accessible name, state, and scope.

```java
// Find buttons by accessible name
var buttons = sandbox.computerUse.findAccessibilityNodes(
    new FindAccessibilityNodesRequest()
        .scope("focused")
        .role("button")
        .name("Submit")
        .nameMatch("substring")
        .limit(10)
);

// Find text entries in a process
var entries = sandbox.computerUse.findAccessibilityNodes(
    new FindAccessibilityNodesRequest()
        .scope("pid")
        .pid(1234)
        .role("entry")
        .states(java.util.List.of("enabled", "focusable"))
        .limit(10)
);

// Find visible nodes across all apps
var visibleNodes = sandbox.computerUse.findAccessibilityNodes(
    new FindAccessibilityNodesRequest()
        .scope("all")
        .states(java.util.List.of("visible"))
        .limit(20)
);
```

### Focus node

Move keyboard focus to a node returned by `get_tree` or `find_nodes`.

```java
sandbox.computerUse.focusAccessibilityNode("node-id");
```

### Invoke node

Run a node action, such as pressing a button.

```java
// Invoke the primary action
sandbox.computerUse.invokeAccessibilityNode("node-id");

// Invoke a named action
sandbox.computerUse.invokeAccessibilityNode("node-id", "click");
```

### Set node value

Write text or value content to nodes that support value changes.

```java
sandbox.computerUse.setAccessibilityNodeValue("node-id", "hello");
```

## Screenshot operations

### Take full screen

Take a screenshot of the entire screen.

```java
var screenshot = sandbox.computerUse.takeScreenshot();
Integer sizeBytes = screenshot.getSizeBytes();
System.out.println("Screenshot payload size: " + (sizeBytes != null ? sizeBytes + " bytes" : "n/a"));

// With cursor visible
var withCursor = sandbox.computerUse.takeScreenshot(true);
```

### Take region

Take a screenshot of a specific region.

```java
var screenshot = sandbox.computerUse.takeRegionScreenshot(100, 100, 300, 200);
Integer sizeBytes = screenshot.getSizeBytes();
System.out.println("Captured region, payload size: " + (sizeBytes != null ? sizeBytes + " bytes" : "n/a"));
```

### Take compressed

Take a compressed screenshot of the entire screen.

```java
// Compressed full screen (format, quality 1-100, scale factor)
var screenshot = sandbox.computerUse.takeCompressedScreenshot("png", 80, 1.0);

// High quality JPEG at full scale
var jpeg = sandbox.computerUse.takeCompressedScreenshot("jpeg", 95, 1.0);

// Scaled down PNG
var scaled = sandbox.computerUse.takeCompressedScreenshot("png", 80, 0.5);
```

### Take compressed region

Take a compressed screenshot of a specific region.


## Screen Recording

Computer Use supports screen recording capabilities, allowing you to capture desktop sessions for debugging, documentation, or automation workflows.

### Configure Recording Directory

By default, recordings are saved to `~/.daytona/recordings`. You can specify a custom directory by passing the `DAYTONA_RECORDINGS_DIR` environment variable when creating a sandbox:

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.model.CreateSandboxFromSnapshotParams;

import java.util.Map;

try (Daytona daytona = new Daytona()) {
    CreateSandboxFromSnapshotParams params = new CreateSandboxFromSnapshotParams();
    params.setSnapshot("daytonaio/sandbox:0.6.0");
    params.setName("my-sandbox");
    params.setEnvVars(Map.of("DAYTONA_RECORDINGS_DIR", "/home/daytona/my-recordings"));
    Sandbox sandbox = daytona.create(params);
}
```

### Start Recording

Start a new screen recording session with an optional name identifier:

```java
// Start recording with a custom label
var recording = sandbox.computerUse.startRecording("test-1");
System.out.println("Recording started: " + recording.getId());
System.out.println("File path: " + recording.getFilePath());
```

### Stop Recording

Stop an active recording session by providing the recording ID:

```java
// Stop the recording
var stoppedRecording = sandbox.computerUse.stopRecording(recording.getId());
System.out.println("Recording stopped: " + stoppedRecording.getDurationSeconds() + " seconds");
System.out.println("Saved to: " + stoppedRecording.getFilePath());
```

### List Recordings

Get a list of all recordings in the sandbox:

```java
var recordingsList = sandbox.computerUse.listRecordings();
System.out.println("Total recordings: " + recordingsList.getRecordings().size());
for (var rec : recordingsList.getRecordings()) {
    System.out.println(
        "- " + rec.getFileName() + ": " + rec.getDurationSeconds() + "s (" + rec.getSizeBytes() + " bytes)"
    );
}
```

### Get Recording

Get details about a specific recording:

```java
var recordingDetail = sandbox.computerUse.getRecording("recording-id");
System.out.println("Recording: " + recordingDetail.getFileName());
System.out.println("Status: " + recordingDetail.getStatus());
System.out.println("Duration: " + recordingDetail.getDurationSeconds() + "s");
```

### Delete Recording

Delete a recording by ID:

```java
sandbox.computerUse.deleteRecording("recording-id");
System.out.println("Recording deleted successfully");
```

### Download Recording

Download a recording file from the sandbox to your local machine. The file is streamed efficiently without loading the entire content into memory, making it suitable for large recordings.

```java
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

// Download returns a temp file from the API client; copy it to a stable path
var tempFile = sandbox.computerUse.downloadRecording(recording.getId());
Files.copy(tempFile.toPath(), Path.of("local_recording.mp4"), StandardCopyOption.REPLACE_EXISTING);
System.out.println("Recording saved to local_recording.mp4");

var downloadPath = Path.of("recordings", "recording_" + recording.getId() + ".mp4");
Files.createDirectories(downloadPath.getParent());
Files.copy(tempFile.toPath(), downloadPath, StandardCopyOption.REPLACE_EXISTING);
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

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.model.CreateSandboxFromSnapshotParams;

import java.util.Map;

try (Daytona daytona = new Daytona()) {
    CreateSandboxFromSnapshotParams params = new CreateSandboxFromSnapshotParams();
    params.setEnvVars(Map.of("VNC_RESOLUTION", "1920x1080"));
    Sandbox sandbox = daytona.create(params);
}
```

You can also bake a resolution into a snapshot image with `ENV VNC_RESOLUTION=1920x1080` in its Dockerfile. A value passed at creation takes precedence over the image's `ENV`, which takes precedence over the `1024x768` default. Invalid values fall back to the default.

The virtual display's framebuffer is allocated when the X server starts, so the resolution can only be set when creating the sandbox. Restarting display processes or stopping and starting the sandbox keeps the original geometry; create a new sandbox to use a different resolution.

Pick the resolution to match what your agent assumes. Agents that emit normalized coordinates scale them by an assumed screen size, so a desktop that differs from that assumption displaces every click. Verify the live geometry with [Get info](#get-info) below.
> **Note:**
> `VNC_RESOLUTION` applies to Linux container sandboxes (the default sandbox class). Linux VM and Windows sandboxes currently run at a fixed resolution. Creating a sandbox with custom environment variables also bypasses pre-warmed sandbox pools, so allocation can take slightly longer.

### Get info

Get information about the displays.

```java
var info = sandbox.computerUse.getDisplayInfo();
if (info.getDisplays() != null) {
    for (var display : info.getDisplays()) {
        System.out.println(
            "Display " + display.getId() + ": " + display.getWidth() + "x" + display.getHeight()
                + " at " + display.getX() + "," + display.getY()
        );
    }
}
```

### Get windows

Get the list of open windows.

```java
var windows = sandbox.computerUse.getWindows();
var list = windows.getWindows();
if (list != null) {
    System.out.println("Found " + list.size() + " open windows:");
    for (var window : list) {
        System.out.println("- " + window.getTitle() + " (ID: " + window.getId() + ")");
    }
}
```

## See Also
- [Python SDK - computer-use-guide](../python-sdk/computer-use-guide.md)
- [TypeScript SDK - computer-use-guide](../typescript-sdk/computer-use-guide.md)
