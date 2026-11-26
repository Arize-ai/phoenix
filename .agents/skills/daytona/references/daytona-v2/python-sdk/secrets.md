# Secrets (Python SDK)

Inject project secrets into sandbox network traffic without exposing the plaintext to sandbox code.

Secrets store sensitive values such as API keys, tokens, and passwords for use across your sandboxes. They let sandbox code authenticate to external services without hardcoding credentials into your source, snapshots, or sandbox environment variables.

Daytona injects secrets into the outbound HTTPS traffic of a sandbox without ever placing the plaintext inside the sandbox. A secret is a project-scoped, encrypted credential, and instead of an environment variable holding the actual API key, the sandbox holds an opaque placeholder token. An outbound proxy replaces the placeholder with the real value before the request reaches its destination, and only when the request goes to a host you have allowed.

Use secrets to give a sandbox an LLM API key or a database password while keeping the plaintext out of its environment, file system, process arguments, and logs. Code in the sandbox can use the credential to reach an approved host but cannot read the value or send it to any other host. The proxy does not rewrite responses, so an approved host that echoes the credential returns the plaintext value to the sandbox.

| **Field**           | **Description**                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Name**            | Unique name within the project, 1 to 256 letters, digits, and underscores, not starting with a digit. Doubles as the environment variable name in the sandbox. |
| **Value**           | The plaintext value, up to 64 KiB. Encrypted at rest and never returned by the API after creation.                                               |
| **Description**     | Optional human-readable description.                                                                                                             |
| **Allowed Domains** | Allowlist of hosts the secret may be sent to. Supports exact hosts, wildcard subdomains, or any verified host. Required.                 |
| **Updated At**      | Timestamp of the last write.                                                                                                                     |

## Contents

