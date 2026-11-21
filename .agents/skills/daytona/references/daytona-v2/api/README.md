# Daytona v2 API Reference

## Daytona API

Base URL: `https://api.daytona.com`

All requests take a Bearer token in the `Authorization` header. Each operation lists the accepted token kinds and the permissions it needs.

```bash
curl 'https://api.daytona.com/sandboxes' \
  --header "Authorization: Bearer $DAYTONA_API_KEY"
```

Authentication uses Bearer tokens; each operation's security declaration names the accepted schemes, and public operations declare an empty security array. Errors use the `ErrorBody` envelope, and every response includes `x-daytona-trace-id` so support can locate the request. Lists use `limit` and an opaque `cursor`, and return `next_cursor` when another page exists. Some deployments serve API areas at different base URLs; a request sent to a base URL that does not serve it returns 501 (`WORKLOAD_PLANE_ELSEWHERE` or `MANAGEMENT_PLANE_ELSEWHERE`). Sandbox create requests may select a region with the `x-daytona-region` request header; searches filter by region with the `region_ids` query parameter. Adding an enum value is not a breaking change; clients must accept values they don't recognize.

| Method | Path | Summary | Tag |
|--------|------|---------|-----|
| `GET` | `/events/{region}` | [Get the sandbox event stream](./sandboxes.md#get-the-sandbox-event-stream) | [sandboxes](./sandboxes.md) |
| `POST` | `/events/{region}/ticket` | [Mint a sandbox event ticket](./sandboxes.md#mint-a-sandbox-event-ticket) | [sandboxes](./sandboxes.md) |
| `GET` | `/sandboxes` | [List sandboxes](./sandboxes.md#list-sandboxes) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes` | [Create a sandbox](./sandboxes.md#create-a-sandbox) | [sandboxes](./sandboxes.md) |
| `GET` | `/sandboxes/batch-wait` | [Wait for sandboxes](./sandboxes.md#wait-for-sandboxes) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/from-snapshot` | [Create a sandbox from a snapshot](./sandboxes.md#create-a-sandbox-from-a-snapshot) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/macos` | [Create a macOS sandbox](./sandboxes.md#create-a-macos-sandbox) | [sandboxes](./sandboxes.md) |
| `GET` | `/sandboxes/search` | [Search sandboxes](./sandboxes.md#search-sandboxes) | [sandboxes](./sandboxes.md) |
| `GET` | `/sandboxes/{sandbox_id}` | [Get a sandbox](./sandboxes.md#get-a-sandbox) | [sandboxes](./sandboxes.md) |
| `DELETE` | `/sandboxes/{sandbox_id}` | [Delete a sandbox](./sandboxes.md#delete-a-sandbox) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/{sandbox_id}/access-token` | [Mint a sandbox access token](./sandboxes.md#mint-a-sandbox-access-token) | [sandboxes](./sandboxes.md) |
| `GET` | `/sandboxes/{sandbox_id}/build-logs-url` | [Get a sandbox's build logs URL](./sandboxes.md#get-a-sandboxs-build-logs-url) | [sandboxes](./sandboxes.md) |
| `GET` | `/sandboxes/{sandbox_id}/console-logs` | [Get sandbox console logs](./sandboxes.md#get-sandbox-console-logs) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/{sandbox_id}/files/sign` | [Sign a sandbox file URL](./sandboxes.md#sign-a-sandbox-file-url) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/{sandbox_id}/fork` | [Fork a sandbox](./sandboxes.md#fork-a-sandbox) | [sandboxes](./sandboxes.md) |
| `PUT` | `/sandboxes/{sandbox_id}/labels` | [Set sandbox labels](./sandboxes.md#set-sandbox-labels) | [sandboxes](./sandboxes.md) |
| `PATCH` | `/sandboxes/{sandbox_id}/lifecycle-policy` | [Update a sandbox lifecycle policy](./sandboxes.md#update-a-sandbox-lifecycle-policy) | [sandboxes](./sandboxes.md) |
| `GET` | `/sandboxes/{sandbox_id}/logs` | [Get sandbox logs](./sandboxes.md#get-sandbox-logs) | [sandboxes](./sandboxes.md) |
| `GET` | `/sandboxes/{sandbox_id}/network-policy` | [Get the sandbox network policy](./sandboxes.md#get-the-sandbox-network-policy) | [sandboxes](./sandboxes.md) |
| `PUT` | `/sandboxes/{sandbox_id}/network-policy` | [Set a sandbox network policy](./sandboxes.md#set-a-sandbox-network-policy) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/{sandbox_id}/pause` | [Pause a sandbox](./sandboxes.md#pause-a-sandbox) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/{sandbox_id}/reset-idle-timer` | [Reset a sandbox idle timer](./sandboxes.md#reset-a-sandbox-idle-timer) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/{sandbox_id}/restart` | [Restart a sandbox](./sandboxes.md#restart-a-sandbox) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/{sandbox_id}/resume` | [Resume a sandbox](./sandboxes.md#resume-a-sandbox) | [sandboxes](./sandboxes.md) |
| `GET` | `/sandboxes/{sandbox_id}/secrets` | [Get the sandbox secrets](./sandboxes.md#get-the-sandbox-secrets) | [sandboxes](./sandboxes.md) |
| `PUT` | `/sandboxes/{sandbox_id}/secrets` | [Set the sandbox secrets](./sandboxes.md#set-the-sandbox-secrets) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/{sandbox_id}/signing-key/rotate` | [Rotate a sandbox signing key](./sandboxes.md#rotate-a-sandbox-signing-key) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/{sandbox_id}/start` | [Start a sandbox](./sandboxes.md#start-a-sandbox) | [sandboxes](./sandboxes.md) |
| `POST` | `/sandboxes/{sandbox_id}/stop` | [Stop a sandbox](./sandboxes.md#stop-a-sandbox) | [sandboxes](./sandboxes.md) |
| `POST` | `/build-contexts` | [Create a build-context upload](./images.md#create-a-build-context-upload) | [images](./images.md) |
| `POST` | `/build-contexts/{id}/complete` | [Complete a build-context upload](./images.md#complete-a-build-context-upload) | [images](./images.md) |
| `GET` | `/images` | [List images](./images.md#list-images) | [images](./images.md) |
| `POST` | `/images` | [Create an image](./images.md#create-an-image) | [images](./images.md) |
| `GET` | `/images/search` | [Search images](./images.md#search-images) | [images](./images.md) |
| `GET` | `/images/{id}` | [Get an image](./images.md#get-an-image) | [images](./images.md) |
| `PATCH` | `/images/{id}` | [Update an image](./images.md#update-an-image) | [images](./images.md) |
| `DELETE` | `/images/{id}` | [Delete an image](./images.md#delete-an-image) | [images](./images.md) |
| `GET` | `/images/{id}/build-logs-url` | [Get an image's build logs URL](./images.md#get-an-images-build-logs-url) | [images](./images.md) |
| `POST` | `/images/{id}/convert` | [Change an image format](./images.md#change-an-image-format) | [images](./images.md) |
| `POST` | `/sandboxes/{sandbox_id}/images` | [Create an image from a sandbox](./images.md#create-an-image-from-a-sandbox) | [images](./images.md) |
| `GET` | `/migration/v0/sandboxes` | [List Daytona v0 sandboxes](./migration.md#list-daytona-v0-sandboxes) | [migration](./migration.md) |
| `POST` | `/migration/v0/sandboxes/{v0_id}/import` | [Create a Daytona v0 sandbox import](./migration.md#create-a-daytona-v0-sandbox-import) | [migration](./migration.md) |
| `GET` | `/migration/v0/summary` | [Get the Daytona v0 migration summary](./migration.md#get-the-daytona-v0-migration-summary) | [migration](./migration.md) |
| `POST` | `/sandboxes/{sandbox_id}/snapshots` | [Create a snapshot from a sandbox](./snapshots.md#create-a-snapshot-from-a-sandbox) | [snapshots](./snapshots.md) |
| `GET` | `/snapshots` | [List snapshots](./snapshots.md#list-snapshots) | [snapshots](./snapshots.md) |
| `GET` | `/snapshots/search` | [Search snapshots](./snapshots.md#search-snapshots) | [snapshots](./snapshots.md) |
| `GET` | `/snapshots/{id}` | [Get a snapshot](./snapshots.md#get-a-snapshot) | [snapshots](./snapshots.md) |
| `DELETE` | `/snapshots/{id}` | [Delete a snapshot](./snapshots.md#delete-a-snapshot) | [snapshots](./snapshots.md) |
| `GET` | `/volumes` | [List volumes](./volumes.md#list-volumes) | [volumes](./volumes.md) |
| `POST` | `/volumes` | [Create a volume](./volumes.md#create-a-volume) | [volumes](./volumes.md) |
| `GET` | `/volumes/{id}` | [Get a volume](./volumes.md#get-a-volume) | [volumes](./volumes.md) |
| `DELETE` | `/volumes/{id}` | [Delete a volume](./volumes.md#delete-a-volume) | [volumes](./volumes.md) |
| `GET` | `/secrets` | [List project secrets](./secrets.md#list-project-secrets) | [secrets](./secrets.md) |
| `GET` | `/secrets/{name}` | [Get a secret's metadata](./secrets.md#get-a-secrets-metadata) | [secrets](./secrets.md) |
| `PUT` | `/secrets/{name}` | [Create or update a secret](./secrets.md#create-or-update-a-secret) | [secrets](./secrets.md) |
| `DELETE` | `/secrets/{name}` | [Delete a secret](./secrets.md#delete-a-secret) | [secrets](./secrets.md) |
| `GET` | `/registries` | [List project registry credentials](./registries.md#list-project-registry-credentials) | [registries](./registries.md) |
| `GET` | `/registries/{host}` | [Get registry credential metadata](./registries.md#get-registry-credential-metadata) | [registries](./registries.md) |
| `PUT` | `/registries/{host}` | [Create or update registry credentials](./registries.md#create-or-update-registry-credentials) | [registries](./registries.md) |
| `DELETE` | `/registries/{host}` | [Delete registry credentials](./registries.md#delete-registry-credentials) | [registries](./registries.md) |
| `GET` | `/reservations` | [List reservations](./reservations.md#list-reservations) | [reservations](./reservations.md) |
| `POST` | `/reservations` | [Create a reservation](./reservations.md#create-a-reservation) | [reservations](./reservations.md) |
| `POST` | `/reservations/bulk` | [Create reservations in bulk](./reservations.md#create-reservations-in-bulk) | [reservations](./reservations.md) |
| `GET` | `/reservations/{id}` | [Get a reservation](./reservations.md#get-a-reservation) | [reservations](./reservations.md) |
| `PATCH` | `/reservations/{id}` | [Update a reservation](./reservations.md#update-a-reservation) | [reservations](./reservations.md) |
| `POST` | `/reservations/{id}/renew` | [Create a reservation renewal](./reservations.md#create-a-reservation-renewal) | [reservations](./reservations.md) |
| `GET` | `/sandboxes/{sandbox_id}/ports` | [List sandbox ports](./previews.md#list-sandbox-ports) | [previews](./previews.md) |
| `GET` | `/sandboxes/{sandbox_id}/ports/{port}` | [Get a sandbox port](./previews.md#get-a-sandbox-port) | [previews](./previews.md) |
| `PUT` | `/sandboxes/{sandbox_id}/ports/{port}` | [Set a sandbox port](./previews.md#set-a-sandbox-port) | [previews](./previews.md) |
| `DELETE` | `/sandboxes/{sandbox_id}/ports/{port}` | [Delete a sandbox port](./previews.md#delete-a-sandbox-port) | [previews](./previews.md) |
| `POST` | `/sandboxes/{sandbox_id}/ports/{port}/preview-url` | [Create a sandbox preview URL](./previews.md#create-a-sandbox-preview-url) | [previews](./previews.md) |
| `POST` | `/sandboxes/{sandbox_id}/ports/{port}/signed-preview-urls` | [Create a signed sandbox preview URL](./previews.md#create-a-signed-sandbox-preview-url) | [previews](./previews.md) |
| `POST` | `/sandboxes/{sandbox_id}/signed-preview-urls/revoke` | [Revoke all signed sandbox preview URLs](./previews.md#revoke-all-signed-sandbox-preview-urls) | [previews](./previews.md) |
| `GET` | `/orgs/{org_id}/parent-regions` | [List parent regions](./regions.md#list-parent-regions) | [regions](./regions.md) |
| `GET` | `/orgs/{org_id}/regions` | [List organization regions](./regions.md#list-organization-regions) | [regions](./regions.md) |
| `POST` | `/orgs/{org_id}/regions` | [Create an organization region](./regions.md#create-an-organization-region) | [regions](./regions.md) |
| `GET` | `/orgs/{org_id}/regions/{region_id}` | [Get an organization region](./regions.md#get-an-organization-region) | [regions](./regions.md) |
| `PATCH` | `/orgs/{org_id}/regions/{region_id}` | [Update an organization region](./regions.md#update-an-organization-region) | [regions](./regions.md) |
| `DELETE` | `/orgs/{org_id}/regions/{region_id}` | [Delete an organization region](./regions.md#delete-an-organization-region) | [regions](./regions.md) |
| `GET` | `/orgs/{org_id}/regions/{region_id}/installation` | [Get an organization region installation](./regions.md#get-an-organization-region-installation) | [regions](./regions.md) |
| `GET` | `/orgs/{org_id}/regions/{region_id}/proxy-tokens` | [List region proxy tokens](./regions.md#list-region-proxy-tokens) | [regions](./regions.md) |
| `POST` | `/orgs/{org_id}/regions/{region_id}/proxy-tokens` | [Create a region proxy token](./regions.md#create-a-region-proxy-token) | [regions](./regions.md) |
| `DELETE` | `/orgs/{org_id}/regions/{region_id}/proxy-tokens/{proxy_token_id}` | [Delete a region proxy token](./regions.md#delete-a-region-proxy-token) | [regions](./regions.md) |
| `POST` | `/orgs/{org_id}/regions/{region_id}/proxy-tokens/{proxy_token_id}/rotation` | [Rotate a region proxy token](./regions.md#rotate-a-region-proxy-token) | [regions](./regions.md) |
| `GET` | `/orgs/{org_id}/regions/{region_id}/registration-tokens` | [List region registration tokens](./regions.md#list-region-registration-tokens) | [regions](./regions.md) |
| `POST` | `/orgs/{org_id}/regions/{region_id}/registration-tokens` | [Create a region registration token](./regions.md#create-a-region-registration-token) | [regions](./regions.md) |
| `DELETE` | `/orgs/{org_id}/regions/{region_id}/registration-tokens/{registration_token_id}` | [Delete a region registration token](./regions.md#delete-a-region-registration-token) | [regions](./regions.md) |
| `GET` | `/orgs/{org_id}/regions/{region_id}/runners` | [List region runners](./regions.md#list-region-runners) | [regions](./regions.md) |
| `GET` | `/orgs/{org_id}/regions/{region_id}/runners/{runner_id}` | [Get a region runner](./regions.md#get-a-region-runner) | [regions](./regions.md) |
| `DELETE` | `/orgs/{org_id}/regions/{region_id}/runners/{runner_id}` | [Delete a region runner](./regions.md#delete-a-region-runner) | [regions](./regions.md) |
| `POST` | `/orgs/{org_id}/regions/{region_id}/runners/{runner_id}/cordon` | [Cordon a region runner](./regions.md#cordon-a-region-runner) | [regions](./regions.md) |
| `POST` | `/orgs/{org_id}/regions/{region_id}/runners/{runner_id}/uncordon` | [Uncordon a region runner](./regions.md#uncordon-a-region-runner) | [regions](./regions.md) |
| `GET` | `/regions` | [List regions](./regions.md#list-regions) | [regions](./regions.md) |
| `GET` | `/cpu-catalog` | [Get the CPU catalog](./catalog.md#get-the-cpu-catalog) | [catalog](./catalog.md) |
| `GET` | `/mac-catalog` | [Get the Mac catalog](./catalog.md#get-the-mac-catalog) | [catalog](./catalog.md) |
| `GET` | `/mac-models` | [List Mac models](./catalog.md#list-mac-models) | [catalog](./catalog.md) |
| `GET` | `/sandboxes/{sandbox_id}/usage` | [Get current sandbox usage](./usage.md#get-current-sandbox-usage) | [usage](./usage.md) |
| `GET` | `/sandboxes/{sandbox_id}/usage/history` | [Get sandbox usage history](./usage.md#get-sandbox-usage-history) | [usage](./usage.md) |
| `GET` | `/usage/budget` | [Get the project's spend budget](./usage.md#get-the-projects-spend-budget) | [usage](./usage.md) |
| `GET` | `/usage/report` | [Get a project usage report](./usage.md#get-a-project-usage-report) | [usage](./usage.md) |
| `GET` | `/me` | [Get the current user](./users.md#get-the-current-user) | [users](./users.md) |
| `GET` | `/me/privacy-policy` | [Get the privacy policy status](./users.md#get-the-privacy-policy-status) | [users](./users.md) |
| `POST` | `/me/privacy-policy/accept` | [Accept the privacy policy](./users.md#accept-the-privacy-policy) | [users](./users.md) |
| `POST` | `/invitations/accept` | [Accept an invitation](./organizations.md#accept-an-invitation) | [organizations](./organizations.md) |
| `POST` | `/invitations/decline` | [Decline an invitation](./organizations.md#decline-an-invitation) | [organizations](./organizations.md) |
| `POST` | `/invitations/lookup` | [Look up an invitation](./organizations.md#look-up-an-invitation) | [organizations](./organizations.md) |
| `GET` | `/orgs` | [List organizations](./organizations.md#list-organizations) | [organizations](./organizations.md) |
| `POST` | `/orgs` | [Create an organization](./organizations.md#create-an-organization) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}` | [Get an organization](./organizations.md#get-an-organization) | [organizations](./organizations.md) |
| `PATCH` | `/orgs/{org_id}` | [Update an organization](./organizations.md#update-an-organization) | [organizations](./organizations.md) |
| `DELETE` | `/orgs/{org_id}` | [Delete an organization](./organizations.md#delete-an-organization) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/audit-logs` | [List organization audit logs](./organizations.md#list-organization-audit-logs) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/audit-logs/config` | [Get the audit configuration](./organizations.md#get-the-audit-configuration) | [organizations](./organizations.md) |
| `PATCH` | `/orgs/{org_id}/audit-logs/config` | [Update audit configuration](./organizations.md#update-audit-configuration) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/entitlements` | [Get organization entitlements](./organizations.md#get-organization-entitlements) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/feature-flags` | [Get organization feature flags](./organizations.md#get-organization-feature-flags) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/invitations` | [List organization invitations](./organizations.md#list-organization-invitations) | [organizations](./organizations.md) |
| `POST` | `/orgs/{org_id}/invitations` | [Create an organization invitation](./organizations.md#create-an-organization-invitation) | [organizations](./organizations.md) |
| `DELETE` | `/orgs/{org_id}/invitations/{invitation_id}` | [Revoke an organization invitation](./organizations.md#revoke-an-organization-invitation) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/limits` | [Get organization limits](./organizations.md#get-organization-limits) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/macos-settings` | [Get the macOS settings](./organizations.md#get-the-macos-settings) | [organizations](./organizations.md) |
| `PATCH` | `/orgs/{org_id}/macos-settings` | [Update macOS settings](./organizations.md#update-macos-settings) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/members` | [List organization members](./organizations.md#list-organization-members) | [organizations](./organizations.md) |
| `PATCH` | `/orgs/{org_id}/members/{user_id}` | [Update an organization member](./organizations.md#update-an-organization-member) | [organizations](./organizations.md) |
| `DELETE` | `/orgs/{org_id}/members/{user_id}` | [Remove an organization member](./organizations.md#remove-an-organization-member) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/members/{user_id}/removal-preview` | [Get a member removal preview](./organizations.md#get-a-member-removal-preview) | [organizations](./organizations.md) |
| `POST` | `/orgs/{org_id}/members/{user_id}/update-preview` | [Preview a member update](./organizations.md#preview-a-member-update) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/otel-config` | [Get the telemetry configuration](./organizations.md#get-the-telemetry-configuration) | [organizations](./organizations.md) |
| `PUT` | `/orgs/{org_id}/otel-config` | [Set the telemetry configuration](./organizations.md#set-the-telemetry-configuration) | [organizations](./organizations.md) |
| `DELETE` | `/orgs/{org_id}/otel-config` | [Reset the telemetry configuration](./organizations.md#reset-the-telemetry-configuration) | [organizations](./organizations.md) |
| `PATCH` | `/orgs/{org_id}/preview-warning` | [Update the preview warning setting](./organizations.md#update-the-preview-warning-setting) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/sso/connections` | [List single sign-on connections](./organizations.md#list-single-sign-on-connections) | [organizations](./organizations.md) |
| `POST` | `/orgs/{org_id}/sso/setup-links` | [Create a single sign-on setup link](./organizations.md#create-a-single-sign-on-setup-link) | [organizations](./organizations.md) |
| `GET` | `/orgs/{org_id}/projects` | [List organization projects](./projects.md#list-organization-projects) | [projects](./projects.md) |
| `POST` | `/orgs/{org_id}/projects` | [Create a project](./projects.md#create-a-project) | [projects](./projects.md) |
| `GET` | `/projects/{project_id}` | [Get a project](./projects.md#get-a-project) | [projects](./projects.md) |
| `PATCH` | `/projects/{project_id}` | [Update a project](./projects.md#update-a-project) | [projects](./projects.md) |
| `DELETE` | `/projects/{project_id}` | [Delete a project](./projects.md#delete-a-project) | [projects](./projects.md) |
| `GET` | `/projects/{project_id}/budget` | [Get the project budget](./projects.md#get-the-project-budget) | [projects](./projects.md) |
| `PUT` | `/projects/{project_id}/budget` | [Set a project budget](./projects.md#set-a-project-budget) | [projects](./projects.md) |
| `DELETE` | `/projects/{project_id}/budget` | [Reset a project budget](./projects.md#reset-a-project-budget) | [projects](./projects.md) |
| `GET` | `/projects/{project_id}/lifecycle-policy` | [Get the project lifecycle policy](./projects.md#get-the-project-lifecycle-policy) | [projects](./projects.md) |
| `PATCH` | `/projects/{project_id}/lifecycle-policy` | [Update a project lifecycle policy](./projects.md#update-a-project-lifecycle-policy) | [projects](./projects.md) |
| `GET` | `/projects/{project_id}/limits` | [Get the project limits](./projects.md#get-the-project-limits) | [projects](./projects.md) |
| `PATCH` | `/projects/{project_id}/limits` | [Update the project limits](./projects.md#update-the-project-limits) | [projects](./projects.md) |
| `GET` | `/projects/{project_id}/members` | [List project members](./projects.md#list-project-members) | [projects](./projects.md) |
| `POST` | `/projects/{project_id}/members` | [Add project members](./projects.md#add-project-members) | [projects](./projects.md) |
| `DELETE` | `/projects/{project_id}/members/{user_id}` | [Remove a project member](./projects.md#remove-a-project-member) | [projects](./projects.md) |
| `GET` | `/projects/{project_id}/service-accounts` | [List project service accounts](./projects.md#list-project-service-accounts) | [projects](./projects.md) |
| `POST` | `/projects/{project_id}/service-accounts` | [Add a project service account](./projects.md#add-a-project-service-account) | [projects](./projects.md) |
| `DELETE` | `/projects/{project_id}/service-accounts/{service_account_id}` | [Remove a project service account](./projects.md#remove-a-project-service-account) | [projects](./projects.md) |
| `GET` | `/orgs/{org_id}/roles` | [List organization roles](./roles.md#list-organization-roles) | [roles](./roles.md) |
| `POST` | `/orgs/{org_id}/roles` | [Create an organization role](./roles.md#create-an-organization-role) | [roles](./roles.md) |
| `GET` | `/orgs/{org_id}/roles/{role_id}` | [Get an organization role](./roles.md#get-an-organization-role) | [roles](./roles.md) |
| `PATCH` | `/orgs/{org_id}/roles/{role_id}` | [Update an organization role](./roles.md#update-an-organization-role) | [roles](./roles.md) |
| `DELETE` | `/orgs/{org_id}/roles/{role_id}` | [Delete an organization role](./roles.md#delete-an-organization-role) | [roles](./roles.md) |
| `POST` | `/orgs/{org_id}/roles/{role_id}/update-preview` | [Preview an organization role update](./roles.md#preview-an-organization-role-update) | [roles](./roles.md) |
| `GET` | `/permissions` | [List permissions](./roles.md#list-permissions) | [roles](./roles.md) |
| `GET` | `/roles` | [List roles](./roles.md#list-roles) | [roles](./roles.md) |
| `GET` | `/api-keys/current` | [Get the current project API key](./api-keys.md#get-the-current-project-api-key) | [api-keys](./api-keys.md) |
| `GET` | `/orgs/{org_id}/api-keys` | [List organization API keys](./api-keys.md#list-organization-api-keys) | [api-keys](./api-keys.md) |
| `POST` | `/orgs/{org_id}/api-keys` | [Create an organization API key](./api-keys.md#create-an-organization-api-key) | [api-keys](./api-keys.md) |
| `GET` | `/orgs/{org_id}/api-keys/current` | [Get the current organization API key](./api-keys.md#get-the-current-organization-api-key) | [api-keys](./api-keys.md) |
| `GET` | `/orgs/{org_id}/api-keys/{key_id}` | [Get an organization API key](./api-keys.md#get-an-organization-api-key) | [api-keys](./api-keys.md) |
| `DELETE` | `/orgs/{org_id}/api-keys/{key_id}` | [Revoke an organization API key](./api-keys.md#revoke-an-organization-api-key) | [api-keys](./api-keys.md) |
| `GET` | `/projects/{project_id}/api-keys` | [List project API keys](./api-keys.md#list-project-api-keys) | [api-keys](./api-keys.md) |
| `POST` | `/projects/{project_id}/api-keys` | [Create a project API key](./api-keys.md#create-a-project-api-key) | [api-keys](./api-keys.md) |
| `GET` | `/projects/{project_id}/api-keys/{key_id}` | [Get a project API key](./api-keys.md#get-a-project-api-key) | [api-keys](./api-keys.md) |
| `PATCH` | `/projects/{project_id}/api-keys/{key_id}` | [Update a project API key](./api-keys.md#update-a-project-api-key) | [api-keys](./api-keys.md) |
| `DELETE` | `/projects/{project_id}/api-keys/{key_id}` | [Revoke a project API key](./api-keys.md#revoke-a-project-api-key) | [api-keys](./api-keys.md) |
| `GET` | `/orgs/{org_id}/service-accounts` | [List service accounts](./service-accounts.md#list-service-accounts) | [service-accounts](./service-accounts.md) |
| `POST` | `/orgs/{org_id}/service-accounts` | [Create a service account](./service-accounts.md#create-a-service-account) | [service-accounts](./service-accounts.md) |
| `GET` | `/orgs/{org_id}/service-accounts/{service_account_id}` | [Get a service account](./service-accounts.md#get-a-service-account) | [service-accounts](./service-accounts.md) |
| `PATCH` | `/orgs/{org_id}/service-accounts/{service_account_id}` | [Update a service account](./service-accounts.md#update-a-service-account) | [service-accounts](./service-accounts.md) |
| `DELETE` | `/orgs/{org_id}/service-accounts/{service_account_id}` | [Archive a service account](./service-accounts.md#archive-a-service-account) | [service-accounts](./service-accounts.md) |
| `POST` | `/orgs/{org_id}/service-accounts/{service_account_id}/update-preview` | [Preview a service account update](./service-accounts.md#preview-a-service-account-update) | [service-accounts](./service-accounts.md) |
| `GET` | `/orgs/{org_id}/billing/automatic-top-up` | [Get the automatic top-up](./billing.md#get-the-automatic-top-up) | [billing](./billing.md) |
| `PUT` | `/orgs/{org_id}/billing/automatic-top-up` | [Set the automatic top-up](./billing.md#set-the-automatic-top-up) | [billing](./billing.md) |
| `DELETE` | `/orgs/{org_id}/billing/automatic-top-up` | [Reset the automatic top-up](./billing.md#reset-the-automatic-top-up) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/balance-notification` | [Get the balance notification](./billing.md#get-the-balance-notification) | [billing](./billing.md) |
| `PUT` | `/orgs/{org_id}/billing/balance-notification` | [Set the balance notification](./billing.md#set-the-balance-notification) | [billing](./billing.md) |
| `DELETE` | `/orgs/{org_id}/billing/balance-notification` | [Reset the balance notification](./billing.md#reset-the-balance-notification) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/balances` | [List billing balances](./billing.md#list-billing-balances) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/charges` | [List billing charges](./billing.md#list-billing-charges) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/charges/{charge_id}/pdf` | [Get a charge receipt PDF](./billing.md#get-a-charge-receipt-pdf) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/contact` | [Get the billing contact](./billing.md#get-the-billing-contact) | [billing](./billing.md) |
| `PUT` | `/orgs/{org_id}/billing/contact` | [Set the billing contact](./billing.md#set-the-billing-contact) | [billing](./billing.md) |
| `POST` | `/orgs/{org_id}/billing/coupons/redeem` | [Redeem a billing coupon](./billing.md#redeem-a-billing-coupon) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/invoices` | [List billing invoices](./billing.md#list-billing-invoices) | [billing](./billing.md) |
| `POST` | `/orgs/{org_id}/billing/invoices/{invoice_id}/payment-sessions` | [Create an invoice payment session](./billing.md#create-an-invoice-payment-session) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/invoices/{invoice_id}/pdf` | [Get an invoice PDF](./billing.md#get-an-invoice-pdf) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/msa` | [Get the organization's MSA](./billing.md#get-the-organizations-msa) | [billing](./billing.md) |
| `POST` | `/orgs/{org_id}/billing/payment-method-sessions` | [Create a payment method session](./billing.md#create-a-payment-method-session) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/payment-methods` | [List billing payment methods](./billing.md#list-billing-payment-methods) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/plan` | [Get the billing plan](./billing.md#get-the-billing-plan) | [billing](./billing.md) |
| `PUT` | `/orgs/{org_id}/billing/plan` | [Set the billing plan](./billing.md#set-the-billing-plan) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/plans` | [List billing plans](./billing.md#list-billing-plans) | [billing](./billing.md) |
| `POST` | `/orgs/{org_id}/billing/portal-sessions` | [Create a billing portal session](./billing.md#create-a-billing-portal-session) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/profile` | [Get the billing profile](./billing.md#get-the-billing-profile) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/region-multipliers` | [List region price multipliers](./billing.md#list-region-price-multipliers) | [billing](./billing.md) |
| `POST` | `/orgs/{org_id}/billing/top-up-sessions` | [Create a top-up session](./billing.md#create-a-top-up-session) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/usage-periods` | [List billing usage periods](./billing.md#list-billing-usage-periods) | [billing](./billing.md) |
| `GET` | `/orgs/{org_id}/billing/wallet` | [Get the billing wallet](./billing.md#get-the-billing-wallet) | [billing](./billing.md) |
| `GET` | `/audit/actions` | [List audit actions](./audit.md#list-audit-actions) | [audit](./audit.md) |
| `GET` | `/config` | [Get the runtime configuration](./system.md#get-the-runtime-configuration) | [system](./system.md) |
| `GET` | `/health` | [Get API health](./system.md#get-api-health) | [system](./system.md) |
| `POST` | `/auth/token` | [Exchange a sign-in token](./auth.md#exchange-a-sign-in-token) | [auth](./auth.md) |

## Toolbox API

The Toolbox API runs inside each sandbox and serves process, file system, git, and computer use operations. Requests go through the toolbox proxy: prefix each path with the `toolbox_proxy_url` field of the sandbox and the sandbox ID.

```bash
curl '{toolboxProxyUrl}/{sandboxId}/system/metrics' \
  --header "Authorization: Bearer $DAYTONA_API_KEY"
```

| Method | Path | Summary | Tag |
|--------|------|---------|-----|
| `GET` | `/info` | [Sandbox handshake](./toolbox-info.md#sandbox-handshake) | [info](./toolbox-info.md) |
| `GET` | `/version` | [Toolbox version](./toolbox-info.md#toolbox-version) | [info](./toolbox-info.md) |
| `POST` | `/env` | [Update future child-process environment](./toolbox-env.md#update-future-child-process-environment) | [env](./toolbox-env.md) |
| `GET` | `/processes` | [List processes](./toolbox-processes.md#list-processes) | [processes](./toolbox-processes.md) |
| `POST` | `/processes` | [Create a process](./toolbox-processes.md#create-a-process) | [processes](./toolbox-processes.md) |
| `GET` | `/processes/{id}` | [Get a process](./toolbox-processes.md#get-a-process) | [processes](./toolbox-processes.md) |
| `DELETE` | `/processes/{id}` | [Delete a process record](./toolbox-processes.md#delete-a-process-record) | [processes](./toolbox-processes.md) |
| `GET` | `/processes/{id}/attach` | [Attach a websocket to a process](./toolbox-processes.md#attach-a-websocket-to-a-process) | [processes](./toolbox-processes.md) |
| `GET` | `/processes/{id}/logs` | [Read process logs or follow them as SSE](./toolbox-processes.md#read-process-logs-or-follow-them-as-sse) | [processes](./toolbox-processes.md) |
| `POST` | `/processes/{id}/resize` | [Resize a PTY](./toolbox-processes.md#resize-a-pty) | [processes](./toolbox-processes.md) |
| `POST` | `/processes/{id}/signals` | [Signal a process](./toolbox-processes.md#signal-a-process) | [processes](./toolbox-processes.md) |
| `POST` | `/processes/{id}/stdin` | [Write process stdin](./toolbox-processes.md#write-process-stdin) | [processes](./toolbox-processes.md) |
| `GET` | `/processes/{id}/wait` | [Wait for process completion](./toolbox-processes.md#wait-for-process-completion) | [processes](./toolbox-processes.md) |
| `POST` | `/processes:kill` | [Kill every process with a tag](./toolbox-processes.md#kill-every-process-with-a-tag) | [processes](./toolbox-processes.md) |
| `GET` | `/sessions` | [List sessions](./toolbox-sessions.md#list-sessions) | [sessions](./toolbox-sessions.md) |
| `POST` | `/sessions` | [Create a session](./toolbox-sessions.md#create-a-session) | [sessions](./toolbox-sessions.md) |
| `GET` | `/sessions/{id}` | [Get a session](./toolbox-sessions.md#get-a-session) | [sessions](./toolbox-sessions.md) |
| `DELETE` | `/sessions/{id}` | [Delete a session](./toolbox-sessions.md#delete-a-session) | [sessions](./toolbox-sessions.md) |
| `GET` | `/files` | [List files](./toolbox-files.md#list-files) | [files](./toolbox-files.md) |
| `DELETE` | `/files` | [Delete a file or directory](./toolbox-files.md#delete-a-file-or-directory) | [files](./toolbox-files.md) |
| `POST` | `/files/bulk-download` | [Download many files](./toolbox-files.md#download-many-files) | [files](./toolbox-files.md) |
| `POST` | `/files/bulk-upload` | [Upload many files](./toolbox-files.md#upload-many-files) | [files](./toolbox-files.md) |
| `GET` | `/files/download` | [Download one file](./toolbox-files.md#download-one-file) | [files](./toolbox-files.md) |
| `GET` | `/files/find` | [Find text in files](./toolbox-files.md#find-text-in-files) | [files](./toolbox-files.md) |
| `POST` | `/files/folder` | [Create a folder](./toolbox-files.md#create-a-folder) | [files](./toolbox-files.md) |
| `GET` | `/files/info` | [Get file metadata](./toolbox-files.md#get-file-metadata) | [files](./toolbox-files.md) |
| `POST` | `/files/move` | [Move a file or directory](./toolbox-files.md#move-a-file-or-directory) | [files](./toolbox-files.md) |
| `POST` | `/files/permissions` | [Change permissions](./toolbox-files.md#change-permissions) | [files](./toolbox-files.md) |
| `POST` | `/files/replace` | [Replace text in files](./toolbox-files.md#replace-text-in-files) | [files](./toolbox-files.md) |
| `GET` | `/files/search` | [Search filenames](./toolbox-files.md#search-filenames) | [files](./toolbox-files.md) |
| `POST` | `/files/upload` | [Upload one file](./toolbox-files.md#upload-one-file) | [files](./toolbox-files.md) |
| `GET` | `/files/watch` | [Watch a directory](./toolbox-files.md#watch-a-directory) | [files](./toolbox-files.md) |
| `POST` | `/git/add` | [Stage files](./toolbox-git.md#stage-files) | [git](./toolbox-git.md) |
| `GET` | `/git/branches` | [List branches](./toolbox-git.md#list-branches) | [git](./toolbox-git.md) |
| `POST` | `/git/branches` | [Create a branch](./toolbox-git.md#create-a-branch) | [git](./toolbox-git.md) |
| `DELETE` | `/git/branches` | [Delete a branch](./toolbox-git.md#delete-a-branch) | [git](./toolbox-git.md) |
| `POST` | `/git/checkout` | [Switch branches](./toolbox-git.md#switch-branches) | [git](./toolbox-git.md) |
| `POST` | `/git/clone` | [Clone a repository](./toolbox-git.md#clone-a-repository) | [git](./toolbox-git.md) |
| `POST` | `/git/commit` | [Create a commit](./toolbox-git.md#create-a-commit) | [git](./toolbox-git.md) |
| `GET` | `/git/config` | [Read one git config key](./toolbox-git.md#read-one-git-config-key) | [git](./toolbox-git.md) |
| `POST` | `/git/config` | [Set one git config key](./toolbox-git.md#set-one-git-config-key) | [git](./toolbox-git.md) |
| `GET` | `/git/history` | [Read commit history](./toolbox-git.md#read-commit-history) | [git](./toolbox-git.md) |
| `POST` | `/git/init` | [Initialize a repository](./toolbox-git.md#initialize-a-repository) | [git](./toolbox-git.md) |
| `POST` | `/git/pull` | [Pull from a remote](./toolbox-git.md#pull-from-a-remote) | [git](./toolbox-git.md) |
| `POST` | `/git/push` | [Push a branch](./toolbox-git.md#push-a-branch) | [git](./toolbox-git.md) |
| `GET` | `/git/remotes` | [List remotes](./toolbox-git.md#list-remotes) | [git](./toolbox-git.md) |
| `POST` | `/git/remotes` | [Add a remote](./toolbox-git.md#add-a-remote) | [git](./toolbox-git.md) |
| `POST` | `/git/reset` | [Reset repository state](./toolbox-git.md#reset-repository-state) | [git](./toolbox-git.md) |
| `POST` | `/git/restore` | [Restore files](./toolbox-git.md#restore-files) | [git](./toolbox-git.md) |
| `GET` | `/git/status` | [Read repository status](./toolbox-git.md#read-repository-status) | [git](./toolbox-git.md) |
| `GET` | `/port` | [List listening ports](./toolbox-ports.md#list-listening-ports) | [ports](./toolbox-ports.md) |
| `GET` | `/port/{port}/in-use` | [Check whether a port is in use](./toolbox-ports.md#check-whether-a-port-is-in-use) | [ports](./toolbox-ports.md) |
| `GET` | `/system/metrics` | [Sample sandbox resource metrics](./toolbox-system.md#sample-sandbox-resource-metrics) | [system](./toolbox-system.md) |
| `POST` | `/volumes/{volumeId}/pull` | [Pull remote changes into an attached volume](./toolbox-volumes.md#pull-remote-changes-into-an-attached-volume) | [volumes](./toolbox-volumes.md) |
| `GET` | `/docker/status` | [Docker Engine status](./toolbox-docker.md#docker-engine-status) | [docker](./toolbox-docker.md) |
| `POST` | `/computeruse/a11y/find` | [Find accessibility nodes](./toolbox-computer-use.md#find-accessibility-nodes) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/a11y/node/focus` | [Focus an accessibility node](./toolbox-computer-use.md#focus-an-accessibility-node) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/a11y/node/invoke` | [Invoke an accessibility node](./toolbox-computer-use.md#invoke-an-accessibility-node) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/a11y/node/value` | [Set an accessibility node value](./toolbox-computer-use.md#set-an-accessibility-node-value) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/a11y/tree` | [Accessibility tree](./toolbox-computer-use.md#accessibility-tree) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/display/info` | [Display inventory](./toolbox-computer-use.md#display-inventory) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/display/windows` | [Window inventory](./toolbox-computer-use.md#window-inventory) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/keyboard/hotkey` | [Press a hotkey](./toolbox-computer-use.md#press-a-hotkey) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/keyboard/key` | [Press one key](./toolbox-computer-use.md#press-one-key) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/keyboard/type` | [Type text](./toolbox-computer-use.md#type-text) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/mouse/click` | [Click the mouse](./toolbox-computer-use.md#click-the-mouse) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/mouse/drag` | [Drag the mouse](./toolbox-computer-use.md#drag-the-mouse) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/mouse/move` | [Move the mouse](./toolbox-computer-use.md#move-the-mouse) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/mouse/position` | [Mouse position](./toolbox-computer-use.md#mouse-position) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/mouse/scroll` | [Scroll the mouse wheel](./toolbox-computer-use.md#scroll-the-mouse-wheel) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/process-status` | [Desktop process inventory](./toolbox-computer-use.md#desktop-process-inventory) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/process/{name}/errors` | [One desktop process stderr](./toolbox-computer-use.md#one-desktop-process-stderr) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/process/{name}/logs` | [One desktop process stdout](./toolbox-computer-use.md#one-desktop-process-stdout) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/process/{name}/restart` | [Restart one desktop process](./toolbox-computer-use.md#restart-one-desktop-process) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/process/{name}/status` | [One desktop process status](./toolbox-computer-use.md#one-desktop-process-status) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/recordings` | [List recordings](./toolbox-computer-use.md#list-recordings) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/recordings/start` | [Start a recording](./toolbox-computer-use.md#start-a-recording) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/recordings/stop` | [Stop a recording](./toolbox-computer-use.md#stop-a-recording) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/recordings/{id}` | [Get recording metadata](./toolbox-computer-use.md#get-recording-metadata) | [computer-use](./toolbox-computer-use.md) |
| `DELETE` | `/computeruse/recordings/{id}` | [Delete a recording](./toolbox-computer-use.md#delete-a-recording) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/recordings/{id}/download` | [Download a recording](./toolbox-computer-use.md#download-a-recording) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/restart` | [Restart the desktop](./toolbox-computer-use.md#restart-the-desktop) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/screenshot` | [Full screenshot](./toolbox-computer-use.md#full-screenshot) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/screenshot/compressed` | [Compressed full screenshot](./toolbox-computer-use.md#compressed-full-screenshot) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/screenshot/region` | [Region screenshot](./toolbox-computer-use.md#region-screenshot) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/screenshot/region/compressed` | [Compressed region screenshot](./toolbox-computer-use.md#compressed-region-screenshot) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/start` | [Start the desktop](./toolbox-computer-use.md#start-the-desktop) | [computer-use](./toolbox-computer-use.md) |
| `GET` | `/computeruse/status` | [Desktop status](./toolbox-computer-use.md#desktop-status) | [computer-use](./toolbox-computer-use.md) |
| `POST` | `/computeruse/stop` | [Stop the desktop](./toolbox-computer-use.md#stop-the-desktop) | [computer-use](./toolbox-computer-use.md) |
