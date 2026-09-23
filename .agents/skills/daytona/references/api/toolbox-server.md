# Server API

## POST `/env` {#daytona-toolbox/tag/server/POST/env}

**Update process environment**

Update the daemon's process environment. Newly spawned processes, sessions and PTYs inherit the change; already-running processes keep their environment.

### Request Body

Environment update request

Schema: **UpdateEnvRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `set` | object | No | Set maps env var names to values applied to the daemon's process env, so processes spawned after the call (exec, sessions, PTYs) inherit them. |
| `unset` | array of string | No | Unset lists env var names to remove before Set is applied. |
| `unsetValuePrefix` | string | No | UnsetValuePrefix removes every env var whose value has this prefix and whose name is not a key of Set, before Set is applied. Used to reconcile secret placeholder vars without the caller knowing the daemon's env. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | object |

---

## POST `/init` {#daytona-toolbox/tag/server/POST/init}

**Initialize toolbox server**

Set the auth token and initialize telemetry for the toolbox server

### Request Body

Initialization request

Schema: **InitializeRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | object |

---
