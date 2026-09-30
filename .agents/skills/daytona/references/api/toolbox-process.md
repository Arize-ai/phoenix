# Process API


## Contents

- POST `/process/code-run`
- POST `/process/execute`
- GET `/process/pty`
- POST `/process/pty`
- GET `/process/pty/{sessionId}`}
- DELETE `/process/pty/{sessionId}`}
- GET `/process/pty/{sessionId}/connect`/connect}
- POST `/process/pty/{sessionId}/resize`/resize}
- GET `/process/session`
- POST `/process/session`
- GET `/process/session/entrypoint`
- GET `/process/session/entrypoint/logs`
- GET `/process/session/{sessionId}`}
- DELETE `/process/session/{sessionId}`}
- GET `/process/session/{sessionId}/command/{commandId}`/command/{commandId}}
- POST `/process/session/{sessionId}/command/{commandId}/input`/command/{commandId}/input}
- GET `/process/session/{sessionId}/command/{commandId}/logs`/command/{commandId}/logs}
- POST `/process/session/{sessionId}/exec`/exec}

## POST `/process/code-run` {#daytona-toolbox/tag/process/POST/process/code-run}

**Execute code**

Execute Python, JavaScript, or TypeScript code and return output, exit code, and artifacts

### Request Body

Code execution request

