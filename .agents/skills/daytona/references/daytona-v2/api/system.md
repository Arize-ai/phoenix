# Daytona API: system

Check service health and configuration.

## Get the runtime configuration

`GET /config`

Returns public settings clients need before signing in.

**Auth:** None (public)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The runtime configuration | [Config](./schemas.md#config) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get API health

`GET /health`

Reports whether this API instance is serving requests. It covers the instance itself, not the availability of every individual operation.

**Auth:** None (public)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The API health | [Health](./schemas.md#health) (`application/json`) |
| 503 | The API is not ready to accept requests (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
