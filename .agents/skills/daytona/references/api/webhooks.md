# Webhooks API

## POST `/webhooks/organizations/{organizationId}/app-portal-access` {#daytona/tag/webhooks/POST/webhooks/organizations/{organizationId}/app-portal-access}

**Get Svix Consumer App Portal access for an organization**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `organizationId` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | App Portal access generated successfully | WebhookAppPortalAccess |

---

## GET `/webhooks/organizations/{organizationId}/initialization-status` {#daytona/tag/webhooks/GET/webhooks/organizations/{organizationId}/initialization-status}

**Get webhook initialization status for an organization**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `organizationId` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Webhook initialization status | WebhookInitializationStatus |
| 404 | Webhook initialization status not found |  |

---

## POST `/webhooks/organizations/{organizationId}/initialize` {#daytona/tag/webhooks/POST/webhooks/organizations/{organizationId}/initialize}

**Initialize webhooks for an organization**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `organizationId` | path | string | Yes | Organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Webhooks initialized successfully | WebhookInitializationStatus |

---

## POST `/webhooks/organizations/{organizationId}/refresh-endpoints` {#daytona/tag/webhooks/POST/webhooks/organizations/{organizationId}/refresh-endpoints}

**Refresh cached endpoint presence flag for an organization**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `organizationId` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Endpoint flag refreshed |  |
| 404 | Webhook initialization status not found |  |

---
