# Toolbox API: sessions

Interpreter sessions for repeated code execution.

## List sessions

`GET /sessions`

List interpreter sessions in creation order.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [SessionListResponse](./toolbox-schemas.md#sessionlistresponse) (`application/json`) |

---

## Create a session

`POST /sessions`

Create a language interpreter session for subsequent code executions. Supported languages are python, typescript and javascript (case-sensitive). Unknown languages, including an empty string, return 400 UNSUPPORTED_OPERATION before kernel provisioning. Omitting kernel or requesting shell also returns 400 UNSUPPORTED_OPERATION; shell sessions use POST /processes with kind=session.

### Request Body

`application/json`: [CreateSessionRequest](./toolbox-schemas.md#createsessionrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cwd` | string \| null | No | Initial working directory. Empty uses the sandbox’s default working directory. |
| `env` | map of string | No | Environment overrides applied when the interpreter session starts. |
| `id` | string \| null | No | Optional client-chosen session id. Must be a safe identifier when present. |
| `kernel` | string \| null | No | Interpreter language, exactly `python`, `typescript` or `javascript` (case-sensitive). Unknown values, including an empty string, answer 400 `UNSUPPORTED_OPERATION` before provisioning; a supported kernel that fails to install or start answers 503 `KERNEL_UNAVAILABLE`. A language is required: `shell`, or omitting the field, answers 400 `UNSUPPORTED_OPERATION`, because shell sessions are created with `POST /processes` `kind=session`. |
| `login` | boolean | No | Not supported for interpreter sessions; answers 400 `UNSUPPORTED_OPERATION` when `true`. |
| `shell` | string \| null | No | Not supported for interpreter sessions; answers 400 `UNSUPPORTED_OPERATION` when set. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 |  | [SessionDto](./toolbox-schemas.md#sessiondto) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid session shape; `UNSUPPORTED_OPERATION` — unknown, empty or omitted kernel, shell kernel, or shell/login settings on a language session. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `NAME_CONFLICT` — duplicate session id. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body was well-formed but did not match `CreateSessionRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | `KERNEL_UNAVAILABLE` — a supported language's kernel failed to install or start. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Get a session

`GET /sessions/{id}`

Fetch a session by id.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Session id. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [SessionDto](./toolbox-schemas.md#sessiondto) (`application/json`) |
| 404 | `SESSION_NOT_FOUND` — no such session. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Delete a session

`DELETE /sessions/{id}`

Delete an interpreter session and its associated process information.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | Session id. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Session deleted. |  |
| 404 | `SESSION_NOT_FOUND` — no such session. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---
