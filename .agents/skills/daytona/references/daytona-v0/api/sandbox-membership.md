# Sandbox Membership API


## Contents

- POST `/sandbox/{sandboxIdOrName}/nodes`/nodes}
- POST `/sandbox/{sandboxIdOrName}/nodes/remove`/nodes/remove}
- POST `/sandbox/{sandboxIdOrName}/nodes/{rank}/replace`/nodes/{rank}/replace}
- GET `/sandbox/{sandboxIdOrName}/membership-operations/{operationId}`/membership-operations/{operationId}}

## POST `/sandbox/{sandboxIdOrName}/nodes` {#daytona/tag/sandbox-membership/POST/sandbox/{sandboxIdOrName}/nodes}

**Append nodes to a multi-node sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes |  |

### Request Body

Schema: **AddGangNodes**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expectedGeneration` | integer | Yes | Current sandbox topology generation. |
| `nodes` | array of [GangNodeResources](#schema-gangnoderesources) | Yes | One resource specification per appended rank. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Membership operation accepted | GangMembershipOperation |

---

## POST `/sandbox/{sandboxIdOrName}/nodes/remove` {#daytona/tag/sandbox-membership/POST/sandbox/{sandboxIdOrName}/nodes/remove}

**Remove the highest ranks from a multi-node sandbox**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes |  |

### Request Body

Schema: **RemoveGangNodes**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expectedGeneration` | integer | Yes | Current sandbox topology generation. |
| `count` | integer | Yes | Number of highest ranks to remove. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Membership operation accepted | GangMembershipOperation |

---

## POST `/sandbox/{sandboxIdOrName}/nodes/{rank}/replace` {#daytona/tag/sandbox-membership/POST/sandbox/{sandboxIdOrName}/nodes/{rank}/replace}

**Replace a failed multi-node sandbox rank**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes |  |
| `rank` | path | string | Yes |  |

### Request Body

Schema: **ReplaceGangNode**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expectedGeneration` | integer | Yes | Current sandbox topology generation. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Membership operation accepted | GangMembershipOperation |

---

## GET `/sandbox/{sandboxIdOrName}/membership-operations/{operationId}` {#daytona/tag/sandbox-membership/GET/sandbox/{sandboxIdOrName}/membership-operations/{operationId}}

**Get a gang membership operation**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |
| `sandboxIdOrName` | path | string | Yes |  |
| `operationId` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | GangMembershipOperation |

---
