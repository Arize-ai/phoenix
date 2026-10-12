# Sandbox API


## Contents

- GET `/sandbox`
- POST `/sandbox`
- GET `/sandbox/paginated`
- GET `/sandbox/for-runner`
- GET `/sandbox/{sandboxIdOrName}`}
- DELETE `/sandbox/{sandboxIdOrName}`}
- POST `/sandbox/{sandboxIdOrName}/recover`/recover}
- POST `/sandbox/{sandboxIdOrName}/start`/start}
- POST `/sandbox/{sandboxIdOrName}/stop`/stop}
- POST `/sandbox/{sandboxIdOrName}/pause`/pause}
- POST `/sandbox/{sandboxIdOrName}/resize`/resize}
- PUT `/sandbox/{sandboxIdOrName}/labels`/labels}
- PUT `/sandbox/{sandboxId}/state`/state}
- POST `/sandbox/{sandboxIdOrName}/backup`/backup}
- POST `/sandbox/{sandboxIdOrName}/snapshot`/snapshot}
- POST `/sandbox/{sandboxIdOrName}/fork`/fork}
- GET `/sandbox/{sandboxIdOrName}/forks`/forks}
- GET `/sandbox/{sandboxIdOrName}/parent`/parent}
- GET `/sandbox/{sandboxIdOrName}/ancestors`/ancestors}
- POST `/sandbox/{sandboxIdOrName}/public/{isPublic}`/public/{isPublic}}
- GET `/sandbox/{sandboxId}/signing-key`/signing-key}
- POST `/sandbox/{sandboxId}/signing-key/rotate`/signing-key/rotate}
- POST `/sandbox/{sandboxId}/last-activity`/last-activity}
- POST `/sandbox/{sandboxIdOrName}/autostop/{interval}`/autostop/{interval}}
- POST `/sandbox/{sandboxIdOrName}/autopause/{interval}`/autopause/{interval}}
- POST `/sandbox/{sandboxIdOrName}/ttl/{ttlMinutes}`/ttl/{ttlMinutes}}
- POST `/sandbox/{sandboxIdOrName}/autoarchive/{interval}`/autoarchive/{interval}}
- POST `/sandbox/{sandboxIdOrName}/autodelete/{interval}`/autodelete/{interval}}
- POST `/sandbox/{sandboxIdOrName}/network-settings`/network-settings}
- PUT `/sandbox/{sandboxIdOrName}/secrets`/secrets}
- POST `/sandbox/{sandboxIdOrName}/archive`/archive}
- GET `/sandbox/{sandboxIdOrName}/ports/{port}/preview-url`/ports/{port}/preview-url}
- GET `/sandbox/{sandboxIdOrName}/ports/{port}/signed-preview-url`/ports/{port}/signed-preview-url}
- POST `/sandbox/{sandboxIdOrName}/ports/{port}/signed-preview-url/{token}/expire`/ports/{port}/signed-preview-url/{token}/expire}
- GET `/sandbox/{sandboxIdOrName}/build-logs`/build-logs}
- GET `/sandbox/{sandboxIdOrName}/build-logs-url`/build-logs-url}
- POST `/sandbox/{sandboxIdOrName}/ssh-access`/ssh-access}
- DELETE `/sandbox/{sandboxIdOrName}/ssh-access`/ssh-access}
- GET `/sandbox/ssh-access/validate`
- GET `/sandbox/{sandboxId}/toolbox-proxy-url`/toolbox-proxy-url}
- GET `/sandbox/{sandboxId}/organization`/organization}
- GET `/sandbox/{sandboxId}/region-quota`/region-quota}
- GET `/sandbox/{sandboxId}/secrets`/secrets}
- GET `/sandbox/{sandboxId}/telemetry/logs`/telemetry/logs}
- GET `/sandbox/{sandboxId}/telemetry/traces`/telemetry/traces}
- GET `/sandbox/{sandboxId}/telemetry/traces/{traceId}`/telemetry/traces/{traceId}}
- GET `/sandbox/{sandboxId}/telemetry/metrics`/telemetry/metrics}

## GET `/sandbox` {#daytona/tag/sandbox/GET/sandbox}

**List sandboxes**

