# Toolbox API: docker

Docker Engine startup status: whether the image's Docker was started, who owns it, and where its logs are. Read-only.

## Docker Engine status

`GET /docker/status`

Reports Docker Engine status and, when available, the process whose logs contain its output (`GET /processes/{id}/logs`). Read-only: this request never starts or restarts Docker. `waitMs`, capped at 1000, waits for `starting` to settle. A Docker failure is reported as `failed` and does not make the sandbox unusable.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `waitMs` | query | integer (int64) | No | Wait up to this many milliseconds for a `starting` state to settle before answering. Clamped to 1000; omitted or `0` answers immediately. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [DockerStatus](./toolbox-schemas.md#dockerstatus) (`application/json`) |
| 400 | `BAD_REQUEST` — invalid `waitMs` query parameter | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---
