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

```typescript
const result = await sandbox.computerUse.start();
console.log('Computer use processes started:', result.message);
```

## Stop Computer Use

Stop all computer use processes in the Sandbox.

```typescript
const result = await sandbox.computerUse.stop();
console.log('Computer use processes stopped:', result.message);
```

## Get status

Get the status of all computer use processes.

```typescript
const status = await sandbox.computerUse.getStatus();
console.log('Computer use status:', status.status);
```

## Get process status

Get the status of a specific VNC process.

```typescript
const xvfbStatus = await sandbox.computerUse.getProcessStatus('xvfb');
const noVncStatus = await sandbox.computerUse.getProcessStatus('novnc');
```

## Restart process

Restart a specific VNC process.

```typescript
const result = await sandbox.computerUse.restartProcess('xfce4');
console.log('XFCE4 process restarted:', result.message);
```

## Get process logs

Get logs for a specific VNC process.

```typescript
const logsResp = await sandbox.computerUse.getProcessLogs('novnc');
console.log('NoVNC logs:', logsResp.logs);
```

## Get process errors

Get error logs for a specific VNC process.

```typescript
const errorsResp = await sandbox.computerUse.getProcessErrors('x11vnc');
console.log('X11VNC errors:', errorsResp.errors);
```

## Mouse operations

### Click

Click the mouse at the specified coordinates. `button` is one of `left`, `right`, or `middle` (case-insensitive; defaults to `left`); other values return an error.

```typescript
// Single left click
const result = await sandbox.computerUse.mouse.click(100, 200);

// Double click
const doubleClick = await sandbox.computerUse.mouse.click(100, 200, 'left', true);

// Right click
const rightClick = await sandbox.computerUse.mouse.click(100, 200, 'right');
```

### Move

Move the mouse cursor to the specified coordinates.

```typescript
const result = await sandbox.computerUse.mouse.move(100, 200);
console.log(`Mouse moved to: ${result.x}, ${result.y}`);
```

### Drag

Drag the mouse from start coordinates to end coordinates.

```typescript
const result = await sandbox.computerUse.mouse.drag(50, 50, 150, 150);
console.log(`Drag ended at ${result.x}, ${result.y}`);
```

### Scroll

Scroll the mouse wheel at the specified coordinates. `direction` is `up` or `down` (other values return an error). `amount` is the number of scroll wheel ticks to send — one tick is roughly one notch of a physical mouse wheel, which moves a few lines in most apps. Defaults to 1 if omitted.

```typescript
// Scroll up
const scrollUp = await sandbox.computerUse.mouse.scroll(100, 200, 'up', 3);

// Scroll down
const scrollDown = await sandbox.computerUse.mouse.scroll(100, 200, 'down', 5);
```

### Get position

Get the current mouse cursor position.

```typescript
const position = await sandbox.computerUse.mouse.getPosition();
console.log(`Mouse is at: ${position.x}, ${position.y}`);
```

## Keyboard operations

### Type

Types arbitrary text, including uppercase letters, symbols, and non-ASCII characters. Newlines (`\n`, `\r`, `\r\n`) are translated into Enter key presses; literal tab and other control characters are rejected.

```typescript
await sandbox.computerUse.keyboard.type('Hello, World!');

// With delay between characters
await sandbox.computerUse.keyboard.type('Slow typing', 100);
```

### Press

Press a key with optional modifiers.

```typescript
// Press Enter
await sandbox.computerUse.keyboard.press('enter');

// Press Ctrl+C
await sandbox.computerUse.keyboard.press('c', ['ctrl']);

// Press Ctrl+Shift+T
await sandbox.computerUse.keyboard.press('t', ['ctrl', 'shift']);
```

### Hotkey

Press a hotkey combination.