Advanced filtering and ordering. Eventually consistent.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `cursor` | query | string | No | Pagination cursor from a previous response |
| `limit` | query | number | No | Number of results per page |
| `id` | query | string | No | Filter by ID prefix (case-insensitive) |
| `name` | query | string | No | Filter by name prefix (case-insensitive) |
| `labels` | query | string | No | JSON encoded labels to filter by |
| `includeErroredDeleted` | query | boolean | No | Include results with errored state and deleted desired state |
| `includeWarm` | query | boolean | No | Include unclaimed warm pool sandboxes (excluded by default) |
| `states` | query | array | No | List of states to filter by. |
| `snapshots` | query | array | No | List of snapshot names to filter by |
| `regionIds` | query | array | No | List of regions IDs to filter by |
| `sandboxClasses` | query | array | No | List of sandbox classes to filter by |
| `minCpu` | query | number | No | Minimum CPU |
| `maxCpu` | query | number | No | Maximum CPU |
| `minMemoryGiB` | query | number | No | Minimum memory in GiB |
| `maxMemoryGiB` | query | number | No | Maximum memory in GiB |
| `minDiskGiB` | query | number | No | Minimum disk space in GiB |
| `maxDiskGiB` | query | number | No | Maximum disk space in GiB |
| `isPublic` | query | boolean | No | Filter by public status |
| `isRecoverable` | query | boolean | No | Filter by recoverable status |
| `createdAtAfter` | query | string (date-time) | No | Include items created after this timestamp |
| `createdAtBefore` | query | string (date-time) | No | Include items created before this timestamp |
| `lastEventAfter` | query | string (date-time) | No | Include items with last event after this timestamp |
| `lastEventBefore` | query | string (date-time) | No | Include items with last event before this timestamp |
| `autoDestroyAtAfter` | query | string (date-time) | No | Include items scheduled for auto destroy after this timestamp |
| `autoDestroyAtBefore` | query | string (date-time) | No | Include items scheduled for auto destroy before this timestamp |
| `sort` | query | string | No | Field to sort by |
| `order` | query | string | No | Direction to sort by |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | ListSandboxesResponse |

---

## POST `/sandbox` {#daytona/tag/sandbox/POST/sandbox}

**Create a new sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Request Body

