## Contents

- Configure SSO
- List SSO connections
- Sign in with SSO
- Configure SCIM directory sync
- Legacy OIDC identity providers
- See Also




Organization SSO (Single Sign-On) lets collaborative organizations sign members in through their own identity provider. You connect the identity provider in the Admin Portal, which Daytona opens from the SSO page, and members sign in from the regular Daytona login page. Daytona joins members to the organization on their first sign-in.

The Admin Portal guides you through the setup for your identity provider step by step, with instructions and screenshots for each screen you configure on the identity provider side. Connections can use SAML or OIDC. Daytona lists the connections you configure on the SSO page.

Managing SSO requires the **`manage:sso`** permission. Organization owners and members with the **SSO Admin** assignment can open the SSO page. See [roles](./organizations.md#roles).
> **Note:**
> SSO is available on the Enterprise plan for collaborative organizations. Personal organizations cannot configure SSO.

## Configure SSO

Connect an identity provider to your organization. Daytona generates a single-use Admin Portal link and opens it in a new tab.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/sso)
2. Click <Button>Configure SSO</Button>
3. Select your identity provider in the Admin Portal and follow the setup steps
4. Complete the setup to return to the SSO page

The link is generated on click and expires five minutes after issuance. Click the button again to generate a new one.

The API returns **`402`** when the organization's plan does not include SSO, and **`503`** when the organization is not yet ready for Admin Portal setup. Retry after a few seconds on **`503`**.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers/workos-admin-portal-link' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "intent": "sso"
}'
```

## List SSO connections

List the SSO connections configured for your organization. The SSO page shows them under **SSO connections**. Daytona reads the connections from the Admin Portal and displays them read-only. To change a connection, click <Button>Configure SSO</Button> and make the change in the Admin Portal.

1. Go to [Daytona SSO ↗](https://app.daytona.io/dashboard/sso)
2. Review the SSO connections

| **Column**        | **Description**                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Connection**    | Connection name set in the Admin Portal, and the connection type, such as **`OktaSAML`**, **`AzureSAML`**, or **`GenericOIDC`** |
| **Status**        | Connection state. See <u>[**connection states**](#connection-states)</u>                                                        |
| **Email Domains** | Email domains routed to this connection                                                                                         |
| **Last Updated**  | When the connection was last changed in the Admin Portal                                                                        |

If no connection is configured, the table shows **No SSO connection configured**. A connection appears in the table once you complete its setup in the Admin Portal.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers/workos-sso-connections' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

The response is an array of connections. The array is empty when no connection is configured. The API returns **`402`** when the organization's plan does not include SSO.

| **Field**            | **Description**                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **`id`**             | Connection ID                                                                                    |
| **`name`**           | Connection name set in the Admin Portal                                                          |
| **`connectionType`** | Connection type, such as **`OktaSAML`**, **`AzureSAML`**, or **`GenericOIDC`**                   |
| **`state`**          | Connection state. See <u>[**connection states**](#connection-states)</u>                         |
| **`domains`**        | Email domains routed to this connection                                                          |
| **`createdAt`**      | When the connection was created in the Admin Portal                                              |
| **`updatedAt`**      | When the connection was last changed in the Admin Portal                                         |

### Connection states

| **Status**           | **`state`**         | **Description**                                          |
| -------------------- | ------------------- | -------------------------------------------------------- |
| **Active**           | **`active`**        | The connection accepts sign-ins                          |
| **Draft**            | **`draft`**         | Setup in the Admin Portal was left unfinished            |
| **Setup incomplete** | **`requires_type`** | Setup in the Admin Portal was left unfinished            |
| **Inactive**         | **`inactive`**      | Setup was completed, and the connection was switched off |

## Sign in with SSO

Members sign in from the regular Daytona login page with an email address on one of the connection's email domains. Only an **Active** connection accepts sign-ins.

When a member signs in through an SSO connection for the first time, Daytona joins them to the organization (JIT provisioning):

- A new member joins with the **Member** role and no role assignments. This grants membership with no resource permissions, which still includes running processes in the organization's sandboxes and reading and writing files inside them. Grant additional access with [role assignments](./organizations.md#role-assignments)
- An existing member keeps their current role and role assignments
- When the organization's plan includes [SCIM directory sync](#configure-scim-directory-sync), the **Owner** or **Member** role assigned through the directory applies instead

## Configure SCIM directory sync

Connect your identity provider's directory over SCIM, so membership changes in the directory reach the organization. Setup uses the same Admin Portal link with the directory sync flow instead of the SSO flow.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/sso)
2. Click <Button>Configure Directory Sync (SCIM)</Button>
3. Select your directory provider in the Admin Portal and follow the setup steps
4. Complete the setup to return to the SSO page

Once a directory is connected, it owns organization membership. Deprovisioning a member in the directory, or deactivating their membership, removes the membership in Daytona. The **Owner** or **Member** role the directory assigns overrides the role set in Daytona, including demoting an owner.

The organization's last owner is exempt. A directory change that would remove the only remaining owner, or demote them to **Member**, is refused, so directory sync cannot leave an organization without an owner. That member keeps the role Daytona holds, and the directory and Daytona stay out of sync for them until an owner resolves the difference.

Name and email changes in the directory are mirrored to the member's Daytona account. An email change is applied only when the new address is on a domain verified for the organization in the Admin Portal. Outside those domains, the name is updated and the email address stays unchanged.

Directory sync follows its own entitlement. The button is shown only when the organization's plan includes directory sync, and it requires the same **`manage:sso`** permission as the SSO flow. The API returns **`402`** when the organization's plan does not include directory sync.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers/workos-admin-portal-link' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "intent": "dsync"
}'
```

