# Toolbox API: ports

Listening-port discovery.

## List listening ports

`GET /port`

Returns all listening TCP ports inside the sandbox.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [PortList](./toolbox-schemas.md#portlist) (`application/json`) |

---

## Check whether a port is in use

`GET /port/{port}/in-use`

Checks whether a TCP port from 3000 to 9999 inclusive is in use inside the sandbox.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `port` | path | string | Yes | TCP port number as a decimal string between 3000 and 9999. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [IsPortInUseResponse](./toolbox-schemas.md#isportinuseresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — the path is not a decimal port from 3000 to 9999 inclusive. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---
