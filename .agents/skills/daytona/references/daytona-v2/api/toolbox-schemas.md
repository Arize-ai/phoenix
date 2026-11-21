# Toolbox API Schemas

## Contents

- [AddRemoteRequest](#addremoterequest)
- [AddRequest](#addrequest)
- [BranchList](#branchlist)
- [BranchRequest](#branchrequest)
- [BulkDownloadRequest](#bulkdownloadrequest)
- [BulkUploadResponse](#bulkuploadresponse)
- [CheckoutRequest](#checkoutrequest)
- [CloneRequest](#clonerequest)
- [CommitInfo](#commitinfo)
- [CommitRequest](#commitrequest)
- [CommitResponse](#commitresponse)
- [ComputerUseA11yFindRequest](#computerusea11yfindrequest)
- [ComputerUseA11yFindResponse](#computerusea11yfindresponse)
- [ComputerUseA11yNodeRequest](#computerusea11ynoderequest)
- [ComputerUseA11yTreeResponse](#computerusea11ytreeresponse)
- [ComputerUseDisplayInfoResponse](#computerusedisplayinforesponse)
- [ComputerUseDisplayWindowsResponse](#computerusedisplaywindowsresponse)
- [ComputerUseKeyboardHotkeyRequest](#computerusekeyboardhotkeyrequest)
- [ComputerUseKeyboardKeyRequest](#computerusekeyboardkeyrequest)
- [ComputerUseKeyboardTypeRequest](#computerusekeyboardtyperequest)
- [ComputerUseLifecycleResponse](#computeruselifecycleresponse)
- [ComputerUseMouseClickRequest](#computerusemouseclickrequest)
- [ComputerUseMouseDragRequest](#computerusemousedragrequest)
- [ComputerUseMouseMoveRequest](#computerusemousemoverequest)
- [ComputerUseMouseScrollRequest](#computerusemousescrollrequest)
- [ComputerUsePoint](#computerusepoint)
- [ComputerUseProcessErrorsResponse](#computeruseprocesserrorsresponse)
- [ComputerUseProcessLogsResponse](#computeruseprocesslogsresponse)
- [ComputerUseProcessRestartResponse](#computeruseprocessrestartresponse)
- [ComputerUseProcessRunningStatus](#computeruseprocessrunningstatus)
- [ComputerUseProcessStatusMap](#computeruseprocessstatusmap)
- [ComputerUseRecording](#computeruserecording)
- [ComputerUseRecordingStartRequest](#computeruserecordingstartrequest)
- [ComputerUseRecordingStopRequest](#computeruserecordingstoprequest)
- [ComputerUseRecordingsResponse](#computeruserecordingsresponse)
- [ComputerUseRestartResponse](#computeruserestartresponse)
- [ComputerUseScreenshotResponse](#computerusescreenshotresponse)
- [ComputerUseScrollResponse](#computerusescrollresponse)
- [ComputerUseStartRequest](#computerusestartrequest)
- [ComputerUseStatusResponse](#computerusestatusresponse)
- [CreateProcessRequest](#createprocessrequest)
- [CreateSessionRequest](#createsessionrequest)
- [DockerStatus](#dockerstatus)
- [EnvRequest](#envrequest)
- [ErrorEnvelope](#errorenvelope)
- [ExitResult](#exitresult)
- [FileInfo](#fileinfo)
- [FindResponse](#findresponse)
- [GitConfigResponse](#gitconfigresponse)
- [InfoResponse](#inforesponse)
- [InitRequest](#initrequest)
- [IsPortInUseResponse](#isportinuseresponse)
- [KeepLogs](#keeplogs)
- [KillProcessesRequest](#killprocessesrequest)
- [KillProcessesResponse](#killprocessesresponse)
- [Kind](#kind)
- [ListRemotesResponse](#listremotesresponse)
- [Metrics](#metrics)
- [PortList](#portlist)
- [ProcessDto](#processdto)
- [ProcessListResponse](#processlistresponse)
- [ProcessLogsResponse](#processlogsresponse)
- [PullVolumeRequest](#pullvolumerequest)
- [PullVolumeResponse](#pullvolumeresponse)
- [ReplaceRequest](#replacerequest)
- [ReplaceResult](#replaceresult)
- [RepoRequest](#reporequest)
- [ResetRequest](#resetrequest)
- [ResizeRequest](#resizerequest)
- [RestoreRequest](#restorerequest)
- [SearchResponse](#searchresponse)
- [SessionDto](#sessiondto)
- [SessionListResponse](#sessionlistresponse)
- [SetConfigRequest](#setconfigrequest)
- [SignalRequest](#signalrequest)
- [StatusResponse](#statusresponse)
- [StdinMode](#stdinmode)
- [StdinRequest](#stdinrequest)
- [TerminalSize](#terminalsize)
- [VersionResponse](#versionresponse)
- [UploadedFile](#uploadedfile)
- [ComputerUseAccessibilityNode](#computeruseaccessibilitynode)
- [ComputerUseDisplay](#computerusedisplay)
- [ComputerUseWindow](#computerusewindow)
- [ComputerUseProcessStatus](#computeruseprocessstatus)
- [ComputerUseActivityStatus](#computeruseactivitystatus)
- [ComputerUseDesktopState](#computerusedesktopstate)
- [ComputerUseResolution](#computeruseresolution)
- [ComputerUseDesktopFailure](#computerusedesktopfailure)
- [DockerOwner](#dockerowner)
- [DockerState](#dockerstate)
- [Reason](#reason)
- [Match](#match)
- [GitRemote](#gitremote)
- [ProcessRecord](#processrecord)
- [LogFrameDto](#logframedto)
- [PullVolumeStatus](#pullvolumestatus)
- [KernelKind](#kernelkind)
- [FileStatus](#filestatus)
- [ComputerUseAccessibilityBounds](#computeruseaccessibilitybounds)
- [ComputerUseDesktopFailureCode](#computerusedesktopfailurecode)
- [State](#state)

## AddRemoteRequest

Add one named remote.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Remote name to create. |
| `path` | string | No | Repository path to operate in. |
| `url` | string | No | Remote URL to store. |

## AddRequest

Stage one or more files.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | No | File paths to stage, relative to the repository root. |
| `path` | string | No | Repository path to run `git add` in. |

## BranchList

Branch list response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branches` | array of string | Yes | Short branch names present in the repository. |

## BranchRequest

Create or delete one named branch.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `force` | boolean | No | Force deletion of an unmerged branch using `git branch -D`. Defaults to false: deletion uses `git branch -d`, refusing an unmerged branch with 409 `CONFLICT`. Ignored when creating a branch. |
| `name` | string | No | Branch name to create or delete. A leading `+` is a literal part of the name, not a refspec force marker. |
| `path` | string | No | Repository path to operate in. |

## BulkDownloadRequest

JSON body for `POST /files/bulk-download`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `paths` | array of string | No | Absolute paths of regular files to stream back as multipart file or error parts. Permission denials and non-regular files discovered before streaming refuse the request. |

## BulkUploadResponse

Partial-success response from `POST /files/bulk-upload`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `errors` | array of string | Yes | Human-readable per-part failures. |
| `files` | array of [UploadedFile](#uploadedfile) | Yes | Successfully written files. |

## CheckoutRequest

Switch the worktree to another branch.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | No | Branch name to switch to. |
| `path` | string | No | Repository path to operate in. |

## CloneRequest

Clone a repository into a target directory.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string \| null | No | Branch to clone when `commit_id` is omitted. A leading `+` is literal. |
| `commit_id` | string \| null | No | Commit to detach to after cloning. |
| `depth` | integer (int32) \| null | No | Optional shallow-clone depth, from 1 through 2147483647. `1` clones only the tip commit. Values representable as u32 but outside this range return 400 `BAD_REQUEST`; invalid JSON types or values outside u32 return 422 `UNPROCESSABLE_ENTITY`. |
| `insecureSkipTls` | boolean \| null | No | Skip TLS certificate verification for this clone invocation only. |
| `password` | string \| null | No | Password for authenticated remotes; write-only and never returned. |
| `path` | string | No | Destination path to clone into. |
| `url` | string | No | Repository URL or local source path to clone. |
| `username` | string \| null | No | Username for authenticated remotes; write-only and never returned. |

## CommitInfo

One commit from `git log`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `author` | string | Yes | Author name. |
| `email` | string | Yes | Author email. |
| `hash` | string | Yes | Full commit SHA. |
| `message` | string | Yes | Commit subject line. |
| `timestamp` | string | Yes | Author timestamp in RFC 3339 format. |

## CommitRequest

Create a commit.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `allow_empty` | boolean | No | Whether an empty commit is allowed. |
| `author` | string | No | Commit author name passed to git for this invocation only. |
| `email` | string | No | Commit author email passed to git for this invocation only. |
| `message` | string | No | Commit message. |
| `path` | string | No | Repository path to commit in. |

## CommitResponse

Commit creation result.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hash` | string | Yes | Full SHA of this operation's created commit, captured from git's commit output rather than a later read of HEAD. |

## ComputerUseA11yFindRequest

Accessibility find request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | integer (int64) \| null | No | Maximum number of matches. Omitted or `<=0` uses the platform default. |
| `name` | string | No | Name filter. Omitted = any name. |
| `nameMatch` | string | No | Name match mode: `exact`, `substring`, or `regex`. |
| `pid` | integer (int64) \| null | No | Owning process id when `scope=pid`. |
| `role` | string | No | Exact role filter. Omitted = any role. |
| `scope` | string | No | Scope selector: omitted or `focused` for the focused window, `pid` for one process, or `all` for all windows. |
| `states` | array of string | No | Required state names. |

## ComputerUseA11yFindResponse

Accessibility find response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `matches` | array of [ComputerUseAccessibilityNode](#computeruseaccessibilitynode) | Yes | Matching nodes in traversal order. |
| `truncated` | boolean | Yes | Whether traversal stopped because of node or wall-clock limits. |

## ComputerUseA11yNodeRequest

Accessibility node request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string \| null | No | Optional action name for invoke requests. |
| `id` | string | Yes | The stable node id returned by tree/find. |
| `value` | string \| null | No | Optional text value for editable nodes. |

## ComputerUseA11yTreeResponse

Accessibility tree response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `root` | [ComputerUseAccessibilityNode](#computeruseaccessibilitynode) | Yes | The selected root node. |
| `truncated` | boolean | Yes | Whether traversal stopped because of node or wall-clock limits. |

## ComputerUseDisplayInfoResponse

Display inventory response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `displays` | array of [ComputerUseDisplay](#computerusedisplay) | Yes | The current display list. |

## ComputerUseDisplayWindowsResponse

Window inventory response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `windows` | array of [ComputerUseWindow](#computerusewindow) | Yes | The current top-level window list. |

## ComputerUseKeyboardHotkeyRequest

Keyboard hotkey request (`ctrl+shift+p`).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `keys` | string | Yes | `+`-delimited chord string. |

## ComputerUseKeyboardKeyRequest

Keyboard key request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | The main key name. |
| `modifiers` | array of string | No | Modifier key names held while pressing `key`. |

## ComputerUseKeyboardTypeRequest

Keyboard typing request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `delay` | integer (int64) | No | Delay in milliseconds between key presses. Omitted = `0`. |
| `text` | string | Yes | UTF-8 text to type. |

## ComputerUseLifecycleResponse

The response returned when starting or stopping the desktop.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Stable success text. |
| `status` | [ComputerUseProcessStatusMap](#computeruseprocessstatusmap) | Yes | The post-operation process inventory. |

## ComputerUseMouseClickRequest

Mouse click request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `button` | string | No | Button name (`left`, `middle`, `right`). Omitted = `left`. |
| `double` | boolean | No | Whether to double-click instead of single-clicking. |
| `x` | integer (int64) | Yes | Target X coordinate in desktop pixels. |
| `y` | integer (int64) | Yes | Target Y coordinate in desktop pixels. |

## ComputerUseMouseDragRequest

Mouse drag request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `button` | string | No | Button name (`left`, `middle`, `right`). Omitted = `left`. |
| `endX` | integer (int64) | Yes | Drag end X coordinate in desktop pixels. |
| `endY` | integer (int64) | Yes | Drag end Y coordinate in desktop pixels. |
| `startX` | integer (int64) | Yes | Drag start X coordinate in desktop pixels. |
| `startY` | integer (int64) | Yes | Drag start Y coordinate in desktop pixels. |

## ComputerUseMouseMoveRequest

Mouse move request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `x` | integer (int64) | Yes | Target X coordinate in desktop pixels. |
| `y` | integer (int64) | Yes | Target Y coordinate in desktop pixels. |

## ComputerUseMouseScrollRequest

Mouse scroll request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | integer (int64) \| null | No | Number of wheel steps. Omitted = `1`. |
| `direction` | string | Yes | Scroll direction (`up` or `down`). |
| `x` | integer (int64) | Yes | Target X coordinate in desktop pixels. |
| `y` | integer (int64) | Yes | Target Y coordinate in desktop pixels. |

## ComputerUsePoint

A point in desktop pixels.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `x` | integer (int32) | Yes | Horizontal desktop coordinate. |
| `y` | integer (int32) | Yes | Vertical desktop coordinate. |

## ComputerUseProcessErrorsResponse

The stderr/errors of one named process.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `errors` | string | Yes | The retained stderr/error log text. |
| `processName` | string | Yes | The requested process name. |

## ComputerUseProcessLogsResponse

The logs of one named process.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `logs` | string | Yes | The retained stdout log text. |
| `processName` | string | Yes | The requested process name. |

## ComputerUseProcessRestartResponse

The response returned by `POST /computeruse/process/{name}/restart`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Stable success text. |
| `processName` | string | Yes | The restarted process name. |

## ComputerUseProcessRunningStatus

The running state of one named process.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `processName` | string | Yes | The requested process name. |
| `running` | boolean | Yes | Whether the named process is currently alive. |

## ComputerUseProcessStatusMap

The process-status map keyed by process name.

Type: map of [ComputerUseProcessStatus](#computeruseprocessstatus)

## ComputerUseRecording

Recording metadata.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `durationSeconds` | number (double) \| null | No | Duration in seconds when known. |
| `endTime` | string \| null | No | Recording end time in RFC 3339 format, omitted while live. |
| `fileName` | string | Yes | Download filename. |
| `filePath` | string | Yes | Absolute recording path inside the sandbox. |
| `id` | string | Yes | Recording id. |
| `sizeBytes` | integer (int64) \| null | No | Encoded file size in bytes when known. |
| `startTime` | string | Yes | Recording start time in RFC 3339 format. |
| `status` | string | Yes | Lifecycle status (`recording`, `stopping`, `completed`, `failed`, ...). |

## ComputerUseRecordingStartRequest

Recording start request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string \| null | No | Optional label used as the filename prefix. |

## ComputerUseRecordingStopRequest

Recording stop request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | The recording id. |

## ComputerUseRecordingsResponse

Recording list response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `recordings` | array of [ComputerUseRecording](#computeruserecording) | Yes | The current and retained recordings. |

## ComputerUseRestartResponse

The response returned by `POST /computeruse/restart`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `desktop` | [ComputerUseDesktopState](#computerusedesktopstate) | Yes | The explicit desktop state after the restart succeeds. |
| `message` | string | Yes | Stable success text. |
| `status` | [ComputerUseActivityStatus](#computeruseactivitystatus) | Yes | Activity status; `active` after a successful restart. |

## ComputerUseScreenshotResponse

Screenshot response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cursorPosition` | null \| [ComputerUsePoint](#computerusepoint) | No |  |
| `screenshot` | string | Yes | Base64-encoded PNG or JPEG bytes. |
| `sizeBytes` | integer | Yes | Size of the encoded image in bytes. |

## ComputerUseScrollResponse

Scroll success response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Always `true` when the request succeeds. |

## ComputerUseStartRequest

The optional body of `POST /computeruse/start` and `/restart`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resolution` | null \| [ComputerUseResolution](#computeruseresolution) | No |  |

## ComputerUseStatusResponse

The public desktop status surface.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cause` | null \| [ComputerUseDesktopFailure](#computerusedesktopfailure) | No |  |
| `desktop` | [ComputerUseDesktopState](#computerusedesktopstate) | Yes | The current desktop state. |
| `status` | [ComputerUseActivityStatus](#computeruseactivitystatus) | Yes | Activity status corresponding to `desktop`. |

## CreateProcessRequest

`POST /processes` request body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `argv` | array of string \| null | No | argv mode. Exactly one of `argv`, `shellCommand`, or `code` may be present. |
| `code` | string \| null | No | Code to execute in an interpreter session. |
| `cwd` | string \| null | No | Optional working directory. For `exec` and `pty`, defaults to the configured user’s home when available. Code execution, an explicit `user`, or an unavailable home uses the sandbox’s default working directory. |
| `env` | map of string | No | Environment overrides applied at spawn time. PTY processes default to `TERM=xterm-256color`; an explicit TERM overrides the default. |
| `keepLogs` | null \| [KeepLogs](#keeplogs) | No |  |
| `kind` | null \| [Kind](#kind) | No |  |
| `language` | string \| null | No | Code language, exactly `python`, `typescript` or `javascript` (case-sensitive). Unknown values, including an empty string, answer 400 `UNSUPPORTED_OPERATION` before provisioning. Omit when using an explicit session's language; without `sessionId`, omission answers 400 `BAD_REQUEST`. |
| `login` | boolean | No | Whether to request a login shell. |
| `name` | string \| null | No | Optional live-only alias. Must be a safe identifier. |
| `sessionId` | string \| null | No | The session to run in. For `kind=exec`: the id or live name of a `kind=session` process; the `shellCommand` runs inside its shell, one command at a time, in order, and the request refuses `argv`, `cwd`, `env`, `shell`, `login: true`, `user` and `tag` (the session's settings apply; the command takes the session's tag). Unknown ids answer `SESSION_NOT_FOUND` (sessions are never created on first use) and an ended or deleted session answers `SESSION_ENDED`. For `kind=code`: the interpreter context to execute in. |
| `shell` | string \| null | No | Requested shell path or shell name. For `kind=session` on Linux and macOS it must be a POSIX shell (bash, sh, dash, zsh, ksh): the session answers 400 `PROCESS_START_FAILED` when the shell does not run POSIX commands within 5 s of starting. |
| `shellCommand` | string \| null | No | Shell command to execute. |
| `stdin` | null \| [StdinMode](#stdinmode) | No |  |
| `tag` | string \| null | No | Optional tag, a safe identifier (`[A-Za-z0-9._-]`, 1-128 characters, not `.` or `..`) that groups this process with others for `GET /processes?tag=` and `POST /processes:kill`. Applies to `kind=exec`, `pty` and `session`. `kind=code` refuses it, and so does a command run in a session, which takes the session's tag. |
| `terminal` | null \| [TerminalSize](#terminalsize) | No |  |
| `timeoutMs` | integer (int64) \| null | No | Per-process execution timeout in milliseconds. Omitted or 0 means no limit. Positive timeouts apply to exec and PTY processes (including exec commands in a shell session); code executions and shell-session creation refuse positive timeouts. For a session command, the timeout starts when execution begins, excluding time queued behind earlier commands. On expiry the command is stopped if possible. If it has not stopped after a further 5 seconds, the session and its background processes are ended. |
| `user` | string \| null | No | Optional execution user. Not supported for `kind=code`; returns 400 `UNSUPPORTED_OPERATION`. |

## CreateSessionRequest

`POST /sessions` request body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cwd` | string \| null | No | Initial working directory. Empty uses the sandbox’s default working directory. |
| `env` | map of string | No | Environment overrides applied when the interpreter session starts. |
| `id` | string \| null | No | Optional client-chosen session id. Must be a safe identifier when present. |
| `kernel` | string \| null | No | Interpreter language, exactly `python`, `typescript` or `javascript` (case-sensitive). Unknown values, including an empty string, answer 400 `UNSUPPORTED_OPERATION` before provisioning; a supported kernel that fails to install or start answers 503 `KERNEL_UNAVAILABLE`. A language is required: `shell`, or omitting the field, answers 400 `UNSUPPORTED_OPERATION`, because shell sessions are created with `POST /processes` `kind=session`. |
| `login` | boolean | No | Not supported for interpreter sessions; answers 400 `UNSUPPORTED_OPERATION` when `true`. |
| `shell` | string \| null | No | Not supported for interpreter sessions; answers 400 `UNSUPPORTED_OPERATION` when set. |

## DockerStatus

`GET /docker/status` — the Docker Engine startup status for this boot.
Read-only: asking never starts or restarts anything.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `owner` | [DockerOwner](#dockerowner) | Yes | Who starts Docker. |
| `processId` | string \| null | No | ID of the process whose logs contain Docker output; read with `GET /processes/{id}/logs`. Null when no Docker process is available. |
| `reason` | string \| null | No | Why the state is what it is (a failure cause, a storage limitation, or a note on a `ready` engine the sandbox user cannot reach). `null` when there is nothing to add. |
| `state` | [DockerState](#dockerstate) | Yes | Startup state. |

## EnvRequest

Update environment variables for processes, PTYs, and sessions created after this call.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `env` | map of string | No | Environment variables to add or replace for processes, PTYs, and sessions created after this call. Keys must not also appear in `unset`. |
| `unset` | array of string | No | Names of previously added environment variables to remove. Keys must not also appear in `env`. |

## ErrorEnvelope

Error response body for every documented 4xx/5xx response. `code` is always present; `trace_id` may be omitted.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | A code from `x-daytona-error-codes` (the `ErrorCode` enum) or from `x-daytona-generic-codes`. |
| `message` | string | Yes | Human-readable reason. |
| `source` | string | Yes | Error source. Open vocabulary. SDKs match domain codes for `DAYTONA_DAEMON`; other sources use generic codes, then HTTP status. |
| `trace_id` | string | No | Recording trace identifier, omitted when unavailable. |

## ExitResult

Terminal result returned by `GET /processes/{id}/wait` and SSE `state` events.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `exitCode` | integer (int32) \| null | No | Process exit code, when the platform has one. |
| `reason` | null \| [Reason](#reason) | No |  |
| `signal` | string \| null | No | Signal name such as `SIGKILL`, omitted when none applies. |

## FileInfo

One filesystem entry returned by `/files` and `/files/info`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `group` | string | Yes | Numeric group id rendered as a string. |
| `isDir` | boolean | Yes | Whether the entry is a directory. |
| `modTime` | string | Yes | Last modification time as a formatted string. Prefer `modifiedAt` for RFC 3339 formatting. |
| `mode` | string | Yes | File mode string, for example `-rw-r--r--` or `drwxr-xr-x`. |
| `modifiedAt` | string | Yes | RFC 3339 UTC timestamp for the last modification time. |
| `name` | string | Yes | Base name of the entry. |
| `owner` | string | Yes | Numeric owner id rendered as a string. |
| `path` | string | Yes | Absolute path to the entry, using the sandbox's path syntax. |
| `permissions` | string | Yes | Four-digit octal permissions (`0644`, `0755`, …). |
| `size` | integer (int64) | Yes | Entry size in bytes. |

## FindResponse

Literal line matches from `GET /files/find`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | array of [Match](#match) | Yes | Matches, in walk order. |
| `skipped` | array of string | Yes | Absolute paths below the root that the sandbox user cannot read, so they were not searched. Empty when nothing was skipped; at most 1000 entries. |

## GitConfigResponse

Value of one git config key.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | string \| null | No | Config value, or `null` when the key is unset. |

## InfoResponse

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `buildSha` | string \| null | No | Toolbox build identifier, or `unknown` when unavailable. May be omitted. |
| `buildTime` | string \| null | No | Toolbox build time in RFC 3339 UTC, or `unknown` when unavailable. May be omitted. |
| `userHomeDir` | string \| null | No | Home directory of the configured default user; omitted when that user cannot be resolved. Without a configured default user, the toolbox's own home directory. |
| `version` | string | Yes | Platform release version, for example `2.0.0-alpha.1`; `0.0.0-dev` when unavailable. Distinct from the toolbox build identifier returned by `GET /version`. |
| `workDir` | string | Yes |  |

## InitRequest

Initialize a repository.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bare` | boolean | No | Whether to create a bare repository. |
| `initial_branch` | string \| null | No | Initial branch name for a new non-bare repository. |
| `path` | string | No | Destination path for the new repository. |

## IsPortInUseResponse

Whether one TCP port is currently in use.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `isInUse` | boolean | Yes | `true` when the port is in use. |

## KeepLogs

Retention policy for process information and output logs.

Type: string: `until_cleanup`, `on_exit_ttl`, `none`

## KillProcessesRequest

`POST /processes:kill` request body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tag` | string | Yes | The tag whose processes to kill: a safe identifier (`[A-Za-z0-9._-]`, 1-128 characters, not `.` or `..`). |
| `timeoutMs` | integer (int64) \| null | No | How long to wait for every killed process to exit, in milliseconds. 1-60000; default 10000. |

## KillProcessesResponse

`POST /processes:kill` response body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `processIds` | array of string | Yes | The tagged processes that were still running when the call started, and exited tagged processes that still had descendants running. Every one of them, and everything it started, has exited. Processes whose records were deleted or expired are killed too but not listed, so an empty list does not mean nothing was stopped. |

## Kind

What kind of process the API should run.

Type: string: `exec`, `pty`, `code`, `session`

## ListRemotesResponse

Remote list response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `remotes` | array of [GitRemote](#gitremote) | Yes | Configured remotes. |

## Metrics

One snapshot of sandbox resource usage.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cpuCount` | integer (int32) | Yes | Logical CPU count visible inside the sandbox. |
| `cpuUtilization` | number (double) | Yes | Fraction of total CPU capacity in use across all CPUs, between 0 and 1 inclusive. |
| `diskTotalBytes` | integer (int64) | Yes | Total bytes on the filesystem containing the sandbox work directory. |
| `diskUsageBytes` | integer (int64) | Yes | Used bytes on the filesystem containing the sandbox work directory. |
| `memoryTotalBytes` | integer (int64) | Yes | Total sandbox memory in bytes. |
| `memoryUsageBytes` | integer (int64) | Yes | Bytes of sandbox memory currently in use (`total - available`). |
| `timestamp` | string | Yes | Snapshot time as an RFC 3339 UTC timestamp. |

## PortList

The TCP ports currently listening inside the sandbox.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ports` | array of integer (int32) | Yes | All listening TCP ports inside the sandbox. |

## ProcessDto

Process information returned by create, get, and list operations.

Type: [ProcessRecord](#processrecord) & object

## ProcessListResponse

`GET /processes` response body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | array of [ProcessDto](#processdto) | Yes | Matching processes in creation order. |

## ProcessLogsResponse

JSON page body from `GET /processes/{id}/logs`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eof` | boolean | Yes | Whether the process is terminal and there are no more frames after this page. |
| `firstAvailableCursor` | string \| null | No | Cursor of the first surviving frame, omitted when nothing was evicted. |
| `frames` | array of [LogFrameDto](#logframedto) | Yes | Frames in this page. |
| `nextCursor` | string | Yes | Cursor the client should pass to continue from the end of this page. |
| `truncatedHead` | boolean | Yes | Whether retention evicted older frames before this page. |

## PullVolumeRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | string | Yes | Caller-generated identity, retained across retries (1–128 ASCII letters, digits, underscores or hyphens). Replay is scoped to the active session. |
| `waitMs` | integer (int64) | No | Maximum HTTP wait in milliseconds. Expiry does not cancel accepted work. Omitted means 30000. Zero submits a new request or retrieves a known one without retrying it; only a wait above zero retries a retryable result. |

## PullVolumeResponse

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `manifestId` | string \| null | Yes | Version of remote volume data applied by a successful pull or observed when unchanged; null when unavailable or pending. An unchanged remote version does not guarantee that local files are unchanged. |
| `requestId` | string | Yes | The caller's stable request identity, including on elapsed waits. |
| `status` | [PullVolumeStatus](#pullvolumestatus) | Yes |  |

## ReplaceRequest

JSON body for `POST /files/replace`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | No | Absolute paths of regular files to rewrite. Non-regular files are skipped with a per-file failure; permission denials return `FILE_ACCESS_DENIED`. |
| `newValue` | string \| null | No | Replacement text. Omitted only when the caller wants the route to reject the request. |
| `pattern` | string | No | Literal substring to replace. |

## ReplaceResult

One file's outcome from `POST /files/replace`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `error` | string \| null | No | Per-file error text, omitted on success. |
| `file` | string | Yes | Absolute file path for this replacement attempt. |
| `success` | boolean | Yes | Whether the replacement succeeded for this file. |

## RepoRequest

Operate on a repository, optionally with credentials for a remote.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string \| null | No | Remote branch to push or pull. Omitted keeps the current HEAD push behaviour and git's default pull target. A leading `+` is a literal part of the branch name, never a force flag. |
| `password` | string \| null | No | Password for authenticated remotes; write-only and never returned. |
| `path` | string | No | Repository path to operate in. |
| `remote` | string \| null | No | Remote name. Omitted defaults to `origin` for push and for pull when `branch` is set; a pull without `branch` uses git's configured upstream. |
| `setUpstream` | boolean \| null | No | Pass `-u` / `--set-upstream` on push. |
| `username` | string \| null | No | Username for authenticated remotes; write-only and never returned. |

## ResetRequest

Reset repository state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | No | Optional pathspecs to reset in mixed mode. |
| `mode` | string \| null | No | Reset mode (`mixed`, `soft`, `hard`, `merge`, `keep`); omitted means git's default mixed reset. |
| `path` | string | No | Repository path to operate in. |
| `target` | string \| null | No | Commit-ish to reset to. |

## ResizeRequest

`POST /processes/{id}/resize` body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cols` | integer (int32) | Yes | PTY columns; an integer in 1..=65535. Windows: at most 32767. |
| `rows` | integer (int32) | Yes | PTY rows; an integer in 1..=65535. Windows: at most 32767. |

## RestoreRequest

Restore paths from the index or another source.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | No | File paths to restore. |
| `path` | string | No | Repository path to operate in. |
| `source` | string \| null | No | Optional source tree-ish for the restore. |
| `staged` | boolean \| null | No | Whether to restore the index entry. |
| `worktree` | boolean \| null | No | Whether to restore the worktree entry. |

## SearchResponse

Recursive filename-glob search results from `GET /files/search`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | Yes | Absolute matching file paths. |
| `skipped` | array of string | Yes | Absolute paths below the root that the sandbox user cannot read, so their contents were not searched. Empty when nothing was skipped; at most 1000 entries. |

## SessionDto

Session information returned by create, list, and get operations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `active` | boolean | Yes | Whether the interpreter session is active. |
| `createdAt` | string | Yes | RFC 3339 creation timestamp. |
| `cwd` | string | Yes | Initial working directory of the interpreter session; changes made by executed code are not reflected here. |
| `id` | string | Yes | Stable session id. |
| `kernel` | [KernelKind](#kernelkind) | Yes | Interpreter language. |
| `kernelProcessId` | string | Yes | Process ID for the session's interpreter. |
| `processIds` | array of string | Yes | Member process ids in creation order. |

## SessionListResponse

`GET /sessions` response body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | array of [SessionDto](#sessiondto) | Yes | Sessions in creation order. |

## SetConfigRequest

Set one git config key.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | No | Config key to set. |
| `path` | string \| null | No | Repository path required for `scope=local`. |
| `scope` | string \| null | No | Config scope; omitted means `global`. |
| `value` | string | No | Config value to write. |

## SignalRequest

`POST /processes/{id}/signals` body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `escalateAfterMs` | integer (int64) \| null | No | Grace period in milliseconds before escalating. Maximum 600000. |
| `escalateTo` | string \| null | No | Escalation signal name. Defaults to `SIGKILL` when omitted. |
| `signal` | string | No | Signal name such as `SIGTERM`, `SIGKILL`, or `SIGINT`. Empty means `SIGTERM`. |

## StatusResponse

Repository status.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ahead` | integer (int64) | Yes | Commits the local branch is ahead of its upstream. |
| `behind` | integer (int64) | Yes | Commits the local branch is behind its upstream. |
| `branchPublished` | boolean | Yes | Whether the current branch has an upstream. |
| `currentBranch` | string | Yes | Current branch name, or `HEAD` for a detached checkout. |
| `fileStatus` | array of [FileStatus](#filestatus) | Yes | File-level status entries. |

## StdinMode

Whether the process accepts live stdin writes.

Type: string: `closed`, `open`

## StdinRequest

`POST /processes/{id}/stdin` body.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | string | No | Data to write. Text by default. With `encoding=base64`, accepts standard RFC 4648 section 4 base64 (`+/`) or base64url (`-_`), padded or unpadded. |
| `encoding` | string \| null | No | Optional payload encoding: `text` (default) or `base64`. |
| `eof` | boolean | No | Whether this request also closes stdin after writing. |

## TerminalSize

Terminal dimensions for PTY processes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cols` | integer (int32) | Yes | Number of columns; an integer in 1..=65535. Windows: at most 32767. |
| `rows` | integer (int32) | Yes | Number of rows; an integer in 1..=65535. Windows: at most 32767. |

## VersionResponse

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes |  |

## UploadedFile

One uploaded file result from `POST /files/bulk-upload`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bytes` | integer (int64) | Yes | Number of bytes written. |
| `path` | string | Yes | Absolute destination path the API wrote. |

## ComputerUseAccessibilityNode

Accessibility tree node.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `actions` | array of string \| null | No | Supported action names when the platform exposes them. |
| `bounds` | [ComputerUseAccessibilityBounds](#computeruseaccessibilitybounds) | Yes | Bounds rectangle in desktop pixels. |
| `children` | array of [ComputerUseAccessibilityNode](#computeruseaccessibilitynode) \| null | No | Child nodes when the response includes them. |
| `description` | string \| null | No | Optional accessible description. |
| `id` | string | Yes | Stable node id used by follow-up node actions. |
| `name` | string | Yes | Accessible name. |
| `role` | string | Yes | Role name. |
| `states` | array of string | Yes | State names such as `focused` or `visible`. |
| `value` | string \| null | No | Current value of a control (a text field's contents, a checkbox's state), when the platform reports it. Never set for secure (password) fields. Capped by the platform; see `valueTruncated`. |
| `valueTruncated` | boolean | No | `value` was cut at the platform's cap. |

## ComputerUseDisplay

One display/monitor.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `height` | integer (int32) | Yes | Display height in pixels. |
| `id` | integer | Yes | Stable display index within the current desktop. |
| `isActive` | boolean | Yes | Whether this display is the active/focused display. |
| `width` | integer (int32) | Yes | Display width in pixels. |
| `x` | integer (int32) | Yes | Display origin X coordinate in desktop pixels. |
| `y` | integer (int32) | Yes | Display origin Y coordinate in desktop pixels. |

## ComputerUseWindow

One top-level window.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `height` | integer (int32) | Yes | Window height in pixels. |
| `id` | integer (int64) | Yes | Desktop window identifier. Returned as an integer that JavaScript clients can represent exactly. |
| `isActive` | boolean | Yes | Whether this window is active/focused. |
| `title` | string | Yes | Window title. |
| `width` | integer (int32) | Yes | Window width in pixels. |
| `x` | integer (int32) | Yes | Window origin X coordinate in desktop pixels. |
| `y` | integer (int32) | Yes | Window origin Y coordinate in desktop pixels. |

## ComputerUseProcessStatus

One desktop automation process.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `AutoRestart` | boolean | Yes | Whether the process restarts automatically after exiting. |
| `Failed` | boolean | Yes | Whether the process entered a terminal failed state. |
| `Pid` | integer (int32) \| null | No | The live process id when `running` is true. |
| `Priority` | integer (int32) | Yes | Relative startup priority among desktop processes. |
| `RestartAttempts` | integer (int32) | Yes | Restart attempts used since the desktop was last started. |
| `RestartBackoffMs` | integer (int64) | Yes | The current restart backoff in milliseconds. |
| `Running` | boolean | Yes | Whether the process is currently alive. |
| `Status` | string | Yes | Human-readable state (`running`, `stopped`, `failed`). |

## ComputerUseActivityStatus

Activity status: `active` when the desktop is ready, otherwise `inactive`.

Type: string: `active`, `inactive`

## ComputerUseDesktopState

The current desktop state.

Type: string: `not_started`, `starting`, `ready`, `failed`

## ComputerUseResolution

A desktop resolution in pixels. Only 1024x768, 1280x720 and 1920x1080
are accepted; any other pair is `400 BAD_REQUEST`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `height` | integer (int32) | Yes | Height in pixels. |
| `width` | integer (int32) | Yes | Width in pixels. |

## ComputerUseDesktopFailure

The failure attached to a `failed` desktop state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | [ComputerUseDesktopFailureCode](#computerusedesktopfailurecode) | Yes | The stable failure code callers branch on. |
| `message` | string | Yes | Human-readable remediation detail. |

## DockerOwner

Who starts and owns Docker Engine in this sandbox.

Type: string: `none`, `daemon`, `entrypoint`

## DockerState

Where Docker Engine is in this boot's startup.

Type: string: `not_present`, `disabled`, `unmanaged`, `deferred`, `starting`, `ready`, `failed`, `unsupported`

## Reason

Why a process became terminal.

Type: string: `exited`, `signaled`, `timed_out`, `lost`, `failed`

## Match

One literal line match from `GET /files/find`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | The matched line content. |
| `file` | string | Yes | Absolute path of the file containing the match. |
| `line` | integer (int32) | Yes | One-based line number. |

## GitRemote

One configured remote.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Remote name. |
| `url` | string | Yes | Remote URL with any userinfo redacted before it is returned. |

## ProcessRecord

Process information.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `argv` | array of string \| null | No | argv create shape, omitted unless this process was created that way. |
| `code` | string \| null | No | Code source, omitted unless this is a `kind=code` process. |
| `createdAt` | string | Yes | RFC 3339 creation timestamp. |
| `cwd` | string | Yes | Working directory the API used. For a `kind=session` process, the session shell's current directory, updated after each command; for a command run in a session, the shell's directory when the command started. |
| `exitCode` | integer (int32) \| null | No | Exit code, omitted until terminal. |
| `exitedAt` | string \| null | No | RFC 3339 exit timestamp, omitted until terminal. |
| `id` | string | Yes | Stable process id. |
| `keepLogs` | [KeepLogs](#keeplogs) | Yes | Record/log retention policy. |
| `kind` | [Kind](#kind) | Yes | Process kind. |
| `language` | string \| null | No | Code language, omitted when not applicable. |
| `login` | boolean | No | Whether the API requested a login shell. |
| `name` | string \| null | No | Optional live-only alias, omitted when unnamed. |
| `pid` | integer (int32) \| null | No | OS process id while running, omitted before spawn and after exit. Always omitted for commands run in a session: they run inside the session's shell, whose own record carries its pid. |
| `reason` | null \| [Reason](#reason) | No |  |
| `resolvedShell` | string \| null | No | Resolved shell path or name, omitted until resolution has happened. |
| `sessionId` | string \| null | No | The session this process ran in: a `kind=session` process for shell commands, or the interpreter context for `kind=code`. Omitted for standalone processes. |
| `shell` | string \| null | No | Requested shell, omitted when the API used its default resolution. |
| `shellCommand` | string \| null | No | Shell command source, omitted unless this process was created that way. |
| `signal` | string \| null | No | Signal name, omitted when none applies. |
| `startedAt` | string \| null | No | RFC 3339 process-start timestamp, omitted until the process starts. |
| `state` | [State](#state) | Yes | Lifecycle state. |
| `stdin` | [StdinMode](#stdinmode) | Yes | Whether stdin is open. |
| `system` | boolean | No | Whether this is a protected system process. |
| `tag` | string \| null | No | The tag the process was created with, omitted when it has none. A command run in a session carries the session's tag. Never changes. |
| `terminal` | null \| [TerminalSize](#terminalsize) | No |  |
| `timeoutMs` | integer (int64) \| null | No | Process execution timeout in milliseconds; omitted or 0 means no limit. |
| `user` | string \| null | No | Requested user, omitted when the API runs as its default user. |

## LogFrameDto

One log frame in a JSON log page or SSE `log` event.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channel` | string | Yes | Channel such as `stdout`, `stderr`, `pty`, `setup`, `display`, `execute_result`, or `error`. |
| `cursor` | string | Yes | Cursor naming this frame. |
| `data` | string | Yes | Frame payload in the requested encoding. With `text`, the bytes of a character that the next frame on the same channel completes move to that frame, so `data` can be empty. `base64` is the frame's exact bytes, standard padded RFC 4648 section 4 (`+/` alphabet, `=` padding). |
| `timestamp` | integer (int64) | Yes | Unix timestamp in milliseconds. |

## PullVolumeStatus

Type: string: `pulled`, `unchanged`, `pending`

## KernelKind

Interpreter language. `/sessions` creates interpreter contexts; shell sessions are `kind=session` processes on `/processes`.

Type: string: `shell`, `python`, `typescript`, `javascript`

## FileStatus

One file entry from `git status`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `extra` | string | Yes | Extra path metadata; for renames this carries the original path, otherwise an empty string. |
| `name` | string | Yes | File or directory path reported by git. |
| `staging` | string | Yes | Index status column. |
| `worktree` | string | Yes | Worktree status column. |

## ComputerUseAccessibilityBounds

Accessibility bounds rectangle.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `height` | integer (int32) | Yes | Height in desktop pixels. |
| `width` | integer (int32) | Yes | Width in desktop pixels. |
| `x` | integer (int32) | Yes | Left coordinate in desktop pixels. |
| `y` | integer (int32) | Yes | Top coordinate in desktop pixels. |

## ComputerUseDesktopFailureCode

The reason the desktop entered the failed state.

Type: string: `desktop_exited`, `addon_crashed`, `start_failed`, `start_interrupted`, `session_ended`, `session_replaced`, `state_corrupt`, `state_persistence_failed`

## State

Process lifecycle state: `starting`, optionally `provisioning`, then `running` and `terminal`. `provisioning` indicates that the execution environment is being prepared. See `ExitResult` for exit code, signal, timeout, or loss.

Type: string: `starting`, `provisioning`, `running`, `terminal`
