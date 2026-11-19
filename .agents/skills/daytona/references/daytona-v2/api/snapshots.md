# Daytona API: snapshots

Capture and manage sandbox snapshots.

## Contents

- [Create a snapshot from a sandbox](#create-a-snapshot-from-a-sandbox)
- [List snapshots](#list-snapshots)
- [Search snapshots](#search-snapshots)
- [Get a snapshot](#get-a-snapshot)
- [Delete a snapshot](#delete-a-snapshot)

## Create a snapshot from a sandbox

`POST /sandboxes/{sandbox_id}/snapshots`

Creates a Linux memory snapshot containing memory and disk (`full`). macOS returns `NOT_SUPPORTED_FOR_CLASS`; create an image to capture its disk instead.

**Auth:** `api_key` (`write:snapshots`, `write:sandboxes`), `platform_token` (`write:snapshots`, `write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Request Body

`application/json`: [CreateSandboxSnapshotRequest](./schemas.md#createsandboxsnapshotrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The project-unique snapshot name. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox snapshot capture | [AsyncOperation](./schemas.md#asyncoperation) (`application/json`) |
| 400 | The snapshot name is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox class does not support snapshots (`NOT_SUPPORTED_FOR_CLASS`). The sandbox is not running, its saved state is unavailable, or the snapshot name already exists (`CONFLICT`). Sandbox secrets changed during the operation; retry (`SECRETS_TRANSITION_IN_PROGRESS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List snapshots

`GET /snapshots`

**Auth:** `api_key` (`read:snapshots`), `platform_token` (`read:snapshots`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |
| `name` | query | string | No | Match this exact snapshot name. |
| `sandbox_id` | query | string | No | Return snapshots captured from this sandbox ID. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of snapshots | [SnapshotPage](./schemas.md#snapshotpage) (`application/json`) |
| 400 | The cursor or filter is invalid (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 410 | This deployment serves snapshot lists from search; use the search route named in the error's replacement field (`GONE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Search snapshots

`GET /snapshots/search`

Searches the project's snapshots using the supplied filters. Results may be briefly stale after a change.

**Auth:** `api_key` (`read:snapshots`), `platform_token` (`read:snapshots`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `q` | query | string | No | Free text over the snapshot name. A value that is a snapshot ID matches that snapshot exactly. |
| `name` | query | string | No | Match this exact snapshot name. |
| `name_prefix` | query | string | No | `name` starts with this string (case-sensitive). |
| `status` | query | array of [SnapshotStatus](./schemas.md#snapshotstatus) | No | Comma-separated capture statuses. An unrecognized value answers 400. |
| `class` | query | array of [SnapshotSearchClass](./schemas.md#snapshotsearchclass) | No | Comma-separated sandbox classes. |
| `kind` | query | array of [SnapshotKind](./schemas.md#snapshotkind) | No | Comma-separated snapshot kinds. |
| `region_ids` | query | string | No | Comma-separated home region IDs. A broader region (a geo group, or `earth`) matches every region inside it. An unknown region answers 400. Defaults to every region. |
| `sandbox_id` | query | string | No | Snapshots captured from this sandbox ID. |
| `created_start_at` | query | string (date-time) | No | Inclusive lower bound on creation time. |
| `created_end_at` | query | string (date-time) | No | Exclusive upper bound on creation time. |
| `updated_start_at` | query | string (date-time) | No | Inclusive lower bound on last-modified time. |
| `updated_end_at` | query | string (date-time) | No | Exclusive upper bound on last-modified time. |
| `sort` | query | [SnapshotSearchSort](./schemas.md#snapshotsearchsort) | No | Sort field. Defaults to `created_at`; ties break on the ID. |
| `order` | query | [SortOrder](./schemas.md#sortorder) | No | Sort order. Defaults to `desc`. |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of matching snapshots | [SnapshotSearchPage](./schemas.md#snapshotsearchpage) (`application/json`) |
| 400 | A filter, timestamp, ID, or cursor is invalid (`BAD_REQUEST`). The query string is longer than 12,288 bytes (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Search is not enabled (`SEARCH_NOT_CONFIGURED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Search is temporarily unavailable (`SEARCH_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a snapshot

`GET /snapshots/{id}`

**Auth:** `api_key` (`read:snapshots`), `platform_token` (`read:snapshots`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `wait` | query | string | No | Block until the resource reaches this status or a terminal status. Omit to return immediately. |
| `timeout_ms` | query | integer (int64) | No | Maximum time to block, in milliseconds. Default 30000, maximum 60000. |
| `id_only` | query | boolean | No | Resolve the path value strictly as an ID, without a name fallback. |
| `id` | path | string | Yes | The snapshot ID or name |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The snapshot | [Snapshot](./schemas.md#snapshot) (`application/json`) |
| 400 | The value matches both a snapshot ID and a different snapshot's name (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Snapshot not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete a snapshot

`DELETE /snapshots/{id}`

**Auth:** `api_key` (`delete:snapshots`), `platform_token` (`delete:snapshots`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The snapshot ID or name |
| `id_only` | query | boolean | No | Resolve the path value strictly as an ID, without a name fallback. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Snapshot deleted |  |
| 400 | The value matches both a snapshot ID and a different snapshot's name (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Snapshot not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A sandbox still references this snapshot (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
