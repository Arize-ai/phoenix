# Architecture

The planes and components that run Daytona sandboxes and serve their traffic.

Daytona platform is organized into multiple plane components, each serving a specific purpose:

- [Interface plane](#interface-plane) provides client interfaces for interacting with Daytona
- [Control plane](#control-plane) accepts requests, stores state, and hands work to runners
- [Compute plane](#compute-plane) runs sandboxes and serves sandbox traffic

## Contents

- [Interface plane](#interface-plane)
- [Control plane](#control-plane)
- [Compute plane](#compute-plane)

## Interface plane

The interface plane is the set of clients that people and programs use to reach a platform. Each client turns an action, such as a click or a function call, into a request to the services behind it, so no user talks to those services directly.

The interface plane of a sandbox is every client that reaches it from outside the platform. Lifecycle requests go to the API of the region that owns the sandbox, and calls into a running sandbox go straight to the proxy of that region.

Use an SDK or the CLI from code and agents, and the dashboard to manage resources by hand. For a shell or a port of a sandbox, use [SSH access](../python-sdk/ssh-access.md) or a [preview URL](../python-sdk/preview.md).

| **Interface**                                        | **Description**                                                                                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [**Python SDK**](../python-sdk/README.md)                   | Sends lifecycle requests to the API of the sandbox's region, and calls into a running sandbox to its proxy.                                                          |
| [**TypeScript SDK**](../typescript-sdk/README.md)           | Sends lifecycle requests to the API of the sandbox's region, and calls into a running sandbox to its proxy.                                                          |
| [**CLI**](../cli/README.md)                                 | A command-line program for managing sandboxes from a terminal or a script.                                                                                           |
| [**Dashboard**](https://app.daytona.com/dashboard/)  | A web UI for sandboxes, images, snapshots, volumes, projects, and organization settings, with a terminal, file browser, desktop, SSH panel, and [playground](./playground.md). |
| [**SSH**](../python-sdk/ssh-access.md)                          | Shell, `scp`, `sftp`, and port forwarding into sandboxes through the SSH gateway.                                                                                    |
| [**Preview URLs**](../python-sdk/preview.md)                    | HTTP and WebSocket access to services listening inside a sandbox.                                                                                                    |

## Control plane

The control plane is the part of a platform that records the state that requests ask for and assigns the work to the hosts that carry it out. It decides what should exist, and the hosts make it exist and report back.

The control plane of a sandbox is the API and database of the region that owns it, joined to the runners only by a job queue. Every region runs its own control plane, and the home region also holds the accounts of every organization.

Send every lifecycle request to the API endpoint, which routes it to the control plane of the region that owns the sandbox. Choose that region when you create the sandbox, as [regions](../python-sdk/regions.md) describes.

### API

[The Daytona API](../api/README.md) is an HTTP interface for managing sandboxes and the resources around them.

| **Credential**                          | **Description**                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [**Project API key**](../python-sdk/api-keys.md)   | Carries an explicit set of permissions and an optional expiry, and is the credential that SDKs, the proxy, and the SSH gateway use.     |
| **Organization API key**                | Managed by [organization](../python-sdk/organizations.md) admins and limited to the organization endpoints.                                       |
| **Sandbox token**                       | Issued to each sandbox so that it can delete itself.                                                                                    |
| **OIDC token**                          | Authenticates dashboard sign-ins through the OpenID Connect provider.                                                                   |

### Database and job queue

A database keeps the state of a platform so that it survives restarts, and a job queue holds work until a worker takes it. Between them, a service can record a request and hand its work on without waiting for the worker to finish.

The database and job queue of a region serve that region alone, and its runners pull jobs only from its queue. Runners report progress as events, so no sandbox operation waits on a synchronous call between the API and a runner. Account data is replicated read-only from the home region, so API keys authenticate locally in every region.

Expect a sandbox to reach its new state after a create or delete returns, because a runner applies the job later and reports it as an event. Read [secrets](../python-sdk/secrets.md) for how a secret value reaches a sandbox without entering it.

| **Store**          | **Description**                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL**     | The persistent store for organizations, projects, sandboxes, images, snapshots, volumes, and secrets, with secrets encrypted at rest with AES-256-GCM.                                  |
| **NATS JetStream** | Carries create and delete jobs to runners, plus stop, start, pause, resume, and fork for persistent macOS sandboxes, with secrets sealed to each runner's key, and streams events back. |
| **Redis**          | An optional store for authentication rate limiting and signed preview URL state.                                                                                                       |

## Compute plane

The compute plane is the part of a platform where workloads run and their traffic is served. It holds the hosts that run the workloads, and the storage those hosts read from and write to. It grows by adding hosts.

The compute plane of a region is its fleet of runners, compute nodes that each host many sandboxes with dedicated resources, and the storage and proxy they share. Runners scale horizontally within shared and dedicated regions.

Size a sandbox for its workload, because its runner gives it its own [resources](../python-sdk/sandboxes.md#resources) and nothing more. For the boundaries that runners enforce between sandboxes on one host, see [isolation](../python-sdk/isolation.md).

### Sandbox runners

Sandbox runners are the hosts that run sandboxes, each with an agent that takes jobs from a queue and carries them out. Pulling work, rather than accepting calls, lets a runner run behind a firewall and lets new runners join without any change to the service that assigns work.

The runner of a sandbox is the host that runs it as a virtual machine with its own kernel, under a Go agent that carries out its jobs. Runners accept no inbound connections, and they report each change of state as an event and stream usage to [billing](./billing.md).

Expect most Linux sandboxes to be created in under a second, because their runner resumes a pre-built memory snapshot of the image instead of a cold boot. Set an [egress policy](../python-sdk/network-limits.md) per sandbox to limit the traffic that its runner lets out. Traffic between sandboxes is blocked on the host.

### Sandbox daemon

The sandbox daemon is an agent that runs inside each sandbox so that clients can act on it without logging in. It receives requests from outside and carries them out inside the guest, such as running a command or reading a file.

The daemon of a sandbox is a Rust program that runs as its init process, from a read-only layer that the runner adds at boot. An image does not need to include it, and it serves both the Toolbox API and the SSH server that the SSH gateway connects to.

Call the daemon through an SDK or the [Toolbox API](../api/README.md#toolbox-api) to work with the files and processes of a running sandbox. Each Toolbox area has its own page, from [file system operations](../python-sdk/file-system-operations.md) to [computer use](../python-sdk/computer-use.md). The daemon answers only while the sandbox runs.

### Proxy

The proxy is a reverse proxy: a server that receives client connections and forwards each one to the service that should handle it. It checks every request at one entry point, so the services behind it are never exposed directly.

The proxy of a region is a stateless service that forwards each connection straight to a sandbox, bypassing the API. It resolves the sandbox to its address on the runner overlay network and connects to the daemon or to a port inside the sandbox.

Reach a running sandbox through the proxy endpoint that fits the client; an SDK uses the Toolbox endpoint for you. Expose a port with a [preview URL](../python-sdk/preview.md), or open a shell through the [SSH gateway](../python-sdk/ssh-access.md).

| **Endpoint**                         | **Routing and authentication**                                                                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Toolbox**                          | Path-based routing at `/toolbox/{sandboxId}/...` with a project API key, a [sandbox access token](../python-sdk/sandboxes.md#create-an-access-token), or a platform token, and authenticated traffic resets the [idle timeout](../python-sdk/linux-sandboxes.md#timeouts). |
| [**Preview**](../python-sdk/preview.md)         | Host-based routing at `{port}-{sandboxId}.{preview-domain}` with an API key, a preview token, or a signed URL unless the endpoint is public, and authenticated traffic resets the idle timeout.                                                      |
| [**SSH gateway**](../python-sdk/ssh-access.md)  | Port `2222` with `<sandboxId>#<credential>` as the username, where the credential is a project API key or a sandbox token that allows SSH, and authenticated sessions reset the idle timeout.                                                        |
| [**VNC**](../python-sdk/vnc-access.md)          | A WebSocket bridge to the sandbox desktop that the dashboard and VNC clients use.                                                                                                                                                                      |

### Image store

The image store holds the filesystem layers that images are made of, so hosts can start workloads from them without fetching each image again. Storing each layer under the hash of its content means that a layer shared by many images is stored once.

The image store of a region holds each image as read-only, content-addressed layers, with a manifest of the configuration its first process starts with. Sandboxes attach the layers read-only at boot without copying them. No image registry runs inside the platform, and runners reach an external registry only to convert an image.

Pull or build an [image](../python-sdk/images.md) once, and every runner of the region starts sandboxes from its converted layers. Store [registry](../python-sdk/registries.md) credentials first to pull a private image. The first sandbox that uses an image in another region waits while that region fetches it from the global artifact store.

### Sandbox storage

Sandbox storage is a layered filesystem: reads of unchanged data come from read-only layers, and every change lands in a writable layer on top. The layers below never change, so many sandboxes share one set of them.

The storage of a sandbox is its writable layer, kept apart from the read-only image layers it boots from. Where that layer lives depends on the kind of sandbox, and it decides what survives a stop or a delete.

Write data that must outlive an ephemeral sandbox to a [volume](../python-sdk/volumes.md), or capture the sandbox in a [snapshot](../python-sdk/snapshots.md). For what each kind of sandbox keeps across a stop, see [persistence](../python-sdk/persistence.md).

| **Storage**                                                        | **Description**                                                                                                                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ephemeral sandbox**                                              | Writes go to the runner's NVMe scratch disk and are discarded when the sandbox is deleted.                                                                                       |
| [**Persistent macOS sandbox**](../python-sdk/macos-sandboxes.md#when-a-reservation-ends) | The disk stays on its Mac across stop and start, and is exported as an image before the Mac is erased when the reservation ends.                                      |
| [**VM snapshot**](../python-sdk/snapshots.md)                                 | Captures the disk of a sandbox, and its memory in a full snapshot, for restore.                                                                                                   |

### Volumes

[Volumes](../python-sdk/volumes.md) are storage that exists independently of any one sandbox that uses it.
