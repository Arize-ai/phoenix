# Preemption (TypeScript SDK)

Discounted spot sandboxes that Daytona can reclaim when it needs capacity.

Preemption is the reclaiming of the resources of a running sandbox so that another sandbox can use them. Capacity that can be reclaimed, known as spot capacity, sells at a lower price than capacity that cannot. A preemptible sandbox trades a guarantee of continuous running for a lower price, which suits work that can stop and start again.

Sandboxes run on reserved capacity by default: once placed, a sandbox keeps its resources until it is deleted. A spot sandbox is preemptible: it is billed at a discount, and the platform can reclaim it at any time to free capacity for full-price sandboxes. The tier of a sandbox is set when the sandbox is created and cannot be changed afterwards.

Use spot sandboxes for work that tolerates an interruption in exchange for a lower price, and keep results in storage outside the sandbox, such as your own object storage. A reclaimed ephemeral spot sandbox is deleted, with its filesystem, so continue its work in a new sandbox. A reclaimed persistent [Windows](../platform/windows-sandboxes.md) spot sandbox is stopped with its disk kept, and a start of that sandbox boots Windows from the preserved disk.

| **Concept**    | **Description**                                                                             |
| -------------- | ------------------------------------------------------------------------------------------- |
| **Preemption** | The reclaiming of the resources of a running sandbox so that another workload can use them. |
| **Spot**       | A sandbox on discounted spare capacity that the platform can reclaim at any time.           |
| **On-demand**  | A sandbox on reserved capacity that keeps its resources until it is deleted.                |
| **Reclaim**    | The taking back of the capacity of a running spot sandbox.                                  |
| **Ephemeral**  | A sandbox whose filesystem is discarded when the sandbox is deleted.                        |
| **Persistent** | A sandbox that keeps its disk across stop and start.                                        |

## Contents

