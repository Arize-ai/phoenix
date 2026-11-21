# Toolbox API: lsp

Language servers: lifecycle, document sync, completions and symbols.

## Contents

- [Request completions](#request-completions)
- [Notify LSP did-close](#notify-lsp-did-close)
- [Notify LSP did-open](#notify-lsp-did-open)
- [List document symbols](#list-document-symbols)
- [Start an LSP server](#start-an-lsp-server)
- [Stop an LSP server](#stop-an-lsp-server)
- [List workspace symbols](#list-workspace-symbols)

## Request completions

`POST /lsp/completions`

Request `textDocument/completion` and return a `CompletionList`.

### Request Body

`application/json`: [CompletionRequest](./toolbox-schemas.md#completionrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `context` | null \| [CompletionContext](./toolbox-schemas.md#completioncontext) | No |  |
| `languageId` | string | Yes | The LSP language key (`python`, `typescript`). |
| `pathToProject` | string | Yes | Absolute project root path used as the server's workspace root. |
| `position` | [SymbolPosition](./toolbox-schemas.md#symbolposition) | Yes | Cursor position for which completions are requested. |
| `uri` | string | Yes | Document URI, typically a `file://` URI. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Normalized completion list. | [CompletionList](./toolbox-schemas.md#completionlist) (`application/json`) |
| 400 | `BAD_REQUEST` — malformed JSON, unsupported language, invalid request data, or the language server returned a request error. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — the language server did not answer in time. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `LSP_NOT_STARTED` — no matching server is running. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `CompletionRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal error. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Notify LSP did-close

`POST /lsp/did-close`

Send `textDocument/didClose` to the running language server.

### Request Body

`application/json`: [DocumentRequest](./toolbox-schemas.md#documentrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `languageId` | string | Yes | The LSP language key (`python`, `typescript`). |
| `pathToProject` | string | Yes | Absolute project root path used as the server's workspace root. |
| `uri` | string | Yes | Document URI, typically a `file://` URI. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Close notification sent. |  |
| 400 | `BAD_REQUEST` — malformed JSON or invalid request data. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — the language server did not accept the notification in time. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `LSP_NOT_STARTED` — no matching server is running. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `DocumentRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal error. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Notify LSP did-open

`POST /lsp/did-open`

Read the document from disk and send `textDocument/didOpen` to the running language server.

### Request Body

`application/json`: [DocumentRequest](./toolbox-schemas.md#documentrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `languageId` | string | Yes | The LSP language key (`python`, `typescript`). |
| `pathToProject` | string | Yes | Absolute project root path used as the server's workspace root. |
| `uri` | string | Yes | Document URI, typically a `file://` URI. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Open notification sent. |  |
| 400 | `BAD_REQUEST` — malformed JSON, invalid request data, or the document could not be read. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — the language server did not accept the notification in time. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `LSP_NOT_STARTED` — no matching server is running. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `DocumentRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal error. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## List document symbols

`GET /lsp/document-symbols`

Query `textDocument/documentSymbol` for one document and normalize the result to flat `SymbolInfo` items.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `query` | query | string | No | Workspace-symbol search string; required on `/lsp/workspacesymbols`, omitted on `/lsp/document-symbols`. |
| `languageId` | query | string | No | The LSP language key (`python`, `typescript`); required by both symbol routes. |
| `pathToProject` | query | string | No | Absolute project root path used as the server's workspace root; required by both symbol routes. |
| `uri` | query | string | No | Document URI for `/lsp/document-symbols`; omitted on `/lsp/workspacesymbols`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Normalized document symbols. | array of [SymbolInfo](./toolbox-schemas.md#symbolinfo) (`application/json`) |
| 400 | `BAD_REQUEST` — required query parameters are missing, unsupported language was requested, or the language server returned a request error. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — the language server did not answer in time. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `LSP_NOT_STARTED` — no matching server is running. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal error. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Start an LSP server

`POST /lsp/start`

Start or reuse the language server for one `(languageId, pathToProject)` workspace.

### Request Body

`application/json`: [ServerRequest](./toolbox-schemas.md#serverrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `languageId` | string | Yes | The LSP language key (`python`, `typescript`). |
| `pathToProject` | string | Yes | Absolute project root path used as the server's workspace root. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Server started or was already running. |  |
| 400 | `BAD_REQUEST` — malformed JSON, unsupported language, or invalid request data. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — the language server did not answer during initialization. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `LSP_NOT_STARTED` — the start finished after being superseded by another start. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `ServerRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal error. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `LSP_SERVER_UNAVAILABLE` — the requested language server is unavailable or could not start. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Stop an LSP server

`POST /lsp/stop`

Stop the language server for one `(languageId, pathToProject)` workspace.

### Request Body

`application/json`: [ServerRequest](./toolbox-schemas.md#serverrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `languageId` | string | Yes | The LSP language key (`python`, `typescript`). |
| `pathToProject` | string | Yes | Absolute project root path used as the server's workspace root. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Server stopped. |  |
| 400 | `BAD_REQUEST` — malformed JSON or invalid request data. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `LSP_NOT_STARTED` — no matching server is running. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `ServerRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal error. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## List workspace symbols

`GET /lsp/workspacesymbols`

Query `workspace/symbol` for one workspace and normalize the result to flat `SymbolInfo` items.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `query` | query | string | No | Workspace-symbol search string; required on `/lsp/workspacesymbols`, omitted on `/lsp/document-symbols`. |
| `languageId` | query | string | No | The LSP language key (`python`, `typescript`); required by both symbol routes. |
| `pathToProject` | query | string | No | Absolute project root path used as the server's workspace root; required by both symbol routes. |
| `uri` | query | string | No | Document URI for `/lsp/document-symbols`; omitted on `/lsp/workspacesymbols`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Normalized workspace symbols. | array of [SymbolInfo](./toolbox-schemas.md#symbolinfo) (`application/json`) |
| 400 | `BAD_REQUEST` — required query parameters are missing, unsupported language was requested, or the language server returned a request error. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — the language server did not answer in time. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `LSP_NOT_STARTED` — no matching server is running. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal error. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---