Schema: **CreateSandbox**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | The name of the sandbox. If not provided, the sandbox ID will be used as the name |
| `snapshot` | string | No | The ID or name of the snapshot used for the sandbox |
| `user` | string | No | The user associated with the project |
| `env` | object | No | Environment variables for the sandbox |
| `labels` | object | No | Labels for the sandbox |
| `public` | boolean | No | Whether the sandbox http preview is publicly accessible |
| `networkBlockAll` | boolean | No | Whether to block all network access for the sandbox |
| `networkAllowList` | string | No | Comma-separated list of allowed CIDR network addresses for the sandbox |
| `domainAllowList` | string | No | Comma-separated list of allowed domains for the sandbox |
| `outboundProxyUrl` | string | No | Outbound proxy URL to route the sandbox HTTP(S) traffic through (http or https; credentials may be included in the URL). On its own this is convenience routing, not a security boundary: it is applied by injecting the standard HTTP(S)_PROXY environment variables at creation, so a process that clears those variables egresses directly. Combine with domainAllowList to have web-port (80/443) egress transparently redirected through the proxy chain at the network layer, which cannot be bypassed from inside the sandbox. |
| `otelEndpointOverride` | string | No | OTel collector endpoint override for this sandbox. When set, sandbox OTel data is sent to this endpoint instead of the default collector (the Daytona-hosted collector or the region-configured endpoint) and will not be available in the Daytona analytics API or dashboard. |
| `target` | string | No | The target (region) where the sandbox will be created |
| `cpu` | integer | No | CPU cores allocated to the sandbox |
| `gpu` | integer | No | GPU units allocated to the sandbox |
| `gpuType` | array of [GpuType](#schema-gputype) | No | Preferred GPU type for the sandbox. Accepts a single value or an ordered preference list — the scheduler tries each in order and pins the sandbox to the first that has capacity. |
| `spot` | boolean | No | GPU-only. When true, the sandbox may be instantly terminated without notice to free GPU capacity for an on-demand (non-spot) GPU sandbox. Ignored / rejected when the sandbox requests no GPUs. |
| `memory` | integer | No | Memory allocated to the sandbox in GB |
| `disk` | integer | No | Disk space allocated to the sandbox in GB |
| `autoStopInterval` | integer | No | Auto-stop interval in minutes (0 means disabled) |
| `autoPauseInterval` | integer | No | Auto-pause interval in minutes (0 means disabled). Only supported for sandbox classes that support pausing. Not allowed for ephemeral sandboxes. At most one of autoStopInterval and autoPauseInterval may be non-zero. For non-ephemeral sandbox classes that support pausing, defaults to 60 minutes (with auto-stop disabled) when neither interval is provided. |
| `autoArchiveInterval` | integer | No | Auto-archive interval in minutes (0 means the maximum interval will be used) |
| `autoDeleteInterval` | integer | No | Auto-delete interval in minutes (negative value means disabled, 0 means delete immediately upon stopping) |
| `ttlMinutes` | integer | No | Maximum time to live in minutes, counted as wall-clock time since creation regardless of sandbox state (0 means disabled). When it elapses the sandbox is destroyed, even if it is stopped, paused, or archived. Subject to the maximum sandbox lifespan configured for the organization region and sandbox class, in which case it also defaults to that maximum and cannot be disabled. |
| `volumes` | array of [SandboxVolume](#schema-sandboxvolume) | No | Array of volumes to attach to the sandbox |
| `buildInfo` | object | No | Build information for the sandbox |
| `linkedSandbox` | string | No | ID or name of an existing sandbox to link the new sandbox to. The new sandbox will be scheduled on the same runner as the linked sandbox so a local network can be established between them. Linked sandboxes must be ephemeral (autoDeleteInterval=0) and cannot themselves be linked to another sandbox. GPU sandboxes cannot participate in links in either direction: a GPU sandbox cannot specify linkedSandbox, and cannot be the link target of another sandbox. |
| `secrets` | array of object | No | Secrets to mount in this sandbox. Each entry maps an env var name to a vault secret name. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The sandbox has been successfully created. | Sandbox |

---

## GET `/sandbox/paginated` {#daytona/tag/sandbox/GET/sandbox/paginated}

**[DEPRECATED] List all sandboxes paginated**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `page` | query | number | No | Page number of the results |
| `limit` | query | number | No | Number of results per page |
| `id` | query | string | No | Filter by partial ID match |
| `name` | query | string | No | Filter by partial name match |
| `labels` | query | string | No | JSON encoded labels to filter by |
| `includeErroredDeleted` | query | boolean | No | Include results with errored state and deleted desired state |
| `states` | query | array | No | List of states to filter by |
| `snapshots` | query | array | No | List of snapshot names to filter by |
| `regions` | query | array | No | List of regions to filter by |
| `minCpu` | query | number | No | Minimum CPU |
| `maxCpu` | query | number | No | Maximum CPU |
| `minMemoryGiB` | query | number | No | Minimum memory in GiB |
| `maxMemoryGiB` | query | number | No | Maximum memory in GiB |
| `minDiskGiB` | query | number | No | Minimum disk space in GiB |
| `maxDiskGiB` | query | number | No | Maximum disk space in GiB |
| `lastEventAfter` | query | string (date-time) | No | Include items with last event after this timestamp |
| `lastEventBefore` | query | string (date-time) | No | Include items with last event before this timestamp |
| `sort` | query | string | No | Field to sort by |
| `order` | query | string | No | Direction to sort by |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Paginated list of all sandboxes | PaginatedSandboxes_deprecated |

---

## GET `/sandbox/for-runner` {#daytona/tag/sandbox/GET/sandbox/for-runner}

**Get sandboxes for the authenticated runner**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `states` | query | string | No | Comma-separated list of sandbox states to filter by |
| `skipReconcilingSandboxes` | query | boolean | No | Skip sandboxes where state differs from desired state |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | List of sandboxes for the authenticated runner | array of Sandbox |

---

## GET `/sandbox/{sandboxIdOrName}` {#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}}

**Get sandbox details**

Sandboxes destroyed by spot preemption remain retrievable for 24 hours so `spotEvictedAt` can be read.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `verbose` | query | boolean | No | Include verbose output |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Sandbox details | Sandbox |

---

## DELETE `/sandbox/{sandboxIdOrName}` {#daytona/tag/sandbox/DELETE/sandbox/{sandboxIdOrName}}

**Delete sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Sandbox has been deleted | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/recover` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/recover}

**Recover sandbox from error state**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `skipStart` | query | boolean | No | If true, the sandbox is left in STOPPED after recovery instead of being started. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Recovery initiated | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/start` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/start}

**Start or resume sandbox**

Starts a stopped or archived sandbox, or resumes a paused sandbox. The transition taken depends on the current sandbox state.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Sandbox has been started, is being restored from archived state, or is being resumed from paused | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/stop` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/stop}

**Stop sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `force` | query | boolean | No | Force stop the sandbox using SIGKILL instead of SIGTERM |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Sandbox has been stopped | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/pause` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/pause}

