# VNC Access (TypeScript SDK)

Interact with your sandbox's graphical desktop environment directly in the browser.

VNC access is viewing and controlling the graphical desktop of a sandbox over VNC (Virtual Network Computing). A person uses it to watch an agent on the desktop, or to take it over.

Daytona provides VNC access to a graphical desktop inside each Linux sandbox. The desktop ships with the sandbox runtime, so it works on any Linux sandbox image. It opens in the browser through the dashboard, and your own VNC client can connect to it as well. GPU sandboxes have no desktop, and the dashboard does not offer one for them.

Use VNC access to work with GUI applications in a Linux sandbox, or to watch GUI tests and inspect the desktop after a failure. [Computer use](./computer-use.md) is the programmatic API for AI agents, and VNC is the visual interface where you watch an agent work or take over when it cannot continue.

## Contents

- [Use cases](#use-cases)
- [Start the desktop](#start-the-desktop)
- [Desktop operations](#desktop-operations)
- [Desktop states](#desktop-states)
- [Connect your own VNC client](#connect-your-own-vnc-client)
- [Automate the desktop](#automate-the-desktop)
- [Sandbox activity](#sandbox-activity)
- [Permissions](#permissions)

## Use cases

VNC access is used when a person needs to see or operate the desktop of a sandbox.

- **Computer-use agents.** A person follows what an agent does on the desktop as it happens, from the browser. The agent drives the mouse and keyboard through Computer Use, and VNC shows the same desktop. Desktop interaction calls, such as screenshots and mouse and keyboard input, fail with a desktop-not-ready error until the desktop is ready.

- **Takeover from an agent.** A person operates the desktop directly when an agent cannot continue, for example at a login screen. The **Desktop** tab in the dashboard gives mouse and keyboard control over the same desktop. Only members whose project API key has the sandbox write permission see that tab.

- **GUI applications.** Desktop applications with no web or command-line interface run in the sandbox and are used from the browser. The desktop stack ships with the sandbox runtime, so it works on any Linux image, including custom images without desktop packages. The virtual display runs at 1280x720 unless you start or restart it at 1024x768 or 1920x1080.

- **Desktop test debugging.** A person watches GUI tests run and inspects the desktop after a failure. A desktop restart clears all application windows, so inspect the desktop before you restart it. When the desktop itself fails, its status carries a cause with a code and a message.

- **Your own VNC client.** Any VNC client that supports WebSocket, such as noVNC, connects to the desktop through the Daytona proxy. An application embeds the desktop in its own interface. Browser clients that cannot set headers pass the API key as a query parameter.

## Start the desktop

Start the desktop to give a sandbox a graphical session for viewers and agents. A Linux desktop is a set of processes around a display server that holds the windows.

The desktop of a sandbox runs inside the sandbox and lasts until it is stopped or the sandbox stops. It runs at the resolution set when it starts or restarts.

Start the desktop of a running sandbox from the dashboard or programmatically, which starts Xvfb, the window manager, x11vnc, and D-Bus when the image or runtime provides it. Once the desktop is ready, the dashboard connects a browser VNC viewer with mouse and keyboard control. If the desktop fails to start, the **Desktop** tab shows the failure cause and offers **Restart Desktop**. Use **Fullscreen** for a larger view, or **Reconnect** if the connection drops.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.com/dashboard/sandboxes)
2. Open the sandbox you want to access
3. Select the **Desktop** tab
4. Click **Start Desktop** if the desktop is not started
5. Click into the frame to control the desktop

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();

const result = await sandbox.computerUse.start();
console.log('VNC processes started:', result.message);
```

| **Parameter** | **Description** |
| --- | --- |
| `resolution` | Sets the desktop size in pixels.<br />**Default:** the resolution last selected by a start or restart, or 1280x720<br />**Value:** 1024x768, 1280x720, or 1920x1080<br />**Example:** `{ width: 1920, height: 1080 }` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be running.
> - **Results:** start() returns once the X server and the VNC server accept connections.
> - **Recovery:** On a failed desktop, call restart() instead of start().

## Desktop operations

Desktop operations are the actions that inspect or change a desktop after it starts. A desktop is the graphical interface of an operating system, drawn by a display server.

A desktop operation on a sandbox acts on all desktop processes together.

Use the operations below to check, stop, and restart the desktop. For operations on single desktop processes, such as restarting one process or reading its logs, see [computer use](./computer-use.md).

### Get desktop status

Get the desktop status to learn whether a desktop is running before a step that needs it. A status is a report of the state of a process or service at the moment of the request.

The status of a sandbox desktop reports its lifecycle state and whether it is active. A desktop is active only when it is ready, and inactive in every other state.

Check whether the desktop of the sandbox is running before you connect a viewer or run computer use operations. The status field is active or inactive, and the desktop field reports the [desktop state](#desktop-states): not started, starting, ready, or failed.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();

const status = await sandbox.computerUse.status();
console.log('VNC status:', status.status, status.desktop);
```

> **Notes:**
>
> - **Prerequisites:** The sandbox must be running.

### Stop the desktop

Stop the desktop to end its processes when the sandbox no longer needs a graphical session. Stopping a desktop ends the programs that draw and share the screen.

A stop ends all desktop processes in the sandbox. A stop of a failed desktop kills its processes, but the desktop stays in the failed state until a restart.

Stop the desktop when no one needs it. [Restart](#restart-the-desktop) a failed desktop instead of starting it.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.computerUse.start();

const result = await sandbox.computerUse.stop();
console.log('VNC processes stopped:', result.message);
```

> **Notes:**
>
> - **Prerequisites:** The sandbox must be running.

### Restart the desktop

Restart the desktop to replace its processes with a fresh desktop. A restart tears down the running processes and starts new ones in their place.

A restart of a sandbox desktop is valid from every state and is the only way out of the failed state. Application windows live inside the X server, so a restart returns an empty desktop.

Restart a failed desktop, or a desktop whose X server exited, to get a working desktop back. Inspect the desktop before you restart it, because the restart clears all application windows. The response reports an active status and a ready desktop.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.computerUse.start();

const result = await sandbox.computerUse.restart();
console.log('VNC restarted:', result.message, result.desktop);
```

| **Parameter** | **Description** |
| --- | --- |
| `resolution` | Sets the desktop size in pixels.<br />**Default:** the current resolution<br />**Value:** 1024x768, 1280x720, or 1920x1080<br />**Example:** `{ width: 1920, height: 1080 }` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be running.

## Desktop states

Desktop states are the stages of the lifecycle of a desktop, from the first start to a stop or a failure. Each state decides which actions the desktop accepts.

The state of a sandbox desktop changes when an operation acts on it or when a desktop process fails. Only a failed desktop has a cause, and the cause names what was lost.

Check the desktop state and recover a failed desktop before you run computer use operations. The desktop field of the [status](#get-desktop-status) response is the desktop lifecycle state, and the status field derived from it is active when the desktop is ready and inactive otherwise. The cause object of a failed desktop has a code and a message with the platform detail. Treat an unknown code as a failure as well, because new codes can be added.

| **`desktop`**     | **Meaning**                                                          | **Next step**                                      |
| ----------------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| `not_started`     | No desktop is running. Also the state after a sandbox stop or start. | [Start](#start-the-desktop) the desktop.           |
| `starting`        | The desktop stack is coming up.                                      | Poll the status until `ready`.                     |
| `ready`           | The desktop is running and the VNC server accepts connections.       | Connect a viewer or run Computer Use operations.   |
| `failed`          | The desktop stopped working. `cause` carries `code` and `message`.   | [Restart](#restart-the-desktop) the desktop.       |

| **`cause.code`**           | **Meaning**                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `desktop_exited`           | The X server (`xvfb`) exited. Windows live inside it, so the desktop is gone. |
| `addon_crashed`            | The desktop supervisor died while a desktop existed.                          |
| `start_failed`             | Starting the stack or probing its readiness failed.                           |
| `start_interrupted`        | The supervisor died while the desktop was starting.                           |
| `session_ended`            | The bound interactive session ended.                                          |
| `session_replaced`         | The bound interactive session was replaced by another logon.                  |
| `state_corrupt`            | The retained desktop state could not be read or validated.                    |
| `state_persistence_failed` | A desktop state transition could not be persisted.                            |

```typescript
import { Daytona } from '@daytona/sdk';
import { DesktopNotReadyError } from '@daytona/sdk/v2';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();

const status = await sandbox.computerUse.status();
if (status.desktop === 'failed') {
  console.log('Desktop failed:', status.cause.code, status.cause.message);
  await sandbox.computerUse.restart();
}

try {
  await sandbox.computerUse.screen.screenshot();
} catch (e) {
  if (e instanceof DesktopNotReadyError) console.log('Desktop not ready:', e.message);
}
```

> **Notes:**
>
> - **Prerequisites:** The sandbox must be running. Every Computer Use operation (mouse, keyboard, screenshot, display, accessibility, recording start) requires the desktop to be in the `ready` state.
> - **Results:** On a `ready` desktop, start returns the process status, or a conflict error for a different resolution.
> - **Recovery:** Nothing retries calls on a desktop that is not ready, and retry does not recover a failed desktop. On a `starting` or `failed` desktop, start fails, so retrying it does not clear a failed desktop. Stop kills the processes of a `failed` desktop, but only restart leaves `failed`. Restart such a process through [computer use](./computer-use.md), or [restart](#restart-the-desktop) the desktop. Xvfb never restarts on its own and cannot restart as a single process, so [restart](#restart-the-desktop) the desktop.
> - **Behaviour:** D-Bus, the window manager, and x11vnc restart with backoff on exit; the desktop stays `ready`. A process that exits 6 times in a row, each time within 30 seconds of its start, is not restarted again, while the desktop still reports the `ready` state.

## Connect your own VNC client

Connect your own VNC client to show the desktop of a sandbox in your own viewer or application. A VNC client speaks the RFB protocol, and a client that supports WebSocket carries RFB over a WebSocket connection from a browser.

The VNC server of a sandbox runs in shared mode without a VNC password, so several viewers can share one desktop. An API key or a sandbox access token with desktop access is the only credential, and a viewer that prompts for a VNC password is not talking to the sandbox desktop.

Connect any WebSocket-capable VNC client, such as noVNC, once the desktop is [started](#start-the-desktop) and the sandbox is running. The proxy bridges the VNC server of the sandbox as a WebSocket that carries raw RFB in binary frames. It echoes the binary subprotocol when the client requests it. It rejects a connection with an HTTP status before the handshake completes.

| **Part**              | **Value**                                                   | **Description**                                                                                                         |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **WebSocket address** | `wss://{proxyHost}/vnc/{sandboxId}`                         | The `{proxyHost}` is the host of the [toolbox URL](./sandboxes.md#toolbox) of the sandbox. |
| **Header credential** | `Authorization: Bearer <API_KEY>`                           | The header carries the API key.                                                                                         |
| **Query credential**  | `wss://{proxyHost}/vnc/{sandboxId}?daytona_token=<API_KEY>` | The daytona_token query parameter carries the API key for browser clients that cannot set headers.                      |

| **Status**     | **Cause**                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `401`          | The credential is missing or invalid, and an unknown sandbox ID usually returns it too because the proxy checks the credential against the sandbox first. |
| `403`          | The sandbox token does not grant desktop access.                                                           |
| `404`          | The sandbox is unknown.                                                                                    |
| `409`          | The sandbox is not running or failed to start.                                                             |
| `502` or `503` | The VNC server is unreachable.                                                                             |

## Automate the desktop

Automate the desktop to let an AI agent or a script operate GUI applications in a sandbox. Desktop automation sends mouse and keyboard input to a desktop from code and reads the screen back as images, with no person at a viewer.

Automation of a sandbox desktop runs on the same desktop that VNC shows, so a person can watch an agent work in a viewer while it controls the mouse and keyboard.

Automate desktop interactions with [computer use](./computer-use.md) once the desktop is running. Computer Use provides mouse operations (click, move, drag, scroll, and cursor position) and keyboard operations (typing, key presses, and hotkeys). It also provides screenshots (full screen, regions, and compressed images) and display operations (display information and open windows).

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();

// Start VNC processes
await sandbox.computerUse.start();

// Click to open browser
await sandbox.computerUse.mouse.click({ x: 50, y: 50, button: 'left' });

// Type a URL
await sandbox.computerUse.keyboard.type({ text: 'https://www.daytona.com/docs/' });
await sandbox.computerUse.keyboard.key({ key: 'enter' });

// Take a screenshot
const screenshot = await sandbox.computerUse.screen.screenshot();
```

| **Parameter** | **Description** |
| --- | --- |
| `x` | Sets the horizontal position of the click in desktop pixels.<br />**Required**<br />**Example:** `50` |
| `y` | Sets the vertical position of the click in desktop pixels.<br />**Required**<br />**Example:** `50` |
| `text` | Sets the text to type.<br />**Required**<br />**Example:** `'https://www.daytona.com/docs/'` |
| `key` | Sets the name of the key to press.<br />**Required**<br />**Example:** `'enter'` |
| `button` | Sets the mouse button.<br />**Default:** `'left'`<br />**Value:** `'left'`, `'middle'`, or `'right'`<br />**Example:** `'right'` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be running.
> - **Results:** start() returns once the X and VNC servers accept connections, so later calls need no status poll.
> - **Recovery:** On a failed desktop, call restart() instead of start().

## Sandbox activity

Sandbox activity is the traffic that marks a sandbox as in use and resets its idle timer. An idle timer stops unused resources: each sign of use restarts it, and it acts when it runs out.

A VNC session counts toward the sandbox's idle timeout only while the viewer sends input. A viewer left open on an unchanging screen sends nothing, so the idle timer runs.

Interact with the desktop to keep the sandbox active before its [idle timer](./linux-sandboxes.md#timeouts) runs out. The proxy records activity when the session connects and whenever the viewer sends bytes.

## Permissions

VNC access runs through the toolbox of a sandbox. Access is governed by one project permission, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md). The **Desktop** tab in the dashboard is shown only to members whose project API key has the sandbox write permission, alongside the **Terminal**, **Files**, and **SSH** tabs of the sandbox.

A [sandbox access token](./sandboxes.md#create-an-access-token) with the desktop operation grants the same access to a single sandbox, without an API key. The sandbox read permission alone does not grant toolbox access.

| **Permission**        | **Grants**                              |
| --------------------- | --------------------------------------- |
| **`write:sandboxes`** | Start, stop, and connect to the desktop |
