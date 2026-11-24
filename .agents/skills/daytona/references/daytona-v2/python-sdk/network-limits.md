# Network Limits (Python SDK)

Control network access to your sandboxes.

Network limits are rules that decide which network destinations a sandbox can reach. They are enforced outside the sandbox, so untrusted code inside it cannot lift them.

Daytona applies network limits to the outbound traffic of each sandbox, from open internet access to a short list of approved destinations. A sandbox with a network policy runs behind a firewall that restricts which external IP addresses and domains it can reach, so that untrusted code inside it cannot send data out of the sandbox or contact arbitrary hosts.

Use network limits to keep code in a sandbox from reaching hosts it was not given. Egress is open by default, and a network policy restricts it with a default-deny allow list of IPv4 CIDR ranges and domains. Set the policy when you create a sandbox, and replace or remove it later without recreating the sandbox. Before you run untrusted code, allow only what it needs or block all egress, then test access from inside the sandbox.

| **Concept**            | **Description**                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Network policy**     | The rules that limit the outbound traffic of a sandbox.                            |
| **Egress**             | Network traffic that leaves a sandbox for outside destinations.                    |
| **Blocking**           | The denial of every outbound destination that an allow list does not name.         |
| **Network allow list** | The IP addresses and address ranges that a sandbox can reach.                      |
| **Domain allow list**  | The hostnames that a sandbox can reach.                                            |
| **Wildcard**           | A domain entry that matches the subdomains of a domain.                            |
| **Policy status**      | The state of a policy change, which shows whether the sandbox enforces the policy. |

## Contents