**Pause sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Sandbox pause has been initiated | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/resize` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/resize}

**Resize sandbox resources**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |

### Request Body

Schema: **ResizeSandbox**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cpu` | integer | No | CPU cores to allocate to the sandbox (minimum: 1) |
| `memory` | integer | No | Memory in GB to allocate to the sandbox (minimum: 1) |
| `disk` | integer | No | Disk space in GB to allocate to the sandbox (can only be increased) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Sandbox has been resized | Sandbox |

---

## PUT `/sandbox/{sandboxIdOrName}/labels` {#daytona/tag/sandbox/PUT/sandbox/{sandboxIdOrName}/labels}

**Replace sandbox labels**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |

### Request Body

Schema: **SandboxLabels**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `labels` | object | Yes | Key-value pairs of labels |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Labels have been successfully replaced | SandboxLabels |

---

## PUT `/sandbox/{sandboxId}/state` {#daytona/tag/sandbox/PUT/sandbox/{sandboxId}/state}

**Update sandbox state**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | ID of the sandbox |

### Request Body

Schema: **UpdateSandboxStateDto**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `state` | string | Yes | The new state for the sandbox |
| `errorReason` | string | No | Optional error message when reporting an error state |
| `recoverable` | boolean | No | Whether the sandbox is recoverable |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Sandbox state has been successfully updated |  |

---

## POST `/sandbox/{sandboxIdOrName}/backup` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/backup}

**Create sandbox backup**

Deprecated: backups are managed automatically. This endpoint is a no-op kept for compatibility.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Sandbox backup request acknowledged (no-op) | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/snapshot` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/snapshot}

**Create a snapshot from a sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes |  |

### Request Body

Schema: **CreateSandboxSnapshot**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Name for the new snapshot |
| `includeMemory` | boolean | No | Include the VM's memory in the snapshot. VM sandboxes only. When true the sandbox must be STARTED; when false (default) VM sandboxes must be STOPPED. Container sandboxes do not support memory snapshots. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Snapshot creation has been initiated | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/fork` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/fork}

**Fork a sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes |  |

### Request Body

Schema: **ForkSandbox**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | The name for the forked sandbox. If not provided, a unique name will be generated. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Fork operation has been initiated | Sandbox |

---

## GET `/sandbox/{sandboxIdOrName}/forks` {#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/forks}

**Get sandbox fork children**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes |  |
| `includeDestroyed` | query | boolean | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | array of Sandbox |

---

## GET `/sandbox/{sandboxIdOrName}/parent` {#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/parent}

**Get sandbox fork parent**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | Sandbox |

---

## GET `/sandbox/{sandboxIdOrName}/ancestors` {#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/ancestors}

**Get sandbox fork ancestor chain**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | array of Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/public/{isPublic}` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/public/{isPublic}}

**Update public status**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `isPublic` | path | boolean | Yes | Public status to set |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Public status has been successfully updated | Sandbox |

---

## GET `/sandbox/{sandboxId}/signing-key` {#daytona/tag/sandbox/GET/sandbox/{sandboxId}/signing-key}

**Get the signing key for a sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | ID of the sandbox |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Signing key of the sandbox | string |

---

## POST `/sandbox/{sandboxId}/signing-key/rotate` {#daytona/tag/sandbox/POST/sandbox/{sandboxId}/signing-key/rotate}

**Rotate the signing key, invalidating all previously signed URLs**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | ID of the sandbox |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | New signing key | string |

---

## POST `/sandbox/{sandboxId}/last-activity` {#daytona/tag/sandbox/POST/sandbox/{sandboxId}/last-activity}

**Update sandbox last activity**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | ID of the sandbox |

### Request Body

Schema: **UpdateLastActivity**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `activityType` | string | No | Optional type of interaction that reset the activity timer. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Last activity has been updated |  |

---

## POST `/sandbox/{sandboxIdOrName}/autostop/{interval}` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/autostop/{interval}}

**Set sandbox auto-stop interval**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `interval` | path | number | Yes | Auto-stop interval in minutes (0 to disable) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Auto-stop interval has been set | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/autopause/{interval}` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/autopause/{interval}}