- [Use cases](#use-cases)
- [Spot sandboxes](#spot-sandboxes)
- [Reclaim policy](#reclaim-policy)
- [Reclaim outcomes](#reclaim-outcomes)
- [Reclaim detection](#reclaim-detection)
- [Reclaim recovery](#reclaim-recovery)
- [Opt in to preemption](#opt-in-to-preemption)

## Use cases

Spot sandboxes are used for work that tolerates an interruption in exchange for a lower price.

- **Batch jobs.** Data processing, builds, and test runs start again from the beginning when a sandbox is reclaimed. Each job opts in to spot when its sandbox is created, and the tier cannot change afterwards.

- **Evaluation and reinforcement learning (RL).** Many short test cases or episodes run on spot sandboxes. A reclaimed test case or episode runs again in a new sandbox. Newer spot sandboxes are reclaimed before older ones, so a reclaim interrupts the least accumulated work first.

- **Stateless workers.** Workers that keep no state in the sandbox lose nothing on a reclaim. A new spot sandbox replaces the reclaimed one. Daytona does not create the replacement on its own, so the application creates it.

- **Results outside the sandbox.** A spot sandbox writes its output to storage outside the sandbox, such as your own object storage, so a reclaim loses only the work in progress. A replacement sandbox continues from the last checkpoint in that storage. The reclaim time on the old sandbox tells a reclaim apart from a delete you requested.

- **Development and experiments.** Sandboxes whose loss costs only a restart run at the spot price. A reclaim comes with no warning, and an ephemeral sandbox loses its filesystem. GPU sandboxes cannot be spot, so GPU experiments run at full price.

## Spot sandboxes

Spot sandboxes are sandboxes on spot capacity, which is sold at a lower price and can be reclaimed from a running sandbox. They are the preemptible tier of compute.

A spot sandbox differs from an on-demand sandbox of its type only in price and reclaim.

Create a spot sandbox to run work at a discount when the work can be reclaimed. See [pricing](https://www.daytona.com/pricing) for the spot discount. Linux and Windows sandboxes can be spot, and GPU and macOS sandboxes cannot. A sandbox that is created from a [snapshot](./snapshots.md) is always an on-demand sandbox, including when the snapshot itself was taken from a spot sandbox.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

const sandbox = await daytona.v2.create({ spot: true })
```

| **Parameter** | **Description** |
| --- | --- |
| `spot` | Places the sandbox on discounted, reclaimable capacity.<br />**Default:** `false` |

> **Notes:**
>
> - **Permissions:** The request requires the `write:sandboxes` permission.
> - **Results:** The create response has no spot field, so the spot property is `undefined` until a read of the sandbox sets it, such as refreshData() or get().

## Reclaim policy

A reclaim policy is the rule that decides when a platform takes capacity back from preemptible sandboxes, and which sandboxes it takes it from first. A preemptible sandbox runs on spare capacity, which the platform takes back when work with a higher priority needs it.

The reclaim policy for spot sandboxes acts on each host separately. The CPU, memory, and disk reserved on each host are tracked, and when the reservation of any of the three crosses a threshold, running spot sandboxes on that host are reclaimed until the projected reservation drops below it. On-demand sandboxes are never reclaimed.

Plan for a reclaim to happen at any time, and create a replacement sandbox when a reclaim happens. A reclaim is immediate, and Daytona gives neither the sandbox nor your application advance notice or a grace period. A reclaimed sandbox is [billed](../platform/billing.md) like a sandbox that you delete, pause, or stop. Newer spot sandboxes on a host are reclaimed before older ones, so a reclaim interrupts the least accumulated work on the host first.

## Reclaim outcomes

A reclaim outcome is the state that a preemptible sandbox is left in after its capacity is taken back. It decides which data of the sandbox survives.

The reclaim time of a spot sandbox is recorded first. An ephemeral sandbox is then torn down like on a user request: the sandbox is deleted, and only data in storage outside the sandbox remains. A persistent Windows sandbox is stopped, since Windows cannot pause.

Keep the data that must survive a reclaim in storage outside the sandbox, and start a stopped Windows sandbox to boot it from its preserved disk. See the [Linux sandbox lifecycle](./linux-sandboxes.md#lifecycle) for the full state model of a sandbox, with every state and transition.

## Reclaim detection

Reclaim detection tells a reclaim apart from a delete that the owner of a sandbox requested. Both end the sandbox, and only a record of the reclaim shows which of the two happened.

The reclaim time of a sandbox stays on it until the sandbox is started or resumed, and a sandbox that was never reclaimed has none.

Keep the ID of each spot sandbox you create, and read the sandbox as soon as you notice an interruption. A reclaimed ephemeral sandbox is deleted, and a deleted sandbox is left out of [list](./sandboxes.md#list-sandboxes) and [search](./sandboxes.md#search-sandboxes) results, so its reclaim time is read by ID. The record of a deleted sandbox stays readable by ID until Daytona purges it, after which the sandbox is no longer found.

```typescript
import { Daytona, DaytonaNotFoundError } from '@daytona/sdk'

const daytona = new Daytona()

try {
  const sandbox = await daytona.v2.get('{sandboxId}')

  // undefined unless the platform reclaimed this spot sandbox
  if (sandbox.spotEvictedAt) {
    console.log(`reclaimed at ${sandbox.spotEvictedAt}, state: ${sandbox.state}`)
  }
} catch (error) {
  if (!(error instanceof DaytonaNotFoundError)) throw error

  // The ID is unknown, or Daytona purged the record of the deleted sandbox
  console.log('sandbox not found')
}

// Find spot sandboxes; deleted sandboxes are not returned
const page = await daytona.v2.search({ spot: true })
for (const item of page.items) {
  console.log(item.id, item.state, item.spotEvictedAt)
}
```

| **Parameter** | **Description** |
| --- | --- |
| `spot` | Filters by capacity type.<br />**Default:** both types<br />**Value:** `true` for spot sandboxes only, or `false` for on-demand sandboxes only |

> **Notes:**
>
> - **Permissions:** The requests require the `read:sandboxes` permission.
> - **Results:** Search leaves out deleted sandboxes, so read a reclaimed ephemeral sandbox by its ID.

## Reclaim recovery

Reclaim recovery is the continuation of the work of a reclaimed sandbox in a new one. The new sandbox starts from the data that the reclaimed one stored outside itself.

A reclaimed ephemeral sandbox is gone, so its work continues only in a new sandbox that starts from the data stored outside the reclaimed sandbox.

Read the previous sandbox by the ID you kept when you created it, while its record still exists, as in [reclaim detection](#reclaim-detection). If it was reclaimed, create a new sandbox that continues from the last checkpoint in your own storage. A reclaim cannot be requested, so to test your recovery code, replace the reclaim check with a condition you control.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const previous = await daytona.v2.get('{sandboxId}')

// A reclaimed sandbox is deleted; only data outside it remains
if (previous.spotEvictedAt) {
  const sandbox = await daytona.v2.create({ spot: true })

  // Continue from the last checkpoint the previous sandbox wrote to your own storage
  const result = await sandbox.process.run('python3 train.py --resume-from s3://my-bucket/checkpoint')

  // A command that fails does not throw; check its exit code
  console.log(result.exitCode, result.output)
}
```

| **Parameter** | **Description** |
| --- | --- |
| `spot` | Places the new sandbox on discounted, reclaimable capacity.<br />**Default:** `false` |

## Opt in to preemption

Opt in to preemption to trade continuous running for a lower price. Preemption suits work that tolerates interruption and can be restarted or continued.

Preemption is chosen per sandbox, when the sandbox is created.

Use spot for batch jobs, evaluation and reinforcement learning rollouts, CI runs, and stateless workers. Keep spot off sandboxes that serve live traffic or hold state that exists nowhere else. Checkpoint to storage outside the sandbox from spot sandboxes, so a replacement sandbox can continue where the reclaimed one stopped. When a sandbox stops responding or changes state unexpectedly, read its [reclaim time](#reclaim-detection) to tell a reclaim apart from a failure.
