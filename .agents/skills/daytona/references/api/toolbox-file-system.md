# File System API


## Contents

- GET `/files`
- DELETE `/files`
- POST `/files/bulk-download`
- POST `/files/bulk-upload`
- GET `/files/download`
- GET `/files/find`
- POST `/files/folder`
- GET `/files/info`
- POST `/files/move`
- POST `/files/permissions`
- POST `/files/replace`
- GET `/files/search`
- POST `/files/upload-v2`

## GET `/files` {#daytona-toolbox/tag/file-system/GET/files}

**List files and directories**

List files and directories in the specified path. Use the optional depth
parameter to list recursively: depth=1 (default) lists the directory's
entries, depth=2 also includes their children, and so on.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | No | Directory path to list (defaults to working directory) |
| `depth` | query | integer | No | How many levels deep to list (default: 1, must be >= 1) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | array of FileInfo |
| 400 | Bad Request | ErrorResponse |
| 403 | Forbidden | ErrorResponse |
| 404 | Not Found | ErrorResponse |

---

## DELETE `/files` {#daytona-toolbox/tag/file-system/DELETE/files}

**Delete a file or directory**

Delete a file or directory at the specified path

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | File or directory path to delete |
| `recursive` | query | boolean | No | Enable recursive deletion for directories |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | No Content |  |
| 400 | Bad Request | ErrorResponse |
| 403 | Forbidden | ErrorResponse |
| 404 | Not Found | ErrorResponse |

---

## POST `/files/bulk-download` {#daytona-toolbox/tag/file-system/POST/files/bulk-download}

**Download multiple files**

Download multiple files by providing their paths. Successful files are returned as multipart parts named `file`. Per-file failures are returned as multipart parts named `error` with JSON payloads shaped like ErrorResponse.

### Request Body

Paths of files to download

Schema: **FilesDownloadRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `paths` | array of string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Multipart response with file parts and JSON error parts | gin.H |
| 400 | Bad Request | ErrorResponse |
| 403 | Forbidden | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/files/bulk-upload` {#daytona-toolbox/tag/file-system/POST/files/bulk-upload}

**Upload multiple files**

Upload multiple files with their destination paths

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |

---

## GET `/files/download` {#daytona-toolbox/tag/file-system/GET/files/download}

**Download a file**

Download a file by providing its path

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | File path to download |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | string |
| 400 | Bad Request | ErrorResponse |
| 403 | Forbidden | ErrorResponse |
| 404 | Not Found | ErrorResponse |

---

## GET `/files/find` {#daytona-toolbox/tag/file-system/GET/files/find}

**Find text in files**

Search for text pattern within files in a directory

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | Directory path to search in |
| `pattern` | query | string | Yes | Text pattern to search for |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | array of Match |
| 400 | Bad Request | ErrorResponse |

---

## POST `/files/folder` {#daytona-toolbox/tag/file-system/POST/files/folder}

**Create a folder**

Create a folder with the specified path and optional permissions

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | Folder path to create |
| `mode` | query | string | Yes | Octal permission mode (default: 0755) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Created |  |
| 400 | Bad Request | ErrorResponse |

---

## GET `/files/info` {#daytona-toolbox/tag/file-system/GET/files/info}

**Get file information**

Get detailed information about a file or directory

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | File or directory path |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | FileInfo |
| 400 | Bad Request | ErrorResponse |
| 403 | Forbidden | ErrorResponse |
| 404 | Not Found | ErrorResponse |

---

## POST `/files/move` {#daytona-toolbox/tag/file-system/POST/files/move}

**Move or rename file/directory**

Move or rename a file or directory from source to destination

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `source` | query | string | Yes | Source file or directory path |
| `destination` | query | string | Yes | Destination file or directory path |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |
| 403 | Forbidden | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 409 | Conflict | ErrorResponse |

---

## POST `/files/permissions` {#daytona-toolbox/tag/file-system/POST/files/permissions}

**Set file permissions**

Set file permissions, ownership, and group for a file or directory

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | File or directory path |
| `owner` | query | string | No | Owner (username or UID) |
| `group` | query | string | No | Group (group name or GID) |
| `mode` | query | string | No | File mode in octal format (e.g., 0755) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |
| 403 | Forbidden | ErrorResponse |
| 404 | Not Found | ErrorResponse |

---

## POST `/files/replace` {#daytona-toolbox/tag/file-system/POST/files/replace}

**Replace text in files**

Replace text pattern with new value in multiple files

### Request Body

Replace request

Schema: **ReplaceRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | Yes |  |
| `newValue` | string | Yes |  |
| `pattern` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | array of ReplaceResult |
| 400 | Bad Request | ErrorResponse |

---

## GET `/files/search` {#daytona-toolbox/tag/file-system/GET/files/search}

**Search files by pattern**

Search for files matching a specific pattern in a directory

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | Directory path to search in |
| `pattern` | query | string | Yes | File pattern to match (e.g., *.txt, *.go) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | SearchFilesResponse |
| 400 | Bad Request | ErrorResponse |

---

## POST `/files/upload-v2` {#daytona-toolbox/tag/file-system/POST/files/upload-v2}

**Upload a file**

Upload a file to the specified path. Accepts either multipart/form-data
(field "file") or a raw request body (e.g. application/octet-stream).
Parent directories are created if missing; an existing file is overwritten.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | Destination path for the uploaded file |

### Request Body

Schema: **UploadFile_request**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | string (binary) | No | File to upload (multipart/form-data) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | UploadedFile |
| 400 | Bad Request | ErrorResponse |

---
