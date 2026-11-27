# Regions (TypeScript SDK)

Geographic locations where sandboxes run.

Regions are geographic or logical areas in which sandboxes run. The region of a sandbox sets the physical distance between the sandbox and its users and data, and with it the latency between them. The region also sets where data is stored and processed.

Daytona runs every sandbox in a **region** and places it on available capacity within that region. Regions nest, so a broad region such as Earth covers the narrower regions inside it.

Use a region to place sandboxes close to their users and data, and to set the price multiplier that a sandbox is billed at. Choose the region when you create a sandbox, and read the regions an organization can use before you choose.

## Create sandboxes in a region

Create sandboxes in a region to run them in a chosen area. Placement is the choice of the host that a workload runs on, within the area that the workload is allowed to use.

A create in a region places the sandbox on a host inside that region. A create that names a region covering other regions, such as Earth, places the sandbox in one of the regions inside it.

Set the region in the create request of a sandbox. A create that names a covering region is refused when no region inside it is available.

| **Region** | **ID** | **Multiplier** |
| --- | --- | --- |
| **Earth** | `earth` | 1.0× |
| `└─` **United States** | `us` | 1.15× |
| `   └─` **US East** | `us-east` | 1.75× |
| `      ├─` **Ashburn** | `us-east-ash-1` | 2.0× |
| `      ├─` **Boston** | `us-east-bos-1` | 2.0× |
| `      └─` **N. Virginia** | `us-east-iad-1` | 2.0× |

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

// Create a sandbox anywhere in Earth
const sandbox = await daytona.v2.create({ region: 'earth' })
```

| **Parameter** | **Description** |
| --- | --- |
| `region` | Sets the region.<br />**Default:** the project's default region, then the organization's, then `earth`<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, `us-east-iad-1`, or the ID of a [BYOC region](./bring-your-own-compute.md) of the organization<br />**Example:** `'earth'` |

> **Notes:**
>
> - **Permissions:** The request requires the `write:sandboxes` permission.
> - **Results:** The region of the returned sandbox is the region that the create named, such as `earth`, until the sandbox is read again.
> - **Recovery:** A create refused because placement passed its deadline or met database contention can be retried with the same idempotency key.
> - **Behaviour:** The SDKs and the CLI send an idempotency key with every create.

## Operations

Operations on regions are reads of the locations that a platform offers. A client reads them to choose where a sandbox runs and what it costs there.

The regions of an organization form a hierarchy, with Earth at the root and each region inside the region that covers it. Operations on regions only read that hierarchy and its prices.

Use the operations below to [list regions](#list-regions) before a create request names one, and to [list region price multipliers](#list-region-price-multipliers) before you choose a region by cost.

### List regions

List regions to see every region that a create request can name. A region list is a catalog of the locations where a sandbox can run, together with the structure that groups them.

An organization's region list is a flat list in tree order: Earth first, then each region followed by the regions inside it. Each region names its parents, so a client can rebuild the hierarchy.

Use the list to choose the region of a sandbox before you create it. Regions that cannot be used are left out. A region that covers others stays listed when none of them accepts automatic placement, marked as unavailable, and cannot be named in a create request.

**CLI:**

```bash
# Regions available to the organization, as NAME, ID, PRICE MULTIPLIER, and AVAILABLE columns
daytona region list

# Print each region with its parent_region_ids as JSON
daytona region list --output json
```

> **Notes:**
>
> - **Permissions:** The PRICE MULTIPLIER column requires `read:billing` permission in the selected organization.

**API:**

```bash
# Regions available to the organization of the API key
curl 'https://api.daytona.com/regions' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

### List region price multipliers

List region price multipliers to see what a sandbox costs in each region. A price multiplier is a factor that a base price is multiplied by to give the price in one location.

The price multiplier of a region applies to every sandbox whose create request named that region, and covers the CPU, memory, and disk of the sandbox.

Use the multipliers to compare the cost of regions before you choose one. The list holds every region with a price of its own, Earth first, then the others by ID, and an unlisted region is billed at Earth's multiplier. A create request that names no region is billed at its default region's multiplier, or at Earth's when no default is set. See [billing](../platform/billing.md#pricing-dimensions) for the other pricing dimensions of a sandbox.

**CLI:**

```bash
# The PRICE MULTIPLIER column of the region list
daytona region list
```

> **Notes:**
>
> - **Permissions:** The PRICE MULTIPLIER column requires `read:billing` permission in the selected organization.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/billing/region-multipliers' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `org_id` | Sets the organization to read.<br />**Format:** an organization ID |

> **Notes:**
>
> - **Permissions:** The request requires the `read:billing` permission.
> - **Prerequisites:** The request requires a signed-in user token or an [organization API key](./api-keys.md#organization-api-keys).