### Directory sync status

View the connection status of the organization's SCIM directory. The SSO page shows the status for organizations whose plan includes directory sync. Status changes reach Daytona asynchronously, so a newly connected directory appears after a short delay.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/sso)
2. Review the directory sync status card

| **Status** | **Description** |
| ---------- | --------------- |
| **No directory connected** | No directory has been connected to the organization |
| **Directory sync active** | Users and groups are provisioned from your identity provider |
| **Directory sync inactive** | Changes from your identity provider are not applied. Check the directory connection in the Admin Portal |
| **Directory deleted** | Users and groups are no longer provisioned. Connect a directory again to resume |
| **SCIM token revoked** | The directory exists, but your identity provider can no longer push users and groups. Generate a new bearer token in the Admin Portal and update it in your identity provider |
| **Unknown directory status** | The directory reported a state the dashboard does not recognize. Check the directory in the Admin Portal |

The organization object exposes the status in **`directorySyncStatus`** (**`active`**, **`inactive`**, or **`deleted`**), along with **`directorySyncStatusChangedAt`** and **`directorySyncTokenRevokedAt`**. **`directorySyncStatus`** is omitted when no directory has connected, and **`directorySyncTokenRevokedAt`** is omitted while the directory has a valid token.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## Legacy OIDC identity providers

