# Daytona API Reference


## Contents

- Base URL
- Authentication
- Daytona API
- Toolbox API

## Base URL

```
https://app.daytona.io/api
```

## Authentication

All API requests require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <your-api-key>
```

See [Authentication](../../SKILL.md#authentication) for how to obtain an API key.

---

## Daytona API

| Method | Path | Summary | Tag |
|--------|------|---------|-----|
| `GET` | `/health` | [](./Health.md#daytona/tag/Health/GET/health) | [Health](./Health.md) |
| `GET` | `/health/ready` | [](./Health.md#daytona/tag/Health/GET/health/ready) | [Health](./Health.md) |
| `GET` | `/api-keys` | [List API keys](./api-keys.md#daytona/tag/api-keys/GET/api-keys) | [api-keys](./api-keys.md) |
| `POST` | `/api-keys` | [Create API key](./api-keys.md#daytona/tag/api-keys/POST/api-keys) | [api-keys](./api-keys.md) |
| `GET` | `/api-keys/current` | [Get current API key's details](./api-keys.md#daytona/tag/api-keys/GET/api-keys/current) | [api-keys](./api-keys.md) |
| `GET` | `/api-keys/{name}` | [Get API key](./api-keys.md#daytona/tag/api-keys/GET/api-keys/{name}) | [api-keys](./api-keys.md) |
| `DELETE` | `/api-keys/{name}` | [Delete API key](./api-keys.md#daytona/tag/api-keys/DELETE/api-keys/{name}) | [api-keys](./api-keys.md) |
| `DELETE` | `/api-keys/{userId}/{name}` | [Delete API key for user](./api-keys.md#daytona/tag/api-keys/DELETE/api-keys/{userId}/{name}) | [api-keys](./api-keys.md) |
| `GET` | `/audit/organizations/{organizationId}` | [Get audit logs for organization](./audit.md#daytona/tag/audit/GET/audit/organizations/{organizationId}) | [audit](./audit.md) |
| `GET` | `/audit/scenarios` | [Get supported audit log scenarios](./audit.md#daytona/tag/audit/GET/audit/scenarios) | [audit](./audit.md) |
| `GET` | `/config` | [Get config](./config.md#daytona/tag/config/GET/config) | [config](./config.md) |
| `GET` | `/docker-registry` | [List registries](./docker-registry.md#daytona/tag/docker-registry/GET/docker-registry) | [docker-registry](./docker-registry.md) |
| `POST` | `/docker-registry` | [Create registry](./docker-registry.md#daytona/tag/docker-registry/POST/docker-registry) | [docker-registry](./docker-registry.md) |
| `GET` | `/docker-registry/registry-push-access` | [Get temporary registry access for pushing snapshots](./docker-registry.md#daytona/tag/docker-registry/GET/docker-registry/registry-push-access) | [docker-registry](./docker-registry.md) |
| `GET` | `/docker-registry/{id}` | [Get registry](./docker-registry.md#daytona/tag/docker-registry/GET/docker-registry/{id}) | [docker-registry](./docker-registry.md) |
| `PATCH` | `/docker-registry/{id}` | [Update registry](./docker-registry.md#daytona/tag/docker-registry/PATCH/docker-registry/{id}) | [docker-registry](./docker-registry.md) |
| `DELETE` | `/docker-registry/{id}` | [Delete registry](./docker-registry.md#daytona/tag/docker-registry/DELETE/docker-registry/{id}) | [docker-registry](./docker-registry.md) |
| `GET` | `/jobs` | [List jobs for the runner](./jobs.md#daytona/tag/jobs/GET/jobs) | [jobs](./jobs.md) |
| `GET` | `/jobs/poll` | [Long poll for jobs](./jobs.md#daytona/tag/jobs/GET/jobs/poll) | [jobs](./jobs.md) |
| `GET` | `/jobs/{jobId}` | [Get job details](./jobs.md#daytona/tag/jobs/GET/jobs/{jobId}) | [jobs](./jobs.md) |
| `POST` | `/jobs/{jobId}/status` | [Update job status](./jobs.md#daytona/tag/jobs/POST/jobs/{jobId}/status) | [jobs](./jobs.md) |
| `GET` | `/object-storage/push-access` | [Get temporary storage access for pushing objects](./object-storage.md#daytona/tag/object-storage/GET/object-storage/push-access) | [object-storage](./object-storage.md) |
| `GET` | `/organizations/invitations` | [List organization invitations for authenticated user](./organizations.md#daytona/tag/organizations/GET/organizations/invitations) | [organizations](./organizations.md) |
| `GET` | `/organizations/invitations/count` | [Get count of organization invitations for authenticated user](./organizations.md#daytona/tag/organizations/GET/organizations/invitations/count) | [organizations](./organizations.md) |
| `POST` | `/organizations/invitations/{invitationId}/accept` | [Accept organization invitation](./organizations.md#daytona/tag/organizations/POST/organizations/invitations/{invitationId}/accept) | [organizations](./organizations.md) |
| `POST` | `/organizations/invitations/{invitationId}/decline` | [Decline organization invitation](./organizations.md#daytona/tag/organizations/POST/organizations/invitations/{invitationId}/decline) | [organizations](./organizations.md) |
| `GET` | `/organizations` | [List organizations](./organizations.md#daytona/tag/organizations/GET/organizations) | [organizations](./organizations.md) |
| `POST` | `/organizations` | [Create organization](./organizations.md#daytona/tag/organizations/POST/organizations) | [organizations](./organizations.md) |
| `PATCH` | `/organizations/{organizationId}/default-region` | [Set default region for organization](./organizations.md#daytona/tag/organizations/PATCH/organizations/{organizationId}/default-region) | [organizations](./organizations.md) |
| `GET` | `/organizations/{organizationId}` | [Get organization by ID](./organizations.md#daytona/tag/organizations/GET/organizations/{organizationId}) | [organizations](./organizations.md) |
| `DELETE` | `/organizations/{organizationId}` | [Delete organization](./organizations.md#daytona/tag/organizations/DELETE/organizations/{organizationId}) | [organizations](./organizations.md) |
| `GET` | `/organizations/{organizationId}/usage` | [Get organization current usage overview](./organizations.md#daytona/tag/organizations/GET/organizations/{organizationId}/usage) | [organizations](./organizations.md) |
| `GET` | `/organizations/{organizationId}/available-sandbox-classes` | [List available sandbox classes for organization](./organizations.md#daytona/tag/organizations/GET/organizations/{organizationId}/available-sandbox-classes) | [organizations](./organizations.md) |
| `PATCH` | `/organizations/{organizationId}/quota` | [Update organization quota](./organizations.md#daytona/tag/organizations/PATCH/organizations/{organizationId}/quota) | [organizations](./organizations.md) |
| `PATCH` | `/organizations/{organizationId}/quota/{regionId}` | [Update organization region quota](./organizations.md#daytona/tag/organizations/PATCH/organizations/{organizationId}/quota/{regionId}) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/leave` | [Leave organization](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/leave) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/suspend` | [Suspend organization](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/suspend) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/unsuspend` | [Unsuspend organization](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/unsuspend) | [organizations](./organizations.md) |
| `GET` | `/organizations/otel-config/by-sandbox-auth-token/{authToken}` | [Get organization OTEL config by sandbox auth token](./organizations.md#daytona/tag/organizations/GET/organizations/otel-config/by-sandbox-auth-token/{authToken}) | [organizations](./organizations.md) |
| `GET` | `/organizations/{organizationId}/otel-config` | [Get organization OTEL config by organization ID](./organizations.md#daytona/tag/organizations/GET/organizations/{organizationId}/otel-config) | [organizations](./organizations.md) |
| `PUT` | `/organizations/{organizationId}/otel-config` | [Update organization OpenTelemetry configuration](./organizations.md#daytona/tag/organizations/PUT/organizations/{organizationId}/otel-config) | [organizations](./organizations.md) |
| `DELETE` | `/organizations/{organizationId}/otel-config` | [Delete organization OpenTelemetry configuration](./organizations.md#daytona/tag/organizations/DELETE/organizations/{organizationId}/otel-config) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/sandbox-default-limited-network-egress` | [Update sandbox default limited network egress](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/sandbox-default-limited-network-egress) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/preview-warning` | [Update organization preview warning](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/preview-warning) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/sso-enabled` | [Update organization SSO entitlement](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/sso-enabled) | [organizations](./organizations.md) |
| `PUT` | `/organizations/{organizationId}/experimental-config` | [Update experimental configuration](./organizations.md#daytona/tag/organizations/PUT/organizations/{organizationId}/experimental-config) | [organizations](./organizations.md) |
| `GET` | `/organizations/{organizationId}/roles` | [List organization roles](./organizations.md#daytona/tag/organizations/GET/organizations/{organizationId}/roles) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/roles` | [Create organization role](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/roles) | [organizations](./organizations.md) |
| `PUT` | `/organizations/{organizationId}/roles/{roleId}` | [Update organization role](./organizations.md#daytona/tag/organizations/PUT/organizations/{organizationId}/roles/{roleId}) | [organizations](./organizations.md) |
| `DELETE` | `/organizations/{organizationId}/roles/{roleId}` | [Delete organization role](./organizations.md#daytona/tag/organizations/DELETE/organizations/{organizationId}/roles/{roleId}) | [organizations](./organizations.md) |
| `GET` | `/organizations/{organizationId}/users` | [List organization members](./organizations.md#daytona/tag/organizations/GET/organizations/{organizationId}/users) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/users/{userId}/access` | [Update access for organization member](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/users/{userId}/access) | [organizations](./organizations.md) |
| `DELETE` | `/organizations/{organizationId}/users/{userId}` | [Delete organization member](./organizations.md#daytona/tag/organizations/DELETE/organizations/{organizationId}/users/{userId}) | [organizations](./organizations.md) |
| `GET` | `/organizations/{organizationId}/invitations` | [List pending organization invitations](./organizations.md#daytona/tag/organizations/GET/organizations/{organizationId}/invitations) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/invitations` | [Create organization invitation](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/invitations) | [organizations](./organizations.md) |
| `PUT` | `/organizations/{organizationId}/invitations/{invitationId}` | [Update organization invitation](./organizations.md#daytona/tag/organizations/PUT/organizations/{organizationId}/invitations/{invitationId}) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/invitations/{invitationId}/cancel` | [Cancel organization invitation](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/invitations/{invitationId}/cancel) | [organizations](./organizations.md) |
| `GET` | `/regions` | [List all available regions for the organization](./organizations.md#daytona/tag/organizations/GET/regions) | [organizations](./organizations.md) |
| `POST` | `/regions` | [Create a new region](./organizations.md#daytona/tag/organizations/POST/regions) | [organizations](./organizations.md) |
| `GET` | `/regions/{id}` | [Get region by ID](./organizations.md#daytona/tag/organizations/GET/regions/{id}) | [organizations](./organizations.md) |
| `PATCH` | `/regions/{id}` | [Update region configuration](./organizations.md#daytona/tag/organizations/PATCH/regions/{id}) | [organizations](./organizations.md) |
| `DELETE` | `/regions/{id}` | [Delete a region](./organizations.md#daytona/tag/organizations/DELETE/regions/{id}) | [organizations](./organizations.md) |
| `POST` | `/regions/{id}/regenerate-proxy-api-key` | [Regenerate proxy API key for a region](./organizations.md#daytona/tag/organizations/POST/regions/{id}/regenerate-proxy-api-key) | [organizations](./organizations.md) |
| `POST` | `/regions/{id}/regenerate-ssh-gateway-api-key` | [Regenerate SSH gateway API key for a region](./organizations.md#daytona/tag/organizations/POST/regions/{id}/regenerate-ssh-gateway-api-key) | [organizations](./organizations.md) |
| `POST` | `/regions/{id}/regenerate-snapshot-manager-credentials` | [Regenerate snapshot manager credentials for a region](./organizations.md#daytona/tag/organizations/POST/regions/{id}/regenerate-snapshot-manager-credentials) | [organizations](./organizations.md) |
| `GET` | `/organizations/{organizationId}/identity-providers` | [List organization identity providers](./organizations.md#daytona/tag/organizations/GET/organizations/{organizationId}/identity-providers) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/identity-providers` | [Create organization identity provider](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/identity-providers) | [organizations](./organizations.md) |
| `GET` | `/organizations/{organizationId}/identity-providers/{id}` | [Get organization identity provider](./organizations.md#daytona/tag/organizations/GET/organizations/{organizationId}/identity-providers/{id}) | [organizations](./organizations.md) |
| `PATCH` | `/organizations/{organizationId}/identity-providers/{id}` | [Update organization identity provider](./organizations.md#daytona/tag/organizations/PATCH/organizations/{organizationId}/identity-providers/{id}) | [organizations](./organizations.md) |
| `DELETE` | `/organizations/{organizationId}/identity-providers/{id}` | [Delete organization identity provider](./organizations.md#daytona/tag/organizations/DELETE/organizations/{organizationId}/identity-providers/{id}) | [organizations](./organizations.md) |
| `POST` | `/organizations/{organizationId}/identity-providers/test-connection` | [Test OIDC identity provider connection](./organizations.md#daytona/tag/organizations/POST/organizations/{organizationId}/identity-providers/test-connection) | [organizations](./organizations.md) |
| `GET` | `/preview/{sandboxId}/public` | [Check if sandbox is public](./preview.md#daytona/tag/preview/GET/preview/{sandboxId}/public) | [preview](./preview.md) |
| `GET` | `/preview/{sandboxId}/preview-warning` | [Check if the preview warning page is enabled for the sandbox](./preview.md#daytona/tag/preview/GET/preview/{sandboxId}/preview-warning) | [preview](./preview.md) |
| `GET` | `/preview/{sandboxId}/validate/{authToken}` | [Check if sandbox auth token is valid](./preview.md#daytona/tag/preview/GET/preview/{sandboxId}/validate/{authToken}) | [preview](./preview.md) |
| `GET` | `/preview/{sandboxId}/signing-key` | [Get the signing key for a sandbox](./preview.md#daytona/tag/preview/GET/preview/{sandboxId}/signing-key) | [preview](./preview.md) |
| `GET` | `/preview/{sandboxId}/access` | [Check if user has access to the sandbox](./preview.md#daytona/tag/preview/GET/preview/{sandboxId}/access) | [preview](./preview.md) |
| `GET` | `/preview/{signedPreviewToken}/{port}/sandbox-id` | [Get sandbox ID from signed preview URL token](./preview.md#daytona/tag/preview/GET/preview/{signedPreviewToken}/{port}/sandbox-id) | [preview](./preview.md) |
| `GET` | `/shared-regions` | [List all shared regions](./regions.md#daytona/tag/regions/GET/shared-regions) | [regions](./regions.md) |
| `GET` | `/runners` | [List all runners](./runners.md#daytona/tag/runners/GET/runners) | [runners](./runners.md) |
| `POST` | `/runners` | [Create runner](./runners.md#daytona/tag/runners/POST/runners) | [runners](./runners.md) |
| `GET` | `/runners/me` | [Get info for authenticated runner](./runners.md#daytona/tag/runners/GET/runners/me) | [runners](./runners.md) |
| `GET` | `/runners/me/snapshots` | [Get snapshot refs for authenticated runner](./runners.md#daytona/tag/runners/GET/runners/me/snapshots) | [runners](./runners.md) |
| `GET` | `/runners/by-sandbox/{sandboxId}` | [Get runner by sandbox ID](./runners.md#daytona/tag/runners/GET/runners/by-sandbox/{sandboxId}) | [runners](./runners.md) |
| `GET` | `/runners/by-snapshot-ref` | [Get runners by snapshot ref](./runners.md#daytona/tag/runners/GET/runners/by-snapshot-ref) | [runners](./runners.md) |
| `GET` | `/runners/{id}` | [Get runner by ID](./runners.md#daytona/tag/runners/GET/runners/{id}) | [runners](./runners.md) |
| `DELETE` | `/runners/{id}` | [Delete runner](./runners.md#daytona/tag/runners/DELETE/runners/{id}) | [runners](./runners.md) |
| `GET` | `/runners/{id}/full` | [Get runner by ID](./runners.md#daytona/tag/runners/GET/runners/{id}/full) | [runners](./runners.md) |
| `PATCH` | `/runners/{id}/scheduling` | [Update runner scheduling status](./runners.md#daytona/tag/runners/PATCH/runners/{id}/scheduling) | [runners](./runners.md) |
| `PATCH` | `/runners/{id}/draining` | [Update runner draining status](./runners.md#daytona/tag/runners/PATCH/runners/{id}/draining) | [runners](./runners.md) |
| `POST` | `/runners/healthcheck` | [Runner healthcheck](./runners.md#daytona/tag/runners/POST/runners/healthcheck) | [runners](./runners.md) |
| `GET` | `/sandbox` | [List sandboxes](./sandbox.md#daytona/tag/sandbox/GET/sandbox) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox` | [Create a new sandbox](./sandbox.md#daytona/tag/sandbox/POST/sandbox) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/paginated` | [[DEPRECATED] List all sandboxes paginated](./sandbox.md#daytona/tag/sandbox/GET/sandbox/paginated) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/for-runner` | [Get sandboxes for the authenticated runner](./sandbox.md#daytona/tag/sandbox/GET/sandbox/for-runner) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxIdOrName}` | [Get sandbox details](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}) | [sandbox](./sandbox.md) |
| `DELETE` | `/sandbox/{sandboxIdOrName}` | [Delete sandbox](./sandbox.md#daytona/tag/sandbox/DELETE/sandbox/{sandboxIdOrName}) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/recover` | [Recover sandbox from error state](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/recover) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/start` | [Start or resume sandbox](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/start) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/stop` | [Stop sandbox](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/stop) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/pause` | [Pause sandbox](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/pause) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/resize` | [Resize sandbox resources](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/resize) | [sandbox](./sandbox.md) |
| `PUT` | `/sandbox/{sandboxIdOrName}/labels` | [Replace sandbox labels](./sandbox.md#daytona/tag/sandbox/PUT/sandbox/{sandboxIdOrName}/labels) | [sandbox](./sandbox.md) |
| `PUT` | `/sandbox/{sandboxId}/state` | [Update sandbox state](./sandbox.md#daytona/tag/sandbox/PUT/sandbox/{sandboxId}/state) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/backup` | [Create sandbox backup](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/backup) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/snapshot` | [Create a snapshot from a sandbox](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/snapshot) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/fork` | [Fork a sandbox](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/fork) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxIdOrName}/forks` | [Get sandbox fork children](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/forks) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxIdOrName}/parent` | [Get sandbox fork parent](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/parent) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxIdOrName}/ancestors` | [Get sandbox fork ancestor chain](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/ancestors) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/public/{isPublic}` | [Update public status](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/public/{isPublic}) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxId}/signing-key` | [Get the signing key for a sandbox](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxId}/signing-key) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxId}/signing-key/rotate` | [Rotate the signing key, invalidating all previously signed URLs](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxId}/signing-key/rotate) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxId}/last-activity` | [Update sandbox last activity](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxId}/last-activity) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/autostop/{interval}` | [Set sandbox auto-stop interval](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/autostop/{interval}) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/autopause/{interval}` | [Set sandbox auto-pause interval](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/autopause/{interval}) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/ttl/{ttlMinutes}` | [Set sandbox TTL](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/ttl/{ttlMinutes}) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/autoarchive/{interval}` | [Set sandbox auto-archive interval](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/autoarchive/{interval}) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/autodelete/{interval}` | [Set sandbox auto-delete interval](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/autodelete/{interval}) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/network-settings` | [Update sandbox network settings](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/network-settings) | [sandbox](./sandbox.md) |
| `PUT` | `/sandbox/{sandboxIdOrName}/secrets` | [Update sandbox secrets](./sandbox.md#daytona/tag/sandbox/PUT/sandbox/{sandboxIdOrName}/secrets) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/archive` | [Archive sandbox](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/archive) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxIdOrName}/ports/{port}/preview-url` | [Get preview URL for a sandbox port](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/ports/{port}/preview-url) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxIdOrName}/ports/{port}/signed-preview-url` | [Get signed preview URL for a sandbox port](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/ports/{port}/signed-preview-url) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/ports/{port}/signed-preview-url/{token}/expire` | [Expire signed preview URL for a sandbox port](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/ports/{port}/signed-preview-url/{token}/expire) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxIdOrName}/build-logs` | [Get build logs](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/build-logs) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxIdOrName}/build-logs-url` | [Get build logs URL](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxIdOrName}/build-logs-url) | [sandbox](./sandbox.md) |
| `POST` | `/sandbox/{sandboxIdOrName}/ssh-access` | [Create SSH access for sandbox](./sandbox.md#daytona/tag/sandbox/POST/sandbox/{sandboxIdOrName}/ssh-access) | [sandbox](./sandbox.md) |
| `DELETE` | `/sandbox/{sandboxIdOrName}/ssh-access` | [Revoke SSH access for sandbox](./sandbox.md#daytona/tag/sandbox/DELETE/sandbox/{sandboxIdOrName}/ssh-access) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/ssh-access/validate` | [Validate SSH access for sandbox](./sandbox.md#daytona/tag/sandbox/GET/sandbox/ssh-access/validate) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxId}/toolbox-proxy-url` | [Get toolbox proxy URL for a sandbox](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxId}/toolbox-proxy-url) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxId}/organization` | [Get organization by sandbox ID](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxId}/organization) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxId}/region-quota` | [Get region quota by sandbox ID](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxId}/region-quota) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxId}/secrets` | [Resolve sandbox secrets](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxId}/secrets) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxId}/telemetry/logs` | [Get sandbox logs](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxId}/telemetry/logs) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxId}/telemetry/traces` | [Get sandbox traces](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxId}/telemetry/traces) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxId}/telemetry/traces/{traceId}` | [Get trace spans](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxId}/telemetry/traces/{traceId}) | [sandbox](./sandbox.md) |
| `GET` | `/sandbox/{sandboxId}/telemetry/metrics` | [Get sandbox metrics](./sandbox.md#daytona/tag/sandbox/GET/sandbox/{sandboxId}/telemetry/metrics) | [sandbox](./sandbox.md) |
| `GET` | `/secret` | [List secrets](./secret.md#daytona/tag/secret/GET/secret) | [secret](./secret.md) |
| `POST` | `/secret` | [Create secret](./secret.md#daytona/tag/secret/POST/secret) | [secret](./secret.md) |
| `GET` | `/secret/paginated` | [List secrets with pagination](./secret.md#daytona/tag/secret/GET/secret/paginated) | [secret](./secret.md) |
| `GET` | `/secret/{secretId}` | [Get secret](./secret.md#daytona/tag/secret/GET/secret/{secretId}) | [secret](./secret.md) |
| `PATCH` | `/secret/{secretId}` | [Update secret](./secret.md#daytona/tag/secret/PATCH/secret/{secretId}) | [secret](./secret.md) |
| `DELETE` | `/secret/{secretId}` | [Delete secret](./secret.md#daytona/tag/secret/DELETE/secret/{secretId}) | [secret](./secret.md) |
| `GET` | `/snapshots` | [List all snapshots](./snapshots.md#daytona/tag/snapshots/GET/snapshots) | [snapshots](./snapshots.md) |
| `POST` | `/snapshots` | [Create a new snapshot](./snapshots.md#daytona/tag/snapshots/POST/snapshots) | [snapshots](./snapshots.md) |
| `GET` | `/snapshots/{id}` | [Get snapshot by ID or name](./snapshots.md#daytona/tag/snapshots/GET/snapshots/{id}) | [snapshots](./snapshots.md) |
| `DELETE` | `/snapshots/{id}` | [Delete snapshot](./snapshots.md#daytona/tag/snapshots/DELETE/snapshots/{id}) | [snapshots](./snapshots.md) |
| `GET` | `/snapshots/{id}/build-logs` | [Get snapshot build logs](./snapshots.md#daytona/tag/snapshots/GET/snapshots/{id}/build-logs) | [snapshots](./snapshots.md) |
| `GET` | `/snapshots/{id}/build-logs-url` | [Get snapshot build logs URL](./snapshots.md#daytona/tag/snapshots/GET/snapshots/{id}/build-logs-url) | [snapshots](./snapshots.md) |
| `POST` | `/snapshots/{id}/activate` | [Activate a snapshot](./snapshots.md#daytona/tag/snapshots/POST/snapshots/{id}/activate) | [snapshots](./snapshots.md) |
| `POST` | `/snapshots/{id}/deactivate` | [Deactivate a snapshot](./snapshots.md#daytona/tag/snapshots/POST/snapshots/{id}/deactivate) | [snapshots](./snapshots.md) |
| `GET` | `/users/me` | [Get authenticated user](./users.md#daytona/tag/users/GET/users/me) | [users](./users.md) |
| `GET` | `/users/account-providers` | [Get available account providers](./users.md#daytona/tag/users/GET/users/account-providers) | [users](./users.md) |
| `POST` | `/users/linked-accounts` | [Link account](./users.md#daytona/tag/users/POST/users/linked-accounts) | [users](./users.md) |
| `DELETE` | `/users/linked-accounts/{provider}/{providerUserId}` | [Unlink account](./users.md#daytona/tag/users/DELETE/users/linked-accounts/{provider}/{providerUserId}) | [users](./users.md) |
| `POST` | `/users/mfa/sms/enroll` | [Enroll in SMS MFA](./users.md#daytona/tag/users/POST/users/mfa/sms/enroll) | [users](./users.md) |
| `GET` | `/users/me/pending-sso-links` | [List pending SSO account links for the authenticated user](./users.md#daytona/tag/users/GET/users/me/pending-sso-links) | [users](./users.md) |
| `POST` | `/users/me/pending-sso-links/{id}/confirm` | [Confirm (link) a pending SSO account link](./users.md#daytona/tag/users/POST/users/me/pending-sso-links/{id}/confirm) | [users](./users.md) |
| `DELETE` | `/users/me/pending-sso-links/{id}` | [Dismiss a pending SSO account link](./users.md#daytona/tag/users/DELETE/users/me/pending-sso-links/{id}) | [users](./users.md) |
| `GET` | `/volumes` | [List all volumes](./volumes.md#daytona/tag/volumes/GET/volumes) | [volumes](./volumes.md) |
| `POST` | `/volumes` | [Create a new volume](./volumes.md#daytona/tag/volumes/POST/volumes) | [volumes](./volumes.md) |
| `GET` | `/volumes/{volumeId}` | [Get volume details](./volumes.md#daytona/tag/volumes/GET/volumes/{volumeId}) | [volumes](./volumes.md) |
| `DELETE` | `/volumes/{volumeId}` | [Delete volume](./volumes.md#daytona/tag/volumes/DELETE/volumes/{volumeId}) | [volumes](./volumes.md) |
| `GET` | `/volumes/by-name/{name}` | [Get volume details by name](./volumes.md#daytona/tag/volumes/GET/volumes/by-name/{name}) | [volumes](./volumes.md) |
| `GET` | `/warm-pools` | [List warm pools for the organization](./warm-pools.md#daytona/tag/warm-pools/GET/warm-pools) | [warm-pools](./warm-pools.md) |
| `POST` | `/warm-pools` | [Create a warm pool](./warm-pools.md#daytona/tag/warm-pools/POST/warm-pools) | [warm-pools](./warm-pools.md) |
| `PATCH` | `/warm-pools/{id}` | [Update a warm pool size](./warm-pools.md#daytona/tag/warm-pools/PATCH/warm-pools/{id}) | [warm-pools](./warm-pools.md) |
| `DELETE` | `/warm-pools/{id}` | [Delete a warm pool](./warm-pools.md#daytona/tag/warm-pools/DELETE/warm-pools/{id}) | [warm-pools](./warm-pools.md) |
| `POST` | `/webhooks/organizations/{organizationId}/app-portal-access` | [Get Svix Consumer App Portal access for an organization](./webhooks.md#daytona/tag/webhooks/POST/webhooks/organizations/{organizationId}/app-portal-access) | [webhooks](./webhooks.md) |
| `GET` | `/webhooks/organizations/{organizationId}/initialization-status` | [Get webhook initialization status for an organization](./webhooks.md#daytona/tag/webhooks/GET/webhooks/organizations/{organizationId}/initialization-status) | [webhooks](./webhooks.md) |
| `POST` | `/webhooks/organizations/{organizationId}/initialize` | [Initialize webhooks for an organization](./webhooks.md#daytona/tag/webhooks/POST/webhooks/organizations/{organizationId}/initialize) | [webhooks](./webhooks.md) |
| `POST` | `/webhooks/organizations/{organizationId}/refresh-endpoints` | [Refresh cached endpoint presence flag for an organization](./webhooks.md#daytona/tag/webhooks/POST/webhooks/organizations/{organizationId}/refresh-endpoints) | [webhooks](./webhooks.md) |

### Tags

- [Health](./Health.md) (2 endpoints) {#daytona/tag/Health}
- [api-keys](./api-keys.md) (6 endpoints) {#daytona/tag/api-keys}
- [audit](./audit.md) (2 endpoints) {#daytona/tag/audit}
- [config](./config.md) (1 endpoints) {#daytona/tag/config}
- [docker-registry](./docker-registry.md) (6 endpoints) {#daytona/tag/docker-registry}
- [jobs](./jobs.md) (4 endpoints) {#daytona/tag/jobs}
- [object-storage](./object-storage.md) (1 endpoints) {#daytona/tag/object-storage}
- [organizations](./organizations.md) (49 endpoints) {#daytona/tag/organizations}
- [preview](./preview.md) (6 endpoints) {#daytona/tag/preview}
- [regions](./regions.md) (1 endpoints) {#daytona/tag/regions}
- [runners](./runners.md) (12 endpoints) {#daytona/tag/runners}
- [sandbox](./sandbox.md) (47 endpoints) {#daytona/tag/sandbox}
- [secret](./secret.md) (6 endpoints) {#daytona/tag/secret}
- [snapshots](./snapshots.md) (8 endpoints) {#daytona/tag/snapshots}
- [users](./users.md) (8 endpoints) {#daytona/tag/users}
- [volumes](./volumes.md) (5 endpoints) {#daytona/tag/volumes}
- [warm-pools](./warm-pools.md) (4 endpoints) {#daytona/tag/warm-pools}
- [webhooks](./webhooks.md) (4 endpoints) {#daytona/tag/webhooks}

---

## Toolbox API {#daytona-toolbox}

The Toolbox API runs inside sandboxes and provides file system, git, process, and other operations.

| Method | Path | Summary | Tag |
|--------|------|---------|-----|
| `POST` | `/computeruse/a11y/find` | [Find accessibility nodes](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/a11y/find) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/a11y/node/focus` | [Focus an accessibility node](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/a11y/node/focus) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/a11y/node/invoke` | [Invoke an action on an accessibility node](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/a11y/node/invoke) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/a11y/node/value` | [Set the value of an accessibility node](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/a11y/node/value) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/a11y/tree` | [Get accessibility tree](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/a11y/tree) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/display/info` | [Get display information](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/display/info) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/display/windows` | [Get windows information](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/display/windows) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/keyboard/hotkey` | [Press hotkey](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/keyboard/hotkey) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/keyboard/key` | [Press key](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/keyboard/key) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/keyboard/type` | [Type text](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/keyboard/type) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/mouse/click` | [Click mouse button](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/mouse/click) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/mouse/drag` | [Drag mouse](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/mouse/drag) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/mouse/move` | [Move mouse cursor](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/mouse/move) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/mouse/position` | [Get mouse position](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/mouse/position) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/mouse/scroll` | [Scroll mouse wheel](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/mouse/scroll) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/process-status` | [Get computer use process status](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/process-status) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/process/{processName}/errors` | [Get process errors](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/process/{processName}/errors) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/process/{processName}/logs` | [Get process logs](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/process/{processName}/logs) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/process/{processName}/restart` | [Restart specific process](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/process/{processName}/restart) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/process/{processName}/status` | [Get specific process status](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/process/{processName}/status) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/recordings` | [List all recordings](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/recordings) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/recordings/start` | [Start a new recording](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/recordings/start) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/recordings/stop` | [Stop a recording](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/recordings/stop) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/recordings/{id}` | [Get recording details](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/recordings/{id}) | [computer-use](./toolbox-computer-use.md) |
| `DELETE` | `/computeruse/recordings/{id}` | [Delete a recording](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/DELETE/computeruse/recordings/{id}) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/recordings/{id}/download` | [Download a recording](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/recordings/{id}/download) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/screenshot` | [Take a screenshot](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/screenshot) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/screenshot/compressed` | [Take a compressed screenshot](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/screenshot/compressed) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/screenshot/region` | [Take a region screenshot](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/screenshot/region) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/screenshot/region/compressed` | [Take a compressed region screenshot](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/screenshot/region/compressed) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/start` | [Start computer use processes](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/start) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/status` | [Get computer use status](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/GET/computeruse/status) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/stop` | [Stop computer use processes](./toolbox-computer-use.md#daytona-toolbox/tag/computer-use/POST/computeruse/stop) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/files` | [List files and directories](./toolbox-file-system.md#daytona-toolbox/tag/file-system/GET/files) | [file-system](./toolbox-file-system.md) |
| `DELETE` | `/files` | [Delete a file or directory](./toolbox-file-system.md#daytona-toolbox/tag/file-system/DELETE/files) | [file-system](./toolbox-file-system.md) |
| `POST` | `/files/bulk-download` | [Download multiple files](./toolbox-file-system.md#daytona-toolbox/tag/file-system/POST/files/bulk-download) | [file-system](./toolbox-file-system.md) |
| `POST` | `/files/bulk-upload` | [Upload multiple files](./toolbox-file-system.md#daytona-toolbox/tag/file-system/POST/files/bulk-upload) | [file-system](./toolbox-file-system.md) |
| `GET` | `/files/download` | [Download a file](./toolbox-file-system.md#daytona-toolbox/tag/file-system/GET/files/download) | [file-system](./toolbox-file-system.md) |
| `GET` | `/files/find` | [Find text in files](./toolbox-file-system.md#daytona-toolbox/tag/file-system/GET/files/find) | [file-system](./toolbox-file-system.md) |
| `POST` | `/files/folder` | [Create a folder](./toolbox-file-system.md#daytona-toolbox/tag/file-system/POST/files/folder) | [file-system](./toolbox-file-system.md) |
| `GET` | `/files/info` | [Get file information](./toolbox-file-system.md#daytona-toolbox/tag/file-system/GET/files/info) | [file-system](./toolbox-file-system.md) |
| `POST` | `/files/move` | [Move or rename file/directory](./toolbox-file-system.md#daytona-toolbox/tag/file-system/POST/files/move) | [file-system](./toolbox-file-system.md) |
| `POST` | `/files/permissions` | [Set file permissions](./toolbox-file-system.md#daytona-toolbox/tag/file-system/POST/files/permissions) | [file-system](./toolbox-file-system.md) |
| `POST` | `/files/replace` | [Replace text in files](./toolbox-file-system.md#daytona-toolbox/tag/file-system/POST/files/replace) | [file-system](./toolbox-file-system.md) |
| `GET` | `/files/search` | [Search files by pattern](./toolbox-file-system.md#daytona-toolbox/tag/file-system/GET/files/search) | [file-system](./toolbox-file-system.md) |
| `POST` | `/files/upload-v2` | [Upload a file](./toolbox-file-system.md#daytona-toolbox/tag/file-system/POST/files/upload-v2) | [file-system](./toolbox-file-system.md) |
| `POST` | `/git/add` | [Add files to Git staging](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/add) | [git](./toolbox-git.md) |
| `GET` | `/git/branches` | [List branches](./toolbox-git.md#daytona-toolbox/tag/git/GET/git/branches) | [git](./toolbox-git.md) |
| `POST` | `/git/branches` | [Create a new branch](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/branches) | [git](./toolbox-git.md) |
| `DELETE` | `/git/branches` | [Delete a branch](./toolbox-git.md#daytona-toolbox/tag/git/DELETE/git/branches) | [git](./toolbox-git.md) |
| `POST` | `/git/checkout` | [Checkout branch or commit](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/checkout) | [git](./toolbox-git.md) |
| `POST` | `/git/clone` | [Clone a Git repository](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/clone) | [git](./toolbox-git.md) |
| `POST` | `/git/commit` | [Commit changes](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/commit) | [git](./toolbox-git.md) |
| `GET` | `/git/config` | [Get a Git config value](./toolbox-git.md#daytona-toolbox/tag/git/GET/git/config) | [git](./toolbox-git.md) |
| `POST` | `/git/config` | [Set a Git config value](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/config) | [git](./toolbox-git.md) |
| `POST` | `/git/config/user` | [Configure Git user](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/config/user) | [git](./toolbox-git.md) |
| `POST` | `/git/credentials` | [Authenticate Git](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/credentials) | [git](./toolbox-git.md) |
| `GET` | `/git/history` | [Get commit history](./toolbox-git.md#daytona-toolbox/tag/git/GET/git/history) | [git](./toolbox-git.md) |
| `POST` | `/git/init` | [Initialize a Git repository](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/init) | [git](./toolbox-git.md) |
| `POST` | `/git/pull` | [Pull changes from remote](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/pull) | [git](./toolbox-git.md) |
| `POST` | `/git/push` | [Push changes to remote](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/push) | [git](./toolbox-git.md) |
| `GET` | `/git/remotes` | [List remotes](./toolbox-git.md#daytona-toolbox/tag/git/GET/git/remotes) | [git](./toolbox-git.md) |
| `POST` | `/git/remotes` | [Add a remote](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/remotes) | [git](./toolbox-git.md) |
| `POST` | `/git/reset` | [Reset repository](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/reset) | [git](./toolbox-git.md) |
| `POST` | `/git/restore` | [Restore files](./toolbox-git.md#daytona-toolbox/tag/git/POST/git/restore) | [git](./toolbox-git.md) |
| `GET` | `/git/status` | [Get Git status](./toolbox-git.md#daytona-toolbox/tag/git/GET/git/status) | [git](./toolbox-git.md) |
| `GET` | `/user-home-dir` | [Get user home directory](./toolbox-info.md#daytona-toolbox/tag/info/GET/user-home-dir) | [info](./toolbox-info.md) |
| `GET` | `/version` | [Get version](./toolbox-info.md#daytona-toolbox/tag/info/GET/version) | [info](./toolbox-info.md) |
| `GET` | `/work-dir` | [Get working directory](./toolbox-info.md#daytona-toolbox/tag/info/GET/work-dir) | [info](./toolbox-info.md) |
| `GET` | `/process/interpreter/context` | [List all user-created interpreter contexts](./toolbox-interpreter.md#daytona-toolbox/tag/interpreter/GET/process/interpreter/context) | [interpreter](./toolbox-interpreter.md) |
| `POST` | `/process/interpreter/context` | [Create a new interpreter context](./toolbox-interpreter.md#daytona-toolbox/tag/interpreter/POST/process/interpreter/context) | [interpreter](./toolbox-interpreter.md) |
| `DELETE` | `/process/interpreter/context/{id}` | [Delete an interpreter context](./toolbox-interpreter.md#daytona-toolbox/tag/interpreter/DELETE/process/interpreter/context/{id}) | [interpreter](./toolbox-interpreter.md) |
| `GET` | `/process/interpreter/execute` | [Execute code in an interpreter context](./toolbox-interpreter.md#daytona-toolbox/tag/interpreter/GET/process/interpreter/execute) | [interpreter](./toolbox-interpreter.md) |
| `POST` | `/lsp/completions` | [Get code completions](./toolbox-lsp.md#daytona-toolbox/tag/lsp/POST/lsp/completions) | [lsp](./toolbox-lsp.md) |
| `POST` | `/lsp/did-close` | [Notify document closed](./toolbox-lsp.md#daytona-toolbox/tag/lsp/POST/lsp/did-close) | [lsp](./toolbox-lsp.md) |
| `POST` | `/lsp/did-open` | [Notify document opened](./toolbox-lsp.md#daytona-toolbox/tag/lsp/POST/lsp/did-open) | [lsp](./toolbox-lsp.md) |
| `GET` | `/lsp/document-symbols` | [Get document symbols](./toolbox-lsp.md#daytona-toolbox/tag/lsp/GET/lsp/document-symbols) | [lsp](./toolbox-lsp.md) |
| `POST` | `/lsp/start` | [Start LSP server](./toolbox-lsp.md#daytona-toolbox/tag/lsp/POST/lsp/start) | [lsp](./toolbox-lsp.md) |
| `POST` | `/lsp/stop` | [Stop LSP server](./toolbox-lsp.md#daytona-toolbox/tag/lsp/POST/lsp/stop) | [lsp](./toolbox-lsp.md) |
| `GET` | `/lsp/workspacesymbols` | [Get workspace symbols](./toolbox-lsp.md#daytona-toolbox/tag/lsp/GET/lsp/workspacesymbols) | [lsp](./toolbox-lsp.md) |
| `GET` | `/port` | [Get active ports](./toolbox-port.md#daytona-toolbox/tag/port/GET/port) | [port](./toolbox-port.md) |
| `GET` | `/port/{port}/in-use` | [Check if port is in use](./toolbox-port.md#daytona-toolbox/tag/port/GET/port/{port}/in-use) | [port](./toolbox-port.md) |
| `POST` | `/process/code-run` | [Execute code](./toolbox-process.md#daytona-toolbox/tag/process/POST/process/code-run) | [process](./toolbox-process.md) |
| `POST` | `/process/execute` | [Execute a command](./toolbox-process.md#daytona-toolbox/tag/process/POST/process/execute) | [process](./toolbox-process.md) |
| `GET` | `/process/pty` | [List all PTY sessions](./toolbox-process.md#daytona-toolbox/tag/process/GET/process/pty) | [process](./toolbox-process.md) |
| `POST` | `/process/pty` | [Create a new PTY session](./toolbox-process.md#daytona-toolbox/tag/process/POST/process/pty) | [process](./toolbox-process.md) |
| `GET` | `/process/pty/{sessionId}` | [Get PTY session information](./toolbox-process.md#daytona-toolbox/tag/process/GET/process/pty/{sessionId}) | [process](./toolbox-process.md) |
| `DELETE` | `/process/pty/{sessionId}` | [Delete a PTY session](./toolbox-process.md#daytona-toolbox/tag/process/DELETE/process/pty/{sessionId}) | [process](./toolbox-process.md) |
| `GET` | `/process/pty/{sessionId}/connect` | [Connect to PTY session via WebSocket](./toolbox-process.md#daytona-toolbox/tag/process/GET/process/pty/{sessionId}/connect) | [process](./toolbox-process.md) |
| `POST` | `/process/pty/{sessionId}/resize` | [Resize a PTY session](./toolbox-process.md#daytona-toolbox/tag/process/POST/process/pty/{sessionId}/resize) | [process](./toolbox-process.md) |
| `GET` | `/process/session` | [List all sessions](./toolbox-process.md#daytona-toolbox/tag/process/GET/process/session) | [process](./toolbox-process.md) |
| `POST` | `/process/session` | [Create a new session](./toolbox-process.md#daytona-toolbox/tag/process/POST/process/session) | [process](./toolbox-process.md) |
| `GET` | `/process/session/entrypoint` | [Get entrypoint session details](./toolbox-process.md#daytona-toolbox/tag/process/GET/process/session/entrypoint) | [process](./toolbox-process.md) |
| `GET` | `/process/session/entrypoint/logs` | [Get entrypoint logs](./toolbox-process.md#daytona-toolbox/tag/process/GET/process/session/entrypoint/logs) | [process](./toolbox-process.md) |
| `GET` | `/process/session/{sessionId}` | [Get session details](./toolbox-process.md#daytona-toolbox/tag/process/GET/process/session/{sessionId}) | [process](./toolbox-process.md) |
| `DELETE` | `/process/session/{sessionId}` | [Delete a session](./toolbox-process.md#daytona-toolbox/tag/process/DELETE/process/session/{sessionId}) | [process](./toolbox-process.md) |
| `GET` | `/process/session/{sessionId}/command/{commandId}` | [Get session command details](./toolbox-process.md#daytona-toolbox/tag/process/GET/process/session/{sessionId}/command/{commandId}) | [process](./toolbox-process.md) |
| `POST` | `/process/session/{sessionId}/command/{commandId}/input` | [Send input to command](./toolbox-process.md#daytona-toolbox/tag/process/POST/process/session/{sessionId}/command/{commandId}/input) | [process](./toolbox-process.md) |
| `GET` | `/process/session/{sessionId}/command/{commandId}/logs` | [Get session command logs](./toolbox-process.md#daytona-toolbox/tag/process/GET/process/session/{sessionId}/command/{commandId}/logs) | [process](./toolbox-process.md) |
| `POST` | `/process/session/{sessionId}/exec` | [Execute command in session](./toolbox-process.md#daytona-toolbox/tag/process/POST/process/session/{sessionId}/exec) | [process](./toolbox-process.md) |
| `POST` | `/env` | [Update process environment](./toolbox-server.md#daytona-toolbox/tag/server/POST/env) | [server](./toolbox-server.md) |
| `POST` | `/init` | [Initialize toolbox server](./toolbox-server.md#daytona-toolbox/tag/server/POST/init) | [server](./toolbox-server.md) |
| `GET` | `/system/metrics` | [Get sandbox resource metrics](./toolbox-system.md#daytona-toolbox/tag/system/GET/system/metrics) | [system](./toolbox-system.md) |

### Tags

- [computer-use](./toolbox-computer-use.md) (33 endpoints) {#daytona-toolbox/tag/computer-use}
- [file-system](./toolbox-file-system.md) (13 endpoints) {#daytona-toolbox/tag/file-system}
- [git](./toolbox-git.md) (20 endpoints) {#daytona-toolbox/tag/git}
- [info](./toolbox-info.md) (3 endpoints) {#daytona-toolbox/tag/info}
- [interpreter](./toolbox-interpreter.md) (4 endpoints) {#daytona-toolbox/tag/interpreter}
- [lsp](./toolbox-lsp.md) (7 endpoints) {#daytona-toolbox/tag/lsp}
- [port](./toolbox-port.md) (2 endpoints) {#daytona-toolbox/tag/port}
- [process](./toolbox-process.md) (18 endpoints) {#daytona-toolbox/tag/process}
- [server](./toolbox-server.md) (2 endpoints) {#daytona-toolbox/tag/server}
- [system](./toolbox-system.md) (1 endpoints) {#daytona-toolbox/tag/system}
