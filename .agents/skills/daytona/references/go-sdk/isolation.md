## Contents

- Runtime isolation
- Network isolation
- Organization isolation
- See Also




Daytona sandboxes are isolated by default. Code running in a sandbox cannot read another sandbox's filesystem or memory, is not on a shared network with other sandboxes, and its credentials and API access are scoped to its own organization.

Isolation operates at three boundaries:

| **Boundary** | **What is separated**                                        | **Mechanisms**                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime      | Processes, filesystem, memory, and devices of each sandbox   | • <u>[**Sandbox classes**](./sandboxes.md)</u> <br /> • <u>[**Reserved resources**](./sandboxes.md#resources)</u>                                                                      |
| Network      | Traffic entering (ingress) and leaving (egress) each sandbox | • <u>[**Network limits**](./network-limits.md)</u> <br /> • <u>[**Preview authentication**](./preview.md)</u> <br /> • <u>[**Link networks**](./sandboxes.md#linked-sandboxes)</u> |
| Organization | Access to sandboxes, data, and credentials                   | • <u>[**Organizations**](../platform/organizations.md)</u> <br /> • <u>[**API key permissions**](../platform/api-keys.md#permissions--scopes)</u> <br /> • <u>[**Secrets**](./secrets.md)</u>          |

## Runtime isolation

Runtime isolation separates what runs inside one sandbox from the runner it executes on and from every other sandbox. Each sandbox runs as an isolated instance with its own processes, network, filesystem mounts, and inter-process communication: see [architecture](../platform/architecture.md#sandbox-runners) for details.

Resources are part of the runtime boundary. Each sandbox reserves its own **vCPU**, **memory**, and **disk**, enforced as hard limits, so one sandbox cannot consume the resources of another regardless of what its code does. Sandbox classes differ in the kind of boundary they provide:

| **Sandbox class**                          | **Runtime boundary**                                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Container                                  | Isolated container with dedicated namespaces and enforced resource limits. Code runs as root inside the sandbox without affecting the runner.               |
| VM sandboxes <br /> (Linux VM and Windows) | Full virtual machine with its own kernel. The hardware virtualization boundary enables VM-only capabilities: <u>[**pause / resume**](./sandboxes.md#pause--resume-sandboxes)</u>, <u>[**fork**](./sandboxes.md#fork-sandboxes)</u>, and <u>[**hot snapshots**](./snapshots.md#create-snapshot-from-sandbox)</u>. |
| GPU                                        | Isolated container with exclusive GPU allocation: assigned GPU devices belong to one sandbox at a time and are never shared.                                 |

Resource limits are visible inside the sandbox through `cgroup` values. Tools such as `nproc` and `free` read host-level values and do not reflect the sandbox's own limits:

```bash
cat /sys/fs/cgroup/cpu.max      # "<quota> <period>" (cores = quota / period)
cat /sys/fs/cgroup/memory.max   # bytes
df -h /                         # disk
```

## Network isolation

Network isolation controls traffic in each direction separately. Outbound and inbound access are configured per sandbox; sandbox-to-sandbox networking is off unless sandboxes are explicitly linked.

| **Direction**       | **Default**                                          | **Controls**                                                                                                              |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Sandbox to internet | Open on Tier 3 and above; restricted on Tier 1 and 2 | <u>[**Network limits**](./network-limits.md)</u>: block all, CIDR allow list, domain allow list, or <u>[**outbound proxy**](./network-limits.md#outbound-proxy)</u> |
| Internet to sandbox | Authenticated preview URLs and SSH access            | <u>[**Preview tokens and signed URLs**](./preview.md)</u> and <u>[**SSH tokens**](./ssh-access.md)</u>; the **`public`** flag opts previews out of authentication |
| Sandbox to sandbox  | No shared network                                    | <u>[**Linked sandboxes**](./sandboxes.md#linked-sandboxes)</u> join a parent and its children into a link network     |

**Outbound:**

**Outbound** traffic passes a per-sandbox firewall. [Tier-based restrictions](./network-limits.md#tier-based-network-restrictions) apply automatically, and each sandbox can be locked down further with one of three mutually exclusive settings: block all traffic, allow specific CIDR ranges, or allow specific domains. Under the default tier policy, [essential services](./network-limits.md#essential-services) such as package registries stay reachable on all tiers. A sandbox-level allow list or block-all setting on Tier 3 or Tier 4 is strict: essential services do not bypass it.

```go
package main

import (
	"context"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()

	// Block all outbound traffic
	_, err := client.Create(ctx, types.SnapshotParams{
		SandboxBaseParams: types.SandboxBaseParams{
			NetworkBlockAll: true,
		},
	})
	if err != nil {
		// handle error
	}

	// Or allow specific domains only
	domainAllowList := "example.com,*.daytona.io"
	_, err = client.Create(ctx, types.SnapshotParams{
		SandboxBaseParams: types.SandboxBaseParams{
			DomainAllowList: &domainAllowList,
		},
	})
	if err != nil {
		// handle error
	}

	// Or allow specific CIDR ranges only
	networkAllowList := "208.80.154.232/32,192.168.1.0/24"
	_, err = client.Create(ctx, types.SnapshotParams{
		SandboxBaseParams: types.SandboxBaseParams{
			NetworkAllowList: &networkAllowList,
		},
	})
	if err != nil {
		// handle error
	}
}
```

**Inbound:**

**Inbound** traffic reaches a sandbox through [preview URLs](./preview.md) or [SSH access](./ssh-access.md), and both paths are authenticated: preview URLs require a preview token or a signed URL unless the sandbox is explicitly made public, and SSH connections require an SSH access token.

```go
package main

import (
	"context"
	"fmt"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()

	sandbox, err := client.Create(ctx, types.SnapshotParams{})
	if err != nil {
		// handle error
	}

	// Preview URLs require a token unless the sandbox is public
	preview, err := sandbox.GetPreviewLink(ctx, 3000)
	if err != nil {
		// handle error
	}
	fmt.Println(preview.URL)   // https://3000-{sandboxId}.{proxy-domain}
	fmt.Println(preview.Token) // sent via the x-daytona-preview-token header
}
```

**Between sandboxes:**

**Between sandboxes**, there is no shared network. [Linked sandboxes](./sandboxes.md#linked-sandboxes) are the deliberate exception: children are scheduled onto the same runner as their parent and joined into a link network where each sandbox is reachable by name, while remaining isolated from every sandbox outside the group.

```go
package main

import (
	"context"
	"fmt"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()

	parent, err := client.Create(ctx, types.SnapshotParams{})
	if err != nil {
		// handle error
	}

	// Only linked sandboxes share a network; everything else is isolated
	child, err := client.Create(ctx, types.SnapshotParams{
		SandboxBaseParams: types.SandboxBaseParams{
			LinkedSandbox: parent.ID,
			Ephemeral:     true,
		},
	})
	if err != nil {
		// handle error
	}

	// Sandboxes on the link network are reachable by name
	response, err := child.Process.ExecuteCommand(
		ctx, fmt.Sprintf("curl http://%s:3000/", parent.Name),
	)
	if err != nil {
		// handle error
	}
	fmt.Println(response.Result)
}
```

## Organization isolation

Organization isolation separates tenants. Every sandbox, snapshot, and volume belongs to exactly one [organization](../platform/organizations.md), and access control is enforced at that boundary: an API key from one organization cannot see or operate on another organization's resources.

Within an organization, access narrows further to the following mechanisms:

**Scoped API keys:**

**[API key permissions](../platform/api-keys.md#permissions--scopes)** scope what a key can do. A key issued with only `write:sandboxes` cannot delete snapshots or read volumes.

**[Managed API keys](../platform/api-keys.md#managed-api-keys)** issue scoped child keys at runtime, so a multi-tenant application can hand each tenant a key limited to its own operations.

```bash
# A manager key issues a child key scoped to one tenant's operations;
# child key permissions must be a subset of the manager key's permissions
curl 'https://app.daytona.io/api/api-keys' \
  --request POST \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_MANAGER_API_KEY' \
  --data '{
  "name": "tenant-a-key",
  "permissions": ["write:sandboxes", "delete:sandboxes"]
}'
```

**Secrets:**

**[Secrets](./secrets.md)** keep credentials out of sandboxes entirely. A sandbox holds an opaque placeholder; an outbound proxy substitutes the real value only for requests to the secret's allowed hosts. Code in the sandbox can use the credential but cannot read it or send it anywhere else.

```python
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

# The sandbox receives a placeholder, never the plaintext value
sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    secrets={
        "MY_API_KEY": "my-secret",
    },
))

# Code uses the credential without being able to read it
sandbox.process.exec(
    'curl -H "Authorization: Bearer $MY_API_KEY" https://api.example.com/v1/data'
)
```

**Volume subpath:**

**[Volumes](./volumes.md)** scope shared data with a `subpath`, so each sandbox mounts only its tenant's slice of a shared volume.

```python
from daytona import CreateSandboxFromSnapshotParams, Daytona, VolumeMount

daytona = Daytona()
volume = daytona.volume.get("tenant-data", create=True)

# Each sandbox mounts only its tenant's slice of the shared volume
sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    volumes=[VolumeMount(
        volume_id=volume.id,
        mount_path="/home/daytona/data",
        subpath="tenants/tenant-a",
    )],
))
```

## See Also
- [Python SDK - isolation](../python-sdk/isolation.md)
- [TypeScript SDK - isolation](../typescript-sdk/isolation.md)
- [Java SDK - isolation](../java-sdk/isolation.md)
