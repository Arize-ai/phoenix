

Every Daytona sandbox runs in a **region**: a geographic or logical grouping of compute infrastructure. When creating a sandbox, you can target a specific region, and Daytona schedules the workload on available capacity within that region.

## Shared regions

Regions managed by Daytona and available to all organizations:

| **Region**    | **Target** |
| ------------- | ---------- |
| United States | **`us`**   |
| Europe        | **`eu`**   |

```typescript
import { Daytona } from '@daytona/sdk'

// Configure Daytona to use the US region
const daytona = new Daytona({
  target: 'us',
})

// Create a sandbox in the US region
const sandbox = await daytona.create()
```

List regions managed by Daytona and available to all organizations:

**API:**

```bash
curl 'https://app.daytona.io/api/shared-regions' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## Earth region

[GPU sandboxes](./sandboxes.md#gpu-sandboxes) and [GPU snapshots](./snapshots.md#gpu-snapshots) on shared regions belong to the **Earth** region: a global region that spans the shared GPU fleet. Daytona selects the shared region a GPU workload runs in and ignores the region preference.

Earth is not a physical region. It is not returned by the regions or shared regions endpoints, and it is a reserved region ID that cannot be assigned to a [custom region](#custom-regions). GPU sandboxes and snapshots on [dedicated](#dedicated-regions) and [custom](#custom-regions) regions keep their real region ID and remain targetable.

The Earth region ID appears in:

- **`target`** of a GPU sandbox on a shared region
- **`regionIds`** of a GPU snapshot on a shared region
- **`regionUsage`** entries of the [usage overview](../platform/organizations.md#usage-overview): one **`earth`** entry per sandbox class aggregates the shared GPU quota and usage; shared region entries report no GPU quota
- [Available sandbox classes](../platform/organizations.md#list-available-sandbox-classes): one **`earth`** entry per sandbox class with **`gpuAvailable`** and **`allowedGpuTypes`**; shared region entries report **`gpuAvailable: false`**
- **Region quota of a GPU sandbox**: GPU quota fields aggregated under **`earth`**
- **`region.id`** attribute of the GPU [organization metrics](https://www.daytona.io/docs/en/observability/otel-collection#organization-metrics)
- **Error messages** that reference the region of a GPU workload

## Dedicated regions

Dedicated regions are managed by Daytona and provisioned exclusively for an organization. The infrastructure is not shared with other organizations, and Daytona operates it as a managed service.
> **Note:**
> Contact [sales@daytona.io](mailto:sales@daytona.io) to set up a dedicated region for your organization.

## Custom regions

Custom regions run on compute that your organization provides and manages. Attach your own machines through [bring your own compute (BYOC)](https://www.daytona.io/docs/en/bring-your-own-compute) to control data locality, compliance, and infrastructure configuration, and scale capacity independently within each region.

Custom regions have no limits on concurrent resource usage: capacity is bounded only by the compute you attach.

## See Also
- [Python SDK - regions](../python-sdk/regions.md)
