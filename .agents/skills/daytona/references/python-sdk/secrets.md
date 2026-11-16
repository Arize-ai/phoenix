## Contents

- How secrets work
- Host allowlist
- Create a secret
- Use a secret in a sandbox
- Verify substitution
- Update secrets in a sandbox
- List secrets
- Get a secret
- Update a secret
- Delete a secret
- HTTP Basic Auth
- Permissions




Secrets are a secure way to store and use sensitive values such as API keys, tokens, and passwords across your Daytona sandboxes. They let code running in a sandbox authenticate to external services without hardcoding credentials into your source, snapshots, or sandbox environment variables.

Secrets are organization-scoped, encrypted credentials that Daytona injects into a sandbox's outbound HTTPS traffic without ever placing the plaintext inside the sandbox. Instead of an environment variable holding the actual API key, the sandbox holds an opaque placeholder token. An outbound proxy replaces the placeholder with the real value before the request reaches its destination, and only when the request goes to a host you have allowed.

This lets you give a sandbox access to a credential such as an LLM API key or a database password while keeping the plaintext out of the sandbox environment, file system, process arguments, and logs. Code running in the sandbox can use the credential to reach an approved host, but cannot read the value, and cannot send it to any other host as long as the secret has a [host allowlist](#host-allowlist).

## How secrets work

A secret never enters the sandbox in plaintext. Daytona uses an opaque placeholder token and an outbound proxy to swap the placeholder for the real value at request time:

1. You store a secret in your organization. Daytona encrypts the value at rest and assigns it an opaque placeholder token, for example **`dtn_secret_<random_string>`**.
2. When you create a sandbox, you map an environment variable to a secret by name. Daytona sets that environment variable to the placeholder, not to the real value.
3. When the sandbox makes an outbound HTTPS request, the proxy inspects it. If a request header carries a placeholder and the destination host matches the secret's allowlist, the proxy replaces the placeholder with the decrypted value before the request reaches its destination.
4. For any other destination, the placeholder is forwarded unchanged. The real value is never sent to a host outside the allowlist. A secret without an allowlist is substituted for every host.

Because the substitution happens in the proxy, the plaintext value is never present inside the sandbox. The sandbox sees the placeholder in its environment, and any request to a non-allowed host carries the harmless placeholder rather than the secret.

A secret has the following fields:

| **Field**         | **Description**                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| **`name`**        | Unique name within the organization. Used to reference the secret when creating a sandbox.              |
| **`value`**       | The plaintext value. Encrypted at rest and never returned by the API after creation.                    |
| **`description`** | Optional human-readable description.                                                                    |
| **`hosts`**       | Allowlist of hosts the secret may be sent to. Supports exact hosts and `*.` wildcards. When omitted, the secret is unrestricted. |
| **`placeholder`** | Opaque token Daytona generates for the secret. This is the value injected into the sandbox environment. |

### Substitution scope

The proxy substitutes placeholders in HTTPS request headers only. Send the secret in a request header such as `Authorization` or `X-Api-Key` over HTTPS. Placeholders anywhere else pass through unchanged:

- **Plain HTTP requests** are never substituted. Substituting them would send the real value across the network in cleartext.
- **Request bodies** (including JSON) are forwarded as-is. Body substitution is not supported.
- **URL query parameters** are forwarded as-is.
- **Transformed placeholders** are not substituted. Substitution is a literal replacement, so a header must carry the placeholder unmodified. Tools that encode the placeholder before sending, such as Basic Auth helpers that Base64-encode credentials, produce a header the proxy cannot match. See [HTTP Basic Auth](#http-basic-auth).

If a service only accepts credentials in the body or query string, secrets cannot authenticate to it. Use header-based authentication.

### Response scrubbing

The proxy also scrubs responses. If an upstream response contains the real secret value, the proxy rewrites it back to the placeholder before the response reaches the sandbox. Code in the sandbox can never read the plaintext, even when the destination echoes it back.

This means echo services cannot confirm substitution: the response always shows the placeholder, even when the request that reached the service carried the real value. To confirm substitution works, make an authenticated call to the real service and check the status code. See [Verify substitution](#verify-substitution).

## Host allowlist

The host allowlist is the set of hosts a secret may be sent to. Set your allowed hosts using the `hosts` array when [creating a secret](#create-a-secret) or [updating a secret](#update-a-secret). The proxy replaces the placeholder only for requests whose destination host matches an entry in the allowlist; a request to any other host carries the unmodified placeholder.

Omitting `hosts` leaves the secret unrestricted: the proxy replaces the placeholder for requests to any host. Code running in a sandbox that mounts an unrestricted secret can therefore send its value to a host it controls. Mounting a secret requires only `write:sandboxes` (see [Permissions](#permissions)), so set an allowlist for every secret unless you have a specific reason not to.

- **Hosts only**: use hostnames; omit protocols, paths, ports, or query strings
- **Wildcards supported**: prefix a host with `*.` to allow the base domain and its subdomains
- **Case-insensitive**: host matching ignores letter case
- **Scope tightly**: list only the hosts the secret requires

The following examples are valid:

- **Single host**: `["api.example.com"]`
- **Wildcard host**: `["*.example.com"]`
- **Multiple hosts**: `["api.example.com", "*.example.org", "service.example.net"]`

## Create a secret

Daytona provides methods to create secrets.

```python
from daytona import CreateSecretParams, Daytona

daytona = Daytona()

secret = daytona.secret.create(CreateSecretParams(
    name="my-secret",
    value="secret-value",
    description="Optional description",
    hosts=["api.example.com"],
))
```

## Use a secret in a sandbox

Daytona provides methods to inject a secret into a sandbox.

1. When creating the sandbox, pass **`secrets`** as a map of environment variable name to secret name.
2. Daytona sets that environment variable to the secret's placeholder, not to the real value.
3. Your code reads the environment variable as usual and sends it in a request header of an outbound HTTPS request, for example `Authorization` or `X-Api-Key`.
4. The outbound proxy substitutes the real value into request headers sent to the secret's allowed hosts, and leaves the placeholder unchanged for any other host. See [Substitution scope](#substitution-scope) for what is and is not substituted.

Each entry must have exactly one key. The environment variable name (the key) can differ from the secret name (the value), so the same stored secret can be exposed under different variable names in different sandboxes.


```python
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    language="python",
    secrets={
        "MY_API_KEY": "my-secret",
    },
))
```

## Verify substitution

Do not use echo services to test substitution. [Response scrubbing](#response-scrubbing) rewrites the real value back to the placeholder in every response, so an echo service always shows the placeholder even when substitution worked. This is a false negative, not a failure.

To verify substitution, call the real service and check the status code. For example, store a GitHub token as a secret allowed for `api.github.com`, then call `https://api.github.com/user` from the sandbox. A `200` response proves the proxy replaced the placeholder with the real token, because GitHub rejects the placeholder with a `401`.

```python
from daytona import CreateSandboxFromSnapshotParams, CreateSecretParams, Daytona

daytona = Daytona()

daytona.secret.create(CreateSecretParams(
    name="github-token",
    value="ghp_your_real_token",
    hosts=["api.github.com"],
))

sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    secrets={"GITHUB_TOKEN": "github-token"},
))

response = sandbox.process.exec(
    'curl -s -o /dev/null -w "%{http_code}" '
    '-H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user'
)
print(response.result)  # 200 proves substitution works
```

## Update secrets in a sandbox

Daytona provides methods to update secrets mounted in a sandbox without recreating it.

Pass `secrets` as a map of environment variable name to secret name, the same format used when [creating the sandbox](#use-a-secret-in-a-sandbox). The map replaces the previously mounted set: new entries are attached, entries no longer present are detached, and an empty map detaches all secrets.

Attached, detached, and rotated secrets take effect for outbound requests within seconds. New environment variables are visible only to processes spawned after the update; already-running processes keep their environment. A sandbox created without any secrets must be restarted before newly attached secrets work.

```python
sandbox.update_secrets({
    "MY_API_KEY": "my-secret",
})

# Detach all secrets
sandbox.update_secrets({})
```

## List secrets

Daytona provides methods to list secrets.

List operations use cursor-based pagination (`GET /secret/paginated`) and return one page at a time: the page's secrets in `items`, the `total` count, and a cursor for the next page (unset when there are no more pages). Pass the cursor from a previous response to fetch the next page. List operations return metadata only. Secret values are never returned after creation.

```python
page = daytona.secret.list()
for secret in page.items:
    print(secret.name)
```

## Get a secret

Daytona provides methods to get a single secret by its ID.

Get operations return metadata only. Secret values are never returned after creation.

```python
secret = daytona.secret.get(secret_id)
```

## Update a secret

Daytona provides methods to update a secret's value, description, or host allowlist.

Updating the value rotates the credential. The placeholder stays the same, so existing sandboxes that reference the secret pick up the new value on subsequent requests without recreation. The change takes effect in all sandboxes that use the secret within 15 seconds. Send only the fields you want to change. Omitting a field leaves it unchanged.

```python
from daytona import UpdateSecretParams

secret = daytona.secret.update(secret_id, UpdateSecretParams(
    value="new-secret-value",
    hosts=["api.example.com", "*.example.com"],
))
```

## Delete a secret

Daytona provides methods to delete a secret.

Deleted secrets cannot be recovered, and sandboxes that reference a deleted secret can no longer resolve its value.

```python
daytona.secret.delete(secret_id)
```

## HTTP Basic Auth

Standard Basic Auth helpers such as `curl --user` and Python's `requests.auth.HTTPBasicAuth` do not work with a secret that holds a raw password. These helpers Base64-encode the credential inside the sandbox, so the outbound `Authorization` header carries `Basic Base64(username:placeholder)`. The encoded header no longer contains the placeholder, the proxy cannot substitute the real value, and the upstream service rejects the request with a `401` status code.

To authenticate with Basic Auth, store the Base64-encoded `username:password` pair as the secret value and set the `Authorization` header directly:

1. Encode the credential outside the sandbox: **`printf '%s' 'username:password' | base64`**
2. Store the encoded value as a secret
3. In the sandbox, set the header directly: **`Authorization: Basic $MY_SECRET`**

The placeholder then appears unmodified in the header, and the proxy substitutes the encoded credential for requests to the secret's allowed hosts. Do not pass the mounted variable through `curl --user` or another helper that encodes it again.

```python
import base64

from daytona import CreateSandboxFromSnapshotParams, CreateSecretParams, Daytona

daytona = Daytona()

payload = base64.b64encode(b"username:password").decode()

daytona.secret.create(CreateSecretParams(
    name="basic-auth-credentials",
    value=payload,
    hosts=["api.example.com"],
))

sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    secrets={"BASIC_AUTH": "basic-auth-credentials"},
))

response = sandbox.process.exec(
    'curl -s -o /dev/null -w "%{http_code}" '
    '-H "Authorization: Basic $BASIC_AUTH" https://api.example.com/protected'
)
print(response.result)
```

Alternatively, store the complete header value `Basic Base64(username:password)` as the secret and send `Authorization: $MY_SECRET`. Both forms keep the placeholder unmodified in the outbound header.

## Permissions

Secrets are scoped to an organization. Managing them requires the `manage:secrets` permission, which you can grant to an [organization role](../platform/organizations.md) or an [API key](../platform/api-keys.md). [Updating the secrets mounted in a sandbox](#update-secrets-in-a-sandbox) is a sandbox operation and requires the `write:sandboxes` permission instead.

Mounting a secret into a sandbox, when creating, forking or updating it, requires `write:sandboxes` and not `manage:secrets`. A role or API key with `write:sandboxes` can mount any secret in the organization, including secrets it cannot list or manage. For a secret without a [host allowlist](#host-allowlist), that role or key can obtain the secret's value. Set a host allowlist on every secret.

The host allowlist does not restrict holders of `manage:secrets`. A role or API key with `manage:secrets` can change a secret's allowlist without re-entering its value, and the stored value is then sent to the new hosts. Grant `manage:secrets` only to principals you trust with the values of every secret in the organization.

Create, update, and delete operations are recorded in the [audit logs](../platform/audit-logs.md). Secret values are masked in audit entries.
