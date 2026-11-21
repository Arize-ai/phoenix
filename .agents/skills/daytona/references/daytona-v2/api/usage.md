# Daytona API: usage

Read project usage.

## Contents

- [Get current sandbox usage](#get-current-sandbox-usage)
- [Get sandbox usage history](#get-sandbox-usage-history)
- [Get the project's spend budget](#get-the-projects-spend-budget)
- [Get a project usage report](#get-a-project-usage-report)

## Get current sandbox usage

`GET /sandboxes/{sandbox_id}/usage`

Returns the latest resource measurements for a running sandbox.

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox usage | [SandboxUsage](./schemas.md#sandboxusage) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Current usage is unavailable (`BAD_GATEWAY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get sandbox usage history

`GET /sandboxes/{sandbox_id}/usage/history`

Returns resource usage in minute or hour buckets for the requested half-open time range.

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |
| `start_at` | query | string (date-time) | No | Start of the time range, inclusive. Defaults to 24 hours before `end_at`. |
| `end_at` | query | string (date-time) | No | End of the time range, exclusive. Defaults to now. |
| `resolution` | query | string: `minute`, `hour` | No | Bucket size. Defaults to `minute`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox usage history | [SandboxUsageHistory](./schemas.md#sandboxusagehistory) (`application/json`) |
| 400 | A time-range parameter or resolution is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the project's spend budget

`GET /usage/budget`

Returns the project's monthly spend budget and its current status. A recent change can take up to 30 seconds to appear.

**Auth:** `api_key` (`read:spending`), `platform_token` (`read:spending`)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project's spend budget | [ProjectBudget](./schemas.md#projectbudget) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | The spend budget is temporarily unavailable (`BAD_GATEWAY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a project usage report

`GET /usage/report`

Returns sandbox usage for the project. Changes can take up to 30 seconds to appear.

**Auth:** `api_key` (`read:spending`), `platform_token` (`read:spending`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `start_at` | query | string (date-time) | No | Start of the time range, inclusive. Defaults to 24 hours before `end_at`. |
| `end_at` | query | string (date-time) | No | End of the time range, exclusive. Defaults to now. |
| `resolution` | query | string: `hour`, `day` | No | Bucket size. Defaults to `hour`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The usage report | [UsageReport](./schemas.md#usagereport) (`application/json`) |
| 400 | A time-range parameter or resolution is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
