# Secret API


## Contents

- GET `/secret`
- POST `/secret`
- GET `/secret/paginated`
- GET `/secret/{secretId}`}
- PATCH `/secret/{secretId}`}
- DELETE `/secret/{secretId}`}

## GET `/secret` {#daytona/tag/secret/GET/secret}

**List secrets**

This endpoint is deprecated and fails for organizations with more than 1500 secrets. Use `listSecretsPaginated` instead.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | List of all secrets (metadata only, values are not returned) | array of Secret |

---

## POST `/secret` {#daytona/tag/secret/POST/secret}

**Create secret**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Request Body

Schema: **CreateSecret**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Secret name (alphanumeric, hyphens, underscores) |
| `value` | string | Yes | Secret value |
| `description` | string | No | Optional description of the secret |
| `hosts` | array of string | No | Allowed hosts this secret may be sent to |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The secret has been successfully created. | Secret |

---

## GET `/secret/paginated` {#daytona/tag/secret/GET/secret/paginated}

**List secrets with pagination**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `cursor` | query | string | No | Pagination cursor from a previous response |
| `limit` | query | number | No | Number of results per page |
| `name` | query | string | No | Filter by partial name match |
| `sort` | query | string | No | Field to sort by |
| `order` | query | string | No | Direction to sort by |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Paginated list of secrets (metadata only, values are not returned) | ListSecretsResponse |

---

## GET `/secret/{secretId}` {#daytona/tag/secret/GET/secret/{secretId}}

**Get secret**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `secretId` | path | string | Yes | ID of the secret |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The secret metadata (value is not returned) | Secret |

---

## PATCH `/secret/{secretId}` {#daytona/tag/secret/PATCH/secret/{secretId}}

**Update secret**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `secretId` | path | string | Yes | ID of the secret |

### Request Body

Schema: **UpdateSecret**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | string | No | New secret value |
| `description` | string | No | Optional description of the secret |
| `hosts` | array of string | No | Allowed hosts this secret may be sent to |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The secret has been successfully updated. | Secret |

---

## DELETE `/secret/{secretId}` {#daytona/tag/secret/DELETE/secret/{secretId}}

**Delete secret**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `secretId` | path | string | Yes | ID of the secret |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | The secret has been successfully deleted. |  |

---
