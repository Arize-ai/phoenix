# Daytona API: volumes

Create and manage persistent volumes.

## Contents

- [List volumes](#list-volumes)
- [Create a volume](#create-a-volume)
- [Get a volume](#get-a-volume)
- [Delete a volume](#delete-a-volume)

## List volumes

`GET /volumes`

**Auth:** `api_key` (`read:volumes`), `platform_token` (`read:volumes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of volumes | [VolumePage](./schemas.md#volumepage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a volume

`POST /volumes`

**Auth:** `api_key` (`write:volumes`), `platform_token` (`write:volumes`)

### Request Body

`application/json`: [CreateVolumeRequest](./schemas.md#createvolumerequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bucket` | null \| [BucketOptions](./schemas.md#bucketoptions) | No | Settings for an existing bucket. Omit them to create a managed bucket. |
| `name` | string | Yes | The project-unique volume name. |
| `size_gib` | integer (int32) \| null | No | Scratch size in GiB. Defaults to 100. Disk volumes only — supplying it on a bucket volume is a 400. |
| `type` | null \| [VolumeType](./schemas.md#volumetype) | No | The volume type. Defaults to `disk`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created volume | [Volume](./schemas.md#volume) (`application/json`) |
| 400 | The name, type, size, or bucket settings are invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The required permission is missing (`FORBIDDEN`). Disk volumes are unavailable to the organization (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A volume with that name already exists (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | The bucket could not be created (`BUCKET_CREATE_FAILED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Bucket volumes are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a volume

`GET /volumes/{id}`

**Auth:** `api_key` (`read:volumes`), `platform_token` (`read:volumes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The volume ID or name |
| `id_only` | query | boolean | No | Resolve the path value strictly as an ID, without a name fallback. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The volume | [Volume](./schemas.md#volume) (`application/json`) |
| 400 | The value matches both a volume ID and a different volume's name (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Volume not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete a volume

`DELETE /volumes/{id}`

Deletion is asynchronous. Repeating the request after the deletion
completes confirms it without starting another.

**Auth:** `api_key` (`delete:volumes`), `platform_token` (`delete:volumes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The volume ID or name |
| `id_only` | query | boolean | No | Resolve the path value strictly as an ID, without a name fallback. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the volume deletion | [AsyncOperation](./schemas.md#asyncoperation) (`application/json`) |
| 204 | Volume deleted |  |
| 400 | The value matches both a volume ID and a different volume's name (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Volume not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The volume is attached to a sandbox (`CONFLICT`). The volume's bucket is not empty (`BUCKET_NOT_EMPTY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | The bucket could not be deleted (`BUCKET_DELETE_FAILED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
