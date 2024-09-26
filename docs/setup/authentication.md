# Authentication

{% hint style="info" %}
Authentication is available in Phoenix 5.0
{% endhint %}

By default Phoenix deploys with authentication disabled as you may be just trying Phoenix for the very first time or have Phoenix deployed in a VPC. However you might want to further protect access to your data via authentication. Below are the steps.

{% hint style="info" %}
Authentication will stop collecting traces and block all API access until API keys are created. For that reason we recommend scheduling some downtime if you have already deployed phoenix.
{% endhint %}

## Setup

To enable authentication on your Phoenix, you will have to set two environment variables:

<table><thead><tr><th width="198">Variable</th><th width="359">Description</th><th>Example Value</th></tr></thead><tbody><tr><td><strong>PHOENIX_ENABLE_AUTH</strong></td><td>Set to <code>True</code> to enable authentication on your platform</td><td><strong>True</strong> or <strong>False</strong></td></tr><tr><td><strong>PHOENIX_SECRET</strong></td><td>A long string value that is used to sign JWTs for your deployment. It should be a good mix of characters and numbers and should be kept in a secret store of some kind.</td><td><code>3413f9a7735bb780c6b8e4db7d946a492b64d26112a955cdea6a797f4c833593</code></td></tr></tbody></table>

Deploy Phoenix with the above two environment variables set. You will know that you have setup authentication correctly if the UI navigates to to a login screen.

By default Phoenix will create an admin user account. To get started:

1. Log in as the admin user. The email should be **admin@localhost** and the password will be **admin**
2. Set a new password for admin. You will be prompted to set a new password. Use a sufficiently complex password and save it in a safe place.
3. Go to the settings page on the left nav and create your first system API key. This API key can be used to log traces, use the Phoenix client,  and programmatically hit Phoenix's APIs. Store the system API key in a safe place.
4. In your application code, make sure to set the proper authentication headers with the system API key. Phoenix respects headers in the form of [bearer auth](https://swagger.io/docs/specification/authentication/bearer-authentication/), meaning that you should set the header in the form **Authorization: Bearer \<token>.** Note that if you are using the Phoenix Client or Phoenix Otel, you simply need to set the **PHOENIX\_API\_KEY** environment variable.

Re-deploy your application with the API key created above and you will see traces stream in as before.

## User Management

Users can be added and removed from a Phoenix instance with authentication enabled. Users have one of two roles `admin` or `member`, see [permissions](authentication.md#permissions)  below to learn more about the permissions for each role. &#x20;

Only admins can manage phoenix users. They can add, delete, and reset the passwords of other members. To manage users go to the `/settings` page.

{% hint style="info" %}
Deleting a user results in permanently blocking them from phoenix. The action cannot be undone and the user cannot be reactivated with the same email or username. Please be careful when deleting users.
{% endhint %}

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

There are two kinds of API keys in Phoenix: `system` and `user`.&#x20;

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

### Sending OpenInference traces&#x20;

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

* Contact an administrator and request that they reset your password.  Admins can reset user passwords on the `settings` page.
* As a last resort, you can manually update the database tuple that contains your password salt and hash.

## Configuring OAuth2

You can configure Phoenix to use OAuth2 such as Google and AWS Cognito as the identity provider for your Phoenix. By default all users that sign in with OAuth will be assigned the member role.\
\
Below is an example configuration to enable OAuth2 for Google.

```properties
export PHOENIX_SECRET=XXXXXXXXXXXXXXXXX
export PHOENIX_ENABLE_AUTH=True

export PHOENIX_OAUTH2_GOOGLE_CLIENT_ID=XXXXXXXXXXXXXXXXX
export PHOENIX_OAUTH2_GOOGLE_CLIENT_SECRET=GXXXXXXXXXXXXXXXXX
export PHOENIX_OAUTH2_GOOGLE_OIDC_CONFIG_URL=https://accounts.google.com/.well-known/openid-configuration
e
export PHOENIX_SMTP_HOSTNAME=smtp.sendgrid.net
export PHOENIX_SMTP_PORT=587
export PHOENIX_SMTP_USERNAME=apikey
export PHOENIX_SMTP_PASSWORD=XXXXXXXXXXXXXXXXX
```

