# Organizations (TypeScript SDK)

Manage your organizations and their resources.

Organizations are accounts that group the people who work together and the sandboxes and other resources they share. A user works alone in a personal organization, or shares sandboxes and API keys with a team in a collaborative organization.

Daytona places every project, with the sandboxes and API keys in it, in exactly one organization. Every organization has a default project that cannot be renamed or deleted. In a collaborative organization, the roles of each member decide what that member can do.

Use organizations to share sandboxes, API keys, billing, and limits with a team. Manage them from the dashboard, with the CLI, or through the [API](../api/README.md#daytona-api).

## Contents

- [Personal vs Collaborative](#personal-vs-collaborative)
- [Create organization](#create-organization)
- [Operations](#operations)
- [Roles](#roles)
- [Members](#members)
- [Invitations](#invitations)
- [Limits](#limits)
- [Entitlements and feature flags](#entitlements-and-feature-flags)
- [Preview warning](#preview-warning)
- [OpenTelemetry configuration](#opentelemetry-configuration)
- [Permissions](#permissions)

## Personal vs Collaborative

Personal and collaborative organizations are the two kinds of organization: one belongs to a single user, and the other is shared by a team. A single-user account needs no roles or invitations, while a team account uses both to control who joins and what each person can do.

The personal organization of a user is created at signup for solo use and experimentation, while users create collaborative organizations for teams, with shared access and controls. Each organization of either kind has its own sandboxes, API keys, and resource quotas.

Use the personal organization to work alone, and [create a collaborative organization](#create-organization) when others need access to the same sandboxes. Switch between organizations with the dropdown at the top-left corner of the sidebar in the dashboard.

| **Feature**        | **Personal organization**        | **Collaborative organization**                 |
| ------------------ | -------------------------------- | ---------------------------------------------- |
| **Creation**       | Automatic on signup              | Manually by a user                             |
| **Members**        | Single user only                 | Multiple users (invite-based)                  |
| **Access Control** | No roles or permissions          | Roles with fixed permission sets               |
| **Billing**        | Tied to individual user          | Shared across team members                     |
| **Use Case**       | Personal testing, small projects | Company/team development and production        |
| **Quota Scope**    | Per user                         | Shared across all members                      |
| **Deletable**      | No                               | Yes (by admins)                                |

## Create organization

Create an organization to set up an account that a team shares. An organization is an account that groups users and the resources they share, and controls what each member can access.

A new organization is collaborative, so other users can join it by invitation, and the user who creates it becomes its first member, with the admin role.

Create an organization when more than one person needs access to the same sandboxes and API keys. Create it from the dashboard, with the CLI, or through the [API](../api/README.md#daytona-api).

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/)
2. Expand the dropdown at the top-left corner of the sidebar to view your organizations
3. Click **Create Organization**
4. Enter the organization name
5. Select a [region](./regions.md)
6. Click **Create**

**CLI:**

```bash
daytona org create 'My Organization'
```

| **Flag** | **Description** |
| --- | --- |
| `<name>` | Sets the organization name.<br />**Required**<br />**Minimum:** 1 character<br />**Maximum:** 64 characters<br />**Format:** text without control characters<br />**Example:** `'My Organization'` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{
  "name": "My Organization"
}'
```

| **Field** | **Description** |
| --- | --- |
| `name` | Sets the organization name.<br />**Required**<br />**Minimum:** 1 character<br />**Maximum:** 64 characters<br />**Format:** text without control characters<br />**Example:** `"My Organization"` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.
> - **Effects:** Daytona trims leading and trailing whitespace from the name. You become the admin of the new organization.

## Operations

Operations on organizations act on organizations that already exist. They read and change an organization, or end the membership of the caller or the organization itself.

An existing organization is addressed by its ID, which no operation changes. None of the operations moves a project, a sandbox, or a member to another organization.

Use the operations below to find the organizations you belong to, rename one, and leave or delete an organization that you no longer work in.

### List organizations

List organizations to see every organization the authenticated user belongs to. A list operation returns the items in a collection that the calling user has permission to see.

A list of organizations covers only the organizations in which the caller is a member, each with the roles the caller holds there and the default project of the organization.

List organizations to find the ID of an organization before you select, rename, or leave it. The list is paginated, newest first, and each page holds the cursor of the next one.

**CLI:**

```bash
daytona org list
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Select organization

Select an organization to make it the default target of the requests that follow. A selection is a stored default that saves naming the target in every request.

A selection of an organization is stored in the active profile on the local computer and changes nothing in the organization. Selecting an organization also restores the project last used in it, or the default project of the organization when there is none.

Select an organization before you run CLI commands against it. Pass an ID or an unambiguous name, or no argument to choose from a picker at a terminal. To keep the organization selected and change only the project, [select a project](./projects.md#select-project) instead.

**CLI:**

```bash
daytona org use ORGANIZATION_ID
```

| **Flag** | **Description** |
| --- | --- |
| `[id\|name]` | Sets the organization to select.<br />**Format:** an organization ID or name |

### Get by ID

Get an organization by ID to read its name, kind, and settings. An ID is a unique value assigned to one resource when it is created, so a request by ID returns that resource and no other.

A get of an organization returns its stored record, which also shows whether the creation of new resources in it is suspended. The record has the fields of an organization in the list, without the roles of the caller and the default project of the organization.

Get an organization to check its settings, such as the timeout cap and the preview warning, before you change them. The CLI also accepts an organization name, and when it is given no argument, it gets the organization that is selected.

**CLI:**

```bash
daytona org get ORGANIZATION_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Current user

The current user is the account that a request is authenticated as, identified by the credential the request carries. A client reads it to confirm which account its next requests act for.

The current user is a user account and not a membership, so the same account answers the request whatever organization the caller has selected.

Get the current user to confirm which account a session runs as, or to find your user ID before you [leave an organization](#leave-organization). The CLI command also shows which credential is in use, and which organization and project are selected for the following commands.

**CLI:**

```bash
# The signed-in user, the credential in use, and the selected organization and project
daytona whoami
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
# The calling user: id, email, name
curl 'https://api.daytona.com/me' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Current organization API key

The current organization API key is the key that authenticates a request, described back to the program that presents it. A program reads it to learn what it may do without a second credential.

The current organization API key is reported with the organization permissions it holds at the time of the request. The response never contains the token.

Get the current organization API key to check its permissions and expiry before a program relies on them. To describe a project API key instead, see [get current API key](./api-keys.md#get-current-api-key).

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/api-keys/current' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

**Response:**

```json
{
  "id": "KEY_ID",
  "org_id": "ORGANIZATION_ID",
  "name": "my-org-key",
  "key_prefix": "dtno_...",
  "org_permissions": ["read:audit"],
  "created_at": "2026-09-10T12:00:00Z",
  "expires_at": null,
  "last_used_at": "2026-09-11T08:30:00Z",
  "revoked_at": null
}
```

> **Notes:**
>
> - **Prerequisites:** The request requires an organization API key.

### Rename organization

Rename an organization to change the name that its members see. A rename changes the display name of a resource and keeps its ID, so references by ID keep working.

A rename of an organization changes its name and nothing else: the members, projects, sandboxes, and API keys of the organization stay as they are.

Rename an organization when its name no longer matches the team that uses it. The new name follows the same rules as on create: it is trimmed, and must be 1 to 64 characters with no control characters. Sending the current name unchanged is accepted, even when it is longer.

**CLI:**

```bash
daytona org update ORGANIZATION_ID --name 'New Organization Name'
```

| **Flag** | **Description** |
| --- | --- |
| `--name` | Sets the new organization name.<br />**Required**<br />**Minimum:** 1 character<br />**Maximum:** 64 characters<br />**Format:** text without control characters<br />**Example:** `'New Organization Name'` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID' \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{
  "name": "New Organization Name"
}'
```

| **Field** | **Description** |
| --- | --- |
| `name` | Sets the new organization name.<br />**Minimum:** 1 character<br />**Maximum:** 64 characters<br />**Format:** text without control characters<br />**Example:** `"New Organization Name"` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Leave organization

Leave an organization to give up access to it. Leaving a group ends the caller's own membership and the access that came with it, while the group and its resources remain.

A departure from an organization also removes the roles and project memberships of the member in it. The sandboxes and other resources the member created stay in the organization.

Leave an organization when you no longer need access to it. If you are its only admin, [give the admin role](#update-access) to another member first, because the organization must keep at least one admin.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/)
2. Expand the dropdown at the top-left corner of the sidebar to view your organizations
3. Select the organization you want to leave
4. Click **Settings** in the sidebar
5. Click **Leave Organization**
6. Confirm by clicking **Leave**

**CLI:**

```bash
daytona org leave ORGANIZATION_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must keep at least one admin after you leave.
> - **Effects:** Leaving revokes the API keys that you created in the organization.
> - **Confirmation:** The command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
# Leaving is a self-removal: USER_ID is the id returned by GET /me
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/members/USER_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must keep at least one admin after you leave.
> - **Effects:** Leaving revokes the API keys that you created in the organization.

### Delete organization

Delete an organization to close an account that its team no longer uses. Deletion removes a resource permanently, with the data stored only in it.

A deletion of an organization also deletes its projects, memberships, custom roles, and invitations, and revokes every API key that the organization holds.

Delete an organization when its team no longer needs it, after you delete the sandboxes and the other resources that block the deletion, as the notes list.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/)
2. Expand the dropdown at the top-left corner of the sidebar to view your organizations
3. Select the organization you want to delete
4. Click **Settings** in the sidebar
5. Click **Delete Organization**
6. Confirm the deletion by typing the organization name and clicking **Delete**

**CLI:**

```bash
daytona org delete ORGANIZATION_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must not be a personal organization. The organization must have no sandboxes, volumes, images, snapshots, or functions left in it, and it must not hold a Mac reservation that is still live. The organization must not own a dedicated region.
> - **Confirmation:** The command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must not be a personal organization. The organization must have no sandboxes, volumes, images, snapshots, or functions left in it, and it must not hold a Mac reservation that is still live. The organization must not own a dedicated region.

## Roles

Roles are named sets of permissions that are granted to users as a unit. A user who holds several roles has the union of the permissions of all of them.

The roles of an organization member are one or more of the built-in roles below and the custom roles of the organization. The admin role is protected: the organization must always keep at least one admin, and only an admin can grant or remove it.

Assign roles to give each member only the access their work needs. An organization on the Enterprise plan can also define [custom roles](#create-custom-role) from its own choice of permissions. When an invitation names no roles, the invited member receives the developer role.

| **Role**                       | **Description**                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **`admin`**                    | Full control of the organization, its members, and everything in it                                  |
| **`maintainer`**               | Full control of everything inside the organization's projects, with no authority over the organization itself |
| **`developer`**                | Run and manage sandboxes, invoke functions, and view everything a sandbox can use                    |
| **`read-only`**                | View every project resource, and change none of them                                                 |
| **`member`**                   | Sign in and see the organization, with no access to any resource                                     |
| **`auditor`**                  | Read the organization's [audit log](./audit-logs.md), without the ability to turn it off         |
| **`billing`**                  | See what the organization spends and manage how it pays                                              |
| **`spending-viewer`**          | See what the organization spends, and nothing about how it pays                                      |
| **`budget-manager`**           | Set and remove monthly budgets on the projects the member can access                                 |
| **`sso-admin`**                | Configure [single sign-on](../platform/sso.md) for the organization                                        |
| **`infrastructure-admin`**     | Read-only access to the organization. A reserved role kept so existing assignments continue to work  |
| **`sandboxes-manager`**        | Create, change, and delete sandboxes                                                                 |
| **`snapshots-manager`**        | Create, change, and delete snapshots and images                                                      |
| **`volumes-manager`**          | Create, change, and delete volumes                                                                   |
| **`registries-manager`**       | Create, change, and delete private container registries                                              |
| **`secrets-manager`**          | Create, change, and delete project secrets                                                           |
| **`functions-manager`**        | Deploy, invoke, change, and delete serverless functions                                              |

### List roles

List roles to see which roles can be granted and what each one allows. A role list names each role together with the permissions it grants, so roles can be compared before one is granted.

A list of roles of an organization holds the built-in roles in catalog order, then the custom roles of the organization by name. The built-in roles are the same in every organization.

List roles before you invite a member or change the access of one, to pick roles that grant what the work needs. The CLI and the request without an organization return only the built-in roles.

**CLI:**

```bash
# The built-in roles and the permissions each role grants
daytona role list
```

**API:**

```bash
# The built-in roles, then the organization's custom roles
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/roles' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

# The built-in roles only
curl 'https://api.daytona.com/roles' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The list of organization roles requires a signed-in user token, not an API key. The list of built-in roles requires only a valid credential.

### Get role

Get a role to read the permissions that it grants. A permission is the right to perform one action on one kind of resource, such as reading sandboxes.

A get of a role identifies a built-in role by an identifier such as developer, which is the same in every organization, and a custom role by its UUID.

Get a role to check what it grants before you assign it to a member or change it.

**API:**

```bash
# ROLE_ID is the identifier of a built-in role, such as developer, or the UUID of a custom role
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/roles/ROLE_ID' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.
> - **Results:** The response has the fields of a role in [list roles](#list-roles).

### Create custom role

Create a custom role to grant a set of permissions that no built-in role matches. A custom role is a role that an organization defines from its own choice of permissions.

A custom role exists only in the organization that defines it, and is assigned like a built-in role, to members, service accounts, and invitations. Every role includes the organization read permission. A role that grants any project permission also includes the permissions to read projects and to create project API keys in the organization.

Create a custom role when the built-in roles grant too much or too little for a job. A custom role can grant only the permissions that you hold yourself.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/roles' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{
  "name": "Sandbox operator",
  "description": "Runs and manages sandboxes",
  "project_permissions": ["read:sandboxes", "write:sandboxes"],
  "organization_permissions": ["read:organization", "read:projects", "write:project_api_keys"]
}'
```

| **Field** | **Description** |
| --- | --- |
| `name` | Sets the role name.<br />**Required**<br />**Minimum:** 1 character<br />**Maximum:** 64 characters<br />**Rules:** unique in the organization, ignoring case, and not a built-in role name<br />**Example:** `"Sandbox operator"` |
| `project_permissions` | Sets the project permissions that the role grants.<br />**Required**<br />**Example:** `["read:sandboxes", "write:sandboxes"]` |
| `organization_permissions` | Sets the organization permissions that the role grants.<br />**Required**<br />**Example:** `["read:organization", "read:projects", "write:project_api_keys"]` |
| `description` | Sets the purpose of the role.<br />**Maximum:** 256 characters<br />**Example:** `"Runs and manages sandboxes"` |

> **Notes:**
>
> - **Prerequisites:** The request requires the Enterprise [plan](../platform/billing.md#get-the-plan). The request requires a signed-in user token, not an API key. The role can grant only permissions that you hold.
> - **Compatibility:** The organization permissions must include `read:organization`, and also `read:projects` and `write:project_api_keys` when the role grants any project permission.
> - **Limits:** The organization can define at most the max_custom_roles that [list roles](#list-roles) returns.
> - **Order:** Assign the role by its ID in the roles of an invitation, a member, or a service account.
> - **Effects:** Daytona trims the name and collapses each run of whitespace inside it to one space.

### Update custom role

Update a custom role to change its name, description, or permissions. An update replaces the fields it names and leaves the others as they are.

An update of a custom role reaches every member and service account that holds it, and a new permission list replaces the list of the role. Narrowing a role revokes the API keys of its holders that exceed the new permissions of those holders.

Update a custom role when a job needs more or fewer permissions than it grants. Preview the update first to see the changes without applying them. Built-in roles cannot be changed.

**API:**

```bash
# Report what the update would change, without applying it
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/roles/ROLE_ID/update-preview' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{
  "project_permissions": ["read:sandboxes"]
}'

# Apply the update
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/roles/ROLE_ID' \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{
  "project_permissions": ["read:sandboxes"]
}'
```

| **Field** | **Description** |
| --- | --- |
| `description` | Sets the new purpose of the role.<br />**Maximum:** 256 characters<br />**Example:** `"Reads sandboxes"` |
| `name` | Sets the new role name.<br />**Minimum:** 1 character<br />**Maximum:** 64 characters<br />**Example:** `"Sandbox reader"` |
| `organization_permissions` | Replaces the organization permissions that the role grants.<br />**Example:** `["read:organization", "read:projects", "write:project_api_keys"]` |
| `project_permissions` | Replaces the project permissions that the role grants.<br />**Example:** `["read:sandboxes"]` |

> **Notes:**
>
> - **Prerequisites:** The requests need the Enterprise [plan](../platform/billing.md#get-the-plan), unless an update or preview only removes permissions. The request requires a signed-in user token, not an API key. You must be able to assign roles to every member and service account that holds the role. The current and new permissions of the role must be within the permissions you hold.

### Delete custom role

Delete a custom role to remove a role that no one needs anymore. Deleting a role removes it from the set of roles that members can be granted.

A deletion of a custom role succeeds only while nothing holds it, so it never takes access away from a member, a service account, or a pending invitation.

Delete a custom role when no member needs it, after you remove it from every member, service account, and pending invitation that holds it. Built-in roles cannot be deleted, and the deletion of a custom role does not require the Enterprise plan.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/roles/ROLE_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. No member, service account, or pending invitation may hold the role.

### List permissions

List permissions to see every permission that roles and API keys can grant. A permission list names each permission once, so roles and keys refer to the same set of names.

The list of permissions is the same in every organization: project permissions apply to the resources inside a project, and organization permissions apply to the organization itself. Each permission has an identifier, a display name, and a display category.

List permissions when you build a custom role or an API key, to find the identifiers of the permissions that the role or the key is meant to grant.

**API:**

```bash
# Every permission; scope=project or scope=organization restricts the list to one scope
curl 'https://api.daytona.com/permissions?scope=project' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `scope` | Restricts the list to one permission scope.<br />**Default:** both scopes<br />**Value:** `project` or `organization`<br />**Example:** `project` |

## Members

Members are user accounts that belong to a group and hold access to its shared resources through the roles they are granted. A membership ties one account to one group, so the same account can be a member of several groups at once.

A member of an organization holds at least one role in it. Ending a membership revokes every API key that the member created in the organization.

Manage members to control who can reach the resources of the organization and what each person can do there. New members join by [invitation](#invitations).

### List members

List members to see who belongs to an organization. A membership list shows every user who belongs to a group, together with the roles that each of those users holds.

A list of members of an organization shows the email address, name, roles, and join time of each member, with the organization permissions those roles add up to.

List members to check who has access before you change roles or remove someone. The list is paginated, newest member first, and each page holds the cursor of the next one.

**CLI:**

```bash
daytona member list --org ORGANIZATION_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/members' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Invite members

Invite a user to an organization to give that user access to its resources. An invitation is an offer of membership sent to an email address, and the invited user joins only after accepting it.

An invitation to an organization grants nothing until it is accepted. A re-issued invitation replaces the roles of the earlier one instead of adding to them.

Invite a member when someone new joins the team. An invitation expires 14 days after it is sent, and inviting the same address again re-issues it with a new expiry.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/members)
2. Click **Invite Member**
3. Enter the email address of the user you want to invite
4. Select one or more [roles](#roles) for the new user under **Roles**

**CLI:**

```bash
daytona invite create mail@example.com --org ORGANIZATION_ID --role developer
```

| **Flag** | **Description** |
| --- | --- |
| `<email>` | Sets the email address to invite.<br />**Required**<br />**Example:** `mail@example.com` |
| `--role` | Sets the roles that the invitee receives.<br />**Default:** `developer`<br />**Format:** a comma-separated list of role IDs, repeatable<br />**Value:** [built-in role](./organizations.md#roles) IDs or custom role UUIDs<br />**Example:** `developer,billing` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must not be a personal organization. You must hold every permission that the roles grant, and only an admin can grant the `admin` role.
> - **Limits:** A pending invitation counts against the member limit.
> - **Results:** If the deployment sends no email, the command prints the invitation link to share with the invitee.

**API:**

```bash
# roles defaults to ["developer"] when omitted
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/invitations' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{
  "email": "mail@example.com",
  "roles": ["developer"]
}'
```

| **Field** | **Description** |
| --- | --- |
| `email` | Sets the email address to invite.<br />**Required**<br />**Example:** `"mail@example.com"` |
| `roles` | Sets the roles that the invitee receives.<br />**Default:** `["developer"]`<br />**Minimum:** 1 role<br />**Maximum:** every built-in and custom role of the organization |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must not be a personal organization. You must hold every permission that the roles grant, and only an admin can grant the `admin` role.
> - **Limits:** A pending invitation counts against the member limit.
> - **Effects:** Inviting an address again re-issues its invitation.
> - **Results:** If the deployment sends no email, give the invitee the link in the accept_url field of the response.

### Remove members

Remove a member from an organization to take away that member's access. Removal ends the membership of another user in a group and revokes the access that the membership granted.

A removal of a member also removes the roles and project memberships of that member in the organization. The sandboxes and other resources the member created stay in the organization.

Remove a member who no longer works with the team, and preview the removal first to see how many API keys it revokes. You can remove only a member whose permissions you all hold, and only an admin can remove a member who holds the admin role.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/members)
2. Click **Remove** next to the user you want to remove
3. Confirm the removal by clicking **Remove**

**CLI:**

```bash
# Preview what the member loses before removing them
daytona member remove USER_ID --org ORGANIZATION_ID --dry-run

daytona member remove USER_ID --org ORGANIZATION_ID
```

| **Flag** | **Description** |
| --- | --- |
| `--dry-run` | Shows the API key and preview grant counts that the removal revokes, without removing the member. |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must keep at least one admin.
> - **Confirmation:** The command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
# Preview what the member loses before removing them
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/members/USER_ID/removal-preview' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/members/USER_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The organization must keep at least one admin.

### Update access

Update the access of a member to change what that member is allowed to do in an organization. Access is the set of actions that a user may perform, and under role-based access control it changes only when the roles of that user change.

An update of the access of a member replaces the complete set of roles of that member, which must keep at least one role. Narrowing the roles revokes the API keys that the member created and is no longer allowed to hold under the new roles.

Update the access of a member when that member's work changes. Preview the change first to see how many API keys and preview grants it revokes.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/members)
2. Click the three-dot menu on the member row
3. Click **Edit roles**
4. Select the member's [roles](#roles) and click **Save**

**CLI:**

```bash
# Replace the member's role set
daytona member update USER_ID --org ORGANIZATION_ID --role maintainer,billing

# Rehearse the change without applying it
daytona member update USER_ID --org ORGANIZATION_ID --role read-only --dry-run
```

| **Flag** | **Description** |
| --- | --- |
| `--role` | Replaces the roles of the member.<br />**Required**<br />**Format:** a comma-separated list of role IDs, repeatable<br />**Value:** [built-in role](./organizations.md#roles) IDs or custom role UUIDs<br />**Example:** `maintainer,billing` |
| `--dry-run` | Shows the revocation counts without applying the change. |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. You can change only a member whose current and requested permissions you hold. Only an admin can grant or remove the `admin` role.
> - **Compatibility:** You cannot change your own roles.

**API:**

```bash
# Replace the member's role set
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/members/USER_ID' \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{
  "roles": ["maintainer", "billing"]
}'

# Rehearse the change without applying it: { "revoked_api_keys": ..., "revoked_preview_grants": ... }
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/members/USER_ID/update-preview' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{
  "roles": ["read-only"]
}'
```

| **Field** | **Description** |
| --- | --- |
| `roles` | Replaces the roles of the member.<br />**Required**<br />**Minimum:** 1 role<br />**Maximum:** every built-in and custom role of the organization<br />**Example:** `["maintainer", "billing"]` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. You can change only a member whose current and requested permissions you hold. Only an admin can grant or remove the `admin` role.
> - **Compatibility:** You cannot change your own roles.

## Invitations

Invitations are offers of membership that wait for an answer from the person invited. An invitation token is a long random string that identifies one invitation and is hard to guess.

An invitation to an organization is identified by the token in its link, and the organization stores only a hash of that token. Any signed-in user who holds the token can view the invitation.

View an organization invitation from the link or token in the invitation email, to check the organization, inviter, roles, and expiry before you [accept](#accept-invitation) or [decline](#decline-invitation) it.

1. Open the link in the invitation email; it opens [Daytona Dashboard ↗](https://app.daytona.com/dashboard/user/invitations)
2. Review the organization, inviter, roles, and expiry of the invitation

**CLI:**

```bash
# Show the invitation behind the dtni_ token or the link from the invitation email
daytona invite get INVITATION_TOKEN
```

| **Flag** | **Description** |
| --- | --- |
| `<token\|link>` | Sets the invitation to show.<br />**Required**<br />**Format:** the invitation token, which starts with dtni_, or the invitation link |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
# Show the invitation behind the dtni_ token from the invitation email
curl 'https://api.daytona.com/invitations/lookup' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{ "token": "INVITATION_TOKEN" }'
```

| **Field** | **Description** |
| --- | --- |
| `token` | Sets the invitation to show.<br />**Required**<br />**Format:** the invitation token, which starts with dtni_ |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The invitation must be pending.

### Accept invitation

Accept a pending organization invitation to join the organization that sent it. Accepting an invitation turns an offer of membership into actual membership in the group that sent the offer.

An acceptance of an invitation makes the signed-in user a member with the roles of the invitation, with access to the resource quotas of the organization. The signed-in account joins, whatever email address the invitation was sent to.

Accept an invitation once you have checked its roles. Acceptance fails while the organization is at its member limit. After you accept, you can create an [API key](./api-keys.md) and sandboxes in its projects.

1. Open the link in the invitation email; it opens [Daytona Dashboard ↗](https://app.daytona.com/dashboard/user/invitations)
2. Sign in if prompted
3. Review the organization, inviter, roles, and expiry of the invitation
4. Click **Accept**

**CLI:**

```bash
daytona invite accept INVITATION_TOKEN
```

| **Flag** | **Description** |
| --- | --- |
| `<token\|link>` | Sets the invitation to accept.<br />**Required**<br />**Format:** the invitation token, which starts with dtni_, or the invitation link |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.
> - **Effects:** An existing member keeps their current roles.
> - **Lifetime:** The token is single-use.

**API:**

```bash
curl 'https://api.daytona.com/invitations/accept' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{ "token": "INVITATION_TOKEN" }'
```

| **Field** | **Description** |
| --- | --- |
| `token` | Sets the invitation to accept.<br />**Required**<br />**Format:** the invitation token, which starts with dtni_ |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.
> - **Effects:** An existing member keeps their current roles.
> - **Lifetime:** The token is single-use.
### Decline invitation

Decline a pending invitation to refuse membership in the organization that sent it. Declining an invitation refuses the offer of membership, so the invited user does not join.

A declined invitation stays declined until the organization cancels or re-issues it, and it still appears in the list of invitations of the organization.

Decline an invitation that you do not want, instead of leaving it to expire.

1. Open the link in the invitation email; it opens [Daytona Dashboard ↗](https://app.daytona.com/dashboard/user/invitations)
2. Sign in if prompted
3. Review the organization, inviter, roles, and expiry of the invitation
4. Click **Decline**
5. Confirm by clicking **Decline**

**CLI:**

```bash
daytona invite decline INVITATION_TOKEN
```

| **Flag** | **Description** |
| --- | --- |
| `<token\|link>` | Sets the invitation to decline.<br />**Required**<br />**Format:** the invitation token, which starts with dtni_, or the invitation link |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/invitations/decline' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{ "token": "INVITATION_TOKEN" }'
```

| **Field** | **Description** |
| --- | --- |
| `token` | Sets the invitation to decline.<br />**Required**<br />**Format:** the invitation token, which starts with dtni_ |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### List pending

List pending invitations to see who has been invited to an organization and has not joined yet. A pending invitation is one that has been sent and still waits for its recipient to accept or decline.

A list of invitations of an organization shows the email address, roles, status, and expiry of each invitation, and never contains the invitation tokens.

List invitations to follow up with people who have not answered, or to find the ID of an invitation to cancel. The list is paginated, with the newest invitation first.

**CLI:**

```bash
daytona invite list --org ORGANIZATION_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/invitations' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.
> - **Results:** The list also contains declined and expired invitations.

### Cancel invitation

Cancel an invitation to withdraw an offer of membership that should no longer stand. Canceling an invitation withdraws the offer before its recipient answers, so it can no longer be accepted.

A cancellation of an invitation invalidates its link, so the invitee can no longer join through it. An invitation that was already accepted cannot be canceled.

Cancel an invitation sent to the wrong address or to someone who no longer needs access; a declined or expired invitation can be canceled too. To change only the roles of an invitation instead, [invite](#invite-members) the same address again with the new roles.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/members)
2. Scroll to the **Invitations** table
3. Click the three-dot menu on the invitation row
4. Click **Cancel**
5. Confirm by clicking **Confirm**

**CLI:**

```bash
daytona invite revoke INVITATION_ID --org ORGANIZATION_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.
> - **Confirmation:** The command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/invitations/INVITATION_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

## Limits

Limits are caps on how many resources an account can hold or run at the same time. A request that would take the usage of an account past a cap is refused.

The limits of an organization are shared by all its members, and each limit reports its effective cap and the usage counted against it. The member limit counts the pending invitations that reserve a seat as well as the members who have already joined.

Get the effective [organization limits](./limits.md#organization-limits) and the current usage they are checked against, to see how much capacity is left before a large run. A `null` limit means that no limit applies. A read with an API key leaves out the member limit and returns the limits of its own organization.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const limits = await daytona.v2.getLimits()
const concurrent = limits.sandboxes.concurrent
console.log(`Concurrent sandboxes: ${concurrent.usage} of ${concurrent.limit}`)
```

| **Parameter** | **Description** |
| --- | --- |
| `organizationId` | Sets the organization whose limits to get.<br />**Default:** the organization of the API key |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token or a project API key.
> - **Clients:** With jwtToken authentication, pass organizationId.

### Set the timeout cap

Set the timeout cap to bound how long the timeouts of sandboxes in an organization can be. A cap is an upper bound that every request is checked against, so a request for a longer timeout than the cap is refused instead of being shortened to fit.

The timeout cap of an organization applies to every sandbox timeout in all its projects. A plan with a lower maximum lowers the cap in effect without changing the stored value, and moving back to a plan with a higher maximum restores it.

Set a cap to keep every sandbox [timeout](./linux-sandboxes.md#timeouts) in the organization at or below a length you choose. The cap can be any value up to the plan maximum, or the platform maximum when the plan sets none, and clearing it restores that maximum. The [limits](#limits) report the cap in effect.

**API:**

```bash
# Cap every sandbox timeout in the organization at 1 hour
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID' \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{ "max_sandbox_timeout_seconds": 3600 }'

# Clear the cap and inherit the platform maximum
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID' \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{ "max_sandbox_timeout_seconds": null }'
```

| **Field** | **Description** |
| --- | --- |
| `max_sandbox_timeout_seconds` | Sets the longest timeout that a sandbox in the organization can have, in seconds.<br />**Minimum:** `1`<br />**Maximum:** the plan maximum, or the platform maximum of `86400` by default when the plan sets none<br />**Value:** `null` for the plan or platform maximum<br />**Example:** `3600` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token.

## Entitlements and feature flags

Entitlements are the capabilities that a plan grants to an account, and feature flags turn platform features on or off per account. A client reads both to decide which features to offer.

Entitlements follow the plan of the organization, and the platform evaluates feature flags for each organization. Members can read both and change neither.

Read the entitlements and feature flags to show or hide the features that depend on the plan of the organization or on a switch set by the platform.

### Entitlements

Entitlements are the plan features that an account may use, each named by a key. A client checks a key before it offers the feature that the key names.

The entitlements of an organization cover every entitlement key, each marked available or not, so a client never has to guess at the meaning of an absent key.

Get the entitlements to check whether the plan includes a feature, such as turning off the [preview warning](#preview-warning), before you offer that feature to users.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/entitlements' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

**Response:**

```json
{
  "entitlements": {
    "preview_warning_opt_out": false
  }
}
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Feature flags

Feature flags are switches that turn a feature on or off for some accounts without a new release. They let a platform roll a feature out in stages or limit it to chosen accounts.

The feature flags of an organization are evaluated by the platform for that organization alone, and a read of them returns only the flags that are on.

Get the feature flags to check whether a feature is turned on for the organization, and treat any flag that is missing from the response as turned off.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/feature-flags' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

## Preview warning

A preview warning is a page that a browser visitor sees, and has to click through, before a sandbox preview opens. It warns the visitor before content served from a sandbox loads.

The preview warning of an organization is on by default and applies to every sandbox preview in it, deciding whether a visitor sees the warning page first. When the plan no longer includes turning the warning off, the warning turns back on.

Turn the preview warning page off so that visitors open [sandbox previews](./preview.md) directly, or on to show the page again. The current setting is part of the organization that [get by ID](#get-by-id) returns.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/preview-warning' \
  --request PATCH \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "disabled": true }'
```

| **Field** | **Description** |
| --- | --- |
| `disabled` | Sets whether sandbox previews skip the warning page.<br />**Required** |

> **Notes:**
>
> - **Prerequisites:** Turning the preview warning off requires the Team or Enterprise [plan](../platform/billing.md#get-the-plan). The request requires a signed-in user token, not an API key. Turning the preview warning on is available on every plan.

## OpenTelemetry configuration

OpenTelemetry configuration is the setting that tells a platform where to send the logs, traces, and metrics it collects. A collector at that address receives the data, in the OpenTelemetry format, and forwards it to one or more observability backends.

The OpenTelemetry configuration of an organization covers the logs, traces, and metrics of every sandbox in it, and holds the OTLP/HTTP endpoint and the request headers to send. The values of the headers are write-only and never returned.

Forward sandbox telemetry to your OpenTelemetry collector to keep it with the rest of your observability data. For the requests and their fields, see [forward sandbox telemetry](./opentelemetry.md#forward-sandbox-telemetry).

## Permissions

Organization settings and membership are governed by organization permissions. You can grant each of these permissions through an [organization role](./organizations.md#roles).

Every role includes the organization read permission, and leaving an organization requires only that permission. A project API key gets the organization limits with the permission to read limits instead. The [audit logs](./audit-logs.md) record organization changes, invitations, and member changes.

| **Permission**            | **Grants**                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| **`read:organization`**   | Get the organization, its limits, entitlements, feature flags, and telemetry configuration       |
| **`write:organization`**  | Rename the organization and change its timeout cap, preview warning, and telemetry configuration |
| **`delete:organization`** | Delete the organization                                                                          |
| **`read:members`**        | List members and pending invitations                                                             |
| **`write:members`**       | Invite members, change their access, and cancel invitations                                      |
| **`delete:members`**      | Remove members                                                                                   |
| **`write:roles`**         | Create and update custom roles                                                                   |
| **`delete:roles`**        | Delete custom roles                                                                              |
| **`read:sso`**            | List [SSO](../platform/sso.md) connections                                                                |
| **`write:sso`**           | Create SSO and directory sync setup links                                                        |
