# Port API

## GET `/port` {#daytona-toolbox/tag/port/GET/port}

**Get active ports**

Get a list of all currently active ports

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | PortList |

---

## GET `/port/{port}/in-use` {#daytona-toolbox/tag/port/GET/port/{port}/in-use}

**Check if port is in use**

Check if a specific port is currently in use

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `port` | path | integer | Yes | Port number (3000-9999) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | IsPortInUseResponse |
| 400 | Bad Request | ErrorResponse |

---