**Set sandbox auto-pause interval**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `interval` | path | number | Yes | Auto-pause interval in minutes (0 to disable) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Auto-pause interval has been set | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/ttl/{ttlMinutes}` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/ttl/{ttlMinutes}}

**Set sandbox TTL**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `ttlMinutes` | path | number | Yes | Maximum time to live in minutes, re-anchored from the current time (0 to disable). When it elapses the sandbox is destroyed, even if it is stopped, paused, or archived |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | TTL has been set | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/autoarchive/{interval}` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/autoarchive/{interval}}

**Set sandbox auto-archive interval**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `interval` | path | number | Yes | Auto-archive interval in minutes (0 means the maximum interval will be used) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Auto-archive interval has been set | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/autodelete/{interval}` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/autodelete/{interval}}

**Set sandbox auto-delete interval**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `interval` | path | number | Yes | Auto-delete interval in minutes (negative value means disabled, 0 means delete immediately upon stopping) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Auto-delete interval has been set | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/network-settings` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/network-settings}

**Update sandbox network settings**

Changes outbound network policy on the runner for a running sandbox (for example block all traffic, restore access, or set a CIDR allow list).

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |

### Request Body

Schema: **UpdateSandboxNetworkSettings**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `networkBlockAll` | boolean | No | Whether to block all network access for the sandbox |
| `networkAllowList` | string | No | Comma-separated list of allowed CIDR network addresses for the sandbox |
| `domainAllowList` | string | No | Comma-separated list of allowed domains for the sandbox |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Network settings have been updated | Sandbox |

---

## PUT `/sandbox/{sandboxIdOrName}/secrets` {#daytona/tag/sandbox/PUT/sandbox/{sandboxIdOrName}/secrets}

**Update sandbox secrets**

Replaces the set of vault secrets mounted in the sandbox. Attached, detached and rotated secrets take effect for outbound requests within seconds. New env vars become visible to processes spawned after the update; a sandbox created without any secrets must be restarted for newly attached secrets to work.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |

### Request Body

Schema: **UpdateSandboxSecrets**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `secrets` | array of object | Yes | Secrets to mount in this sandbox, replacing the previously mounted set. Each entry maps an env var name to a vault secret name. Pass an empty array to detach all secrets. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Sandbox secrets have been updated | Sandbox |

---

## POST `/sandbox/{sandboxIdOrName}/archive` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/archive}

**Archive sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Sandbox has been archived | Sandbox |

---

## GET `/sandbox/{sandboxIdOrName}/ports/{port}/preview-url` {#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/ports/{port}/preview-url}

**Get preview URL for a sandbox port**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `port` | path | number | Yes | Port number to get preview URL for |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Preview URL for the specified port | PortPreviewUrl |

---

## GET `/sandbox/{sandboxIdOrName}/ports/{port}/signed-preview-url` {#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/ports/{port}/signed-preview-url}

**Get signed preview URL for a sandbox port**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `port` | path | integer | Yes | Port number to get signed preview URL for |
| `expiresInSeconds` | query | integer | No | Expiration time in seconds (default: 60 seconds) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Signed preview URL for the specified port | SignedPortPreviewUrl |

---

## POST `/sandbox/{sandboxIdOrName}/ports/{port}/signed-preview-url/{token}/expire` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/ports/{port}/signed-preview-url/{token}/expire}

**Expire signed preview URL for a sandbox port**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `port` | path | integer | Yes | Port number to expire signed preview URL for |
| `token` | path | string | Yes | Token to expire signed preview URL for |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Signed preview URL has been expired |  |

---

## GET `/sandbox/{sandboxIdOrName}/build-logs` {#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/build-logs}

**Get build logs**

This endpoint is deprecated. Use `getBuildLogsUrl` instead.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `follow` | query | boolean | No | Whether to follow the logs stream |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Build logs stream |  |

---

## GET `/sandbox/{sandboxIdOrName}/build-logs-url` {#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/build-logs-url}

**Get build logs URL**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Build logs URL | Url |

---

## POST `/sandbox/{sandboxIdOrName}/ssh-access` {#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/ssh-access}

