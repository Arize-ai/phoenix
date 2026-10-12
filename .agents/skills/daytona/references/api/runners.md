# Runners API


## Contents

- GET `/runners`
- POST `/runners`
- GET `/runners/me`
- GET `/runners/me/snapshots`
- GET `/runners/by-sandbox/{sandboxId}`}
- GET `/runners/by-snapshot-ref`
- GET `/runners/{id}`}
- DELETE `/runners/{id}`}
- GET `/runners/{id}/full`/full}
- PATCH `/runners/{id}/scheduling`/scheduling}
- PATCH `/runners/{id}/draining`/draining}
- POST `/runners/healthcheck`

## GET `/runners` {#daytona/tag/runners/GET/runners}

**List all runners**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `regionId` | query | string | No | Filter runners by region ID |
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | array of Runner |

---

## POST `/runners` {#daytona/tag/runners/POST/runners}

**Create runner**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Request Body

Schema: **CreateRunner**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `regionId` | string | Yes |  |
| `name` | string | Yes |  |
| `tags` | array of string | No | Tags to associate with the runner |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 |  | CreateRunnerResponse |

---

## GET `/runners/me` {#daytona/tag/runners/GET/runners/me}

**Get info for authenticated runner**

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Runner info | RunnerFull |

---

## GET `/runners/me/snapshots` {#daytona/tag/runners/GET/runners/me/snapshots}

**Get snapshot refs for authenticated runner**

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Snapshot refs the runner is expected to have | array |

---

## GET `/runners/by-sandbox/{sandboxId}` {#daytona/tag/runners/GET/runners/by-sandbox/{sandboxId}}

**Get runner by sandbox ID**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `sandboxId` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | RunnerFull |

---

## GET `/runners/by-snapshot-ref` {#daytona/tag/runners/GET/runners/by-snapshot-ref}

**Get runners by snapshot ref**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `ref` | query | string | Yes | Snapshot ref |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | array of RunnerSnapshotDto |

---

## GET `/runners/{id}` {#daytona/tag/runners/GET/runners/{id}}

**Get runner by ID**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `id` | path | string | Yes | Runner ID |
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | Runner |

---

## DELETE `/runners/{id}` {#daytona/tag/runners/DELETE/runners/{id}}

**Delete runner**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `id` | path | string | Yes | Runner ID |
| `force` | query | boolean | No | Delete the runner without waiting for sandboxes already marked for destruction. Requires the runner to have stopped reporting as ready. |
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 |  |  |

---

## GET `/runners/{id}/full` {#daytona/tag/runners/GET/runners/{id}/full}

**Get runner by ID**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `id` | path | string | Yes | Runner ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | RunnerFull |

---

## PATCH `/runners/{id}/scheduling` {#daytona/tag/runners/PATCH/runners/{id}/scheduling}

**Update runner scheduling status**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `id` | path | string | Yes | Runner ID |
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | Runner |

---

## PATCH `/runners/{id}/draining` {#daytona/tag/runners/PATCH/runners/{id}/draining}

**Update runner draining status**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `id` | path | string | Yes | Runner ID |
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | Runner |

---

## POST `/runners/healthcheck` {#daytona/tag/runners/POST/runners/healthcheck}

**Runner healthcheck**

Endpoint for version 2 runners to send healthcheck and metrics. Updates lastChecked timestamp and runner metrics.

### Request Body

Schema: **RunnerHealthcheck**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `metrics` | object | No | Runner metrics |
| `serviceHealth` | array of [RunnerServiceHealth](#schema-runnerservicehealth) | No | Health status of individual services on the runner |
| `domain` | string | No | Runner domain |
| `proxyUrl` | string | No | Runner proxy URL |
| `apiUrl` | string | No | Runner API URL |
| `appVersion` | string | Yes | Runner app version |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Healthcheck received |  |

---
