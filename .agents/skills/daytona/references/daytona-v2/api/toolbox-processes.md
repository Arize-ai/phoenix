# Toolbox API: processes

Exec, PTY and code processes, their logs, stdin, signals and lifecycle.

## Contents

- [List processes](#list-processes)
- [Create a process](#create-a-process)
- [Get a process](#get-a-process)
- [Delete a process record](#delete-a-process-record)
- [Attach a websocket to a process](#attach-a-websocket-to-a-process)
- [Read process logs or follow them as SSE](#read-process-logs-or-follow-them-as-sse)
- [Resize a PTY](#resize-a-pty)
- [Signal a process](#signal-a-process)
- [Write process stdin](#write-process-stdin)
- [Wait for process completion](#wait-for-process-completion)
- [Kill every process with a tag](#kill-every-process-with-a-tag)

## List processes

`GET /processes`

List process records, optionally filtered by state, kind, session, name, pid, or tag.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `state` | query | string | No | `running`, `terminal`, or `all` (the default when omitted). |
| `kind` | query | [Kind](./toolbox-schemas.md#kind) | No | Filter by process kind. |
| `sessionId` | query | string | No | Filter by the session a process ran in (`kind=session` process id or interpreter context id). |
| `name` | query | string | No | Filter by live name alias. |
| `pid` | query | integer (int32) | No | Filter by OS process id. |
| `tag` | query | string | No | Filter by tag. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ProcessListResponse](./toolbox-schemas.md#processlistresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid filter value. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Create a process

`POST /processes`

Launch an exec, PTY, or code process. `waitMs` waits for completion or timeout; `logs=text|base64` includes the first log page and requires `waitMs`.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `waitMs` | query | integer (int64) | No | Wait up to this many milliseconds before replying; timing out still returns 201 with a running record. |
| `logs` | query | string | No | Inline the first logs page using `text` or `base64`; requires `waitMs`. Both encodings behave as on `GET /processes/{id}/logs`: `text` keeps UTF-8 characters split across frames whole, and `base64` uses the standard RFC 4648 section 4 alphabet (`+/`) with `=` padding. |

### Request Body

`application/json`: [CreateProcessRequest](./toolbox-schemas.md#createprocessrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `argv` | array of string \| null | No | argv mode. Exactly one of `argv`, `shellCommand`, or `code` may be present. |
| `code` | string \| null | No | Code to execute in an interpreter session. |
| `cwd` | string \| null | No | Optional working directory. For `exec` and `pty`, defaults to the configured user’s home when available. Code execution, an explicit `user`, or an unavailable home uses the sandbox’s default working directory. |
| `env` | map of string | No | Environment overrides applied at spawn time. PTY processes default to `TERM=xterm-256color`; an explicit TERM overrides the default. |
| `keepLogs` | null \| [KeepLogs](./toolbox-schemas.md#keeplogs) | No |  |
| `kind` | null \| [Kind](./toolbox-schemas.md#kind) | No |  |
| `language` | string \| null | No | Code language, exactly `python`, `typescript` or `javascript` (case-sensitive). Unknown values, including an empty string, answer 400 `UNSUPPORTED_OPERATION` before provisioning. Omit when using an explicit session's language; without `sessionId`, omission answers 400 `BAD_REQUEST`. |
| `login` | boolean | No | Whether to request a login shell. |
| `name` | string \| null | No | Optional live-only alias. Must be a safe identifier. |
| `sessionId` | string \| null | No | The session to run in. For `kind=exec`: the id or live name of a `kind=session` process; the `shellCommand` runs inside its shell, one command at a time, in order, and the request refuses `argv`, `cwd`, `env`, `shell`, `login: true`, `user` and `tag` (the session's settings apply; the command takes the session's tag). Unknown ids answer `SESSION_NOT_FOUND` (sessions are never created on first use) and an ended or deleted session answers `SESSION_ENDED`. For `kind=code`: the interpreter context to execute in. |
| `shell` | string \| null | No | Requested shell path or shell name. For `kind=session` on Linux and macOS it must be a POSIX shell (bash, sh, dash, zsh, ksh): the session answers 400 `PROCESS_START_FAILED` when the shell does not run POSIX commands within 5 s of starting. |
| `shellCommand` | string \| null | No | Shell command to execute. |
| `stdin` | null \| [StdinMode](./toolbox-schemas.md#stdinmode) | No |  |
| `tag` | string \| null | No | Optional tag, a safe identifier (`[A-Za-z0-9._-]`, 1-128 characters, not `.` or `..`) that groups this process with others for `GET /processes?tag=` and `POST /processes:kill`. Applies to `kind=exec`, `pty` and `session`. `kind=code` refuses it, and so does a command run in a session, which takes the session's tag. |
| `terminal` | null \| [TerminalSize](./toolbox-schemas.md#terminalsize) | No |  |
| `timeoutMs` | integer (int64) \| null | No | Per-process execution timeout in milliseconds. Omitted or 0 means no limit. Positive timeouts apply to exec and PTY processes (including exec commands in a shell session); code executions and shell-session creation refuse positive timeouts. For a session command, the timeout starts when execution begins, excluding time queued behind earlier commands. On expiry the command is stopped if possible. If it has not stopped after a further 5 seconds, the session and its background processes are ended. |
| `user` | string \| null | No | Optional execution user. Not supported for `kind=code`; returns 400 `UNSUPPORTED_OPERATION`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Created process record. When `waitMs` and `logs` are requested, the response includes the inline `logs` page. | [ProcessDto](./toolbox-schemas.md#processdto) (`application/json`) |
| 400 | `BAD_REQUEST`, `PROCESS_START_FAILED`, or `UNSUPPORTED_OPERATION` — invalid create shape, shell/session misuse, startup failure, or unsupported code language. Code languages are python, typescript and javascript (case-sensitive); unknown or empty language is UNSUPPORTED_OPERATION, rejected before kernel provisioning. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `SESSION_NOT_FOUND` — the requested session does not exist. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `NAME_CONFLICT` — the requested process or implicit-session name is already in use. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 410 | `SESSION_ENDED` — the requested session existed but has ended. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body was well-formed but did not match `CreateProcessRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `KERNEL_UNAVAILABLE` — a supported language's kernel failed to install or start. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Get a process

`GET /processes/{id}`

Fetch a process by stable id or by its live alias.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Process id or live alias. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ProcessDto](./toolbox-schemas.md#processdto) (`application/json`) |
| 404 | `PROCESS_NOT_FOUND` — no such process or alias. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Delete a process record

`DELETE /processes/{id}`

Delete a process record and purge its logs. System processes stay protected.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Process id or live alias. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Process record deleted. |  |
| 400 | `UNSUPPORTED_OPERATION` — the process cannot be cleaned up in its current state. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `PROTECTED_PROCESS` — protected system processes cannot be cleaned up. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `PROCESS_NOT_FOUND` — no such process or alias. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Attach a websocket to a process

`GET /processes/{id}/attach`

Open a WebSocket for live output and stdin. Clients that cannot send an Authorization header may send the sandbox access token in the `daytona_token` query parameter. With `cursor`, available logs through the connection time are replayed before live output. Invalid or expired cursors cause WebSocket policy close `1008`, not an HTTP error.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Process id or live alias. |
| `cursor` | query | string | No | Optional logs cursor to replay before switching to live websocket output. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 101 | Websocket upgrade accepted. |  |
| 404 | `PROCESS_NOT_FOUND` — no such process or alias. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Read process logs or follow them as SSE

`GET /processes/{id}/logs`

Returns a JSON page by default, or an SSE stream when `follow=true`. SSE event names are `log`, `state`, `warning`, `error`, and `eof`; `Last-Event-ID` resumes from the last seen cursor.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Process id or live alias. |
| `cursor` | query | string | No | Resume after this cursor. Empty or omitted starts from the beginning. |
| `limit` | query | integer | No | Page size for JSON reads; clamped by the API. |
| `encoding` | query | string | No | Payload encoding: `text` (default) or `base64`. `text` decodes each channel as UTF-8 across frames: a character split between frames appears whole in the frame that holds its last byte, so concatenating a channel's frames reproduces its output. Bytes that are not valid UTF-8 become U+FFFD, and an incomplete character at the very end of a channel's output is omitted. `base64` returns each frame's exact bytes, using the standard RFC 4648 section 4 alphabet (`+/`) with `=` padding, including SSE follow frames. |
| `follow` | query | boolean | No | When true, answer an SSE follow stream instead of a JSON page. |
| `Last-Event-ID` | header | string \| null | No | Optional resume cursor for SSE reconnects; wins over the `cursor` query parameter. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | JSON log page (`application/json`) when `follow` is absent or false; SSE stream (`text/event-stream`) when `follow=true`: `log` carries `LogFrameDto`, `state` carries `ProcessStateEventDto`, `warning` carries `ProcessWarningEventDto`, `error` carries `ProcessErrorEventDto`, and `eof` carries `ProcessEofEventDto`. | [ProcessLogsResponse](./toolbox-schemas.md#processlogsresponse) (`application/json`); `text/event-stream` |
| 400 | `BAD_REQUEST` or `INVALID_CURSOR` — invalid encoding or invalid resume cursor. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `PROCESS_NOT_FOUND` — no such process or alias. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `CURSOR_EXPIRED` — the requested cursor was evicted by retention and `firstAvailableCursor` names the resume point. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Output logs could not be read. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Resize a PTY

`POST /processes/{id}/resize`

Change the terminal size of a PTY process.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Process id or live alias. |

### Request Body

`application/json`: [ResizeRequest](./toolbox-schemas.md#resizerequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cols` | integer (int32) | Yes | PTY columns; an integer in 1..=65535. Windows: at most 32767. |
| `rows` | integer (int32) | Yes | PTY rows; an integer in 1..=65535. Windows: at most 32767. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | PTY resized. |  |
| 400 | `BAD_REQUEST` or `UNSUPPORTED_OPERATION` — invalid geometry or the process is not a PTY. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `PROCESS_NOT_FOUND` — no such process or alias. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body was well-formed but did not match `ResizeRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal error while resizing the PTY. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Signal a process

`POST /processes/{id}/signals`

Send a signal, optionally with escalation, or interrupt a running code execution. On a Linux sandbox with process containment, `SIGTERM` and `SIGKILL` reach every process the target started, also after the target itself exited: such a request answers `PROCESS_TERMINAL` only once nothing it started is running.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Process id or live alias. |

### Request Body

`application/json`: [SignalRequest](./toolbox-schemas.md#signalrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `escalateAfterMs` | integer (int64) \| null | No | Grace period in milliseconds before escalating. Maximum 600000. |
| `escalateTo` | string \| null | No | Escalation signal name. Defaults to `SIGKILL` when omitted. |
| `signal` | string | No | Signal name such as `SIGTERM`, `SIGKILL`, or `SIGINT`. Empty means `SIGTERM`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Signal accepted. |  |
| 400 | `BAD_REQUEST` or `UNSUPPORTED_OPERATION` — invalid signal request or an unsupported operation for this process kind. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `PROTECTED_PROCESS` — protected system processes cannot be signaled. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `PROCESS_NOT_FOUND` — no such process or alias. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `PROCESS_TERMINAL` — the process has already exited (and, for `SIGTERM` or `SIGKILL` on a sandbox with process containment, nothing it started is still running). | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body was well-formed but did not match `SignalRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal error while signaling the process. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Write process stdin

`POST /processes/{id}/stdin`

Write stdin data and optionally close stdin.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Process id or live alias. |

### Request Body

`application/json`: [StdinRequest](./toolbox-schemas.md#stdinrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | string | No | Data to write. Text by default. With `encoding=base64`, accepts standard RFC 4648 section 4 base64 (`+/`) or base64url (`-_`), padded or unpadded. |
| `encoding` | string \| null | No | Optional payload encoding: `text` (default) or `base64`. |
| `eof` | boolean | No | Whether this request also closes stdin after writing. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | stdin written. |  |
| 400 | `BAD_REQUEST` — invalid encoding or malformed request body. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `PROTECTED_PROCESS` — protected system processes do not accept stdin. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `PROCESS_NOT_FOUND` — no such process or alias. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `PROCESS_TERMINAL`, `STDIN_UNAVAILABLE`, or `STDIN_CLOSED` — stdin can no longer accept bytes. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body was well-formed but did not match `StdinRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal error while writing stdin. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Wait for process completion

`GET /processes/{id}/wait`

Long-poll for the terminal result. Omitted `timeoutMs` keeps the API's default 60-second chunk, `timeoutMs=0` waits until terminal, and any positive value is honored uncapped. Timing out returns `reason: timed_out` without killing the process.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Process id or live alias. |
| `timeoutMs` | query | integer (int64) | No | Long-poll timeout in milliseconds. Omitted means the API's default 60-second chunk; `0` means wait until terminal; any positive value is honored uncapped. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ExitResult](./toolbox-schemas.md#exitresult) (`application/json`) |
| 404 | `PROCESS_NOT_FOUND` — no such process or alias. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Kill every process with a tag

`POST /processes:kill`

Kill every process created with `tag`, and everything those processes started, including descendants that detached and the survivors of tagged processes that already exited. Returns only when none of them is running. Records and logs are kept. The tag can be used again right after the call.

### Request Body

`application/json`: [KillProcessesRequest](./toolbox-schemas.md#killprocessesrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tag` | string | Yes | The tag whose processes to kill: a safe identifier (`[A-Za-z0-9._-]`, 1-128 characters, not `.` or `..`). |
| `timeoutMs` | integer (int64) \| null | No | How long to wait for every killed process to exit, in milliseconds. 1-60000; default 10000. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Every process created under the tag before the call, and everything it started, has exited. A start admitted after the call may be running. | [KillProcessesResponse](./toolbox-schemas.md#killprocessesresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid tag or `timeoutMs`; `UNSUPPORTED_OPERATION` — this sandbox cannot contain processes (macOS, or a Linux guest whose kernel or cgroup mount lacks the support). | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `PROCESS_KILL_INCOMPLETE` — some killed processes were still running when `timeoutMs` expired, or another start or kill under the tag was still in progress so the kill could not begin; call again to retry. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body was well-formed but did not match `KillProcessesRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---
