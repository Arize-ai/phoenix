

Every Daytona sandbox runs in a **region**: a geographic or logical grouping of compute infrastructure. When creating a sandbox, you can target a specific region, and Daytona schedules the workload on available capacity within that region.

## Shared regions

Regions managed by Daytona and available to all organizations:

| **Region**    | **Target** |
| ------------- | ---------- |
| United States | **`us`**   |
| Europe        | **`eu`**   |

```python
from daytona import Daytona, DaytonaConfig

# Configure Daytona to use the US region
config = DaytonaConfig(
    target="us"
)

# Initialize the Daytona client with the specified configuration
daytona = Daytona(config)

# Create a sandbox in the US region
sandbox = daytona.create()
```

List regions managed by Daytona and available to all organizations:

**API:**

```bash
curl 'https://app.daytona.io/api/shared-regions' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## Dedicated regions

Dedicated regions are managed by Daytona and provisioned exclusively for an organization. The infrastructure is not shared with other organizations, and Daytona operates it as a managed service.
> **Note:**
> Contact [sales@daytona.io](mailto:sales@daytona.io) to set up a dedicated region for your organization.

## Custom regions

Custom regions run on compute that your organization provides and manages. Attach your own machines through [bring your own compute (BYOC)](https://www.daytona.io/docs/en/bring-your-own-compute) to control data locality, compliance, and infrastructure configuration, and scale capacity independently within each region.

Custom regions have no limits on concurrent resource usage: capacity is bounded only by the compute you attach.