```typescript
// Copy
await sandbox.computerUse.keyboard.hotkey('ctrl+c');

// Paste
await sandbox.computerUse.keyboard.hotkey('ctrl+v');

// Alt+Tab
await sandbox.computerUse.keyboard.hotkey('alt+tab');
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

```typescript
// Focused app
const focusedTree = await sandbox.computerUse.accessibility.getTree({
  scope: 'focused',
  maxDepth: 2,
});

// Specific process
const processTree = await sandbox.computerUse.accessibility.getTree({
  scope: 'pid',
  pid: 1234,
  maxDepth: 2,
});

// All apps
const desktopTree = await sandbox.computerUse.accessibility.getTree({
  scope: 'all',
  maxDepth: 2,
});
```

### Find nodes

Search the accessibility tree by role, accessible name, state, and scope.

```typescript
// Find buttons by accessible name
const buttons = await sandbox.computerUse.accessibility.findNodes({
  scope: 'focused',
  role: 'button',
  name: 'Submit',
  nameMatch: 'substring',
  limit: 10,
});

// Find text entries in a process
const entries = await sandbox.computerUse.accessibility.findNodes({
  scope: 'pid',
  pid: 1234,
  role: 'entry',
  states: ['enabled', 'focusable'],
  limit: 10,
});

// Find visible nodes across all apps
const visibleNodes = await sandbox.computerUse.accessibility.findNodes({
  scope: 'all',
  states: ['visible'],
  limit: 20,
});
```

### Focus node

Move keyboard focus to a node returned by `get_tree` or `find_nodes`.

```typescript
await sandbox.computerUse.accessibility.focusNode('node-id');
```

### Invoke node

Run a node action, such as pressing a button.

```typescript
// Invoke the primary action
await sandbox.computerUse.accessibility.invokeNode('node-id');

// Invoke a named action
await sandbox.computerUse.accessibility.invokeNode('node-id', 'click');
```

### Set node value

Write text or value content to nodes that support value changes.

```typescript
await sandbox.computerUse.accessibility.setNodeValue('node-id', 'hello');
```

## Screenshot operations

### Take full screen

Take a screenshot of the entire screen.

```typescript
const screenshot = await sandbox.computerUse.screenshot.takeFullScreen();
console.log(`Screenshot size: ${screenshot.width}x${screenshot.height}`);

// With cursor visible
const withCursor = await sandbox.computerUse.screenshot.takeFullScreen(true);
```

### Take region

Take a screenshot of a specific region.

```typescript
const region = { x: 100, y: 100, width: 300, height: 200 };
const screenshot = await sandbox.computerUse.screenshot.takeRegion(region);
console.log(`Captured region: ${screenshot.region.width}x${screenshot.region.height}`);
```

### Take compressed

Take a compressed screenshot of the entire screen.

```typescript
// Default compression
const screenshot = await sandbox.computerUse.screenshot.takeCompressed();

// High quality JPEG
const jpeg = await sandbox.computerUse.screenshot.takeCompressed({
  format: 'jpeg',
  quality: 95,
  showCursor: true
});

// Scaled down PNG
const scaled = await sandbox.computerUse.screenshot.takeCompressed({
  format: 'png',
  scale: 0.5
});
```

### Take compressed region

Take a compressed screenshot of a specific region.

```typescript
const region = { x: 0, y: 0, width: 800, height: 600 };
const screenshot = await sandbox.computerUse.screenshot.takeCompressedRegion(region, {
  format: 'jpeg',
  quality: 80,
  showCursor: true
});
console.log(`Compressed size: ${screenshot.size_bytes} bytes`);
```

## Screen Recording

Computer Use supports screen recording capabilities, allowing you to capture desktop sessions for debugging, documentation, or automation workflows.

### Configure Recording Directory

By default, recordings are saved to `~/.daytona/recordings`. You can specify a custom directory by passing the `DAYTONA_RECORDINGS_DIR` environment variable when creating a sandbox:

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.create({
  snapshot: 'daytonaio/sandbox:0.6.0',
  name: 'my-sandbox',
  envVars: { DAYTONA_RECORDINGS_DIR: '/home/daytona/my-recordings' }
});
```

