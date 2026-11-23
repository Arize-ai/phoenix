# SSO

Configure single sign-on and directory sync for your organization through the Admin Portal.

Organization SSO (Single Sign-On) lets a collaborative organization's members sign in through your identity provider. Directory sync (SCIM) keeps its members in sync with your directory.

You configure both in the Admin Portal, a hosted setup page that Daytona opens through a short-lived setup link. Each identity provider you connect there appears in Daytona as an SSO connection, with its status and the email domains it signs in. When the organization is shared with Daytona v0, its single sign-on and directory sync configuration is shared too.

Managing SSO requires the SSO permissions, which the **admin** and **sso-admin** [roles](../python-sdk/organizations.md#roles) hold.

| **Field**           | **Description**                                         |
| ------------------- | ------------------------------------------------------- |
| **Name**            | The connection name.                                    |
| **Connection type** | The connection protocol and provider type.              |
| **Status**          | The connection status.                                  |
| **Email domains**   | The email domains the connection signs in.              |
| **Updated at**      | When the connection was last updated.                   |

> **Plan required:**
>
> SSO is available on the Enterprise plan for collaborative organizations. A personal organization cannot use SSO.

## Configure SSO and directory sync

Daytona provides methods to open the Admin Portal for single sign-on or for directory sync. The setup link expires five minutes after it is created, so open it right away. When you finish in the Admin Portal, it returns you to the SSO page of the dashboard.

1. Go to [Daytona SSO ↗](https://app.daytona.com/dashboard/sso)
2. Click **Configure SSO** for an identity provider or **Configure Directory Sync (SCIM)** for a directory
3. Complete the setup in the Admin Portal

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/sso/setup-links' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{ "intent": "sso" }'
```

| **Field** | **Description** |
| --- | --- |
| `intent` | Sets the setup area that the Admin Portal opens.<br />**Required**<br />**Value:** `sso` for single sign-on or `dsync` for directory sync<br />**Example:** `"sso"` |

> **Notes:**
>
> - **Prerequisites:** The request requires the Enterprise [plan](./billing.md#get-the-plan). The request requires a signed-in user token, not an API key. The organization must be a collaborative organization.
> - **Lifetime:** The setup link expires five minutes after it is created.

## List SSO connections

List the SSO connections configured for the organization in the Admin Portal. An organization that has not completed the setup has no connections.

1. Go to [Daytona SSO ↗](https://app.daytona.com/dashboard/sso)
2. The connections table shows each connection with its status, email domains, and last update

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/sso/connections?limit=100' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The request requires the Enterprise [plan](./billing.md#get-the-plan). The request requires a signed-in user token, not an API key.

## Permissions

SSO requests require a signed-in user token and do not accept [API keys](../python-sdk/api-keys.md). SSO configuration is governed by two organization permissions, which you can grant through an [organization role](../python-sdk/organizations.md#roles):

| **Permission**  | **Grants**                                |
| --------------- | ----------------------------------------- |
| **`read:sso`**  | List SSO connections                      |
| **`write:sso`** | Create SSO and directory sync setup links |
