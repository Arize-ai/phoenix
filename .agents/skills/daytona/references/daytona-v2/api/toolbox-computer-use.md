# Toolbox API: computer-use

Desktop automation. Requests return 503 `ADDON_UNAVAILABLE` when desktop automation is unavailable.

## Contents

- [Find accessibility nodes](#find-accessibility-nodes)
- [Focus an accessibility node](#focus-an-accessibility-node)
- [Invoke an accessibility node](#invoke-an-accessibility-node)
- [Set an accessibility node value](#set-an-accessibility-node-value)
- [Accessibility tree](#accessibility-tree)
- [Display inventory](#display-inventory)
- [Window inventory](#window-inventory)
- [Press a hotkey](#press-a-hotkey)
- [Press one key](#press-one-key)
- [Type text](#type-text)
- [Click the mouse](#click-the-mouse)
- [Drag the mouse](#drag-the-mouse)
- [Move the mouse](#move-the-mouse)
- [Mouse position](#mouse-position)
- [Scroll the mouse wheel](#scroll-the-mouse-wheel)
- [Desktop process inventory](#desktop-process-inventory)
- [One desktop process stderr](#one-desktop-process-stderr)
- [One desktop process stdout](#one-desktop-process-stdout)
- [Restart one desktop process](#restart-one-desktop-process)
- [One desktop process status](#one-desktop-process-status)
- [List recordings](#list-recordings)
- [Start a recording](#start-a-recording)
- [Stop a recording](#stop-a-recording)
- [Get recording metadata](#get-recording-metadata)
- [Delete a recording](#delete-a-recording)
- [Download a recording](#download-a-recording)
- [Restart the desktop](#restart-the-desktop)
- [Full screenshot](#full-screenshot)
- [Compressed full screenshot](#compressed-full-screenshot)
- [Region screenshot](#region-screenshot)
- [Compressed region screenshot](#compressed-region-screenshot)
- [Start the desktop](#start-the-desktop)
- [Desktop status](#desktop-status)
- [Stop the desktop](#stop-the-desktop)

## Find accessibility nodes

`POST /computeruse/a11y/find`

Searches accessibility nodes within the requested scope.

### Request Body

`application/json`: [ComputerUseA11yFindRequest](./toolbox-schemas.md#computerusea11yfindrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | integer (int64) \| null | No | Maximum number of matches. Omitted or `<=0` uses the platform default. |
| `name` | string | No | Name filter. Omitted = any name. |
| `nameMatch` | string | No | Name match mode: `exact`, `substring`, or `regex`. |
| `pid` | integer (int64) \| null | No | Owning process id when `scope=pid`. |
| `role` | string | No | Exact role filter. Omitted = any role. |
| `scope` | string | No | Scope selector: omitted or `focused` for the focused window, `pid` for one process, or `all` for all windows. |
| `states` | array of string | No | Required state names. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseA11yFindResponse](./toolbox-schemas.md#computerusea11yfindresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid accessibility filters or request body | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `NOT_FOUND` — no accessibility root or node matched the requested scope | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Focus an accessibility node

`POST /computeruse/a11y/node/focus`

Moves desktop focus to the requested accessibility node.

### Request Body

`application/json`: [ComputerUseA11yNodeRequest](./toolbox-schemas.md#computerusea11ynoderequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string \| null | No | Optional action name for invoke requests. |
| `id` | string | Yes | The stable node id returned by tree/find. |
| `value` | string \| null | No | Optional text value for editable nodes. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Node focused |  |
| 400 | `BAD_REQUEST` — invalid node id or unsupported node action | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `NOT_FOUND` — no such accessibility node | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Invoke an accessibility node

`POST /computeruse/a11y/node/invoke`

Invokes the requested accessibility node action.

### Request Body

`application/json`: [ComputerUseA11yNodeRequest](./toolbox-schemas.md#computerusea11ynoderequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string \| null | No | Optional action name for invoke requests. |
| `id` | string | Yes | The stable node id returned by tree/find. |
| `value` | string \| null | No | Optional text value for editable nodes. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Node invoked |  |
| 400 | `BAD_REQUEST` — invalid node id or unsupported node action | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `NOT_FOUND` — no such accessibility node | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Set an accessibility node value

`POST /computeruse/a11y/node/value`

Sets the editable value of the requested accessibility node.

### Request Body

`application/json`: [ComputerUseA11yNodeRequest](./toolbox-schemas.md#computerusea11ynoderequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string \| null | No | Optional action name for invoke requests. |
| `id` | string | Yes | The stable node id returned by tree/find. |
| `value` | string \| null | No | Optional text value for editable nodes. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Node value set |  |
| 400 | `BAD_REQUEST` — invalid node id or unsupported node action | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `NOT_FOUND` — no such accessibility node | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Accessibility tree

`GET /computeruse/a11y/tree`

Returns an accessibility tree rooted at the requested scope.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `scope` | query | string | No | Scope selector: omitted or `focused` for the focused window, `pid` for one process, or `all` for all windows. |
| `pid` | query | integer (int64) | No | Owning process id when `scope=pid`. |
| `maxDepth` | query | integer (int64) | No | Maximum tree depth. Omitted or `-1` means unbounded. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseA11yTreeResponse](./toolbox-schemas.md#computerusea11ytreeresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid accessibility scope or query parameters | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `NOT_FOUND` — no accessibility root or node matched the requested scope | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Display inventory

`GET /computeruse/display/info`

Returns the current display/monitor list.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseDisplayInfoResponse](./toolbox-schemas.md#computerusedisplayinforesponse) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Window inventory

`GET /computeruse/display/windows`

Returns the current top-level window list.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseDisplayWindowsResponse](./toolbox-schemas.md#computerusedisplaywindowsresponse) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Press a hotkey

`POST /computeruse/keyboard/hotkey`

Presses a `+`-delimited hotkey chord.

### Request Body

`application/json`: [ComputerUseKeyboardHotkeyRequest](./toolbox-schemas.md#computerusekeyboardhotkeyrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `keys` | string | Yes | `+`-delimited chord string. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Hotkey pressed |  |
| 400 | `BAD_REQUEST` — invalid request body fields or unsupported key/modifier values | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Press one key

`POST /computeruse/keyboard/key`

Presses one key with optional modifiers.

### Request Body

`application/json`: [ComputerUseKeyboardKeyRequest](./toolbox-schemas.md#computerusekeyboardkeyrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | The main key name. |
| `modifiers` | array of string | No | Modifier key names held while pressing `key`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Key pressed |  |
| 400 | `BAD_REQUEST` — invalid request body fields or unsupported key/modifier values | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Type text

`POST /computeruse/keyboard/type`

Types UTF-8 text into the desktop.

### Request Body

`application/json`: [ComputerUseKeyboardTypeRequest](./toolbox-schemas.md#computerusekeyboardtyperequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `delay` | integer (int64) | No | Delay in milliseconds between key presses. Omitted = `0`. |
| `text` | string | Yes | UTF-8 text to type. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Text typed |  |
| 400 | `BAD_REQUEST` — invalid request body fields or unsupported text for the current desktop keymap | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Click the mouse

`POST /computeruse/mouse/click`

Moves the cursor and clicks the requested mouse button.

### Request Body

`application/json`: [ComputerUseMouseClickRequest](./toolbox-schemas.md#computerusemouseclickrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `button` | string | No | Button name (`left`, `middle`, `right`). Omitted = `left`. |
| `double` | boolean | No | Whether to double-click instead of single-clicking. |
| `x` | integer (int64) | Yes | Target X coordinate in desktop pixels. |
| `y` | integer (int64) | Yes | Target Y coordinate in desktop pixels. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUsePoint](./toolbox-schemas.md#computerusepoint) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid request body fields or unsupported button values | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Drag the mouse

`POST /computeruse/mouse/drag`

Presses a mouse button, drags between two coordinates, and releases it.

### Request Body

`application/json`: [ComputerUseMouseDragRequest](./toolbox-schemas.md#computerusemousedragrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `button` | string | No | Button name (`left`, `middle`, `right`). Omitted = `left`. |
| `endX` | integer (int64) | Yes | Drag end X coordinate in desktop pixels. |
| `endY` | integer (int64) | Yes | Drag end Y coordinate in desktop pixels. |
| `startX` | integer (int64) | Yes | Drag start X coordinate in desktop pixels. |
| `startY` | integer (int64) | Yes | Drag start Y coordinate in desktop pixels. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUsePoint](./toolbox-schemas.md#computerusepoint) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid request body fields or unsupported button values | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Move the mouse

`POST /computeruse/mouse/move`

Moves the cursor to the requested desktop coordinates.

### Request Body

`application/json`: [ComputerUseMouseMoveRequest](./toolbox-schemas.md#computerusemousemoverequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `x` | integer (int64) | Yes | Target X coordinate in desktop pixels. |
| `y` | integer (int64) | Yes | Target Y coordinate in desktop pixels. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUsePoint](./toolbox-schemas.md#computerusepoint) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid request body fields or unsupported coordinates | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Mouse position

`GET /computeruse/mouse/position`

Returns the current cursor position.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUsePoint](./toolbox-schemas.md#computerusepoint) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Scroll the mouse wheel

`POST /computeruse/mouse/scroll`

Moves the cursor and scrolls the wheel at the requested position.

### Request Body

`application/json`: [ComputerUseMouseScrollRequest](./toolbox-schemas.md#computerusemousescrollrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | integer (int64) \| null | No | Number of wheel steps. Omitted = `1`. |
| `direction` | string | Yes | Scroll direction (`up` or `down`). |
| `x` | integer (int64) | Yes | Target X coordinate in desktop pixels. |
| `y` | integer (int64) | Yes | Target Y coordinate in desktop pixels. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseScrollResponse](./toolbox-schemas.md#computerusescrollresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid request body fields or unsupported direction values | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Desktop process inventory

`GET /computeruse/process-status`

Returns the state of every desktop automation process.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseProcessStatusMap](./toolbox-schemas.md#computeruseprocessstatusmap) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## One desktop process stderr

`GET /computeruse/process/{name}/errors`

Returns available stderr/error logs for one desktop automation process.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `name` | path | string | Yes | Desktop process name |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseProcessErrorsResponse](./toolbox-schemas.md#computeruseprocesserrorsresponse) (`application/json`) |
| 404 | `NOT_FOUND` — no such desktop process | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## One desktop process stdout

`GET /computeruse/process/{name}/logs`

Returns available stdout logs for one desktop automation process.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `name` | path | string | Yes | Desktop process name |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseProcessLogsResponse](./toolbox-schemas.md#computeruseprocesslogsresponse) (`application/json`) |
| 404 | `NOT_FOUND` — no such desktop process | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Restart one desktop process

`POST /computeruse/process/{name}/restart`

Restarts one desktop automation process when the desktop is ready.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `name` | path | string | Yes | Desktop process name |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseProcessRestartResponse](./toolbox-schemas.md#computeruseprocessrestartresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — the requested process cannot be restarted individually | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `NOT_FOUND` — no such desktop process | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## One desktop process status

`GET /computeruse/process/{name}/status`

Returns the running state of one desktop automation process.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `name` | path | string | Yes | Desktop process name |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseProcessRunningStatus](./toolbox-schemas.md#computeruseprocessrunningstatus) (`application/json`) |
| 404 | `NOT_FOUND` — no such desktop process | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## List recordings

`GET /computeruse/recordings`

Returns live and retained recording metadata.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseRecordingsResponse](./toolbox-schemas.md#computeruserecordingsresponse) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Start a recording

`POST /computeruse/recordings/start`

Starts a desktop recording and returns its metadata.

### Request Body

`application/json`: [ComputerUseRecordingStartRequest](./toolbox-schemas.md#computeruserecordingstartrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string \| null | No | Optional label used as the filename prefix. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseRecording](./toolbox-schemas.md#computeruserecording) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid request body fields or recording limits were exceeded | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Stop a recording

`POST /computeruse/recordings/stop`

Stops a recording and returns its terminal metadata.

### Request Body

`application/json`: [ComputerUseRecordingStopRequest](./toolbox-schemas.md#computeruserecordingstoprequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | The recording id. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseRecording](./toolbox-schemas.md#computeruserecording) (`application/json`) |
| 404 | `NOT_FOUND` — no such recording | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | `INTERNAL_SERVER_ERROR` — recording finalization failed | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Get recording metadata

`GET /computeruse/recordings/{id}`

Returns metadata for one recording.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Recording id |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseRecording](./toolbox-schemas.md#computeruserecording) (`application/json`) |
| 404 | `NOT_FOUND` — no such recording | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Delete a recording

`DELETE /computeruse/recordings/{id}`

Deletes a recording and its retained file.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Recording id |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Recording deleted |  |
| 404 | `NOT_FOUND` — no such recording | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | `INTERNAL_SERVER_ERROR` — recording cleanup failed | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Download a recording

`GET /computeruse/recordings/{id}/download`

Streams one recording file as `video/mp4`.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Recording id |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Recording file stream | `video/mp4` |
| 404 | `NOT_FOUND` — no such recording or recording file | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Restart the desktop

`POST /computeruse/restart`

Restarts the desktop and returns its ready status. The body is optional: `resolution` restarts the desktop at that size (1024x768, 1280x720 or 1920x1080) and keeps it for later starts; omitted, the desktop restarts at its current resolution. Linux only: other platforms refuse a `resolution`.

### Request Body

`application/json`: null \| [ComputerUseStartRequest](./toolbox-schemas.md#computerusestartrequest)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseRestartResponse](./toolbox-schemas.md#computeruserestartresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — unsupported resolution; `UNSUPPORTED_OPERATION` — this platform cannot set the resolution | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `CONFLICT` — a concurrent restart brought the desktop up at a different resolution; retry the restart | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 413 | `PAYLOAD_TOO_LARGE` — the body exceeds the JSON body limit | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` — a non-empty body without `Content-Type: application/json` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | `INTERNAL_SERVER_ERROR` — the desktop state could not be updated | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Full screenshot

`GET /computeruse/screenshot`

Captures the full desktop and returns base64-encoded image bytes in JSON.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `show_cursor` | query | string | No | Whether to include the current cursor position in the JSON response. |
| `showCursor` | query | string | No | Accepted camelCase alias for `show_cursor`. |
| `format` | query | string | No | Image format for compressed screenshot routes. Omitted = `png`. |
| `quality` | query | string | No | JPEG quality for compressed screenshot routes. Omitted = `85`. |
| `scale` | query | string | No | Downscale factor for compressed screenshot routes. Omitted = `1.0`. |
| `x` | query | string | No | Region left coordinate for region routes. |
| `y` | query | string | No | Region top coordinate for region routes. |
| `width` | query | string | No | Region width for region routes. Must be greater than zero. |
| `height` | query | string | No | Region height for region routes. Must be greater than zero. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseScreenshotResponse](./toolbox-schemas.md#computerusescreenshotresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid screenshot query parameters | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | `INTERNAL_SERVER_ERROR` — the screenshot could not be captured | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Compressed full screenshot

`GET /computeruse/screenshot/compressed`

Captures the full desktop and applies format, quality, and scale controls before returning JSON.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `show_cursor` | query | string | No | Whether to include the current cursor position in the JSON response. |
| `showCursor` | query | string | No | Accepted camelCase alias for `show_cursor`. |
| `format` | query | string | No | Image format for compressed screenshot routes. Omitted = `png`. |
| `quality` | query | string | No | JPEG quality for compressed screenshot routes. Omitted = `85`. |
| `scale` | query | string | No | Downscale factor for compressed screenshot routes. Omitted = `1.0`. |
| `x` | query | string | No | Region left coordinate for region routes. |
| `y` | query | string | No | Region top coordinate for region routes. |
| `width` | query | string | No | Region width for region routes. Must be greater than zero. |
| `height` | query | string | No | Region height for region routes. Must be greater than zero. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseScreenshotResponse](./toolbox-schemas.md#computerusescreenshotresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid screenshot query parameters | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | `INTERNAL_SERVER_ERROR` — the screenshot could not be captured | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Region screenshot

`GET /computeruse/screenshot/region`

Captures a rectangular desktop region and returns base64-encoded image bytes in JSON.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `show_cursor` | query | string | No | Whether to include the current cursor position in the JSON response. |
| `showCursor` | query | string | No | Accepted camelCase alias for `show_cursor`. |
| `format` | query | string | No | Image format for compressed screenshot routes. Omitted = `png`. |
| `quality` | query | string | No | JPEG quality for compressed screenshot routes. Omitted = `85`. |
| `scale` | query | string | No | Downscale factor for compressed screenshot routes. Omitted = `1.0`. |
| `x` | query | string | No | Region left coordinate for region routes. |
| `y` | query | string | No | Region top coordinate for region routes. |
| `width` | query | string | No | Region width for region routes. Must be greater than zero. |
| `height` | query | string | No | Region height for region routes. Must be greater than zero. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseScreenshotResponse](./toolbox-schemas.md#computerusescreenshotresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid screenshot query parameters | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | `INTERNAL_SERVER_ERROR` — the screenshot could not be captured | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Compressed region screenshot

`GET /computeruse/screenshot/region/compressed`

Captures a rectangular desktop region and applies format, quality, and scale controls before returning JSON.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `show_cursor` | query | string | No | Whether to include the current cursor position in the JSON response. |
| `showCursor` | query | string | No | Accepted camelCase alias for `show_cursor`. |
| `format` | query | string | No | Image format for compressed screenshot routes. Omitted = `png`. |
| `quality` | query | string | No | JPEG quality for compressed screenshot routes. Omitted = `85`. |
| `scale` | query | string | No | Downscale factor for compressed screenshot routes. Omitted = `1.0`. |
| `x` | query | string | No | Region left coordinate for region routes. |
| `y` | query | string | No | Region top coordinate for region routes. |
| `width` | query | string | No | Region width for region routes. Must be greater than zero. |
| `height` | query | string | No | Region height for region routes. Must be greater than zero. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseScreenshotResponse](./toolbox-schemas.md#computerusescreenshotresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid screenshot query parameters | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is not ready for actions | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | `INTERNAL_SERVER_ERROR` — the screenshot could not be captured | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Start the desktop

`POST /computeruse/start`

Starts the desktop and returns its process statuses. The body is optional: `resolution` selects the desktop size (1024x768, 1280x720 or 1920x1080), kept for later starts and restarts; omitted, the desktop uses the resolution last selected, or 1280x720. Starting a running desktop at a different resolution is refused; restart it with the new one instead. Linux only: other platforms refuse a `resolution`.

### Request Body

`application/json`: null \| [ComputerUseStartRequest](./toolbox-schemas.md#computerusestartrequest)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseLifecycleResponse](./toolbox-schemas.md#computeruselifecycleresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — unsupported resolution; `UNSUPPORTED_OPERATION` — this platform cannot set the resolution | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `DESKTOP_NOT_READY` — the desktop is already starting or failed and needs restart; `CONFLICT` — the desktop is running at a different resolution | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 413 | `PAYLOAD_TOO_LARGE` — the body exceeds the JSON body limit | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` — a non-empty body without `Content-Type: application/json` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match the request schema | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | `INTERNAL_SERVER_ERROR` — the desktop operation failed | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Desktop status

`GET /computeruse/status`

Returns the desktop state and activity `status`.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseStatusResponse](./toolbox-schemas.md#computerusestatusresponse) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Stop the desktop

`POST /computeruse/stop`

Stops the desktop and returns its final process statuses.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ComputerUseLifecycleResponse](./toolbox-schemas.md#computeruselifecycleresponse) (`application/json`) |
| 500 | `INTERNAL_SERVER_ERROR` — the desktop operation failed | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `ADDON_UNAVAILABLE` — desktop automation is unavailable | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---
