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

```go
err := sandbox.ComputerUse.Start(ctx)
if err != nil {
	log.Fatal(err)
}
defer sandbox.ComputerUse.Stop(ctx)

fmt.Println("Computer use processes started")
```

## Stop Computer Use

Stop all computer use processes in the Sandbox.

```go
err := sandbox.ComputerUse.Stop(ctx)
if err != nil {
	log.Fatal(err)
}

fmt.Println("Computer use processes stopped")
```

## Get status

Get the status of all computer use processes.

```go
status, err := sandbox.ComputerUse.GetStatus(ctx)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Computer use status: %v\n", status["status"])
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

```go
// Single left click
result, err := sandbox.ComputerUse.Mouse().Click(ctx, 100, 200, nil, nil)
if err != nil {
	log.Fatal(err)
}

// Double click
doubleClick := true
result, err = sandbox.ComputerUse.Mouse().Click(ctx, 100, 200, nil, &doubleClick)

// Right click
rightButton := "right"
result, err = sandbox.ComputerUse.Mouse().Click(ctx, 100, 200, &rightButton, nil)
```

### Move

Move the mouse cursor to the specified coordinates.

```go
result, err := sandbox.ComputerUse.Mouse().Move(ctx, 100, 200)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Mouse moved to: %v, %v\n", result["x"], result["y"])
```

### Drag

Drag the mouse from start coordinates to end coordinates.

```go
result, err := sandbox.ComputerUse.Mouse().Drag(ctx, 50, 50, 150, 150, nil)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Dragged to %v, %v\n", result["x"], result["y"])
```

### Scroll

Scroll the mouse wheel at the specified coordinates. `direction` is `up` or `down` (other values return an error). `amount` is the number of scroll wheel ticks to send — one tick is roughly one notch of a physical mouse wheel, which moves a few lines in most apps. Defaults to 1 if omitted.

```go
// Scroll up
amount := 3
success, err := sandbox.ComputerUse.Mouse().Scroll(ctx, 100, 200, "up", &amount)
if err != nil {
	log.Fatal(err)
}

// Scroll down
amount = 5
success, err = sandbox.ComputerUse.Mouse().Scroll(ctx, 100, 200, "down", &amount)
```

### Get position

Get the current mouse cursor position.

```go
position, err := sandbox.ComputerUse.Mouse().GetPosition(ctx)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Mouse is at: %v, %v\n", position["x"], position["y"])
```

## Keyboard operations

### Type

Types arbitrary text, including uppercase letters, symbols, and non-ASCII characters. Newlines (`\n`, `\r`, `\r\n`) are translated into Enter key presses; literal tab and other control characters are rejected.

```go
err := sandbox.ComputerUse.Keyboard().Type(ctx, "Hello, World!", nil)
if err != nil {
	log.Fatal(err)
}

// With delay between characters
delay := 100
err = sandbox.ComputerUse.Keyboard().Type(ctx, "Slow typing", &delay)
```

### Press

Press a key with optional modifiers.

```go
// Press Enter
err := sandbox.ComputerUse.Keyboard().Press(ctx, "enter", nil)
if err != nil {
	log.Fatal(err)
}

// Press Ctrl+C
err = sandbox.ComputerUse.Keyboard().Press(ctx, "c", []string{"ctrl"})

// Press Ctrl+Shift+T
err = sandbox.ComputerUse.Keyboard().Press(ctx, "t", []string{"ctrl", "shift"})
```

### Hotkey

Press a hotkey combination.

```go
// Copy
err := sandbox.ComputerUse.Keyboard().Hotkey(ctx, "ctrl+c")
if err != nil {
	log.Fatal(err)
}

// Paste
err = sandbox.ComputerUse.Keyboard().Hotkey(ctx, "ctrl+v")

// Alt+Tab
err = sandbox.ComputerUse.Keyboard().Hotkey(ctx, "alt+tab")
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

```go
maxDepth := 2

// Focused app
focusedScope := "focused"
focusedTree, err := sandbox.ComputerUse.Accessibility().GetTree(ctx, &daytona.AccessibilityTreeOptions{
	Scope:    &focusedScope,
	MaxDepth: &maxDepth,
})
if err != nil {
	log.Fatal(err)
}

// Specific process
processScope := "pid"
pid := 1234
processTree, err := sandbox.ComputerUse.Accessibility().GetTree(ctx, &daytona.AccessibilityTreeOptions{
	Scope:    &processScope,
	PID:      &pid,
	MaxDepth: &maxDepth,
})
if err != nil {
	log.Fatal(err)
}

// All apps
allScope := "all"
desktopTree, err := sandbox.ComputerUse.Accessibility().GetTree(ctx, &daytona.AccessibilityTreeOptions{
	Scope:    &allScope,
	MaxDepth: &maxDepth,
})
if err != nil {
	log.Fatal(err)
}
```

