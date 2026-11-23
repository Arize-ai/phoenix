## Contents

- Custom regions
- Deployment
- See Also




Bring Your Own Compute enables you to run sandbox workloads on your own infrastructure while using Daytona's control plane to manage them.

Daytona provides two [built-in regions](../python-sdk/regions.md) (**US** and **EU**) for shared compute resources and handling provisioning, maintenance, monitoring, and scaling on your behalf.

You can define one or more [custom regions](#custom-regions) and attach your own runner nodes. Custom regions can also include a region-specific sandbox proxy service and snapshot manager service.
> **Note:**
> Bring Your Own Compute must be enabled for your organization.

## Custom regions

Custom regions are created and managed by your organization, allowing you to use your own runner nodes and infrastructure and scale compute resources independently within each region. This provides maximum control over data locality, compliance, and infrastructure configuration.

Additionally, custom regions have no limits applied for concurrent resource usage, giving you full control over capacity and performance.

### Create a custom region

Create a custom region.

1. Go to [Daytona Regions ↗](https://app.daytona.io/dashboard/regions)
2. Click <Button>Create Region</Button>
3. Enter the **region name**, **proxy URL**, **SSH gateway URL**, and **snapshot manager URL**
   - **Region name**: a unique identifier; must contain only letters, numbers, underscores, periods, and hyphens
   - **Proxy URL** (optional): the URL of the proxy service that routes traffic to sandboxes
   - **SSH gateway URL** (optional): the URL of the SSH gateway that handles SSH connections to sandboxes
   - **Snapshot manager URL** (optional): the URL of the snapshot manager that handles storage and retrieval
4. Click <Button>Create</Button>

**API:**

```bash
curl https://app.daytona.io/api/regions \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
    "name": "my-custom-region",
    "proxyUrl": "https://proxy.example.com",
    "sshGatewayUrl": "ssh://ssh-gateway.example.com",
    "snapshotManagerUrl": "https://snapshot-manager.example.com"
  }'
```

### List custom regions

List all available regions for your organization.

1. Go to [Daytona Regions ↗](https://app.daytona.io/dashboard/regions)
2. The list of regions is displayed in the **Regions** table with the following columns:
   - **Name**: the name of the region
   - **ID**: the ID of the region
   - **Created**: the date and time the region was created

**API:**

```bash
curl https://app.daytona.io/api/regions \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

### Get a custom region

Get the details of a specific region.

1. Go to [Daytona Regions ↗](https://app.daytona.io/dashboard/regions)
2. Click the region you want to get the details of
3. The region details are displayed in the **Region Details** panel with the following information:
   - **Name**: the name of the region
   - **ID**: the ID of the region
   - **Created**: the date and time the region was created
   - **URLs**: the URLs of the region's proxy, SSH gateway, and snapshot manager services

**API:**

```bash
curl https://app.daytona.io/api/regions/{regionId} \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

### Update a custom region

Update the configuration of an existing custom region.

1. Go to [Daytona Regions ↗](https://app.daytona.io/dashboard/regions)
2. Click the region you want to update the configuration of
3. Click the three dots menu (**⋮**) next to the region and select the <Button>Edit</Button> icon
4. Enter the new **proxy URL**, **SSH gateway URL**, and **snapshot manager URL**
    - **Proxy URL** (optional): the new URL of the custom proxy
    - **SSH gateway URL** (optional): the new URL of the custom SSH gateway
    - **Snapshot manager URL** (optional): the new URL of the custom snapshot manager

5. Click <Button>Update</Button>

**API:**

```bash
curl https://app.daytona.io/api/regions/{regionId} \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
    "proxyUrl": "https://new-proxy.example.com",
    "sshGatewayUrl": "ssh://new-ssh-gateway.example.com",
    "snapshotManagerUrl": "https://new-snapshot-manager.example.com"
  }'
```

### Delete a custom region

Delete a custom region. Regions that have runners assigned to them cannot be deleted.

1. Go to [Daytona Regions ↗](https://app.daytona.io/dashboard/regions)
2. Click the region you want to delete
3. Click the three dots menu (**⋮**) next to the region and select <Button>Delete</Button>
4. Confirm the deletion

**API:**

```bash
curl https://app.daytona.io/api/regions/{regionId} \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## Deployment

Daytona provides official Helm charts for provisioning and operating custom regions with your own compute infrastructure.

### Helm charts

Daytona provides Helm charts for deploying region-scoped Daytona services on Kubernetes. The `daytona-region` chart is focused on custom region infrastructure and deploys the region proxy, optional snapshot manager, and registration job required to operate that region in your cluster.

View the full documentation and examples in the GitHub repository:

- [daytonaio/helm-charts](https://github.com/daytonaio/helm-charts)

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
