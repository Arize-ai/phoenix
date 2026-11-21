# API Keys (TypeScript SDK)

Create and manage API keys for your projects.

API keys are secret tokens that authenticate requests to sandboxes and the other resources of a project. They let a program work with sandboxes without a person signing in, and their permissions limit what anyone with a leaked key can reach.

Daytona issues each project API key for exactly one project, with an explicit list of permissions, and confines its requests to both. A key that a member creates is revoked when the member leaves the organization or loses a permission that the key holds. Organization API keys are a separate kind, for organization-level operations that are not tied to a project.

Use API keys to authenticate requests from the SDKs, the CLI, and the API to the resources of a [project](./projects.md). See [authentication](./authentication.md) for how each request carries a key. A key can carry an expiry time, and a key created without one never expires.

## Contents

- [Create an API key](#create-an-api-key)
- [Credentials](#credentials)
- [Scopes](#scopes)
- [Operations](#operations)
- [Service accounts](#service-accounts)
- [Organization API keys](#organization-api-keys)
- [Permissions](#permissions)

## Create an API key

Create an API key to authenticate the requests of a program to a project. An API key is a secret token that a program sends with its requests, so a service can identify the caller.

A new API key belongs to the project it is created in, and its permissions and expiry are fixed when it is created. Only a hash of the token is stored, so the token cannot be read again.

Create a key from the dashboard, the CLI, or the API. In an organization synced with Daytona v0, a key that a member creates in the default project, under a name other than default, is also copied to Daytona v0. The copy can read every sandbox, snapshot, and registry in the organization, whatever the key's permissions. To keep a key off Daytona v0, turn the copy off when you create the key, or [update the key](#update-an-api-key) afterwards.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/keys)
2. Select the project in the header switcher
3. Click **Create API Key**
4. Enter a **Key Name**, optionally set an expiry, and [select permissions](#scopes)
5. Click **Create API Key**
6. Copy the API key to your clipboard and use it to authenticate requests

**CLI:**

```bash
daytona key mint --project PROJECT_ID \
  --name my-api-key \
  --permission write:sandboxes,delete:sandboxes \
  --expires 2027-01-01T00:00:00Z
```

| **Flag** | **Description** |
| --- | --- |
| `--permission` | Sets the permissions that the key holds.<br />**Required**<br />**Format:** a comma-separated list of permissions, repeatable<br />**Value:** the [project permissions](./api-keys.md#scopes)<br />**Example:** `write:sandboxes,delete:sandboxes` |
| `--expires` | Sets when the key expires.<br />**Default:** no expiry<br />**Format:** an RFC 3339 timestamp, or a whole-second Go duration counted from now<br />**Example:** `720h` |
| `--name` | Sets the key name.<br />**Default:** `default`<br />**Example:** `my-api-key` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The key can hold only permissions that you hold.
> - **Results:** The command prints the token once, when the key is created.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/api-keys' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "my-api-key",
  "project_permissions": ["write:sandboxes", "delete:sandboxes"],
  "expires_at": "2027-01-01T00:00:00Z"
}'
```

**Response:**

```json
{
  "id": "KEY_ID",
  "name": "my-api-key",
  "project_id": "PROJECT_ID",
  "key_prefix": "dtn_...",
  "token": "YOUR_API_KEY",
  "project_permissions": ["read:sandboxes", "write:sandboxes", "delete:sandboxes"],
  "created_at": "2026-09-10T12:00:00Z",
  "expires_at": "2027-01-01T00:00:00Z",
  "service_account_id": null,
  "sync_to_v0": false
}
```

| **Field** | **Description** |
| --- | --- |
| `project_permissions` | Sets the permissions that the key holds.<br />**Required**<br />**Minimum:** 1 permission<br />**Maximum:** the permissions that the caller holds<br />**Example:** `["write:sandboxes", "delete:sandboxes"]` |
| `expires_at` | Sets when the key expires.<br />**Default:** no expiry<br />**Format:** an RFC 3339 timestamp<br />**Example:** `"2027-01-01T00:00:00Z"` |
| `name` | Sets the key name.<br />**Default:** `"default"`<br />**Rules:** unique among the project's live keys, unless `default`<br />**Example:** `"my-api-key"` |
| `service_account_id` | Sets the service account that owns the key.<br />**Default:** the signed-in user<br />**Format:** a service account ID |
| `sync_to_v0` | Sets whether the v0 key sync copies the key to Daytona v0.<br />**Default:** `true` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The key can hold only permissions that you hold.
> - **Behaviour:** The v0 key sync copies only keys that a person creates in the `default` project.

## Credentials

Bearer credentials are tokens that grant access to any party that presents them with a request. Possession alone is enough to use one, so each must be kept secret.

The bearer credentials accepted for a project are API keys, which programs hold, and the session tokens of signed-in users, which the dashboard holds. Routes that act on behalf of a person accept only the session token and reject API keys.

Send an API key from a program, and a session token for management requests made on behalf of a person. The API examples on this page name them `YOUR_API_KEY` and `YOUR_OIDC_TOKEN`. [Organization API keys](#organization-api-keys) are a third kind, scoped to an organization instead of one project, and their own section lists the scopes that they can hold.

| **Credential** | **Description**                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API KEY**    | A project API key created as described above. It authenticates SDK, toolbox, and sandbox requests, and the few management routes that accept it, such as [getting the current key](#get-current-api-key). This is the credential the SDKs and the `DAYTONA_API_KEY` variable carry. See [authentication](./authentication.md) for how to pass it to the SDKs, the CLI, and API requests.                                                                                             |
| **OIDC TOKEN** | The session token of a signed-in user (an OIDC bearer JWT, the credential the dashboard uses). Management routes that act on behalf of a person require it and reject API keys with `401`: creating, listing, and revoking keys, service accounts, [organizations](./organizations.md), [projects](./projects.md), and [billing](../platform/billing.md). Obtain it by signing in with the dashboard or `daytona login`; the CLI commands in those sections use the saved session for you. |

## Scopes

A scope is a permission that a credential carries, and it allows one kind of action, such as read, write, or delete, on one kind of resource. Scopes keep a credential to the access that its program needs, so a leaked credential reaches no more than that.

The scopes of a project API key apply only to the resources of its project. The limits scope is the exception: it reads the limits of the whole organization. A key that holds the write or delete scope of a resource also holds the read scope of that resource.

Select the scopes of a key when you [create it](#create-an-api-key), for the resources that its program reads, changes, or deletes. A key gets no scopes by default and needs at least one.

| **Resource**       | **Scope**               | **Description**                                                    |
| ------------------ | ----------------------- | ------------------------------------------------------------------ |
| Sandboxes          | **`read:sandboxes`**    | View sandboxes                                                     |
|                    | **`write:sandboxes`**   | Create/modify sandboxes and use the toolbox                        |
|                    | **`delete:sandboxes`**  | Delete sandboxes                                                   |
| Snapshots          | **`read:snapshots`**    | View [snapshots](./snapshots.md)                               |
|                    | **`write:snapshots`**   | Create/modify snapshots                                            |
|                    | **`delete:snapshots`**  | Delete snapshots                                                   |
| Images             | **`read:images`**       | View [images](./images.md)                                     |
|                    | **`write:images`**      | Create/modify images                                               |
|                    | **`delete:images`**     | Delete images                                                      |
| Volumes            | **`read:volumes`**      | View [volumes](./volumes.md)                                   |
|                    | **`write:volumes`**     | Create/modify volumes                                              |
|                    | **`delete:volumes`**    | Delete volumes                                                     |
| Registries         | **`read:registries`**   | View [registries](./registries.md)                             |
|                    | **`write:registries`**  | Create/modify registries                                           |
|                    | **`delete:registries`** | Delete registries                                                  |
| Secrets            | **`read:secrets`**      | View [secrets](./secrets.md)                                   |
|                    | **`write:secrets`**     | Create/modify secrets                                              |
|                    | **`delete:secrets`**    | Delete secrets                                                     |
| Spending           | **`read:spending`**     | View project spending                                              |
| Limits             | **`read:limits`**       | View [organization limits](./organizations.md#limits)          |
| Functions          | **`read:functions`**    | View functions                                                     |
|                    | **`write:functions`**   | Deploy and configure functions                                     |
|                    | **`delete:functions`**  | Delete functions                                                   |
| Invocations        | **`read:invocations`**  | View invocation history                                            |
|                    | **`write:invocations`** | Invoke functions                                                   |

## Operations

Operations on API keys are the reads, updates, and revocations made on keys that already exist. They show which credentials a project holds and retire the ones that are no longer needed.

Operations on API keys act on their records and never return a token. None of them can change the permissions or the expiry of a key after creation.

Use the operations below to review the keys of a project and revoke the ones that are no longer used. To change the permissions or the expiry of a key, create a new key and revoke the old one.

### List API keys

List API keys to see the names, permissions, expiry, and last use of the keys of a project. A list returns the stored records of one kind of resource, one page at a time.

A list of API keys covers one project and omits the token of every key. Revoked keys are left out, and expired keys stay listed until they are deleted.

Use the list to find a key to revoke, or to check when each key was last used. The list is paginated, newest first. Revoked and expired keys are deleted 7 days after they stop working.

**CLI:**

```bash
daytona key list --project PROJECT_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/api-keys' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

**Response:**

```json
{
  "project_api_keys": [
    {
      "id": "KEY_ID",
      "name": "my-api-key",
      "project_id": "PROJECT_ID",
      "key_prefix": "dtn_...",
      "created_at": "2026-09-10T12:00:00Z",
      "revoked_at": null,
      "last_used_at": "2026-09-11T08:30:00Z",
      "project_permissions": ["read:sandboxes", "write:sandboxes", "delete:sandboxes"],
      "expires_at": "2027-01-01T00:00:00Z",
      "service_account_id": null,
      "service_account_name": null,
      "sync_to_v0": false
    }
  ],
  "next_cursor": null
}
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Get API key

Get an API key to read the record of a single key of a project by its ID. A get reads one resource by its identifier and changes nothing on the server.

A get of an API key returns the same record as a list, for one key, without its token. Unlike the list, it also returns a revoked key until the key is deleted.

Get a key to check its permissions, expiry, or revocation time. Address the key by the ID that the create response or a list of the project's keys returns.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/api-keys/KEY_ID' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Get current API key

Get the current API key to find out which key authenticates a request. Token introspection is a request in which a credential describes itself, such as its owner, scope, and expiry.

A get of the current API key returns the record of the key that sent the request, with the project and organization it acts in and the permissions it carries. The response never contains the token.

Get the current key when a program holds a key and needs to know which project and organization it acts in. Read it from the SDKs or the API. An access token from a [token exchange](#exchange-a-token) has no key to read, and the request for it is refused.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const key = await daytona.v2.currentApiKey()
console.log(key.name, key.context.projectName, key.context.orgName)
console.log(key.projectPermissions)
```

> **Notes:**
>
> - **Prerequisites:** The client must authenticate with a project API key.

### Exchange a token

Exchange a token to trade the session token of a signed-in user for a short-lived access token. A token exchange, defined by the OAuth 2.0 Token Exchange standard (RFC 8693), issues a new token in place of a token that the caller already holds.

An exchange of a session token issues an access token scoped to one project, with the user's own permissions in that project. The access token then authenticates workload requests in place of a project API key, until the access token expires.

Exchange a token when a program acts for a signed-in user instead of holding a project API key. Organization API keys cannot be exchanged. The response states the lifetime of the access token in seconds, counted from the moment of the exchange.

**API:**

```bash
curl 'https://api.daytona.com/auth/token' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
  "subject_token": "YOUR_OIDC_TOKEN",
  "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "project_id": "PROJECT_ID"
}'
```

**Response:**

```json
{
  "access_token": "eyJ...",
  "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "token_type": "Bearer",
  "expires_in": 300
}
```

| **Field** | **Description** |
| --- | --- |
| `grant_type` | Sets the grant type.<br />**Required**<br />**Value:** `urn:ietf:params:oauth:grant-type:token-exchange` |
| `subject_token` | Sets the session token to exchange.<br />**Required** |
| `subject_token_type` | Sets the type of the session token.<br />**Required**<br />**Value:** `urn:ietf:params:oauth:token-type:access_token` or `urn:ietf:params:oauth:token-type:jwt` |
| `project_id` | Sets the project that the access token acts in.<br />**Format:** a project ID |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. You must be a member of the project.
> - **Compatibility:** The subject token must be the same token as the bearer token of the request. The request must omit scope and resource.
> - **Lifetime:** Exchange again for a new access token when the current one expires.

### Update an API key

Update an API key to change the setting that it keeps after creation. An update changes the settings of an existing resource without replacing it.

An update of an API key changes only whether the key is copied to Daytona v0. The key itself keeps working as before, whether or not the copy exists.

Update a key to turn its Daytona v0 copy off, or back on. The copy can read every sandbox, snapshot, and registry of the organization on Daytona v0, since Daytona v0 has no read permissions. Turning the copy off deletes the Daytona v0 key soon after. A key imported from Daytona v0 is always copied, and its copy cannot be turned off.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/api-keys/KEY_ID' \
  --request PATCH \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "sync_to_v0": false }'
```

| **Field** | **Description** |
| --- | --- |
| `sync_to_v0` | Sets whether the v0 key sync copies the key to Daytona v0. |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The key must be one that a person created in the `default` project of an organization that syncs with Daytona v0, under a name other than `default`.
> - **Effects:** Setting `false` deletes the Daytona v0 copy, and setting `true` copies the key again.

### Revoke an API key

Revoke an API key to stop it from authenticating any further requests. A revocation invalidates a credential permanently, before it would otherwise expire.

A revocation of an API key cannot be undone, and any new request made with the key fails.

Revoke a key when it leaks or is no longer needed, from the dashboard or programmatically. A regional proxy can still accept the key for up to 30 seconds after revocation. The key is deleted 7 days after it is revoked, and revoking it again changes nothing.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/keys)
2. Click **Revoke** next to the API key you want to revoke
3. Confirm the revocation

**CLI:**

```bash
daytona key revoke KEY_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.
> - **Confirmation:** The command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/api-keys/KEY_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

## Service accounts

Service accounts are non-human identities that belong to programs instead of people. They let automation hold credentials that do not depend on any one person staying in an organization.

The service accounts of an organization hold roles as members do, and own API keys. Removing a member or changing a member's roles leaves the keys of a service account in place.

Use service accounts to own the API keys of automation, so that the keys are not tied to a person's membership. A service account cannot own an organization API key.

### Create a service account

Create a service account to give automation an identity of its own in an organization. A new identity starts with the roles it is given and holds no credential until one is created for it.

A new service account belongs to one organization and owns no API keys.

Create a service account from the CLI or the API before you [create keys](#create-a-service-account-key) for it. Give it only the roles that its automation needs, since its keys can hold no more than those roles allow.

**CLI:**

```bash
daytona service-account create my-service-account --role developer --org ORG_ID
```

| **Flag** | **Description** |
| --- | --- |
| `<name>` | Sets the service account name.<br />**Required**<br />**Minimum:** 1 character<br />**Maximum:** 64 characters<br />**Format:** letters, digits, hyphens, and underscores<br />**Rules:** unique in the organization<br />**Example:** `my-service-account` |
| `--role` | Sets the roles of the service account.<br />**Required**<br />**Format:** a comma-separated list of role IDs, repeatable<br />**Value:** [built-in role](./organizations.md#roles) IDs or custom role UUIDs<br />**Example:** `developer` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must not be a personal organization. You must hold every permission that the roles grant.
> - **Compatibility:** A service account cannot hold the `admin` role.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORG_ID/service-accounts' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "my-service-account",
  "roles": ["developer"]
}'
```

| **Field** | **Description** |
| --- | --- |
| `name` | Sets the service account name.<br />**Required**<br />**Minimum:** 1 character<br />**Maximum:** 64 characters<br />**Format:** letters, digits, hyphens, and underscores<br />**Rules:** unique in the organization<br />**Example:** `"my-service-account"` |
| `roles` | Sets the roles of the service account.<br />**Required**<br />**Minimum:** 1 role<br />**Maximum:** every built-in and custom role of the organization<br />**Format:** a list of role IDs<br />**Value:** [built-in role](./organizations.md#roles) IDs or custom role UUIDs<br />**Example:** `["developer"]` |
| `description` | Sets the purpose of the service account.<br />**Maximum:** 512 characters<br />**Example:** `"CI runner"` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must not be a personal organization. You must hold every permission that the roles grant.
> - **Compatibility:** A service account cannot hold the `admin` role.

### Create a service account key

Create a service account key to give automation an API key that a service account owns. A key owned by a non-human identity does not depend on the membership of its creator.

A key of a service account belongs to one project and keeps working when its creator leaves the organization. Archiving the service account, or removing it from the project, revokes the key.

Create the key from the dashboard or programmatically. Outside the default project, the service account must first be [added to the project](./projects.md#add-project-service-accounts). The key can carry only the project permissions that you and the service account both hold in the project.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/keys)
2. Click **Create API Key**
3. Under **Owner**, select the service account
4. Enter a **Key Name**, [select permissions](#scopes), and click **Create API Key**

**CLI:**

```bash
daytona key mint --project PROJECT_ID \
  --name my-service-account-key \
  --permission write:sandboxes \
  --service-account SERVICE_ACCOUNT_ID \
  --org ORG_ID
```

| **Flag** | **Description** |
| --- | --- |
| `--service-account` | Sets the service account that owns the key.<br />**Format:** a service account ID or name |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. Outside the default project, the service account must be a member of the project. The key must have a name other than `default`.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/api-keys' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "my-service-account-key",
  "project_permissions": ["write:sandboxes"],
  "service_account_id": "SERVICE_ACCOUNT_ID"
}'
```

| **Field** | **Description** |
| --- | --- |
| `service_account_id` | Sets the service account that owns the key.<br />**Format:** a service account ID |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. Outside the default project, the service account must be a member of the project. The key must have a name other than `default`.

### List service accounts

List service accounts to see the service accounts of an organization with their names and roles. A list returns the stored records of one kind of resource, one page at a time.

A list of service accounts covers one organization and leaves out archived accounts.

Use the list to find the ID of a service account before you update it or create a key for it. The list is paginated, newest first.

**CLI:**

```bash
daytona service-account list --org ORG_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORG_ID/service-accounts' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Get a service account

Get a service account to read its name, description, and roles by its ID. A get reads one resource by its identifier and changes nothing on the server.

A get of a service account returns the same record as a list, for one account, including the number of its live API keys. Unlike the list, it also returns an archived account.

Get a service account to check its roles before you create a key for it or change them.

**CLI:**

```bash
daytona service-account get SERVICE_ACCOUNT_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORG_ID/service-accounts/SERVICE_ACCOUNT_ID' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Update a service account

Update a service account to change its name, description, or roles. An update changes the settings of an existing resource without replacing it.

An update of a service account replaces its whole role set when it names roles. When the new roles are narrower, the account's project API keys that exceed them are revoked.

Update a service account when its automation needs different access, from the CLI or the API. Fields that you leave out of the request stay unchanged. Preview an update from the API to count the keys that it would revoke before you apply it.

**CLI:**

```bash
# The CLI updates the name (--name) and roles (--role); it cannot set the description
daytona service-account update SERVICE_ACCOUNT_ID --role maintainer
```

| **Flag** | **Description** |
| --- | --- |
| `--name` | Sets the new service account name.<br />**Minimum:** 1 character<br />**Maximum:** 64 characters<br />**Format:** letters, digits, hyphens, and underscores<br />**Rules:** at least one of --name or --role<br />**Example:** `ci-runner` |
| `--role` | Replaces the roles of the service account.<br />**Format:** a comma-separated list of role IDs, repeatable<br />**Rules:** at least one of --name or --role<br />**Value:** [built-in role](./organizations.md#roles) IDs or custom role UUIDs<br />**Example:** `maintainer` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. You must hold every permission that the new roles grant.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORG_ID/service-accounts/SERVICE_ACCOUNT_ID' \
  --request PATCH \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "description": "CI runner",
  "roles": ["maintainer"]
}'

# Preview the change without applying it: { "revoked_api_keys": ..., "revoked_preview_grants": ... }
curl 'https://api.daytona.com/orgs/ORG_ID/service-accounts/SERVICE_ACCOUNT_ID/update-preview' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "roles": ["maintainer"]
}'
```

| **Field** | **Description** |
| --- | --- |
| `description` | Sets the new purpose of the service account.<br />**Maximum:** 512 characters<br />**Rules:** at least one of name, description, or roles<br />**Value:** `null` to clear the description<br />**Example:** `"CI runner"` |
| `name` | Sets the new service account name.<br />**Minimum:** 1 character<br />**Maximum:** 64 characters<br />**Format:** letters, digits, hyphens, and underscores<br />**Rules:** at least one of name, description, or roles<br />**Example:** `"ci-runner"` |
| `roles` | Replaces the roles of the service account.<br />**Minimum:** 1 role<br />**Maximum:** every built-in and custom role of the organization<br />**Format:** a list of role IDs<br />**Rules:** at least one of name, description, or roles<br />**Value:** [built-in role](./organizations.md#roles) IDs or custom role UUIDs<br />**Example:** `["maintainer"]` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. You must hold every permission that the new roles grant.
> - **Results:** The update preview returns the revoked counts without applying the change.

### Archive a service account

Archive a service account to stop it, and every key it owns, from being used. Archiving retires a resource from use but keeps its record for later reads.

An archive of a service account revokes every project API key it owns. An archived account cannot be updated, added to projects, or given new keys, and lists do not contain it.

Archive a service account when its automation no longer runs, from the CLI or the API. Archiving an account that is already archived changes nothing.

**CLI:**

```bash
daytona service-account delete SERVICE_ACCOUNT_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.
> - **Confirmation:** The command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORG_ID/service-accounts/SERVICE_ACCOUNT_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

## Organization API keys

Organization API keys authenticate organization-level operations that are not tied to a project. Scoping a key to one level, an organization or a project, narrows what a leaked key can reach.

An organization API key cannot hold a project scope, so it cannot create a sandbox. Its token is returned once, when the key is created, and only a hash of it is stored.

Create an organization API key to read audit logs or manage [BYOC regions](./bring-your-own-compute.md) from automation. Create, list, and revoke organization API keys from the CLI or the API.

| **Resource**        | **Scope**                                                     | **Description**                             |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| Audit logs          | **`read:audit`**                                              | View [audit logs](./audit-logs.md)      |
| Regions             | **`read:regions`**, **`write:regions`**, **`delete:regions`** | View, create, and delete the organization's dedicated regions |
| Runners             | **`read:runners`**, **`write:runners`**, **`delete:runners`** | View, enroll, and delete the runners of dedicated regions |
| Billing             | **`read:billing`**, **`write:billing`**                       | List [region price multipliers](./regions.md#list-region-price-multipliers). Other [billing](../platform/billing.md#permissions) requests require a signed-in user. |
| Spending            | **`read:spending`**                                           | View organization spending                  |
| Telemetry           | **`read:telemetry`**                                          | Read sandbox logs, traces, and metrics      |

**CLI:**

```bash
# Create
daytona org-key mint --org ORG_ID --name my-org-key --permission read:audit

# List
daytona org-key list --org ORG_ID

# Revoke
daytona org-key revoke KEY_ID
```

| **Flag** | **Description** |
| --- | --- |
| `--name` | Sets the key name.<br />**Required**<br />**Example:** `my-org-key` |
| `--permission` | Sets the organization permissions that the key holds.<br />**Required**<br />**Format:** a comma-separated list of organization API key scopes, repeatable<br />**Value:** `read:audit`, `read:billing`, `write:billing`, `read:spending`, `read:telemetry`, `read:regions`, `write:regions`, `delete:regions`, `read:runners`, `write:runners`, or `delete:runners`<br />**Example:** `read:audit` |
| `--expires` | Sets when the key expires.<br />**Default:** no expiry<br />**Format:** an RFC 3339 timestamp, or a whole-second Go duration counted from now<br />**Example:** `720h` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The key can hold only permissions that you hold.
> - **Results:** The mint command prints the token once, when the key is created.
> - **Confirmation:** The revoke command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
# Create
curl 'https://api.daytona.com/orgs/ORG_ID/api-keys' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "my-org-key",
  "org_permissions": ["read:audit"]
}'

# List
curl 'https://api.daytona.com/orgs/ORG_ID/api-keys' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

# Get
curl 'https://api.daytona.com/orgs/ORG_ID/api-keys/KEY_ID' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

# Revoke
curl 'https://api.daytona.com/orgs/ORG_ID/api-keys/KEY_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `name` | Sets the key name.<br />**Required**<br />**Example:** `"my-org-key"` |
| `org_permissions` | Sets the organization permissions that the key holds.<br />**Required**<br />**Minimum:** 1 permission<br />**Maximum:** the permissions that the caller holds<br />**Format:** a list of organization API key scopes<br />**Value:** `read:audit`, `read:billing`, `write:billing`, `read:spending`, `read:telemetry`, `read:regions`, `write:regions`, `delete:regions`, `read:runners`, `write:runners`, or `delete:runners`<br />**Example:** `["read:audit"]` |
| `expires_at` | Sets when the key expires.<br />**Default:** no expiry<br />**Format:** an RFC 3339 timestamp<br />**Example:** `"2027-01-01T00:00:00Z"` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The key can hold only permissions that you hold.

## Permissions

API keys and service accounts are managed with organization permissions, which you can grant through an [organization role](./organizations.md#roles). A key can hold only the permissions its creator holds. The [audit logs](./audit-logs.md) record key creates, updates, and revocations, and service account changes.

| **Permission**                | **Grants**                                                          |
| ----------------------------- | ------------------------------------------------------------------- |
| **`read:project_api_keys`**   | List and get project API keys                                       |
| **`write:project_api_keys`**  | Create project API keys, and update and revoke the keys you created |
| **`delete:project_api_keys`** | Update and revoke keys that other members created                   |
| **`read:org_api_keys`**       | List and get organization API keys                                  |
| **`write:org_api_keys`**      | Create organization API keys                                        |
| **`delete:org_api_keys`**     | Revoke organization API keys                                        |
| **`read:service_accounts`**   | List and get service accounts                                       |
| **`write:service_accounts`**  | Create and update service accounts, and create their keys together with `write:project_api_keys` |
| **`delete:service_accounts`** | Archive service accounts, and update and revoke their keys          |
