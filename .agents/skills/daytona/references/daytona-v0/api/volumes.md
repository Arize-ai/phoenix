# Volumes API


## Contents

- GET `/volumes`
- POST `/volumes`
- GET `/volumes/{volumeId}`}
- DELETE `/volumes/{volumeId}`}
- GET `/volumes/by-name/{name}`}

## GET `/volumes` {#daytona/tag/volumes/GET/volumes}

**List all volumes**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `includeDeleted` | query | boolean | No | Include deleted volumes in the response |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | List of all volumes | array of VolumeDto |

---

## POST `/volumes` {#daytona/tag/volumes/POST/volumes}

**Create a new volume**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Request Body

Schema: **CreateVolume**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The volume has been successfully created. | VolumeDto |

---

## GET `/volumes/{volumeId}` {#daytona/tag/volumes/GET/volumes/{volumeId}}

**Get volume details**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `volumeId` | path | string | Yes | ID of the volume |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Volume details | VolumeDto |

---

## DELETE `/volumes/{volumeId}` {#daytona/tag/volumes/DELETE/volumes/{volumeId}}

**Delete volume**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `volumeId` | path | string | Yes | ID of the volume |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Volume has been marked for deletion |  |
| 409 | Volume is in use by one or more sandboxes |  |

---

## GET `/volumes/by-name/{name}` {#daytona/tag/volumes/GET/volumes/by-name/{name}}

**Get volume details by name**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `name` | path | string | Yes | Name of the volume |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Volume details | VolumeDto |

---
