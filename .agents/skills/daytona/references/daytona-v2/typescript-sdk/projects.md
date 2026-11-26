# Projects (TypeScript SDK)

Create and manage projects within your organization.

Projects are groups of sandboxes and the resources and credentials they use, inside an [organization](./organizations.md). Organizations contain projects, and projects contain everything else. A project is the unit of isolation: it keeps its sandboxes and credentials apart from those of other projects.

Daytona scopes every resource and credential to exactly one project, and shares nothing between projects implicitly. A secret or volume in one project is invisible to sandboxes in another, and a project's API key cannot see other projects' resources. Organizations are the unit of membership and billing. Every organization has a project named default, which exists as long as the organization and cannot be renamed or deleted.

Use projects to keep sandboxes and credentials that must not reach each other apart within one organization. Manage projects on the **Projects** page of the dashboard or with the CLI and the API, and switch projects in the header's organization and project switcher. The API routes that manage projects take your dashboard session token (an OIDC bearer JWT), not a project API key. The name `default` is reserved for that project, so no other project can take it.

| **Concept**      | **Description**                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Organization** | The unit of membership and billing. Members, invitations, and credits belong to the organization. Contains any number of projects.   |
| **Project**      | The unit of isolation. Holds sandboxes, images, snapshots, volumes, secrets, registry credentials, and API keys.                     |
| **API key**      | Minted per project. Confined to that project and to its permission scopes; revoking a key takes effect immediately for new requests. |

### Project access

Project access is the set of rules that decides which members of an organization can reach the resources of a project. Access control allows the callers that its rules name and refuses everyone else, so a resource stays closed to everyone by default.

The access of a member to a project comes from their organization role or from membership in the project: the role decides what the member may do, and membership decides where. Organization admins can access every project, and every member can access the default project. Any other project is visible only to members who have been added to it.

