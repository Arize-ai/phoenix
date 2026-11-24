# Bring Your Own Compute (Python SDK)

Regions whose sandboxes run on hosts in your own Kubernetes cluster.

Bring your own compute (BYOC) is the running of sandboxes on machines that an organization owns, in its own cloud account or data center. It keeps sandboxes, their data, and their network traffic on infrastructure that the organization controls.

Daytona runs the sandboxes of a BYOC region on hosts in a Kubernetes cluster of the organization, as Firecracker microVMs on nodes with hardware virtualization. A BYOC region belongs to one organization and sits inside a parent region. The hosts connect out to the platform, and a region proxy in the cluster carries the traffic to the sandboxes. The region keeps its hosts until they are removed, and can be deleted only when no host or sandbox remains.

Use BYOC to run sandboxes where data and network rules need them, on your hardware. BYOC needs the Enterprise plan: [contact support](https://www.daytona.com/contact) to add it to your organization. Manage regions from the dashboard or the API, with a signed-in user token or an [organization API key](./api-keys.md#organization-api-keys).

| **Concept**               | **Description**                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **BYOC region**           | A region of one organization whose sandboxes run on the hosts of that organization.                                  |
| **Parent region**         | The region of the platform that a BYOC region sits inside.                                                           |
| **Host**                  | A Kubernetes node with hardware virtualization that runs the sandboxes of a region, called a runner in the API and the dashboard. |
| **Registration token**    | A secret that enrolls hosts into one BYOC region.                                                                    |
| **Region proxy**          | The proxy in the cluster of the organization that carries toolbox and preview traffic to the sandboxes of a region. |
| **Proxy token**           | A secret that the region proxy authenticates with.                                                                   |
| **Sandbox address range** | The private IPv4 range that the sandboxes of a region get their addresses from, split into one subnet per host.      |
| **Cordon**                | A state of a host in which its sandboxes keep running and no new sandbox is placed on it.                            |

## Contents

- [Use cases](#use-cases)
- [Create a region](#create-a-region)
- [Create a registration token](#create-a-registration-token)
- [Region proxy](#region-proxy)
- [Install hosts](#install-hosts)
- [Create sandboxes in a region](#create-sandboxes-in-a-region)
- [Cordon a host](#cordon-a-host)
- [Operations](#operations)
- [Permissions](#permissions)

## Use cases

BYOC fits workloads whose sandboxes must run on machines and networks that the organization runs itself, not on shared hosts of the platform.

- **Data residency.** Sandboxes, their files, and their processes stay on hosts in a cluster the organization runs. A sandbox is placed in the region only when its create request names it.

- **Private network traffic.** The region proxy runs in the cluster of the organization, so toolbox and preview traffic to the sandboxes stays in its network. Sandbox addresses come from a private IPv4 range that the organization chooses at create.

- **Own hardware.** Sandboxes run on nodes that the organization picks: bare-metal machines, or virtual machines with nested virtualization. A host that needs maintenance is cordoned, so its sandboxes keep running and new sandboxes go to the other hosts.

## Create a region

Create a region to add a location whose sandboxes run on the hosts of an organization. A region is a named area in which sandboxes are placed, and it groups the hosts that run them.

A create of a BYOC region adds an empty region under the chosen parent region, and the platform generates its ID. The sandbox address range of the region is fixed at create.

Create a region before you create its tokens and install its hosts. Choose the parent region from the parent regions that the organization may use. Without a range, the region gets 10.213.0.0/16 with a /24 subnet per host. Each organization has a region limit.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click **Create Region**
3. Enter the name
4. Select the parent region
5. Click **Create Region**

**API:**

```bash
# Parent regions that the organization may create a region under
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/parent-regions' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'

# Create the region; the response holds its generated ID
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY' \
  --data '{
  "name": "on-prem-frankfurt",
  "parent_region_id": "PARENT_REGION_ID",
  "sandbox_cidr": "172.20.0.0/16",
  "subnet_prefix_length": 24
}'
```

| **Field** | **Description** |
| --- | --- |
| `name` | Sets the display name of the region.<br />**Required**<br />**Format:** 1 to 100 characters, with no control characters<br />**Example:** `"on-prem-frankfurt"` |
| `parent_region_id` | Sets the parent region.<br />**Required**<br />**Format:** an ID from the parent regions of the organization |
| `sandbox_cidr` | Sets the private IPv4 range that sandbox addresses come from.<br />**Default:** `"10.213.0.0/16"`<br />**Format:** an IPv4 CIDR block inside 10.0.0.0/8, 172.16.0.0/12, or 192.168.0.0/16, with a prefix length from 12 to 20 and no host bits<br />**Example:** `"172.20.0.0/16"` |
| `subnet_prefix_length` | Sets the prefix length of the subnet of each host.<br />**Default:** `24`<br />**Minimum:** `22`<br />**Maximum:** `28`<br />**Format:** longer than the prefix length of sandbox_cidr |

> **Notes:**
>
> - **Prerequisites:** The request requires the Enterprise [plan](../platform/billing.md#get-the-plan).
> - **Compatibility:** The sandbox address range must not overlap a range that the cluster already uses.

## Create a registration token

Create a registration token to let hosts join a region. A registration token is a shared secret that a machine presents once to join a group and receive credentials of its own.

A registration token of a BYOC region enrolls hosts into that region only, up to its number of uses and until it expires. Each enrolled host gets its own credentials, so hosts keep working after that registration token expires or after it has been revoked.

Create a registration token before you [install the hosts](#install-hosts). Only the create response returns the token, so store it right away. A token expires after 7 days and enrolls up to 100 hosts unless the create request sets other values for those two limits.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region
3. Open the **Tokens** tab
4. In **Registration tokens**, click **Create Token**
5. Enter the name
6. Click **Create**
7. Copy the token

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/registration-tokens' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY' \
  --data '{
  "name": "cluster-1",
  "expires_in_seconds": 86400,
  "max_uses": 10
}'
```

| **Field** | **Description** |
| --- | --- |
| `name` | Sets the display name of the token.<br />**Required**<br />**Format:** 1 to 100 characters<br />**Example:** `"cluster-1"` |
| `expires_in_seconds` | Sets the seconds until the token expires.<br />**Default:** `604800`<br />**Minimum:** `300`<br />**Maximum:** `2592000` |
| `max_uses` | Sets the number of hosts that the token may enroll.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `1000` |

> **Notes:**
>
> - **Results:** The response holds the secret in the token field, and no later request returns it.

## Region proxy

A region proxy is a proxy server that receives requests addressed to the sandboxes of one region and forwards them to the hosts that run them. It serves their toolbox and preview URLs.

The region proxy of a BYOC region runs in the Kubernetes cluster of the organization and authenticates with a proxy token. Toolbox and preview traffic to the sandboxes of the region passes through it and stays inside the network of the organization.

Run the region proxy with the [install of the hosts](#install-hosts), then set its addresses on the region. Without a region proxy, the sandboxes of the region cannot be reached.

### Create a proxy token

Create a proxy token to give the region proxy its own credential. A token is a secret string that a program presents to prove its identity on each request.

A proxy token of a BYOC region is bound to that region and authenticates one region proxy. Revoking the token disconnects the region proxy that holds it.

Create the token before you install the region proxy. Only the create response returns the token, so store it right away. Set an expiry time or no expiry, but not both.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region
3. Open the **Tokens** tab
4. In **Proxy tokens**, click **Create Token**
5. Enter the name
6. Click **Create**
7. Copy the token

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/proxy-tokens' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY' \
  --data '{
  "name": "region-proxy",
  "no_expiry": true
}'
```

| **Field** | **Description** |
| --- | --- |
| `expires_at` | Sets when the token expires.<br />**Format:** an RFC 3339 time in the future<br />**Rules:** not with no_expiry<br />**Example:** `"2027-01-01T00:00:00Z"` |
| `name` | Sets the display name of the token.<br />**Format:** 1 to 100 characters<br />**Example:** `"region-proxy"` |
| `no_expiry` | Makes the token never expire.<br />**Rules:** not with expires_at |

> **Notes:**
>
> - **Results:** The response holds the secret in the token field, and no later request returns it.

### Rotate a proxy token

Rotate a proxy token to replace it without cutting off the region proxy. Rotation issues a successor credential and retires the old one, so a leaked or aging secret stops working.

A rotation of a proxy token of a BYOC region creates a successor for the same region. The replaced token works for the overlap the request sets, and a token can be rotated once.

Rotate a proxy token on a schedule or when it may have leaked. Set an overlap long enough to give the proxy the new token and restart it. Without an overlap, the old token stops at once.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region
3. Open the **Tokens** tab
4. In **Proxy tokens**, open the actions of the token
5. Click **Rotate**
6. Select how long the current token keeps working
7. Click **Rotate**
8. Copy the new token

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/proxy-tokens/{proxyTokenId}/rotation' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY' \
  --data '{
  "overlap_seconds": 900,
  "no_expiry": true
}'
```

| **Field** | **Description** |
| --- | --- |
| `expires_at` | Sets when the new token expires.<br />**Format:** an RFC 3339 time in the future<br />**Rules:** not with no_expiry<br />**Example:** `"2027-01-01T00:00:00Z"` |
| `name` | Sets the display name of the new token.<br />**Format:** 1 to 100 characters<br />**Example:** `"region-proxy-2"` |
| `no_expiry` | Makes the new token never expire.<br />**Rules:** not with expires_at |
| `overlap_seconds` | Sets the seconds that the replaced token keeps working.<br />**Default:** `0`<br />**Minimum:** `0`<br />**Maximum:** `86400` |

> **Notes:**
>
> - **Results:** The response holds the new secret in the token field, and no later request returns it.

### Set the proxy addresses

Set the proxy addresses to route toolbox and preview URLs of a region to its proxy. A preview domain is the base domain under which each exposed port of a sandbox gets an address.

The proxy URL and the preview domain of a BYOC region apply to every sandbox in the region. Both can be changed or cleared after the region is created.

Set both addresses once the region proxy has a public address. The proxy URL must use the https scheme and end in /toolbox. The preview domain must be unique, and must not be a public suffix such as co.uk or a domain of the platform. Send null to clear either address.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region
3. In **Settings**, enter the **Proxy URL**
4. Enter the **Preview domain**
5. Click **Save**

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}' \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY' \
  --data '{
  "toolbox_proxy_url": "https://proxy.example.com/toolbox",
  "preview_domain": "preview.example.com"
}'
```

| **Field** | **Description** |
| --- | --- |
| `preview_domain` | Sets the base domain of the preview URLs of the region.<br />**Format:** a lowercase DNS name of at least two labels<br />**Value:** `null` to clear<br />**Example:** `"preview.example.com"` |
| `toolbox_proxy_url` | Sets the base URL of the toolbox of the region proxy.<br />**Format:** an https URL that ends in /toolbox, with a host and no credentials, query, or fragment<br />**Value:** `null` to clear<br />**Example:** `"https://proxy.example.com/toolbox"` |

## Install hosts

Install hosts to add the machines that run the sandboxes of a region. An install puts the host software on each node of a cluster and connects the node to the platform.

An install of a BYOC region is a Helm release in the Kubernetes cluster of the organization. Each node with the KVM label enrolls itself as a host with the registration token, and its sandboxes run as Firecracker microVMs outside any Kubernetes pod.

Install the hosts with Helm after you create both tokens. The dashboard also generates Docker, OpenTofu, and Terraform install steps, which create the region and its tokens themselves. Run the install again to upgrade the hosts to the chart version that the region reports.

| **Requirement**      | **Description**                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **KVM nodes**        | amd64 nodes on bare metal or with nested virtualization, labelled `byoc.daytona.com/kvm=true`.                      |
| **Node tools**       | The nftables and conntrack tools on the node image.                                                                |
| **Privileged pods**  | Pod Security admission that allows privileged pods with host networking and the host PID namespace in the install namespace. |
| **Proxy node pool**  | A node pool of its own for the region proxy.                                                                       |
| **Outbound traffic** | TLS to the bus_url, and HTTPS to the api_url and the usage_reporting_url, of the installation values of the region. |
| **Local tools**      | kubectl, and Helm 3.8 or later.                                                                                    |

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region
3. Open the **Install** tab
4. Select **Helm**
5. Copy the commands and run them against the cluster

**CLI:**

```bash
# The tokens from creating a registration token and a proxy token
export DAYTONA_REGISTRATION_TOKEN='YOUR_REGISTRATION_TOKEN'
export DAYTONA_REGION_PROXY_TOKEN='YOUR_PROXY_TOKEN'

kubectl create namespace daytona-byoc
kubectl label namespace daytona-byoc pod-security.kubernetes.io/enforce=privileged
kubectl -n daytona-byoc create secret generic daytona-byoc-tokens \
  --from-literal=DAYTONA_REGISTRATION_TOKEN="$DAYTONA_REGISTRATION_TOKEN" \
  --from-literal=DAYTONA_REGION_PROXY_TOKEN="$DAYTONA_REGION_PROXY_TOKEN"

# The values in capitals come from the installation values of the region
helm upgrade --install daytona-byoc CHART \
  --version CHART_VERSION \
  --namespace daytona-byoc \
  --set region={regionId} \
  --set image.repository=INSTALLER_IMAGE_REPOSITORY \
  --set-string image.tag=INSTALLER_IMAGE_TAG \
  --set proxy.image.repository=PROXY_IMAGE_REPOSITORY \
  --set-string proxy.image.tag=PROXY_IMAGE_TAG \
  --set enrollment.apiUrl=API_URL \
  --set enrollment.tokenSecret.name=daytona-byoc-tokens \
  --set enrollment.tokenSecret.key=DAYTONA_REGISTRATION_TOKEN \
  --set proxy.tokenSecret.name=daytona-byoc-tokens \
  --set proxy.tokenSecret.key=DAYTONA_REGION_PROXY_TOKEN \
  --set proxy.enabled=true \
  --set-json 'proxy.sourceCIDRs=["PROXY_NODE_SUBNET"]' \
  --set-json 'proxy.runnerProxyAllowedCIDRs=["HOST_NODE_SUBNET"]' \
  --set runnerProxy.enabled=true \
  --set runnerProxy.advertise=true
```

| **Flag** | **Description** |
| --- | --- |
| `region` | Sets the region that the hosts enroll in.<br />**Required**<br />**Format:** a BYOC region ID<br />**Example:** `byoc-k3m7q2x7ab` |
| `image.repository` | Sets the repository of the installer image.<br />**Required**<br />**Format:** the installer_image of the installation values, before its last colon |
| `image.tag` | Sets the tag of the installer image.<br />**Required**<br />**Format:** the installer_image of the installation values, after its last colon |
| `proxy.image.repository` | Sets the repository of the region proxy image.<br />**Required**<br />**Format:** the proxy_image of the installation values, before its last colon |
| `proxy.image.tag` | Sets the tag of the region proxy image.<br />**Required**<br />**Format:** the proxy_image of the installation values, after its last colon |
| `enrollment.apiUrl` | Sets the API that the hosts enroll with.<br />**Required**<br />**Format:** the api_url of the installation values |
| `proxy.sourceCIDRs` | Sets the node subnets of the node pool that runs the region proxy.<br />**Required**<br />**Format:** a JSON list of IPv4 CIDR blocks |
| `proxy.runnerProxyAllowedCIDRs` | Sets the node subnets of the KVM nodes that the region proxy connects to.<br />**Required**<br />**Format:** a JSON list of IPv4 CIDR blocks |
| `runnerProxy.advertise` | Makes each host report the address that the region proxy reaches it at.<br />**Required**<br />**Value:** `true` |
| `--version` | Sets the chart version.<br />**Format:** the chart_version of the installation values |

> **Notes:**
>
> - **Order:** Copy the filled-in command from the **Install** tab of the region in the dashboard. Create the namespace and the Secret before you run helm.

**API:**

```bash
# The chart, its version, the images, and the addresses that the hosts connect to
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/installation' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

## Create sandboxes in a region

Create sandboxes in a BYOC region to run them on the hosts of that region. Placement is the choice of the host that a new sandbox starts and runs on.

A create of a sandbox in a BYOC region places it on an active host of that region. Only a create request that names the region places a sandbox there.

Create sandboxes in the region after its hosts are online. Name the region ID in the create request; a create that names the parent region never places a sandbox in the BYOC region. See [regions](./regions.md) for how a create request selects a region.

```python
from daytona import Daytona

daytona = Daytona()

sandbox = daytona.v2.create(region="{regionId}")
```

| **Parameter** | **Description** |
| --- | --- |
| `region` | Sets the region of the sandbox.<br />**Format:** a BYOC region ID<br />**Example:** `"byoc-k3m7q2x7ab"` |

## Cordon a host

Cordon a host to stop the placement of new sandboxes on it. A cordon marks a machine as closed to new work while the work already on it keeps running.

A cordon of a host of a BYOC region keeps its sandboxes running and places new sandboxes on the other hosts of the region. An uncordon lets the host take new sandboxes again.

Cordon a host before maintenance, or before you [remove it](#remove-a-host) once its sandboxes end. A host can be cordoned only after it has connected for the first time.

1. Go to [Daytona Runners ↗](https://app.daytona.com/dashboard/runners)
2. Open the actions of the host
3. Click **Cordon**, or **Uncordon** on a cordoned host

**API:**

```bash
# Cordon
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/runners/{runnerId}/cordon' \
  --request POST \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'

# Uncordon
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/runners/{runnerId}/uncordon' \
  --request POST \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

## Operations

Operations on BYOC regions act on regions, tokens, and hosts that already exist. They read their state, change their settings, and remove what is no longer needed.

Operations on BYOC regions reach only the regions of one organization and the tokens and hosts inside them. Revoking a registration token does not affect the hosts that enrolled with it.

Use the operations below to list and get regions and hosts, rename and delete regions, list and revoke tokens, and remove hosts. A list returns up to 100 items per page by default and 200 at most, with a cursor that continues the list on the next page.

### List regions

List regions to see the BYOC regions of an organization. A paginated list returns a large collection in pages, and each page continues where the previous one ended.

A list of BYOC regions covers one organization and holds each region with its parent region, status, and number of hosts. Regions of the platform are not in it.

List the regions to find the ID of a region or to check how many hosts it has.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions?limit=50' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

### Get a region

Get a region to read its settings and its current state by ID. A get reads one resource by its identifier and changes nothing about it on the server.

A get of a BYOC region by ID returns the same details as its entry in the list of regions, including its proxy addresses and its sandbox address range.

Get a region to check its number of hosts after an install, or its status before you create sandboxes in it. A region with the status disabled accepts no new sandboxes.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

### Rename a region

Rename a region to change the name that people see when they choose it. A rename changes a display label and keeps the identifier that requests use.

A rename of a BYOC region changes its display name only. Its ID stays the same, so sandbox create requests that name the ID keep working unchanged.

Rename a region when its purpose or its location changes. To change its proxy URL and its preview domain instead, see [set the proxy addresses](#set-the-proxy-addresses).

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region
3. In **Settings**, enter the **Name**
4. Click **Save**

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}' \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY' \
  --data '{ "name": "on-prem-berlin" }'
```

| **Field** | **Description** |
| --- | --- |
| `name` | Sets the display name of the region.<br />**Format:** 1 to 100 characters, with no control characters<br />**Example:** `"on-prem-berlin"` |

### Delete a region

Delete a region to remove it from the organization when it no longer runs sandboxes. Deletion removes a resource permanently, together with the data stored only in it.

A deletion of a BYOC region removes it together with its registration and proxy tokens. A region that still has hosts or sandboxes cannot be deleted.

Delete a region after its sandboxes end and you [remove its hosts](#remove-a-host). Uninstall the Helm release from the cluster as well, because deleting the region does not change the cluster.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region
3. Click **Delete Region**
4. Click **Delete**

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

### List registration tokens

List registration tokens to see which tokens can still enroll hosts in a region. A list of credentials shows each one by its metadata, never by its secret.

A list of registration tokens covers one BYOC region, newest first, with the number of uses, the maximum number of uses, and the expiry of each token.

List the tokens to find one to revoke, or to check how many hosts a token has enrolled.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region
3. Open the **Tokens** tab

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/registration-tokens?limit=50' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

### Revoke a registration token

Revoke a registration token to stop new hosts from joining a region with it. Revocation ends the validity of a credential before it would expire on its own.

A revocation of a registration token of a BYOC region blocks new enrollments with it. Hosts that already enrolled with that token keep working as before.

Revoke a token when it may have leaked, or when the region needs no more hosts.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region
3. Open the **Tokens** tab
4. In **Registration tokens**, click **Revoke** on the token
5. Click **Revoke**

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/registration-tokens/{registrationTokenId}' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

### List proxy tokens

List proxy tokens to see the credentials that the region proxy of a region uses. A list of credentials shows each one by its metadata, never by its secret.

A list of proxy tokens covers one BYOC region, newest first, with the expiry and the last use of each token, and the earlier token that it replaced.

List the tokens to check which one the region proxy last used, or to find one to rotate or revoke.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region
3. Open the **Tokens** tab

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/proxy-tokens?limit=50' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

### Revoke a proxy token

Revoke a proxy token to stop the region proxy from authenticating with it. Revocation ends the validity of a credential before it would expire on its own.

A revocation of a proxy token of a BYOC region disconnects the region proxy that holds it.

Revoke a token if it may have leaked. To keep the proxy connected, [rotate it](#rotate-a-proxy-token) instead.

1. Go to [Daytona Regions ↗](https://app.daytona.com/dashboard/regions)
2. Click the region
3. Open the **Tokens** tab
4. In **Proxy tokens**, open the actions of the token
5. Click **Revoke**
6. Click **Revoke**

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/proxy-tokens/{proxyTokenId}' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

### List hosts

List hosts to see the machines that run the sandboxes of a region. A paginated list returns a large collection in pages, and each page continues where the previous one ended.

A list of hosts covers one BYOC region and holds each host with its Kubernetes node name, its connection status, and its number of sandboxes.

List hosts to check that each node enrolled after an install. A host is online, offline, or lost, and active or cordoned.

1. Go to [Daytona Runners ↗](https://app.daytona.com/dashboard/runners)

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/runners?limit=50' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

### Get a host

Get a host to read its current status and its number of sandboxes by ID. A get reads one resource by its identifier and changes nothing on the server.

A get of a host of a BYOC region returns the same details as its entry in the list of hosts, including the time that the platform last heard from that host.

Get a host to check whether it has connected before you cordon it, or whether all of its sandboxes have ended before you remove it from the region.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/runners/{runnerId}' \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

### Remove a host

Remove a host to take a machine out of a region for good. Removal revokes the credentials of the machine, so it can no longer connect to the platform.

A removal of a host of a BYOC region revokes its credentials, and its ID is never used again. A host that still has sandboxes cannot be removed.

[Cordon the host](#cordon-a-host) and wait until its sandboxes end before you remove it. A removed node enrolls again, as a new host, only after you delete the file /etc/daytona/byoc-enrollment.json on that node and restart its installer pod.

1. Go to [Daytona Runners ↗](https://app.daytona.com/dashboard/runners)
2. Open the actions of the host
3. Click **Remove**
4. Click **Remove**

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/regions/{regionId}/runners/{runnerId}' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_ORG_API_KEY'
```

## Permissions

BYOC regions, their tokens, and hosts are scoped to an organization. Six organization permissions govern them, which you grant to an [organization role](./organizations.md#roles) or an [organization API key](./api-keys.md#organization-api-keys).

Creating a sandbox in a BYOC region requires the permission to write sandboxes in its project. The [audit logs](./audit-logs.md) record region creates, updates, and deletes, token creates, rotations, and revocations, and host cordons, uncordons, and removals.

| **Permission**         | **Grants**                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| **`read:regions`**     | List and get regions, their parent regions, their installation values, and their tokens       |
| **`write:regions`**    | Create and rename regions, set their proxy addresses, and create and rotate proxy tokens      |
| **`delete:regions`**   | Delete regions and revoke proxy tokens                                                        |
| **`read:runners`**     | List and get hosts                                                                            |
| **`write:runners`**    | Create registration tokens, and cordon and uncordon hosts                                     |
| **`delete:runners`**   | Revoke registration tokens and remove hosts                                                   |
