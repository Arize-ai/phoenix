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

<table data-header-hidden data-full-width="false"><thead><tr><th>Variable</th><th>Description</th></tr></thead><tbody><tr><td><strong>PHOENIX_USE_SECURE_COOKIES</strong></td><td>If set to <strong>True</strong>, access and refresh tokens will be stored in secure cookies. Defaults to <strong>False</strong>.</td></tr><tr><td><strong>PHOENIX_CSRF_TRUSTED_ORIGINS</strong></td><td>A comma-separated list of origins allowed to bypass Cross-Site Request Forgery (CSRF) protection. This setting is recommended when configuring OAuth2 clients or sending password reset emails. If this variable is left unspecified or contains no origins, CSRF protection will not be enabled. In such cases, when a request includes <code>origin</code> or <code>referer</code> headers, those values will not be validated.</td></tr></tbody></table>

Deploy Phoenix with the above environment variables set. You will know that you have setup authentication correctly if the UI navigates to to a login screen.

By default Phoenix will create an admin user account. To get started:

1. Log in as the admin user. The email should be **admin@localhost** and the password will be **admin**
2. Set a new password for admin. You will be prompted to set a new password. Use a sufficiently complex password and save it in a safe place.
3. Go to the settings page on the left nav and create your first system API key. This API key can be used to log traces, use the Phoenix client, and programmatically hit Phoenix's APIs. Store the system API key in a safe place.
4. In your application code, make sure to set the proper authentication headers with the system API key. Phoenix respects headers in the form of [bearer auth](https://swagger.io/docs/specification/authentication/bearer-authentication/), meaning that you should set the header in the form **Authorization: Bearer \<token>.** Note that if you are using the Phoenix Client or Phoenix Otel, you simply need to set the **PHOENIX\_API\_KEY** environment variable.

Re-deploy your application with the API key created above and you will see traces stream in as before.

The following environment variables are optional but recommended:

## User Management

Users can be added and removed from a Phoenix instance with authentication enabled. Users have one of two roles `admin` or `member`, see permissions below to learn more about the permissions for each role.

Only admins can manage phoenix users. They can add, delete, and reset the passwords of other members. To manage users go to the `/settings` page.

## Permissions

This section outlines the specific actions that users can perform based on their assigned roles within the system: **Admin** and **Member**. The permission matrix is divided into two main categories:

* Mutations: Operations that allow users to create, update, or delete data within the system.
* Queries: Operations that enable users to retrieve or view data from the system.

### Mutations

Mutations are operations that enable users to create, update, or delete data within the system. This permission matrix ensures that only authorized roles can execute sensitive actions, such as managing users and API keys, while allowing members to perform essential account-related updates like changing their own passwords and usernames.

{% hint style="info" %}
Neither an **Admin** nor **Member** is permitted to change email addresses.
{% endhint %}

<table><thead><tr><th width="549">Action</th><th width="100" align="center">Admin</th><th align="center">Member</th></tr></thead><tbody><tr><td>Create User</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Delete User</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Change Own Password</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Change Other's Password</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Change Own Username</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Change Other's Username</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Create System API Keys</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Delete System API Keys</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Create Own User API Keys</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Delete Own User API Keys</td><td align="center">✅ Yes</td><td align="center">✅ Yes</td></tr><tr><td>Delete Other's User API Keys</td><td align="center">✅ Yes</td><td align="center">No</td></tr></tbody></table>

### Queries

Queries are operations that allow users to retrieve and view data from the system.

{% hint style="info" %}
This table only shows actions that a **Member** is not permitted to do. Actions without restrictions are omitted.
{% endhint %}

<table><thead><tr><th width="548">Action</th><th width="98" align="center">Admin</th><th align="center">Member</th></tr></thead><tbody><tr><td>List All System API Keys</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>List All User API Keys</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>List All Users</td><td align="center">✅ Yes</td><td align="center">No</td></tr><tr><td>Fetch Other User's Info, e.g. emails</td><td align="center">✅ Yes</td><td align="center">No</td></tr></tbody></table>

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
* Running experiments
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

<table data-full-width="false"><thead><tr><th width="416">Environment Variable</th><th>Description</th></tr></thead><tbody><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_CLIENT_ID</strong></td><td>The OAuth2 client ID issued by the identity provider. <strong>(Required)</strong></td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_CLIENT_SECRET</strong></td><td>The OAuth2 client secret issued by the identity provider. Required by default for confidential clients. Only optional when <strong>TOKEN_ENDPOINT_AUTH_METHOD</strong> is explicitly set to <code>none</code> (for public clients without client authentication). <strong>(Required by default)</strong></td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_OIDC_CONFIG_URL</strong></td><td>The OpenID Connect configuration URL (must be HTTPS except for localhost). This URL typically ends with <code>/.well-known/openid-configuration</code> and is used to auto-discover OAuth2 endpoints. <strong>(Required)</strong></td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_DISPLAY_NAME</strong></td><td>A user-friendly name for the identity provider shown in the UI. If not set, Phoenix will generate a display name based on the IDP name. <strong>(Optional)</strong></td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_ALLOW_SIGN_UP</strong></td><td>Whether to allow new user registration via this OAuth2 provider. When set to <strong>False</strong>, only existing users can sign in. Defaults to <strong>True</strong>. <strong>(Optional)</strong></td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_AUTO_LOGIN</strong></td><td>Automatically redirect to this provider's login page, skipping the Phoenix login screen. Useful for single sign-on deployments. Note: Only one provider should have <strong>AUTO_LOGIN</strong> enabled if you configure multiple IDPs. Defaults to <strong>False</strong>. <strong>(Optional)</strong></td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_USE_PKCE</strong></td><td>Enable PKCE (Proof Key for Code Exchange) with S256 code challenge method for enhanced security. PKCE protects the authorization code from interception and can be used with both public clients and confidential clients. This setting is orthogonal to client authentication - whether <strong>CLIENT_SECRET</strong> is required is determined solely by <strong>TOKEN_ENDPOINT_AUTH_METHOD</strong>, not by <strong>USE_PKCE</strong>. Defaults to <strong>False</strong>. <strong>(Optional)</strong></td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_TOKEN_ENDPOINT_AUTH_METHOD</strong></td><td>OAuth2 token endpoint authentication method. This setting determines how the client authenticates with the token endpoint and whether <strong>CLIENT_SECRET</strong> is required. If not set, defaults to requiring <strong>CLIENT_SECRET</strong> (confidential client).<br><br>Options:<br>• <code>client_secret_basic</code>: Send credentials in HTTP Basic Auth header (most common). <strong>CLIENT_SECRET</strong> is required. This is the assumed default behavior if not set.<br>• <code>client_secret_post</code>: Send credentials in POST body (required by some providers). <strong>CLIENT_SECRET</strong> is required.<br>• <code>none</code>: No client authentication (for public clients). <strong>CLIENT_SECRET</strong> is not required. Use this for public clients that cannot securely store a client secret, typically in combination with <strong>PKCE</strong>.<br><br>Most providers work with the default behavior. Set this explicitly only if your provider requires a specific method or if you're configuring a public client. <strong>(Optional)</strong></td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_SCOPES</strong></td><td>Additional OAuth2 scopes to request (space-separated). These are added to the required baseline scopes <code>openid email profile</code>. For example, set to <code>groups</code> to request group information. The baseline scopes are always included and cannot be removed. <strong>(Optional)</strong></td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_GROUPS_ATTRIBUTE_PATH</strong></td><td>JMESPath expression to extract group/role claims from the OIDC ID token or userinfo endpoint response. See <a href="https://jmespath.org">jmespath.org</a> for full syntax.<br><br><strong>⚠️ IMPORTANT:</strong> Claim keys with special characters (colons, dots, slashes, hyphens, etc.) <strong>MUST</strong> be enclosed in double quotes.<br><br>Examples:<br>• Simple keys: <code>groups</code><br>• Nested keys: <code>resource_access.phoenix.roles</code><br>• Array projection: <code>teams[*].name</code><br>• <strong>Special characters (quotes required):</strong><br>&nbsp;&nbsp;- Auth0 namespace: <code>"https://myapp.com/groups"</code><br>&nbsp;&nbsp;- AWS Cognito: <code>"cognito:groups"</code><br>&nbsp;&nbsp;- Keycloak app: <code>resource_access."my-app".roles</code><br><br>Common provider examples:<br>• Google Workspace: <code>groups</code><br>• Azure AD/Entra ID: <code>roles</code> or <code>groups</code><br>• Keycloak: <code>resource_access.phoenix.roles</code><br>• Okta: <code>groups</code><br><br>Must be configured together with <strong>ALLOWED_GROUPS</strong>. <strong>(Optional)</strong></td></tr><tr><td><strong>PHOENIX_OAUTH2_&#x3C;IDP>_ALLOWED_GROUPS</strong></td><td>Comma-separated list of group names that are permitted to sign in (e.g., <code>admin,developers,viewers</code>). Users must belong to at least one of these groups (extracted via <strong>GROUPS_ATTRIBUTE_PATH</strong>) to authenticate successfully. Works together with <strong>GROUPS_ATTRIBUTE_PATH</strong> to implement group-based access control. Must be configured together with <strong>GROUPS_ATTRIBUTE_PATH</strong>. <strong>(Optional)</strong></td></tr></tbody></table>

Detailed instructions for common IDPs are provided below.

{% hint style="info" %}
Users that sign into Phoenix via an OAuth2 IDP are initially added as members. Their role can be changed after their first login by a Phoenix admin.
{% endhint %}

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
4. Phoenix will make a best-effort attempt to display a readable name for your IDP on the login page based on the value substituted in the previous step. If you wish to customize the display name, for example, if your IDP name contains special characters, you may optionally configure the IDP name to be displayed with the `PHOENIX_OAUTH2_<IDP>_DISPLAY_NAME` environment variable.
