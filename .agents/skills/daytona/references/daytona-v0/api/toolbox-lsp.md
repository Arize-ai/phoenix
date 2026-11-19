# Lsp API


## Contents

- POST `/lsp/completions`
- POST `/lsp/did-close`
- POST `/lsp/did-open`
- GET `/lsp/document-symbols`
- POST `/lsp/start`
- POST `/lsp/stop`
- GET `/lsp/workspacesymbols`

## POST `/lsp/completions` {#daytona-toolbox/tag/lsp/POST/lsp/completions}

**Get code completions**

Get code completion suggestions from the LSP server

### Request Body

Completion request

Schema: **LspCompletionParams**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `context` | [CompletionContext](#schema-completioncontext) | No |  |
| `languageId` | string | Yes |  |
| `pathToProject` | string | Yes |  |
| `position` | [LspPosition](#schema-lspposition) | Yes |  |
| `uri` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | CompletionList |
| 400 | Bad Request | ErrorResponse |

---

## POST `/lsp/did-close` {#daytona-toolbox/tag/lsp/POST/lsp/did-close}

**Notify document closed**

Notify the LSP server that a document has been closed

### Request Body

Document request

Schema: **LspDocumentRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `languageId` | string | Yes |  |
| `pathToProject` | string | Yes |  |
| `uri` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |

---

## POST `/lsp/did-open` {#daytona-toolbox/tag/lsp/POST/lsp/did-open}

**Notify document opened**

Notify the LSP server that a document has been opened

### Request Body

Document request

Schema: **LspDocumentRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `languageId` | string | Yes |  |
| `pathToProject` | string | Yes |  |
| `uri` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |

---

## GET `/lsp/document-symbols` {#daytona-toolbox/tag/lsp/GET/lsp/document-symbols}

**Get document symbols**

Get symbols (functions, classes, etc.) from a document

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `languageId` | query | string | Yes | Language ID (e.g., python, typescript) |
| `pathToProject` | query | string | Yes | Path to project |
| `uri` | query | string | Yes | Document URI |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | array of LspSymbol |
| 400 | Bad Request | ErrorResponse |

---

## POST `/lsp/start` {#daytona-toolbox/tag/lsp/POST/lsp/start}

**Start LSP server**

Start a Language Server Protocol server for the specified language

### Request Body

LSP server request

Schema: **LspServerRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `languageId` | string | Yes |  |
| `pathToProject` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/lsp/stop` {#daytona-toolbox/tag/lsp/POST/lsp/stop}

**Stop LSP server**

Stop a Language Server Protocol server

### Request Body

LSP server request

Schema: **LspServerRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `languageId` | string | Yes |  |
| `pathToProject` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/lsp/workspacesymbols` {#daytona-toolbox/tag/lsp/GET/lsp/workspacesymbols}

**Get workspace symbols**

Search for symbols across the entire workspace

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `query` | query | string | Yes | Search query |
| `languageId` | query | string | Yes | Language ID (e.g., python, typescript) |
| `pathToProject` | query | string | Yes | Path to project |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | array of LspSymbol |
| 400 | Bad Request | ErrorResponse |

---
