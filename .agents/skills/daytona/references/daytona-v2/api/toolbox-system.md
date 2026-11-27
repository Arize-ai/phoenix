# Toolbox API: system

Sandbox resource metrics.

## Sample sandbox resource metrics

`GET /system/metrics`

Returns one RFC 3339 metrics snapshot: logical CPU count, sampled CPU utilization, sandbox memory usage, and disk usage for the filesystem containing the sandbox work directory.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [Metrics](./toolbox-schemas.md#metrics) (`application/json`) |
| 500 | Sandbox resource metrics could not be collected. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---
