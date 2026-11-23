# Daytona API: regions

Discover available regions.

## Contents

- [List parent regions](#list-parent-regions)
- [List organization regions](#list-organization-regions)
- [Create an organization region](#create-an-organization-region)
- [Get an organization region](#get-an-organization-region)
- [Update an organization region](#update-an-organization-region)
- [Delete an organization region](#delete-an-organization-region)
- [Get an organization region installation](#get-an-organization-region-installation)
- [List region proxy tokens](#list-region-proxy-tokens)
- [Create a region proxy token](#create-a-region-proxy-token)
- [Delete a region proxy token](#delete-a-region-proxy-token)
- [Rotate a region proxy token](#rotate-a-region-proxy-token)
- [List region registration tokens](#list-region-registration-tokens)
- [Create a region registration token](#create-a-region-registration-token)
- [Delete a region registration token](#delete-a-region-registration-token)
- [List region runners](#list-region-runners)
- [Get a region runner](#get-a-region-runner)
- [Delete a region runner](#delete-a-region-runner)
- [Cordon a region runner](#cordon-a-region-runner)
- [Uncordon a region runner](#uncordon-a-region-runner)
- [List regions](#list-regions)

## List parent regions

`GET /orgs/{org_id}/parent-regions`

Lists the regions the organization can create its own regions under.

**Auth:** `user_jwt` (`read:regions`), `org_key` (`read:regions`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The parent regions | [ParentRegionList](./schemas.md#parentregionlist) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List organization regions

`GET /orgs/{org_id}/regions`

**Auth:** `user_jwt` (`read:regions`), `org_key` (`read:regions`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of organization regions | [OrganizationRegionPage](./schemas.md#organizationregionpage) (`application/json`) |
| 400 | A query parameter is malformed (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create an organization region

`POST /orgs/{org_id}/regions`

Creates a region whose sandboxes run on the organization's own infrastructure, under one of the organization's parent regions. The region ID is generated.

**Auth:** `user_jwt` (`write:regions`), `org_key` (`write:regions`)

**Required entitlement:** `byoc_regions`

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |

### Request Body

`application/json`: [CreateOrganizationRegionRequest](./schemas.md#createorganizationregionrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The display name, 1 to 100 characters. |
| `parent_region_id` | string | Yes | The ID of a parent region from the organization's parent regions. |
| `sandbox_cidr` | string \| null | No | The private IPv4 range sandbox addresses are allocated from, a prefix length between 12 and 20. Default `10.213.0.0/16`. |
| `subnet_prefix_length` | integer (int32) \| null | No | The prefix length of each runner's subnet, between 22 and 28 and longer than the prefix length of `sandbox_cidr`. Default 24. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created organization region | [OrganizationRegion](./schemas.md#organizationregion) (`application/json`) |
| 400 | The request body is malformed (`BAD_REQUEST`). The parent region does not accept organization regions (`INVALID_PARENT_REGION`). The sandbox range or subnet prefix length is invalid (`INVALID_SANDBOX_CIDR`). | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The organization's plan does not include this feature (`ENTITLEMENT_REQUIRED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Organization not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The organization has reached its region limit (`REGION_LIMIT_REACHED`). | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get an organization region

`GET /orgs/{org_id}/regions/{region_id}`

**Auth:** `user_jwt` (`read:regions`), `org_key` (`read:regions`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization region | [OrganizationRegion](./schemas.md#organizationregion) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update an organization region

`PATCH /orgs/{org_id}/regions/{region_id}`

**Auth:** `user_jwt` (`write:regions`), `org_key` (`write:regions`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |

### Request Body

`application/json`: [UpdateOrganizationRegionRequest](./schemas.md#updateorganizationregionrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string \| null | No | The new display name, 1 to 100 characters. |
| `preview_domain` | string \| null | No | The base domain of the region's preview URLs. Must be unique, must not be a public suffix such as `co.uk`, and must not be, or be inside, a domain the platform serves. |
| `toolbox_proxy_url` | string \| null | No | The base URL of the region's proxy. Must be an `https://` URL. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The organization region | [OrganizationRegion](./schemas.md#organizationregion) (`application/json`) |
| 400 | The request body is malformed (`BAD_REQUEST`). The proxy URL is not an https URL (`INVALID_TOOLBOX_PROXY_URL`). The preview domain is malformed or overlaps another domain (`INVALID_PREVIEW_DOMAIN`). | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete an organization region

`DELETE /orgs/{org_id}/regions/{region_id}`

Deletes a region that has no runners and no sandboxes left.

**Auth:** `user_jwt` (`delete:regions`), `org_key` (`delete:regions`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Organization region deleted |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Runners or sandboxes remain in the region (`REGION_NOT_EMPTY`). | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get an organization region installation

`GET /orgs/{org_id}/regions/{region_id}/installation`

Returns the non-secret values an installation of the region's runners and proxy needs.

**Auth:** `user_jwt` (`read:regions`), `org_key` (`read:regions`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The region installation | [RegionInstallation](./schemas.md#regioninstallation) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List region proxy tokens

`GET /orgs/{org_id}/regions/{region_id}/proxy-tokens`

**Auth:** `user_jwt` (`read:regions`), `org_key` (`read:regions`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of region proxy tokens | [RegionProxyTokenPage](./schemas.md#regionproxytokenpage) (`application/json`) |
| 400 | A query parameter is malformed (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a region proxy token

`POST /orgs/{org_id}/regions/{region_id}/proxy-tokens`

Creates the token the region's own proxy authenticates with. The secret is returned only once.

**Auth:** `user_jwt` (`write:regions`), `org_key` (`write:regions`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |

### Request Body

`application/json`: [CreateRegionProxyTokenRequest](./schemas.md#createregionproxytokenrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) \| null | No | When the token expires; must be in the future. |
| `name` | string \| null | No | The display name, 1 to 100 characters. |
| `no_expiry` | boolean | No | Whether the token never expires. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created region proxy token | [RegionProxyTokenWithToken](./schemas.md#regionproxytokenwithtoken) (`application/json`) |
| 400 | The request body is malformed (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete a region proxy token

`DELETE /orgs/{org_id}/regions/{region_id}/proxy-tokens/{proxy_token_id}`

Revokes the token and disconnects the proxy that holds it.

**Auth:** `user_jwt` (`delete:regions`), `org_key` (`delete:regions`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |
| `proxy_token_id` | path | string (uuid) | Yes | The region proxy token ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Region proxy token deleted |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region proxy token not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Rotate a region proxy token

`POST /orgs/{org_id}/regions/{region_id}/proxy-tokens/{proxy_token_id}/rotation`

Creates a successor token. The replaced token keeps working for `overlap_seconds`.

**Auth:** `user_jwt` (`write:regions`), `org_key` (`write:regions`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |
| `proxy_token_id` | path | string (uuid) | Yes | The region proxy token ID |

### Request Body

`application/json`: [RotateRegionProxyTokenRequest](./schemas.md#rotateregionproxytokenrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_at` | string (date-time) \| null | No | When the successor expires; must be in the future. |
| `name` | string \| null | No | The successor's display name, 1 to 100 characters. |
| `no_expiry` | boolean | No | Whether the successor never expires. |
| `overlap_seconds` | integer (int64) \| null | No | Seconds the replaced token keeps working, 0 to 86400. Default 0. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created region proxy token | [RegionProxyTokenWithToken](./schemas.md#regionproxytokenwithtoken) (`application/json`) |
| 400 | The request body is malformed (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region proxy token not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The proxy token was already rotated (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List region registration tokens

`GET /orgs/{org_id}/regions/{region_id}/registration-tokens`

**Auth:** `user_jwt` (`read:regions`), `org_key` (`read:regions`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of registration tokens | [RegistrationTokenPage](./schemas.md#registrationtokenpage) (`application/json`) |
| 400 | A query parameter is malformed (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create a region registration token

`POST /orgs/{org_id}/regions/{region_id}/registration-tokens`

Creates a token that enrolls runners into the region. The secret is returned only once.

**Auth:** `user_jwt` (`write:runners`), `org_key` (`write:runners`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |

### Request Body

`application/json`: [CreateRegionRegistrationTokenRequest](./schemas.md#createregionregistrationtokenrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expires_in_seconds` | integer (int64) \| null | No | Seconds until the token expires, 300 to 2592000. Default 604800. |
| `max_uses` | integer (int32) \| null | No | How many runners the token may enroll, 1 to 1000. Default 100. |
| `name` | string | Yes | The display name, 1 to 100 characters. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | The created registration token | [RegistrationTokenWithToken](./schemas.md#registrationtokenwithtoken) (`application/json`) |
| 400 | The request body is malformed (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete a region registration token

`DELETE /orgs/{org_id}/regions/{region_id}/registration-tokens/{registration_token_id}`

Revokes the token. Runners it already enrolled keep working.

**Auth:** `user_jwt` (`delete:runners`), `org_key` (`delete:runners`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |
| `registration_token_id` | path | string (uuid) | Yes | The registration token ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Registration token deleted |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Registration token not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List region runners

`GET /orgs/{org_id}/regions/{region_id}/runners`

**Auth:** `user_jwt` (`read:runners`), `org_key` (`read:runners`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of region runners | [OrganizationRunnerPage](./schemas.md#organizationrunnerpage) (`application/json`) |
| 400 | A query parameter is malformed (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Region not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get a region runner

`GET /orgs/{org_id}/regions/{region_id}/runners/{runner_id}`

**Auth:** `user_jwt` (`read:runners`), `org_key` (`read:runners`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |
| `runner_id` | path | string | Yes | The runner ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The region runner | [OrganizationRunner](./schemas.md#organizationrunner) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Runner not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete a region runner

`DELETE /orgs/{org_id}/regions/{region_id}/runners/{runner_id}`

Removes the runner from the region and revokes its credentials. Its ID is never reused.

**Auth:** `user_jwt` (`delete:runners`), `org_key` (`delete:runners`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |
| `runner_id` | path | string | Yes | The runner ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Runner deleted |  |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Runner not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The runner still has sandboxes (`RUNNER_HAS_SANDBOXES`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Cordon a region runner

`POST /orgs/{org_id}/regions/{region_id}/runners/{runner_id}/cordon`

Stops new sandboxes from being placed on the runner. Its running sandboxes keep running.

**Auth:** `user_jwt` (`write:runners`), `org_key` (`write:runners`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |
| `runner_id` | path | string | Yes | The runner ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The region runner | [OrganizationRunner](./schemas.md#organizationrunner) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Runner not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The runner hasn't connected yet (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Uncordon a region runner

`POST /orgs/{org_id}/regions/{region_id}/runners/{runner_id}/uncordon`

Lets new sandboxes be placed on the runner again.

**Auth:** `user_jwt` (`write:runners`), `org_key` (`write:runners`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `org_id` | path | string (uuid) | Yes | The organization ID |
| `region_id` | path | string | Yes | The organization region ID |
| `runner_id` | path | string | Yes | The runner ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The region runner | [OrganizationRunner](./schemas.md#organizationrunner) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Runner not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The runner hasn't connected yet (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Organization regions are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List regions

`GET /regions`

Lists selectable regions in tree order: `earth` first, then each region followed by its contained regions. `parent_region_ids` lists containing regions. A parent region none of whose contained regions accepts automatic placement remains listed with `available: false` and cannot be requested when creating a sandbox.

**Auth:** `api_key`, `platform_token`

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The regions | [RegionList](./schemas.md#regionlist) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The region list is temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
