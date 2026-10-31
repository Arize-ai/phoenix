# Computer Use API


## Contents

- POST `/computeruse/a11y/find`
- POST `/computeruse/a11y/node/focus`
- POST `/computeruse/a11y/node/invoke`
- POST `/computeruse/a11y/node/value`
- GET `/computeruse/a11y/tree`
- GET `/computeruse/display/info`
- GET `/computeruse/display/windows`
- POST `/computeruse/keyboard/hotkey`
- POST `/computeruse/keyboard/key`
- POST `/computeruse/keyboard/type`
- POST `/computeruse/mouse/click`
- POST `/computeruse/mouse/drag`
- POST `/computeruse/mouse/move`
- GET `/computeruse/mouse/position`
- POST `/computeruse/mouse/scroll`
- GET `/computeruse/process-status`
- GET `/computeruse/process/{processName}/errors`/errors}
- GET `/computeruse/process/{processName}/logs`/logs}
- POST `/computeruse/process/{processName}/restart`/restart}
- GET `/computeruse/process/{processName}/status`/status}
- GET `/computeruse/recordings`
- POST `/computeruse/recordings/start`
- POST `/computeruse/recordings/stop`
- GET `/computeruse/recordings/{id}`}
- DELETE `/computeruse/recordings/{id}`}
- GET `/computeruse/recordings/{id}/download`/download}
- GET `/computeruse/screenshot`
- GET `/computeruse/screenshot/compressed`
- GET `/computeruse/screenshot/region`
- GET `/computeruse/screenshot/region/compressed`
- POST `/computeruse/start`
- GET `/computeruse/status`
- POST `/computeruse/stop`

## POST `/computeruse/a11y/find` {#daytona-toolbox/tag/computer-use/POST/computeruse/a11y/find}

**Find accessibility nodes**

Search the AT-SPI tree for nodes matching a role/name/state filter and return a flat list.

### Request Body

Find request

Schema: **FindAccessibilityNodesRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | integer | No |  |
| `name` | string | No |  |
| `nameMatch` | string | No | "exact" \| "substring" \| "regex" |
| `pid` | integer | No |  |
| `role` | string | No |  |
| `scope` | string | No |  |
| `states` | array of string | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | AccessibilityNodesResponse |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |
| 503 | Service Unavailable | ErrorResponse |

---

## POST `/computeruse/a11y/node/focus` {#daytona-toolbox/tag/computer-use/POST/computeruse/a11y/node/focus}

**Focus an accessibility node**

Move keyboard focus to the AT-SPI node identified by id (bus-name:object-path).

### Request Body

Node focus request

Schema: **AccessibilityNodeRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | Empty |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |
| 503 | Service Unavailable | ErrorResponse |

---

## POST `/computeruse/a11y/node/invoke` {#daytona-toolbox/tag/computer-use/POST/computeruse/a11y/node/invoke}

**Invoke an action on an accessibility node**

Call an AT-SPI Action on the node. Leave action empty to invoke the node's primary (first) action.

### Request Body

Invoke request

Schema: **AccessibilityInvokeRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | No |  |
| `id` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | Empty |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |
| 503 | Service Unavailable | ErrorResponse |

---

## POST `/computeruse/a11y/node/value` {#daytona-toolbox/tag/computer-use/POST/computeruse/a11y/node/value}

**Set the value of an accessibility node**

Write the given value to the node via EditableText.SetTextContents or, for numeric controls, Value.CurrentValue.

### Request Body

Set value request

Schema: **AccessibilitySetValueRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes |  |
| `value` | string | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | Empty |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |
| 503 | Service Unavailable | ErrorResponse |

---

## GET `/computeruse/a11y/tree` {#daytona-toolbox/tag/computer-use/GET/computeruse/a11y/tree}

**Get accessibility tree**

Fetch the AT-SPI accessibility tree for the focused application, a specific PID, or all registered applications.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `scope` | query | string | No | Scope: focused \| pid \| all (default: focused) |
| `pid` | query | integer | No | Process ID when scope=pid |
| `maxDepth` | query | integer | No | Max tree depth (-1 unbounded, 0 root only; default -1) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | AccessibilityTreeResponse |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |
| 503 | Service Unavailable | ErrorResponse |

---

## GET `/computeruse/display/info` {#daytona-toolbox/tag/computer-use/GET/computeruse/display/info}