### Start Recording

Start a new screen recording session with an optional name identifier:

```typescript
// Start recording with a custom name
const recording = await sandbox.computerUse.recording.start('test-1');
console.log(`Recording started: ${recording.id}`);
console.log(`File path: ${recording.file_path}`);
```

### Stop Recording

Stop an active recording session by providing the recording ID:

```typescript
// Stop the recording
const stoppedRecording = await sandbox.computerUse.recording.stop(recording.id);
console.log(`Recording stopped: ${stoppedRecording.duration_seconds} seconds`);
console.log(`Saved to: ${stoppedRecording.file_path}`);
```

### List Recordings

Get a list of all recordings in the sandbox:

```typescript
const recordingsList = await sandbox.computerUse.recording.list();
console.log(`Total recordings: ${recordingsList.recordings.length}`);
recordingsList.recordings.forEach(rec => {
  console.log(`- ${rec.name}: ${rec.duration_seconds}s (${rec.file_size_bytes} bytes)`);
});
```

### Get Recording

Get details about a specific recording:

```typescript
const recordingDetail = await sandbox.computerUse.recording.get('recording-id');
console.log(`Recording: ${recordingDetail.name}`);
console.log(`Status: ${recordingDetail.status}`);
console.log(`Duration: ${recordingDetail.duration_seconds}s`);
```

### Delete Recording

Delete a recording by ID:

```typescript
await sandbox.computerUse.recording.delete('recording-id');
console.log('Recording deleted successfully');
```

### Download Recording

Download a recording file from the sandbox to your local machine. The file is streamed efficiently without loading the entire content into memory, making it suitable for large recordings.

```typescript
// Download recording to local file
await sandbox.computerUse.recording.download(recording.id, 'local_recording.mp4');
console.log('Recording downloaded successfully');

// Or with custom path
const downloadPath = `recordings/recording_${recording.id}.mp4`;
await sandbox.computerUse.recording.download(recording.id, downloadPath);
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

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.create({
  envVars: { VNC_RESOLUTION: '1920x1080' }
});
```

You can also bake a resolution into a snapshot image with `ENV VNC_RESOLUTION=1920x1080` in its Dockerfile. A value passed at creation takes precedence over the image's `ENV`, which takes precedence over the `1024x768` default. Invalid values fall back to the default.

The virtual display's framebuffer is allocated when the X server starts, so the resolution can only be set when creating the sandbox. Restarting display processes or stopping and starting the sandbox keeps the original geometry; create a new sandbox to use a different resolution.

Pick the resolution to match what your agent assumes. Agents that emit normalized coordinates scale them by an assumed screen size, so a desktop that differs from that assumption displaces every click. Verify the live geometry with [Get info](#get-info) below.
> **Note:**
> `VNC_RESOLUTION` applies to Linux container sandboxes (the default sandbox class). Linux VM and Windows sandboxes currently run at a fixed resolution. Creating a sandbox with custom environment variables also bypasses pre-warmed sandbox pools, so allocation can take slightly longer.

### Get info

Get information about the displays.

```typescript
const info = await sandbox.computerUse.display.getInfo();
console.log(`Primary display: ${info.primary_display.width}x${info.primary_display.height}`);
console.log(`Total displays: ${info.total_displays}`);
info.displays.forEach((display, index) => {
  console.log(`Display ${index}: ${display.width}x${display.height} at ${display.x},${display.y}`);
});
```

### Get windows

Get the list of open windows.

```typescript
const windows = await sandbox.computerUse.display.getWindows();
console.log(`Found ${windows.count} open windows:`);
windows.windows.forEach(window => {
  console.log(`- ${window.title} (ID: ${window.id})`);
});
```

## See Also
- [Python SDK - computer-use-guide](../python-sdk/computer-use-guide.md)
