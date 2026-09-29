# Audit API

## GET `/audit/organizations/{organizationId}` {#daytona/tag/audit/GET/audit/organizations/{organizationId}}

**Get audit logs for organization**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `organizationId` | path | string | Yes | Organization ID |
| `page` | query | number | No | Page number of the results |
| `limit` | query | number | No | Number of results per page |
| `from` | query | string (date-time) | No | Deprecated alias for `createdAt[gte]`. From date (ISO 8601 format). |
| `to` | query | string (date-time) | No | Deprecated alias for `createdAt[lte]`. To date (ISO 8601 format). |
| `nextToken` | query | string | No | Token for cursor-based pagination. When provided, takes precedence over page parameter. |
| `id` | query | string | No | Filter by audit log ID. |
| `actorId` | query | string | No | Filter by actor user ID. |
| `actorEmail` | query | string | No | Filter by actor email. |
| `actorApiKeyPrefix` | query | string | No | Filter by actor API key prefix. |
| `actorApiKeySuffix` | query | string | No | Filter by actor API key suffix. |
| `action` | query | string | No | Filter by action. |
| `targetType` | query | string | No | Filter by target type. |
| `targetId` | query | string | No | Filter by target ID. |
| `statusCode` | query | string | No | Filter by HTTP status code. |
| `createdAt` | query | string | No | Filter by creation timestamp. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Paginated list of organization audit logs | PaginatedAuditLogs |

---

## GET `/audit/scenarios` {#daytona/tag/audit/GET/audit/scenarios}

**Get supported audit log scenarios**

Returns the supported audit log actions grouped by target type. The list is derived at runtime from the audited routes and system events, so it always reflects what can actually appear in the audit log.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Supported audit log scenarios grouped by target type | AuditScenarios |

---
