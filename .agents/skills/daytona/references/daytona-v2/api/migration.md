# Daytona API: migration

Review what moved from Daytona v0 and import archived Daytona v0 sandboxes.

## List Daytona v0 sandboxes

`GET /migration/v0/sandboxes`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of Daytona v0 sandboxes | [V0SandboxPage](./schemas.md#v0sandboxpage) (`application/json`) |
| 400 | The pagination cursor is invalid (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`). The request is not scoped to the organization's default project (`V0_MIGRATION_DEFAULT_PROJECT_ONLY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Importing from Daytona v0 is temporarily unavailable (`V0_BRIDGE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a Daytona v0 sandbox import

`POST /migration/v0/sandboxes/{v0_id}/import`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `v0_id` | path | string | Yes | The sandbox ID on Daytona v0 |

### Request Body

Optional import settings; an empty body uses the defaults

`application/json`: null \| [CreateV0SandboxImportRequest](./schemas.md#createv0sandboximportrequest)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The Daytona v0 sandbox import | [V0SandboxImport](./schemas.md#v0sandboximport) (`application/json`) |
| 201 | The created Daytona v0 sandbox import | [V0SandboxImport](./schemas.md#v0sandboximport) (`application/json`) |
| 400 | The request body or sandbox settings are invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 402 | The organization is suspended (`ORG_SUSPENDED`), or the project reached its monthly budget (`PROJECT_BUDGET_EXCEEDED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`). The request is not scoped to the organization's default project (`V0_MIGRATION_DEFAULT_PROJECT_ONLY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Source sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The Daytona v0 sandbox cannot be imported (`V0_SANDBOX_NOT_IMPORTABLE`). The sandbox import conflicts with an existing resource (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Importing from Daytona v0 is temporarily unavailable (`V0_BRIDGE_UNAVAILABLE`). The backup image cannot be accessed (`V0_BACKUP_REGISTRY_UNCONFIGURED`). Sandbox creation is temporarily unavailable (`PLACEMENT_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the Daytona v0 migration summary

`GET /migration/v0/summary`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The Daytona v0 migration summary; counts include only migrated resources available through this endpoint | [V0MigrationSummary](./schemas.md#v0migrationsummary) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`). The request is not scoped to the organization's default project (`V0_MIGRATION_DEFAULT_PROJECT_ONLY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
