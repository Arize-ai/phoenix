# Toolbox API: volumes

Pull remote changes into an attached volume.

## Pull remote changes into an attached volume

`POST /volumes/{volumeId}/pull`

Pull remote changes into an attached volume. Retain requestId across retries. Definitive results replay within the current session. A pending, unavailable or rate-limited result is retried only by a call with waitMs above zero; waitMs 0 returns the last outcome (a rate limit with its remaining delay) without retrying. An elapsed wait or disconnected caller does not cancel accepted work. A volume not attached to this sandbox returns a conflict. Replay is available only within the current session.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `volumeId` | path | string | Yes | Attached volume ID: the volume's `vol_` ID or its UUID (1–128 ASCII letters, digits, underscores or hyphens). |

### Request Body

`application/json`: [PullVolumeRequest](./toolbox-schemas.md#pullvolumerequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | string | Yes | Caller-generated identity, retained across retries (1–128 ASCII letters, digits, underscores or hyphens). Replay is scoped to the active session. |
| `waitMs` | integer (int64) | No | Maximum HTTP wait in milliseconds. Expiry does not cancel accepted work. Omitted means 30000. Zero submits a new request or retrieves a known one without retrying it; only a wait above zero retries a retryable result. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Pulled or unchanged. | [PullVolumeResponse](./toolbox-schemas.md#pullvolumeresponse) (`application/json`) |
| 202 | Pending; retry with the same requestId and waitMs above zero. | [PullVolumeResponse](./toolbox-schemas.md#pullvolumeresponse) (`application/json`) |
| 400 | Invalid identifier/wait or malformed JSON. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | The volume is not attached to this sandbox, requestId was reused for a different request, or the pull failed or was rejected. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 413 | Request body exceeds the JSON limit. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 415 | JSON content type required. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | Invalid request shape, including unknown fields. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 429 | The pull request was rate-limited. The response includes requestId and retryAfterMs; Retry-After rounds up to one second. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 503 | Volume pull is temporarily unavailable; retain requestId for retry. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---
