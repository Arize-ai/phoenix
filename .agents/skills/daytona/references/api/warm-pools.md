# Warm Pools API

## GET `/warm-pools` {#daytona/tag/warm-pools/GET/warm-pools}

**List warm pools for the organization**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | List of warm pools | array of WarmPool |

---

## POST `/warm-pools` {#daytona/tag/warm-pools/POST/warm-pools}

**Create a warm pool**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Request Body

Schema: **CreateWarmPool**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `snapshot` | string | Yes | The snapshot (id or name) to keep warm sandboxes for. A pool only serves sandbox creates that use this snapshot with the default OS user and no custom env, volumes or secrets. |
| `pool` | number | Yes | Number of warm sandboxes to keep ready (capped by the organization quota) |
| `target` | string | No | Target region for the warm pool. Defaults to the organization default region. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The warm pool has been created | WarmPool |

---

## PATCH `/warm-pools/{id}` {#daytona/tag/warm-pools/PATCH/warm-pools/{id}}

**Update a warm pool size**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `id` | path | string | Yes | Warm pool ID |

### Request Body

Schema: **UpdateWarmPool**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pool` | number | Yes | New desired number of warm sandboxes (0 drains the pool) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The warm pool has been updated | WarmPool |

---

## DELETE `/warm-pools/{id}` {#daytona/tag/warm-pools/DELETE/warm-pools/{id}}

**Delete a warm pool**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `id` | path | string | Yes | Warm pool ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | The warm pool has been deleted |  |

---