### Find nodes

Search the accessibility tree by role, accessible name, state, and scope.

```go
limit := 10

// Find buttons by accessible name
focusedScope := "focused"
buttonRole := "button"
submitName := "Submit"
substringMatch := "substring"
buttons, err := sandbox.ComputerUse.Accessibility().FindNodes(ctx, &daytona.AccessibilityFindOptions{
	Scope:     &focusedScope,
	Role:      &buttonRole,
	Name:      &submitName,
	NameMatch: &substringMatch,
	Limit:     &limit,
})
if err != nil {
	log.Fatal(err)
}

// Find text entries in a process
processScope := "pid"
pid := 1234
entryRole := "entry"
entries, err := sandbox.ComputerUse.Accessibility().FindNodes(ctx, &daytona.AccessibilityFindOptions{
	Scope:  &processScope,
	PID:    &pid,
	Role:   &entryRole,
	States: []string{"enabled", "focusable"},
	Limit:  &limit,
})
if err != nil {
	log.Fatal(err)
}

// Find visible nodes across all apps
allScope := "all"
visibleLimit := 20
visibleNodes, err := sandbox.ComputerUse.Accessibility().FindNodes(ctx, &daytona.AccessibilityFindOptions{
	Scope:  &allScope,
	States: []string{"visible"},
	Limit:  &visibleLimit,
})
if err != nil {
	log.Fatal(err)
}
```

### Focus node

Move keyboard focus to a node returned by `get_tree` or `find_nodes`.

```go
if err := sandbox.ComputerUse.Accessibility().FocusNode(ctx, "node-id"); err != nil {
	log.Fatal(err)
}
```

### Invoke node

Run a node action, such as pressing a button.

```go
// Invoke the primary action
if err := sandbox.ComputerUse.Accessibility().InvokeNode(ctx, "node-id", nil); err != nil {
	log.Fatal(err)
}

// Invoke a named action
action := "click"
if err := sandbox.ComputerUse.Accessibility().InvokeNode(ctx, "node-id", &action); err != nil {
	log.Fatal(err)
}
```

### Set node value

Write text or value content to nodes that support value changes.

```go
if err := sandbox.ComputerUse.Accessibility().SetNodeValue(ctx, "node-id", "hello"); err != nil {
	log.Fatal(err)
}
```

## Screenshot operations

### Take full screen

Take a screenshot of the entire screen.

```go
screenshot, err := sandbox.ComputerUse.Screenshot().TakeFullScreen(ctx, nil)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Screenshot captured, size: %d bytes\n", *screenshot.SizeBytes)

// With cursor visible
showCursor := true
withCursor, err := sandbox.ComputerUse.Screenshot().TakeFullScreen(ctx, &showCursor)
```

### Take region

Take a screenshot of a specific region.

```go
region := types.ScreenshotRegion{X: 100, Y: 100, Width: 300, Height: 200}
screenshot, err := sandbox.ComputerUse.Screenshot().TakeRegion(ctx, region, nil)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Captured region: %dx%d\n", screenshot.Width, screenshot.Height)
```

### Take compressed

Take a compressed screenshot of the entire screen.


### Take compressed region

Take a compressed screenshot of a specific region.


## Screen Recording

Computer Use supports screen recording capabilities, allowing you to capture desktop sessions for debugging, documentation, or automation workflows.

### Configure Recording Directory

By default, recordings are saved to `~/.daytona/recordings`. You can specify a custom directory by passing the `DAYTONA_RECORDINGS_DIR` environment variable when creating a sandbox:

```go
import (
	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

client, err := daytona.NewClient()
if err != nil {
	log.Fatal(err)
}

sandbox, err := client.Create(ctx, types.SnapshotParams{
	SandboxBaseParams: types.SandboxBaseParams{
		Name: "my-sandbox",
		EnvVars: map[string]string{
			"DAYTONA_RECORDINGS_DIR": "/home/daytona/my-recordings",
		},
	},
	Snapshot: "daytonaio/sandbox:0.6.0",
})
if err != nil {
	log.Fatal(err)
}
```

