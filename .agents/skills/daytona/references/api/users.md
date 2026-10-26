# Users API


## Contents

- GET `/users/me`
- POST `/users/me/logins`
- POST `/users/privacy-policies/accept`
- GET `/users/account-providers`
- POST `/users/linked-accounts`
- GET `/users/me/pending-sso-links`
- POST `/users/me/pending-sso-links/{id}/confirm`/confirm}
- DELETE `/users/me/pending-sso-links/{id}`}

## GET `/users/me` {#daytona/tag/users/GET/users/me}

**Get authenticated user**

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | User details | User |

---

## POST `/users/me/logins` {#daytona/tag/users/POST/users/me/logins}

**Record a completed login**

Called by the dashboard once per completed sign-in. The email access gate evaluates the user and reports the login to analytics; a refused user receives 403 with code EMAIL_ACCESS_DENIED.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Login recorded |  |

---

## POST `/users/privacy-policies/accept` {#daytona/tag/users/POST/users/privacy-policies/accept}

**Accept the current privacy policies**

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Privacy policies accepted |  |

---

## GET `/users/account-providers` {#daytona/tag/users/GET/users/account-providers}

**Get account providers**

Social sign-in providers (Google, GitHub, ...) enabled for this environment, each flagged with whether the authenticated user has an identity linked through it.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Account providers | array of AccountProvider |

---

## POST `/users/linked-accounts` {#daytona/tag/users/POST/users/linked-accounts}

**Link account (withdrawn)**

Withdrawn. This operation is no longer supported and always responds 410.

### Request Body

Schema: **CreateLinkedAccount**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Yes | The authentication provider of the secondary account |
| `userId` | string | Yes | The user ID of the secondary account |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 410 | Account linking is no longer supported |  |

---

## GET `/users/me/pending-sso-links` {#daytona/tag/users/GET/users/me/pending-sso-links}

**List pending SSO account links for the authenticated user**

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Pending SSO account links | array of PendingSsoLink |

---

## POST `/users/me/pending-sso-links/{id}/confirm` {#daytona/tag/users/POST/users/me/pending-sso-links/{id}/confirm}

**Confirm (link) a pending SSO account link**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `id` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | SSO identity linked |  |

---

## DELETE `/users/me/pending-sso-links/{id}` {#daytona/tag/users/DELETE/users/me/pending-sso-links/{id}}

**Dismiss a pending SSO account link**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `id` | path | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Pending SSO link dismissed |  |

---
