## Contents

- Use cases
- Create a GPU sandbox
- Spot
- GPU allocation
- Resources
- Filesystem persistence
- Memory persistence
- Lifecycle
- See Also




Daytona provides **GPU sandboxes** for AI agents doing GPU-accelerated work, such as writing and profiling CUDA kernels, 3D and graphics workloads, and other GPU-accelerated compute. A GPU sandbox is a Linux container sandbox with one or more **NVIDIA** or **AMD** GPUs attached.

GPU sandboxes are ephemeral. Daytona deletes a GPU sandbox when it stops. A GPU sandbox runs on on-demand capacity, which is reserved until the sandbox is deleted, or on spot capacity, which Daytona can reclaim for on-demand sandboxes.

| **Term**          | **Description**                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Sandbox**       | A Linux container sandbox with one or more GPUs attached, created on demand to run GPU code.                       |
| **GPU**           | A processor built for parallel computation. GPU sandboxes attach NVIDIA or AMD GPUs.                               |
| **GPU unit**      | One GPU attached to a sandbox. A create request sets the number of units.                                          |
| **GPU type**      | The GPU model, such as H100 or MI355X. A create request sets one type or an ordered list of types.                |
| **On-demand**     | GPU capacity reserved for the sandbox until it is deleted. On-demand GPU sandboxes count against the GPU quota.    |
| **Spot**          | Preemptible GPU capacity. Daytona deletes a spot GPU sandbox when an on-demand GPU sandbox needs the capacity.    |
| **Region**        | The shared region that runs GPU sandboxes on shared capacity. Daytona reports it as the earth region.              |
| **Volume**        | Shared storage mounted into a sandbox at a path. Data written to the mount path remains after the sandbox is deleted. |

## Use cases

An agent uses a GPU sandbox the way an engineer uses a GPU workstation: a real GPU for GPU-accelerated work, isolated from your infrastructure.

