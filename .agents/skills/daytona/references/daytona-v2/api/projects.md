# Daytona API: projects

Manage projects, their members, and service-account attachments.

## Contents

- [List organization projects](#list-organization-projects)
- [Create a project](#create-a-project)
- [Get a project](#get-a-project)
- [Update a project](#update-a-project)
- [Delete a project](#delete-a-project)
- [Get the project budget](#get-the-project-budget)
- [Set a project budget](#set-a-project-budget)
- [Reset a project budget](#reset-a-project-budget)
- [Get the project lifecycle policy](#get-the-project-lifecycle-policy)
- [Update a project lifecycle policy](#update-a-project-lifecycle-policy)
- [Get the project limits](#get-the-project-limits)
- [Update the project limits](#update-the-project-limits)
- [List project members](#list-project-members)
- [Add project members](#add-project-members)
- [Remove a project member](#remove-a-project-member)
- [List project service accounts](#list-project-service-accounts)
- [Add a project service account](#add-a-project-service-account)
- [Remove a project service account](#remove-a-project-service-account)

## List organization projects

`GET /orgs/{org_id}/projects`

Non-administrator members see the default project and projects where they have explicit membership.

**Auth:** `user_jwt` (`read:projects`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of projects | [ProjectPage](./schemas.md#projectpage) (`application/json`) |
| 400 | The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a project

`POST /orgs/{org_id}/projects`

**Auth:** `user_jwt` (`write:projects`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [CreateProjectRequest](./schemas.md#createprojectrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The project name: at most 64 characters after trimming, with no control characters. `default` is reserved. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created project | [Project](./schemas.md#project) (`application/json`) |
| 400 | The project name is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The project name already exists (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a project

`GET /projects/{project_id}`

**Auth:** `user_jwt` (`read:projects`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project | [Project](./schemas.md#project) (`application/json`) |
| 400 | The project ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update a project

`PATCH /projects/{project_id}`

Updates the fields present in the request body. The default project cannot be updated.

**Auth:** `user_jwt` (`write:projects`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Request Body

`application/json`: [UpdateProjectRequest](./schemas.md#updateprojectrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The new project name: at most 64 characters after trimming, with no control characters. `default` is reserved. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project | [Project](./schemas.md#project) (`application/json`) |
| 400 | The project ID or name is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The project is the organization's default project, which cannot be renamed (`CONFLICT`). The new name already exists in the organization (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete a project

`DELETE /projects/{project_id}`

**Auth:** `user_jwt` (`delete:projects`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Project deleted |  |
| 400 | The project ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The project is the organization's default project, which cannot be deleted (`CONFLICT`). The project still owns live sandboxes, volumes, images or snapshots (`CONFLICT`). The project still has sandboxes or operations winding down (`CONFLICT`). The project still has sandbox creates in flight (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the project budget

`GET /projects/{project_id}/budget`

**Auth:** `user_jwt` (`read:budgets`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project budget | [ProjectBudget](./schemas.md#projectbudget) (`application/json`) |
| 400 | The project ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Set a project budget

`PUT /projects/{project_id}/budget`

Sets the monthly spend limit in cents. Reaching the limit blocks new sandboxes and, after the organization's grace period, stops running ones. macOS sandboxes, which run on a prepaid Mac reservation, are exempt from both: reaching the limit instead blocks buying or renewing a reservation for the project.

**Auth:** `user_jwt` (`write:budgets`)

**Required entitlement:** `project_budgets`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Request Body

`application/json`: [SetProjectBudgetRequest](./schemas.md#setprojectbudgetrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `monthly_limit_cents` | integer (int64) | Yes | The monthly budget, in US cents: an integer from `100` ($1.00) to `100000000000` ($1 billion). |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project budget, updated | [ProjectBudget](./schemas.md#projectbudget) (`application/json`) |
| 400 | The project ID or monthly limit is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The organization's plan does not include this feature (`ENTITLEMENT_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Reset a project budget

`DELETE /projects/{project_id}/budget`

Removes the monthly spend limit and releases its budget hold. Sandboxes already stopped remain stopped.

**Auth:** `user_jwt` (`write:budgets`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Project budget reset |  |
| 400 | The project ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project budget not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the project lifecycle policy

`GET /projects/{project_id}/lifecycle-policy`

**Auth:** `user_jwt` (`read:projects`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project lifecycle policy | [ProjectLifecyclePolicy](./schemas.md#projectlifecyclepolicy) (`application/json`) |
| 400 | The project ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update a project lifecycle policy

`PATCH /projects/{project_id}/lifecycle-policy`

A missing block is kept, null clears it, and an object replaces the whole block. Fields missing inside a replacement object are unset.

**Auth:** `user_jwt` (`write:projects`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Request Body

`application/json`: [UpdateProjectLifecyclePolicyRequest](./schemas.md#updateprojectlifecyclepolicyrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ephemeral` | null \| [UpdateEphemeralLifecycleDefaults](./schemas.md#updateephemerallifecycledefaults) | No | Replacement defaults for ephemeral sandboxes; null clears the block. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project lifecycle policy | [ProjectLifecyclePolicy](./schemas.md#projectlifecyclepolicy) (`application/json`) |
| 400 | The lifecycle policy is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get the project limits

`GET /projects/{project_id}/limits`

A null limit means the project has no limit of its own. The organization's limits apply on top: a sandbox is created only when it fits under both.

**Auth:** `user_jwt` (`read:projects`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project limits | [ProjectLimits](./schemas.md#projectlimits) (`application/json`) |
| 400 | The project ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update the project limits

`PATCH /projects/{project_id}/limits`

A missing limit keeps the stored value, null removes the project's limit, and an integer from 0 to 2147483647 sets it. A limit of 0 stops the project creating any sandbox that limit counts; the sandboxes it already has keep running, and lowering a limit never stops one.

**Auth:** `user_jwt` (`write:projects`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Request Body

`application/json`: [UpdateProjectLimitsRequest](./schemas.md#updateprojectlimitsrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `max_concurrent_vms` | integer (int64) \| null | No | The most sandboxes the project may run at once, or null for no project limit. |
| `max_persistent_vms` | integer (int64) \| null | No | The most persistent sandboxes the project may have, or null for no project limit. |
| `max_total_vms` | integer (int64) \| null | No | The most sandboxes the project may have, resting ones included, or null for no project limit. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project limits | [ProjectLimits](./schemas.md#projectlimits) (`application/json`) |
| 400 | A limit is outside the accepted range, or the body carries an unknown field (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List project members

`GET /projects/{project_id}/members`

**Auth:** `user_jwt` (`read:members`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of project members | [ProjectMemberPage](./schemas.md#projectmemberpage) (`application/json`) |
| 400 | The project ID is invalid (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Add project members

`POST /projects/{project_id}/members`

**Auth:** `user_jwt` (`write:members`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Request Body

`application/json`: [AddProjectMembersRequest](./schemas.md#addprojectmembersrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_ids` | array of string (uuid) | Yes | The user IDs. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project members, unchanged | [ProjectMemberList](./schemas.md#projectmemberlist) (`application/json`) |
| 201 | The created project memberships | [ProjectMemberList](./schemas.md#projectmemberlist) (`application/json`) |
| 400 | The project ID or request body is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project or organization member not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The project is the organization's default project, whose membership is implicit (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Remove a project member

`DELETE /projects/{project_id}/members/{user_id}`

Removes the project membership and revokes the API keys that depended on it.

**Auth:** `user_jwt` (`write:members`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |
| `user_id` | path | string (uuid) | Yes | The user ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Project member removed |  |
| 400 | The project ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project member not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The project is the organization's default project, whose membership is implicit (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List project service accounts

`GET /projects/{project_id}/service-accounts`

**Auth:** `user_jwt` (`read:service_accounts`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of project service accounts | [ProjectServiceAccountPage](./schemas.md#projectserviceaccountpage) (`application/json`) |
| 400 | The project ID is invalid (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Add a project service account

`POST /projects/{project_id}/service-accounts`

**Auth:** `user_jwt` (`write:service_accounts`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |

### Request Body

`application/json`: [AddProjectServiceAccountRequest](./schemas.md#addprojectserviceaccountrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service_account_id` | string (uuid) | Yes | The service account ID. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The project service accounts, unchanged | [ProjectServiceAccountList](./schemas.md#projectserviceaccountlist) (`application/json`) |
| 201 | The created project service accounts | [ProjectServiceAccountList](./schemas.md#projectserviceaccountlist) (`application/json`) |
| 400 | The project ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project or service account not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The project is the organization's default project, which is open to every service account (`CONFLICT`). The service account is archived (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Remove a project service account

`DELETE /projects/{project_id}/service-accounts/{service_account_id}`

Removes the project membership and revokes the API keys that depended on it.

**Auth:** `user_jwt` (`write:service_accounts`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `project_id` | path | string | Yes | The project ID |
| `service_account_id` | path | string (uuid) | Yes | The service account ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Project service account removed |  |
| 400 | The project ID is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Project service account not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The project is the organization's default project, which is open to every service account (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
