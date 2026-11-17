# Daytona API: registries

Manage private container registry access.

## Contents

- [List project registry credentials](#list-project-registry-credentials)
- [Get registry credential metadata](#get-registry-credential-metadata)
- [Create or update registry credentials](#create-or-update-registry-credentials)
- [Delete registry credentials](#delete-registry-credentials)

## List project registry credentials

`GET /registries`

**Auth:** `api_key` (`read:registries`), `platform_token` (`read:registries`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of registry credentials | [RegistryPage](./schemas.md#registrypage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get registry credential metadata

`GET /registries/{host}`

**Auth:** `api_key` (`read:registries`), `platform_token` (`read:registries`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `host` | path | string | Yes | The registry host |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The registry credential metadata | [Registry](./schemas.md#registry) (`application/json`) |
| 400 | The registry host is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Registry not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Registry metadata is temporarily unavailable (`BAD_GATEWAY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create or update registry credentials

`PUT /registries/{host}`

Passwords are encrypted at rest and are write-only.

**Auth:** `api_key` (`write:registries`), `platform_token` (`write:registries`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `host` | path | string | Yes | The registry host |

### Request Body

`application/json`: [SetRegistryRequest](./schemas.md#setregistryrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string \| null | No | An optional user-facing description. |
| `kind` | string: `basic`, `ghcr`, `gcr`, `ecr`, `ecr_role` | No | The authentication kind. For `ecr_role`, the username is the role ARN and the password is ignored. |
| `password` | string | No | Registry password/token (max 64 KiB). Write-only — never echoed back by any public read endpoint. Required for every kind but `ecr_role`, which ignores it. |
| `username` | string | Yes | The registry username. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The registry credential metadata, updated | [Registry](./schemas.md#registry) (`application/json`) |
| 201 | The created registry credential metadata | [Registry](./schemas.md#registry) (`application/json`) |
| 400 | The host or credentials are invalid (`ECR_CREDENTIALS_INVALID`), or the account does not match the host (`ECR_ACCOUNT_MISMATCH`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Account ownership could not be verified (`ECR_OWNERSHIP_UNVERIFIABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Registry credentials are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete registry credentials

`DELETE /registries/{host}`

**Auth:** `api_key` (`delete:registries`), `platform_token` (`delete:registries`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `host` | path | string | Yes | The registry host |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Registry removed |  |
| 400 | The registry host is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Registry not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
