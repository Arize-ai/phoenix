# Toolbox API: files

Filesystem: listing, transfer (streamed both ways), search and replace, permissions, change watch.

## Contents

- [List files](#list-files)
- [Delete a file or directory](#delete-a-file-or-directory)
- [Download many files](#download-many-files)
- [Upload many files](#upload-many-files)
- [Download one file](#download-one-file)
- [Find text in files](#find-text-in-files)
- [Create a folder](#create-a-folder)
- [Get file metadata](#get-file-metadata)
- [Move a file or directory](#move-a-file-or-directory)
- [Change permissions](#change-permissions)
- [Replace text in files](#replace-text-in-files)
- [Search filenames](#search-filenames)
- [Upload one file](#upload-one-file)
- [Watch a directory](#watch-a-directory)

## List files

`GET /files`

List entries under the requested directory. Omitting `path` uses the sandbox’s default working directory. `depth` defaults to `1` and recursive listings are capped at 10,000 entries.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Absolute target path: `/`-rooted, or on Windows also a drive or UNC path (`/`-rooted paths resolve against the daemon's current drive). Omitted on `GET /files` to use the sandbox’s default working directory. Relative and empty paths are refused with `INVALID_FILE_PATH`. |
| `depth` | query | string | No | Recursive listing depth for `GET /files`; omitted for the flat default (`1`). |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | array of [FileInfo](./toolbox-schemas.md#fileinfo) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid query, directory metadata, depth or listing cap; `INVALID_FILE_PATH` — path must be absolute | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — directory metadata or contents could not be read | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `FILE_NOT_FOUND` — the requested directory does not exist | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Delete a file or directory

`DELETE /files`

Delete one file. Directories require `recursive=true` or `recursive=1`.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Absolute path to remove. |
| `recursive` | query | string | No | Recursive delete flag as a string query value. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | The path was deleted. |  |
| 400 | `BAD_REQUEST` — missing path or directory without `recursive=true`; `INVALID_FILE_PATH` — path must be absolute | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the API cannot remove the path | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `FILE_NOT_FOUND` — the requested path does not exist | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Download many files

`POST /files/bulk-download`

Stream regular files at absolute paths using the sandbox user's permissions. Invalid paths, non-regular files and permission denials discovered before streaming refuse the request with 400 or 403. Other failures, including failures after streaming starts, use `error` parts carrying error envelopes; the outer response then stays 200.

### Request Body

`application/json`: [BulkDownloadRequest](./toolbox-schemas.md#bulkdownloadrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `paths` | array of string | No | Absolute paths of regular files to stream back as multipart file or error parts. Permission denials and non-regular files discovered before streaming refuse the request. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Multipart file and error parts with the fixed boundary `DAYTONA-FILE-BOUNDARY`. | `multipart/form-data` |
| 400 | `BAD_REQUEST` — malformed JSON or `paths` was empty; `INVALID_FILE_PATH` — path must be absolute or is not a regular file | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the sandbox user cannot open a requested file | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body is well formed but does not match `BulkDownloadRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Upload many files

`POST /files/bulk-upload`

Upload files using paired absolute `files[i].path` and `files[i].file` multipart fields. A relative or empty path, or a non-regular destination, returns 400 `INVALID_FILE_PATH`; non-regular destinations use `<path>: not a regular file`. Earlier uploads are not rolled back. Other partial success is reported per file in the JSON body. A malformed or truncated multipart body is reported as an entry in `errors`, beside the files written before it. New files and directories belong to the configured sandbox user, and writes require that user’s permissions. With `atomic=true`, each successful file is replaced atomically; unsupported atomic replacement is reported for that file while other files continue.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `atomic` | query | boolean | No | Replace each destination file atomically; fail that file if atomic replacement is unsupported. A replacement keeps the existing owner when the sandbox user may assign it, and is otherwise owned by the sandbox user. A non-regular destination refuses the request with `400 INVALID_FILE_PATH`; earlier uploads are not rolled back. |

### Request Body

Multipart form using `files[i].path` metadata parts and `files[i].file` content parts.

`multipart/form-data`: string

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [BulkUploadResponse](./toolbox-schemas.md#bulkuploadresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — no recognized multipart fields were provided; `INVALID_FILE_PATH` — every destination path must be absolute and existing destinations must be regular files | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the sandbox user cannot create or write a destination; earlier uploads are not rolled back | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Download one file

`GET /files/download`

Stream one regular file at an absolute path as `application/octet-stream`, using the sandbox user's permissions. Directories, FIFOs, sockets and devices are refused without reading them.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Absolute target path: `/`-rooted, or on Windows also a drive or UNC path (`/`-rooted paths resolve against the daemon's current drive). Omitted on `GET /files` to use the sandbox’s default working directory. Relative and empty paths are refused with `INVALID_FILE_PATH`. |
| `depth` | query | string | No | Recursive listing depth for `GET /files`; omitted for the flat default (`1`). |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Raw file bytes. | `application/octet-stream` |
| 400 | `BAD_REQUEST` — missing path; `INVALID_FILE_PATH` — path is not absolute or not a regular file | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the API cannot open the file | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `FILE_NOT_FOUND` — the requested file does not exist | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Find text in files

`GET /files/find`

Walk the tree rooted at the absolute `path` as the sandbox user and return literal substring matches with one-based line numbers. Non-regular files are skipped. Directories and files below the root that the sandbox user cannot read are skipped and listed in `skipped` (at most 1000); only an unreadable root fails the request.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Absolute root path to walk recursively. |
| `pattern` | query | string | No | Filename glob (`search`) or literal substring (`find`) pattern. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [FindResponse](./toolbox-schemas.md#findresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — `path` and `pattern` are required; `INVALID_FILE_PATH` — path must be absolute | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the sandbox user cannot read the root | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `FILE_NOT_FOUND` — the root does not exist | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Create a folder

`POST /files/folder`

Create the requested directory tree. Omitting `mode` uses the route default.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Absolute directory path to create. |
| `mode` | query | string | No | Optional octal mode string; omitted or empty uses the route default. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The directory exists. |  |
| 400 | `BAD_REQUEST` — missing path or non-octal mode; `INVALID_FILE_PATH` — path must be absolute | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the API cannot create the directory | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `FILE_NOT_FOUND` — a parent path does not exist where the platform reports that condition | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Get file metadata

`GET /files/info`

Return one `FileInfo` record for the requested path.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Absolute target path: `/`-rooted, or on Windows also a drive or UNC path (`/`-rooted paths resolve against the daemon's current drive). Omitted on `GET /files` to use the sandbox’s default working directory. Relative and empty paths are refused with `INVALID_FILE_PATH`. |
| `depth` | query | string | No | Recursive listing depth for `GET /files`; omitted for the flat default (`1`). |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [FileInfo](./toolbox-schemas.md#fileinfo) (`application/json`) |
| 400 | `BAD_REQUEST` — `path` is required; `INVALID_FILE_PATH` — path must be absolute | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the API cannot stat the path | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `FILE_NOT_FOUND` — the requested path does not exist | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Move a file or directory

`POST /files/move`

Move or rename a path, including between filesystems.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `source` | query | string | No | Absolute source path to move. |
| `destination` | query | string | No | Absolute destination path. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The path was moved. |  |
| 400 | `BAD_REQUEST` or `INVALID_FILE_PATH` — the request is missing required paths or the platform rejected the path form | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the sandbox user cannot access or move the path | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `FILE_NOT_FOUND` — the source path does not exist | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `CONFLICT` — the destination path already exists | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Change permissions

`POST /files/permissions`

Change mode and, on platforms that support it, owner and group.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Absolute path whose permissions should change. On Linux, ownership and permissions apply to the symlink target when the path names a symlink. |
| `mode` | query | string | No | Optional octal mode string. |
| `owner` | query | string | No | Optional owner id or name, when the platform supports chown. |
| `group` | query | string | No | Optional group id or name, when the platform supports chgrp. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Permissions were updated. |  |
| 400 | `BAD_REQUEST`, `UNSUPPORTED_OPERATION`, or `INVALID_FILE_PATH` — the request is invalid or the platform cannot apply the requested ownership change | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the API cannot change the requested path | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `FILE_NOT_FOUND` — the requested path does not exist | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Replace text in files

`POST /files/replace`

Replace a literal substring across regular files at absolute paths as the sandbox user. Permission denials return 403; other file-specific failures, including skipped non-regular files, stay inside the 200 response body. Earlier replacements are not rolled back when a later file fails.

### Request Body

`application/json`: [ReplaceRequest](./toolbox-schemas.md#replacerequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | No | Absolute paths of regular files to rewrite. Non-regular files are skipped with a per-file failure; permission denials return `FILE_ACCESS_DENIED`. |
| `newValue` | string \| null | No | Replacement text. Omitted only when the caller wants the route to reject the request. |
| `pattern` | string | No | Literal substring to replace. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | array of [ReplaceResult](./toolbox-schemas.md#replaceresult) (`application/json`) |
| 400 | `BAD_REQUEST` — malformed JSON or required replacement fields are missing; `INVALID_FILE_PATH` — every file path must be absolute | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the sandbox user cannot read or rewrite a file | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body is well formed but does not match `ReplaceRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Search filenames

`GET /files/search`

Walk the tree rooted at `path` as the sandbox user and return absolute file paths whose base name matches the glob `pattern`. Directories and files below the root that the sandbox user cannot read are skipped and listed in `skipped` (at most 1000); only an unreadable root fails the request.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Absolute root path to walk recursively. |
| `pattern` | query | string | No | Filename glob (`search`) or literal substring (`find`) pattern. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [SearchResponse](./toolbox-schemas.md#searchresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — `path` and `pattern` are required; `INVALID_FILE_PATH` — path must be absolute | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the sandbox user cannot read the root | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `FILE_NOT_FOUND` — the root does not exist | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Upload one file

`POST /files/upload`

Upload the multipart part named `file` to the query’s absolute destination path. Existing destinations must be regular files; directories, FIFOs, sockets and devices return 400 `INVALID_FILE_PATH` with `<path>: not a regular file`, without writing to them. New files and parent directories belong to the configured sandbox user; existing files retain their ownership, except that `atomic=true` over a file the sandbox user cannot give back to its owner leaves the replacement owned by the sandbox user. Writes require that user’s permissions, otherwise return 403 `FILE_ACCESS_DENIED` without creating a destination. With `atomic=true`, replace the destination atomically or fail if unsupported.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Absolute destination path for the uploaded file. Existing destinations must be regular files; otherwise returns `400 INVALID_FILE_PATH`, `<path>: not a regular file`. |
| `atomic` | query | boolean | No | Replace the destination file atomically; fail if atomic replacement is unsupported. The replacement keeps the existing owner when the sandbox user may assign it, and is otherwise owned by the sandbox user. |

### Request Body

Multipart form with one file part named `file`.

`multipart/form-data`: string

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The file was uploaded. |  |
| 400 | `BAD_REQUEST` or `INVALID_FILE_PATH` — missing path, missing `file` part, truncated multipart body, invalid path form, or a non-regular destination | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the API cannot create or write the destination | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `FILE_NOT_FOUND` — a parent path does not exist where the platform reports that condition | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `ATOMIC_UPLOAD_UNSUPPORTED` — atomic upload is not supported on this filesystem (volume mounts); retry without atomic | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Watch a directory

`GET /files/watch`

Server-sent events for one absolute directory path, using the sandbox user's permissions. The stream emits `start` with `{}`, `fs` with `WatchFsEvent`, and `overflow` with `WatchOverflowEvent`. On macOS, a permission denial discovered after streaming starts emits `error` with an error envelope and closes the stream. `follow=true` is accepted and ignored for compatibility.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Absolute directory path to watch. |
| `recursive` | query | boolean | No | Whether nested subdirectories should be watched too. |
| `follow` | query | boolean | No | Accepted but ignored. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | SSE stream of `start`, `fs`, and `overflow` events; macOS may emit a terminal `error` envelope after an access denial. | `text/event-stream` |
| 400 | `BAD_REQUEST` — missing path, not a directory, or the concurrent-watch limit; `INVALID_FILE_PATH` — path must be absolute | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 403 | `FILE_ACCESS_DENIED` — the API cannot inspect the watched directory | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `FILE_NOT_FOUND` — the watched directory does not exist | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---
