# Daytona API: secrets

Manage project secrets. Values are encrypted at rest and never returned.

## Contents

- [List project secrets](#list-project-secrets)
- [Get a secret's metadata](#get-a-secrets-metadata)
- [Create or update a secret](#create-or-update-a-secret)
- [Delete a secret](#delete-a-secret)

## List project secrets

`GET /secrets`

**Auth:** `api_key` (`read:secrets`), `platform_token` (`read:secrets`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of secrets | [SecretPage](./schemas.md#secretpage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a secret's metadata

`GET /secrets/{name}`

**Auth:** `api_key` (`read:secrets`), `platform_token` (`read:secrets`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `name` | path | string | Yes | The secret name |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The secret metadata | [Secret](./schemas.md#secret) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Secret not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create or update a secret

`PUT /secrets/{name}`

Values are encrypted at rest and are write-only.

**Auth:** `api_key` (`write:secrets`), `platform_token` (`write:secrets`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `name` | path | string | Yes | The secret name |
| `If-None-Match` | header | string \| null | No | Set to `*` to create only when the secret is absent |

### Request Body

`application/json`: [SetSecretRequest](./schemas.md#setsecretrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `allowed_domains` | array of string | No | Required per-secret egress scope: hostnames or `*.` wildcards, or `["*"]` for any verified host. Hostnames must be ASCII with at least two LDH labels (1..63 characters each, no leading/trailing hyphen; at most 253 characters total). IP literals and public-suffix wildcards are rejected. Entries are lowercased, one trailing dot is removed, and duplicates are removed in input order on create and update. Empty or omitted is rejected. Existing stored rows are not migrated. |
| `description` | string \| null | No | An optional user-facing description. |
| `value` | string | Yes | The secret value (max 64 KiB). Write-only — never echoed back. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The secret metadata, updated | [Secret](./schemas.md#secret) (`application/json`) |
| 201 | The created secret metadata | [Secret](./schemas.md#secret) (`application/json`) |
| 400 | The name, request body, or conditional header is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A concurrent request created the secret; retry the request (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 412 | The secret already exists (`SECRET_ALREADY_EXISTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Secrets are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete a secret

`DELETE /secrets/{name}`

Refused while a sandbox or bucket volume still references the secret.

**Auth:** `api_key` (`delete:secrets`), `platform_token` (`delete:secrets`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `name` | path | string | Yes | The secret name |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Secret deleted |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Secret not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A sandbox or bucket volume still references the secret, and the error names up to 20 of those the caller can read (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
