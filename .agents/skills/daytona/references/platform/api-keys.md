## Contents

- Create an API key
- Permissions & Scopes
- List API keys
- Get current API key
- Get API key
- Delete API key
- Delete API key for user
- Managed API keys
- See Also




Daytona API keys authenticate requests to the Daytona API. They are used by the Daytona SDKs and CLI to access and manage resources in your organization. An API key belongs to one organization and carries a set of [permissions](#permissions--scopes). See [authentication](../python-sdk/authentication.md) for how the SDKs, CLI, and API read the key.

## Create an API key

Create API keys to authenticate Daytona SDKs, API, and CLI requests.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/keys)
2. Click <Button>Create Key</Button>
3. Enter the name of the API key, set the expiration date, and [select permissions](#permissions--scopes)
4. Click <Button>Create</Button>
5. Copy the API key to your clipboard and use it to authenticate requests

## Permissions & Scopes

Permissions govern the resources in your organization — creating, modifying and deleting sandboxes, snapshots, registries, volumes, regions, runners and keys. Read access to sandboxes, snapshots, registries and regions is always granted and cannot be withheld.

Any member of an organization can create an API key for themselves; key creation is not itself a grantable assignment. A key cannot be created with permissions beyond those its creator holds — a request that includes any scope outside the creator's own assignments is rejected outright rather than trimmed. A member with no assignments can therefore only create a key with no permissions. `manage:api_keys` governs creating keys with an API key rather than interactively.

Sandbox runtime access is not a grantable scope. Any API key valid for an organization can address that organization's running sandboxes through the toolbox — running processes, reading and writing files, opening preview URLs and using the terminal — regardless of the permissions selected for the key, including a key created with none. The organization is the trust boundary for sandbox compute; the scopes below control the resources themselves, not what runs inside them.

Organization usage and spend data is a partial exception. The endpoints that serve usage and cost accept `read:billing`, and also accept `write:sandboxes` for compatibility with keys provisioned before `read:billing` existed. A key that can create sandboxes can therefore also read what those sandboxes cost. Interactive sessions are unaffected — a member's role must grant `read:billing` to view spending in the dashboard.

A sandbox's deletion schedule is a modification rather than a deletion. Setting the auto-delete interval or the time-to-live on an existing sandbox requires `write:sandboxes`, and both values are also accepted when a sandbox is created. When either schedule elapses the sandbox is destroyed and its local filesystem is not recoverable, so a key holding `write:sandboxes` alone can cause sandboxes to be deleted on a schedule. `delete:sandboxes` governs the explicit delete request.

Secrets are mounted into sandboxes by name, so `write:sandboxes` also governs which [secrets](../python-sdk/secrets.md) a sandbox receives. A key holding `write:sandboxes` can mount any secret in the organization without holding `manage:secrets`. A secret with no [host allowlist](../python-sdk/secrets.md#host-allowlist) is substituted into requests to any host, so such a key can obtain that secret's value. Set a host allowlist on every secret.

Creating a snapshot from an existing sandbox requires `write:sandboxes` rather than `write:snapshots`. The result is an organization [snapshot](../python-sdk/snapshots.md#create-snapshot-from-sandbox) like any other: it is listed with the organization's snapshots, other members can create sandboxes from it, it counts against the organization's snapshot quota, and it persists after the source sandbox is deleted. `delete:snapshots` governs its removal.

| **Resource** | **Scope**               | **Description**          |
| ------------ | ----------------------- | ------------------------ |
| Sandboxes    | **`write:sandboxes`**   | Create/modify sandboxes, including the deletion schedule and snapshots created from a sandbox |
|              | **`delete:sandboxes`**  | Delete sandboxes         |
| Snapshots    | **`write:snapshots`**   | Create/modify snapshots  |
|              | **`delete:snapshots`**  | Delete snapshots         |
| Registries   | **`write:registries`**  | Create/modify registries |
|              | **`delete:registries`** | Delete registries        |
| Volumes      | **`read:volumes`**      | View volumes             |
|              | **`write:volumes`**     | Create/modify volumes    |
|              | **`delete:volumes`**    | Delete volumes           |
| Audit        | **`read:audit_logs`**   | View audit logs          |
| Regions      | **`write:regions`**     | Create/modify regions    |
|              | **`delete:regions`**    | Delete regions           |
| Runners      | **`read:runners`**      | View runners             |
|              | **`write:runners`**     | Create/modify runners    |
|              | **`delete:runners`**    | Delete runners           |
| API Keys     | **`manage:api_keys`**   | Create, list, and delete API keys using an API key |
| Secrets      | **`manage:secrets`**    | Create, update, and delete [secrets](../python-sdk/secrets.md) |
| SSO          | **`manage:sso`**        | Generate Admin Portal links, list SSO connections, and manage legacy identity providers for [organization SSO](./sso.md) |
| Limits       | **`read:limits`**       | View organization limits and quota usage |
| Billing      | **`read:billing`**      | View organization usage, spend, wallet, and invoices |
|              | **`manage:billing`**    | Manage billing settings and payment methods |

## List API keys

List API keys for the current user or organization.

When authenticated with a JWT, organization owners see all keys in the organization and other users see only their own keys. When authenticated with a manager API key, the response is limited to keys that manager key created. See [Managed API keys](#managed-api-keys).

**API:**

```bash
curl 'https://app.daytona.io/api/api-keys' \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

## Get current API key

Get details of the API key used to authenticate the current request.

**API:**

```bash
curl 'https://app.daytona.io/api/api-keys/current' \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## Get API key

Get a single API key by name.

**API:**

```bash
curl 'https://app.daytona.io/api/api-keys/my-api-key' \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

## Delete API key

Delete an API key.

The key is revoked immediately and cannot be recovered.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/keys)
2. Click <Button>Revoke</Button> next to the API key you want to delete
3. Confirm the revocation

**API:**

```bash
curl 'https://app.daytona.io/api/api-keys/my-api-key' \
  --request DELETE \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

## Delete API key for user

Delete an API key for a specific user.

This endpoint requires JWT authentication and is available to the key or organization owner.

**API:**

```bash
curl 'https://app.daytona.io/api/api-keys/{userId}/my-api-key' \
  --request DELETE \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

## Managed API keys

**Contact Daytona to enable this feature for your organization.**

Daytona provides Managed API keys to create and manage API keys programmatically. Managed API keys let a manager key mint, list, and delete child API keys without a JWT session.

A manager key is an API key with the **`manage:api_keys`** permission. Use this when an application or service needs to issue scoped keys to tenants or workloads at runtime.

When authenticated with a manager key:

- child key permissions must be a subset of the manager key's permissions
- a manager key can only list and delete keys it created; it cannot access other keys
- child keys cannot manage other keys unless you explicitly grant them **`manage:api_keys`**

### Create a manager key

Create a manager key.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/keys)
2. Click <Button>Create Key</Button>
3. Enter the key name, set the expiration date, and enable **Manage API keys**
4. Select the resource scopes child keys may use
5. Click <Button>Create</Button>
6. Copy the API key to your clipboard

**API:**

```bash
curl 'https://app.daytona.io/api/api-keys' \
  --request POST \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --data '{
  "name": "Manager Key",
  "permissions": ["manage:api_keys", "write:sandboxes", "delete:sandboxes"]
}'
```

### Create a child key

Create a child key.

**API:**

```bash
curl 'https://app.daytona.io/api/api-keys' \
  --request POST \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_MANAGER_API_KEY' \
  --data '{
  "name": "tenant-a-key",
  "permissions": ["write:sandboxes", "delete:sandboxes"]
}'
```

The response includes the full child key value. Store it immediately. After creation, only a masked value is available when listing keys.

### List child keys

List child keys.

**API:**

```bash
curl 'https://app.daytona.io/api/api-keys' \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Authorization: Bearer YOUR_MANAGER_API_KEY'
```

### Delete a child key

Delete a child key.

1. Authenticate with the manager key
2. Send a `DELETE` request to `/api-keys/{name}`

    A manager key can only delete keys it created

**API:**

```bash
curl 'https://app.daytona.io/api/api-keys/tenant-a-key' \
  --request DELETE \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Authorization: Bearer YOUR_MANAGER_API_KEY'
```

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
