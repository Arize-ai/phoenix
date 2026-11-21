# Daytona API: organizations

Manage organizations, their members, and invitations. Members join by invitation and can look up, accept, or decline an invitation.

## Contents

- [Accept an invitation](#accept-an-invitation)
- [Decline an invitation](#decline-an-invitation)
- [Look up an invitation](#look-up-an-invitation)
- [List organizations](#list-organizations)
- [Create an organization](#create-an-organization)
- [Get an organization](#get-an-organization)
- [Update an organization](#update-an-organization)
- [Delete an organization](#delete-an-organization)
- [List organization audit logs](#list-organization-audit-logs)
- [Get the audit configuration](#get-the-audit-configuration)
- [Update audit configuration](#update-audit-configuration)
- [Get organization entitlements](#get-organization-entitlements)
- [Get organization feature flags](#get-organization-feature-flags)
- [List organization invitations](#list-organization-invitations)
- [Create an organization invitation](#create-an-organization-invitation)
- [Revoke an organization invitation](#revoke-an-organization-invitation)
- [Get organization limits](#get-organization-limits)
- [Get the macOS settings](#get-the-macos-settings)
- [Update macOS settings](#update-macos-settings)
- [List organization members](#list-organization-members)
- [Update an organization member](#update-an-organization-member)
- [Remove an organization member](#remove-an-organization-member)
- [Get a member removal preview](#get-a-member-removal-preview)
- [Preview a member update](#preview-a-member-update)
- [Get the telemetry configuration](#get-the-telemetry-configuration)
- [Set the telemetry configuration](#set-the-telemetry-configuration)
- [Reset the telemetry configuration](#reset-the-telemetry-configuration)
- [Update the preview warning setting](#update-the-preview-warning-setting)
- [List single sign-on connections](#list-single-sign-on-connections)
- [Create a single sign-on setup link](#create-a-single-sign-on-setup-link)

## Accept an invitation

`POST /invitations/accept`

Adds the current user to the organization with the invitation's roles. An existing member keeps their current roles.

**Auth:** `user_jwt`

### Request Body

`application/json`: [AcceptInvitationRequest](./schemas.md#acceptinvitationrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | The invitation token. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization member | [OrganizationMember](./schemas.md#organizationmember) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Invitation not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The roles the invitation grants no longer exist (`CONFLICT`). Membership changes in the organization are paused (`MEMBERSHIP_EDITS_FROZEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Decline an invitation

`POST /invitations/decline`

Marks the invitation as declined until it is revoked or re-issued.

**Auth:** `user_jwt`

### Request Body

`application/json`: [DeclineInvitationRequest](./schemas.md#declineinvitationrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | The invitation token. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Invitation declined |  |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Invitation not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Look up an invitation

`POST /invitations/lookup`

Looks up a pending invitation before the invitee accepts or declines it.

**Auth:** `user_jwt`

### Request Body

`application/json`: [LookupInvitationRequest](./schemas.md#lookupinvitationrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | The invitation token. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The pending invitation | [InvitationLookup](./schemas.md#invitationlookup) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Invitation not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List organizations

`GET /orgs`

**Auth:** `user_jwt`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of organizations | [OrganizationPage](./schemas.md#organizationpage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create an organization

`POST /orgs`

Creates a non-personal organization and adds the current user as its initial administrator.

**Auth:** `user_jwt`

### Request Body

`application/json`: [CreateOrganizationRequest](./schemas.md#createorganizationrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The organization name: at most 64 characters after trimming, with no control characters. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created organization | [Organization](./schemas.md#organization) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get an organization

`GET /orgs/{org_id}`

**Auth:** `user_jwt` (`read:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization | [Organization](./schemas.md#organization) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update an organization

`PATCH /orgs/{org_id}`

Updates the fields present in the request body. The name is trimmed and must contain 1 to 64 characters with no control characters. Sending the current name unchanged is accepted even when it is longer.

**Auth:** `user_jwt` (`write:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [UpdateOrganizationRequest](./schemas.md#updateorganizationrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `max_sandbox_timeout_seconds` | integer (int64) \| null | No | The longest timeout a sandbox in this organization may have, in seconds; null uses the plan maximum, or the platform maximum when there is no plan maximum. A value above that maximum is rejected. |
| `name` | string | No | The replacement organization name: at most 64 characters after trimming, with no control characters. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization | [Organization](./schemas.md#organization) (`application/json`) |
| 400 | The request body or name is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete an organization

`DELETE /orgs/{org_id}`

Deletes an organization after confirming that no active resources block removal.

**Auth:** `user_jwt` (`delete:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Organization deleted |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The organization is a personal organization (`CONFLICT`). The organization still has a Mac reservation that has not ended (`CONFLICT`). The organization still owns live sandboxes, volumes, images or snapshots (`CONFLICT`). The organization still has sandboxes or operations winding down (`CONFLICT`). The organization still has sandbox creates in flight (`CONFLICT`). The organization owns a dedicated region or macro region (`CONFLICT`). Membership changes in the organization are paused (`MEMBERSHIP_EDITS_FROZEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List organization audit logs

`GET /orgs/{org_id}/audit-logs`

Returns audit logs newest first. The `actor_created_by` field is `null` when the caller cannot view organization members. Filters use `field[op]=value`, where `op` is `eq`, `not`, `in`, `not_in`, `gt`, `gte`, `lt`, or `lte`.

**Auth:** `user_jwt` (`read:audit`), `org_key` (`read:audit`)

**Required entitlement:** `audit_log_query`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |
| `action` | query | string | No | The action filter |
| `target_type` | query | string | No | The target resource type filter |
| `target_id` | query | string | No | The target resource ID filter |
| `actor` | query | string (uuid) | No | The actor user or API key ID |
| `status` | query | integer (int32) | No | The response status code filter |
| `start_at` | query | string (date-time) | No | The inclusive start of the time range |
| `end_at` | query | string (date-time) | No | The exclusive end of the time range |
| `actor_partner` | query | string | No | The partner application filter |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of audit logs | [AuditLogPage](./schemas.md#auditlogpage) (`application/json`) |
| 400 | A query parameter is malformed (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The organization's plan does not include this feature (`ENTITLEMENT_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the audit configuration

`GET /orgs/{org_id}/audit-logs/config`

**Auth:** `user_jwt` (`read:audit`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The audit configuration | [AuditConfig](./schemas.md#auditconfig) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update audit configuration

`PATCH /orgs/{org_id}/audit-logs/config`

Enables or disables capture for future organization actions.

**Auth:** `user_jwt` (`write:audit`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [UpdateAuditConfigRequest](./schemas.md#updateauditconfigrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `disabled` | boolean | Yes | Whether to disable audit capture. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The audit configuration | [AuditConfig](./schemas.md#auditconfig) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller lacks the required permission (`FORBIDDEN`). The organization does not have audit capture settings available (`FEATURE_NOT_ENABLED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get organization entitlements

`GET /orgs/{org_id}/entitlements`

Returns every entitlement key and whether it is available to the organization.

**Auth:** `user_jwt` (`read:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization's entitlements | [Entitlements](./schemas.md#entitlements) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get organization feature flags

`GET /orgs/{org_id}/feature-flags`

**Auth:** `user_jwt` (`read:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization feature flags | [OrganizationFeatureFlags](./schemas.md#organizationfeatureflags) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List organization invitations

`GET /orgs/{org_id}/invitations`

Returns pending, declined, and expired invitations newest first.

**Auth:** `user_jwt` (`read:members`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of organization invitations | [InvitationPage](./schemas.md#invitationpage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create an organization invitation

`POST /orgs/{org_id}/invitations`

Creates an invitation or re-issues an existing invitation for the same email address. Members join an organization by looking up and accepting the invitation link; they may decline it instead.

**Auth:** `user_jwt` (`write:members`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [CreateInvitationRequest](./schemas.md#createinvitationrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | The email address to invite. |
| `roles` | array of string \| null | No | Absent ⇒ `["developer"]`; an explicit empty array is a 400. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The invitation, updated | [InvitationWithToken](./schemas.md#invitationwithtoken) (`application/json`) |
| 201 | The created invitation | [InvitationWithToken](./schemas.md#invitationwithtoken) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The organization is a personal organization, which cannot have invitations (`CONFLICT`). The email address already belongs to a member (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Revoke an organization invitation

`DELETE /orgs/{org_id}/invitations/{invitation_id}`

Invalidates an invitation that has not been accepted.

**Auth:** `user_jwt` (`write:members`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `invitation_id` | path | string (uuid) | Yes | The invitation ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Invitation revoked |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Invitation not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get organization limits

`GET /orgs/{org_id}/limits`

Returns effective limits and current usage. A null limit means unlimited.

**Auth:** `user_jwt` (`read:organization`), `api_key` (`read:limits`), `platform_token` (`read:limits`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization's limits | [OrganizationLimits](./schemas.md#organizationlimits) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the macOS settings

`GET /orgs/{org_id}/macos-settings`

**Auth:** `user_jwt` (`read:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The macOS settings | [MacosSettings](./schemas.md#macossettings) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update macOS settings

`PATCH /orgs/{org_id}/macos-settings`

**Auth:** `user_jwt` (`write:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [UpdateMacosSettingsRequest](./schemas.md#updatemacossettingsrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `macos_auto_reserve` | boolean \| null | No | Whether a macOS create or start buys a Mac reservation when the organization has none in the region. |
| `macos_auto_reserve_max_reservations` | integer (int32) \| null | No | Maximum number of automatically created reservations. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The macOS settings | [MacosSettings](./schemas.md#macossettings) (`application/json`) |
| 400 | The request body or reservation limit is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List organization members

`GET /orgs/{org_id}/members`

**Auth:** `user_jwt` (`read:members`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of organization members | [OrganizationMemberPage](./schemas.md#organizationmemberpage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update an organization member

`PATCH /orgs/{org_id}/members/{user_id}`

Replaces the member's complete role set.

**Auth:** `user_jwt` (`write:members`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `user_id` | path | string (uuid) | Yes | The user ID |

### Request Body

`application/json`: [UpdateMemberRequest](./schemas.md#updatememberrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roles` | array of string | Yes | The member's complete new role set. Required, with at least one role. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization member | [OrganizationMember](./schemas.md#organizationmember) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Member not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The update would leave the organization without an administrator (`CONFLICT`). Membership changes in the organization are paused (`MEMBERSHIP_EDITS_FROZEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Remove an organization member

`DELETE /orgs/{org_id}/members/{user_id}`

**Auth:** `user_jwt` (`read:organization`), `user_jwt` (`delete:members`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `user_id` | path | string (uuid) | Yes | The user ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Member removed |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Member not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Removal would leave the organization without an administrator (`CONFLICT`). Membership changes in the organization are paused (`MEMBERSHIP_EDITS_FROZEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a member removal preview

`GET /orgs/{org_id}/members/{user_id}/removal-preview`

Shows the API keys that removal would revoke.

**Auth:** `user_jwt` (`read:organization`), `user_jwt` (`delete:members`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `user_id` | path | string (uuid) | Yes | The user ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The member removal preview | [MemberRemovalPreview](./schemas.md#memberremovalpreview) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Member not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Preview a member update

`POST /orgs/{org_id}/members/{user_id}/update-preview`

**Auth:** `user_jwt` (`write:members`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `user_id` | path | string (uuid) | Yes | The user ID |

### Request Body

`application/json`: [PreviewMemberUpdateRequest](./schemas.md#previewmemberupdaterequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roles` | array of string | Yes | The member's complete new role set. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The change impact | [ChangeImpact](./schemas.md#changeimpact) (`application/json`) |
| 400 | The request is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Member not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The update would leave the organization without an administrator (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the telemetry configuration

`GET /orgs/{org_id}/otel-config`

Header values are write-only and are never returned.

**Auth:** `user_jwt` (`read:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The telemetry configuration | [OtelConfig](./schemas.md#otelconfig) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Set the telemetry configuration

`PUT /orgs/{org_id}/otel-config`

Replaces the forwarding endpoint and request headers. Header values are write-only, and an unknown request field is rejected.

**Auth:** `user_jwt` (`write:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [SetOtelConfigRequest](./schemas.md#setotelconfigrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `endpoint` | string | Yes | OTLP/HTTP endpoint (`https://…`; plaintext `http` only where the deployment allows insecure endpoints). |
| `headers` | map of string | No | Request headers sent to the endpoint, name → value. Values are write-only: no read returns them. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The telemetry configuration | [OtelConfig](./schemas.md#otelconfig) (`application/json`) |
| 400 | The request body or endpoint is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The organization's plan does not include this feature (`ENTITLEMENT_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Reset the telemetry configuration

`DELETE /orgs/{org_id}/otel-config`

Stops forwarding sandbox telemetry for the organization.

**Auth:** `user_jwt` (`write:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Telemetry configuration reset |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update the preview warning setting

`PATCH /orgs/{org_id}/preview-warning`

Turns the preview warning page off or on for the organization's sandbox previews. When plan requirements are enforced, turning it off requires this setting to be included in the organization's plan; turning it on does not.

**Auth:** `user_jwt` (`write:organization`)

**Required entitlement:** `preview_warning_opt_out`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [UpdatePreviewWarningRequest](./schemas.md#updatepreviewwarningrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `disabled` | boolean | Yes | `true` turns the preview warning page off for every sandbox preview of the organization (needs the `preview_warning_opt_out` entitlement where enforcement is on); `false` turns it back on. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The preview warning setting | [PreviewWarning](./schemas.md#previewwarning) (`application/json`) |
| 400 | The request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The organization's plan does not include this feature (`ENTITLEMENT_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List single sign-on connections

`GET /orgs/{org_id}/sso/connections`

Lists the single sign-on connections configured for the organization. An organization that has not completed setup has no connections.

**Auth:** `user_jwt` (`read:sso`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of single sign-on connections | [SsoConnectionPage](./schemas.md#ssoconnectionpage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The organization's plan does not include this feature (`ENTITLEMENT_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | The single sign-on provider could not complete the request (`BAD_GATEWAY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Single sign-on is temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a single sign-on setup link

`POST /orgs/{org_id}/sso/setup-links`

Creates a short-lived link for configuring single sign-on or directory sync. The link expires five minutes after issuance.

**Auth:** `user_jwt` (`write:sso`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [CreateSsoSetupLinkRequest](./schemas.md#createssosetuplinkrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `intent` | [PortalIntent](./schemas.md#portalintent) | Yes | The setup area to open: `sso` for single sign-on or `dsync` for directory sync. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created single sign-on setup link | [SsoSetupLink](./schemas.md#ssosetuplink) (`application/json`) |
| 400 | The request body or setup intent is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The organization's plan does not include this feature (`ENTITLEMENT_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The organization is a personal organization, which cannot use single sign-on (`CONFLICT`). The organization is not set up for single sign-on (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 502 | The single sign-on provider could not complete the request (`BAD_GATEWAY`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Single sign-on setup is temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
