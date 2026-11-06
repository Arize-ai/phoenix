# Api Keys API


## Contents

- GET `/api-keys`
- POST `/api-keys`
- GET `/api-keys/current`
- GET `/api-keys/{name}`}
- DELETE `/api-keys/{name}`}
- DELETE `/api-keys/{userId}/{name}`/{name}}

## GET `/api-keys` {#daytona/tag/api-keys/GET/api-keys}

**List API keys**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | API keys retrieved successfully. | array of ApiKeyList |
| 500 | Error fetching API keys. |  |

---

## POST `/api-keys` {#daytona/tag/api-keys/POST/api-keys}

**Create API key**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Request Body

Schema: **CreateApiKey**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The name of the API key |
| `permissions` | array of string | Yes | The list of organization resource permissions explicitly assigned to the API key |
| `expiresAt` | string (date-time) | No | When the API key expires |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | API key created successfully. | ApiKeyResponse |

---

## GET `/api-keys/current` {#daytona/tag/api-keys/GET/api-keys/current}

**Get current API key's details**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | API key retrieved successfully. | ApiKeyList |

---

## GET `/api-keys/{name}` {#daytona/tag/api-keys/GET/api-keys/{name}}

**Get API key**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `name` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | API key retrieved successfully. | ApiKeyList |

---

## DELETE `/api-keys/{name}` {#daytona/tag/api-keys/DELETE/api-keys/{name}}

**Delete API key**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `name` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | API key deleted successfully. |  |

---

## DELETE `/api-keys/{userId}/{name}` {#daytona/tag/api-keys/DELETE/api-keys/{userId}/{name}}

**Delete API key for user**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `userId` | path | string | Yes |  |
| `name` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | API key deleted successfully. |  |

---
