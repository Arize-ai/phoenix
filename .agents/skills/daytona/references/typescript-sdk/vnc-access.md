## Contents

- Access VNC from Dashboard
- Programmatic VNC management
- Automating desktop interactions
- Required packages
- See Also




VNC (Virtual Network Computing) access provides a graphical desktop environment for your Daytona Sandbox directly in the browser. This allows you to interact with GUI applications, desktop tools, and visual interfaces running inside your sandbox.

VNC and [Computer Use](./computer-use-guide.md) work together to enable both manual and automated desktop interactions. VNC provides the visual interface for users to manually interact with the desktop, while Computer Use provides the programmatic API for AI agents to automate mouse, keyboard, and screenshot operations. Through VNC, you can observe AI agents performing automated tasks via Computer Use in real-time.
> **Note: Sandbox image requirement**
> VNC and Computer Use require a sandbox with the default image. Sandboxes created with custom images do not include VNC support unless you install the [required packages](#required-packages).

## Access VNC from Dashboard

Access the VNC desktop environment directly from the [Daytona Dashboard ↗](https://app.daytona.io/dashboard/sandboxes).

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Locate the sandbox you want to access via VNC
3. Click the options menu (**⋮**) next to the sandbox
4. Select <Button>VNC</Button> from the dropdown menu

This opens a VNC viewer in your browser with a **Connect** button.

5. Click <Button>Connect</Button> to establish the VNC session

Once connected, a full desktop environment loads in your browser, providing mouse and keyboard control over the sandbox's graphical interface.
> **Note:**
> VNC sessions remain active as long as the sandbox is running. If the sandbox auto-stops due to inactivity, you need to start the sandbox again before reconnecting via VNC.

Configure the VNC desktop's resolution when creating the sandbox with the [`VNC_RESOLUTION` environment variable](./computer-use-guide.md#configure-desktop-resolution). The resolution cannot be changed on a running sandbox.

## Programmatic VNC management

Daytona provides methods to [start](#start-vnc), [stop](#stop-vnc), and [monitor](#get-vnc-status) VNC sessions and processes programmatically using the [Computer Use](./computer-use-guide.md) references as part of automated workflows.

### Start VNC

Start all VNC processes (Xvfb, xfce4, x11vnc, novnc) in the sandbox to enable desktop access.

```typescript
const result = await sandbox.computerUse.start();
console.log('VNC processes started:', result.message);
```

### Stop VNC

Stop all VNC processes in the sandbox.

```typescript
const result = await sandbox.computerUse.stop();
console.log('VNC processes stopped:', result.message);
```

### Get VNC status

Check the status of VNC processes to verify they are running.

```typescript
const status = await sandbox.computerUse.getStatus();
console.log('VNC status:', status.status);
```

For additional process management operations including restarting individual processes and viewing logs, see the [Computer Use](./computer-use-guide.md) reference.

## Automating desktop interactions

Once VNC is running, you can automate desktop interactions using Computer Use. This enables AI agents to programmatically control the mouse, keyboard, and capture screenshots within the VNC session.

**Available operations:**

- **Mouse**: click, move, drag, scroll, and get cursor position
- **Keyboard**: type text, press keys, and execute hotkey combinations
- **Screenshot**: capture full screen, regions, or compressed images
- **Display**: get display information and list open windows

For complete documentation on automating desktop interactions, see [Computer Use](./computer-use-guide.md).

> **Example**: Automated browser interaction

```typescript
// Start VNC processes
await sandbox.computerUse.start();

// Click to open browser
await sandbox.computerUse.mouse.click(50, 50);

// Type a URL
await sandbox.computerUse.keyboard.type('https://www.daytona.io/docs/');
await sandbox.computerUse.keyboard.press('enter');

// Take a screenshot
const screenshot = await sandbox.computerUse.screenshot.takeFullScreen();
```

## Required packages

The default sandbox image includes all packages required for VNC and Computer Use. If you are using a custom image, you need to install the following packages.

### VNC and desktop environment

| Package              | Description                                |
| -------------------- | ------------------------------------------ |
| **`xvfb`**           | X Virtual Framebuffer for headless display |
| **`xfce4`**          | Desktop environment                        |
| **`xfce4-terminal`** | Terminal emulator                          |
| **`x11vnc`**         | VNC server                                 |
| **`novnc`**          | Web-based VNC client                       |
| **`dbus-x11`**       | D-Bus session support                      |

### X11 libraries

| Library           | Description                                 |
| ----------------- | ------------------------------------------- |
| **`libx11-6`**    | X11 client library                          |
| **`libxrandr2`**  | X11 RandR extension (display configuration) |
| **`libxext6`**    | X11 extensions library                      |
| **`libxrender1`** | X11 rendering extension                     |
| **`libxfixes3`**  | X11 fixes extension                         |
| **`libxss1`**     | X11 screen saver extension                  |
| **`libxtst6`**    | X11 testing extension (input simulation)    |
| **`libxi6`**      | X11 input extension                         |

## See Also
- [Python SDK - vnc-access](../python-sdk/vnc-access.md)