**Get display information**

Get information about all available displays

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | DisplayInfoResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/computeruse/display/windows` {#daytona-toolbox/tag/computer-use/GET/computeruse/display/windows}

**Get windows information**

Get information about all open windows

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | WindowsResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/computeruse/keyboard/hotkey` {#daytona-toolbox/tag/computer-use/POST/computeruse/keyboard/hotkey}

**Press hotkey**

Press a hotkey combination (e.g., ctrl+c, cmd+v)

### Request Body

Hotkey press request

Schema: **KeyboardHotkeyRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `keys` | string | No | e.g., "ctrl+c", "cmd+v" |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | Empty |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/computeruse/keyboard/key` {#daytona-toolbox/tag/computer-use/POST/computeruse/keyboard/key}

**Press key**

Press a key with optional modifiers

### Request Body

Key press request

Schema: **KeyboardPressRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | No |  |
| `modifiers` | array of string | No | ctrl, alt, shift, cmd |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | Empty |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/computeruse/keyboard/type` {#daytona-toolbox/tag/computer-use/POST/computeruse/keyboard/type}

**Type text**

Type text with optional delay between keystrokes

### Request Body

Text typing request

Schema: **KeyboardTypeRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `delay` | integer | No | milliseconds between keystrokes |
| `text` | string | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | Empty |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/computeruse/mouse/click` {#daytona-toolbox/tag/computer-use/POST/computeruse/mouse/click}

**Click mouse button**

Click the mouse button at the specified coordinates

### Request Body

Mouse click request

Schema: **MouseClickRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `button` | string | No | left, right, middle |
| `double` | boolean | No |  |
| `x` | integer | No |  |
| `y` | integer | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | MouseClickResponse |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/computeruse/mouse/drag` {#daytona-toolbox/tag/computer-use/POST/computeruse/mouse/drag}

**Drag mouse**

Drag the mouse from start to end coordinates

### Request Body

Mouse drag request

Schema: **MouseDragRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `button` | string | No |  |
| `endX` | integer | No |  |
| `endY` | integer | No |  |
| `startX` | integer | No |  |
| `startY` | integer | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | MouseDragResponse |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/computeruse/mouse/move` {#daytona-toolbox/tag/computer-use/POST/computeruse/mouse/move}

**Move mouse cursor**

Move the mouse cursor to the specified coordinates

### Request Body

Mouse move request

Schema: **MouseMoveRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `x` | integer | No |  |
| `y` | integer | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | MousePositionResponse |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/computeruse/mouse/position` {#daytona-toolbox/tag/computer-use/GET/computeruse/mouse/position}

**Get mouse position**

Get the current mouse cursor position

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | MousePositionResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/computeruse/mouse/scroll` {#daytona-toolbox/tag/computer-use/POST/computeruse/mouse/scroll}

**Scroll mouse wheel**

Scroll the mouse wheel at the specified coordinates

### Request Body

Mouse scroll request

Schema: **MouseScrollRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | integer | No |  |
| `direction` | string | No | up, down |
| `x` | integer | No |  |
| `y` | integer | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ScrollResponse |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/computeruse/process-status` {#daytona-toolbox/tag/computer-use/GET/computeruse/process-status}

**Get computer use process status**

Get the status of all computer use processes

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ComputerUseStatusResponse |

---

## GET `/computeruse/process/{processName}/errors` {#daytona-toolbox/tag/computer-use/GET/computeruse/process/{processName}/errors}

**Get process errors**

Get errors for a specific computer use process

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `processName` | path | string | Yes | Process name to get errors for |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ProcessErrorsResponse |

---

## GET `/computeruse/process/{processName}/logs` {#daytona-toolbox/tag/computer-use/GET/computeruse/process/{processName}/logs}

**Get process logs**

Get logs for a specific computer use process

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `processName` | path | string | Yes | Process name to get logs for |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ProcessLogsResponse |

---

## POST `/computeruse/process/{processName}/restart` {#daytona-toolbox/tag/computer-use/POST/computeruse/process/{processName}/restart}

**Restart specific process**

Restart a specific computer use process

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `processName` | path | string | Yes | Process name to restart |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ProcessRestartResponse |

---

## GET `/computeruse/process/{processName}/status` {#daytona-toolbox/tag/computer-use/GET/computeruse/process/{processName}/status}

**Get specific process status**

Check if a specific computer use process is running

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `processName` | path | string | Yes | Process name to check |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ProcessStatusResponse |

---

## GET `/computeruse/recordings` {#daytona-toolbox/tag/computer-use/GET/computeruse/recordings}

**List all recordings**

Get a list of all recordings (active and completed)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ListRecordingsResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/computeruse/recordings/start` {#daytona-toolbox/tag/computer-use/POST/computeruse/recordings/start}

**Start a new recording**

Start a new screen recording session

### Request Body

Recording options

Schema: **StartRecordingRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Created | Recording |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |
| 503 | Service Unavailable | ErrorResponse |

---

## POST `/computeruse/recordings/stop` {#daytona-toolbox/tag/computer-use/POST/computeruse/recordings/stop}

**Stop a recording**

Stop an active screen recording session

### Request Body

Recording ID to stop

Schema: **StopRecordingRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | Recording |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/computeruse/recordings/{id}` {#daytona-toolbox/tag/computer-use/GET/computeruse/recordings/{id}}

**Get recording details**

Get details of a specific recording by ID

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `id` | path | string | Yes | Recording ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | Recording |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## DELETE `/computeruse/recordings/{id}` {#daytona-toolbox/tag/computer-use/DELETE/computeruse/recordings/{id}}

**Delete a recording**

Delete a recording file by ID

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `id` | path | string | Yes | Recording ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | No Content |  |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 409 | Conflict | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/computeruse/recordings/{id}/download` {#daytona-toolbox/tag/computer-use/GET/computeruse/recordings/{id}/download}

**Download a recording**

Download a recording by providing its ID

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `id` | path | string | Yes | Recording ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | string |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/computeruse/screenshot` {#daytona-toolbox/tag/computer-use/GET/computeruse/screenshot}

**Take a screenshot**

Take a screenshot of the entire screen

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `showCursor` | query | boolean | No | Whether to show cursor in screenshot |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ScreenshotResponse |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/computeruse/screenshot/compressed` {#daytona-toolbox/tag/computer-use/GET/computeruse/screenshot/compressed}

**Take a compressed screenshot**

Take a compressed screenshot of the entire screen

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `showCursor` | query | boolean | No | Whether to show cursor in screenshot |
| `format` | query | string | No | Image format (png or jpeg) |
| `quality` | query | integer | No | JPEG quality (1-100) |
| `scale` | query | number | No | Scale factor (0.1-1.0) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ScreenshotResponse |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/computeruse/screenshot/region` {#daytona-toolbox/tag/computer-use/GET/computeruse/screenshot/region}

**Take a region screenshot**

Take a screenshot of a specific region of the screen

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `x` | query | integer | Yes | X coordinate of the region |
| `y` | query | integer | Yes | Y coordinate of the region |
| `width` | query | integer | Yes | Width of the region |
| `height` | query | integer | Yes | Height of the region |
| `showCursor` | query | boolean | No | Whether to show cursor in screenshot |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ScreenshotResponse |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/computeruse/screenshot/region/compressed` {#daytona-toolbox/tag/computer-use/GET/computeruse/screenshot/region/compressed}

**Take a compressed region screenshot**

Take a compressed screenshot of a specific region of the screen

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `x` | query | integer | Yes | X coordinate of the region |
| `y` | query | integer | Yes | Y coordinate of the region |
| `width` | query | integer | Yes | Width of the region |
| `height` | query | integer | Yes | Height of the region |
| `showCursor` | query | boolean | No | Whether to show cursor in screenshot |
| `format` | query | string | No | Image format (png or jpeg) |
| `quality` | query | integer | No | JPEG quality (1-100) |
| `scale` | query | number | No | Scale factor (0.1-1.0) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ScreenshotResponse |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/computeruse/start` {#daytona-toolbox/tag/computer-use/POST/computeruse/start}

**Start computer use processes**

Start all computer use processes and return their status

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ComputerUseStartResponse |

---

## GET `/computeruse/status` {#daytona-toolbox/tag/computer-use/GET/computeruse/status}

**Get computer use status**

Get the current status of the computer use system

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ComputerUseStatusResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/computeruse/stop` {#daytona-toolbox/tag/computer-use/POST/computeruse/stop}

**Stop computer use processes**

Stop all computer use processes and return their status

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ComputerUseStopResponse |

---
