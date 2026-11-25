# Daytona API: api-keys

Manage project and organization API keys.

## Contents

- [Get the current project API key](#get-the-current-project-api-key)
- [List organization API keys](#list-organization-api-keys)
- [Create an organization API key](#create-an-organization-api-key)
- [Get the current organization API key](#get-the-current-organization-api-key)
- [Get an organization API key](#get-an-organization-api-key)
- [Revoke an organization API key](#revoke-an-organization-api-key)
- [List project API keys](#list-project-api-keys)
- [Create a project API key](#create-a-project-api-key)
- [Get a project API key](#get-a-project-api-key)
- [Update a project API key](#update-a-project-api-key)
- [Revoke a project API key](#revoke-a-project-api-key)

## Get the current project API key

`GET /api-keys/current`

Describes the API key presented on this request.

**Auth:** `api_key`

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project API key | [ProjectApiKeyWithContext](./schemas.md#projectapikeywithcontext) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List organization API keys

`GET /orgs/{org_id}/api-keys`

**Auth:** `user_jwt` (`read:org_api_keys`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of organization API keys | [OrganizationApiKeyPage](./schemas.md#organizationapikeypage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create an organization API key

`POST /orgs/{org_id}/api-keys`

Only some organization permissions can be held by an organization API key, and only ones the current member holds; a request that names any other is refused, naming the permissions at fault.

**Auth:** `user_jwt` (`write:org_api_keys`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [CreateOrganizationApiKeyRequest](./schemas.md#createorganizationapikeyrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) \| null | No | Optional expiry; must be in the future. Absent means it never expires. |
| `name` | string | Yes | The key's display name. |
| `org_permissions` | array of string | Yes | The organization permissions the key holds. Required, with at least one entry: a key never gets a default or implied permission set. A project permission is not a valid value here. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created organization API key | [OrganizationApiKeyWithToken](./schemas.md#organizationapikeywithtoken) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the current organization API key

`GET /orgs/{org_id}/api-keys/current`

Describes the organization API key presented on this request, with the permissions it holds now.

**Auth:** `org_key`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization API key | [OrganizationApiKey](./schemas.md#organizationapikey) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization API key not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get an organization API key

`GET /orgs/{org_id}/api-keys/{key_id}`

**Auth:** `user_jwt` (`read:org_api_keys`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `key_id` | path | string (uuid) | Yes | The API key ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization API key | [OrganizationApiKey](./schemas.md#organizationapikey) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization API key not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Revoke an organization API key

`DELETE /orgs/{org_id}/api-keys/{key_id}`

**Auth:** `user_jwt` (`delete:org_api_keys`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `key_id` | path | string (uuid) | Yes | The API key ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Organization API key revoked |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization API key not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List project API keys

`GET /projects/{project_id}/api-keys`

**Auth:** `user_jwt` (`read:project_api_keys`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of project API keys | [ProjectApiKeyPage](./schemas.md#projectapikeypage) (`application/json`) |
| 400 | The project ID is invalid (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a project API key

`POST /projects/{project_id}/api-keys`

The requested project permissions must be grantable by the current member. A service-account key is also limited by that account's permissions.

**Auth:** `user_jwt` (`write:project_api_keys`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Request Body

`application/json`: [CreateProjectApiKeyRequest](./schemas.md#createprojectapikeyrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) \| null | No | Optional expiry; must be in the future. Absent means it never expires. |
| `name` | string \| null | No | The key's display name. |
| `project_permissions` | array of string | Yes | The project permissions the key holds. Required, with at least one entry: a key never gets a default or implied permission set. |
| `service_account_id` | string (uuid) \| null | No | The service account that owns this key, or `null` for the current user. |
| `sync_to_v0` | boolean \| null | No | Whether the v0 ↔ v2 key sync may copy this key to Daytona v0. Absent = `true`. Only a key a person mints in the organization's `default` project is ever copied; elsewhere the field is ignored and the response says `false`. A Daytona v0 copy can read every sandbox, snapshot and registry of the organization on Daytona v0, which has no read permissions; `false` keeps the key on this platform only. Change it later by updating the API key. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created project API key | [ProjectApiKeyWithToken](./schemas.md#projectapikeywithtoken) (`application/json`) |
| 400 | The project ID or request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The service account is archived (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a project API key

`GET /projects/{project_id}/api-keys/{key_id}`

**Auth:** `user_jwt` (`read:project_api_keys`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |
| `key_id` | path | string (uuid) | Yes | The API key ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project API key | [ProjectApiKey](./schemas.md#projectapikey) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project API key not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update a project API key

`PATCH /projects/{project_id}/api-keys/{key_id}`

Changes whether this key is configured to be copied to Daytona v0. The copy itself follows shortly afterwards — turning it off deletes the Daytona v0 key — and this key keeps working either way. Only a live key a person created in the organization's default project can be copied.

**Auth:** `user_jwt` (`delete:project_api_keys`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |
| `key_id` | path | string (uuid) | Yes | The API key ID |

### Request Body

`application/json`: [UpdateProjectApiKeyRequest](./schemas.md#updateprojectapikeyrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sync_to_v0` | boolean | No | Whether the v0 ↔ v2 key sync keeps a copy of this key on Daytona v0. `false` deletes the Daytona v0 copy (the key keeps working here); `true` copies the key to Daytona v0 again. A Daytona v0 copy can read every sandbox, snapshot and registry of the organization on Daytona v0, which has no read permissions. Only a key a person minted in the organization's `default` project is ever copied; a key imported from Daytona v0 always is. Required. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project API key | [ProjectApiKey](./schemas.md#projectapikey) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project API key not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The key was imported from Daytona v0 and is always synced (`IMPORTED_KEY_ALWAYS_SYNCED`). The key is not eligible for Daytona v0 sync (`KEY_SYNC_NOT_APPLICABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Revoke a project API key

`DELETE /projects/{project_id}/api-keys/{key_id}`

**Auth:** `user_jwt` (`delete:project_api_keys`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |
| `key_id` | path | string (uuid) | Yes | The API key ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Project API key revoked |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project API key not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
