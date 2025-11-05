# Authentication

By default Phoenix deploys with authentication disabled as you may be just trying Phoenix for the very first time or have Phoenix deployed in a VPC. However you might want to further protect access to your data via authentication. Below are the steps.

{% hint style="info" %}
Authentication will stop collecting traces and block all API access until API keys are created. For that reason we recommend scheduling some downtime if you have already deployed phoenix.
{% endhint %}

{% embed url="https://youtu.be/e9I2voaGuQE" %}

## Setup

To enable authentication on your Phoenix, you will have to set two environment variables:

<table><thead><tr><th width="198">Variable</th><th width="359">Description</th><th>Example Value</th></tr></thead><tbody><tr><td><strong>PHOENIX_ENABLE_AUTH</strong></td><td>Set to <code>True</code> to enable authentication on your platform</td><td><strong>True</strong> or <strong>False</strong></td></tr><tr><td><strong>PHOENIX_SECRET</strong></td><td>A long string value that is used to sign JWTs for your deployment. It should be a good mix of characters and numbers and should be kept in a secret store of some kind.</td><td><code>3413f9a7735bb780c6b8e4db7d946a492b64d26112a955cdea6a797f4c833593</code></td></tr></tbody></table>

The following environment variables are optional but recommended:

<table data-header-hidden data-full-width="false"><thead><tr><th width="300">Variable</th><th>Description</th></tr></thead><tbody><tr><td><strong>PHOENIX_USE_SECURE_COOKIES</strong></td><td>If set to <strong>True</strong>, access and refresh tokens will be stored in secure cookies. Defaults to <strong>False</strong>.</td></tr><tr><td><strong>PHOENIX_CSRF_TRUSTED_ORIGINS</strong></td><td>A comma-separated list of origins allowed to bypass Cross-Site Request Forgery (CSRF) protection. This setting is recommended when configuring OAuth2 clients or sending password reset emails. If this variable is left unspecified or contains no origins, CSRF protection will not be enabled. In such cases, when a request includes <code>origin</code> or <code>referer</code> headers, those values will not be validated.</td></tr></tbody></table>

Deploy Phoenix with the above environment variables set. You will know that you have setup authentication correctly if the UI navigates to to a login screen.

By default Phoenix will create an admin user account. To get started:

1. Log in as the admin user. The email should be **admin@localhost** and the password will be **admin**
2. Set a new password for admin. You will be prompted to set a new password. Use a sufficiently complex password and save it in a safe place.
3. Go to the settings page on the left nav and create your first system API key. This API key can be used to log traces, use the Phoenix client, and programmatically hit Phoenix's APIs. Store the system API key in a safe place.
4. In your application code, make sure to set the proper authentication headers with the system API key. Phoenix respects headers in the form of [bearer auth](https://swagger.io/docs/specification/authentication/bearer-authentication/), meaning that you should set the header in the form **Authorization: Bearer \<token>.** Note that if you are using the Phoenix Client or Phoenix Otel, you simply need to set the **PHOENIX\_API\_KEY** environment variable.

Re-deploy your application with the API key created above and you will see traces stream in as before.

{% hint style="warning" %}
Initial admin password: You can set the initial password via the `PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD` environment variable. It is only read on first startup when the default admin account is created; subsequent changes have no effect if the account already exists. If you need to change the admin password later, do so from the UI or via an admin password reset.

Docker example:

```bash
docker run \
  -e PHOENIX_ENABLE_AUTH=true \
  -e PHOENIX_SECRET=change-me-32chars-min1digit1lower \
  -e PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD='strong-admin-password' \
  -p 6006:6006 arizephoenix/phoenix:latest
```

Helm users can set `auth.defaultAdminPassword` or provide the secret key `PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD` in the chart's Secret.
{% endhint %}

## User Management

Users can be added and removed from a Phoenix instance with authentication enabled. Users have one of three roles: `admin`, `member`, or `viewer`. See permissions below to learn more about the permissions for each role.

Only admins can manage phoenix users. They can add, delete, and reset the passwords of other users. To manage users go to the `/settings` page.

## Permissions

This section outlines the specific actions that users can perform based on their assigned roles within the system: **Admin**, **Member**, and **Viewer**. The permission matrix is divided into two main categories:

* Mutations: Operations that allow users to create, update, or delete data within the system.
* Queries: Operations that enable users to retrieve or view data from the system.

### Mutations

Mutations are operations that enable users to create, update, or delete data within the system. This permission matrix ensures that only authorized roles can execute sensitive actions, such as managing users and API keys, while allowing members to perform essential account-related updates like changing their own passwords and usernames. Viewers have read-only access and cannot perform mutations.

{% hint style="info" %}
Neither an **Admin**, **Member**, nor **Viewer** is permitted to change email addresses.
{% endhint %}

<table><thead><tr><th>Action</th><th width="100" align="center">Admin</th><th width="100" align="center">Member</th><th width="100" align="center">Viewer</th></tr></thead><tbody><tr><td>Create User</td><td align="center">✅ Yes</td><td align="center">No</td><td align="center">No</td></tr><tr><td>Delete User</td><td align="center">✅ Yes</td><td align="center">No</td><td align="center">No</td></tr><tr><td>Change Own Password</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Change Other's Password</td><td align="center">✅ Yes</td><td align="center">No</td><td align="center">No</td></tr><tr><td>Change Own Username</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Change Other's Username</td><td align="center">✅ Yes</td><td align="center">No</td><td align="center">No</td></tr><tr><td>Create System API Keys</td><td align="center">✅ Yes</td><td align="center">No</td><td align="center">No</td></tr><tr><td>Delete System API Keys</td><td align="center">✅ Yes</td><td align="center">No</td><td align="center">No</td></tr><tr><td>Create Own User API Keys</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Delete Own User API Keys</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Delete Other's User API Keys</td><td align="center">✅ Yes</td><td align="center">No</td><td align="center">No</td></tr></tbody></table>

### Queries

Queries are operations that allow users to retrieve and view data from the system.

{% hint style="info" %}
This table only shows actions that a **Member** or **Viewer** is not permitted to do. Actions without restrictions (such as viewing traces, projects, datasets, etc.) are omitted.
{% endhint %}

<table><thead><tr><th>Action</th><th width="100" align="center">Admin</th><th width="100" align="center">Member</th><th width="100" align="center">Viewer</th></tr></thead><tbody><tr><td>List All System API Keys</td><td align="center">✅ Yes</td><td align="center">No</td><td align="center">No</td></tr><tr><td>List All User API Keys</td><td align="center">✅ Yes</td><td align="center">No</td><td align="center">No</td></tr><tr><td>List All Users</td><td align="center">✅ Yes</td><td align="center">No</td><td align="center">No</td></tr><tr><td>Fetch Other User's Info, e.g. emails</td><td align="center">✅ Yes</td><td align="center">No</td><td align="center">No</td></tr></tbody></table>

### REST API Permissions (v1/ endpoints)

For programmatic access via REST API endpoints (paths beginning with `/v1/`), permissions are determined by both the user's role and the HTTP method used:

<table><thead><tr><th>Endpoint Category</th><th width="120" align="center">Admin</th><th width="120" align="center">Member</th><th width="120" align="center">Viewer</th></tr></thead><tbody><tr><td><strong>GET requests</strong> (read operations)<br>Projects, datasets, experiments, prompts, spans, traces, annotations, annotation configs, evaluations</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td><strong>POST/PUT/DELETE requests</strong> (write operations)<br>Creating, updating, or deleting resources</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td><td align="center">❌ No<br>(403 Forbidden)</td></tr><tr><td><strong>User management endpoints</strong><br><code>GET /v1/users</code><br><code>POST /v1/users</code><br><code>DELETE /v1/users/{id}</code></td><td align="center">✅ Yes</td><td align="center">❌ No<br>(403 Forbidden)</td><td align="center">❌ No<br>(403 Forbidden)</td></tr><tr><td><strong>Project management endpoints</strong><br><code>PUT /v1/projects/{id}</code><br><code>DELETE /v1/projects/{id}</code></td><td align="center">✅ Yes</td><td align="center">❌ No<br>(403 Forbidden)</td><td align="center">❌ No<br>(403 Forbidden)</td></tr></tbody></table>

{% hint style="warning" %}
**Viewer role restrictions for REST API:**
* Viewers have **read-only access** to v1/ endpoints
* All GET requests are allowed (viewing projects, datasets, experiments, traces, spans, etc.)
* All write operations (POST, PUT, DELETE) return **403 Forbidden**
* User management and project CRUD operations are also blocked

**Examples of blocked operations for Viewers:**
* Creating datasets: `POST /v1/datasets/upload`
* Creating experiments: `POST /v1/datasets/{id}/experiments`
* Creating annotations: `POST /v1/span_annotations`
* Uploading traces: `POST /v1/traces`
* Deleting resources: `DELETE /v1/datasets/{id}`, `DELETE /v1/experiments/{id}`
{% endhint %}

## API Keys

There are two kinds of API keys in Phoenix: `system` and `user`.

### System Keys

System keys act on behalf of the system as a whole rather than any particular user. They can only be created by admins, are not meaningfully associated with the admin who creates them except for auditing purposes, and do not disappear if that admin is deleted. A system key would be the recommended kind of key to use in programmatic interactions with Phoenix that do not involve a user (e.g., automated flows querying our REST APIs).

### User Keys

User API keys are associated with and act on behalf of the user to which they are issued. That user has the ability to view and delete their own user keys, and if the user is deleted, so are all of their associated user keys. A user might create their own user key into order to run an experiment in a notebook, for example.

### Setting and Using API Keys with Environment Variables

Phoenix API keys can be set with the `PHOENIX_API_KEY` environment variable:

```bash
export PHOENIX_API_KEY=<SYSTEM-OR-USER-KEY>
```

If authentication is enabled on Phoenix, all interactions with the server need to include an `authorization` header. Phoenix will read the `PHOENIX_API_KEY` environment variable, and automatically include it as an `authorization` header. Interactions with Phoenix include:

* Using `phoenix.Client`
* Runing experiments
* Sending OpenInference traces (more details below)

### Sending OpenInference traces

API Keys also need to be included on OpenInference traces sent to the Phoenix server. If you've set the `PHOENIX_API_KEY` environment variable, the `phoenix.otel` module will automatically include an `authorization` header with the API key:

```python
from phoenix.otel import register

tracer_provider = register()
```

Alternatively, you can explicitly set the `authorization` header on the exporter if using OpenTelemetry primitives directly.

```python
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

endpoint = "http://127.0.0.1:6006/v1/traces"
tracer_provider = trace_sdk.TracerProvider()
exporter = OTLPSpanExporter(
    endpoint,
    headers={"authorization": "Bearer <SYSTEM-OR-USER-KEY>"},
)
tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
```

{% hint style="info" %}
If setting `authorization` headers explicitly, ensure that the header field is **lowercased** to ensure compatibility with sending traces via gRPC
{% endhint %}

## Password Recovery

{% hint style="info" %}
The password recovery methods described in this section apply when recovering a locally authenticated user's password. In order recover a password for a user logged in via a third-party identity provider such as Google, you will have to consult the documentation of these identity providers
{% endhint %}

### With SMTP (Simple Mail Transfer Protocol)

Using SMTP ensures that your password recovery emails are delivered reliably and securely. SMTP is the standard protocol for sending emails, making sure that you receive the reset link promptly in your inbox.\
\
Below is an example configuration to enable SMTP for `sendgrid`.

```properties
export PHOENIX_SMTP_HOSTNAME=smtp.sendgrid.net
export PHOENIX_SMTP_USERNAME=apikey
export PHOENIX_SMTP_PASSWORD=XXXXXXXXXXXXXXXXX
```

### Without SMTP

If SMTP is not configured, you have a few options to recover your forgotten password:

* Contact an administrator and request that they reset your password. Admins can reset user passwords on the `settings` page.
* As a last resort, you can manually update the database tuple that contains your password salt and hash.

## Configuring OAuth2 Identity Providers

Phoenix supports login via third-party identity providers (IDPs), including:

* Google
* [AWS Cognito](https://aws.amazon.com/cognito/)
* [Microsoft Entra ID](https://www.microsoft.com/en-us/security/business/identity-access/microsoft-entra-id) (previously known as Azure Active Directory)
* IDPs that support [OpenID Connect](https://openid.net/developers/how-connect-works/) and a [well-known configuration endpoint](https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfigurationRequest) at `GET /.well-known/openid-configuration`

{% hint style="info" %}
OAuth2 enables applications such as Phoenix to authorize access to resources via identity providers (IDPs) rather than storing and verifying user credentials locally. OpenID Connect is an extension of OAuth2 that additionally authenticates users by verifying identity and providing Phoenix with user information such as email address, username, etc. Phoenix integrates with OpenID Connect IDPs that have a "well-known configuration endpoint" at `GET /.well-known/openid-configuration`, which provides a standardized way to discover information about the IDP's endpoints and capabilities.
{% endhint %}

Phoenix uses the OAuth2 authorization code flow for web applications, which requires setting a few environment variables in addition to `PHOENIX_ENABLE_AUTH` and `PHOENIX_SECRET`:

<table data-full-width="false"><thead><tr><th width="220">Environment Variable</th><th>Description</th></tr></thead><tbody><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_CLIENT_ID</strong></td><td>The client ID generated by the IDP when registering the application. (Required)</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_CLIENT_SECRET</strong></td><td>The client secret generated by the IDP when registering the application. Required by default for confidential clients. Only optional when <code>TOKEN_ENDPOINT_AUTH_METHOD</code> is explicitly set to <code>none</code> (for public clients without client authentication).</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_OIDC_CONFIG_URL</strong></td><td>The URL to the OpenID Connect well-known configuration endpoint. Entering this URL in your browser will return a JSON object containing authorization server metadata. Must be HTTPS except for localhost. (Required)</td></tr></tbody></table>

### Optional OAuth2 Configuration

The following optional environment variables provide additional control over OAuth2 authentication behavior:

<table data-full-width="false"><thead><tr><th width="220">Environment Variable</th><th>Description</th></tr></thead><tbody><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_DISPLAY_NAME</strong></td><td>A user-friendly name for the identity provider shown in the UI. If not set, Phoenix will generate a display name based on the IDP identifier.</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_ALLOW_SIGN_UP</strong></td><td>Whether to allow new user registration via this OAuth2 provider. Defaults to <code>True</code>. When set to <code>False</code>, only existing users can sign in. The system will check if the user exists in the database by their email address. If the user does not exist or has a password set (local auth), they will be redirected to the login page with an error message.</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_AUTO_LOGIN</strong></td><td>Automatically redirect to this provider's login page, skipping the Phoenix login screen. Defaults to <code>False</code>. Useful for single sign-on deployments. Note: Only one provider should have <code>AUTO_LOGIN</code> enabled if you configure multiple IDPs.</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_USE_PKCE</strong></td><td>Enable PKCE (Proof Key for Code Exchange) with S256 code challenge method for enhanced security. PKCE protects the authorization code from interception and can be used with both public clients and confidential clients. This setting is orthogonal to client authentication—whether <code>CLIENT_SECRET</code> is required is determined solely by <code>TOKEN_ENDPOINT_AUTH_METHOD</code>, not by <code>USE_PKCE</code>. Defaults to <code>False</code>.</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_TOKEN_ENDPOINT_AUTH_METHOD</strong></td><td>OAuth2 token endpoint authentication method. This setting determines how the client authenticates with the token endpoint and whether <code>CLIENT_SECRET</code> is required. If not set, defaults to requiring <code>CLIENT_SECRET</code> (confidential client). Options: <br>• <code>client_secret_basic</code>: Send credentials in HTTP Basic Auth header (most common). <code>CLIENT_SECRET</code> is required. This is the assumed default behavior if not set.<br>• <code>client_secret_post</code>: Send credentials in POST body (required by some providers). <code>CLIENT_SECRET</code> is required.<br>• <code>none</code>: No client authentication (for public clients). <code>CLIENT_SECRET</code> is not required. Use this for public clients that cannot securely store a client secret, typically in combination with PKCE.<br><br>Most providers work with the default behavior. Set this explicitly only if your provider requires a specific method or if you're configuring a public client.</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_SCOPES</strong></td><td>Additional OAuth2 scopes to request (space-separated). These are added to the required baseline scopes <code>openid email profile</code>. For example, set to <code>offline_access groups</code> to request refresh tokens and group information. The baseline scopes are always included and cannot be removed.</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_GROUPS_ATTRIBUTE_PATH</strong></td><td>JMESPath expression to extract group/role claims from the OIDC ID token or userinfo endpoint response. The path navigates nested JSON structures to find group/role information. This claim is checked from both the ID token and userinfo endpoint (if available). The result is normalized to a list of strings for group matching. See <a href="https://jmespath.org">jmespath.org</a> for full syntax.<br><br><strong>⚠️ IMPORTANT:</strong> Claim keys with special characters (colons, dots, slashes, hyphens, etc.) MUST be enclosed in double quotes.<br><br>Common JMESPath patterns:<br>• Simple keys: <code>groups</code> - extracts top-level array<br>• Nested keys: <code>resource_access.phoenix.roles</code> - dot notation for nested objects<br>• Array projection: <code>teams[*].name</code> - extracts 'name' field from each object in array<br>• Array indexing: <code>groups[0]</code> - gets first element<br><br>Common provider examples:<br>• Google Workspace: <code>groups</code><br>• Azure AD/Entra ID: <code>roles</code> or <code>groups</code><br>• Keycloak: <code>resource_access.phoenix.roles</code> (nested structure)<br>• AWS Cognito: <code>"cognito:groups"</code> (use quotes for colon)<br>• Okta: <code>groups</code><br>• Auth0 (custom namespace): <code>"https://myapp.com/groups"</code> (use quotes for special chars)<br>• Custom objects: <code>teams[*].name</code> (extract field from array of objects)<br><br>If not set, group-based access control is disabled for this provider.</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_ALLOWED_GROUPS</strong></td><td>Comma-separated list of group names that are permitted to sign in. Users must belong to at least one of these groups (extracted via <code>GROUPS_ATTRIBUTE_PATH</code>) to authenticate successfully. Works together with <code>GROUPS_ATTRIBUTE_PATH</code> to implement group-based access control. If not set, all authenticated users can sign in (subject to <code>ALLOW_SIGN_UP</code> restrictions).<br><br>Example: <code>PHOENIX_OAUTH2_OKTA_ALLOWED_GROUPS="admin,developers,viewers"</code><br><br>Note: Both <code>GROUPS_ATTRIBUTE_PATH</code> and <code>ALLOWED_GROUPS</code> must be configured together. If one is set, the other is required.</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_ROLE_ATTRIBUTE_PATH</strong></td><td>JMESPath expression to extract user role claim from the OIDC ID token or userinfo endpoint response. Similar to <code>GROUPS_ATTRIBUTE_PATH</code> but for extracting a single role value. See <a href="https://jmespath.org">jmespath.org</a> for full syntax.<br><br><strong>⚠️ IMPORTANT:</strong> Claim keys with special characters MUST be enclosed in double quotes.<br>Examples: <code>"https://myapp.com/role"</code>, <code>"custom:role"</code>, <code>user.profile."app-role"</code><br><br>Common patterns:<br>• Simple key: <code>role</code> - extracts top-level string<br>• Nested key: <code>user.organization.role</code> - dot notation for nested objects<br>• Array element: <code>roles[0]</code> - gets first role from array<br>• Constant value: <code>'MEMBER'</code> - assigns a fixed role to all users from this IDP (no mapping needed)<br>• Conditional logic: <code>contains(groups[*], 'admin') &amp;&amp; 'ADMIN' || 'VIEWER'</code> - compute role from group membership using logical operators (returns Phoenix role directly, no mapping needed)<br><br>This claim is used with <code>ROLE_MAPPING</code> to automatically assign Phoenix roles (ADMIN, MEMBER, VIEWER) based on the user's role in your identity provider. The extracted role value is matched against keys in <code>ROLE_MAPPING</code> to determine the Phoenix role.<br><br><strong>Advanced:</strong> If the JMESPath expression returns a valid Phoenix role name (ADMIN, MEMBER, VIEWER) directly, <code>ROLE_MAPPING</code> is optional - the value will be used as-is after case-insensitive validation.<br><br><strong>⚠️ Role Update Behavior:</strong><br>• When <code>ROLE_ATTRIBUTE_PATH</code> IS configured: User roles are synchronized from the IDP on EVERY login. This ensures Phoenix roles stay in sync with your IDP's role assignments.<br>• When <code>ROLE_ATTRIBUTE_PATH</code> is NOT configured: User roles are preserved as-is (backward compatibility). New users get VIEWER role (least privilege), existing users keep their current roles.</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_ROLE_MAPPING</strong></td><td>Maps identity provider role values to Phoenix roles. Format: <code>IdpRole1:PhoenixRole1,IdpRole2:PhoenixRole2</code><br><br>Phoenix roles (case-insensitive):<br>• <strong>ADMIN</strong>: Full system access, can manage users and settings<br>• <strong>MEMBER</strong>: Standard user access, can create and manage own resources<br>• <strong>VIEWER</strong>: Read-only access, cannot create or modify resources<br><br>Example mappings:<br>• <code>PHOENIX_OAUTH2_OKTA_ROLE_MAPPING="Owner:ADMIN,Developer:MEMBER,Guest:VIEWER"</code><br>• <code>PHOENIX_OAUTH2_KEYCLOAK_ROLE_MAPPING="admin:ADMIN,user:MEMBER"</code><br><br><strong>⚠️ Security:</strong> The SYSTEM role cannot be assigned via OAuth2. Attempts to map to SYSTEM will be rejected.<br><br><strong>Optional Behavior (no mapping required):</strong><br>If <code>ROLE_MAPPING</code> is not configured but <code>ROLE_ATTRIBUTE_PATH</code> is set, the system will use the IDP role value directly if it exactly matches "ADMIN", "MEMBER", or "VIEWER" (case-insensitive). This allows IDPs that already use Phoenix's role names to work without explicit mapping.<br><br>IDP role keys are case-sensitive and must match exactly. Phoenix role values are case-insensitive but will be normalized to uppercase (ADMIN, MEMBER, VIEWER). If a user's IDP role is not in the mapping, behavior depends on <code>ROLE_ATTRIBUTE_STRICT</code>:<br>• strict=false (default): User gets VIEWER role (least privilege)<br>• strict=true: User is denied access<br><br>Works together with <code>ROLE_ATTRIBUTE_PATH</code>. If <code>ROLE_ATTRIBUTE_PATH</code> is set but <code>ROLE_MAPPING</code> is not, the IDP role value is used directly if it matches a valid Phoenix role (ADMIN, MEMBER, VIEWER). If the IDP role doesn't match a valid Phoenix role, behavior depends on <code>ROLE_ATTRIBUTE_STRICT</code>.</td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_ROLE_ATTRIBUTE_STRICT</strong></td><td>Controls behavior when role cannot be determined from identity provider claims. Defaults to <code>false</code>.<br><br>When <code>true</code>:<br>• Missing role claim → access denied<br>• Role not in ROLE_MAPPING → access denied<br>• Empty/invalid role value → access denied<br><br>When <code>false</code> (default):<br>• Missing/unmapped/invalid role → user gets VIEWER role (least privilege, fail-safe)<br><br>Strict mode is recommended for high-security environments where all users must have explicitly assigned roles. Non-strict mode (default) is more forgiving and suitable for gradual rollout of role mapping.<br><br>Example: <code>PHOENIX_OAUTH2_OKTA_ROLE_ATTRIBUTE_STRICT=true</code><br><br>Note: This setting only applies when <code>ROLE_ATTRIBUTE_PATH</code> is configured. If <code>ROLE_ATTRIBUTE_PATH</code> is not set, this setting is ignored.</td></tr></tbody></table>

{% hint style="warning" %}
**Group-based access control requirements:**
* If you set `ALLOWED_GROUPS`, you must also set `GROUPS_ATTRIBUTE_PATH` to extract groups from the ID token.
* If you set `GROUPS_ATTRIBUTE_PATH`, you must also set `ALLOWED_GROUPS` to specify which groups are allowed.
* Group-based access control is evaluated per-provider: if a user authenticates via an IDP with `ALLOWED_GROUPS` configured, they must belong to one of those groups to sign in.

**Role mapping configuration:**
* `ROLE_ATTRIBUTE_PATH` and `ROLE_MAPPING` work together to automatically assign Phoenix roles based on IDP roles.
* If `ROLE_ATTRIBUTE_PATH` is configured, user roles are synchronized from the IDP on every login.
* If `ROLE_ATTRIBUTE_PATH` is not configured, new OAuth2 users get the VIEWER role by default and existing users keep their current roles.
* Groups control **access** (who can sign in), while roles control **permissions** (what users can do).
{% endhint %}

### Multiple Identity Providers

You can configure multiple IDPs simultaneously by setting environment variables for each provider with different IDP identifiers. Users will see all configured providers as login options on the Phoenix login page. Each IDP is configured independently with its own set of variables.

Example with both Google and Okta:

```bash
# Google OAuth
export PHOENIX_OAUTH2_GOOGLE_CLIENT_ID=google_client_id
export PHOENIX_OAUTH2_GOOGLE_CLIENT_SECRET=google_secret
export PHOENIX_OAUTH2_GOOGLE_OIDC_CONFIG_URL=https://accounts.google.com/.well-known/openid-configuration

# Internal Okta with group restrictions
export PHOENIX_OAUTH2_OKTA_CLIENT_ID=okta_client_id
export PHOENIX_OAUTH2_OKTA_CLIENT_SECRET=okta_secret
export PHOENIX_OAUTH2_OKTA_OIDC_CONFIG_URL=https://your-domain.okta.com/.well-known/openid-configuration
export PHOENIX_OAUTH2_OKTA_GROUPS_ATTRIBUTE_PATH=groups
export PHOENIX_OAUTH2_OKTA_ALLOWED_GROUPS="engineering,platform-team"
```

### Common OAuth2 Configuration Examples

**Public client with PKCE (no client secret):**

```bash
export PHOENIX_OAUTH2_MOBILE_CLIENT_ID=mobile_app_id
export PHOENIX_OAUTH2_MOBILE_OIDC_CONFIG_URL=https://auth.example.com/.well-known/openid-configuration
export PHOENIX_OAUTH2_MOBILE_TOKEN_ENDPOINT_AUTH_METHOD=none
export PHOENIX_OAUTH2_MOBILE_USE_PKCE=true
```

**With nested group path (Keycloak):**

```bash
export PHOENIX_OAUTH2_KEYCLOAK_GROUPS_ATTRIBUTE_PATH=resource_access.phoenix.roles
export PHOENIX_OAUTH2_KEYCLOAK_ALLOWED_GROUPS="admin,developer"
```

**With special characters in path (AWS Cognito - quotes REQUIRED):**

```bash
export PHOENIX_OAUTH2_COGNITO_GROUPS_ATTRIBUTE_PATH='"cognito:groups"'
export PHOENIX_OAUTH2_COGNITO_ALLOWED_GROUPS="Administrators,PowerUsers"
```

**With namespaced claims (Auth0 - quotes REQUIRED):**

```bash
export PHOENIX_OAUTH2_AUTH0_GROUPS_ATTRIBUTE_PATH='"https://myapp.com/groups"'
export PHOENIX_OAUTH2_AUTH0_ALLOWED_GROUPS="admin,users"
```

**With array projection (extract names from objects):**

```bash
export PHOENIX_OAUTH2_CUSTOM_GROUPS_ATTRIBUTE_PATH="teams[*].name"
export PHOENIX_OAUTH2_CUSTOM_ALLOWED_GROUPS="engineering,operations"
```

**Single sign-on with auto-login:**

```bash
export PHOENIX_OAUTH2_COMPANY_DISPLAY_NAME="Company SSO"
export PHOENIX_OAUTH2_COMPANY_AUTO_LOGIN=true
export PHOENIX_OAUTH2_COMPANY_ALLOW_SIGN_UP=false
```

**With role mapping (simple):**

```bash
export PHOENIX_OAUTH2_OKTA_ROLE_ATTRIBUTE_PATH=role
export PHOENIX_OAUTH2_OKTA_ROLE_MAPPING="Owner:ADMIN,Developer:MEMBER,Viewer:VIEWER"
```

**With role mapping (nested path for Keycloak):**

```bash
export PHOENIX_OAUTH2_KEYCLOAK_ROLE_ATTRIBUTE_PATH=resource_access.phoenix.role
export PHOENIX_OAUTH2_KEYCLOAK_ROLE_MAPPING="admin:ADMIN,user:MEMBER"
```

**With role mapping in strict mode (deny unmapped roles):**

```bash
export PHOENIX_OAUTH2_OKTA_ROLE_ATTRIBUTE_PATH=role
export PHOENIX_OAUTH2_OKTA_ROLE_MAPPING="Owner:ADMIN,Developer:MEMBER"
export PHOENIX_OAUTH2_OKTA_ROLE_ATTRIBUTE_STRICT=true
```

**With conditional logic to compute role from groups (no mapping needed):**

```bash
export PHOENIX_OAUTH2_OKTA_ROLE_ATTRIBUTE_PATH="contains(groups[*], 'admin') && 'ADMIN' || contains(groups[*], 'editor') && 'MEMBER' || 'VIEWER'"
```

**With both groups and roles (groups control access, roles control permissions):**

```bash
export PHOENIX_OAUTH2_OKTA_GROUPS_ATTRIBUTE_PATH=groups
export PHOENIX_OAUTH2_OKTA_ALLOWED_GROUPS="engineering,platform-team"
export PHOENIX_OAUTH2_OKTA_ROLE_ATTRIBUTE_PATH=role
export PHOENIX_OAUTH2_OKTA_ROLE_MAPPING="Owner:ADMIN,Developer:MEMBER,Guest:VIEWER"
```

{% hint style="info" %}
**Default role behavior:**
* If `ROLE_ATTRIBUTE_PATH` is **not configured**: New OAuth2 users are initially added as VIEWER (least privilege). Their role can be changed after their first login by a Phoenix admin. Existing users keep their current roles.
* If `ROLE_ATTRIBUTE_PATH` **is configured**: User roles are automatically synchronized from the IDP on every login based on the role mapping configuration.
{% endhint %}

Detailed instructions for common IDPs are provided below.

### Google

1. In Google Cloud Console, select a GCP project in which to register your Phoenix OAuth2 app.
2. Select **APIs and Services**.
3. In the **Credentials** page, click on **Create Credentials** and select **OAuth Client ID**.
4. From the **Application type** dropdown, select **Web application**.
5. Enter a name for your Phoenix app, which will be displayed to users when signing in.
6. Under **Authorized JavaScript origins**, click **Add URI** and enter the origin URL where you will access Phoenix in the browser.
7. Under **Authorized redirect URIs**, click **Add URI**. Take the URL from the previous step and append the slug `/oauth2/google/tokens`. Alternatively, if you have configured a root path via the `PHOENIX_HOST_ROOT_PATH` environment variable, append a slug of the form `/<root-path>/oauth2/google/tokens`. Enter the resulting URL.
8. Copy your client ID and client secret.
9. Deploy Phoenix with the three environment variables described above, substituting `GOOGLE` for `<IDP>`. The well-known configuration endpoint is `https://accounts.google.com/.well-known/openid-configuration`.

### AWS Cognito

1. In the AWS Management Console, navigate to the **Cognito** page.
2. From the **User Pools** page, select **Create User Pool**.
3. Under **Required attributes**, in the **Additional required attributes** dropdown, select **email** (you can optionally require **name** and **picture** to ensure user profiles have this information in Phoenix).
4. In the **Initial app client** section:
   1. Under **App type**, select **Confidential client**.
   2. Under **App client name**, enter a name for your Phoenix app.
   3. Under **Client secret**, ensure **Generate a client secret** is selected.
5. Create your user pool and navigate to the page for the newly created user pool by clicking on its name.
6. Add at least one user to your user pool in the **Users** section.
7. Copy and save your user pool ID from the top of the page. The ID should be of the form `<region>_<hash>`, e.g., `us-east-2_x4FTon498`.
8. Under **App Integration > Domain**, create a domain to contain the sign-in page and OAuth2 endpoints.
9. Under **App Integration > App client list > App clients and analytics**, select your newly created client.
10. Copy and save your client ID and client secret.
11. Under **Hosted UI**, click **Edit**. On the **Edit Hosted UI** page:
    1. Add an **Allowed callback URL** of the form `<origin-url>/oauth2/aws_cognito/tokens`, where `<origin-url>` is the URL where you will access Phoenix in the browser. Alternatively, if you have configured a root path via the `PHOENIX_HOST_ROOT_PATH` environment variable, your callback URL will have the form `<origin-url>/<root-path>/oauth2/aws_cognito/tokens`.
    2. In the **Identity Providers** dropdown, select **Cognito user pool**.
    3. Under **OAuth 2.0 grant types**, select **Authorization code grant**.
    4. Under **OpenID Connect scopes**, select **OpenID**, **Email**, and **Profile**.
    5. Save your changes.
12. The well-known configuration endpoint is of the form `https://cognito-idp.<region>.amazonaws.com/<user-pool-id>/.well-known/openid-configuration`, where the user pool ID was copied in a previous step and the region is the first part of the user pool ID preceding the underscore. Test this URL in your browser to ensure it is correct before proceeding to the next step.
13. Deploy Phoenix using the three environment variables described above, substituting `AWS_COGNITO` for `<IDP>`.

### Microsoft Entra ID

1. From the Azure portal, navigate to **Microsoft Entra ID**.
2. Select **Add > App Registration**.
3. On the **Register an Application** page:
   1. Enter a name for your application.
   2. Under **Redirect URI**, in the **Select a platform** dropdown, select **Web** and a redirect URI of the form `<origin-url>/oauth2/microsoft_entra_id/tokens`, where `<origin-url>` is the URL where you will access Phoenix in the browser. Alternatively, if you have configured a root path via the `PHOENIX_HOST_ROOT_PATH` environment variable, your redirect URI will have the form `<origin-url>/<root-path>/oauth2/microsoft_entra_id/tokens`.
4. Copy and save the **Application (client) ID**.
5. Under **Endpoints**, copy and save the well-known configuration endpoint under **OpenID Connect metadata document**.
6. Under **Client credentials**, click **Add a certificate or secret**. Create a client secret and copy and save its value.
7. Deploy Phoenix using the three environment variables described above, substituting `MICROSOFT_ENTRA_ID` for `<IDP>`.

### Keycloak

1. From the Keycloak Console create a **new Realm** or skip this part if you want to reuse a existing Realm
2. Select **Clients**.
3. Click on **new Client**
   1. Enter the **Client ID** phoenix
   2. Enter the **Name** Phoenix Client
   3. Enter below **Root URL** the root url of your phoenix instance, like `https://example.com/subpath/subpath`
   4. Enter below **Home URL** the home url of your phoenix instance, like `/subpath/subpath`
   5. Enter below **Valid redirect URIs** a redirect url to your phoenix instance, like `https://example.com/subpath/subpath/*`
   6. Enter below **Valid post logout redirect URIs** +
   7. Enter below **Web origins** your url, like `https://example.com`
   8. Enter below **Admin URL** your admin url, like `https://example.com/subpath/subpath/`
   9. Enable **Client authentication**
   10. Ensure that only **Standard flow** and **Direct access grants** is enabled
   11. Hit the **Save button**
4. Go to the Client **phoenix** and to the tab credentials and copy the **client-secret**
5. Deploy Phoenix using the three environment variables described above, substituting `KEYCLOAK` for `<IDP>`.
   1. PHOENIX\_OAUTH2\_KEYCLOAK\_CLIENT\_ID=""
   2. PHOENIX\_OAUTH2\_KEYCLOAK\_OIDC\_CONFIG\_URL="https:////**realms**//**.well-known/openid-configuration**"
   3. PHOENIX\_OAUTH2\_KEYCLOAK\_CLIENT\_SECRET=""

### Other Identity Providers

Phoenix can integrate with any OAuth2 IDP that supports OpenID Connect and has a well-known configuration endpoint. Detailed instructions will vary by IDP, but the general steps remain the same:

1. Register a Phoenix client application with your IDP. If prompted to select an application type, select **traditional web application** or a similarly named application type that allows you to generate a client secret in addition to a client ID.
2. Find the well-known configuration endpoint for your IDP.
3. Deploy Phoenix with the environment variables described above, substituting `<IDP>` with your IDP name, e.g., `AUTH0`. If you have configured a root path via the `PHOENIX_HOST_ROOT_PATH` environment variable, ensure that the root path is included in the path of your callback URL.
4. Use the optional configuration variables documented above to customize behavior such as display names, sign-up policies, group-based access control, and more.

## Advanced Authentication Configuration

The following optional environment variables provide additional control over authentication behavior for advanced use cases:

<table data-full-width="false"><thead><tr><th width="220">Variable</th><th>Description</th></tr></thead><tbody><tr><td><strong>PHOENIX_ADMIN_SECRET</strong></td><td>A secret key that can be used as a bearer token instead of an API key. It authenticates as the first system user (admin). This key must be at least 32 characters long, include at least one digit and one lowercase letter, and must be different from <code>PHOENIX_SECRET</code>. Additionally, it must not be set if <code>PHOENIX_SECRET</code> is not configured.<br><br>Usage: <code>Authorization: Bearer &lt;PHOENIX_ADMIN_SECRET&gt;</code></td></tr><tr><td><strong>PHOENIX_DISABLE_BASIC_AUTH</strong></td><td>Forbid login via password and disable the creation of local users, which log in via passwords. This can be helpful in setups where authentication is handled entirely through OAuth2. Defaults to <code>False</code>.</td></tr><tr><td><strong>PHOENIX_DISABLE_RATE_LIMIT</strong></td><td>Disable rate limiting for login attempts. Defaults to <code>False</code>. Use with caution as this removes brute-force protection.</td></tr><tr><td><strong>PHOENIX_ACCESS_TOKEN_EXPIRY_MINUTES</strong></td><td>The duration, in minutes, before access tokens expire. Defaults to the system default if not specified.</td></tr><tr><td><strong>PHOENIX_REFRESH_TOKEN_EXPIRY_MINUTES</strong></td><td>The duration, in minutes, before refresh tokens expire. Defaults to the system default if not specified.</td></tr><tr><td><strong>PHOENIX_PASSWORD_RESET_TOKEN_EXPIRY_MINUTES</strong></td><td>The duration, in minutes, before password reset tokens expire. Defaults to the system default if not specified.</td></tr><tr><td><strong>PHOENIX_ADMINS</strong></td><td>A semicolon-separated list of username and email address pairs to create as admin users on startup. The format is <code>username=email</code>, e.g., <code>John Doe=john@example.com;Doe, Jane=jane@example.com</code>. The password for each user will be randomly generated and will need to be reset. The application will not start if this environment variable is set but cannot be parsed or contains invalid emails. If the username or email address already exists in the database, the user record will not be modified. Changing this environment variable for the next startup will not undo any records created in previous startups.</td></tr><tr><td><strong>PHOENIX_ROOT_URL</strong></td><td>This is the full URL used to access Phoenix from a web browser. This setting is important when you have a reverse proxy in front of Phoenix. If the reverse proxy exposes Phoenix through a sub-path, add that sub-path to the end of this URL setting.<br><br><strong>⚠️ WARNING:</strong> When a sub-path is needed, you must also specify the sub-path via the environment variable <code>PHOENIX_HOST_ROOT_PATH</code>. Setting just this URL setting is not enough.<br><br>Examples:<br>• With a sub-path: <code>https://example.com/phoenix</code><br>• Without a sub-path: <code>https://phoenix.example.com</code></td></tr><tr><td><strong>PHOENIX_MANAGEMENT_URL</strong></td><td>The URL to use for redirecting to a management interface that may be hosting Phoenix. If set, and the current user is within <code>PHOENIX_ADMINS</code>, a link will be added to the navigation menu to return to this URL.</td></tr></tbody></table>
