# Docker Registry API


## Contents

- GET `/docker-registry`
- POST `/docker-registry`
- GET `/docker-registry/registry-push-access`
- GET `/docker-registry/{id}`}
- PATCH `/docker-registry/{id}`}
- DELETE `/docker-registry/{id}`}

## GET `/docker-registry` {#daytona/tag/docker-registry/GET/docker-registry}

**List registries**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | List of all docker registries | array of DockerRegistry |

---

## POST `/docker-registry` {#daytona/tag/docker-registry/POST/docker-registry}

**Create registry**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Request Body

Schema: **CreateDockerRegistry**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Registry name |
| `url` | string | Yes | Registry URL |
| `username` | string | Yes | Registry username |
| `password` | string | Yes | Registry password |
| `project` | string | No | Registry project |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The docker registry has been successfully created. | DockerRegistry |

---

## GET `/docker-registry/registry-push-access` {#daytona/tag/docker-registry/GET/docker-registry/registry-push-access}

**Get temporary registry access for pushing snapshots**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `regionId` | query | string | No | ID of the region where the snapshot will be available (defaults to organization default region) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Temporary registry access has been generated | RegistryPushAccessDto |

---

## GET `/docker-registry/{id}` {#daytona/tag/docker-registry/GET/docker-registry/{id}}

**Get registry**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `id` | path | string | Yes | ID of the docker registry |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The docker registry | DockerRegistry |

---

## PATCH `/docker-registry/{id}` {#daytona/tag/docker-registry/PATCH/docker-registry/{id}}

**Update registry**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `id` | path | string | Yes | ID of the docker registry |

### Request Body

Schema: **UpdateDockerRegistry**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Registry name |
| `url` | string | Yes | Registry URL |
| `username` | string | Yes | Registry username |
| `password` | string | No | Registry password |
| `project` | string | No | Registry project |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The docker registry has been successfully updated. | DockerRegistry |

---

## DELETE `/docker-registry/{id}` {#daytona/tag/docker-registry/DELETE/docker-registry/{id}}

**Delete registry**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `id` | path | string | Yes | ID of the docker registry |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | The docker registry has been successfully deleted. |  |

---
