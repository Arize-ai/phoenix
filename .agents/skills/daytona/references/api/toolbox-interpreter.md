# Interpreter API

## GET `/process/interpreter/context` {#daytona-toolbox/tag/interpreter/GET/process/interpreter/context}

**List all user-created interpreter contexts**

Returns information about all user-created interpreter contexts (excludes default context)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ListContextsResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/process/interpreter/context` {#daytona-toolbox/tag/interpreter/POST/process/interpreter/context}

**Create a new interpreter context**

Creates a new isolated interpreter context with optional working directory and language

### Request Body

Context configuration

Schema: **CreateContextRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cwd` | string | No |  |
| `language` | string | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | InterpreterContext |
| 400 | Bad Request | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## DELETE `/process/interpreter/context/{id}` {#daytona-toolbox/tag/interpreter/DELETE/process/interpreter/context/{id}}

**Delete an interpreter context**

Deletes an interpreter context and shuts down its worker process

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `id` | path | string | Yes | Context ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | object |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/process/interpreter/execute` {#daytona-toolbox/tag/interpreter/GET/process/interpreter/execute}

**Execute code in an interpreter context**

Executes code in a specified context (or default context if not specified) via WebSocket streaming

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 101 | Switching Protocols | string |

---