- **CUDA development**: an agent writes a CUDA kernel, compiles it, runs it on a real GPU, profiles it, and iterates on the result, without access to your hosts.
- **3D and graphics workloads**: rendering, geometry processing, and other GPU-accelerated graphics work run on a dedicated GPU instead of on shared hardware.
- **GPU-accelerated compute**: CUDA and ROCm workloads, such as simulation, signal processing, and data processing, run on NVIDIA or AMD GPUs sized for the job.
- **Agent-generated GPU code**: an agent writes PyTorch, CUDA, or other GPU code, runs it on a real GPU, and reads the result. The sandbox is deleted when the work is done.
- **Evaluation and benchmarks**: each kernel, build, or test case runs on its own GPU in a clean environment, so timings and results do not depend on another run.
- **Batch and interruptible jobs**: jobs that tolerate interruption run on [spot](#spot) capacity, and write their results to a volume so nothing is lost when the sandbox is preempted.

## Create a GPU sandbox

Daytona provides **GPU sandboxes** for agents doing GPU-accelerated work, such as writing and profiling CUDA kernels, 3D and graphics workloads, and other GPU-accelerated compute. GPU sandboxes are ephemeral and support up to **8 GPUs**. Resource limits scale with the number of GPU units: each GPU adds up to **16 vCPUs**, **192GB RAM**, and **512GB disk**. Supported **NVIDIA** and **AMD** GPU types:

- **NVIDIA H100**
- **NVIDIA H200**
- **NVIDIA B200**
- **NVIDIA B300**
- **NVIDIA RTX Pro 6000**
- **NVIDIA RTX 4090**
- **NVIDIA RTX 5090**
- **AMD Instinct MI355X**

GPU sandboxes are on-demand. See [spot GPU sandboxes](#spot) for preemptible GPU capacity. Use the [GPU capacity](#gpu-capacity) endpoint to check available GPU units before creating a sandbox. When no GPU capacity is available, a GPU sandbox waits until capacity frees up.

GPU sandboxes on shared regions run in the [earth region](./regions.md#earth-region). Daytona selects the shared region, ignores the requested target, and reports `earth` as the sandbox `target`. GPU sandboxes on [dedicated](./regions.md#dedicated-regions) and [custom](./regions.md#custom-regions) regions keep their real region ID. To run GPU sandboxes in a specific geographic location, contact [support@daytona.io](mailto:support@daytona.io).

**Default:**

Create a GPU sandbox from a default snapshot.

| **Snapshot**      | **vCPU** | **Memory** | **Storage** | **GPU** |
| ----------------- | -------- | ---------- | ----------- | ------- |
| **`daytona-gpu`** | 1        | 1GiB       | 1GiB        | 1       |

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Click <Button>Create Sandbox</Button>
3. Select a GPU <Button>Snapshot</Button>: **`daytona-gpu`**
4. Click <Button>Create</Button>

```ruby
require 'daytona'

daytona = Daytona::Daytona.new
sandbox = daytona.create(
  Daytona::CreateSandboxFromSnapshotParams.new(
    snapshot: 'daytona-gpu',
    auto_delete_interval: 0
  )
)
```

**Custom:**

Create a GPU sandbox with custom GPU resources: units and types.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Click <Button>Create Sandbox</Button>
3. Enter an <Button>Image</Button> (e.g. **`pytorch/pytorch:2.11.0-cuda12.8-cudnn9-runtime`**)
4. Set <Button>GPU</Button> to the number of GPU units (e.g. **`1`**)
5. Select <Button>GPU Type</Button>: **`H100`**, **`H200`**, **`B200`**, **`B300`**, **`RTX-PRO-6000`**, **`RTX-4090`**, **`RTX-5090`**, **`MI355X`**

    The GPU type field accepts a single value or an ordered list of preferred types.

    Daytona uses the first available type in the order you provide. This lets you fall back from a preferred GPU to an alternative when the first choice is not available.

```ruby
require 'daytona'

daytona = Daytona::Daytona.new
sandbox = daytona.create(
  Daytona::CreateSandboxFromImageParams.new(
    image: 'pytorch/pytorch:2.11.0-cuda12.8-cudnn9-runtime',
    auto_delete_interval: 0,
    resources: Daytona::Resources.new(
      gpu: 1,
      gpu_type: [Daytona::GpuType::H100, Daytona::GpuType::RTX_PRO_6000]
    )
  )
)
```

### NVIDIA

Create a GPU sandbox with NVIDIA GPUs.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Click <Button>Create Sandbox</Button>
3. Enter an <Button>Image</Button> (e.g. **`pytorch/pytorch:2.11.0-cuda12.8-cudnn9-runtime`**)
4. Set <Button>GPU</Button> to the number of GPU units (e.g. **`1`**)
5. Select <Button>GPU Type</Button>: **`H100`**, **`H200`**, **`B200`**, **`B300`**, **`RTX-PRO-6000`**, **`RTX-4090`**, **`RTX-5090`**

```ruby
require 'daytona'

daytona = Daytona::Daytona.new
sandbox = daytona.create(
  Daytona::CreateSandboxFromImageParams.new(
    image: 'pytorch/pytorch:2.11.0-cuda12.8-cudnn9-runtime',
    auto_delete_interval: 0,
    resources: Daytona::Resources.new(
      gpu: 1,
      gpu_type: [Daytona::GpuType::H100]
    )
  )
)
```

### AMD

Create a GPU sandbox with AMD GPUs.

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Click <Button>Create Sandbox</Button>
3. Enter an <Button>Image</Button> <br /> (e.g. **`rocm/vllm:rocm10.0.0_ubuntu24.04_py3.14_pytorch_2.12.0_vllm_0.27.0`**)
4. Set <Button>GPU</Button> to the number of GPU units (e.g. **`1`**)
5. Select <Button>GPU Type</Button>: **`MI355X`**

```ruby
require 'daytona'

daytona = Daytona::Daytona.new
sandbox = daytona.create(
  Daytona::CreateSandboxFromImageParams.new(
    image: 'rocm/vllm:rocm10.0.0_ubuntu24.04_py3.14_pytorch_2.12.0_vllm_0.27.0',
    auto_delete_interval: 0,
    resources: Daytona::Resources.new(
      gpu: 1,
      gpu_type: [Daytona::GpuType::MI355X]
    )
  )
)
```

## Spot

Spot GPU sandboxes are preemptible and run on GPU capacity that is not being used by reserved (on-demand) sandboxes. They support the same GPU types, unit counts, and resource limits as on-demand GPU sandboxes.

A spot GPU sandbox can be terminated at any time without notice when an on-demand GPU sandbox needs the capacity. Daytona does not send a preemption warning or a dedicated preemption webhook. Design workloads to tolerate immediate interruption.

When a spot GPU sandbox is destroyed, normal [sandbox lifecycle state](#lifecycle) updates still apply. Daytona records when the preemption occurred with a `spotEvictedAt` timestamp. Sandboxes destroyed by spot GPU preemption remain retrievable for 24 hours.

Spot GPU sandboxes require Tier 2 or higher. Spot GPU sandboxes do not count against the organization's GPU quota. Available GPU capacity is the only limit. If no spot GPU is available, create fails immediately.

```ruby
require 'daytona'

daytona = Daytona::Daytona.new
sandbox = daytona.create(
  Daytona::CreateSandboxFromImageParams.new(
    image: 'pytorch/pytorch:2.11.0-cuda12.8-cudnn9-runtime',
    auto_delete_interval: 0,
    spot: true,
    resources: Daytona::Resources.new(gpu: 1, gpu_type: Daytona::GpuType::H100)
  )
)
```

## GPU allocation

A create request sets the number of GPU units and the GPU type. Daytona places the sandbox on capacity with that many free units of the requested type. With an ordered list of types, Daytona uses the first type in the list that has capacity. If a request sets no GPU type, Daytona places the sandbox on an NVIDIA GPU. To get an AMD GPU, request the MI355X type explicitly.

If no GPU capacity is available, an on-demand GPU sandbox waits in the **Pending Build** state until capacity frees up. A [spot](#spot) GPU sandbox fails instead.

### Regions

GPU sandboxes on shared regions run in the [earth region](./regions.md#earth-region). Daytona selects the shared region, ignores the requested target, and reports the earth region as the sandbox target. GPU sandboxes on [dedicated](./regions.md#dedicated-regions) and [custom](./regions.md#custom-regions) regions keep their real region ID. To run GPU sandboxes in a specific geographic location, contact [support@daytona.io](mailto:support@daytona.io).

### Credits

On-demand GPU sandboxes require GPU credits. Spot GPU sandboxes require GPU credits or spot GPU credits. To add credits, go to the **Wallet** page in the [Daytona Dashboard ↗](https://app.daytona.io/dashboard/).

### GPU capacity

Get the available GPU capacity. The response lists available GPU units by GPU type, split into on-demand and spot. Capacity is aggregated across all shared regions in the [earth region](./regions.md#earth-region) region and changes as sandboxes are created and deleted. The response does not reserve capacity and does not apply the organization's GPU quota. On-demand GPU sandboxes remain subject to the quota. Spot GPU sandboxes are limited only by available capacity.

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/{organizationId}/gpu-capacity' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

```json
{
  "observedAt": "2026-09-14T17:31:05.412Z",
  "capacity": [
    { "gpuType": "H100", "availableOnDemand": 12, "availableSpot": 4 },
    { "gpuType": "H200", "availableOnDemand": 0, "availableSpot": 0 },
    { "gpuType": "RTX-PRO-6000", "availableOnDemand": 6, "availableSpot": 6 }
  ]
}
```

| **Field**               | **Description**                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **`observedAt`**        | Time Daytona calculated the capacity. Responses are cached for up to five seconds.                                  |
| **`capacity`**          | One entry for each GPU type.                                                                                        |
| **`gpuType`**           | The GPU type.                                                                |
| **`availableOnDemand`** | GPU units available to on-demand GPU sandboxes. Includes units held by spot GPU sandboxes that Daytona can reclaim. |
| **`availableSpot`**     | GPU units free for spot GPU sandboxes.                                                                              |

## Resources

A GPU sandbox has up to **8** GPU units. If a GPU create request omits CPU, memory, or disk, Daytona applies the following defaults. The defaults are per sandbox and do not scale with the number of GPU units. A GPU sandbox created from a snapshot uses the snapshot's resources. The default GPU snapshot has 1 GPU unit, 1 vCPU, 1 GiB memory, and 1 GiB disk.

| **Resource** | **Default** |
| ------------ | ----------- |
| vCPU         | 16          |
| Memory       | 192 GiB     |
| Disk         | 512 GiB     |

## Filesystem persistence

Filesystem persistence keeps the contents of a sandbox's disk: files, installed packages, cloned repositories, and build artifacts. A sandbox with a preserved filesystem starts with its environment intact, with nothing to reinstall or rebuild.

GPU sandboxes are ephemeral: stop deletes the sandbox and its filesystem. To keep results, mount a [volume](./volumes.md) and write to the mount path. The volume and its data remain after the sandbox is deleted, and any other sandbox can mount the same volume.

```ruby
require 'daytona'

daytona = Daytona::Daytona.new
volume = daytona.volume.get('gpu-results', create: true)

# Mount the volume in the GPU sandbox
sandbox = daytona.create(
  Daytona::CreateSandboxFromSnapshotParams.new(
    snapshot: 'daytona-gpu',
    auto_delete_interval: 0,
    volumes: [DaytonaApiClient::SandboxVolume.new(volume_id: volume.id, mount_path: '/home/daytona/results')]
  )
)

# Write results to the volume
sandbox.fs.upload_file('done', '/home/daytona/results/output.txt')

# Stop deletes the sandbox; the volume keeps the results
sandbox.stop
```

## Memory persistence

Memory persistence keeps the runtime state of a sandbox: running processes, open connections, and everything loaded in RAM. A sandbox with preserved memory continues from the point it was frozen, with processes still running, instead of starting from a clean boot.

GPU sandboxes do not preserve memory. Stop deletes the sandbox, and pause, memory snapshots, and forks are not supported. To keep results, write them to a volume before the sandbox stops, as shown in [filesystem persistence](#filesystem-persistence).

## Lifecycle

Every GPU sandbox moves through a lifecycle. A GPU sandbox can have several different states. Each state reflects the status of your sandbox. A GPU sandbox transitions between states in response to user actions, or automatically when one of its [timeouts](#timeouts) elapses.

| **Feature**                | **Ephemeral** |
| -------------------------- | ------------- |
| **Stop and start**         | ✗             |
| **Pause and resume**       | ✗             |
| **Fork**                   | ✗             |
| **Archive**                | ✗             |
| **Delete**      | ✓             |
| **Filesystem persistence** | ✗             |
| **Memory persistence**     | ✗             |
| **Memory snapshot**        | ✗             |
| **Filesystem snapshot**    | ✗             |
| **Spot (preemption)** | ✓         |

**Sandbox states:**

| **State**             | **Description**                                                                      |
| --------------------- | ------------------------------------------------------------------------------------ |
| **Pending Build**     | The sandbox waits for GPU capacity or for the build to start.                        |
| **Building Snapshot** | The sandbox is building a snapshot from an image.                                    |
| **Pulling Snapshot**  | The sandbox is pulling a snapshot.                             |
| **Creating**          | The sandbox is being created.                                                        |
| **Starting**          | The sandbox is starting.                                                             |
| **Started**           | The sandbox is running and accepts requests.                                         |
| **Deleting**          | The sandbox is being deleted.                                                        |
| **Deleted**           | The sandbox is deleted.                                                              |
| **Error**             | The sandbox hit an error.                                                            |

**State transitions:**

| **Initial state**     | **Target state**      | **Trigger**                                                                  |
| --------------------- | --------------------- | ---------------------------------------------------------------------------- |
| **Pending Build**     | **Building Snapshot** | The queued build starts.                                                     |
| **Building Snapshot** | **Creating**          | The snapshot finishes building.                                              |
| **Pulling Snapshot**  | **Creating**          | The snapshot is available.                                                   |
| **Creating**          | **Started**           | The sandbox finishes starting.                                               |
| **Started**           | **Deleting**          | A stop or delete is requested, the auto-stop interval or TTL elapses, or Daytona preempts a spot sandbox. |
| **Deleting**          | **Deleted**           | The sandbox is removed and its GPUs are released.                            |

### Delete

Delete a sandbox.
> **Note:**
> By default delete is fire-and-forget: it returns as soon as the API accepts the deletion request, without waiting for the sandbox to be destroyed. Pass the `wait` flag to block until the sandbox reaches the destroyed state.

```ruby
sandbox.delete

# Block until the sandbox is deleted
sandbox.delete(60, wait: true)
```

### Timeouts

Two intervals end a GPU sandbox automatically. Each interval is set in minutes.

- [Auto-stop](./sandboxes.md#auto-stop-interval) stops the sandbox after inactivity. A stopped GPU sandbox is deleted. The default is **`15`** minutes, and **`0`** disables it.
- [Wall-clock TTL](./sandboxes.md#wall-clock-ttl) deletes the sandbox at a fixed deadline, whether or not it is active.

```ruby
sandbox = daytona.create(
  Daytona::CreateSandboxFromSnapshotParams.new(
    snapshot: 'daytona-gpu',
    auto_delete_interval: 0,
    auto_stop_interval: 30,
    ttl_minutes: 240
  )
)
```

## See Also
- [Python SDK - gpu-sandboxes](../python-sdk/gpu-sandboxes.md)
- [TypeScript SDK - gpu-sandboxes](../typescript-sdk/gpu-sandboxes.md)
- [Java SDK - gpu-sandboxes](../java-sdk/gpu-sandboxes.md)
- [Go SDK - gpu-sandboxes](../go-sdk/gpu-sandboxes.md)
