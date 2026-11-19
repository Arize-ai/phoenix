# Toolbox API: env

Environment updates for newly created processes.

## Update future child-process environment

`POST /env`

Update environment variables for subsequently created processes, PTYs, sessions, and Git commands. Running processes and existing interpreter contexts are unchanged. `unset` removes only pushed variables (set by this operation or supplied by the platform, such as create-time variables); the sandbox's base environment is unchanged. Reserved or invalid names are rejected. Each `KEY=VALUE` entry is limited to 128 KiB and the `env` payload to 1 MiB; platform-specific environment size limits also apply.

### Request Body

`application/json`: [EnvRequest](./toolbox-schemas.md#envrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `env` | map of string | No | Environment variables to add or replace for processes, PTYs, and sessions created after this call. Keys must not also appear in `unset`. |
| `unset` | array of string | No | Names of previously added environment variables to remove. Keys must not also appear in `env`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Environment variables updated. |  |
| 400 | `BAD_REQUEST` — a name is reserved or invalid, a value contains NUL, a key appears in both `env` and `unset`, an entry exceeds 128 KiB, the payload exceeds 1 MiB, or the resulting environment exceeds the platform limit. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `EnvRequest`. | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---
