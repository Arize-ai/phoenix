# Daytona API: auth

Exchange a signed-in session for a short-lived access token.

## Exchange a sign-in token

`POST /auth/token`

Returns a project-scoped token for `daytona:api` or an organization-scoped token for `daytona:analytics`.

**Auth:** `oidc_jwt`

### Request Body

Token exchange request. `audience`, `org_id`, and `project_id` may each appear at most once.

`application/json`: [ExchangeTokenRequest](./schemas.md#exchangetokenrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audience` | string \| null | No | Target audience. Omit it, or send `daytona:api`, for a project-scoped token; send `daytona:analytics` for an organization-scoped token. Any other value is refused; the parameter may not be repeated. |
| `grant_type` | string | Yes | Must be `urn:ietf:params:oauth:grant-type:token-exchange`. |
| `org_id` | string (uuid) \| null | No | The organization for the analytics token. Required when `audience` is `daytona:analytics`; omitted (or `null`) otherwise. |
| `project_id` | string (uuid) \| null | No | The project for the API token. Required when `audience` is absent or `daytona:api`; omitted (or `null`) when `audience` is `daytona:analytics`. |
| `resource` | string \| null | No | RFC 8693 target resource. Explicit down-scoping is not supported; omit this parameter. |
| `scope` | string \| null | No | RFC 8693 scope request. Explicit down-scoping is not supported; omit this parameter. |
| `subject_token` | string | Yes | The sign-in token. It must match the bearer token on the request. |
| `subject_token_type` | string | Yes | Subject token type. |

`application/x-www-form-urlencoded`: [ExchangeTokenRequest](./schemas.md#exchangetokenrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audience` | string \| null | No | Target audience. Omit it, or send `daytona:api`, for a project-scoped token; send `daytona:analytics` for an organization-scoped token. Any other value is refused; the parameter may not be repeated. |
| `grant_type` | string | Yes | Must be `urn:ietf:params:oauth:grant-type:token-exchange`. |
| `org_id` | string (uuid) \| null | No | The organization for the analytics token. Required when `audience` is `daytona:analytics`; omitted (or `null`) otherwise. |
| `project_id` | string (uuid) \| null | No | The project for the API token. Required when `audience` is absent or `daytona:api`; omitted (or `null`) when `audience` is `daytona:analytics`. |
| `resource` | string \| null | No | RFC 8693 target resource. Explicit down-scoping is not supported; omit this parameter. |
| `scope` | string \| null | No | RFC 8693 scope request. Explicit down-scoping is not supported; omit this parameter. |
| `subject_token` | string | Yes | The sign-in token. It must match the bearer token on the request. |
| `subject_token_type` | string | Yes | Subject token type. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The platform access token | [TokenExchange](./schemas.md#tokenexchange) (`application/json`) |
| 400 | The token exchange request is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project or organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
