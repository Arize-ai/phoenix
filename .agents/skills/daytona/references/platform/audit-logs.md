## Contents

- Access from Dashboard
- Real-time updates
- Log structure
- Get all audit logs
- Get audit logs for organization
- Get audit scenarios
- Outcomes
- See Also




Audit logs provide a detailed record of user and system activity across your organization. Use this feature to track sandbox lifecycle events, user access, system changes, and more.

- **Security audits**: monitor for unauthorized access or sandbox misuse
- **Debugging**: understand sandbox lifecycle issues (e.g. failed starts)
- **Compliance Export**: export logs for internal or external audits (coming soon)

Audit logs are available to [administrators](./organizations.md#roles) with full access and [members](./organizations.md#roles) with audit log permissions. Contact your organization administrator to get access to audit logs.

## Access from Dashboard

Access the audit logs page directly from [Daytona Dashboard ↗](https://app.daytona.io/dashboard/audit-logs). The audit logs page displays a list of all audit logs for your organization, including the following columns:

- **Time**: the timestamp of the action
- **User**: the user who performed the action
- **Action**: the action performed
- **Target**: the resource affected by the action
- [Outcomes](#outcomes): the result of the action

To filter audit logs by time, use the date range picker in the top-left corner of the page.

## Real-time updates

Refresh the audit log list automatically as new events occur.

1. Go to [Daytona Audit Logs ↗](https://app.daytona.io/dashboard/audit-logs)
2. Enable the **Auto Refresh** toggle in the top-right corner of the page

## Log structure

Each audit log entry contains the following fields:

| Field                | Type   | Description                                          |
| -------------------- | ------ | ---------------------------------------------------- |
| **`id`**             | string | Unique log entry identifier                          |
| **`actorId`**        | string | ID of the user who performed the action              |
| **`actorEmail`**     | string | Email of the user who performed the action           |
| **`organizationId`** | string | Organization ID                                      |
| **`action`**         | string | Operation executed (e.g., `create`, `start`, `stop`) |
| **`targetType`**     | string | Resource type affected (e.g., `sandbox`, `snapshot`) |
| **`targetId`**       | string | ID of the affected resource                          |
| **`statusCode`**     | number | HTTP status code of the result                       |
| **`errorMessage`**   | string | Error message if the action failed                   |
| **`ipAddress`**      | string | IP address of the request origin                     |
| **`userAgent`**      | string | User agent of the request origin                     |
| **`source`**         | string | Source of the action                                 |
| **`metadata`**       | object | Additional context about the action                  |
| **`createdAt`**      | string | ISO 8601 timestamp of when the action occurred       |

## Get all audit logs

Get all audit logs.

**API:**

```bash
curl 'https://app.daytona.io/api/audit' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## Get audit logs for organization

Get audit logs for a specific organization.

**API:**

```bash
curl 'https://app.daytona.io/api/audit/organizations/{organizationId}' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## Get audit scenarios

Get supported audit actions grouped by target type. This endpoint is public and does not require authentication.

Each audit log entry records an `action` and, when applicable, a `targetType`. Daytona exposes the supported pairs as scenarios: actions grouped by the resource type they apply to.

**API:**

```bash
curl 'https://app.daytona.io/api/audit/scenarios'
```

The response is in the following format:

```json
{
  "targets": [
    {
      "targetType": "api_key",
      "actions": ["create", "delete"]
    },
    {
      "targetType": "docker_registry",
      "actions": ["create", "delete", "set_default", "update"]
    },
    {
      "targetType": "identity_provider",
      "actions": ["create", "delete", "update"]
    },
    {
      "targetType": "organization",
      "actions": [
        "create",
        "create_region_quota",
        "delete",
        "delete_otel_config",
        "delete_region_quota",
        "initialize_webhooks",
        "send_webhook_message",
        "suspend",
        "unsuspend",
        "update",
        "update_otel_config",
        "update_preview_warning",
        "update_quota",
        "update_region_quota",
        "update_sandbox_default_limited_network_egress",
        "update_sso_enabled"
      ]
    },
    {
      "targetType": "organization_invitation",
      "actions": ["accept", "create", "decline", "delete", "update"]
    },
    {
      "targetType": "organization_role",
      "actions": ["create", "delete", "update"]
    },
    {
      "targetType": "organization_user",
      "actions": ["create", "delete", "update_access"]
    },
    {
      "targetType": "region",
      "actions": [
        "create",
        "delete",
        "regenerate_proxy_api_key",
        "regenerate_snapshot_manager_credentials",
        "regenerate_ssh_gateway_api_key",
        "update"
      ]
    },
    {
      "targetType": "runner",
      "actions": ["create", "delete", "update_draining", "update_scheduling"]
    },
    {
      "targetType": "sandbox",
      "actions": [
        "archive",
        "create",
        "create_ssh_access",
        "delete",
        "fork",
        "pause",
        "recover",
        "replace_labels",
        "resize",
        "revoke_ssh_access",
        "rotate_signing_key",
        "set_auto_archive_interval",
        "set_auto_delete_interval",
        "set_auto_pause_interval",
        "set_auto_stop_interval",
        "set_ttl",
        "snapshot",
        "start",
        "stop",
        "update",
        "update_network_settings",
        "update_public_status",
        "update_secrets"
      ]
    },
    {
      "targetType": "secret",
      "actions": ["create", "delete", "update"]
    },
    {
      "targetType": "snapshot",
      "actions": ["activate", "create", "deactivate", "delete", "set_general_status"]
    },
    {
      "targetType": "user",
      "actions": ["create", "link_account", "regenerate_key_pair", "unlink_account"]
    },
    {
      "targetType": "volume",
      "actions": ["create", "delete"]
    },
    {
      "targetType": "warm_pool",
      "actions": ["create", "delete", "update"]
    },
    {
      "targetType": "other",
      "actions": ["leave_organization", "link_account", "unlink_account"]
    }
  ]
}
```

## Outcomes

The outcome field indicates the result of the action. Statuses follow standard HTTP semantics:

| **Outcome** | **Description**               |
| ----------- | ----------------------------- |
| Info        | Informational (1xx codes)     |
| Success     | Action succeeded (2xx codes)  |
| Redirect    | Redirects (3xx codes)         |
| Error       | Client/server error (4xx/5xx) |

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
