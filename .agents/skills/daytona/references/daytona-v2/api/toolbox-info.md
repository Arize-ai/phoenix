# Toolbox API: info

Version probe and the SDK handshake.

## Sandbox handshake

`GET /info`

Everything an SDK wants at connect time in one call: version, working directory and (when it differs) the user's home directory.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [InfoResponse](./toolbox-schemas.md#inforesponse) (`application/json`) |

---

## Toolbox version

`GET /version`

Returns version information when the sandbox toolbox API is ready.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [VersionResponse](./toolbox-schemas.md#versionresponse) (`application/json`) |

---