Schema: **CodeRunRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `argv` | array of string | No |  |
| `code` | string | Yes |  |
| `envs` | object | No |  |
| `language` | string | Yes | python, javascript, typescript |
| `timeout` | integer | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | CodeRunResponse |
| 400 | Bad Request | ErrorResponse |
| 408 | Request Timeout | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/process/execute` {#daytona-toolbox/tag/process/POST/process/execute}

**Execute a command**

Execute a shell command and return the output and exit code

### Request Body

Command execution request

Schema: **ExecuteRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | Yes |  |
| `cwd` | string | No | Current working directory |
| `envs` | object | No | Environment variables to set for the command |
| `timeout` | integer | No | Timeout in seconds, defaults to 10 seconds |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ExecuteResponse |
| 400 | Bad Request | ErrorResponse |
| 408 | Request Timeout | ErrorResponse |

---

## GET `/process/pty` {#daytona-toolbox/tag/process/GET/process/pty}

**List all PTY sessions**

Get a list of all active pseudo-terminal sessions

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | PtyListResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/process/pty` {#daytona-toolbox/tag/process/POST/process/pty}

**Create a new PTY session**

Create a new pseudo-terminal session with specified configuration

### Request Body

PTY session creation request

Schema: **PtyCreateRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cols` | integer | No |  |
| `cwd` | string | No |  |
| `envs` | object | No |  |
| `id` | string | No |  |
| `lazyStart` | boolean | No | Don't start PTY until first client connects |
| `rows` | integer | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Created | PtyCreateResponse |
| 400 | Bad Request | ErrorResponse |
| 409 | Conflict | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/process/pty/{sessionId}` {#daytona-toolbox/tag/process/GET/process/pty/{sessionId}}

**Get PTY session information**

Get detailed information about a specific pseudo-terminal session

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sessionId` | path | string | Yes | PTY session ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | PtySessionInfo |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |

---

## DELETE `/process/pty/{sessionId}` {#daytona-toolbox/tag/process/DELETE/process/pty/{sessionId}}

**Delete a PTY session**

Delete a pseudo-terminal session and terminate its process

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sessionId` | path | string | Yes | PTY session ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | gin.H |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |

---

## GET `/process/pty/{sessionId}/connect` {#daytona-toolbox/tag/process/GET/process/pty/{sessionId}/connect}

**Connect to PTY session via WebSocket**

Establish a WebSocket connection to interact with a pseudo-terminal session

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sessionId` | path | string | Yes | PTY session ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 101 | Switching Protocols - WebSocket connection established |  |
| 400 | Bad Request | ErrorResponse |

---

## POST `/process/pty/{sessionId}/resize` {#daytona-toolbox/tag/process/POST/process/pty/{sessionId}/resize}

**Resize a PTY session**

Resize the terminal dimensions of a pseudo-terminal session

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sessionId` | path | string | Yes | PTY session ID |

### Request Body

Resize request with new dimensions

Schema: **PtyResizeRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cols` | integer | Yes |  |
| `rows` | integer | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | PtySessionInfo |
| 400 | Bad Request | ErrorResponse |
| 410 | Gone | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/process/session` {#daytona-toolbox/tag/process/GET/process/session}

**List all sessions**

Get a list of all active shell sessions

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | array of Session |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/process/session` {#daytona-toolbox/tag/process/POST/process/session}

**Create a new session**

Create a new shell session for command execution

### Request Body

Session creation request

Schema: **CreateSessionRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Created |  |
| 400 | Bad Request | ErrorResponse |
| 409 | Conflict | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/process/session/entrypoint` {#daytona-toolbox/tag/process/GET/process/session/entrypoint}

**Get entrypoint session details**

Get details of an entrypoint session including its commands

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | Session |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/process/session/entrypoint/logs` {#daytona-toolbox/tag/process/GET/process/session/entrypoint/logs}

**Get entrypoint logs**

Get logs for a sandbox entrypoint session. Returns JSON with separated stdout/stderr for SDK >= 0.161.0, plain text otherwise. Supports WebSocket streaming.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `follow` | query | boolean | No | Follow logs in real-time (WebSocket only) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Entrypoint log content | SessionCommandLogsResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/process/session/{sessionId}` {#daytona-toolbox/tag/process/GET/process/session/{sessionId}}

**Get session details**

Get details of a specific session including its commands

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sessionId` | path | string | Yes | Session ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | Session |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## DELETE `/process/session/{sessionId}` {#daytona-toolbox/tag/process/DELETE/process/session/{sessionId}}

**Delete a session**

Delete an existing shell session

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sessionId` | path | string | Yes | Session ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | No Content |  |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/process/session/{sessionId}/command/{commandId}` {#daytona-toolbox/tag/process/GET/process/session/{sessionId}/command/{commandId}}

**Get session command details**

Get details of a specific command within a session

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sessionId` | path | string | Yes | Session ID |
| `commandId` | path | string | Yes | Command ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | Command |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/process/session/{sessionId}/command/{commandId}/input` {#daytona-toolbox/tag/process/POST/process/session/{sessionId}/command/{commandId}/input}

**Send input to command**

Send input data to a running command in a session for interactive execution

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sessionId` | path | string | Yes | Session ID |
| `commandId` | path | string | Yes | Command ID |

### Request Body

Input send request

Schema: **SessionSendInputRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | No Content |  |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 410 | Gone | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/process/session/{sessionId}/command/{commandId}/logs` {#daytona-toolbox/tag/process/GET/process/session/{sessionId}/command/{commandId}/logs}

**Get session command logs**

Get logs for a specific command within a session. Returns JSON with separated stdout/stderr for SDK >= 0.167.0, plain text otherwise. Supports WebSocket streaming.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sessionId` | path | string | Yes | Session ID |
| `commandId` | path | string | Yes | Command ID |
| `follow` | query | boolean | No | Follow logs in real-time (WebSocket only) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Log content (JSON for new SDKs, plain text for old SDKs) | SessionCommandLogsResponse |
| 400 | Bad Request | ErrorResponse |
| 403 | Forbidden | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/process/session/{sessionId}/exec` {#daytona-toolbox/tag/process/POST/process/session/{sessionId}/exec}

**Execute command in session**

Execute a command within an existing shell session

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sessionId` | path | string | Yes | Session ID |

### Request Body

Command execution request

Schema: **SessionExecuteRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `async` | boolean | No |  |
| `command` | string | Yes |  |
| `runAsync` | boolean | No |  |
| `suppressInputEcho` | boolean | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | SessionExecuteResponse |
| 202 | Accepted | SessionExecuteResponse |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 409 | Conflict | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---