- [Use cases](#use-cases)
- [Substitution scope](#substitution-scope)
- [Certificate trust](#certificate-trust)
- [Host allowlist](#host-allowlist)
- [Create a secret](#create-a-secret)
- [Use a secret in a sandbox](#use-a-secret-in-a-sandbox)
- [Get sandbox secrets](#get-sandbox-secrets)
- [Update secrets in a sandbox](#update-secrets-in-a-sandbox)
- [Verify substitution](#verify-substitution)
- [HTTP Basic Auth](#http-basic-auth)
- [Operations](#operations)
- [Permissions](#permissions)

## Use cases

Secrets let sandbox code use a credential for an HTTPS service it cannot read.

- **Model provider keys for agents.** An agent calls a model API with a key it cannot read. The proxy substitutes the key only for the provider's host, so the agent cannot send it anywhere else. Responses pass through unchanged, so a provider that echoes the key returns the plaintext into the sandbox.

- **Third-party HTTPS APIs.** Tokens for source control, payment, or other APIs are substituted in each request. The plaintext stays out of files, environment variables, process arguments, and logs. The proxy replaces placeholders in the request line, every header, and the body, so the token can sit wherever the API expects.

- **Untrusted code.** Code from users or agents uses a credential, and the host allowlist limits where the value can go. A request to any other host carries only the placeholder. The proxy dials the destination itself and validates its certificate, so code that spoofs DNS, SNI, or the Host header cannot redirect the value.

- **Credentials outside images and snapshots.** The sandbox holds only a placeholder, so source code, images, and snapshots carry no plaintext. A snapshot restore attaches the source's secrets again, with the exceptions in use a secret in a sandbox. Forks attach the source's secrets too, under the same placeholders.

- **Shared credentials without shared values.** A member with the secrets read permission attaches a secret to a sandbox but never sees its value. The API does not return a value after creation. The member also needs the sandbox write permission, which an organization role or an API key can grant.

## Substitution scope

Substitution scope is the part of the outbound traffic of a sandbox in which the placeholder of a secret is replaced with its real value. Any request outside the scope leaves the sandbox with the placeholder in place of the real value of the secret.

The scope of a secret in a sandbox is the whole HTTPS request over HTTP/1.1, from the request line and query string through every header to the body. The proxy resolves and dials the destination itself and validates its certificate against the system roots, so a sandbox that spoofs DNS, SNI, or the Host header cannot redirect a substituted secret.

Send the secret over HTTPS wherever the destination service expects it, such as an Authorization or X-Api-Key header or a JSON body field. Send the placeholder unmodified, because substitution is a literal replacement and an encoded placeholder no longer matches.

| **Case**                             | **Behavior**                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cleartext HTTP**                   | A plain `http://` destination cannot be authenticated, so the placeholder is forwarded intact, even to an allowed host.                                       |
| **Bodies over 1 MiB**                | The body streams through, and placeholders past the first 1 MiB are not replaced.                                                                             |
| **Transformed placeholders**         | A placeholder that a tool encodes before sending, such as a Basic Auth helper that Base64-encodes credentials, is not replaced, as [HTTP Basic Auth](#http-basic-auth) describes. |
| **HTTP/2**                           | The proxy speaks HTTP/1.1 and does not offer `h2` during ALPN, so standard clients negotiate HTTP/1.1 and a client that requires HTTP/2, such as a gRPC client, fails. |
| **Certificate-pinned clients**       | A client that pins a different certificate rejects the leaf of the proxy, so the handshake fails and the request does not reach the destination.              |
| **Encrypted Client Hello**           | A client that uses Encrypted Client Hello is not supported, and its request does not reach the destination.                                                   |
| **Non-HTTP protocols**               | Traffic in other protocols on other ports carries the placeholder as-is.                                                                                     |
| **HTTP/3**                           | A sandbox with secrets blocks UDP port 443, so HTTP/3 clients fall back to TLS over TCP and are substituted normally.                                          |
| **Another host on a TLS connection** | A request for a host other than the SNI host of its TLS connection returns `403`.                                                                             |

## Certificate trust

Certificate trust is the set of certificate authorities that the TLS clients in a sandbox accept when they verify the certificate of a server. A client that does not trust the authority behind a certificate fails its TLS handshake with that server.

The proxy terminates the TLS connections of a sandbox with its own certificate authority and mints a leaf certificate per destination. The authority is installed in the sandbox before its entrypoint starts. Every process the sandbox spawns gets environment variables that point common clients at the authority, so they trust the leaf certificate without configuration. The install is best-effort: when the image does not allow writes to the CA location, the placeholder environment variables are still set in the sandbox.

Point a client that ignores these variables and reads only its own trust store at the CA bundle, or its TLS handshake against the proxy fails. Do not disable certificate verification instead.

| **File**                     | **Contents**                                       |
| ---------------------------- | -------------------------------------------------- |
| **`/etc/rlp/ca.pem`**        | The proxy CA certificate.                          |
| **`/etc/rlp/ca-bundle.pem`** | The system root bundle with the proxy CA appended. |

| **Variable**            | **Value**                 | **Read by**              |
| ----------------------- | ------------------------- | ------------------------ |
| **`SSL_CERT_FILE`**     | `/etc/rlp/ca-bundle.pem`  | OpenSSL-based clients    |
| **`REQUESTS_CA_BUNDLE`**| `/etc/rlp/ca-bundle.pem`  | Python `requests`, `httpx` |
| **`CURL_CA_BUNDLE`**    | `/etc/rlp/ca-bundle.pem`  | `curl`                   |
| **`NODE_EXTRA_CA_CERTS`**| `/etc/rlp/ca.pem`        | Node.js                  |
| **`GIT_SSL_CAINFO`**    | `/etc/rlp/ca-bundle.pem`  | `git` over HTTPS         |
| **`DENO_CERT`**         | `/etc/rlp/ca-bundle.pem`  | Deno                     |

## Host allowlist

A host allowlist is the set of hosts that a secret of a sandbox may be sent to. A request from the sandbox to any other host carries the placeholder instead of the value.

The host allowlist of a secret is required, and the proxy replaces the placeholder only for requests whose destination host matches an entry in it. The allowlist decides only whether a placeholder is substituted and does not block traffic: a request to a host outside it still leaves the sandbox, carrying the placeholder instead of the value.

Set the allowed hosts when you [create a secret](#create-a-secret) or [update a secret](#update-a-secret), and list only the hosts the secret requires. A single asterisk allows any verified host, including one a compromised sandbox controls. To restrict which hosts a sandbox can reach at all, set a sandbox [network policy](./network-limits.md), which applies independently of the allowlist of each secret.

| **Rule**                | **Description**                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hosts only**          | Use hostnames of up to 253 characters made of letters, digits, dots, and hyphens, with at least two labels, such as `example.com`; entries with a scheme, path, port, whitespace, a leading dot, or an empty label, single-label hosts such as `localhost`, and IP addresses are rejected with `400`. |
| **Wildcards supported** | Prefix a host with `*.` to allow its subdomains. The base domain itself does not match, and the part after `*.` cannot be a public suffix such as `com` or `co.uk`.                 |
| **Any host alone**      | `*` must be the only entry. A list that combines `*` with other entries is rejected with `400`.                                                                                     |
| **Case-insensitive**    | Entries are stored in lowercase, duplicates are removed, and host matching ignores letter case.                                                                                       |
| **Scope tightly**       | List only the hosts the secret requires.                                                                                                                                              |

| **Valid example**  | **Value**                                                     |
| ------------------ | ------------------------------------------------------------- |
| **Single host**    | `["api.example.com"]`                                         |
| **Wildcard host**  | `["*.example.com"]`                                           |
| **Multiple hosts** | `["api.example.com", "*.example.org", "service.example.net"]` |

## Create a secret

Create a secret to store a credential that sandboxes can use without reading it. A secret is a named value in a project, encrypted at rest, together with the hosts it may be sent to.

A secret belongs to one project, and its name is unique within it. A create is a write to the name of the secret, so a write to a name that already exists replaces that secret. The value is write-only, so it is never shown again after it has been written.

Create a secret from the dashboard or programmatically. Make the write create-only to have it fail when the name is already taken. The check runs in the same transaction as the write, so two concurrent creates cannot overwrite each other's value.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/secrets)
2. Click **Create Secret**
3. Enter a **Name** and a **Value**
4. Optionally enter a **Description** and a comma-separated list of **Allowed Domains**
5. Click **Create**

```python
from daytona import Daytona

daytona = Daytona()

daytona.v2.secrets.set(
    "MY_API_KEY",
    "secret-value",
    description="Example API key",
    allowed_domains=["api.example.com"],
    if_not_exists=True,
)
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the secret name.<br />**Required**<br />**Minimum:** 1 character<br />**Maximum:** 256 characters<br />**Format:** a letter or underscore, followed by letters, digits, and underscores<br />**Example:** `"MY_API_KEY"` |
| `value` | Sets the secret value.<br />**Required**<br />**Minimum:** 1 byte<br />**Maximum:** 64 KiB<br />**Example:** `"secret-value"` |
| `allowed_domains` | Sets the hosts that the secret may be sent to.<br />**Required**<br />**Minimum:** 1 host<br />**Maximum:** 50 hosts<br />**Format:** hostnames, or an asterisk and a period followed by a hostname to match its subdomains<br />**Value:** `["*"]` for any verified host<br />**Example:** `["api.example.com"]` |
| `description` | Sets the description.<br />**Default:** the stored description<br />**Maximum:** 1 KiB<br />**Value:** `""` for no description<br />**Example:** `"Example API key"` |
| `if_not_exists` | Makes the write create-only.<br />**Default:** `False` |

## Use a secret in a sandbox

Use a secret in a sandbox to let its code authenticate with the credential without holding the value. An attached secret is an environment variable named after it, set to a placeholder.

The secrets of a sandbox are attached by name when it is created, and their variables are set before the entrypoint starts, so every process, session, PTY, and SSH exec in the sandbox inherits them. Code reads a variable as usual and sends it in an outbound HTTPS request, and the proxy substitutes the real value only in requests to the allowed hosts of the secret. A stored secret cannot be injected under a different variable name.

Attach secrets when you create the sandbox from the dashboard or programmatically, and send each variable within the [substitution scope](#substitution-scope). Every name must exist in the project, or the create fails before any sandbox is scheduled. Duplicate names collapse to one. To change which secrets are attached after the create, [update secrets in a sandbox](#update-secrets-in-a-sandbox).

| **Case**                                         | **Attached secrets**                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Snapshot restore or fork**                     | The secrets the source had at memory capture, under the same placeholders.                                              |
| **Secret deleted since capture**                 | The deleted secret is not attached, and the copy reports a partial capture.                                             |
| **Caller without the secrets read permission**   | No secrets are attached, and the copy reports a partial capture.                                                        |
| **Snapshot taken before secrets were recorded**  | No secrets are attached, and the [capture status](#get-sandbox-secrets) of the copy reports this case.                  |

1. Go to [Daytona Sandboxes ↗](https://app.daytona.com/dashboard/sandboxes)
2. Click **Create Sandbox**
3. Open the **Environment** tab and click **Manage secrets**
4. Select the secrets to attach and return to the form
5. Click **Create**

```python
from daytona import Daytona

daytona = Daytona()

sandbox = daytona.v2.create(secrets=["MY_API_KEY"])
```

| **Parameter** | **Description** |
| --- | --- |
| `secrets` | Attaches project secrets by name at sandbox create.<br />**Example:** `["MY_API_KEY"]` |

## Get sandbox secrets

Get sandbox secrets to see which secrets are attached to a sandbox and whether the sandbox has applied them. The attached secrets are named, never shown as values or placeholders.

The secrets of a sandbox change in the background, so a read reports a change as pending until the sandbox has the new set. A sandbox restored from a snapshot or forked also reports a capture status, which shows whether it received every secret its source had.

Get the secrets before every [replace](#update-secrets-in-a-sandbox), because the replace must send back the revision tag of the read. After a replace, repeat the get until the change is applied or has failed with an error.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(secrets=["MY_API_KEY"])

info = sandbox.get_secrets()
print(info.secrets, info.status, info.etag)
```

> **Notes:**
>
> - **Prerequisites:** The sandbox must be a Linux sandbox without GPUs.

## Update secrets in a sandbox

Update secrets in a sandbox to attach or detach secrets after the sandbox is created. An update replaces the full set of secrets attached to the sandbox.

A replace names every secret the sandbox keeps: names left out are detached, names that stay keep their placeholders, and new names get new ones. The sandbox applies the change in the background. Running processes keep their environment, and later processes see the new names.

Send the revision tag of the last [get](#get-sandbox-secrets) in every replace. If the secrets changed since then, the replace fails instead of overwriting, so get them again and retry with the new tag. The replace reports the change as pending, and a later get reports it as applied or failed with an error.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(secrets=["MY_API_KEY"])

current = sandbox.get_secrets()
updated = sandbox.replace_secrets(
    secrets=["MY_API_KEY", "GITHUB_TOKEN"],
    if_match=current.etag,
)
print(updated.status)  # pending until the sandbox applies the change
```

| **Parameter** | **Description** |
| --- | --- |
| `secrets` | Sets the full list of project secret names attached to the sandbox.<br />**Required**<br />**Format:** names without duplicates<br />**Value:** `[]` for no secrets<br />**Example:** `["MY_API_KEY", "GITHUB_TOKEN"]` |
| `if_match` | Sets the revision tag from the last read.<br />**Required**<br />**Format:** the etag of the last get_secrets() or replace_secrets() result<br />**Example:** `current.etag` |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be a Linux sandbox without GPUs. The sandbox must be running, paused, or stopped. A sandbox in a transition, or with a memory snapshot or fork in progress, must settle first.
> - **Polling:** Repeat get_secrets() until the status is `applied`.

## Verify substitution

Verify substitution to confirm that the proxy replaces the placeholder of a secret in requests from a sandbox to an allowed host. A verification calls the real service with the secret and checks whether the service accepts or rejects the request.

A service that rejects the placeholder accepts a request from the sandbox only when the proxy has substituted the real value. GitHub rejects a placeholder token, so a successful call to GitHub from the sandbox shows that the request carried the real token.

Store a GitHub token as a secret allowed for api.github.com, then call the GitHub user endpoint from the sandbox. Do not use an echo or debugging service you would not trust with the plaintext. Responses are not rewritten, so such a service returns the real value to the sandbox.

```python
from daytona import Daytona

daytona = Daytona()

daytona.v2.secrets.set(
    "GITHUB_TOKEN",
    "ghp_your_real_token",
    allowed_domains=["api.github.com"],
)

sandbox = daytona.v2.create(
    secrets=["GITHUB_TOKEN"],
)

response = sandbox.process.run(
    'curl -s -o /dev/null -w "%{http_code}" '
    '-H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user'
)
print(response.output)  # 200 proves substitution works
```

| **Parameter** | **Description** |
| --- | --- |
| `allowed_domains` | Sets the hosts that the secret may be sent to.<br />**Required**<br />**Example:** `["api.github.com"]` |
| `secrets` | Attaches project secrets by name at sandbox create.<br />**Example:** `["GITHUB_TOKEN"]` |

## HTTP Basic Auth

HTTP Basic Auth is an authentication scheme in which a request from a sandbox carries a Base64-encoded username and password in its Authorization header. The server decodes the header to read the credential, so only HTTPS keeps it private.

A Basic Auth helper in an HTTP client encodes the credential inside the sandbox, so the header carries the encoded username and placeholder, and no longer the placeholder itself. The proxy cannot substitute it, and the upstream service rejects the request. A secret that already holds the encoded username and password pair appears unmodified in the header, so the proxy substitutes it for requests to the allowed hosts of the secret.

Encode the username and password outside the sandbox, store the encoded value as a secret, and send the variable after the word Basic in the Authorization header. Do not give the variable to a Basic Auth helper, which would Base64-encode it again.

```python
import base64

from daytona import Daytona

daytona = Daytona()

payload = base64.b64encode(b"username:password").decode()

daytona.v2.secrets.set(
    "BASIC_AUTH",
    payload,
    allowed_domains=["api.example.com"],
)

sandbox = daytona.v2.create(
    secrets=["BASIC_AUTH"],
)

response = sandbox.process.run(
    'curl -s -o /dev/null -w "%{http_code}" '
    '-H "Authorization: Basic $BASIC_AUTH" https://api.example.com/protected'
)
print(response.output)
```

> **Notes:**
>
> - **Clients:** To send the full header value instead, store `Basic Base64(username:password)` as the secret value, and then send `Authorization: $BASIC_AUTH`.

## Operations

Operations on secrets act on secrets that already exist in a project. They read the metadata of stored secrets and change or remove the ones a project no longer needs.

A secret lives in its project under its unique name until it is deleted, and no read returns its value after creation. A secret stays in place while a sandbox or bucket volume references it.

Use the operations below to find a secret by name, change its value or allowed hosts, and delete it. Each operation requires the matching secrets [permission](#permissions).

### List secrets

List secrets to find the secrets of a project by name. A paginated list returns a large collection in pages, and each page continues where the previous one ended.

A list of secrets covers one project and returns its secrets one page at a time, ordered by name. Each entry holds the metadata of a secret, never its value.

Use a list to find the name of a secret to attach to a sandbox or to update. The list comes in pages. To read every page of the list in a single pass instead, [iterate over all secrets](#iterate-over-all-secrets).

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/secrets)
2. Use the search field to filter the list by name

```python
from daytona import Daytona

daytona = Daytona()

secrets = daytona.v2.secrets.list()
for secret in secrets.items:
    print(secret.name)
```

| **Parameter** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page.<br />**Example:** `secrets.next_cursor` |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

##### Iterate over all secrets

Iterate over all secrets to read every page of the list in one pass. Iteration over a paginated list reads one page after another until no page remains.

Iteration over the secrets of a project requests the pages one after another and yields the secrets one at a time. The iteration ends after the last page.

Use iteration when a script needs every secret of the project, without requesting each page yourself. In the CLI, the list command follows every page with the all flag.

```python
from daytona import Daytona

daytona = Daytona()

for secret in daytona.v2.secrets.iter():
    print(secret.name, secret.allowed_domains)
```

### Get a secret

Get a secret to read its allowed domains, description, and update time by name. A get reads one resource by its identifier and changes nothing on the server.

A get of a secret reads a single secret of the project by its unique name. The get returns the stored metadata of that secret, but never its value.

Use a get to check which hosts a secret may be sent to before you attach it to a sandbox. To change the hosts or the value, [update the secret](#update-a-secret).

```python
from daytona import Daytona

daytona = Daytona()

secret = daytona.v2.secrets.get("MY_API_KEY")
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the secret to get by name.<br />**Required**<br />**Example:** `"MY_API_KEY"` |

### Update a secret

Update a secret to change its value or the hosts it may be sent to. An update overwrites the stored fields of an existing resource and keeps its identifier.

An update of a secret is the same write as a create, and it replaces the stored value. The current value cannot be shown, so every update carries a new value.

Update a secret from the dashboard or programmatically. The API and the SDKs require the allowed domains and replace them. The API also clears the description when the request omits it, while the SDKs keep it unless a new one is given. The CLI keeps the stored description and allowed domains unless the command sets new ones.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/secrets)
2. Click the **⋮** menu of the secret and click **Edit**
3. Enter a **New Value**
4. Adjust the **Description** and **Allowed Domains** as needed
5. Click **Save**

```python
from daytona import Daytona

daytona = Daytona()

daytona.v2.secrets.set(
    "MY_API_KEY",
    "new-secret-value",
    allowed_domains=["api.example.com", "*.example.com"],
)
```

| **Parameter** | **Description** |
| --- | --- |
| `value` | Sets the new secret value.<br />**Required**<br />**Minimum:** 1 byte<br />**Maximum:** 64 KiB<br />**Example:** `"new-secret-value"` |
| `allowed_domains` | Sets the hosts that the secret may be sent to.<br />**Required**<br />**Minimum:** 1 host<br />**Maximum:** 50 hosts<br />**Format:** hostnames, or an asterisk and a period followed by a hostname to match its subdomains<br />**Value:** `["*"]` for any verified host<br />**Example:** `["api.example.com", "*.example.com"]` |
| `description` | Sets the description.<br />**Default:** the stored description<br />**Maximum:** 1 KiB<br />**Value:** `""` for no description<br />**Example:** `"Example API key"` |

### Delete a secret

Delete a secret to remove a credential that the project no longer needs. Deletion removes a resource permanently, together with the data stored only in it.

A delete removes the secret from its project. A later snapshot restore or fork does not attach the deleted secret, even when the source sandbox had it at capture.

Delete a secret from the dashboard or programmatically, after detaching it from every sandbox. To revoke a secret but keep it, [update](#update-a-secret) it with a new value or narrower allowed domains.

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/secrets)
2. Click the **⋮** menu of the secret and click **Delete**
3. Click **Delete** to confirm

```python
from daytona import Daytona

daytona = Daytona()

daytona.v2.secrets.delete("MY_API_KEY")
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the secret to delete by name.<br />**Required**<br />**Example:** `"MY_API_KEY"` |

> **Notes:**
>
> - **Prerequisites:** No sandbox or bucket volume may reference the secret.
> - **Order:** To detach the secret from a sandbox, [replace the sandbox secrets](#update-secrets-in-a-sandbox) first.

## Permissions

Secrets are scoped to a project. A secret needed by two projects must be stored in each. Access is governed by three permissions, which you can grant to an [organization role](./organizations.md) or an [API key](./api-keys.md).

Attaching a secret when creating a sandbox requires the secrets read permission in addition to the sandbox write permission, and getting the secrets of a sandbox requires the sandbox read permission as well. The dashboard enforces the same project-scoped permissions as the API: a member whose role lacks the secrets write permission does not see the create and edit actions, and one without the secrets delete permission does not see the delete action.

The [audit logs](./audit-logs.md) record creates, updates, and deletes by secret name, never value.

| **Permission**      | **Grants**                                       |
| ------------------- | ------------------------------------------------ |
| **`read:secrets`**  | List and get secret metadata, never values       |
| **`write:secrets`** | Create and update secrets                        |
| **`delete:secrets`** | Delete secrets                                   |
