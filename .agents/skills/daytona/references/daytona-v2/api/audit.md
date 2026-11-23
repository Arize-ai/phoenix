# Daytona API: audit

Discover the actions the audit log records.

## List audit actions

`GET /audit/actions`

**Auth:** `user_jwt`, `org_key`, `api_key`, `platform_token`

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The audit action catalog | [AuditActionList](./schemas.md#auditactionlist) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
