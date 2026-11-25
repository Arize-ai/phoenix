# Daytona API: catalog

Discover supported hardware options.

## Get the CPU catalog

`GET /cpu-catalog`

Shows which CPU architectures and types are currently available in the included regions.

**Auth:** `api_key`, `platform_token`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `region_ids` | query | string | No | Comma-separated list of regions to include. Defaults to all regions. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The CPU catalog | [CpuCatalog](./schemas.md#cpucatalog) (`application/json`) |
| 400 | The region parameter names an unavailable region, or more than 64 distinct regions (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The requested region is served at another API URL (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the Mac catalog

`GET /mac-catalog`

Shows each covered region's default Mac model and, per Mac model, how many Macs a reservation can take now and its price.

**Auth:** `api_key`, `platform_token`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `region_ids` | query | string | No | Comma-separated list of regions to include. Defaults to all regions. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The Mac catalog | [MacCatalog](./schemas.md#maccatalog) (`application/json`) |
| 400 | The region list names an unknown or disabled region, or more than 64 regions (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | macOS reservations are unavailable (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The region list names a region served at another API base URL (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Prices are unavailable; try again (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List Mac models

`GET /mac-models`

**Auth:** `api_key`, `platform_token`

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The Mac models | [MacModelList](./schemas.md#macmodellist) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
