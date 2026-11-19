# Daytona API: sandboxes

Create, inspect, and manage sandboxes.

## Contents

- [Get the sandbox event stream](#get-the-sandbox-event-stream)
- [Mint a sandbox event ticket](#mint-a-sandbox-event-ticket)
- [List sandboxes](#list-sandboxes)
- [Create a sandbox](#create-a-sandbox)
- [Wait for sandboxes](#wait-for-sandboxes)
- [Create a sandbox from a snapshot](#create-a-sandbox-from-a-snapshot)
- [Create a macOS sandbox](#create-a-macos-sandbox)
- [Search sandboxes](#search-sandboxes)
- [Get a sandbox](#get-a-sandbox)
- [Delete a sandbox](#delete-a-sandbox)
- [Mint a sandbox access token](#mint-a-sandbox-access-token)
- [Get a sandbox's build logs URL](#get-a-sandboxs-build-logs-url)
- [Get sandbox console logs](#get-sandbox-console-logs)
- [Sign a sandbox file URL](#sign-a-sandbox-file-url)
- [Fork a sandbox](#fork-a-sandbox)
- [Set sandbox labels](#set-sandbox-labels)
- [Update a sandbox lifecycle policy](#update-a-sandbox-lifecycle-policy)
- [Get sandbox logs](#get-sandbox-logs)
- [Get the sandbox network policy](#get-the-sandbox-network-policy)
- [Set a sandbox network policy](#set-a-sandbox-network-policy)
- [Pause a sandbox](#pause-a-sandbox)
- [Reset a sandbox idle timer](#reset-a-sandbox-idle-timer)
- [Restart a sandbox](#restart-a-sandbox)
- [Resume a sandbox](#resume-a-sandbox)
- [Get the sandbox secrets](#get-the-sandbox-secrets)
- [Set the sandbox secrets](#set-the-sandbox-secrets)
- [Rotate a sandbox signing key](#rotate-a-sandbox-signing-key)
- [Start a sandbox](#start-a-sandbox)
- [Stop a sandbox](#stop-a-sandbox)

## Get the sandbox event stream

`GET /events/{region}`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `region` | path | string | Yes | The event stream region tag, or `_` when sandbox IDs carry no region tag |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 101 | The sandbox event stream |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The sandbox event stream is temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Mint a sandbox event ticket

`POST /events/{region}/ticket`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `region` | path | string | Yes | The event stream region tag, or `_` when sandbox IDs carry no region tag |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox event ticket | [SandboxEventTicket](./schemas.md#sandboxeventticket) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The sandbox event ticket is temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List sandboxes

`GET /sandboxes`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of sandboxes | [SandboxPage](./schemas.md#sandboxpage) (`application/json`) |
| 400 | The cursor is invalid (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 410 | This deployment serves sandbox lists from search; use the search route named in the error's replacement field (`GONE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a sandbox

`POST /sandboxes`

Creates a Linux sandbox when Linux sandboxes are available to the organization.

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Request Body

`application/json`: [CreateSandboxRequest](./schemas.md#createsandboxrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cores_max` | number (double) \| null | No | Maximum CPU, in cores (1 core = 2 vCPUs): the size the sandbox boots at. A positive multiple of 0.5; the system or plan cap when omitted. |
| `cpu` | number (double) \| null | No | Reserved CPU, in cores (1 core = 2 vCPUs). |
| `cpu_arch` | string \| null | No | The CPU architecture the sandbox requires. Omit it to use the region default — unless the image was imported from Daytona v0 and `cpu_type` is omitted too, in which case the architecture that image was imported for is used. |
| `cpu_type` | string \| null | No | Preferred CPU type. |
| `create_timeout_seconds` | integer (int64) \| null | No | Seconds allowed for the sandbox to reach `running`. Defaults to 3600; `-1` uses the maximum. |
| `disk_max_mib` | integer (int32) \| null | No | Per-sandbox disk limit in MiB. Same semantics as `cores_max`; when restoring a snapshot, it must equal the captured disk size or be absent. |
| `disk_mib` | integer (int32) \| null | No | Writable disk size in MiB. |
| `env` | map of string | No | Sandbox-specific environment variables (real values, verbatim). Names must be POSIX-ish identifiers (`[A-Za-z_][A-Za-z0-9_]*`). Names the platform reserves for its own use, including every `DAYTONA_*` name other than `DAYTONA_API_URL`, `DAYTONA_OTEL_ENDPOINT` and `DAYTONA_DOCKER_START` (so `DAYTONA_SANDBOX_TOKEN` too), fail the create with 400 naming the key. |
| `idempotency_key` | string \| null | No | Key used to replay the same create operation safely. |
| `image` | string \| null | No | Image name or `img_…` id. Omit to boot the platform default image. |
| `labels` | map of string | No | User-defined labels. |
| `lifecycle_policy` | null \| [UpdateSandboxLifecyclePolicyRequest](./schemas.md#updatesandboxlifecyclepolicyrequest) | No | Automatic timeout and idle-expiry behavior. |
| `memory_max_mib` | integer (int32) \| null | No | Per-sandbox memory limit in MiB; same semantics as `cores_max`. |
| `memory_mib` | integer (int32) \| null | No | Reserved memory in MiB. |
| `name` | string \| null | No | Sandbox name. A name is generated when omitted. |
| `network_policy` | null \| [SetSandboxNetworkPolicyRequest](./schemas.md#setsandboxnetworkpolicyrequest) | No | Outbound network rules applied to the sandbox. |
| `ports` | array of [PortMapping](./schemas.md#portmapping) | No | Ports exposed when the sandbox starts. |
| `region_id` | string \| null | No | The region to create the sandbox in. Any listed region, including `earth` (anywhere). When omitted: the project's default region, then the organization's, then `earth`. |
| `secrets` | array of string | No | Secret names made available to the sandbox. |
| `spot` | boolean | No | Whether to use discounted interruptible capacity. Defaults to `false`. |
| `user` | string \| null | No | Default operating-system user. |
| `volumes` | array of [VolumeMount](./schemas.md#volumemount) | No | Volumes mounted in the sandbox. |
| `wait_seconds` | integer (int64) \| null | No | Seconds to wait before returning. Defaults to 3; `0` returns immediately. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox create | [SandboxCreateOperation](./schemas.md#sandboxcreateoperation) (`application/json`) |
| 400 | The body, create timeout, or wait duration is invalid (`BAD_REQUEST`, `CREATE_TTL_OUT_OF_RANGE`, or `DEFAULT_IMAGE_NOT_CONFIGURED` when no image is given and no default image is set) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 402 | The organization is suspended (`ORG_SUSPENDED`), or the project reached its monthly budget (`PROJECT_BUDGET_EXCEEDED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The required permission is missing (`FORBIDDEN`). The requested sandbox configuration is unavailable to the organization (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Image not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The image or requested sandbox configuration conflicts with the request (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 413 | The request body is too large (`CREATE_BODY_TOO_LARGE`). The request metadata is too large (`PAYLOAD_TOO_LARGE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Sandbox creation is temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Wait for sandboxes

`GET /sandboxes/batch-wait`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `ids` | query | string | Yes | Comma-separated sandbox IDs. At most 200 IDs are accepted. |
| `wait` | query | string | No | Block until the resource reaches this status or a terminal status. Omit to return immediately. |
| `wait_exact` | query | string | No | Exact status to wait for. Other terminal states do not satisfy it. |
| `timeout_ms` | query | integer (int64) | No | Maximum time to block, in milliseconds. Default 30000, maximum 60000. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandboxes | [SandboxList](./schemas.md#sandboxlist) (`application/json`) |
| 400 | The ID list is empty or exceeds 200 entries, or the wait target is not a sandbox status (`BAD_REQUEST`). The query string is longer than 12,288 bytes (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a sandbox from a snapshot

`POST /sandboxes/from-snapshot`

Creates a Linux sandbox from a snapshot when Linux sandboxes are available to the organization.

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Request Body

`application/json`: [CreateSandboxFromSnapshotRequest](./schemas.md#createsandboxfromsnapshotrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `create_timeout_seconds` | integer (int64) \| null | No | Seconds allowed for the sandbox to reach `running`. Defaults to 3600; `-1` uses the maximum. |
| `idempotency_key` | string \| null | No | Key used to replay the same create operation safely. |
| `labels` | map of string | No | User-defined labels. |
| `lifecycle_policy` | null \| [UpdateSandboxLifecyclePolicyRequest](./schemas.md#updatesandboxlifecyclepolicyrequest) | No | Automatic timeout and idle-expiry behavior. |
| `name` | string \| null | No | Sandbox name. A name is generated when omitted. |
| `ports` | array of [PortMapping](./schemas.md#portmapping) | No | Ports exposed when the sandbox starts. |
| `region_id` | string \| null | No | The region to create the sandbox in. When omitted, the snapshot's region. |
| `snapshot` | string | Yes | Snapshot name or `snap_…` id. Required. |
| `wait_seconds` | integer (int64) \| null | No | Seconds to wait before returning. Defaults to 3; `0` returns immediately. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox create from a snapshot | [SandboxCreateOperation](./schemas.md#sandboxcreateoperation) (`application/json`) |
| 400 | The body, region, create timeout, or wait duration is invalid (`BAD_REQUEST` or `CREATE_TTL_OUT_OF_RANGE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 402 | The organization is suspended (`ORG_SUSPENDED`), or the project reached its monthly budget (`PROJECT_BUDGET_EXCEEDED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The required permission is missing (`FORBIDDEN`). Linux sandboxes are unavailable to the organization (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Snapshot not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The snapshot is not ready (`SNAPSHOT_NOT_READY`) or conflicts with the request (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 413 | The request body is too large (`CREATE_BODY_TOO_LARGE`). The request metadata is too large (`PAYLOAD_TOO_LARGE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Sandbox creation is temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a macOS sandbox

`POST /sandboxes/macos`

Creates a macOS sandbox on a Mac reservation of the organization. The sizes of the sandboxes on one Mac must fit that Mac. An accepted create can wait for space on a Mac until `create_timeout_seconds`.

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Request Body

`application/json`: [CreateMacosSandboxRequest](./schemas.md#createmacossandboxrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auto_renew` | boolean \| null | No | With `reservation: "new"` only: whether the bought reservation renews itself while a sandbox is active on it. Defaults to the organization's auto-reserve setting. |
| `cores` | integer (int32) \| null | No | CPU cores for this sandbox, at least 4. A Mac core is one CPU of the Mac (Apple Silicon has no SMT). Omitted or null uses the Mac model's default size (`default_size` in `GET /mac-models`). |
| `create_timeout_seconds` | integer (int64) \| null | No | Seconds the sandbox can take to reach `running`: 3600 by default, or 86400 for an image captured on an earlier version of macOS sandboxes. `-1` uses the maximum, 86400. After this time, the platform deletes the sandbox. The time includes the wait for a Mac. A reservation that this create bought stays bought and charged after that delete. |
| `disk_mib` | integer (int32) \| null | No | Disk for this sandbox in MiB, macOS included, at least 81920. Omitted or null uses the Mac model's default size (`default_size` in `GET /mac-models`). For a create from a captured image, omitted or null uses the image's `disk_mib`, and a smaller value returns 400. The disk and the disk volumes must fit the disk space of the sandbox's Mac (`sandbox_disk_mib` in `GET /mac-models`). |
| `env` | map of string | No | Sandbox-specific environment variables. Names must be valid environment variable names. |
| `idempotency_key` | string \| null | No | Idempotency key; the `Idempotency-Key` header wins if both are set. It also covers a reservation the create buys: a retry never buys two. |
| `image` | string | Yes | The macOS image, by name or `img_…` id: a platform macOS image, typically `base-macos`, or a macOS image of this project in the request's region, such as an image captured from a macOS sandbox. |
| `labels` | map of string | No | User-defined labels. Not visible inside the sandbox. |
| `lifecycle_policy` | null \| [UpdateSandboxLifecyclePolicyRequest](./schemas.md#updatesandboxlifecyclepolicyrequest) | No | Sandbox lifecycle policy: idle stop and delete timeouts and a wall-clock deadline. Use `POST /sandboxes/{id}/pause` to pause a macOS sandbox. Project lifecycle defaults do not apply to macOS: omitted fields use platform defaults. |
| `memory_mib` | integer (int32) \| null | No | Memory for this sandbox in MiB, at least 4096. Omitted or null uses the Mac model's default size (`default_size` in `GET /mac-models`). |
| `name` | string \| null | No | Optional sandbox name (defaults to `sandbox-<short-id>`). |
| `network_policy` | null \| [SetSandboxNetworkPolicyRequest](./schemas.md#setsandboxnetworkpolicyrequest) | No | Egress policy, as on the Linux create: enforced from the sandbox's first boot. Change it later with `PUT /sandboxes/{id}/network-policy`. |
| `persistent` | boolean | No | Keep the sandbox's disk and machine across stop and start, and its memory across pause and resume. A start can run on any Mac of the organization. After a start on a different Mac, iCloud asks the user to sign in again. A reservation end or a Mac failure stops a sandbox that has started and never deletes it. |
| `ports` | array of [PortMapping](./schemas.md#portmapping) | No | Ports exposed when the sandbox starts. |
| `region_id` | string \| null | No | The region to create the sandbox in. When omitted: the named reservation's region. Otherwise, when Macs are offered in exactly one region, that region; when they are offered in several, the project's or organization's default region if it is one of them, else `region_id` is required (`400 BAD_REQUEST`). With no Mac region offered, the project's default region, then the organization's, then `earth`. |
| `reservation` | string \| null | No | Omitted uses any Mac reservation of the organization in the region that fits this size. "new" buys a reservation of the cheapest available Mac model that fits this size. A reservation ID uses only that reservation. An accepted create can wait for space on a Mac until `create_timeout_seconds`. |
| `secrets` | array of string | No | Names of project secrets to attach. Secret values are used only for requests to their allowed hosts. |
| `volumes` | array of [VolumeMount](./schemas.md#volumemount) | No | Disk volumes to attach, as on Linux: at most 8, each read-write. Each volume uses its `size_gib` (100 GiB when omitted) of disk space on the sandbox's Mac, beside the sandbox's disk. A sandbox with volumes cannot be persistent. A bucket volume returns 400. |
| `wait_seconds` | integer (int64) \| null | No | Seconds to hold the response until the sandbox is `running`, capped at 3 by default. Omitted uses the cap, `0` returns immediately, and a negative value returns 400. The response carries the status reached when the wait ends. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the macOS sandbox create | [SandboxCreateOperation](./schemas.md#sandboxcreateoperation) (`application/json`) |
| 400 | The request body, size, or region is invalid, or multiple macOS regions are available without a matching project or organization default (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 402 | The organization is suspended (`ORG_SUSPENDED`). The project reached its monthly budget (`PROJECT_BUDGET_EXCEEDED`). The organization's balance is too low (`INSUFFICIENT_BALANCE`). The charge did not succeed (`CHARGE_FAILED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The required permission is missing (`FORBIDDEN`). macOS sandboxes are unavailable (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Image or reservation not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The image or the reservation cannot serve this create (`CONFLICT`). The Macs of the organization have no space for this size (`NO_FREE_SLOT`), or the Mac with space is low on free disk space (`MAC_DISK_FULL`). The organization has no Mac reservation in the region and auto-reserve is off (`NO_ACTIVE_RESERVATION`). Auto-reserve reached the organization's limit of auto-reserved Macs (`AUTO_RESERVE_LIMIT_REACHED`), or found no Mac to reserve (`NO_MAC_AVAILABLE`). The idempotency key was used for a create of another size (`IDEMPOTENCY_KEY_REUSED`). | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 413 | The request body is too large (`CREATE_BODY_TOO_LARGE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | The organization's Mac reservation limit could not be verified (`BAD_GATEWAY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The sandbox cannot be created now (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Search sandboxes

`GET /sandboxes/search`

Searches the project's sandboxes using the supplied filters. Results may be briefly stale after a change.

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `q` | query | string | No | Free text over the sandbox `name` and `image_ref`. A value that is a sandbox ID matches that sandbox exactly. |
| `name_prefix` | query | string | No | `name` starts with this string (case-sensitive). |
| `id_prefix` | query | string | No | The sandbox ID starts with this string. |
| `status` | query | array of [SandboxStatus](./schemas.md#sandboxstatus) | No | Comma-separated lifecycle statuses. An unrecognized value answers 400. |
| `class` | query | array of [SandboxClass](./schemas.md#sandboxclass) | No | Comma-separated sandbox classes. |
| `region_ids` | query | string | No | Comma-separated region IDs. A broader region (a geo group, or `earth`) matches every region inside it. An unknown region answers 400. Defaults to every region. |
| `image_ref` | query | string | No | Exact image reference. |
| `image_ref_prefix` | query | string | No | `image_ref` starts with this string. |
| `labels` | query | string | No | Label containment filter: a JSON-encoded object `{"k":"v",...}`; only sandboxes whose labels contain every pair match. A malformed or non-object value answers 400. The whole query string, URL-encoded, may be at most 12,288 bytes; a longer one answers 400. |
| `persistent` | query | boolean | No | Filter by persistence: `true` for persistent macOS sandboxes, `false` for ephemeral sandboxes. |
| `spot` | query | boolean | No | Spot-tier sandboxes only (`true`) or on-demand only (`false`). |
| `forked_from` | query | string | No | Sandboxes forked from this sandbox ID. |
| `reservation_id` | query | string | No | macOS sandboxes that run, or last ran, on this Mac reservation ID. |
| `min_cores` | query | number (double) | No | Inclusive lower bound on `cores_max`, in cores (1 core = 2 vCPUs). |
| `max_cores` | query | number (double) | No | Inclusive upper bound on `cores_max`, in cores (1 core = 2 vCPUs). |
| `min_memory_mib` | query | integer (int64) | No | Inclusive lower bound on `memory_mib`. |
| `max_memory_mib` | query | integer (int64) | No | Inclusive upper bound on `memory_mib`. |
| `min_disk_mib` | query | integer (int64) | No | Inclusive lower bound on `disk_mib`. |
| `max_disk_mib` | query | integer (int64) | No | Inclusive upper bound on `disk_mib`. |
| `created_start_at` | query | string (date-time) | No | Inclusive lower bound on creation time. |
| `created_end_at` | query | string (date-time) | No | Exclusive upper bound on creation time. |
| `updated_start_at` | query | string (date-time) | No | Inclusive lower bound on last-modified time. |
| `updated_end_at` | query | string (date-time) | No | Exclusive upper bound on last-modified time. |
| `last_activity_start_at` | query | string (date-time) | No | Inclusive lower bound on last-activity time. |
| `last_activity_end_at` | query | string (date-time) | No | Exclusive upper bound on last-activity time. |
| `sort` | query | [SandboxSearchSort](./schemas.md#sandboxsearchsort) | No | Sort field. Defaults to `created_at`; ties break on the ID. |
| `order` | query | [SortOrder](./schemas.md#sortorder) | No | Sort order. Defaults to `desc`. |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of matching sandboxes | [SandboxSearchPage](./schemas.md#sandboxsearchpage) (`application/json`) |
| 400 | A filter, timestamp, ID, or cursor is invalid (`BAD_REQUEST`). The query string is longer than 12,288 bytes (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Sandbox search is not enabled (`SEARCH_NOT_CONFIGURED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Sandbox search is temporarily unavailable (`SEARCH_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a sandbox

`GET /sandboxes/{sandbox_id}`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |
| `wait` | query | string | No | Block until the resource reaches this status or a terminal status. Omit to return immediately. |
| `wait_exact` | query | string | No | Exact status to wait for. Another terminal status ends the wait without satisfying it. |
| `timeout_ms` | query | integer (int64) | No | Maximum time to block, in milliseconds. Default 30000, maximum 60000. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox | [Sandbox](./schemas.md#sandbox) (`application/json`) |
| 400 | The wait target is not a sandbox status (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete a sandbox

`DELETE /sandboxes/{sandbox_id}`

Deletion is asynchronous. The sandbox leaves the list once it completes.

**Auth:** `api_key` (`delete:sandboxes`), `sandbox_token`, `sandbox_token`, `platform_token` (`delete:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox deletion | [AsyncOperation](./schemas.md#asyncoperation) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A fork of this macOS sandbox is in progress; retry the delete later (`CONFLICT`). | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Mint a sandbox access token

`POST /sandboxes/{sandbox_id}/access-token`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Request Body

`application/json`: null \| [MintSandboxAccessTokenRequest](./schemas.md#mintsandboxaccesstokenrequest)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created sandbox access token | [SandboxAccessToken](./schemas.md#sandboxaccesstoken) (`application/json`) |
| 400 | An operation, lifetime, or port is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox is in a terminal status (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 413 | The request body is too large (`PAYLOAD_TOO_LARGE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Access tokens are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a sandbox's build logs URL

`GET /sandboxes/{sandbox_id}/build-logs-url`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox build logs URL | [BuildLogsUrl](./schemas.md#buildlogsurl) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Build logs are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get sandbox console logs

`GET /sandboxes/{sandbox_id}/console-logs`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox console log | string (`text/plain`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Sandbox logs are temporarily unavailable (`BAD_GATEWAY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Sign a sandbox file URL

`POST /sandboxes/{sandbox_id}/files/sign`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Request Body

`application/json`: [SignSandboxFileUrlRequest](./schemas.md#signsandboxfileurlrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) | Yes | Absolute expiry. Must lie in the future and at most the deployment's signed-URL ceiling ahead (7 days by default). |
| `method` | string | Yes | `GET` signs a download link (`/files/download`) and `POST` an upload link (`/files/upload`); no other method can be signed. |
| `path` | string | Yes | Sandbox file path the link addresses. The URL's `path` query parameter must match this string exactly. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The signed file URL | [SignedFileUrl](./schemas.md#signedfileurl) (`application/json`) |
| 400 | The method, path, or expiry is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Fork a sandbox

`POST /sandboxes/{sandbox_id}/fork`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Request Body

Optional body; omit it for a fork with the default name and the default `memory`.

`application/json`: null \| [ForkSandboxRequest](./schemas.md#forksandboxrequest)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox fork | [ForkSandboxOperation](./schemas.md#forksandboxoperation) (`application/json`) |
| 400 | The fork cannot be placed with the requested settings (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The required permission is missing (`FORBIDDEN`). macOS sandboxes are unavailable (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox class does not support forking, or a macOS fork asked for memory (`NOT_SUPPORTED_FOR_CLASS`). The sandbox state or configuration cannot be forked (`CONFLICT`). The sandbox's disk is not ready yet; retry the fork later (`DISK_NOT_READY`). | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The sandbox cannot be forked now (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Set sandbox labels

`PUT /sandboxes/{sandbox_id}/labels`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Request Body

`application/json`: [SetSandboxLabelsRequest](./schemas.md#setsandboxlabelsrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `labels` | map of string | No | The new label set. It replaces the current one, and `{}` clears all labels. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox labels | [SandboxLabels](./schemas.md#sandboxlabels) (`application/json`) |
| 400 | The labels exceed a count or size limit (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox is deleted or being deleted (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update a sandbox lifecycle policy

`PATCH /sandboxes/{sandbox_id}/lifecycle-policy`

Updates the supplied lifecycle settings. Omitted settings remain unchanged.

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Request Body

`application/json`: [UpdateSandboxLifecyclePolicyRequest](./schemas.md#updatesandboxlifecyclepolicyrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idle_expiry_seconds` | integer (int64) \| null | No | Idle seconds before the idle action runs. A value below 60 is raised to 60; use `-1` to clear the idle expiry. |
| `on_idle_timeout` | null \| [LifecycleAction](./schemas.md#lifecycleaction) | No | Action to run when the idle expiry elapses. |
| `on_timeout` | null \| [LifecycleAction](./schemas.md#lifecycleaction) | No | Action to run when the timeout expires. |
| `timeout_seconds` | integer (int64) \| null | No | Seconds before the timeout action runs. Supplying a value restarts the countdown. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox lifecycle policy | [SandboxLifecyclePolicy](./schemas.md#sandboxlifecyclepolicy) (`application/json`) |
| 400 | The body, duration, or action is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox is deleted or being deleted (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get sandbox logs

`GET /sandboxes/{sandbox_id}/logs`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox log | string (`text/plain`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | Sandbox logs are temporarily unavailable (`BAD_GATEWAY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the sandbox network policy

`GET /sandboxes/{sandbox_id}/network-policy`

**Auth:** `api_key` (`read:sandboxes`), `platform_token` (`read:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox network policy | [NetworkPolicy](./schemas.md#networkpolicy) (`application/json`) |
| 400 | The sandbox class does not support network policies (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Set a sandbox network policy

`PUT /sandboxes/{sandbox_id}/network-policy`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |
| `If-Match` | header | string | Yes | The `ETag` from the last read or update of this policy |

### Request Body

Full replacement. Send a JSON object to set the policy, or `null` to reset the sandbox to open network access. An empty body is rejected. With a non-null `allow_domains`, `block_all` defaults to `true` and setting it to `false` is rejected (`NETWORK_POLICY_DOMAINS_REQUIRE_BLOCK_ALL`). A non-empty `allow_cidrs` without default deny or a domain gate has no effect and is rejected (`400 BAD_REQUEST`). CIDRs with host bits set are rejected with the canonical network in the message.

`application/json`: null \| [SetSandboxNetworkPolicyRequest](./schemas.md#setsandboxnetworkpolicyrequest)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox network policy update | [NetworkPolicy](./schemas.md#networkpolicy) (`application/json`) |
| 400 | The request is invalid or the sandbox class is unsupported (`BAD_REQUEST`), or domain rules explicitly disable default deny (`NETWORK_POLICY_DOMAINS_REQUIRE_BLOCK_ALL`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A sandbox transition is in progress (`NETWORK_POLICY_TRANSITION_IN_PROGRESS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 412 | The desired revision is stale (`STALE_NETWORK_POLICY_REVISION`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 428 | The If-Match header is missing (`IF_MATCH_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The network policy cannot be applied now (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Pause a sandbox

`POST /sandboxes/{sandbox_id}/pause`

**Auth:** `api_key` (`write:sandboxes`), `sandbox_token`, `sandbox_token`, `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox pause | [AsyncOperation](./schemas.md#asyncoperation) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox class does not support pausing (`NOT_SUPPORTED_FOR_CLASS`). The sandbox has attached volumes, is not running, or its configuration does not allow pausing (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Reset a sandbox idle timer

`POST /sandboxes/{sandbox_id}/reset-idle-timer`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox lifecycle policy | [SandboxLifecyclePolicy](./schemas.md#sandboxlifecyclepolicy) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox is deleted or being deleted (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Restart a sandbox

`POST /sandboxes/{sandbox_id}/restart`

Restarts a running persistent sandbox: it stops and keeps its disk, then
starts again. Running processes and memory are not kept. Linux and Windows
sandboxes only.

**Auth:** `api_key` (`write:sandboxes`), `sandbox_token`, `sandbox_token`, `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox restart. The sandbox stops, then starts again; `status` is the sandbox's status at acceptance, `stopping` | [AsyncOperation](./schemas.md#asyncoperation) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 402 | The organization is suspended (`ORG_SUSPENDED`), or the project reached its monthly budget (`PROJECT_BUDGET_EXCEEDED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox class does not support restarting (`NOT_SUPPORTED_FOR_CLASS`). The sandbox is not persistent or not running (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Resume a sandbox

`POST /sandboxes/{sandbox_id}/resume`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox resume | [AsyncOperation](./schemas.md#asyncoperation) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 402 | The organization is suspended (`ORG_SUSPENDED`), or the project reached its monthly budget (`PROJECT_BUDGET_EXCEEDED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox class does not support resuming (`NOT_SUPPORTED_FOR_CLASS`). The sandbox is not paused, its saved state is unavailable, or its Mac reservation is ending (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The sandbox cannot be resumed now (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the sandbox secrets

`GET /sandboxes/{sandbox_id}/secrets`

**Auth:** `api_key` (`read:sandboxes`, `read:secrets`), `platform_token` (`read:sandboxes`, `read:secrets`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox secrets | [SandboxSecrets](./schemas.md#sandboxsecrets) (`application/json`) |
| 400 | The sandbox class does not support runtime secrets (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Set the sandbox secrets

`PUT /sandboxes/{sandbox_id}/secrets`

**Auth:** `api_key` (`write:sandboxes`, `read:secrets`), `platform_token` (`write:sandboxes`, `read:secrets`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |
| `If-Match` | header | string | Yes | The `ETag` from the last read or update of these secrets |

### Request Body

Full replacement of the secrets attached to the sandbox, by project secret name. Values are never sent or returned.

`application/json`: [SetSandboxSecretsRequest](./schemas.md#setsandboxsecretsrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `secrets` | array of string | Yes | The complete desired set of project secret names. Required; send `[]` to detach every secret. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox secrets update | [SandboxSecrets](./schemas.md#sandboxsecrets) (`application/json`) |
| 400 | The request is invalid, names an unknown secret, or the sandbox class is unsupported (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A sandbox transition, memory snapshot or fork is in progress (`SECRETS_TRANSITION_IN_PROGRESS`). The sandbox has failed, was deleted or is lost (`CONFLICT`). | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 412 | The desired revision is stale (`STALE_SECRETS_REVISION`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 428 | The If-Match header is missing (`IF_MATCH_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Rotate a sandbox signing key

`POST /sandboxes/{sandbox_id}/signing-key/rotate`

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Sandbox signing key rotated |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Start a sandbox

`POST /sandboxes/{sandbox_id}/start`

macOS: Starts the sandbox with its disk and size on any Mac of the organization. After a start on a different Mac, iCloud asks the user to sign in again. If the organization has no Mac reservation in the region and auto-reserve is on, the start buys one.

**Auth:** `api_key` (`write:sandboxes`), `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox start | [AsyncOperation](./schemas.md#asyncoperation) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 402 | The organization is suspended (`ORG_SUSPENDED`), or the project reached its monthly budget (`PROJECT_BUDGET_EXCEEDED`). The organization's balance is too low for the Mac reservation auto-reserve buys (`INSUFFICIENT_BALANCE`), or that reservation's charge did not succeed (`CHARGE_FAILED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The required permission is missing (`FORBIDDEN`). macOS sandboxes are unavailable (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox cannot be started in its current configuration (`CONFLICT`). The sandbox's disk is not ready yet; retry the start later (`DISK_NOT_READY`). The Macs of the organization have no space for this size (`NO_FREE_SLOT`), or the Mac with space is low on free disk space (`MAC_DISK_FULL`). The organization has no Mac reservation in the region and auto-reserve is off (`NO_ACTIVE_RESERVATION`). Auto-reserve reached the organization's limit of auto-reserved Macs (`AUTO_RESERVE_LIMIT_REACHED`), or found no Mac to reserve (`NO_MAC_AVAILABLE`). | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The sandbox cannot be started now (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Stop a sandbox

`POST /sandboxes/{sandbox_id}/stop`

Stops a persistent sandbox and keeps its disk. A sandbox that is not
persistent cannot be stopped.

**Auth:** `api_key` (`write:sandboxes`), `sandbox_token`, `sandbox_token`, `platform_token` (`write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox stop | [AsyncOperation](./schemas.md#asyncoperation) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox cannot be stopped in its current configuration (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
