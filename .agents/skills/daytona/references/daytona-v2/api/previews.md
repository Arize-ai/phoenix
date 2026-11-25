# Daytona API: previews

Expose sandbox ports through preview URLs.

## Contents

- [List sandbox ports](#list-sandbox-ports)
- [Get a sandbox port](#get-a-sandbox-port)
- [Set a sandbox port](#set-a-sandbox-port)
- [Delete a sandbox port](#delete-a-sandbox-port)
- [Create a sandbox preview URL](#create-a-sandbox-preview-url)
- [Create a signed sandbox preview URL](#create-a-signed-sandbox-preview-url)
- [Revoke all signed sandbox preview URLs](#revoke-all-signed-sandbox-preview-urls)

## List sandbox ports

`GET /sandboxes/{sandbox_id}/ports`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of sandbox ports | [SandboxPortPage](./schemas.md#sandboxportpage) (`application/json`) |
| 400 | The cursor is invalid (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox is deleted or being deleted (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a sandbox port

`GET /sandboxes/{sandbox_id}/ports/{port}`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |
| `port` | path | integer (int32) | Yes | The port number |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox port | [SandboxPort](./schemas.md#sandboxport) (`application/json`) |
| 400 | The port is outside 1 through 65535 (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox or port not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox is deleted or being deleted (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Set a sandbox port

`PUT /sandboxes/{sandbox_id}/ports/{port}`

Replaces the port configuration.

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |
| `port` | path | integer (int32) | Yes | The port number |

### Request Body

`application/json`: [SetSandboxPortRequest](./schemas.md#setsandboxportrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `public` | boolean | Yes | Whether the port is accessible without a credential. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox port, updated | [SandboxPort](./schemas.md#sandboxport) (`application/json`) |
| 201 | The created sandbox port | [SandboxPort](./schemas.md#sandboxport) (`application/json`) |
| 400 | The port is outside 1 through 65535 or is reserved for the sandbox daemon (2280, 2281, 22220), or the body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox is deleted or being deleted (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete a sandbox port

`DELETE /sandboxes/{sandbox_id}/ports/{port}`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |
| `port` | path | integer (int32) | Yes | The port number |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Sandbox port deleted |  |
| 400 | The port is outside 1 through 65535 (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox or port not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a sandbox preview URL

`POST /sandboxes/{sandbox_id}/ports/{port}/preview-url`

Returns the port's preview URL, exposing the port as private first when it is not already exposed.

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |
| `port` | path | integer (int32) | Yes | The port number |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created preview URL | [PreviewUrl](./schemas.md#previewurl) (`application/json`) |
| 400 | The port is outside 1 through 65535 or is reserved for the sandbox daemon (2280, 2281, 22220) (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox is deleted or being deleted (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Preview URLs are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a signed sandbox preview URL

`POST /sandboxes/{sandbox_id}/ports/{port}/signed-preview-urls`

Creates a short-lived preview link for one port. Revoking signed preview links revokes every link on the sandbox.

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |
| `port` | path | integer (int32) | Yes | The port number |

### Request Body

`application/json`: null \| [CreateSandboxSignedPreviewUrlRequest](./schemas.md#createsandboxsignedpreviewurlrequest)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created signed preview URL | [SignedPreviewUrl](./schemas.md#signedpreviewurl) (`application/json`) |
| 400 | The port or expiry is outside the supported range, or the port is reserved for the sandbox daemon (2280, 2281, 22220) (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox is deleted, being deleted, failed, lost, or stopped without being persistent (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Revoke all signed sandbox preview URLs

`POST /sandboxes/{sandbox_id}/signed-preview-urls/revoke`

Revokes every signed preview link on the sandbox, on every port. Links created afterwards work.

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Signed preview URLs revoked |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