**Create SSH access for sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `expiresInMinutes` | query | number | No | Expiration time in minutes (default: 60) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | SSH access has been created | SshAccessDto |

---

## DELETE `/sandbox/{sandboxIdOrName}/ssh-access` {#daytona/tag/sandbox/DELETE/sandbox/{sandboxIdOrName}/ssh-access}

**Revoke SSH access for sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes | ID or name of the sandbox |
| `token` | query | string | No | SSH access token to revoke. If not provided, all SSH access for the sandbox will be revoked. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | SSH access has been revoked | Sandbox |

---

## GET `/sandbox/ssh-access/validate` {#daytona/tag/sandbox/GET/sandbox/ssh-access/validate}

**Validate SSH access for sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `token` | query | string | Yes | SSH access token to validate |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | SSH access validation result | SshAccessValidationDto |

---

## GET `/sandbox/{sandboxId}/toolbox-proxy-url` {#daytona/tag/sandbox/GET/sandbox/{sandboxId}/toolbox-proxy-url}

**Get toolbox proxy URL for a sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | ID of the sandbox |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Toolbox proxy URL for the specified sandbox | ToolboxProxyUrl |

---

## GET `/sandbox/{sandboxId}/organization` {#daytona/tag/sandbox/GET/sandbox/{sandboxId}/organization}

**Get organization by sandbox ID**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | ID of the sandbox |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Organization | Organization |

---

## GET `/sandbox/{sandboxId}/region-quota` {#daytona/tag/sandbox/GET/sandbox/{sandboxId}/region-quota}

**Get region quota by sandbox ID**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | ID of the sandbox |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Region quota | RegionQuota |

---

## GET `/sandbox/{sandboxId}/secrets` {#daytona/tag/sandbox/GET/sandbox/{sandboxId}/secrets}

**Resolve sandbox secrets**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | Sandbox ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Decrypted secret key-value pairs for this sandbox | array of resolveSandboxSecrets_200_response_inner |

---

## GET `/sandbox/{sandboxId}/telemetry/logs` {#daytona/tag/sandbox/GET/sandbox/{sandboxId}/telemetry/logs}

**Get sandbox logs**

Retrieve OTEL logs for a sandbox within a time range

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | ID of the sandbox |
| `from` | query | string (date-time) | Yes | Start of time range (ISO 8601) |
| `to` | query | string (date-time) | Yes | End of time range (ISO 8601) |
| `page` | query | number | No | Page number (1-indexed) |
| `limit` | query | number | No | Number of items per page |
| `severities` | query | array | No | Filter by severity levels (DEBUG, INFO, WARN, ERROR) |
| `search` | query | string | No | Search in log body |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Paginated list of log entries | PaginatedLogs |

---

## GET `/sandbox/{sandboxId}/telemetry/traces` {#daytona/tag/sandbox/GET/sandbox/{sandboxId}/telemetry/traces}

**Get sandbox traces**

Retrieve OTEL traces for a sandbox within a time range

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | ID of the sandbox |
| `from` | query | string (date-time) | Yes | Start of time range (ISO 8601) |
| `to` | query | string (date-time) | Yes | End of time range (ISO 8601) |
| `page` | query | number | No | Page number (1-indexed) |
| `limit` | query | number | No | Number of items per page |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Paginated list of trace summaries | PaginatedTraces |

---

## GET `/sandbox/{sandboxId}/telemetry/traces/{traceId}` {#daytona/tag/sandbox/GET/sandbox/{sandboxId}/telemetry/traces/{traceId}}

**Get trace spans**

Retrieve all spans for a specific trace

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | ID of the sandbox |
| `traceId` | path | string | Yes | ID of the trace |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | List of spans in the trace | array of TraceSpan |

---

## GET `/sandbox/{sandboxId}/telemetry/metrics` {#daytona/tag/sandbox/GET/sandbox/{sandboxId}/telemetry/metrics}

**Get sandbox metrics**

Retrieve OTEL metrics for a sandbox within a time range

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxId` | path | string | Yes | ID of the sandbox |
| `from` | query | string (date-time) | Yes | Start of time range (ISO 8601) |
| `to` | query | string (date-time) | Yes | End of time range (ISO 8601) |
| `metricNames` | query | array | No | Filter by metric names |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Metrics time series data | MetricsResponse |

---
