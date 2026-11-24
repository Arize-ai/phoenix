# Audit Logs (TypeScript SDK)

View and monitor all user actions across your Daytona organization.

Audit logs are records of the actions in an organization and its sandboxes: who acted, with which credential, on which resource, and with what result. They serve as evidence in security investigations and compliance reviews, and trace a change to the request that made it.

Daytona records audit logs for every organization. Each entry records an action, the actor and credential behind it, its target, and the result. Management-plane actions, such as changes to members and credentials, are always recorded, and the capture of workload-plane actions, such as sandbox activity, can be turned off. Entries are retained for 365 days.

Use audit logs to trace security incidents and review member access and role changes for compliance. Read them in the dashboard, or query them with the CLI and the API to filter entries in scripts. Querying them requires the Enterprise [plan](../platform/billing.md#get-the-plan), and entries are recorded on every plan.

## Contents

- [Use cases](#use-cases)
- [List audit logs](#list-audit-logs)
- [List audit actions](#list-audit-actions)
- [Log structure](#log-structure)
- [Turn audit logging off](#turn-audit-logging-off)
- [Permissions](#permissions)

## Use cases

Audit logs are used when you must know who did what, when, and with which credential.

- **Security audits.** Unauthorized access or sandbox misuse is traced to a user, an API key, an IP address, and a time. The key prefix identifies the key without exposing it. Entries may also include the user agent of the request.

- **Debugging.** Sandbox lifecycle problems, such as a failed start, are traced to the request that caused them. Each entry carries the HTTP status code and the error message. Entries for a failed action show the Error outcome, which covers 4xx and 5xx codes.

- **Compliance reviews.** Actions across the organization stay on record for 365 days. Management-plane actions, such as changes to members and credentials, are always recorded and cannot be turned off. Earlier entries stay readable until retention ends, even after workload-plane capture is turned off.

- **Access reviews.** Member role changes and removals, invitations, and the creation and role updates of service accounts are recorded with the previous and the new roles. A review shows who granted which access and when. Previewing a role change does not create an entry.

- **Scripted reviews.** The CLI and the API filter entries by action, target, actor, status code, and time range. A script pages through the results to collect the entries for a review. Each request accepts at most 10 filters and returns up to 200 entries per page.

## List audit logs

List audit logs to review the actions recorded in an organization. An audit log list holds one entry per recorded action, and each entry names the actor, the target, and the result.

The audit log of an organization holds the entries of each project, and of organization-level actions that belong to no project. An entry stays in the list until its retention period ends.

List audit logs from the dashboard to inspect single entries, or programmatically to collect them in a script. The list returns entries newest first, one page at a time, and each page holds the cursor of the next one. On plans other than Enterprise, the dashboard shows the audit log table as disabled and empty under an Enterprise notice.

**Dashboard columns:**

| **Column**                | **Description**                                |
| ------------------------- | ---------------------------------------------- |
| **Time**                  | The timestamp of the action.                   |
| **Actor**                 | The user or API key that performed the action. |
| **Action**                | The action performed.                          |
| **Target**                | The resource affected by the action.           |
| [**Outcomes**](#outcomes) | The result of the action.                      |

1. Go to [Daytona Audit Logs ↗](https://app.daytona.com/dashboard/audit-logs)
2. Select a row to open the full log entry, including its metadata

**CLI:**

```bash
daytona audit list --org {organizationId}
```

| **Flag** | **Description** |
| --- | --- |
| `--org` | Sets the organization to read.<br />**Default:** the selected organization<br />**Format:** an organization ID or name |

> **Notes:**
>
> - **Prerequisites:** The request requires the Enterprise [plan](../platform/billing.md#get-the-plan). The request requires a signed-in user token or an [organization API key](./api-keys.md#organization-api-keys).

**API:**

```bash
curl 'https://api.daytona.com/orgs/{organizationId}/audit-logs' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

**Response:**

```json
{
  "next_cursor": "MjAyNi0wOS0wOVQxMDoxMjozMy4xMjM0NTY3ODlafDAxOTliMmMx...",
  "audit_logs": [
    {
      "id": "{auditLogId}",
      "org_id": "{organizationId}",
      "project_id": "{projectId}",
      "actor_kind": "user",
      "actor_user_id": "{userId}",
      "actor_email": "user@example.com",
      "actor_key_id": null,
      "actor_key_prefix": null,
      "action": "create",
      "target_type": "sandbox",
      "target_id": "{sandboxId}",
      "status_code": 200,
      "error_message": null,
      "ip_address": "203.0.113.42",
      "user_agent": "daytona-sdk-python",
      "metadata": { "class": "linux", "region": "{regionId}" },
      "created_at": "2026-09-09T10:12:33.123456789Z"
    }
  ]
}
```

| **Field** | **Description** |
| --- | --- |
| `org_id` | Sets the organization to read.<br />**Format:** an organization ID |

> **Notes:**
>
> - **Prerequisites:** The request requires the Enterprise [plan](../platform/billing.md#get-the-plan). The request requires a signed-in user token or an [organization API key](./api-keys.md#organization-api-keys).

### Filter audit logs

Filter audit logs to narrow the list to the entries that a review needs. A filter keeps only the entries whose value for one field matches the value it sets.

Filters narrow the audit log of one organization to the entries that match every filter at once. A time range bounds the entries by the moment each action was recorded.

Filter audit logs by action, target, actor, status code, and time range to find the entries of one incident. Filters match exactly unless they name an operator. A request takes up to 10 filters.

1. Go to [Daytona Audit Logs ↗](https://app.daytona.com/dashboard/audit-logs)
2. Select a time range in the date range picker in the top-left corner of the page
3. Add filters on action, target type, target ID, actor, or status code from the filter menu

**CLI:**

```bash
daytona audit list --org {organizationId} --limit 100 --action create --target-type sandbox
```

| **Flag** | **Description** |
| --- | --- |
| `--action` | Filters by action.<br />**Value:** the [audit actions](#list-audit-actions)<br />**Example:** `create` |
| `--action-not-in` | Leaves out entries with any of the listed actions.<br />**Format:** a comma-separated list<br />**Value:** the [audit actions](#list-audit-actions)<br />**Example:** `stop,start` |
| `--actor` | Filters by actor.<br />**Format:** a user ID or API key ID |
| `--all` | Lists every page. |
| `--cursor` | Continues from a previous page. |
| `--end-at` | Filters out entries recorded at or after this time.<br />**Format:** an RFC 3339 timestamp<br />**Example:** `2026-09-02T00:00:00Z` |
| `--limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `--start-at` | Filters out entries recorded before this time.<br />**Format:** an RFC 3339 timestamp<br />**Example:** `2026-09-01T00:00:00Z` |
| `--status` | Filters by HTTP status code.<br />**Example:** `500` |
| `--target-id` | Filters by the ID of the affected resource. |
| `--target-type` | Filters by target type.<br />**Value:** the [target types](#list-audit-actions)<br />**Example:** `sandbox` |

> **Notes:**
>
> - **Prerequisites:** The request requires the Enterprise [plan](../platform/billing.md#get-the-plan). The request requires a signed-in user token or an [organization API key](./api-keys.md#organization-api-keys).

**API:**

```bash
curl 'https://api.daytona.com/orgs/{organizationId}/audit-logs?limit=100&action=create&target_type=sandbox' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `action` | Filters by action.<br />**Value:** the [audit actions](#list-audit-actions)<br />**Example:** `create` |
| `actor` | Filters by actor.<br />**Format:** a user ID or API key ID |
| `cursor` | Continues from a previous page. |
| `end_at` | Filters out entries recorded at or after this time.<br />**Format:** an RFC 3339 timestamp<br />**Example:** `2026-09-02T00:00:00Z` |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |
| `start_at` | Filters out entries recorded before this time.<br />**Format:** an RFC 3339 timestamp<br />**Example:** `2026-09-01T00:00:00Z` |
| `status` | Filters by HTTP status code.<br />**Example:** `500` |
| `target_id` | Filters by the ID of the affected resource. |
| `target_type` | Filters by target type.<br />**Value:** the [target types](#list-audit-actions)<br />**Example:** `sandbox` |

> **Notes:**
>
> - **Prerequisites:** The request requires the Enterprise [plan](../platform/billing.md#get-the-plan). The request requires a signed-in user token or an [organization API key](./api-keys.md#organization-api-keys).
> - **Compatibility:** A filter field[op]=value applies one operator: `eq`, `not`, `in`, `not_in`, `gt`, `gte`, `lt`, or `lte`. The range operators `gt`, `gte`, `lt`, and `lte` apply only to status.
> - **Limits:** `in` and `not_in` take up to 100 comma-separated values. Each request accepts at most 10 filters.

### Refresh audit logs

Refresh audit logs to keep the list current as new events occur in the organization. A refresh fetches the current page of entries again at once.

Auto-refresh in the dashboard repeats the refresh at an interval, so new entries appear in the audit log list without a manual refresh of the page.

Refresh the list once before you read it, or turn on auto-refresh to watch activity as it happens. Auto-refresh stays off until you choose an interval.

1. Go to [Daytona Audit Logs ↗](https://app.daytona.com/dashboard/audit-logs)
2. Click the refresh icon in the top-right corner of the page to fetch the current page
3. Select **10s**, **30s**, **1m**, **5m**, or **Auto**, which refreshes every 30 seconds, in the refresh control to refresh the list automatically

## List audit actions

List audit actions to see which actions the audit log records for each target type. An audit action is the operation an entry records, such as a delete, on a target type such as a sandbox.

The catalog of audit actions is the same for every organization. It holds one entry per target type the audit log records, with the actions possible for each, derived from the audited operations.

Use the list to build valid [filters](#filter-audit-logs) for audit log queries. Some pairs of a target type and an action record more than one operation, or an operation that their names do not show.

**Target types:**

| **Target type**               | **Resource**                 |
| ----------------------------- | ---------------------------- |
| **`api_key`**                 | API key                      |
| **`function`**                | Function                     |
| **`image`**                   | Image                        |
| **`mac_reservation`**         | Mac reservation              |
| **`org_api_key`**             | Organization API key         |
| **`org_role`**                | Organization role            |
| **`organization`**            | Organization                 |
| **`organization_invitation`** | Organization invitation      |
| **`organization_user`**       | Organization member          |
| **`otel_config`**             | OpenTelemetry configuration  |
| **`platform_token`**          | Platform token               |
| **`preview_endpoint`**        | Preview endpoint             |
| **`preview_session`**         | Preview session              |
| **`project`**                 | Project                      |
| **`project_budget`**          | Project budget               |
| **`project_member`**          | Project member               |
| **`project_service_account`** | Project service account      |
| **`region`**                  | Region                       |
| **`region_proxy_token`**      | Region proxy token           |
| **`registration_token`**      | Registration token           |
| **`registry`**                | Registry                     |
| **`runner`**                  | Host                         |
| **`sandbox`**                 | Sandbox                      |
| **`secret`**                  | Secret                       |
| **`service_account`**         | Service account              |
| **`snapshot`**                | Snapshot                     |
| **`volume`**                  | Volume                       |

**Action meanings:**

| **Target type**               | **Action** | **Records**                                                                                                                                                                                                                              |
| ----------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`organization`**            | `update`   | Changes to the organization itself, the [audit logging toggle](#turn-audit-logging-off), and billing changes: wallet top-ups, the automatic top-up rule, coupon redemption, plan changes, the balance notification rule, and the billing contact email. |
| **`organization_invitation`** | `update`   | The invitee accepting the invitation.                                                                                                                                                                                                    |
| **`organization_invitation`** | `delete`   | The organization revoking the invitation.                                                                                                                                                                                                |
| **`organization_invitation`** | `decline`  | The invitee refusing the invitation.                                                                                                                                                                                                     |
| **`sandbox`**                 | `create`   | The creation of the sandbox, and also every pre-signed file URL and every sandbox access token minted for the sandbox.                                                                                                                   |
| **`sandbox`**                 | `update`   | Label, network policy, secret, and lifecycle policy changes, and signing key rotation.                                                                                                                                                   |
| **`service_account`**         | `delete`   | The archiving of the account and its keys, after which the record survives.                                                                                                                                                              |

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const actions = await daytona.v2.listAuditActions()

for (const target of actions.targets) {
  console.log(target.targetType, target.actions)
}
```

## Log structure

An audit log entry is the record of one action in an organization. Its fields name who performed the action, with which credential, on which resource, and with what result.

An audit log entry has the same set of fields as every other entry, and a field that does not apply to an action is null, such as the project of an organization-level action.

Read the fields to trace an action to its actor, credential, and request origin. An action by a signed-in user carries the user ID, and an action by an API key carries the key ID and prefix.

| **Field**          | **Type**         | **Description**                                                                   |
| ------------------ | ---------------- | --------------------------------------------------------------------------------- |
| `id`               | string           | Unique log entry identifier                                                       |
| `org_id`           | string           | ID of the organization the action belongs to                                      |
| `project_id`       | string \| null   | ID of the project the action belongs to, or `null` for organization-level actions |
| `actor_kind`       | string           | Credential type of the actor: `user`, `api_key`, `org_key`, `vm`, or `system`     |
| `actor_user_id`    | string \| null   | ID of the user who performed the action, or `null` for a machine credential       |
| `actor_email`      | string \| null   | Email of the user who performed the action                                        |
| `actor_key_id`     | string \| null   | ID of the API key used, or `null` when the actor is a signed-in user              |
| `actor_key_prefix` | string \| null   | Prefix of the API key used, for identifying a key without exposing it             |
| `action`           | string           | Operation executed (e.g. `create`, `start`, `stop`)                               |
| `target_type`      | string           | Resource type affected (e.g. `sandbox`, `snapshot`)                               |
| `target_id`        | string \| null   | ID of the affected resource                                                       |
| `status_code`      | number           | HTTP status code of the result                                                    |
| `error_message`    | string \| null   | Error message if the action failed, or `null` for a successful action             |
| `ip_address`       | string \| null   | IP address of the request origin                                                  |
| `user_agent`       | string \| null   | User agent of the request origin                                                  |
| `metadata`         | object \| null   | Additional context about the action                                               |
| `created_at`       | string           | RFC 3339 timestamp of when the action occurred                                    |

### Metadata

Metadata is the extra context an audit log entry carries about its action. It holds the details of one action that the fixed fields of an entry cannot express.

The metadata of an entry holds context that was already resolved while the action was handled, and it never contains secret values. Its keys depend on the target type and the action.

Read the metadata to see the details of a change, such as the roles before and after it. Entries for target type and action pairs not listed in the table have empty or null metadata. The roles and previous roles keys each hold an array of role slugs.

| **Target type**               | **Action** | **Keys**                                                                                                                       |
| ----------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| **`sandbox`**                 | `create`  | `class`, `region`                                                                                                           |
| **`sandbox`**                 | `fork`    | `forked_from`: ID of the source sandbox                                                                                    |
| **`snapshot`**                | `create`  | `kind`: `disk` or `full`                                                                                                   |
| **`image`**                   | `create`  | `region`                                                                                                                   |
| **`api_key`**                 | `create`  | `service_account_id` when the key was minted for a service account. Otherwise no metadata                                  |
| **`project`**                 | `update`  | `previous_name`, `name`                                                                                                    |
| **`project`**                 | `delete`  | `revoked_keys`: number of API keys revoked with the project                                                                |
| **`project_member`**          | `create`  | `user_ids` on a bulk add, where `target_id` is the project ID. A single add has no metadata and `target_id` is the user ID |
| **`project_member`**          | `delete`  | `revoked_keys`: number of API keys revoked with the membership                                                             |
| **`project_service_account`** | `delete`  | `revoked_keys`: number of API keys revoked with the membership                                                             |
| **`organization`**            | `update`  | `audit_logs_disabled` (boolean) when the entry records the audit logging toggle. Other updates have no metadata            |
| **`organization`**            | `delete`  | `revoked_keys`: number of API keys revoked, `revoked_org_keys`: number of organization API keys revoked, `projects`: number of projects deleted with the organization |
| **`organization_user`**       | `update`  | `previous_roles`, `roles`                                                                                                  |
| **`organization_user`**       | `delete`  | `previous_roles`, `roles` (empty), `self_removal` (boolean), `revoked_keys`: number of API keys revoked with the membership |
| **`organization_invitation`** | `create`  | `email`, `previous_roles`, `roles`                                                                                         |
| **`organization_invitation`** | `delete`  | `email`, `previous_roles`, `roles` (empty)                                                                                 |
| **`organization_invitation`** | `decline` | `previous_roles`, `roles` (empty)                                                                                          |
| **`service_account`**         | `create`  | `previous_roles` (empty), `roles`                                                                                          |
| **`service_account`**         | `update`  | `previous_roles`, `roles`                                                                                                  |
| **`service_account`**         | `delete`  | `already_archived` (boolean), `revoked_keys`: number of API keys revoked with the account                                  |

### Outcomes

An outcome is the class of result that an action ended with, such as success or error. One class covers many specific results, which makes the results of different actions comparable.

The outcome of an audit log entry is the group that the dashboard puts its HTTP status code in. An entry with no recorded status code has the unknown outcome.

Use outcomes to spot failed actions in the dashboard without reading the status code of each entry. Entries for a failed action show the Error outcome.

| **Outcome**  | **Description**                          |
| ------------ | ---------------------------------------- |
| **Info**    | Informational (1xx codes)                |
| **Success** | Action succeeded (2xx codes)             |
| **Redirect** | Redirects (3xx codes)                    |
| **Error**   | Client/server error (4xx/5xx)            |
| **Unknown** | No status code was recorded on the entry |

## Turn audit logging off

Turn audit logging off to stop recording sandbox activity in the audit log of an organization. Audit logging is the capture of actions as audit log entries.

The audit logging setting belongs to the organization and covers its workload-plane actions, such as sandbox activity. Management-plane actions, such as changes to the organization, its members, and its credentials, are always recorded.

Turn capture off when the organization needs no record of sandbox activity. Audit logging is on by default, and every change to the setting is recorded as an update on the organization target. Turning capture off is not retroactive, so earlier entries stay readable until their 365-day retention ends. Both requests return the current state.

**API:**

```bash
# Read the current setting
curl 'https://api.daytona.com/orgs/{organizationId}/audit-logs/config' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'

# Turn workload-plane capture off
curl 'https://api.daytona.com/orgs/{organizationId}/audit-logs/config' \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --data '{ "disabled": true }'
```

**Response:**

```json
{
  "disabled": true
}
```

| **Field** | **Description** |
| --- | --- |
| `disabled` | Turns workload-plane capture off.<br />**Required** |
| `org_id` | Sets the organization.<br />**Format:** an organization ID |

> **Notes:**
>
> - **Prerequisites:** The requests require a signed-in user token, not an API key.

## Permissions

Audit logs are scoped to the organization. Access is governed by two organization permissions, which you can grant through an [organization role](./organizations.md#roles). Administrators hold both permissions. The **Auditor** role holds only the read permission, so it can read the log but not turn logging off. An [organization API key](./api-keys.md#organization-api-keys) can hold the read permission but never the write permission.

| **Permission**    | **Grants**                                         |
| ----------------- | -------------------------------------------------- |
| **`read:audit`**  | Query audit logs and get the audit logging setting |
| **`write:audit`** | Turn audit logging on or off                       |