- [Use cases](#use-cases)
- [Create sandboxes with network restrictions](#create-sandboxes-with-network-restrictions)
- [Network allow list format](#network-allow-list-format)
- [Domain allow list format](#domain-allow-list-format)
- [Operations](#operations)
- [Permissions](#permissions)

## Use cases

Network limits are used when code in a sandbox must not reach arbitrary hosts.

- **Untrusted or generated code.** Code from users or agents runs with no outbound access, so it cannot send data out of the sandbox. With blocking on and empty allow lists, DNS resolves no names either. Network policies apply to Linux and macOS sandboxes, and Windows and GPU sandboxes do not accept them.

- **Agents that call known services.** A domain allow list lets an agent reach the model provider and the APIs it needs, and blocks every other host. The sandbox resolves only the names on the list. A domain allow list turns blocking on by itself.

- **Dependency installs.** The domains of package registries, such as PyPI or npm, are allowed, and the rest of the internet is blocked. A wildcard entry covers the subdomains of a registry host but not the host itself, which needs its own entry. Each entry is a hostname without a protocol, path, port, or query string.

- **Sensitive data.** A sandbox that processes private files or datasets reaches only the hosts on its allow list. DNS is filtered as well, so a name that is not on the list does not resolve. Egress is open by default, so the sandbox gets its policy when it is created.

- **Restrict after setup.** A sandbox installs its dependencies with open egress, and its policy is updated to block all egress before untrusted code runs. The update applies in the background, and the policy status reads applied once the sandbox enforces it. An update works while the sandbox is running, paused, or stopped.

## Create sandboxes with network restrictions

Create a sandbox with network restrictions to control which destinations it can send traffic to. An egress policy blocks all outbound traffic except to an allow list, which keeps the code in the sandbox from sending any data to hosts it was not given.

A network policy turns the open outbound access of a sandbox into an explicit allow list. With blocking on, the sandbox reaches only the domains and IPv4 ranges the policy names, and every other destination, by address or by name, is closed to it.

Set the network policy when you create a sandbox. The examples create [Linux sandboxes](./linux-sandboxes.md), and a [macOS sandbox](./macos-sandboxes.md) create takes the same policy, while [Windows](../platform/windows-sandboxes.md) and [GPU](../platform/gpu-sandboxes.md) sandboxes take none. A domain allow list turns blocking on by itself, while an IPv4 allow list applies only when blocking is on. When a policy has both lists, web traffic on ports 80 and 443 needs a listed domain, even when sent to an address on the network allow list.

```python
from daytona import Daytona

daytona = Daytona()

# Allow access to specific domains; everything else is denied
sandbox = daytona.v2.create(
    network_policy={"block_all": True, "allow_domains": ["example.com", "*.daytona.io"]},
)
```

| **Parameter** | **Description** |
| --- | --- |
| `network_policy` | Sets the outbound network policy.<br />**Format:** block_all, allow_domains, and allow_cidrs<br />**Example:** `{"block_all": True, "allow_domains": ["example.com"]}` |
| `block_all` | Denies all egress that is not explicitly allowed.<br />**Default:** `True` with allow_domains, otherwise `False` |
| `allow_domains` | Allows egress to hostnames and wildcard domains.<br />**Maximum:** 128 domains and CIDR blocks combined<br />**Format:** the [domain allow list format](#domain-allow-list-format)<br />**Example:** `["example.com", "*.daytona.io"]` |
| `allow_cidrs` | Allows egress to IPv4 addresses and CIDR blocks, on any port.<br />**Default:** `[]`<br />**Maximum:** 128 domains and CIDR blocks combined<br />**Format:** the [network allow list format](#network-allow-list-format)<br />**Example:** `["1.1.1.1/32"]` |

### Block all egress

Block all egress to cut a sandbox off from every network destination, for code that needs no network and must not send any data out of the sandbox. Egress is network traffic that leaves a sandbox for outside destinations, and a block on all egress drops every outbound connection.

A sandbox with blocking on and empty allow lists reaches no external address. DNS in the sandbox resolves no names either, so every lookup fails.

Turn blocking on and leave both allow lists empty when you create the sandbox.

```python
from daytona import Daytona

daytona = Daytona()

# Deny all outbound traffic
sandbox = daytona.v2.create(network_policy={"block_all": True})
```

| **Parameter** | **Description** |
| --- | --- |
| `block_all` | Denies all egress that is not explicitly allowed.<br />**Default:** `True` with allow_domains, otherwise `False` |

### Allow IPv4 ranges

Allow IPv4 ranges to limit a sandbox to specific destinations by address. Each entry is a single address or a range, in the [network allow list format](#network-allow-list-format).

A sandbox with a network allow list reaches only the addresses and ranges on it, and the list applies only when blocking is on. Each entry opens an address rather than a service, so the sandbox can reach an allowed address on any of its ports.

Turn blocking on explicitly when you create the sandbox with an IPv4 allow list, because unlike a domain allow list, it does not turn blocking on by itself. Without a domain allow list, DNS resolves a name only to its IPv4 addresses inside the allowed ranges, and a name with no address in those ranges resolves to none. It refuses all other query types, including IPv6 address lookups.

```python
from daytona import Daytona

daytona = Daytona()

# Allow one address and one subnet; everything else is denied
sandbox = daytona.v2.create(
    network_policy={"block_all": True, "allow_cidrs": ["1.1.1.1/32", "208.80.152.0/22"]},
)
```

| **Parameter** | **Description** |
| --- | --- |
| `allow_cidrs` | Allows egress to IPv4 addresses and CIDR blocks, on any port.<br />**Default:** `[]`<br />**Maximum:** 128 domains and CIDR blocks combined<br />**Format:** the [network allow list format](#network-allow-list-format)<br />**Example:** `["208.80.152.0/22"]` |
| `block_all` | Denies all egress that is not explicitly allowed.<br />**Default:** `True` with allow_domains, otherwise `False` |

### Allow domains

Allow domains to limit a sandbox to specific hosts by name. Each entry is a hostname or a wildcard domain, written in the [domain allow list format](#domain-allow-list-format).

A sandbox with a domain allow list resolves and connects only to the listed domains. A wildcard covers every subdomain of a host but not the host itself.

Set the domain allow list when you create the sandbox. The domain list turns blocking on by itself, so the policy does not need to set the blocking field.

```python
from daytona import Daytona

daytona = Daytona()

# Allow a host and all of its subdomains; everything else is denied
sandbox = daytona.v2.create(
    network_policy={"allow_domains": ["pythonhosted.org", "*.pythonhosted.org", "pypi.org"]},
)
```

| **Parameter** | **Description** |
| --- | --- |
| `allow_domains` | Allows egress to hostnames and wildcard domains.<br />**Maximum:** 128 domains and CIDR blocks combined<br />**Format:** the [domain allow list format](#domain-allow-list-format)<br />**Example:** `["pypi.org", "*.pythonhosted.org"]` |

## Network allow list format

A network allow list names allowed destinations by IPv4 address, as a single address or a CIDR block that covers a range. Traffic to an address outside the list is not allowed.

The network allow list of a sandbox opens addresses, not services: each entry lets the sandbox reach that address or range on any port, once blocking is on. Web traffic is the exception when a domain allow list is set, because ports 80 and 443 are then checked by hostname, not address.

Use the network allow list for hosts reached by address, and the [domain allow list](#domain-allow-list-format) for those reached by name. Every interface rejects a non-empty list unless blocking is on or a domain allow list is set. With a domain allow list also set, a web request naming an unlisted host gets status 403, even when its address is listed. The sandbox also blocks UDP traffic on port 443.

| **Rule**                  | **Description**                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IPv4 only**             | IPv6 addresses and IPv6 CIDR blocks are not supported.                                                                                                        |
| **CIDR format**           | Use standard CIDR notation (`A.B.C.D/N`) with a prefix length up to `32`. The address must be the network address of the range: a CIDR with host bits set, such as `208.80.154.0/22`, returns `400`. A bare address such as `208.80.154.232` is also accepted. |
| **No private ranges**     | Loopback (`127.0.0.0/8`), private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`), carrier-grade NAT (`100.64.0.0/10`), multicast (`224.0.0.0/4`), benchmarking (`198.18.0.0/15`), `0.0.0.0/8`, `192.0.0.0/24`, `240.0.0.0/4` (which includes the broadcast address), and `168.63.129.16` return `400`, as does any range that overlaps them, such as `0.0.0.0/0`. |
| **No nested entries**     | Do not list an entry that lies inside another entry, such as `208.80.154.232/32` together with `208.80.152.0/22`. The request is accepted, but the policy fails to apply: at creation the sandbox does not start, and after an update the policy status reads `failed`. Neither error names the nested entry. List the larger range only. |
| **Max 128 entries**       | `allow_cidrs` and `allow_domains` combined. Duplicate entries are stored once but count toward the limit as sent.                                             |
| **Whitespace is ignored** | Entries are trimmed. An empty entry returns `400`.                                                                                                            |

| **Example**           | **Value**                                    |
| --------------------- | -------------------------------------------- |
| **Single IP**         | `208.80.154.232/32` (Wikipedia)              |
| **Subnet**            | `208.80.152.0/22` (Wikimedia)                |
| **Multiple networks** | `["1.1.1.1/32", "208.80.152.0/22"]`          |

## Domain allow list format

A domain allow list names allowed destinations by hostname instead of by address. A service that moves between addresses stays reachable, because the rule follows its name.

The domain allow list of a sandbox governs names as well as connections. DNS in the sandbox resolves only the names on the list and refuses all others, so a host that is not listed cannot be looked up from inside the sandbox, let alone reached.

Use the domain allow list to let a sandbox reach only the services it names. Ports 80 and 443 then pass through an HTTP/1.1 proxy that matches the hostname of each request. The proxy terminates TLS with a certificate authority installed in the sandbox, which clients that read the CA files and variables under [certificate trust](./secrets.md#certificate-trust) trust without configuration. A client that pins certificates, requires HTTP/2, or reads only its own trust store fails.

| **Rule**                | **Description**                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Domains only**        | Use hostnames such as `example.com` or `api.openai.com`. Do not include protocols, paths, ports, or query strings. Each entry needs at least two labels of letters, digits, and hyphens; a label holds at most 63 characters and does not start or end with a hyphen. A single label such as `localhost`, an IP address, or a label with an underscore returns `400`. One trailing dot is removed. |
| **Wildcards supported** | Prefix a domain with `*.` to allow its subdomains, for example `*.daytona.io`. A wildcard does not match the bare domain; add `daytona.io` as its own entry. The wildcard needs at least two labels after `*.`, so `*.com` returns `400`. |
| **ASCII only**          | Write internationalized names in punycode, for example `xn--bcher-kva.de` for `bücher.de`. A name with other characters returns `400`.                       |
| **Case-insensitive**    | Entries are lowercased before matching.                                                                                                                      |
| **Whitespace is ignored** | Entries are trimmed. An empty entry returns `400`.                                                                                                         |
| **Empty list**          | An empty `allow_domains` list also turns blocking on.                                                                                                        |
| **Proxy certificates**  | HTTPS responses through the proxy carry a certificate issued by its certificate authority instead of the destination's.                                     |
| **Proxy without domains** | A policy without a domain allow list routes ports 80 and 443 through the proxy only when the sandbox has [secrets](./secrets.md).                         |
| **Max 128 entries**     | `allow_cidrs` and `allow_domains` combined. Duplicate entries are stored once but count toward the limit as sent.                                            |

| **Example**          | **Value**                                           |
| -------------------- | --------------------------------------------------- |
| **Single domain**    | `example.com`                                       |
| **Wildcard domain**  | `*.daytona.io`                                      |
| **Multiple domains** | `["example.com", "*.daytona.io", "api.openai.com"]` |

## Operations

Operations on a network policy are reads and changes made after a sandbox exists. They let its network access change while the sandbox itself stays in place.

A sandbox carries two policies: the desired policy, the last one requested, and the applied policy, the one in force. A change takes effect once the sandbox applies it, and each update names the revision it replaces, so two clients cannot overwrite each other's changes.

Use the SDKs or the API to get, update, and reset the network policy of an existing sandbox without recreating it. The CLI can set a network policy only when it creates a sandbox.

### Get network policy

Get the network policy of a sandbox to see its restrictions and status. A policy read reports the rules a sandbox is meant to have and whether those rules are in force.

A read of the network policy of a sandbox shows the desired policy, the last one set, next to the applied policy, the last one the sandbox applied. A change is applied in the background, so the applied policy trails the desired policy until the sandbox has caught up with it.

Use the result to check the status after an update or reset, and to read the ETag that identifies the current revision. An update or reset must send that ETag back. The applied policy is in force only while the policy status of the sandbox reads applied.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create(network_policy={"block_all": True})

policy = sandbox.get_network_policy()
print(policy.status, policy.desired, policy.applied, policy.etag)
```

> **Notes:**
>
> - **Prerequisites:** The sandbox must be a Linux or macOS sandbox.

### Update network policy

Update a network policy to replace the restrictions of an existing sandbox, for example to block all egress once its dependencies are installed with open egress. A policy update swaps one set of network rules for another without recreating the sandbox.

An update replaces the whole policy, with the same format and rules as at [create time](#create-sandboxes-with-network-restrictions). The new policy is stored at once and applied in the background.

Send the ETag of the revision the update replaces. An accepted update returns the status pending, and a paused or stopped sandbox applies it the next time it runs. If the sandbox cannot apply the policy, the status reads failed and the policy is retried. Until a valid update or a reset applies, a Linux sandbox blocks all outbound traffic, including traffic the earlier policy allowed.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

current = sandbox.get_network_policy()
updated = sandbox.update_network_policy(
    network_policy={"block_all": True, "allow_domains": ["pypi.org", "files.pythonhosted.org"]},
    if_match=current.etag,
)
print(updated.status)  # pending until the sandbox applies it
```

| **Parameter** | **Description** |
| --- | --- |
| `network_policy` | Sets the full new outbound network policy.<br />**Required**<br />**Format:** block_all, allow_domains, and allow_cidrs, as at [create](#create-sandboxes-with-network-restrictions)<br />**Example:** `{"block_all": True, "allow_domains": ["pypi.org"]}` |
| `if_match` | Sets the revision token of the policy that the update replaces.<br />**Required**<br />**Format:** the etag field of the last get or update |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be a Linux or macOS sandbox that is running, paused, or stopped.
> - **Polling:** Get the network policy until its status is `applied`, because the update applies in the background.
> - **Recovery:** An update fails while the sandbox is changing state, such as booting, pausing, or stopping, so retry once the sandbox is running, paused, or stopped. An update with an outdated ETag is rejected so that it cannot overwrite the newer policy; get the policy again, then retry the update with its current ETag.

### Reset network policy

Reset a network policy to remove the restrictions of a sandbox and return it to open egress. A reset clears the rules of a policy and restores the default network access.

A reset removes the restrictions of the policy and increments its revision, as an update does. Like an update, a reset is applied in the background, and it takes effect once the sandbox applies it.

Send the current revision's ETag with each reset, as with an [update](#update-network-policy). A reset returns the status pending. Once it applies, the desired and applied policies are null and the status is applied.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

current = sandbox.get_network_policy()
sandbox.reset_network_policy(if_match=current.etag)
```

| **Parameter** | **Description** |
| --- | --- |
| `if_match` | Sets the revision token of the policy that the reset replaces.<br />**Required**<br />**Format:** the etag field of the last get or update |

> **Notes:**
>
> - **Prerequisites:** The sandbox must be a Linux or macOS sandbox that is running, paused, or stopped.
> - **Polling:** Get the network policy until its status is `applied`, because the reset applies in the background.

### Test network access

Test network access to confirm that a policy allows the destinations you expect and blocks all other destinations, from inside the sandbox it restricts. A network test sends a request to a destination and reports whether it connects, so it checks the policy in force.

The tests check the allow lists only when blocking is on: without a network policy, egress is open and every test succeeds. With blocking on, a test succeeds only when its target is listed.

Run the commands below in the sandbox, for example through [process execution](./process-execution.md), and read the status code or error of each request. Under a domain allow list, DNS refuses unlisted hostnames, so a request to one fails before it connects. A request that skips the lookup, such as one to an IP address on port 80 or 443, returns status 403 when its host is not on the allow list.

**CLI:**

```bash
# Test HTTP connectivity to an allowed address; needs 208.80.152.0/22 on the network allow list and no domain allow list
curl -I --connect-timeout 10 http://208.80.154.232
# An HTTP status such as 301 when allowed, 403 when the policy has a domain allow list, a connection timeout when blocked

# Test HTTP connectivity to an allowed domain; needs example.com on the domain allow list
curl -I --connect-timeout 10 https://example.com
# 200 when allowed, "Could not resolve host" when blocked

# In a sandbox image without curl, run the same tests with Python
# Test HTTP connectivity to an allowed address; needs 208.80.152.0/22 on the network allow list and no domain allow list
python3 -c "import http.client as h; c = h.HTTPConnection('208.80.154.232', timeout=10); c.request('HEAD', '/'); print(c.getresponse().status)"
# An HTTP status such as 301 when allowed, 403 when the policy has a domain allow list, TimeoutError when blocked

# Test HTTP connectivity to an allowed domain; needs example.com on the domain allow list
python3 -c "import urllib.request as u; print(u.urlopen('https://example.com', timeout=10).status)"
# 200 when allowed, a name resolution error when blocked
```

| **Flag** | **Description** |
| --- | --- |
| `--connect-timeout` | Sets the seconds that curl waits for the connection.<br />**Example:** `10` |
| `-I` | Sends a HEAD request and prints only the response headers. |

## Permissions

Network policies belong to a sandbox and use the sandbox permissions of its project. Two permissions govern access, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

The [audit logs](./audit-logs.md) record network policy updates.

| **Permission**        | **Grants**                                                                         |
| --------------------- | ---------------------------------------------------------------------------------- |
| **`read:sandboxes`**  | Get the network policy of a sandbox                                                |
| **`write:sandboxes`** | Create sandboxes with network restrictions, and update or reset the network policy |
