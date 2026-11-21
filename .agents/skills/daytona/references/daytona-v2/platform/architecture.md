# Architecture

Daytona platform architecture overview.

Daytona platform is organized into multiple plane components, each serving a specific purpose:

- [Interface plane](#interface-plane) provides client interfaces for interacting with Daytona
- [Control plane](#control-plane) accepts requests, stores state, and hands work to runners
- [Compute plane](#compute-plane) runs sandboxes and serves sandbox traffic

### Interface plane

The interface plane provides client interfaces for users and agents to interact with Daytona. A client interface is the part of a platform that people and programs use directly, and it turns their actions into requests to the services behind it. The following components are part of the interface plane and available to all users and agents:

- **SDK**: [Python](../python-sdk/README.md), [TypeScript](../typescript-sdk/README.md). Each SDK sends requests to the Daytona API endpoint, which routes each request to the [region](../python-sdk/regions.md) that owns the sandbox. Lifecycle and resource operations (sandboxes, images, snapshots, volumes) go to that region's [API](#api); data-plane calls into a running sandbox (file system, process execution, Git, PTY) go directly to that region's [proxy](#proxy)
- [Dashboard](https://app.daytona.com/dashboard/): web UI for sandboxes, images, snapshots, volumes, projects, and organization settings, with a terminal, file browser, desktop, SSH panel, and [playground](./playground.md)
- [SSH](../python-sdk/ssh-access.md): shell, `scp`/`sftp`, and port forwarding into sandboxes through the SSH gateway
- [Preview URLs](../python-sdk/preview.md): HTTP and WebSocket access to services listening inside a sandbox

### Control plane

The control plane is the central coordination layer of the Daytona platform. It receives all client requests, authenticates them, records the desired state, and publishes jobs that [runners](#sandbox-runners) pick up. Runners report progress back as events, so no sandbox operation requires a synchronous round trip between the API and a runner. The control plane includes the following components:

- [API](#api) handles authentication, tenancy, sandboxes, images, snapshots, volumes, and secrets
- [Database and job queue](#database-and-job-queue) persist platform state and carry work to runners

Every [region](../python-sdk/regions.md) runs its own control plane, job queue, proxy, and runner fleet. The home region also hosts the management plane: organizations, users, projects, API keys, and billing.

##### API

The API is a Rust-based RESTful service that serves as the primary entry point for all platform operations. Creating a sandbox writes a row, publishes a job to the region's queue, and returns; everything that follows happens on a runner and is reported back as events that the API applies to its state. The API also runs the maintenance loops that enforce automated sandbox lifecycle policies: the [timeout and idle timeout](../python-sdk/linux-sandboxes.md#timeouts) of each sandbox.

The API authenticates the following credentials:

- **Project API keys** carry an explicit set of [permissions](../python-sdk/api-keys.md) and an optional expiry, and are the credential used by SDKs, the proxy, and the SSH gateway
- **Organization API keys** are managed by organization admins and limited to their endpoints
- **Sandbox tokens** are issued to each sandbox so it can delete itself
- **OIDC tokens** authenticate dashboard sign-ins through the OpenID Connect provider

Access control follows [organization](../python-sdk/organizations.md) and [project](../python-sdk/projects.md) boundaries: every sandbox, image, snapshot, volume, and secret belongs to a project, and project API keys see only their project.

To interact with sandboxes from the API, see the [API](../api/README.md#daytona-api) and [Toolbox API](../api/README.md#toolbox-api) references.

##### Database and job queue

- **PostgreSQL** is the primary persistent store for organizations, projects, sandboxes, images, snapshots, volumes, and secrets. Each region keeps its own database; tenancy data is replicated read-only from the home region so API keys authenticate locally in every region
- **NATS JetStream** carries sandbox jobs from the API to runners (create and delete; for persistent macOS sandboxes also stop, start, pause, resume and fork) and streams runner events back to the API and proxy. Runners pull jobs only from their region's queue
- **Redis** is optional and used for authentication rate limiting and signed preview URL state

[Secrets](../python-sdk/secrets.md) are encrypted at rest with AES-256-GCM and sealed to each runner's key for delivery. Sandboxes see only placeholders; the host substitutes real values only in outbound HTTPS requests to each secret's allowed domains. Responses are not rewritten, so an allowed destination that echoes a value returns it into the sandbox.

### Compute plane

The compute plane is where sandboxes run and their traffic is served. Sandboxes run on [runners](#sandbox-runners), compute nodes that host multiple sandboxes with dedicated resources and scale horizontally across shared or dedicated [regions](../python-sdk/regions.md). It includes the following components:

- [Sandbox runners](#sandbox-runners) build images and boot sandboxes as virtual machines
- [Sandbox daemon](#sandbox-daemon) provides code execution and environment access inside each sandbox
- [Proxy](#proxy) routes Toolbox, SSH, preview, and VNC traffic straight to sandboxes
- [Image store](#image-store) holds converted image layers shared by all runners in a region
- [Sandbox storage](#sandbox-storage) holds sandbox disks and VM snapshots
- [Volumes](#volumes) provide persistent storage shared across sandboxes

##### Sandbox runners

Runners are the compute nodes of Daytona's compute plane. Each runner is a Go agent that pulls jobs from its region's queue and executes sandbox operations: building or pulling [images](../python-sdk/images.md), creating, resizing, and deleting sandboxes, stopping, starting, pausing, resuming, and forking persistent macOS sandboxes, and capturing [snapshots](../python-sdk/snapshots.md). Runners accept no inbound connections from the control plane. Instead, they report state changes as events, and they stream sandbox usage to the metering pipeline that feeds Daytona [billing](./billing.md).

A sandbox runs as a hardware-isolated virtual machine with its own kernel and dedicated vCPU, RAM, and disk. Linux sandboxes run as Firecracker microVMs, Windows sandboxes run on Cloud Hypervisor, and macOS sandboxes run on Apple's Virtualization framework on dedicated Apple silicon Macs ([hardware virtualization](../python-sdk/sandboxes.md#hardware-virtualization)). Runners boot most Linux sandboxes by resuming a pre-built memory snapshot of the image rather than cold-booting, which is what makes sub-second creation possible. Traffic between sandboxes is blocked on the host, and per-sandbox [egress policies](../python-sdk/network-limits.md) are enforced there as well. See [isolation](../python-sdk/isolation.md) for details.

##### Sandbox daemon

The sandbox daemon is a Rust agent that runs as the init process inside each sandbox. It is injected by the runner as a read-only system layer, so it does not need to be part of your image. It exposes the [Toolbox API](../api/README.md#toolbox-api), providing direct access to the sandbox environment: [file system](../python-sdk/file-system-operations.md) and [Git](../python-sdk/git-operations.md) operations, [process](../python-sdk/process-execution.md) and [code execution](../python-sdk/code-execution.md), [PTY](../python-sdk/pty.md) and [log streaming](../python-sdk/log-streaming.md), [language servers](./language-server-protocol.md), and [computer use](../python-sdk/computer-use.md). It also runs the SSH server that the [SSH gateway](../python-sdk/ssh-access.md) connects to.

##### Proxy

The proxy is a stateless service serving the sandbox data plane. It authenticates each request, resolves the target sandbox to its address on the runner overlay network, and forwards the connection directly to the [sandbox daemon](#sandbox-daemon) or a port inside the sandbox, bypassing the API. It supports HTTP, WebSocket, and server-sent events, and exposes these endpoints:

| **Endpoint**                           | **Routing and authentication**                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Toolbox**                            | Path-based routing at `/toolbox/{sandboxId}/...`, with a project API key, a [sandbox access token](../python-sdk/sandboxes.md#create-an-access-token), or a platform token.               |
| **Preview**                            | Host-based routing at `{port}-{sandboxId}.{preview-domain}`, authenticated with an API key, a preview token, or a signed URL unless the endpoint is [public](../python-sdk/preview.md). |
| **[SSH gateway](../python-sdk/ssh-access.md)** | Port `2222`, authenticated with `<sandboxId>#<credential>` as the username, where the credential is a project API key or a sandbox token that allows SSH. For macOS sandboxes, use a sandbox token ([macOS SSH](../python-sdk/macos-sandboxes.md#ssh)). |
| **VNC**                                | WebSocket bridge to the sandbox desktop used by the dashboard and [VNC clients](../python-sdk/vnc-access.md).                                                                           |

Authenticated Toolbox, preview, and SSH traffic also resets the [idle timeout](../python-sdk/linux-sandboxes.md#timeouts).

##### Image store

Daytona does not run an internal image registry. When an [image](../python-sdk/images.md) is pulled from a [container registry](#container-registry) or built from a Dockerfile, the runner converts each layer into a read-only, content-addressed filesystem image and stores it in a per-region shared store, together with a manifest that records the layer stack, entrypoint, environment, and working directory. Layers are keyed by content hash, so a layer shared by many images is converted and stored once per region, and sandboxes attach these layers read-only at boot without copying them. Other regions fetch an image from the global artifact store automatically the first time a sandbox there uses it.

##### Sandbox storage

In a layered filesystem, reads of unchanged data come from read-only layers, and every change lands in a writable layer on top. The layers below never change, so many sandboxes can share one set of them. Sandbox writes go to a layer above the read-only image layers:

- **Ephemeral sandboxes** write to the runner's NVMe scratch disk, discarded on delete
- **Persistent macOS sandboxes** keep their disk on their Mac across stop and start. When the Mac reservation ends, the disk is exported as an image before the Mac is erased ([macOS sandboxes](../python-sdk/macos-sandboxes.md#when-a-reservation-ends))
- **[VM snapshots](../python-sdk/snapshots.md)** capture a sandbox's disk, and memory in full snapshots, for restore

##### Volumes

[Volumes](../python-sdk/volumes.md) provide persistent storage that can be shared across sandboxes. Disk volume data lives in S3-compatible object storage as content-addressed blobs; a mounted disk volume is materialized inside the sandbox as a read-write directory, and changes are committed back periodically. A bucket volume mounts an S3 bucket directly. Multiple sandboxes can mount the same volume simultaneously, and its data persists independently of the sandbox lifecycle.

### Container registry

Container registries serve as the source for sandbox base images. When you pull an [image](../python-sdk/images.md), a runner fetches it from the external registry and converts it into the [image store](#image-store); for Dockerfile builds, parent images in FROM directives are pulled the same way. Credentials for private registries are stored per project as [registries](../python-sdk/registries.md). Daytona supports any OCI-compatible registry:

- [Docker Hub](../python-sdk/registries.md#docker-hub)
- [Google Artifact Registry](../python-sdk/registries.md#google-artifact-registry)
- [GitHub Container Registry (GHCR)](../python-sdk/registries.md#github-container-registry)
- [Amazon ECR](../python-sdk/registries.md#amazon-ecr)
- [Private registries](../python-sdk/registries.md#use-private-registry-images): any OCI distribution registry that supports basic authentication
