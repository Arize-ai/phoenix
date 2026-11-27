# Computer Use (Python SDK)

Programmatic control of desktop environments within Daytona sandboxes.

Computer use is the control of a graphical desktop in a sandbox by an AI agent or a program, through screenshots and mouse and keyboard input, as a person at the desktop works. The desktop runs inside the sandbox, so an agent operates desktop applications and websites that have no API, isolated from the computers and accounts of its users.

Daytona ships the desktop with the sandbox runtime, so it works on any Linux image. The desktop is a virtual display that exists from a start to a stop. Application windows live in it and do not survive a restart, and a sandbox reboot resets the desktop to not started.

Use Computer Use to build agents that operate desktop applications, or to test the interface of a GUI application. The same API drives Windows and macOS sandboxes. Computer Use is the programmatic API for AI agents, and [VNC](./vnc-access.md) is the visual interface where a person watches or takes over the same desktop while an agent works.

## Contents

- [Use cases](#use-cases)
- [Start Computer Use](#start-computer-use)
- [Stop Computer Use](#stop-computer-use)
- [Restart Computer Use](#restart-computer-use)
- [Get status](#get-status)
- [Get process status](#get-process-status)
- [Get all process statuses](#get-all-process-statuses)
- [Restart process](#restart-process)
- [Get process logs](#get-process-logs)
- [Get process errors](#get-process-errors)
- [Mouse operations](#mouse-operations)
- [Keyboard operations](#keyboard-operations)
- [Accessibility operations](#accessibility-operations)
- [Screenshot operations](#screenshot-operations)
- [Screen recording](#screen-recording)
- [Display operations](#display-operations)
- [Permissions](#permissions)

## Use cases

Computer Use is used when a task needs a graphical desktop instead of an API or a shell.

- **Computer-use agents.** An agent reads screenshots and the accessibility tree, then moves the mouse and types to operate desktop applications. The desktop stack ships with the sandbox runtime, so it works on any Linux sandbox image. All Computer Use calls go through the toolbox API and require an API key with the sandbox write permission or a sandbox access token with the desktop or toolbox operation.

- **Desktop application tests.** GUI tests click, type, and take screenshots to check the state of an application. Full-screen and region screenshots return a PNG image as a base64 string. The virtual display runs at 1280x720 unless start sets another resolution.

- **Browser automation.** A browser on the sandbox desktop is driven through mouse and keyboard input, for sites that have no API. Typing sends any text, including symbols and non-ASCII characters. A delay between characters slows typing for applications that drop fast input.

- **Agents on Windows and macOS.** Windows and macOS sandboxes provide screenshots, mouse and keyboard input, the accessibility tree, and screen recordings through the same API. On Windows, a desktop session must be open. When that session ends or another session replaces it, the desktop fails with a cause that names the reason.

- **Human in the loop.** A person watches or takes over the same desktop through VNC while an agent works. Starting Computer Use also starts the x11vnc server. The VNC server runs in shared mode, so several viewers attach to the same desktop at once.

## Start Computer Use

Start Computer Use to bring up a desktop that a program can see and control. A desktop on a server without a monitor runs on a virtual display server, which draws windows in memory instead of on a screen, with a window manager that places the windows.

The desktop of a sandbox is a group of processes that an add-on inside the sandbox starts and supervises. A start also brings up a VNC server on the display of the desktop, so that a person can watch the desktop while a program controls it.

Start Computer Use before any input, accessibility, screenshot, display, or recording start call. A start launches D-Bus, Xvfb, the window manager, and x11vnc, and marks the desktop failed if the X server or the VNC server does not accept connections within 5 s. A start returns the status of each process, and one made during another start or a restart waits for that to finish. A start on a failed desktop returns an error, so call [restart](#restart-computer-use) to recover it.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

result = sandbox.computer_use.start()
print("Computer use processes started:", result.message)
for name, process in result.status.items():
    print(f"{name}: running={process.running} pid={process.pid}")
```

| **Parameter** | **Description** |
| --- | --- |
| `resolution` | Sets the desktop resolution of a Linux sandbox in pixels.<br />**Default:** the resolution of the last start, or 1280x720<br />**Value:** 1024x768, 1280x720, or 1920x1080<br />**Example:** `ComputerUseResolution(width=1920, height=1080)` |

## Stop Computer Use

Stop Computer Use to shut the desktop down and end the processes that run it. When the display server of a desktop exits, the windows on it are lost.

A stop returns a ready desktop of a sandbox to not started, the state in which no desktop exists. A failed desktop stays failed after a stop and keeps the cause of its failure.

Stop Computer Use when no program needs the desktop any longer. A stop ends all computer use processes in the sandbox. On a failed desktop, a stop kills any remaining processes, and only [restart](#restart-computer-use) takes the desktop out of the failed state.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

result = sandbox.computer_use.stop()
print("Computer use processes stopped:", result.message)
```

## Restart Computer Use

Restart Computer Use to replace a desktop with a new one. A restart tears the desktop down and builds a new one, which recovers a desktop that no longer works.

A restart of a sandbox desktop is valid from every state and is the only way out of the failed state. Application windows on the desktop do not survive a restart.

Restart Computer Use when [get status](#get-status) reports a failed desktop. Concurrent restart calls join the same in-flight restart and receive the same result.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

result = sandbox.computer_use.restart()
print(result.message, result.desktop)  # computer use restarted ready
```

| **Parameter** | **Description** |
| --- | --- |
| `resolution` | Sets the desktop resolution of a Linux sandbox in pixels.<br />**Default:** the current resolution<br />**Value:** 1024x768, 1280x720, or 1920x1080<br />**Example:** `ComputerUseResolution(width=1920, height=1080)` |

## Get status

Get the status of the desktop to learn whether it accepts actions. A desktop moves through states as it starts, runs, and fails, and a program that controls it checks the state before it acts.

The status of a sandbox desktop reports its state and, for a failed desktop, the cause. The failure evidence lasts for one boot, and a sandbox reboot resets the desktop to not started.

Get the status before the first action, while a start is in progress, and after an error. The status field is active only while the desktop field is ready, and the cause object is present only when the desktop is failed. The SDKs map an unrecognized state or cause code to unknown and keep its raw value in a separate field, as the last table lists.

| **`desktop`**     | **`status`** | **Meaning**                                                                                               |
| ----------------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| `not_started` | `inactive`   | No desktop exists. Call [start](#start-computer-use).                                                     |
| `starting`    | `inactive`   | Start is in progress. Poll status.                                                                        |
| `ready`       | `active`     | Actions are accepted.                                                                                     |
| `failed`      | `inactive`   | The desktop is gone. `cause.code` and `cause.message` explain why. Call [restart](#restart-computer-use). |

| **Code**                      | **Meaning**                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| **`desktop_exited`**          | The X server (`xvfb`) exited. Windows in it are lost.                                         |
| **`addon_crashed`**           | The add-on that supervises the desktop died while the desktop was ready.                      |
| **`start_failed`**            | Creating the desktop or probing its readiness failed, for example a missing binary.           |
| **`start_interrupted`**       | The add-on died while the desktop was being created.                                          |
| **`state_corrupt`**           | Retained desktop state could not be read or validated.                                        |
| **`state_persistence_failed`** | A state transition could not be persisted.                                                    |
| **`session_ended`**           | Windows and macOS only. The interactive desktop session ended or left the console.            |
| **`session_replaced`**        | Windows only. Another interactive desktop session replaced the one the desktop was bound to.  |

| **Python**       | **TypeScript**  | **Description**                      |
| ---------------- | --------------- | ------------------------------------ |
| `raw_status`     | `rawStatus`     | The status value the API returned.   |
| `raw_desktop`    | `rawDesktop`    | The desktop value the API returned.  |
| `cause.raw_code` | `cause.rawCode` | The cause code the API returned.     |

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

status = sandbox.computer_use.status()
print("Computer use status:", status.status, status.desktop)
if status.desktop == "failed":
    print(f"Failure: {status.cause.code}: {status.cause.message}")
```

## Get process status

Get the status of a desktop process to check whether it runs. A desktop is made of several processes, and one of them can fail while the others keep running.

The status of a process in a sandbox desktop comes from the supervisor inside the sandbox that starts and restarts it. The status is available while a desktop exists.

Get the status of one process to check a single part of the desktop, or [get all process statuses](#get-all-process-statuses) to check every part at once. The process is D-Bus, Xvfb, the window manager, or the x11vnc server. Without a name, the call returns the status of every process.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

xvfb_status = sandbox.computer_use.service.status("xvfb")
print(xvfb_status.process_name, xvfb_status.running)
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the desktop process.<br />**Required**<br />**Value:** `dbus`, `xvfb`, `wm`, or `x11vnc`<br />**Example:** `"xvfb"` |

> **Notes:**
>
> - **Prerequisites:** A desktop must exist.

## Get all process statuses

Get all process statuses to see the state of the whole desktop at once. One view of every process shows which part of a desktop stopped or failed.

The process statuses of a sandbox desktop exist only while a desktop exists. Each status reports whether its process is alive, and whether the supervisor still restarts it.

Get all process statuses after an error or a [process restart](#restart-process) to find the process that failed. The statuses come as a map keyed by process name, with one entry each for D-Bus, Xvfb, the window manager, and the x11vnc server while a desktop exists. The map is empty before the first start and after a stop, a failed start, or an add-on restart. Each entry reports whether the process is alive, its supervisor restart state, and its startup priority.

| **API field**          | **Description**                                                     |
| ---------------------- | ------------------------------------------------------------------- |
| **`Running`**          | Whether the process is alive.                                       |
| **`Pid`**              | Process ID while the process is running.                            |
| **`Status`**           | `running`, `stopped`, or `failed`.                      |
| **`Failed`**           | Whether the supervisor gave up on the process: `xvfb` after it exits, the other processes after their automatic restarts run out. A process restart or a desktop restart clears it. |
| **`AutoRestart`**      | Whether the supervisor restarts the process automatically.          |
| **`RestartAttempts`**  | Exits in a row within 30 s of starting. It reaches `6` when the supervisor marks the process failed. Resets after a run of 30 s or longer, a process restart, or a desktop start. |
| **`RestartBackoffMs`** | Current restart backoff in milliseconds. The SDKs return it in seconds, as `restart_backoff` in Python and `restartBackoffSeconds` in TypeScript. |
| **`Priority`**         | Relative startup priority within the desktop stack.                 |

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

for name, process in sandbox.computer_use.service.status().items():
    print(f"{name}: {process.status} pid={process.pid} restarts={process.restart_attempts}")
```

## Restart process

Restart a process to bring one part of a desktop back without tearing down the rest. A process supervisor restarts the programs it watches when they exit, and stops after a set number of fast failures so that a broken program does not restart forever.

A process of a sandbox desktop restarts on its own when it exits, except the display server, which holds the application windows. A process that the supervisor gives up on is marked failed.

Restart a single desktop process when its [status](#get-process-status) reports it failed. Xvfb cannot be restarted on its own, so [restart](#restart-computer-use) the desktop instead. A process that exits within 30 s of starting is restarted at most 5 times in a row, after waits of 1, 2, 4, 8, and 16 s. The sixth such exit marks it failed while the desktop stays ready, and a process or [desktop restart](#restart-computer-use) clears the failed state.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

result = sandbox.computer_use.service.restart("wm")
print(result.message, result.process_name)
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the desktop process.<br />**Required**<br />**Value:** `dbus`, `wm`, or `x11vnc`<br />**Example:** `"wm"` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

## Get process logs

Get process logs to read what a desktop process wrote while it ran. A log records the output of a program, and it can show the cause of a failure that a status does not.

The logs of a sandbox desktop are kept per process and accumulate across process and desktop restarts. They stay readable while a desktop exists, even after its display server exits.

Get the logs of a process when it fails or when a start does not bring the desktop up, and [get process errors](#get-process-errors) to read only its errors. Each log is checked every 5 s and whenever the process starts, and a log over 256 KiB is cut to its last 128 KiB.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

logs = sandbox.computer_use.service.logs("x11vnc")
print("x11vnc logs:", logs.logs)
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the desktop process.<br />**Required**<br />**Value:** `dbus`, `xvfb`, `wm`, or `x11vnc`<br />**Example:** `"x11vnc"` |

> **Notes:**
>
> - **Prerequisites:** A desktop must exist.

## Get process errors

Get process errors to read only the error output of a desktop process. Programs write errors to a stream separate from their normal output, so the errors of a program can be read on their own.

The error log of a process in a sandbox desktop stays readable only while a desktop exists, including after the display server of the desktop exits.

Read the error log of a specific desktop process first when it fails. Read its full [log](#get-process-logs) when the errors in the error log do not explain why the process failed.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

errors = sandbox.computer_use.service.errors("x11vnc")
print("x11vnc errors:", errors.errors)
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the desktop process.<br />**Required**<br />**Value:** `dbus`, `xvfb`, `wm`, or `x11vnc`<br />**Example:** `"x11vnc"` |

> **Notes:**
>
> - **Prerequisites:** A desktop must exist.

## Mouse operations

Mouse operations are pointer input that a program sends to a desktop in place of a physical mouse. Each operation names a point on the screen in pixels.

Mouse input in a sandbox goes to the virtual screen of its desktop, and it works only while the desktop of the sandbox is ready to accept actions.

Use mouse operations on elements that a [screenshot](#screenshot-operations) shows, and [accessibility operations](#accessibility-operations) when the application exposes them. Every mouse, keyboard, screenshot, display, accessibility, and recording start call requires a ready desktop, and otherwise fails. Coordinates are screen pixels in the range -32768 to 32767, and other values return 400.

### Click

Click to press and release a mouse button at a point on the screen. Applications treat a click as a command on the element under the pointer, and a double click as a separate command.

A click in a sandbox acts at the coordinates it names on the virtual screen of the desktop.

Click at the coordinates of an element that a [screenshot](#take-full-screen) shows or that the bounds of a [node](#find-nodes) report. Click with the left, right, or middle button, as a single or a double click.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

sandbox.computer_use.mouse.click(x=100, y=200)
```

| **Parameter** | **Description** |
| --- | --- |
| `x` | Sets the horizontal coordinate in screen pixels.<br />**Required**<br />**Minimum:** `-32768`<br />**Maximum:** `32767`<br />**Example:** `100` |
| `y` | Sets the vertical coordinate in screen pixels.<br />**Required**<br />**Minimum:** `-32768`<br />**Maximum:** `32767`<br />**Example:** `200` |
| `button` | Sets the mouse button.<br />**Default:** `left`<br />**Value:** `left`, `right`, or `middle`<br />**Example:** `"right"` |
| `double` | Makes the click a double click.<br />**Default:** `False` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Move

Move the pointer to place it over a point on the screen without pressing a button. Applications react to a pointer that rests over an element, for example by showing a tooltip.

A move in a sandbox changes the position of the pointer on the virtual screen of its desktop.

Move the mouse cursor to the given coordinates to hover over an element. The response holds the final position of the pointer on the screen, in screen pixels.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

result = sandbox.computer_use.mouse.move(x=100, y=200)
print(f"Mouse moved to: {result.x}, {result.y}")
```

| **Parameter** | **Description** |
| --- | --- |
| `x` | Sets the horizontal coordinate in screen pixels.<br />**Required**<br />**Minimum:** `-32768`<br />**Maximum:** `32767`<br />**Example:** `100` |
| `y` | Sets the vertical coordinate in screen pixels.<br />**Required**<br />**Minimum:** `-32768`<br />**Maximum:** `32767`<br />**Example:** `200` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Drag

Drag to press a mouse button at one point, move the pointer to another point, and release the button there. Applications use a drag to move items, select text, and resize windows.

A drag in a sandbox holds one button for the whole path, and the pointer passes through points between the start and the end instead of jumping to the end.

Drag the mouse from start to end coordinates to move an element or select a range. The pointer moves in 10 interpolated steps, so applications that ignore a teleporting drag still register it.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

result = sandbox.computer_use.mouse.drag(
    start_x=50, start_y=50, end_x=150, end_y=150, button="left"
)
print(f"Drag ended at {result.x}, {result.y}")
```

| **Parameter** | **Description** |
| --- | --- |
| `start_x` | Sets the horizontal start coordinate in screen pixels.<br />**Required**<br />**Minimum:** `-32768`<br />**Maximum:** `32767`<br />**Example:** `50` |
| `start_y` | Sets the vertical start coordinate in screen pixels.<br />**Required**<br />**Minimum:** `-32768`<br />**Maximum:** `32767`<br />**Example:** `50` |
| `end_x` | Sets the horizontal end coordinate in screen pixels.<br />**Required**<br />**Minimum:** `-32768`<br />**Maximum:** `32767`<br />**Example:** `150` |
| `end_y` | Sets the vertical end coordinate in screen pixels.<br />**Required**<br />**Minimum:** `-32768`<br />**Maximum:** `32767`<br />**Example:** `150` |
| `button` | Sets the mouse button to hold.<br />**Default:** `left`<br />**Value:** `left`, `right`, or `middle`<br />**Example:** `"right"` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Scroll

Scroll to turn the mouse wheel over a point on the screen. The application under the pointer decides how far one turn of the wheel moves its content.

A scroll in a sandbox turns the wheel by whole ticks, up or down.

Scroll to reach content outside the visible part of a window. Scroll up or down at the specified coordinates by a number of wheel ticks. One tick is one notch of a physical mouse wheel.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

result = sandbox.computer_use.mouse.scroll(x=100, y=200, direction="down")
print(result.success)
```

| **Parameter** | **Description** |
| --- | --- |
| `x` | Sets the horizontal coordinate in screen pixels.<br />**Required**<br />**Minimum:** `-32768`<br />**Maximum:** `32767`<br />**Example:** `100` |
| `y` | Sets the vertical coordinate in screen pixels.<br />**Required**<br />**Minimum:** `-32768`<br />**Maximum:** `32767`<br />**Example:** `200` |
| `direction` | Sets the scroll direction.<br />**Required**<br />**Value:** `up` or `down`<br />**Example:** `"down"` |
| `amount` | Sets the number of wheel ticks.<br />**Default:** `1`<br />**Minimum:** `0`<br />**Maximum:** `100` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Get position

Get the position of the pointer to learn where it is on the screen. A program that shares the desktop with a person cannot assume that the pointer is where the program left it.

The position in a sandbox is where the pointer is on the virtual screen.

Get the current mouse cursor position after a person works on the desktop through [VNC](./vnc-access.md), or to check where a move left the pointer on the screen.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

position = sandbox.computer_use.mouse.position()
print(f"Mouse is at: {position.x}, {position.y}")
```

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

## Keyboard operations

Keyboard operations are key input that a program sends to a desktop in place of a physical keyboard. A keyboard map translates each key to the characters it produces, so the same key can produce different characters on different maps.

Key names in a sandbox resolve against the keyboard map of the virtual display of its desktop, and keyboard input works only while that desktop is ready.

Send keyboard input to the desktop: [type](#type) a text string, [press](#press) one key with optional modifiers, or [press a hotkey](#press-a-hotkey) combination. Like mouse calls, keyboard calls require the desktop to be ready.

### Type

Type to enter text on the desktop as a sequence of key presses. Each character becomes the key, or the key with a modifier, that produces it on the keyboard map.

Typing in a sandbox sends any text, not only the characters on the keyboard map of the display. A character that has no key in the X11 keymap is typed through a temporary key mapping.

Type arbitrary text, including uppercase letters, symbols, and non-ASCII characters, to fill fields and editors. Newlines are sent as the Enter key and tabs as the Tab key. Set a delay between characters to slow typing down for applications that drop fast input.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

sandbox.computer_use.keyboard.type(text="Hello, World!")
```

| **Parameter** | **Description** |
| --- | --- |
| `text` | Sets the text to type.<br />**Required**<br />**Maximum:** 4096 Unicode code points<br />**Example:** `"Hello, World!"` |
| `delay` | Sets the pause between characters in seconds.<br />**Default:** `0`<br />**Minimum:** `0`<br />**Maximum:** `1` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.
> - **Limits:** The number of characters multiplied by the delay must not exceed 25 seconds.

### Press

Press a key to send one key stroke, with or without modifier keys held down. A modifier key, such as Ctrl or Shift, changes what another key does while it is held.

A press in a sandbox always leaves its modifiers released, even when the press fails.

Use a press for a single command key, such as Enter or Escape, or for a shortcut with modifiers. Modifiers are held in order, the key is pressed and released, and the modifiers are released in reverse order. See [supported keys](#supported-keys) for the names of the keys.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

sandbox.computer_use.keyboard.key(key="enter")
```

| **Parameter** | **Description** |
| --- | --- |
| `key` | Sets the key to press.<br />**Required**<br />**Format:** a [supported key](#supported-keys) name<br />**Example:** `"enter"` |
| `modifiers` | Sets the modifier keys to hold during the press, in order.<br />**Value:** `ctrl`, `alt`, `shift`, or `cmd`<br />**Example:** `["ctrl", "shift"]` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Press a hotkey

Press a hotkey to send a combination of keys as one command. A hotkey, such as Ctrl+C, is a chord of modifier keys and one key, pressed together.

A hotkey in a sandbox names its modifiers and its key in one string.

Use a hotkey for a shortcut written as one string, such as ctrl+c. The combination is a plus-separated chord string in which the last entry is the key and the entries before it are modifiers.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

sandbox.computer_use.keyboard.hotkey(keys="ctrl+c")
```

| **Parameter** | **Description** |
| --- | --- |
| `keys` | Sets the key combination to press.<br />**Required**<br />**Format:** [supported key](#supported-keys) names joined by plus signs, with the key last<br />**Example:** `"ctrl+c"` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Supported keys

Key names are the words that identify keys in keyboard input, such as enter for the Enter key. A key name stands for a physical key, while a single character stands for the key that produces it.

Key names in a sandbox are case-insensitive, and several keys have aliases. A single character keeps its case, so an uppercase A presses Shift and lowercase a.

Use these names for the key and modifiers parameters of a [press](#press), and for each part of the keys parameter of a [hotkey](#press-a-hotkey). The modifiers type in the SDKs lists ctrl, alt, shift, and cmd. The API accepts those four, their aliases, and any other supported key name as a modifier.

| **Category**  | **Keys**                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Modifiers     | `ctrl` (alias `control`), `alt`, `shift`, `cmd` (aliases `super`, `meta`, `win`)                             |
| Editing       | `enter` (alias `return`), `tab`, `escape` (alias `esc`), `backspace`, `delete` (alias `del`), `space`        |
| Navigation    | `home`, `end`, `pageup` (alias `page_up`), `pagedown` (alias `page_down`), `insert`, `up`, `down`, `left`, `right` |
| Function keys | `f1` through `f12`                                                                                            |
| Symbols       | `minus`, `plus`, `equal` (alias `equals`)                                                                     |
| Characters    | Any single character in the keymap of the display, for example `a`, `A`, `5`, `/`, `-`. In press and hotkey, a character outside the keymap returns `400`; use [type](#type) for it. In the keys parameter, write `plus` for `+`. |

## Accessibility operations

Accessibility operations read and act on the accessibility tree, the structure that applications expose to assistive technology such as screen readers. Each element of an interface is a node in the tree with a role, a name, and states, so a program finds a button by name.

Accessibility in a sandbox comes from AT-SPI, the accessibility bus of the Linux desktop. It covers the applications that expose their elements on the bus. A node is valid only while the application that owns the node keeps the element alive.

Use accessibility operations to inspect the AT-SPI tree and act on UI elements by node ID. Fall back to mouse, keyboard, and screenshot operations for applications and custom widgets that return sparse nodes, generic roles, or no actionable nodes. Traversal stops after 2000 nodes or 2 s for the tree, and after 5000 nodes or 2 s for find. Reaching a bound marks the response truncated, but cutting the tree at the maximum depth does not.

| **Scope**     | **Root**                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------- |
| **`focused`** | The application whose state includes `active`, else the first registered application. Default.     |
| **`pid`**     | The application owned by process `pid`. Returns `404` if no accessible application has that PID.   |
| **`all`**     | The AT-SPI registry root, covering every application.                                              |

| **API field**     | **Description**                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| **`id`**          | The bus name and the object path of the element, joined with a colon.                                      |
| **`role`**        | The AT-SPI role name, passed through unchanged.                                                            |
| **`name`**        | The accessible name.                                                                                       |
| **`bounds`**      | The x, y, width, and height in screen pixels, all zero for a node without the AT-SPI component interface. |
| **`states`**      | The [node states](#find-nodes), with any other state as `state:` followed by the AT-SPI state number.      |
| **`description`** | The accessible description, omitted when empty.                                                            |
| **`actions`**     | The names of the actions that the node supports, omitted when empty.                                       |
| **`children`**    | The child nodes, omitted when empty and never included in find matches.                                    |
| **`value`**       | Never set on Linux.                                                                                        |

### Get tree

Get the tree to read the accessibility structure of an interface in one call. The tree starts at a root and holds the elements below it, so it shows how the elements of a window nest.

The tree in a sandbox starts at the root that its scope selects, which is one application or all of them, and holds the nodes within the traversal bounds.

Read the tree to explore an unfamiliar application, and [find nodes](#find-nodes) when the role or the name of the element is known. The SDKs return at most 256 levels below the root. The API returns the whole subtree within the traversal budget when the maximum depth is omitted or is set to -1.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

tree = sandbox.computer_use.a11y.tree(scope="focused")
print(tree.root.role, tree.root.name, tree.truncated)
```

| **Parameter** | **Description** |
| --- | --- |
| `scope` | Sets the root of the search.<br />**Required**<br />**Value:** `focused`, `pid`, or `all`<br />**Example:** `"focused"` |
| `max_depth` | Limits the depth below the root.<br />**Default:** `256`<br />**Minimum:** `0`<br />**Maximum:** `256`<br />**Value:** `0` for the root only |
| `pid` | Selects the application by the ID of its process. |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Find nodes

Find nodes to locate the elements in an accessibility tree that match a description. A search by role and name finds an element, such as a button labeled Submit, without reading the whole tree.

A search in a sandbox returns the nodes that match every filter.

Find nodes to get the ID of an element for [focus](#focus-node), [invoke](#invoke-node), or [set node value](#set-node-value). Name matching is case-sensitive, and the regex mode uses the Rust regex-lite syntax and matches anywhere in the name unless the pattern is anchored at both ends. Find visits nodes depth first, last child first, so the first match is not necessarily the first element that appears on screen.

**Node states:**

| **Node states** |
| --- |
| `invalid`, `active`, `armed`, `busy`, `checked`, `collapsed`, `defunct`, `editable`, `enabled`, `expandable`, `expanded`, `focusable`, `focused`, `has-tooltip`, `horizontal`, `iconified`, `modal`, `multi-line`, `multiselectable`, `opaque`, `pressed`, `resizable`, `selectable`, `selected`, `sensitive`, `showing`, `single-line`, `stale`, `transient`, `vertical`, `visible`, `manages-descendants`, `indeterminate`, `required`, `truncated`, `animated` |

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

buttons = sandbox.computer_use.a11y.find(scope="focused", role="button", name="Submit")
for node in buttons.matches:
    print(node.id, node.name, node.bounds.x, node.bounds.y)
```

| **Parameter** | **Description** |
| --- | --- |
| `scope` | Sets the root of the search.<br />**Required**<br />**Value:** `focused`, `pid`, or `all`<br />**Example:** `"focused"` |
| `limit` | Caps the number of matches.<br />**Default:** `50`<br />**Value:** `0` or less for the default<br />**Example:** `10` |
| `name` | Matches the accessible name.<br />**Example:** `"Submit"` |
| `name_match` | Sets how name is compared.<br />**Default:** `exact`<br />**Value:** `exact`, `substring`, or `regex`, with `regex` taking a valid regular expression in name<br />**Example:** `"substring"` |
| `pid` | Selects the application by the ID of its process. |
| `role` | Matches the node role exactly.<br />**Example:** `"button"` |
| `states` | Requires every listed state on the node.<br />**Format:** a list of state names<br />**Value:** the [node states](#find-nodes)<br />**Example:** `["enabled", "focusable"]` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Focus node

Focus a node to make it the element that receives keyboard input. One element of a desktop has focus at a time, and typed text goes to that element.

Focus in a sandbox is a request to the application that owns the node.

Focus a field before [type](#type) or [press](#press) sends keys to it. Pass a node from [get tree](#get-tree) or [find nodes](#find-nodes). The call asks the application to give the node focus, and it fails when the application declines.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

node = sandbox.computer_use.a11y.find(scope="focused", role="button", name="Submit").matches[0]
sandbox.computer_use.a11y.focus(id=node.id)
```

| **Parameter** | **Description** |
| --- | --- |
| `id` | Sets the node to focus.<br />**Required**<br />**Format:** a node ID from [get tree](#get-tree) or [find nodes](#find-nodes) |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Invoke node

Invoke a node to run one of its actions, such as pressing a button. An accessible element lists the actions it supports by name, and a program runs one without the mouse or the keyboard.

An action in a sandbox runs in the application that owns the node.

Use invoke to press a button without knowing where it is on the screen, and give the action name in its exact case. The node must implement the AT-SPI action interface and list the action in its actions, and the application must accept the action.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

node = sandbox.computer_use.a11y.find(scope="focused", role="button", name="Submit").matches[0]
sandbox.computer_use.a11y.invoke(id=node.id)
```

| **Parameter** | **Description** |
| --- | --- |
| `id` | Sets the node to invoke.<br />**Required**<br />**Format:** a node ID from [get tree](#get-tree) or [find nodes](#find-nodes) |
| `action` | Sets the action to run.<br />**Default:** the node's click action, or its first action<br />**Format:** a name from the node's actions list<br />**Example:** `"click"` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Set node value

Set the value of a node to write text into an editable element in one step. Editable elements, such as text fields and text areas, hold their content as text that a program can replace directly.

A new value in a sandbox replaces the current content of the node instead of adding to it.

Write text content to nodes that implement editable text, such as entries and text areas, instead of [typing](#type) the text key by key. Pass the ID of an existing node from get tree or find nodes.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

node = sandbox.computer_use.a11y.find(scope="focused", role="entry").matches[0]
sandbox.computer_use.a11y.set_value(id=node.id, value="hello")
```

| **Parameter** | **Description** |
| --- | --- |
| `id` | Sets the node to write to.<br />**Required**<br />**Format:** a node ID from [get tree](#get-tree) or [find nodes](#find-nodes) |
| `value` | Sets the text that replaces the content of the node.<br />**Required**<br />**Example:** `"hello"` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

## Screenshot operations

Screenshot operations capture the pixels of a screen as an image. A program that controls a desktop reads screenshots to see the result of its last action and to find the next element.

A screenshot in a sandbox captures the virtual screen, without the cursor.

Use screenshot operations to check the state of an application after each action. Screenshots return the image as a base64 string, its encoded size in bytes, and the pointer coordinates when the cursor is requested. The SDKs take every variant through one screenshot method, where a region selects the region variant and a format, quality, or scale selects the compressed one. The show cursor parameter works with every variant and does not select the compressed one.

### Take full screen

Take a full-screen screenshot to capture everything that a person at the desktop sees. A full-screen image covers every window on the display and the background behind them.

A full-screen screenshot in a sandbox is a PNG image of the whole virtual screen.

Take a screenshot of the entire screen when the next step depends on the whole layout. To get a smaller image, take a [compressed](#take-compressed) screenshot instead.

```python
import base64

from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

screenshot = sandbox.computer_use.screen.screenshot()
print(f"Screenshot size: {screenshot.size_bytes} bytes")
with open("screen.png", "wb") as f:
    f.write(base64.b64decode(screenshot.screenshot))
```

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Take region

Take a region screenshot to capture one rectangle of the screen. An image of a smaller area holds only the part that matters, and it is smaller to transfer and to process.

A region screenshot in a sandbox is a PNG image of one rectangle of the screen.

Take a screenshot of a specific region of the screen to check one element, such as a dialog. The width and height of the region must be positive, and the whole region must lie within the screen.

```python
from daytona import Daytona
from daytona.v2 import ComputerUseRegion

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

screenshot = sandbox.computer_use.screen.screenshot(
    region=ComputerUseRegion(x=100, y=100, width=300, height=200)
)
print(f"Captured region: {screenshot.size_bytes} bytes")
```

| **Parameter** | **Description** |
| --- | --- |
| `region` | Sets the screen rectangle to capture.<br />**Format:** x, y, width, and height in pixels, with a width and height of at least `1`<br />**Example:** `ComputerUseRegion(x=100, y=100, width=300, height=200)` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Take compressed

Take a compressed screenshot to capture the screen as a smaller image. Lossy formats such as JPEG, and a lower scale, trade image detail for size.

A compressed screenshot in a sandbox covers the whole virtual screen of the desktop, like a full-screen screenshot, in the format and at the scale that the call selects.

Take a compressed screenshot of the entire screen when a smaller image is enough.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

screenshot = sandbox.computer_use.screen.screenshot(format="jpeg", quality=80)
print(f"Compressed size: {screenshot.size_bytes} bytes")
```

| **Parameter** | **Description** |
| --- | --- |
| `format` | Sets the image format.<br />**Default:** `png`<br />**Value:** `png` or `jpeg`<br />**Example:** `"jpeg"` |
| `quality` | Sets the JPEG quality.<br />**Default:** `85`<br />**Minimum:** `1`<br />**Maximum:** `100` |
| `scale` | Resizes the captured image by a factor.<br />**Default:** `1.0`<br />**Minimum:** `0.1`<br />**Maximum:** `1.0` |
| `show_cursor` | Returns the pointer coordinates with the screenshot.<br />**Default:** `False` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Take compressed region

Take a compressed region screenshot to capture one rectangle of the screen as a smaller image. It combines the smaller area of a region with the smaller encoding of compression.

A compressed region screenshot in a sandbox is an image of a rectangle within the virtual screen of the desktop, in the format that the call selects.

Take a compressed region screenshot when a smaller image is enough. It accepts the region parameters of [take region](#take-region) and the compression parameters of [take compressed](#take-compressed).

```python
from daytona import Daytona
from daytona.v2 import ComputerUseRegion

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

screenshot = sandbox.computer_use.screen.screenshot(
    region=ComputerUseRegion(x=0, y=0, width=800, height=600), format="jpeg", quality=80
)
print(f"Compressed size: {screenshot.size_bytes} bytes")
```

| **Parameter** | **Description** |
| --- | --- |
| `format` | Sets the image format.<br />**Default:** `png`<br />**Value:** `png` or `jpeg`<br />**Example:** `"jpeg"` |
| `quality` | Sets the JPEG quality.<br />**Default:** `85`<br />**Minimum:** `1`<br />**Maximum:** `100` |
| `region` | Sets the screen rectangle to capture.<br />**Format:** x, y, width, and height in pixels, with a width and height of at least `1`<br />**Example:** `ComputerUseRegion(x=0, y=0, width=800, height=600)` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

## Screen recording

Screen recording is the capture of a desktop as a video over time. A recording shows a sequence of actions and their effects, which a single screenshot cannot show.

A recording in a sandbox is an MP4 file that is captured at 10 frames per second and stored inside the sandbox. It runs until a stop or one of its caps ends it.

Record desktop sessions to debug or document what an agent did. Up to 20 finished recordings are kept, including failed and interrupted ones, and when a stop or list call finds more, the oldest are deleted with their files. Video is encoded with MPEG-4 Part 2, not H.264, so some browsers cannot play it inline. The TypeScript SDK and the API use the camelCase field names, and the Python SDK uses the snake_case names of the same fields.

| **Field**              | **Description**                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `id`               | Recording ID, prefixed `rec_`. Used for stop, get, download, and delete.                                 |
| `fileName`, `file_name` | `<label>-<id>.mp4`. Label characters other than letters, digits, and `-` are replaced with `_`. The label defaults to `recording`. |
| `filePath`, `file_path` | Path of the file inside the sandbox.                                                                 |
| `startTime`, `start_time` | Start time: an RFC 3339 string in TypeScript and the API, a `datetime` in Python.                 |
| `endTime`, `end_time` | End time, in the same type as the start time. Absent until the recording is finalized.               |
| `status`           | See the status table below.                                                                               |
| `durationSeconds`, `duration_seconds` | Elapsed seconds while active, or the final duration.                                   |
| `sizeBytes`, `size_bytes` | Current file size while active, or the final size.                                                 |

| **Status**                   | **Meaning**                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `recording`              | Capturing.                                                                           |
| `stopping`               | Stop was requested and the encoder is finalizing the file.                          |
| `duration_limit_reached` | The 15 minute cap was hit. The recording keeps this status once the file is finalized. |
| `size_limit_reached`     | The 512 MiB cap was hit. The recording keeps this status once the file is finalized.  |
| `completed`              | Terminal. The file is ready to download.                                             |
| `interrupted`            | Terminal. The encoder did not exit after a stop or a cap and was killed; the file may be incomplete. |
| `failed`                 | Terminal. The encoder exited on its own with an error, or the file is smaller than 1 KiB. The file is deleted, so download returns `404`. |

### Start recording

Start a recording to capture what happens on the desktop from that moment until the recording ends. A label in the file name tells the recordings apart later.

A new recording in a sandbox runs until a stop or one of its caps ends it.

Start a screen recording, with an optional label, before the steps to capture, such as an agent run. The desktop must be ready before the recording starts. At most 2 recordings can be in progress at once, counting those recording, stopping, or finishing after the 15-minute or 512 MiB cap. A third start fails while two recordings are in progress.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

recording = sandbox.computer_use.recording.start()
print(f"Recording started: {recording.id}")
```

| **Parameter** | **Description** |
| --- | --- |
| `label` | Sets the prefix of the file name. A longer label is truncated to 120 characters.<br />**Default:** `recording`<br />**Maximum:** 120 characters<br />**Format:** letters, digits, and hyphens, with any other character replaced by an underscore<br />**Example:** `"login-flow"` |

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Stop recording

Stop a recording to end the capture and have the encoder finalize the video file. A screen recording is a video of what a display shows over time, and its file is complete only after the encoder writes the last frames and the index that players read.

A stop in a sandbox waits until the file is finalized, and the recording ends in a terminal status.

Stop an active recording session by its ID when the steps to capture are done. The call returns once the file is finalized, and the response holds the terminal recording.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()
recording = sandbox.computer_use.recording.start()

stopped_recording = sandbox.computer_use.recording.stop(id=recording.id)
print(f"Recording stopped: {stopped_recording.duration_seconds} seconds")
print(f"Saved to: {stopped_recording.file_path}")
```

| **Parameter** | **Description** |
| --- | --- |
| `id` | Sets the recording to stop.<br />**Required**<br />**Format:** a recording ID |

### List recordings

List recordings to find the recordings that a desktop holds. A list shows recordings that are still running next to finished ones, with the status of each.

The list of a sandbox covers all recordings in the sandbox, active and finished, and a list call also deletes the oldest finished recordings beyond the number that the sandbox keeps.

Use the list to find the ID of a recording to [get](#get-recording), [download](#download-recording), or [delete](#delete-recording).

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

recordings_list = sandbox.computer_use.recording.list()
print(f"Total recordings: {len(recordings_list.recordings)}")
for rec in recordings_list.recordings:
    print(f"- {rec.file_name}: {rec.status} {rec.duration_seconds}s ({rec.size_bytes} bytes)")
```

### Get recording

Get a recording to read its details by ID. The details of a recording change while the recording captures, and they no longer change after it ends.

A recording in a sandbox reports its progress while it captures.

Get details about a specific recording to follow an active recording, or to check that a stopped recording completed before you [download](#download-recording) its file.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()
recording = sandbox.computer_use.recording.start()

recording_detail = sandbox.computer_use.recording.get(recording.id)
print(f"Recording: {recording_detail.file_name}")
print(f"Status: {recording_detail.status}")
print(f"Duration: {recording_detail.duration_seconds}s")
```

| **Parameter** | **Description** |
| --- | --- |
| `id` | Sets the recording to get.<br />**Required**<br />**Format:** a recording ID |

### Delete recording

Delete a recording to remove its video file from the sandbox and free its disk space. Deletion removes a file permanently, so a recording that is not copied elsewhere cannot be recovered.

A delete in a sandbox removes the recording and its file, and an active recording is stopped first.

Delete a recording by ID once the file is downloaded or no longer needed.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()
recording = sandbox.computer_use.recording.start()

sandbox.computer_use.recording.delete(recording.id)
print("Recording deleted successfully")
```

| **Parameter** | **Description** |
| --- | --- |
| `id` | Sets the recording to delete.<br />**Required**<br />**Format:** a recording ID |

### Download recording

Download a recording to copy its video file from the sandbox to local disk. A download is a copy over the network: the file arrives on local disk, and the original stays where it was.

A download in a sandbox streams the file from the daemon, and an active recording can be downloaded with the part of the file written so far.

Download a recording file after a [stop](#stop-recording) returns a completed recording. The SDKs hold the whole file in memory and return it as bytes, so write it to disk yourself.

```python
from pathlib import Path

from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()
recording = sandbox.computer_use.recording.start()
sandbox.computer_use.recording.stop(id=recording.id)

data = sandbox.computer_use.recording.download(recording.id)
Path("local_recording.mp4").write_bytes(data)
print(f"Downloaded {len(data)} bytes")
```

| **Parameter** | **Description** |
| --- | --- |
| `id` | Sets the recording to download.<br />**Required**<br />**Format:** a recording ID |
| `max_response_bytes` | Sets the response size cap for this call in bytes.<br />**Default:** the client's cap, 1 GiB unless the client sets another<br />**Value:** `0` for no limit<br />**Example:** `2147483648` |

## Display operations

Display operations read the layout of a screen and the windows on it. A program uses them to learn the size of the screen and where each window sits before it acts.

The display of a sandbox is the virtual display that a start creates.

Use display operations to check the screen geometry and to find a window before mouse input. The virtual display runs at 1280x720 with 24-bit color unless [start](#start-computer-use) or [restart](#restart-computer-use) sets 1024x768 or 1920x1080. Verify the live geometry with [get info](#get-info).

### Get info

Get display information to learn the size and position of each screen. A display server can show several screens, each placed at an offset in one shared coordinate space.

The virtual desktop of a sandbox has one screen.

Get information about the displays to confirm the resolution after a start or a restart. The response lists every X screen with its ID, position, size, and active flag.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

info = sandbox.computer_use.display.info()
print(f"Total displays: {len(info.displays)}")
for display in info.displays:
    print(f"Display {display.id}: {display.width}x{display.height} at {display.x},{display.y}")
```

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

### Get windows

Get windows to list the windows open on a desktop. Each application draws in one or more windows, and the window manager keeps track of them.

The window list of a sandbox is read from the client list property that the window manager maintains, so it depends on a running window manager.

Get the list of open windows to find the window of an application before you act on it. Each window carries its ID, title, position, size, and active flag. Start refuses to run when no window manager is present, because the window list depends on it.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()
sandbox.computer_use.start()

windows = sandbox.computer_use.display.windows()
print(f"Found {len(windows.windows)} open windows:")
for window in windows.windows:
    print(f"- {window.title} (ID: {window.id}, active: {window.is_active})")
```

> **Notes:**
>
> - **Prerequisites:** The desktop must be ready.

## Permissions

Computer Use runs through the toolbox of a sandbox. Access is governed by one project permission, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

A [sandbox access token](./sandboxes.md#create-an-access-token) with the desktop or toolbox operation grants the same access to one sandbox, without an API key. The sandbox read permission alone grants no toolbox access.

| **Permission**        | **Grants**                                                        |
| --------------------- | ----------------------------------------------------------------- |
| **`write:sandboxes`** | Control the desktop, mouse, keyboard, screenshots, and recordings |
