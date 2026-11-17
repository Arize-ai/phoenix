# Daytona API: users

Read the signed-in user.

## Get the current user

`GET /me`

**Auth:** `user_jwt` (`write:project_api_keys`)

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The user | [User](./schemas.md#user) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the privacy policy status

`GET /me/privacy-policy`

Reports whether the signed-in user has accepted the privacy policy version the platform currently requires.

**Auth:** `user_jwt`

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The privacy policy status | [PrivacyPolicyStatus](./schemas.md#privacypolicystatus) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Accept the privacy policy

`POST /me/privacy-policy/accept`

Records that the signed-in user accepts the named privacy policy version, which must be the version the platform currently requires. Accepting a version again only refreshes the acceptance time.

**Auth:** `user_jwt`

### Request Body

`application/json`: [AcceptPrivacyPolicyRequest](./schemas.md#acceptprivacypolicyrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | The policy version the user was shown and accepts. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Privacy policy acceptance saved |  |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The named version is not the version the platform currently requires (`CONFLICT`). The platform requires no privacy policy consent (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
