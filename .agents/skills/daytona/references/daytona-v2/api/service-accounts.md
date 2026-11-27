# Daytona API: service-accounts

Manage service accounts.

## Contents

- [List service accounts](#list-service-accounts)
- [Create a service account](#create-a-service-account)
- [Get a service account](#get-a-service-account)
- [Update a service account](#update-a-service-account)
- [Archive a service account](#archive-a-service-account)
- [Preview a service account update](#preview-a-service-account-update)

## List service accounts

`GET /orgs/{org_id}/service-accounts`

**Auth:** `user_jwt` (`read:service_accounts`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of service accounts | [OrganizationServiceAccountPage](./schemas.md#organizationserviceaccountpage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a service account

`POST /orgs/{org_id}/service-accounts`

Creates a named account for organization automation.

**Auth:** `user_jwt` (`write:service_accounts`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [CreateServiceAccountRequest](./schemas.md#createserviceaccountrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string \| null | No | The service account purpose, or `null` when omitted. |
| `name` | string | Yes | The service account name. |
| `roles` | array of string | Yes | The role identifiers to assign. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created service account | [OrganizationServiceAccount](./schemas.md#organizationserviceaccount) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The organization is a personal organization, which cannot have service accounts (`CONFLICT`). The name already exists in the organization (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a service account

`GET /orgs/{org_id}/service-accounts/{service_account_id}`

**Auth:** `user_jwt` (`read:service_accounts`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `service_account_id` | path | string (uuid) | Yes | The service account ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The service account | [OrganizationServiceAccount](./schemas.md#organizationserviceaccount) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Service account not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update a service account

`PATCH /orgs/{org_id}/service-accounts/{service_account_id}`

Updates the name, description, or complete role set. Narrowing roles may revoke API keys.

**Auth:** `user_jwt` (`write:service_accounts`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `service_account_id` | path | string (uuid) | Yes | The service account ID |

### Request Body

`application/json`: [UpdateServiceAccountRequest](./schemas.md#updateserviceaccountrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string \| null | No | The replacement description; `null` clears it. |
| `name` | string \| null | No | The replacement name. |
| `roles` | array of string \| null | No | The replacement role identifiers. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The service account | [OrganizationServiceAccount](./schemas.md#organizationserviceaccount) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Service account not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The service account is archived (`CONFLICT`). The name already exists in the organization (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Archive a service account

`DELETE /orgs/{org_id}/service-accounts/{service_account_id}`

Archives the service account and revokes its active API keys.

**Auth:** `user_jwt` (`delete:service_accounts`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `service_account_id` | path | string (uuid) | Yes | The service account ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Service account archived |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Service account not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Preview a service account update

`POST /orgs/{org_id}/service-accounts/{service_account_id}/update-preview`

**Auth:** `user_jwt` (`write:service_accounts`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `service_account_id` | path | string (uuid) | Yes | The service account ID |

### Request Body

`application/json`: [PreviewServiceAccountUpdateRequest](./schemas.md#previewserviceaccountupdaterequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string \| null | No | The replacement description; `null` clears it. |
| `name` | string \| null | No | The replacement name. |
| `roles` | array of string \| null | No | The replacement role identifiers. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The change impact | [ChangeImpact](./schemas.md#changeimpact) (`application/json`) |
| 400 | The request is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Service account not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The service account is archived (`CONFLICT`). The name already exists in the organization (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
