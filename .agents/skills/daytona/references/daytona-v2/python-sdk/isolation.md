# Isolation (Python SDK)

Sandbox runtime, network, and project isolation.

Isolation is the separation of sandboxes that share the same hosts, so that each sandbox runs with its own processes, memory, filesystem, and network. An isolated sandbox sees and uses only its own resources, none of another sandbox's.

Sandboxes are isolated by default. The sandbox is the unit of isolation: many sandboxes share hardware, and each one keeps its state to itself. Each sandbox is a hardware-isolated virtual machine with its own kernel, and code in it cannot read another sandbox's filesystem or memory.

Use the three boundaries to decide what code in a sandbox can reach. Runtime isolation covers its kernel and resources, network isolation its traffic, and project isolation its access to data and credentials. A sandbox is not on a shared network with other sandboxes, and its credentials and API access are scoped to the project the sandbox belongs to.

| **Boundary** | **What is separated**                                        | **Methods**                                                                                                                                                       |
| ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Runtime**  | Kernel, processes, filesystem, and memory of each sandbox    | [**Sandboxes**](./sandboxes.md) <br /> [**Resources**](./sandboxes.md#resources)                                                                      |
| **Network**  | Traffic entering (ingress) and leaving (egress) each sandbox | [**Network policy**](./network-limits.md) <br /> [**Preview**](./preview.md) <br /> [**Ports**](./linux-sandboxes.md#create-a-linux-sandbox) |
| **Project**  | Access to sandboxes, data, and credentials                   | [**Projects**](./projects.md) <br /> [**API keys**](./api-keys.md#scopes) <br /> [**Secrets**](./secrets.md)                       |

## Contents

- [Runtime isolation](#runtime-isolation)
- [Network isolation](#network-isolation)
- [Project isolation](#project-isolation)

## Runtime isolation

Runtime isolation is the separation of what runs inside one sandbox from the host it executes on and from every other sandbox. Under hardware virtualization, the hypervisor on the host enforces the boundary, not the guest operating system inside the virtual machine.

Runtime isolation of a sandbox is enforced by the hypervisor, not by the guest. Each sandbox runs as a virtual machine with its own kernel, filesystem, and network stack, and code inside it cannot observe or interfere with other sandboxes or the host. Resources are part of the runtime boundary, and the guest kernel sees only the resources of its own virtual machine.

Size the resources of a sandbox for the tools that run inside it, because those tools see only its own [**vCPU**, **memory**, and **disk**](./sandboxes.md#resources). Linux sandboxes run on Firecracker, Windows and GPU sandboxes on Cloud Hypervisor, and macOS sandboxes on Apple's Virtualization framework, as [hardware virtualization](./sandboxes.md#hardware-virtualization) describes. Raise the memory guarantee to give tools that size themselves from total memory at startup more memory when they start.

| **Resource**             | **What the guest reports**                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CPU count**            | The guest boots with the vCPUs of the sandbox's CPU limit, so the CPU count it reports is the limit, not the guarantee. Tools that size themselves from the number of CPUs, such as parallel test runners and build tools, start one worker for each vCPU of the limit. |
| **Memory at boot**       | A Linux sandbox whose memory limit is above its guarantee can boot with its guaranteed memory, or **1GiB** when the guarantee is lower, plus **1GiB**. Tools that size themselves from total memory at startup, such as a Java virtual machine choosing its default heap, see this starting amount. |
| **Memory while running** | Daytona attaches memory as the workload uses it, up to the limit, and can detach it once freed, so the total the guest reports changes while the sandbox runs. |

**CLI:**

```bash
# Run inside a sandbox, for example: daytona sandbox exec {sandboxId} -- nproc
nproc                         # vCPUs at the sandbox's CPU limit
grep MemTotal /proc/meminfo   # memory attached to the virtual machine now
```

## Network isolation

Network isolation is the control of the traffic that leaves a sandbox, called egress, and the traffic that enters it, called ingress. Each direction has its own default and its own controls.

Network isolation of a sandbox controls each direction separately. Sandboxes never share a network, and one sandbox reaches another only through an endpoint that the other exposes.

Lock down egress with a [network policy](./network-limits.md), and open ingress per endpoint with a [preview](./preview.md) or [SSH access](./ssh-access.md). Egress is open by default and is locked down per sandbox. Ingress is closed by default, and no port of a sandbox is reachable until it is exposed.

| **Direction**           | **Default**                                | **Controls**                                                                                                                                                                              |
| ----------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sandbox to internet** | Open egress                                | [**Network policy**](./network-limits.md): default-deny with an allow list of IPs, CIDRs, and domains                                                                |
| **Internet to sandbox** | Closed until a port is exposed             | [**Preview URLs**](./preview.md) (token-authenticated unless an endpoint is made public) and [**SSH**](./ssh-access.md)                                             |
| **Sandbox to sandbox**  | No shared network                          | None. Sandboxes reach each other only through exposed endpoints.                                                                                                                          |

**Outbound:**

**Outbound** traffic is open by default. A [network policy](./network-limits.md) enables blocking and admits only the domains and public IPv4 ranges on its allow lists, rejecting private and reserved ranges. With blocking on and empty allow lists, no external address is reachable and no domain resolves.

```python
from daytona import Daytona

daytona = Daytona()

# Block all outbound traffic
blocked = daytona.v2.create(network_policy={"block_all": True})

# Or allow specific domains only
domain_restricted = daytona.v2.create(
    network_policy={"allow_domains": ["example.com", "*.daytona.io"]},
)

# Or allow specific public IPv4 ranges only
cidr_restricted = daytona.v2.create(
    network_policy={"block_all": True, "allow_cidrs": ["1.1.1.1/32", "208.80.152.0/22"]},
)
```

| **Parameter** | **Description** |
| --- | --- |
| `network_policy` | Sets the outbound network policy.<br />**Format:** block_all, allow_domains, and allow_cidrs<br />**Example:** `{"block_all": True}` |
| `block_all` | Denies all egress that is not explicitly allowed.<br />**Default:** `True` with allow_domains, otherwise `False` |
| `allow_domains` | Allows egress to hostnames and wildcard domains.<br />**Maximum:** 128 domains and CIDR blocks combined<br />**Format:** the [domain allow list format](./network-limits.md#domain-allow-list-format)<br />**Example:** `["example.com", "*.daytona.io"]` |
| `allow_cidrs` | Allows egress to IPv4 addresses and CIDR blocks, on any port.<br />**Default:** `[]`<br />**Maximum:** 128 domains and CIDR blocks combined<br />**Format:** the [network allow list format](./network-limits.md#network-allow-list-format)<br />**Example:** `["1.1.1.1/32", "208.80.152.0/22"]` |

> **Notes:**
>
> - **Permissions:** The request requires the `write:sandboxes` permission.
> - **Compatibility:** Network policies work on Linux and macOS sandboxes only.

**Inbound:**

**Inbound** traffic reaches a sandbox only through a port exposed as a [preview](./preview.md) endpoint or through [SSH access](./ssh-access.md). A port is exposed as a private endpoint when you first request its preview URL, and a private endpoint requires a preview token or an API key. A port made public accepts requests without a credential. Use the URL the request returns: its hostname contains the sandbox UUID, not the sandbox ID that the SDKs, the CLI, and the API use. Start a server on the port inside the sandbox before you send requests to the URL.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

# Requesting a preview link exposes the port as a private endpoint
preview = sandbox.ports.preview_link(3000)
print(preview.url)    # https://3000-{sandboxUuid}.{proxy-domain}
print(preview.token)  # sent in the x-daytona-preview-token header

# A public endpoint accepts requests without a credential
sandbox.ports.expose(8080, public=True)
```

| **Parameter** | **Description** |
| --- | --- |
| `port` | Sets the sandbox port to expose.<br />**Required**<br />**Minimum:** `1`<br />**Maximum:** `65535`<br />**Format:** a TCP port other than the sandbox daemon ports 2280, 2281, and 22220<br />**Example:** `3000` |
| `public` | Makes the endpoint public.<br />**Default:** `False` |

## Project isolation

Project isolation is the separation of tenants that share one platform, so that each tenant reaches only its own resources and credentials. Access control enforces the boundary.

Project isolation of a sandbox is enforced at the boundary of its project. A sandbox belongs to exactly one project, and a project API key cannot see or operate on resources of another project.

Use [projects](./projects.md) to separate tenants, and narrow access within a project with scoped API keys and secrets. Projects are the unit of isolation, and every sandbox, image, snapshot, volume, secret, and project API key belongs to exactly one project. [Organizations](./organizations.md) are the unit of membership and billing, and organization API keys are scoped to the whole organization.

| **Mechanism**                                                | **What it scopes**            | **How it works**                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [**Scoped API keys**](./api-keys.md#scopes) | What a key can do             | Each key carries an explicit `verb:resource` scope list chosen at creation, and every request is confined to those scopes. `write:` and `delete:` imply `read:` on the same resource. Keys can carry an expiry. Revocation takes effect immediately on the API, and toolbox and SSH access through the proxy can continue for up to 30 seconds after revocation. |
| [**Secrets**](./secrets.md)                              | Credentials used in a sandbox | A sandbox holds an opaque placeholder, and an outbound proxy substitutes the real value only for requests to the secret's allowed domains. Responses are not rewritten, so a destination that echoes the credential back returns the real value into the sandbox. |

**Scoped API keys:**

**[API key permissions](./api-keys.md#scopes)** scope what a key can do. A key created with only the sandbox write and delete permissions can manage sandboxes but cannot read secrets or delete images. A key can hold only the permissions that its creator also holds.

**CLI:**

```bash
# Requires a signed-in user session from daytona login; a project API key is rejected
# PROJECT_ID is a project ID from daytona project list

# A key limited to creating and deleting sandboxes in one project
daytona key mint --project PROJECT_ID \
  --name tenant-a-key \
  --permission write:sandboxes,delete:sandboxes \
  --expires 720h
```

| **Flag** | **Description** |
| --- | --- |
| `--permission` | Sets the project permissions of the key.<br />**Required**<br />**Format:** [permission](./api-keys.md#scopes) names, comma-separated or one per flag<br />**Example:** `write:sandboxes,delete:sandboxes` |
| `--expires` | Sets when the key expires.<br />**Default:** no expiry<br />**Format:** a Go duration in whole seconds, counted from now, or an RFC 3339 timestamp<br />**Example:** `720h` |
| `--name` | Sets the key name.<br />**Default:** `default`<br />**Example:** `tenant-a-key` |
| `--project` | Selects the project that the key belongs to.<br />**Format:** a project ID or name<br />**Example:** `default` |

> **Notes:**
>
> - **Permissions:** The request requires the `write:project_api_keys` permission.
> - **Prerequisites:** The request requires a user session from daytona login.
> - **Results:** Store the token from the create response, because no other response returns it.

**API:**

```bash
# A key limited to creating and deleting sandboxes in one project
curl 'https://api.daytona.com/projects/PROJECT_ID/api-keys' \
  --request POST \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "tenant-a-key",
  "project_permissions": ["write:sandboxes", "delete:sandboxes"],
  "expires_at": "2027-01-01T00:00:00Z"
}'
```

| **Field** | **Description** |
| --- | --- |
| `project_permissions` | Sets the project permissions of the key.<br />**Required**<br />**Format:** [permission](./api-keys.md#scopes) names<br />**Example:** `["write:sandboxes", "delete:sandboxes"]` |
| `expires_at` | Sets when the key expires.<br />**Default:** no expiry<br />**Format:** an RFC 3339 timestamp<br />**Example:** `"2027-01-01T00:00:00Z"` |
| `name` | Sets the key name.<br />**Default:** `default`<br />**Example:** `"tenant-a-key"` |

> **Notes:**
>
> - **Permissions:** The request requires the `write:project_api_keys` permission.
> - **Prerequisites:** The request requires a user access token, not an API key.
> - **Placeholders:** PROJECT_ID is the ID of the project that the key belongs to.
> - **Results:** Store the token from the create response, because no other response returns it.

**Secrets:**

**[Secrets](./secrets.md)** keep credentials out of sandboxes. A sandbox holds an opaque placeholder; an outbound proxy substitutes the real value only for HTTPS requests to the secret's allowed domains. The sandbox can use the credential but cannot read it directly or send it to another host. Responses are not rewritten, so an allowed destination echoing the credential exposes the real value to the sandbox. To confirm substitution on a real service, see [verify substitution](./secrets.md#verify-substitution).

```python
from daytona import Daytona

daytona = Daytona()

# Creates the secret, or replaces an existing secret of the same name
daytona.v2.secrets.set(
    "MY_API_KEY",
    "secret-value",
    allowed_domains=["api.example.com"],
)

# The sandbox receives a placeholder, never the plaintext value
sandbox = daytona.v2.create(secrets=["MY_API_KEY"])

# The variable holds the placeholder that code sends as the credential
result = sandbox.process.run('echo "$MY_API_KEY"')
print(result.stdout)  # dtns_..., the placeholder
```

| **Parameter** | **Description** |
| --- | --- |
| `name` | Sets the secret name.<br />**Required**<br />**Minimum:** 1 character<br />**Maximum:** 256 characters<br />**Format:** a letter or underscore, followed by letters, digits, and underscores<br />**Example:** `"MY_API_KEY"` |
| `value` | Sets the secret value.<br />**Required**<br />**Minimum:** 1 byte<br />**Maximum:** 64 KiB<br />**Example:** `"secret-value"` |
| `allowed_domains` | Sets the hosts that the secret may be sent to.<br />**Required**<br />**Minimum:** 1 host<br />**Maximum:** 50 hosts<br />**Format:** hostnames, or an asterisk and a period followed by a hostname to match its subdomains<br />**Value:** `["*"]` for any verified host<br />**Example:** `["api.example.com"]` |
| `secrets` | Attaches project secrets by name.<br />**Example:** `["MY_API_KEY"]` |

> **Notes:**
>
> - **Permissions:** The requests require the `write:secrets` and `write:sandboxes` permissions.
