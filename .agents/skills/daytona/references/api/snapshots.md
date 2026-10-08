# Snapshots API


## Contents

- GET `/snapshots`
- POST `/snapshots`
- GET `/snapshots/{id}`}
- DELETE `/snapshots/{id}`}
- GET `/snapshots/{id}/build-logs`/build-logs}
- GET `/snapshots/{id}/build-logs-url`/build-logs-url}
- POST `/snapshots/{id}/activate`/activate}
- POST `/snapshots/{id}/deactivate`/deactivate}

## GET `/snapshots` {#daytona/tag/snapshots/GET/snapshots}

**List all snapshots**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `page` | query | number | No | Page number of the results |
| `limit` | query | number | No | Number of results per page |
| `name` | query | string | No | Filter by partial name match |
| `sourceSandboxId` | query | string | No | Filter by the ID of the sandbox the snapshot was created from |
| `sort` | query | string | No | Field to sort by |
| `order` | query | string | No | Direction to sort by |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Paginated list of all snapshots | PaginatedSnapshots |

---

## POST `/snapshots` {#daytona/tag/snapshots/POST/snapshots}

**Create a new snapshot**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Request Body

Schema: **CreateSnapshot**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The name of the snapshot |
| `imageName` | string | No | The image name of the snapshot |
| `entrypoint` | array of string | No | The entrypoint command for the snapshot |
| `cpu` | integer | No | CPU cores allocated to the resulting sandbox |
| `gpu` | integer | No | GPU units allocated to the resulting sandbox |
| `gpuType` | array of [GpuType](#schema-gputype) | No | Preferred GPU type for the resulting sandbox. |
| `memory` | integer | No | Memory allocated to the resulting sandbox in GB |
| `disk` | integer | No | Disk space allocated to the sandbox in GB |
| `buildInfo` | object | No | Build information for the snapshot |
| `regionId` | string | No | ID of the region where the snapshot will be available. Defaults to organization default region if not specified. |
| `sandboxClass` | object | No | Target sandbox class. Determines which runners can host sandboxes created from this snapshot. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The snapshot has been successfully created. | SnapshotDto |
| 400 | Bad request - Snapshots with tag ":latest" are not allowed |  |

---

## GET `/snapshots/{id}` {#daytona/tag/snapshots/GET/snapshots/{id}}

**Get snapshot by ID or name**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `id` | path | string | Yes | Snapshot ID or name |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The snapshot | SnapshotDto |
| 404 | Snapshot not found |  |

---

## DELETE `/snapshots/{id}` {#daytona/tag/snapshots/DELETE/snapshots/{id}}

**Delete snapshot**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `id` | path | string | Yes | Snapshot ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Snapshot has been deleted |  |

---

## GET `/snapshots/{id}/build-logs` {#daytona/tag/snapshots/GET/snapshots/{id}/build-logs}

**Get snapshot build logs**

This endpoint is deprecated. Use `getSnapshotBuildLogsUrl` instead.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `id` | path | string | Yes | Snapshot ID |
| `follow` | query | boolean | No | Whether to follow the logs stream |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  |  |

---

## GET `/snapshots/{id}/build-logs-url` {#daytona/tag/snapshots/GET/snapshots/{id}/build-logs-url}

**Get snapshot build logs URL**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `id` | path | string | Yes | Snapshot ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The snapshot build logs URL | Url |

---

## POST `/snapshots/{id}/activate` {#daytona/tag/snapshots/POST/snapshots/{id}/activate}

**Activate a snapshot**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `id` | path | string | Yes | Snapshot ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The snapshot has been successfully activated. | SnapshotDto |
| 400 | Bad request - Snapshot is already active, not in inactive state, or has associated snapshot runners |  |
| 404 | Snapshot not found |  |

---

## POST `/snapshots/{id}/deactivate` {#daytona/tag/snapshots/POST/snapshots/{id}/deactivate}

**Deactivate a snapshot**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `id` | path | string | Yes | Snapshot ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | The snapshot has been successfully deactivated. |  |

---
