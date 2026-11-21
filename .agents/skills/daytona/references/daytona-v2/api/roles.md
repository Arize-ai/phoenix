# Daytona API: roles

Discover roles and access options.

## Contents

- [List organization roles](#list-organization-roles)
- [Create an organization role](#create-an-organization-role)
- [Get an organization role](#get-an-organization-role)
- [Update an organization role](#update-an-organization-role)
- [Delete an organization role](#delete-an-organization-role)
- [Preview an organization role update](#preview-an-organization-role-update)
- [List permissions](#list-permissions)
- [List roles](#list-roles)

## List organization roles

`GET /orgs/{org_id}/roles`

Returns the built-in roles in catalog order, then the organization's custom roles by name.

**Auth:** `user_jwt` (`read:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization roles | [OrganizationRoleList](./schemas.md#organizationrolelist) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create an organization role

`POST /orgs/{org_id}/roles`

Defines a custom role from the permission vocabulary. The role can grant only permissions the current member holds.

**Auth:** `user_jwt` (`write:roles`)

**Required entitlement:** `custom_roles`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [CreateOrganizationRoleRequest](./schemas.md#createorganizationrolerequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | No | The role's purpose. |
| `name` | string | Yes | The role name, unique in the organization ignoring case. Leading and trailing whitespace is removed and internal whitespace runs collapse to one space; the result must be 1 to 64 characters. |
| `organization_permissions` | array of string | Yes | The organization permissions the role grants. |
| `project_permissions` | array of string | Yes | The project permissions the role grants. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created organization role | [OrganizationRole](./schemas.md#organizationrole) (`application/json`) |
| 400 | The request body is invalid, names an unknown permission, or omits a permission every role must include (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The organization's plan does not include this feature (`ENTITLEMENT_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A role with the same name already exists (`CONFLICT`). The organization has reached its custom role limit (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get an organization role

`GET /orgs/{org_id}/roles/{role_id}`

**Auth:** `user_jwt` (`read:organization`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `role_id` | path | string | Yes | The role ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization role | [OrganizationRole](./schemas.md#organizationrole) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization or role not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update an organization role

`PATCH /orgs/{org_id}/roles/{role_id}`

Updates a custom role; a permission array in the request replaces the stored array. Narrowing a role revokes its holders' API keys that exceed their new permissions. An update that only removes permissions does not require the custom roles entitlement.

**Auth:** `user_jwt` (`write:roles`)

**Required entitlement:** `custom_roles`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `role_id` | path | string | Yes | The role ID |

### Request Body

`application/json`: [UpdateOrganizationRoleRequest](./schemas.md#updateorganizationrolerequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | No | The new role purpose. |
| `name` | string | No | The new role name. Whitespace is normalized as on create; the result must be 1 to 64 characters. |
| `organization_permissions` | array of string | No | The complete new set of organization permissions. |
| `project_permissions` | array of string | No | The complete new set of project permissions. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization role | [OrganizationRoleUpdate](./schemas.md#organizationroleupdate) (`application/json`) |
| 400 | The request body is invalid, names an unknown permission, or omits a permission every role must include (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The organization's plan does not include this feature (`ENTITLEMENT_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization or role not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A role with the same name already exists (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete an organization role

`DELETE /orgs/{org_id}/roles/{role_id}`

Deletes a custom role that no member, service account, or pending invitation holds.

**Auth:** `user_jwt` (`delete:roles`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `role_id` | path | string | Yes | The role ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Role deleted |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The required permission is missing, or the role is built in (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization or role not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A member, service account, or pending invitation holds the role (`ROLE_IN_USE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Preview an organization role update

`POST /orgs/{org_id}/roles/{role_id}/update-preview`

Reports what the same update would change, without applying it. A preview that only removes permissions does not require the custom roles entitlement.

**Auth:** `user_jwt` (`write:roles`)

**Required entitlement:** `custom_roles`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `role_id` | path | string | Yes | The role ID |

### Request Body

`application/json`: [PreviewOrganizationRoleUpdateRequest](./schemas.md#previeworganizationroleupdaterequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | No | The new role purpose. |
| `name` | string | No | The new role name. Whitespace is normalized as on create; the result must be 1 to 64 characters. |
| `organization_permissions` | array of string | No | The complete new set of organization permissions. |
| `project_permissions` | array of string | No | The complete new set of project permissions. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The role change impact | [RoleChangeImpact](./schemas.md#rolechangeimpact) (`application/json`) |
| 400 | The request body is invalid, names an unknown permission, or omits a permission every role must include (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The organization's plan does not include this feature (`ENTITLEMENT_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization or role not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A role with the same name already exists (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List permissions

`GET /permissions`

**Auth:** `user_jwt`, `org_key`, `api_key`, `platform_token`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `scope` | query | string: `project`, `organization` | No | Restrict the catalog to one permission scope. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The permission catalog | [PermissionList](./schemas.md#permissionlist) (`application/json`) |
| 400 | The scope is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List roles

`GET /roles`

**Auth:** `user_jwt`, `org_key`, `api_key`, `platform_token`

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The role catalog | [RoleList](./schemas.md#rolelist) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
