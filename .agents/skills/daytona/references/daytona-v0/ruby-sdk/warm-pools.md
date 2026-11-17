## Contents

- Replenishment
- Limits
- Create a warm pool
- List warm pools
- Resize a warm pool
- Delete a warm pool
- List warm sandboxes
- See Also




Warm pools keep a configured number of pre-created, running sandboxes built from a [snapshot](./snapshots.md) in a specific [region](./regions.md). When you create a sandbox that matches a pool, Daytona hands over a warm sandbox instead of provisioning a new one, so the sandbox is available instantly.

A sandbox create request claims a warm sandbox when all of the following match the pool:

- The same snapshot
- The same target region
- The snapshot's default resources (CPU, memory, and disk)
- The default OS user (`daytona`)
- No custom environment variables, volumes, or secrets

When a request claims a warm sandbox, Daytona applies the name, labels, auto-stop, auto-pause, auto-archive, and auto-delete intervals, and network settings from the create request.
> **Note:**
> Warm pools must be enabled for your organization. Contact [support@daytona.io](mailto:support@daytona.io).

## Replenishment

Daytona replenishes warm pools automatically. Each time a request claims a warm sandbox, Daytona creates a new warm sandbox in the background to bring the pool back to its configured size. No action is required on your side: there is no manual trigger, and you do not need to recreate or resize the pool after sandboxes are claimed.

## Limits

An organization can have one warm pool per snapshot per region. Warm pools are bounded by the total [resources](../platform/limits.md#resources) available to your organization. Warm sandboxes count against your organization quota in the same way as regular sandboxes, so the pool size multiplied by the snapshot's resources must fit within your region quota alongside your other running sandboxes. If the pool cannot be filled within the quota, the `errorReason` field on the pool explains why.

## Create a warm pool

Create a warm pool for a snapshot.

The snapshot must be active and available in the target region. Creating a second pool for the same snapshot and region returns a `409` error.

| **Parameter**  | **Required** | **Description**                                                                       |
| -------------- | ------------ | ------------------------------------------------------------------------------------- |
| **`snapshot`** | Yes          | Snapshot ID or name to keep warm sandboxes for                                         |
| **`pool`**     | Yes          | Number of warm sandboxes to keep ready; minimum **`1`**, capped by the organization quota |
| **`target`**   | No           | Target region for the warm pool; defaults to the organization default region          |

1. Go to [Daytona Snapshots ↗](https://app.daytona.io/dashboard/snapshots)
2. Click the snapshot you want to create a warm pool for
3. In the **Warm Pool** section, select a region and enter the **Pool size**
4. Click <Button>Add warm pool</Button>

```ruby
require 'daytona'

daytona = Daytona::Daytona.new
pool = daytona.warm_pool.create('my-snapshot', 3, target: 'us')
```

## List warm pools

List the warm pools in your organization. Each pool reports the desired size (`pool`) and the number of warm sandboxes currently ready (`currentSize`). If Daytona cannot fill the pool, for example because the snapshot is no longer active, the `errorReason` field explains why.

1. Go to [Daytona Snapshots ↗](https://app.daytona.io/dashboard/snapshots)
2. Click a snapshot to see its warm pools per region in the **Warm Pool** section

```ruby
daytona.warm_pool.list.each do |pool|
  puts "#{pool.snapshot}: #{pool.current_size}/#{pool.pool} ready"
end
```

## Resize a warm pool

Resize a warm pool to change the desired number of warm sandboxes. Daytona converges the pool to the new size in the background: it creates warm sandboxes when the pool is below the target and destroys the newest unclaimed ones when it is above. Setting `pool` to `0` drains the pool without deleting its configuration.

1. Go to [Daytona Snapshots ↗](https://app.daytona.io/dashboard/snapshots)
2. Click the snapshot to resize the warm pool for
3. In the **Warm Pool** section, click <Button>Edit</Button>
4. Enter the new **Pool size** and click <Button>Save</Button>

```ruby
daytona.warm_pool.update(pool.id, 5)
```

## Delete a warm pool

Delete a warm pool and destroy all of its unclaimed warm sandboxes. Sandboxes already claimed from the pool are not affected. Deleting a snapshot also deletes its warm pools.

1. Go to [Daytona Snapshots ↗](https://app.daytona.io/dashboard/snapshots)
2. Click the snapshot to delete the warm pool for
3. In the **Warm Pool** section, click the trash icon
4. Click <Button>Delete</Button> to confirm

```ruby
daytona.warm_pool.delete(pool.id)
```

## List warm sandboxes

Unclaimed warm sandboxes are excluded from sandbox listings by default. Set the `includeWarm` query parameter to include them. While a sandbox waits in a pool, its `warmPoolId` field holds the id of the pool; the field is cleared when the sandbox is claimed.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Enable the **Warm pool** filter; warm sandboxes show a **Warm** badge next to their name

**API:**

```bash
curl 'https://app.daytona.io/api/sandbox?includeWarm=true' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## See Also
- [Python SDK - warm-pools](../python-sdk/warm-pools.md)
- [TypeScript SDK - warm-pools](../typescript-sdk/warm-pools.md)
- [Java SDK - warm-pools](../java-sdk/warm-pools.md)
- [Go SDK - warm-pools](../go-sdk/warm-pools.md)