Grant a member access to a non-default project by adding them to its [members](#project-members). A member who is not on a project gets a `404` for it, as if the project did not exist.

## Contents

- [Create projects](#create-projects)
- [Operations](#operations)
- [Project budgets](#project-budgets)
- [Lifecycle defaults](#lifecycle-defaults)
- [Sandbox limits](#sandbox-limits)
- [Project members](#project-members)
- [Project service accounts](#project-service-accounts)
- [Project secrets and registries](#project-secrets-and-registries)
- [Permissions](#permissions)

## Create projects

Create a project to set up a separate group for sandboxes and the credentials they use. Creation adds a new resource under a name that no other resource of its kind in the same scope holds.

A create of a project adds an empty project to the organization, and whoever creates it is added to it automatically. The project keeps its ID for its whole life, while its name can change.

Create a project from the dashboard or programmatically for each group of sandboxes that must stay apart. Names are trimmed, unique per organization, and 1 to 64 characters. In the dashboard, the project switcher in the header also has a **Create Project** item.

1. Go to [Daytona Dashboard](https://app.daytona.com/dashboard/projects)
2. Click **Create Project**
3. Enter a **Name** for the project
4. Click **Create Project**

**CLI:**

```bash
daytona project create my-project --org ORG_ID
```

| **Flag** | **Description** |
| --- | --- |
| `<name>` | Sets the project name.<br />**Required**<br />**Format:** 1 to 64 characters after trimming, with no control characters, other than default<br />**Example:** `my-project` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORG_ID/projects' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "name": "my-project" }'
```

**Response:**

```json
{
  "id": "PROJECT_ID",
  "org_id": "ORG_ID",
  "name": "my-project",
  "default": false,
  "created_by": "USER_ID",
  "created_at": "2026-09-10T12:00:00Z",
  "updated_at": "2026-09-10T12:00:00Z"
}
```

| **Field** | **Description** |
| --- | --- |
| `name` | Sets the project name.<br />**Required**<br />**Format:** 1 to 64 characters after trimming, with no control characters, other than default<br />**Example:** `"my-project"` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

## Operations

Operations on projects act on projects that already exist in an organization. They read what the organization holds, rename projects, and remove the ones no longer needed.

Operations on a project never stop or delete the sandboxes, volumes, images, snapshots, or functions inside it. A delete is refused while the project still owns any of them.

Use the operations below to find a project and change it, or to delete the projects you no longer need. Each operation requires the matching project [permission](#permissions).

### List projects

List projects to find the projects of an organization that the caller can access. A list returns the resources of one kind that the caller may see, often split into pages.

A list of projects covers one organization and leaves out the projects that the caller cannot access. Each entry holds the same details that a get of the project returns.

List the projects you can access to find the ID of the project to select or manage. The list returns the newest projects first, one page at a time, with a cursor to the next page.

**CLI:**

```bash
daytona project list --org ORG_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORG_ID/projects' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

**Response:**

```json
{
  "projects": [
    {
      "id": "PROJECT_ID",
      "org_id": "ORG_ID",
      "name": "my-project",
      "default": false,
      "created_by": "USER_ID",
      "created_at": "2026-09-10T12:00:00Z",
      "updated_at": "2026-09-10T12:00:00Z"
    },
    {
      "id": "DEFAULT_PROJECT_ID",
      "org_id": "ORG_ID",
      "name": "default",
      "default": true,
      "created_by": null,
      "created_at": "2026-09-01T09:00:00Z",
      "updated_at": "2026-09-01T09:00:00Z"
    }
  ]
}
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Select project

Select a project to make it the target of the commands that follow. A selection is a default that a client keeps between commands, so each command does not have to name its target.

A selection of a project is stored on the local computer, once for each organization. Switching organizations restores the last project selected there.

Select the project that later CLI commands run against. Pass an ID or an unambiguous name; with no argument, the CLI shows a picker at a terminal.

**CLI:**

```bash
daytona project use PROJECT_ID
```

### Get by ID

Get a project to read its name and whether it is the default project. A get is a read of one resource by its unique identifier, which returns its current state and changes nothing.

A get of a project returns the same details as one entry of the list.

Get a project to check it before you rename or delete it. The CLI also accepts a project name, and with no argument it gets the selected project instead.

**CLI:**

```bash
daytona project get PROJECT_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Rename projects

Rename a project to give it a name that matches its current use. A rename changes the name of a resource and keeps its identifier, so references by ID keep working.

A rename of a project changes only its name: its ID, members, and resources stay as they were.

Rename a project from the dashboard or programmatically, unless it is the default project. The new name follows the rules of a create, and a rename to the current name changes nothing.

1. Go to [Daytona Dashboard](https://app.daytona.com/dashboard/projects)
2. Click the **⋮** menu of the project
3. Click **Rename**
4. Enter the new name and confirm

**CLI:**

```bash
daytona project update PROJECT_ID --name my-renamed-project --org ORG_ID
```

| **Flag** | **Description** |
| --- | --- |
| `--name` | Sets the new project name.<br />**Required**<br />**Format:** 1 to 64 characters after trimming, with no control characters, other than default<br />**Example:** `my-renamed-project` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID' \
  --request PATCH \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "name": "my-renamed-project" }'
```

| **Field** | **Description** |
| --- | --- |
| `name` | Sets the new project name.<br />**Required**<br />**Format:** 1 to 64 characters after trimming, with no control characters, other than default<br />**Example:** `"my-renamed-project"` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project.

### Delete projects

Delete a project to remove it from its organization once its work is done. Deletion removes a resource permanently, together with the data stored only in it.

A delete of a project revokes its API keys and removes its secrets, registry credentials, and memberships with it, in one step, so none of them outlives the project.

Delete a project from the dashboard or programmatically when nothing in it is needed anymore. You can delete any project except the default project.

1. Go to [Daytona Dashboard](https://app.daytona.com/dashboard/projects)
2. Click the **⋮** menu of the project
3. Click **Delete**
4. Confirm the deletion

**CLI:**

```bash
daytona project delete PROJECT_ID --org ORG_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project. The project must own no sandboxes, volumes, images, snapshots, or functions.
> - **Confirmation:** The command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project. The project must own no sandboxes, volumes, images, snapshots, or functions.

## Project budgets

Project budgets are spending limits on everything that a project runs. A spending limit stops new usage once spend reaches it, so costs stay within a planned amount.

The budget of a project caps its spend in each calendar month, in UTC, at list price and before credits. When the month-to-date spend reaches the budget, the project is held until the start of the next month, or until the budget is raised above the spend or removed.

Set a budget to cap a project's monthly spend. A held project refuses to create, fork, start, or resume a sandbox, or to restore one from a snapshot. After the organization's grace period, running sandboxes end by kind; when that period would end after the hold lifts, no sandbox is ended that month. Spend is evaluated periodically and can lag usage by several minutes.

| **Running sandbox** | **After the grace period**                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Persistent**      | It is stopped.                                                                                                                                     |
| **Ephemeral**       | It is deleted.                                                                                                                                     |
| **macOS**           | It keeps running on its prepaid Mac reservation until the paid period ends, because a renewal fails while the project is held.                     |

### Get a project budget

Get a project budget to compare this month's spend with the monthly budget. A get reads the current state of a resource and changes nothing on the server.

A get of a project budget returns the monthly budget and the spend evaluated so far this month, with the time of that evaluation. A project without a budget returns no limit and no spend.

Get the budget to check how close a project is to its limit. The SDKs, and the API with an API key, read the budget of the project that the API key belongs to. Through the API key route, a recent change to the budget can take up to 30 seconds to appear.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const budget = await daytona.v2.getProjectBudget()
if (budget.monthlyLimitCents === undefined) {
  console.log('The project has no budget')
} else {
  console.log(`Spent ${budget.spentCents} of ${budget.monthlyLimitCents} cents`)
}
```

### Set a project budget

Set a project budget to cap its monthly spend, or to replace the current one. A budget is an upper limit on spend over a set period, checked against the actual spend while it accrues.

A set of a project budget takes effect at once against the spend evaluated so far this month. A budget at or below that spend holds the project, and a higher one releases an existing hold.

Set or replace a budget from the dashboard or programmatically. The dashboard and the CLI take the amount in US dollars, and the API in US cents.

1. Go to [Daytona Dashboard](https://app.daytona.com/dashboard/projects)
2. Click the project
3. In the **Budget** section, click **Set budget**, or **Edit budget** to replace an existing one
4. Enter the **Monthly budget** in USD
5. Click **Save**

**CLI:**

```bash
# The argument is optional; omit it to use the selected project
daytona project budget set PROJECT_ID --monthly-usd 500
```

| **Flag** | **Description** |
| --- | --- |
| `--monthly-usd` | Sets the monthly budget in US dollars.<br />**Required**<br />**Minimum:** `1.00`<br />**Maximum:** `1000000000`<br />**Format:** a dollar amount with at most two decimals<br />**Example:** `500` |

> **Notes:**
>
> - **Prerequisites:** The request requires the Team or Enterprise [plan](../platform/billing.md#get-the-plan). The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/budget' \
  --request PUT \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{ "monthly_limit_cents": 50000 }'
```

| **Field** | **Description** |
| --- | --- |
| `monthly_limit_cents` | Sets the monthly budget in US cents.<br />**Required**<br />**Minimum:** `100`<br />**Maximum:** `100000000000`<br />**Example:** `50000` |

> **Notes:**
>
> - **Prerequisites:** The request requires the Team or Enterprise [plan](../platform/billing.md#get-the-plan). The request requires a signed-in user token, not an API key.

### Remove a project budget

Remove a project budget to stop capping the monthly spend of the project. A removal deletes the limit itself, so spend is no longer checked against it.

A removal of a project budget releases a budget hold on the project, so new sandboxes can start again, and sandboxes that were already stopped stay stopped.

Remove a budget from the dashboard or programmatically when the project no longer needs a monthly cap. Removal requires no plan, so an organization that has left the Team or Enterprise plan can still remove a budget that it had set earlier.

1. Go to [Daytona Dashboard](https://app.daytona.com/dashboard/projects)
2. Click the project
3. In the **Budget** section, click **Remove budget**
4. Confirm with **Remove**

**CLI:**

```bash
# The argument is optional; omit it to use the selected project
daytona project budget remove PROJECT_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.
> - **Confirmation:** The command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/budget' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

## Lifecycle defaults

Lifecycle defaults are the timeouts that a new sandbox receives when its create request leaves them out. They limit how long a sandbox runs or stays idle when its creator sets no limit.

The lifecycle defaults of a project apply to the ephemeral Linux sandboxes created in it, and these timeouts always delete the sandbox when they expire. They are read only when a sandbox is created: each timeout the create request sets overrides the matching default, and saving new defaults never changes existing sandboxes. A macOS sandbox does not take the lifecycle defaults of its project: it always gets the platform defaults instead.

Set lifecycle defaults so that sandboxes created without [timeouts](./linux-sandboxes.md#timeouts) still end on their own. Manage them from the project settings in the dashboard, or with the API.

### Get lifecycle defaults

Get lifecycle defaults to see the timeouts that new sandboxes in a project receive. A default is the value that a setting takes when nothing sets it explicitly, and any explicit value overrides it.

A get of the lifecycle defaults of a project returns the stored defaults and, for each sandbox type, the policy that a create request receives when it leaves the lifecycle settings out.

Get the defaults to check them before you change them, or to find out why a new sandbox got its timeout. For each sandbox type, the effective policy names where its timeout comes from and whether the organization's timeout cap lowered it.

1. Go to [Daytona Dashboard](https://app.daytona.com/dashboard/projects)
2. Click the project
3. Open the **Settings** tab and find the **Sandbox Lifecycle Policy** section

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/lifecycle-policy' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

The following response is abridged to the effective defaults of ephemeral Linux sandboxes and the platform defaults of macOS sandboxes. The full response also has the effective defaults of Windows and GPU sandboxes.

**Response:**

```json
{
  "policy": {
    "ephemeral": { "timeout_seconds": 1800, "idle_timeout_seconds": 600 }
  },
  "effective": {
    "linux": {
      "ephemeral": { "timeout_seconds": 1800, "on_timeout": "delete", "timeout_source": "project", "timeout_capped": false, "idle_timeout_seconds": 600, "on_idle_timeout": "delete" }
    },
    "macos": {
      "ephemeral": { "timeout_seconds": null, "on_timeout": null, "timeout_source": "none", "timeout_capped": false, "idle_timeout_seconds": null, "on_idle_timeout": null },
      "persistent": { "timeout_seconds": null, "on_timeout": null, "timeout_source": "none", "timeout_capped": false, "idle_timeout_seconds": null, "on_idle_timeout": null }
    }
  }
}
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Update lifecycle defaults

Update lifecycle defaults to change the timeouts that new sandboxes in a project receive. An update changes the stored settings of a resource without creating the resource again.

An update of the lifecycle defaults of a project works on whole blocks, such as the block for ephemeral sandboxes, not on single timeouts. Each block is validated on its own.

Update the defaults from the dashboard or the API when new sandboxes need different timeouts. Blocks are updated whole: an omitted block is kept, an empty value clears it, and a sent block replaces the stored one, so fields it omits are unset.

1. Go to [Daytona Dashboard](https://app.daytona.com/dashboard/projects)
2. Click the project
3. Open the **Settings** tab
4. In **Sandbox Lifecycle Policy**, click the edit button on the **Ephemeral sandboxes** card
5. Set the timeouts, then click **Save**

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/lifecycle-policy' \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{
    "ephemeral": { "timeout_seconds": 1800, "idle_timeout_seconds": 600 }
  }'
```

| **Field** | **Description** |
| --- | --- |
| `ephemeral` | Replaces the stored defaults for ephemeral sandboxes.<br />**Value:** `null` for no stored defaults<br />**Example:** `{"timeout_seconds": 1800, "idle_timeout_seconds": 600}` |
| `ephemeral.timeout_seconds` | Sets how many seconds a sandbox runs before it is deleted.<br />**Minimum:** `1`<br />**Maximum:** the organization's [timeout cap](./organizations.md#set-the-timeout-cap)<br />**Value:** `null` for the platform default<br />**Example:** `1800` |
| `ephemeral.idle_timeout_seconds` | Sets how many idle seconds pass before a sandbox is deleted.<br />**Minimum:** `60`<br />**Maximum:** `2147483647`<br />**Value:** `null` for no idle timeout<br />**Example:** `600` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

## Sandbox limits

Sandbox limits cap the number of sandboxes that a group of users can hold at one time. Each limit is a ceiling, not a reservation: reaching it refuses new sandboxes, but nothing is set aside.

The sandbox limits of a project count the sandboxes of that project alone, and apply together with the [organization limits](./limits.md#organization-limits): a sandbox is created only when it fits under both. A project without a limit of its own is bound only by the organization limit.

Set sandbox limits to keep one project from using the whole allowance of the organization. Manage them from the project settings in the dashboard, or with the API. A project limit above the organization limit is stored but never binds. A stored limit takes effect only while limit enforcement is on, and a request over it then fails with an error that names the limit.

### Get sandbox limits

Get sandbox limits to see how many sandboxes a project may hold and how many it holds now. A usage figure is the current count that a limit is checked against.

A get of the sandbox limits of a project returns the concurrent, total, and persistent counts, each with its limit and its usage. A limit of null means that the project has no limit of its own for that count.

Get the limits to check the remaining room before you create many sandboxes, or to find out why a create was refused. The concurrent and total counts are the same as in the [organization limits](./limits.md#organization-limits). The persistent count holds persistent sandboxes, stopped and paused ones included.

1. Go to [Daytona Dashboard](https://app.daytona.com/dashboard/projects)
2. Click the project
3. Open the **Settings** tab and find the **Sandbox Limits** section

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/limits' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

**Response:**

```json
{
  "sandboxes": {
    "concurrent": { "limit": 20, "usage": 4 },
    "total": { "limit": null, "usage": 9 },
    "persistent": { "limit": 5, "usage": 2 }
  }
}
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Update sandbox limits

Update sandbox limits to change how many sandboxes a project may hold. An update changes the stored settings of a resource without creating the resource again.

An update of the sandbox limits of a project changes only the limits that it sends. Lowering a limit never stops a sandbox: the sandboxes that the project already has keep running.

Update the limits from the dashboard or the API. Send an integer to set a limit, null to remove it, and leave a limit out to keep its stored value. A limit of 0 stops the project from creating any sandbox that the limit counts.

1. Go to [Daytona Dashboard](https://app.daytona.com/dashboard/projects)
2. Click the project
3. Open the **Settings** tab
4. In **Sandbox Limits**, click the edit button
5. Set the limits, then click **Save**

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/limits' \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{ "max_concurrent_vms": 20, "max_total_vms": null }'
```

| **Field** | **Description** |
| --- | --- |
| `max_concurrent_vms` | Sets the number of sandboxes that the project may run at one time.<br />**Minimum:** `0`<br />**Maximum:** `2147483647`<br />**Value:** `null` for no project limit<br />**Example:** `20` |
| `max_persistent_vms` | Sets the number of persistent sandboxes that the project may have.<br />**Minimum:** `0`<br />**Maximum:** `2147483647`<br />**Value:** `null` for no project limit<br />**Example:** `5` |
| `max_total_vms` | Sets the number of sandboxes that the project may have, stopped and paused ones included.<br />**Minimum:** `0`<br />**Maximum:** `2147483647`<br />**Value:** `null` for no project limit<br />**Example:** `50` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

## Project members

Project members are the organization members who have been added to a project. A membership list names the users who belong to a group, and access checks read it to decide which users may reach the resources of the group.

The members of a project are kept only for non-default projects, because the default project is open to every member of the organization. Organization admins are members of every project implicitly and do not need to be added to any project.

Manage project members with the CLI or the API to control who can access a project.

### List project members

List project members to see who can access a project. A list reads the entries of a collection one page at a time and changes nothing on the server.

A list of the members of a project holds the users who have been added to it and every organization admin. On the default project, it holds every organization member.

List the members of a project before you add or remove one. The implicit flag is true for organization admins, who have access without a membership entry, and for every member of the default project. The members added most recently come first.

**CLI:**

```bash
daytona project member list --project PROJECT_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/members' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

**Response:**

```json
{
  "members": [
    {
      "user_id": "USER_ID",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "implicit": false,
      "added_at": "2026-09-10T12:00:00Z"
    }
  ]
}
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Add project members

Add project members to give organization members access to a project. Membership in a group grants a user the access that the group holds, until the user is removed from it.

An addition of members to a project is all or nothing: if one user cannot be added, none is added. Adding a user who is already a member changes nothing.

Add one or more members in one request when they need the sandboxes and credentials of the project. The response lists only the users who were not members before.

**CLI:**

```bash
daytona project member add USER_ID --project PROJECT_ID --org ORG_ID

daytona project member add --bulk USER_ID_1,USER_ID_2 --project PROJECT_ID --org ORG_ID
```

| **Flag** | **Description** |
| --- | --- |
| `<user>` | Sets the member to add.<br />**Format:** a user ID, email, or name<br />**Example:** `jane@example.com` |
| `--bulk` | Adds several members in one request.<br />**Minimum:** 1 member<br />**Maximum:** 200 members<br />**Format:** a comma-separated list of user IDs, emails, or names<br />**Example:** `jane@example.com,john@example.com` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project. Each user must be a member of the organization.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/members' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "user_ids": ["USER_ID_1", "USER_ID_2"] }'
```

**Response:**

```json
{ "added_user_ids": ["USER_ID_1", "USER_ID_2"] }
```

| **Field** | **Description** |
| --- | --- |
| `user_ids` | Sets the users to add.<br />**Required**<br />**Minimum:** 1 user ID<br />**Maximum:** 200 user IDs |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project. Each user must be a member of the organization.

### Remove project members

Remove a project member to take away their access to the project's resources. Removal from a group ends the access that the group granted to that user.

A removal of a member from a project also revokes the API keys they minted in it, unless they are an organization admin; admins keep access through their role. The user stays a member of the organization and keeps the same organization roles.

Remove a member from a project when they no longer need it. Members can also remove themselves, even when they are the last member, because admins can still reach the project.

**CLI:**

```bash
daytona project member remove USER_ID --project PROJECT_ID --org ORG_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project.
> - **Confirmation:** The command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/members/USER_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project.

## Project service accounts

Project service accounts are the [service accounts](./api-keys.md#service-accounts) that can hold API keys in a project. A service account is an identity for software rather than a person, and programs sign in as it with keys.

A service account belongs to the organization and mints keys only in projects it has been added to. The default project is open to every service account, so it takes no additions or removals.

Add a service account to a project before a program needs its [keys](./api-keys.md#create-a-service-account-key) there, and remove it when the program no longer does. Manage project service accounts with the CLI or the API.

### List project service accounts

List project service accounts to see which service accounts can hold API keys in a project. A list reads a collection page by page and changes nothing.

A list of the service accounts of a non-default project holds every account that a member has added to it, with archived accounts included. On the default project, it holds every service account in the organization that has not been archived.

List the service accounts of a project to check which programs can work in it. The newest entries come first, one page at a time, with a cursor to the next page.

**CLI:**

```bash
daytona project service-account list --project PROJECT_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/service-accounts' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Add project service accounts

Add a service account to a project to let it hold API keys in that project. Adding an identity to a group lets the identity reach everything that the group holds.

An addition of a service account to a project extends every permission the account holds to that project. Adding an account that is already in the project changes nothing.

Add a service account before a program signs in as it to work in the project. Archived service accounts cannot be added, because they cannot acquire keys.

**CLI:**

```bash
daytona project service-account add SERVICE_ACCOUNT_ID --project PROJECT_ID --org ORG_ID
```

| **Flag** | **Description** |
| --- | --- |
| `<service-account>` | Sets the service account to add.<br />**Required**<br />**Format:** a service account ID or name |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project. The service account must not be archived.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/service-accounts' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "service_account_id": "SERVICE_ACCOUNT_ID" }'
```

| **Field** | **Description** |
| --- | --- |
| `service_account_id` | Sets the service account to add.<br />**Required**<br />**Format:** a service account ID |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project. The service account must not be archived.

### Remove project service accounts

Remove a service account from a project to end its access there. Removing an identity from a group cuts it off from everything that the group let it reach.

A removal of a service account from a project revokes every API key it holds there. The service account itself stays in the organization and keeps its access to other projects.

Remove a service account from a project when its programs no longer work there.

**CLI:**

```bash
daytona project service-account remove SERVICE_ACCOUNT_ID --project PROJECT_ID --org ORG_ID
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project.
> - **Confirmation:** The command asks for confirmation at a terminal and requires --yes otherwise.

**API:**

```bash
curl 'https://api.daytona.com/projects/PROJECT_ID/service-accounts/SERVICE_ACCOUNT_ID' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key. The project must not be the default project.

## Project secrets and registries

Project secrets and registries are the credentials that a project stores for its sandboxes: [secrets](./secrets.md) for the external services that sandbox code calls, and [registry credentials](./registries.md) for the private registries that sandbox images come from. A stored credential stays apart from the code and images that use it, so neither of them has to contain it.

Secrets and registry credentials belong to a project and are deleted together with it, and only a credential that acts in that same project can manage them.

Manage them with a project API key, or with the access token from [exchanging a token](./api-keys.md#exchange-a-token) for that project. The CLI uses the selected project's credential after you sign in.

## Permissions

Projects and their budgets, members, and service accounts are governed by organization permissions, which you can grant through an [organization role](./organizations.md#roles). A project API key or project access token reads the budget of its own project with the project spending permission.

Changing a lifecycle default whose action is delete also requires the permission to delete sandboxes. A project response names its creator only when the caller holds the permission to read members. Adding a service account to a project, or removing it, requires every permission that the service account holds. The [audit logs](./audit-logs.md) record project creates, updates, and deletes. They also record changes to project budgets, members, and service accounts.

| **Permission**               | **Grants**                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| **`read:projects`**          | List and get projects, their lifecycle defaults, and their sandbox limits           |
| **`write:projects`**         | Create and rename projects and change their lifecycle defaults and sandbox limits   |
| **`delete:projects`**        | Delete projects                                                                     |
| **`read:budgets`**           | Get project budgets                                                                 |
| **`write:budgets`**          | Set and remove project budgets                                                      |
| **`read:spending`**          | Get the budget of the project of the API key or access token                        |
| **`read:members`**           | List project members                                                                |
| **`write:members`**          | Add and remove project members                                                      |
| **`read:service_accounts`**  | List project service accounts                                                       |
| **`write:service_accounts`** | Add and remove project service accounts                                             |