### Start Recording

Start a new screen recording session with an optional name identifier:

```go
// Start recording with a custom name
name := "test-1"
recording, err := sandbox.ComputerUse.Recording().Start(ctx, &name)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Recording started: %s\n", *recording.Id)
fmt.Printf("File path: %s\n", *recording.FilePath)
```

### Stop Recording

Stop an active recording session by providing the recording ID:

```go
// Stop the recording
stoppedRecording, err := sandbox.ComputerUse.Recording().Stop(ctx, *recording.Id)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Recording stopped: %f seconds\n", *stoppedRecording.DurationSeconds)
fmt.Printf("Saved to: %s\n", *stoppedRecording.FilePath)
```

### List Recordings

Get a list of all recordings in the sandbox:

```go
recordingsList, err := sandbox.ComputerUse.Recording().List(ctx)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Total recordings: %d\n", len(recordingsList.Recordings))
for _, rec := range recordingsList.Recordings {
	fmt.Printf("- %s: %.2fs (%d bytes)\n", *rec.Name, *rec.DurationSeconds, *rec.FileSizeBytes)
}
```

### Get Recording

Get details about a specific recording:

```go
recordingDetail, err := sandbox.ComputerUse.Recording().Get(ctx, "recording-id")
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Recording: %s\n", *recordingDetail.Name)
fmt.Printf("Status: %s\n", *recordingDetail.Status)
fmt.Printf("Duration: %.2fs\n", *recordingDetail.DurationSeconds)
```

### Delete Recording

Delete a recording by ID:

```go
err := sandbox.ComputerUse.Recording().Delete(ctx, "recording-id")
if err != nil {
	log.Fatal(err)
}

fmt.Println("Recording deleted successfully")
```

### Download Recording

Download a recording file from the sandbox to your local machine. The file is streamed efficiently without loading the entire content into memory, making it suitable for large recordings.

```go
// Download recording to local file
err := sandbox.ComputerUse.Recording().Download(ctx, recording.GetId(), "local_recording.mp4")
if err != nil {
	log.Fatal(err)
}
fmt.Println("Recording downloaded successfully")

// Or with custom path
downloadPath := fmt.Sprintf("recordings/recording_%s.mp4", recording.GetId())
err = sandbox.ComputerUse.Recording().Download(ctx, recording.GetId(), downloadPath)
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

```go
import (
	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

client, err := daytona.NewClient()
if err != nil {
	log.Fatal(err)
}

sandbox, err := client.Create(ctx, types.SnapshotParams{
	SandboxBaseParams: types.SandboxBaseParams{
		EnvVars: map[string]string{
			"VNC_RESOLUTION": "1920x1080",
		},
	},
})
if err != nil {
	log.Fatal(err)
}
```

You can also bake a resolution into a snapshot image with `ENV VNC_RESOLUTION=1920x1080` in its Dockerfile. A value passed at creation takes precedence over the image's `ENV`, which takes precedence over the `1024x768` default. Invalid values fall back to the default.

The virtual display's framebuffer is allocated when the X server starts, so the resolution can only be set when creating the sandbox. Restarting display processes or stopping and starting the sandbox keeps the original geometry; create a new sandbox to use a different resolution.

Pick the resolution to match what your agent assumes. Agents that emit normalized coordinates scale them by an assumed screen size, so a desktop that differs from that assumption displaces every click. Verify the live geometry with [Get info](#get-info) below.
> **Note:**
> `VNC_RESOLUTION` applies to Linux container sandboxes (the default sandbox class). Linux VM and Windows sandboxes currently run at a fixed resolution. Creating a sandbox with custom environment variables also bypasses pre-warmed sandbox pools, so allocation can take slightly longer.

### Get info

Get information about the displays.

```go
info, err := sandbox.ComputerUse.Display().GetInfo(ctx)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Displays: %v\n", info["displays"])
```

### Get windows

Get the list of open windows.

```go
result, err := sandbox.ComputerUse.Display().GetWindows(ctx)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Open windows: %v\n", result["windows"])
```

## See Also
- [Python SDK - computer-use-guide](../python-sdk/computer-use-guide.md)
- [TypeScript SDK - computer-use-guide](../typescript-sdk/computer-use-guide.md)
- [Java SDK - computer-use-guide](../java-sdk/computer-use-guide.md)