Legacy OIDC identity providers are OIDC applications registered directly in Daytona, with a dedicated organization SSO login URL.
> **Caution: Retiring**
> Legacy OIDC identity providers are being retired in favor of [SSO connections](#configure-sso). The dashboard no longer creates legacy identity providers. Existing providers are listed under **Legacy OIDC identity providers** on the SSO page and remain editable and deletable. The API still accepts new legacy identity providers.

### Create an identity provider

Create a legacy OIDC identity provider through the API. Register an OIDC application in your identity provider first, and add the Daytona callback URI to its allowed redirect URIs. The URI must match exactly: **`https://app.daytona.io/api/auth/sso/callback`**

Select an identity provider template:

- [Google Workspace](#google-workspace)
- [Microsoft Entra ID](#microsoft-entra-id)
- [Okta](#okta)
- [Auth0](#auth0)
- [Keycloak](#keycloak)
- [OneLogin](#onelogin)
- [Custom OIDC](#custom-oidc)

#### Configuration options

| **Option** | **Description** |
| ---------- | --------------- |
| **`name`** | Display name for the identity provider |
| **`oidcConfig.issuerUrl`** | OIDC issuer URL. Daytona fetches **`{issuerUrl}/.well-known/openid-configuration`** for discovery |
| **`oidcConfig.clientId`** | OAuth client ID from your identity provider |
| **`oidcConfig.clientSecret`** | OAuth client secret from your identity provider |
| **`oidcConfig.scope`** | OAuth scopes. Default: **`openid email profile`** |
| **`emailDomains`** | Domains allowed for this identity provider. Required unless **`allowAnyDomain`** is **`true`**. Each domain must be owned by a first-party verified organization member |
| **`allowAnyDomain`** | When **`true`**, accepts any email domain returned by the identity provider. Use only for trusted identity providers that strictly control who can authenticate. Default: **`false`** |
| **`trustEmailVerified`** | When **`true`**, skips the **`email_verified`** claim check (**Skip email verification check** in the dashboard). Required for providers such as **Microsoft Entra ID** that do not return **`email_verified`**. Default: **`false`** |
| **`defaultAssignedRoleIds`** | Organization role IDs assigned when a user joins via SSO (**Default role assignments** in the dashboard). Empty grants membership with no resource permissions, which still includes running processes in the organization's sandboxes and reading and writing files inside them. Default: **`[]`** |
| **`enabled`** | Whether the identity provider accepts sign-ins. Default: **`true`** |

A domain can be claimed by at most one identity provider across Daytona. Claiming a domain requires at least one organization member with a first-party verified email on that domain. Email addresses verified only through SSO do not satisfy domain ownership.

#### Google Workspace

Configure Google Workspace as a legacy OIDC identity provider.

**Prerequisite**: OAuth client in Google Cloud Console with the Authorization Code grant, and the callback URI added to its authorized redirect URIs.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "name": "Google Workspace",
  "oidcConfig": {
    "issuerUrl": "https://accounts.google.com",
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "scope": "openid email profile"
  },
  "emailDomains": ["company.com"],
  "allowAnyDomain": false,
  "trustEmailVerified": false,
  "defaultAssignedRoleIds": ["00000000-0000-0000-0000-000000000001"],
  "enabled": true
}'
```

#### Microsoft Entra ID

Configure Microsoft Entra ID as a legacy OIDC identity provider.

**Prerequisite**: Web application in Microsoft Entra ID with the Authorization Code grant, a client secret, and the callback URI added to its redirect URIs. Add **`email`** as an optional claim for the ID token and UserInfo response, and ensure each user has a populated mail attribute. Set **`trustEmailVerified`** to **`true`** because Entra ID does not normally return **`email_verified`**. Use the tenant-specific v2.0 issuer **`https://login.microsoftonline.com/{tenant-id}/v2.0`** instead of the multi-tenant **`common`** or **`organizations`** issuer.
> **Note:**
> Daytona reads the standard **`email`** claim only. There is no fallback to **`preferred_username`** or **`upn`**, so a tenant that does not return **`email`** fails with **`missing_email`**.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "name": "Microsoft Entra ID",
  "oidcConfig": {
    "issuerUrl": "https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0",
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "scope": "openid email profile"
  },
  "emailDomains": ["company.com"],
  "allowAnyDomain": false,
  "trustEmailVerified": true,
  "defaultAssignedRoleIds": ["00000000-0000-0000-0000-000000000001"],
  "enabled": true
}'
```

#### Okta

Configure Okta as a legacy OIDC identity provider.

**Prerequisite**: OpenID Connect web application in Okta with the Authorization Code grant, client secret authentication, and the callback URI added to its Sign-in redirect URIs. Map the user's email address to the standard OIDC **`email`** claim.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "name": "Okta",
  "oidcConfig": {
    "issuerUrl": "https://your-domain.okta.com",
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "scope": "openid email profile"
  },
  "emailDomains": ["company.com"],
  "allowAnyDomain": false,
  "trustEmailVerified": false,
  "defaultAssignedRoleIds": ["00000000-0000-0000-0000-000000000001"],
  "enabled": true
}'
```

#### Auth0

Configure Auth0 as a legacy OIDC identity provider.

**Prerequisite**: Regular Web Application in Auth0 with the Authorization Code grant, and the callback URI added to its Allowed Callback URLs.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "name": "Auth0",
  "oidcConfig": {
    "issuerUrl": "https://your-tenant.auth0.com",
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "scope": "openid email profile"
  },
  "emailDomains": ["company.com"],
  "allowAnyDomain": false,
  "trustEmailVerified": false,
  "defaultAssignedRoleIds": ["00000000-0000-0000-0000-000000000001"],
  "enabled": true
}'
```

#### Keycloak

Configure Keycloak as a legacy OIDC identity provider.

**Prerequisite**: OpenID Connect client in Keycloak with the Authorization Code flow, client authentication (client secret), and the callback URI added to its Valid redirect URIs.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "name": "Keycloak",
  "oidcConfig": {
    "issuerUrl": "https://keycloak.example.com/realms/your-realm",
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "scope": "openid email profile"
  },
  "emailDomains": ["company.com"],
  "allowAnyDomain": false,
  "trustEmailVerified": false,
  "defaultAssignedRoleIds": ["00000000-0000-0000-0000-000000000001"],
  "enabled": true
}'
```

#### OneLogin

Configure OneLogin as a legacy OIDC identity provider.

**Prerequisite**: OpenID Connect application in OneLogin with the Authorization Code grant, client secret authentication, and the callback URI added to its Redirect URIs.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "name": "OneLogin",
  "oidcConfig": {
    "issuerUrl": "https://your-domain.onelogin.com/oidc/2",
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "scope": "openid email profile"
  },
  "emailDomains": ["company.com"],
  "allowAnyDomain": false,
  "trustEmailVerified": false,
  "defaultAssignedRoleIds": ["00000000-0000-0000-0000-000000000001"],
  "enabled": true
}'
```

#### Custom OIDC

Configure any OIDC-compliant identity provider that is not covered by the templates above.

**Prerequisite**: OpenID Connect web application in your identity provider with the Authorization Code grant, client secret authentication, and the callback URI added to its allowed redirect URLs. Discovery must be available at **`{issuer-url}/.well-known/openid-configuration`**.

Missing **`email`** fails with **`missing_email`**. Missing or false **`email_verified`** (when **`trustEmailVerified`** is **`false`**) fails with **`email_not_verified`**.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "name": "Custom OIDC",
  "oidcConfig": {
    "issuerUrl": "https://your-idp.example.com",
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "scope": "openid email profile"
  },
  "emailDomains": ["company.com"],
  "allowAnyDomain": false,
  "trustEmailVerified": false,
  "defaultAssignedRoleIds": ["00000000-0000-0000-0000-000000000001"],
  "enabled": true
}'
```

### Sign in with a legacy identity provider

Share the organization SSO login URL with members. The URL is shown in the **SSO Login URL** column for each legacy identity provider: **`https://app.daytona.io/api/auth/sso/org/ORGANIZATION_ID`**

When a user signs in through a legacy identity provider for the first time:

- If no Daytona account exists for that email, Daytona creates the account and joins the user to the organization with the identity provider's **`defaultAssignedRoleIds`** (JIT provisioning)
- If a Daytona account already exists for that email, Daytona does not auto-link the SSO identity. The account owner must [confirm the link](#link-an-existing-account) from account settings

Subsequent sign-ins through a linked SSO identity also ensure organization membership.

### Link an existing account

When a sign-in through a legacy identity provider matches an existing Daytona account that is not yet linked to that identity provider, Daytona creates a pending link request and redirects the user to account settings. The account owner must sign in with an existing method and confirm the request.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/user/account-settings)
2. Under **Single sign-on link requests**, review the pending request
3. Click <Button>Link this SSO</Button> to allow future sign-ins through that identity provider, or <Button>Dismiss</Button> to reject it

Pending SSO link requests are separate from [linked accounts](./linked-accounts.md) (Google and GitHub).

### List identity providers

List legacy identity providers for an organization.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/sso)
2. Review the providers under **Legacy OIDC identity providers**

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

### Get identity provider

Get a legacy identity provider by ID.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers/IDENTITY_PROVIDER_ID' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

### Update an identity provider

Update a legacy identity provider's configuration.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/sso)
2. Open the actions menu on the provider row under **Legacy OIDC identity providers**
3. Click <Button>Edit</Button>
4. Update the configuration and click <Button>Save Changes</Button>

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers/IDENTITY_PROVIDER_ID' \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "name": "Company Okta",
  "emailDomains": ["company.com"],
  "trustEmailVerified": false,
  "enabled": true
}'
```

### Delete an identity provider

Delete a legacy identity provider. Existing Daytona accounts remain, but users can no longer sign in through that identity provider.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/sso)
2. Open the actions menu on the provider row under **Legacy OIDC identity providers**
3. Click <Button>Delete</Button>
4. Confirm the deletion

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/identity-providers/IDENTITY_PROVIDER_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
