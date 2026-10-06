## Contents

- Default snapshots
- Create snapshots
- VM snapshots
- GPU snapshots
- Create snapshot from sandbox
- Snapshots from private registries
- Snapshots from local images
- Get snapshot
- List snapshots
- Activate snapshots
- Deactivate snapshots
- Delete snapshots
- Snapshot lifecycle
- Run Docker in a sandbox
- Run Kubernetes in a sandbox
- See Also




Snapshots are persistent, point-in-time captures of sandbox state, including the filesystem, installed packages, dependencies, and settings. A snapshot saves a sandbox's state so you can restore it later, and any number of new sandboxes can start from the same snapshot.

Daytona provides default snapshots for creating sandboxes. You can also create snapshots from images, capture the state of existing sandboxes, or create warm pools for a snapshot:

- [**Create snapshots from an image**](#create-snapshots): define the base operating system, language runtimes, packages, and project-level setup in an image or Dockerfile, and Daytona builds it into a snapshot you can use to create sandboxes
- [**Create snapshots from a sandbox**](#create-snapshot-from-sandbox): captures and persists a sandbox's current state; container sandboxes capture filesystem state only (**cold snapshots**), VM sandboxes capture filesystem and memory state (**hot snapshots**)
- [**Warm pools**](https://www.daytona.io/docs/en/warm-pools): keep a configured number of pre-created, running sandboxes built from a snapshot; matching sandbox create requests claim one warm sandbox from the pool instantly instead of provisioning a new sandbox

## Default snapshots

| **Snapshot**            | **vCPU** | **Memory** | **Storage** | **GPU** | **Sandbox Class** |
| ----------------------- | -------- | ---------- | ----------- | ------- | ----------------- |
| **`daytona-small`**     | 1        | 1GiB       | 3GiB        |         | Container         |
| **`daytona-medium`**    | 2        | 4GiB       | 8GiB        |         | Container         |
| **`daytona-large`**     | 4        | 8GiB       | 10GiB       |         | Container         |
| **`daytona-gpu`**       | 1        | 1GiB       | 1GiB        | 1       | GPU               |
| **`daytona-vm-small`**  | 1        | 1GiB       | 3GiB        |         | Linux VM          |
| **`daytona-vm-medium`** | 2        | 4GiB       | 8GiB        |         | Linux VM          |
| **`daytona-vm-large`**  | 4        | 8GiB       | 10GiB       |         | Linux VM          |
| **`windows-small`**     | 1        | 4GiB       | 30GiB       |         | Windows           |
| **`windows-medium`**    | 2        | 8GiB       | 50GiB       |         | Windows           |
| **`windows-large`**     | 4        | 16GiB      | 50GiB       |         | Windows           |

1. Go to [Daytona Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Click <Button>Create Sandbox</Button>
3. Select a **`snapshot`**
4. Click <Button>Create</Button>

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
	params := types.SnapshotParams{
		Snapshot: "daytona-small",
	}
	_, _ = client.Create(ctx, params)
}
```

Default snapshots include pre-installed Python and Node.js packages.

**Python (pip)**


| **Package**            | **Version** |
| ---------------------- | ----------- |
| **`anthropic`**        | v0.120.2     |
| **`beautifulsoup4`**   | v4.14.3     |
| **`claude-agent-sdk`** | v0.2.130     |
| **`openai-agents`**    | v0.19.4     |
| **`daytona`**          | v0.203.0    |
| **`django`**           | v6.0.1      |
| **`flask`**            | v3.1.2      |
| **`huggingface-hub`**  | v0.36.0     |
| **`instructor`**       | v1.14.4     |
| **`keras`**            | v3.13.0     |
| **`langchain`**        | v1.2.7      |
| **`llama-index`**      | v0.14.13    |
| **`matplotlib`**       | v3.10.8     |
| **`numpy`**            | v2.4.1      |
| **`ollama`**           | v0.6.1      |
| **`openai`**           | v2.53.0     |
| **`opencv-python`**    | v4.13.0.90  |
| **`pandas`**           | v2.3.3      |
| **`pillow`**           | v12.1.0     |
| **`pipx`**             | v1.8.0      |
| **`pydantic-ai`**      | v1.47.0     |
| **`python-lsp-server`**    | v1.14.0     |
| **`requests`**         | v2.32.5     |
| **`scikit-learn`**     | v1.8.0      |
| **`scipy`**            | v1.17.0     |
| **`seaborn`**          | v0.13.2     |
| **`sqlalchemy`**       | v2.0.46     |
| **`torch`**            | v2.10.0     |
| **`transformers`**     | v4.57.6     |
| **`uv`**               | v0.9.26     |


**Node.js (npm)**


| **Package**                      | **Version** |
| -------------------------------- | ----------- |
| **`@anthropic-ai/claude-code`**  | v2.1.220     |
| **`@openai/codex`**              | v0.146.0    |
| **`bun`**                        | v1.3.6      |
| **`openclaw`**                   | v2026.7.1-2   |
| **`opencode-ai`**                | v1.18.14     |
| **`ts-node`**                    | v10.9.2     |
| **`typescript`**                 | v5.9.3      |
| **`typescript-language-server`** | v5.1.3      |


## Create snapshots

Create a snapshot.

1. Go to [Daytona Snapshots ↗](https://app.daytona.io/dashboard/snapshots)
2. Click <Button>Create Snapshot</Button>
3. Enter the snapshot **`name`** and **`image`** of any publicly accessible image or container registry
    - **Snapshot name**: identifier used to reference the snapshot
    - **Snapshot image**: base image for the snapshot, must include either a tag or a digest (e.g., **`ubuntu:22.04`**); the **`latest`**/**`lts`**/**`stable`** tags are not supported
4. Click <Button>Create</Button>

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
	snapshot, logCh, _ := client.Snapshot.Create(ctx, &types.CreateSnapshotParams{
		Name:  "my-awesome-snapshot",
		Image: "python:3.12",
	})
	for range logCh {
	}
	_ = snapshot
}
```

## VM snapshots

Daytona provides methods to create VM snapshots for **Linux VM** and **Windows**.

VM snapshots are used to create [VM sandboxes](./sandboxes.md#vm-sandboxes). VM snapshots are distinct from container snapshots and cannot be used to create container sandboxes. VM snapshots support VM-only capabilities such as [creating a snapshot from a sandbox](#create-snapshot-from-sandbox).

**Linux VM:**

Create a Linux VM snapshot.
> **Note:**
> Linux VM snapshots must be created from an existing image reference. Dockerfile and [declarative image](./declarative-builder.md) builds are not supported for the Linux VM sandbox class and fail during the build step. To use a custom image, push it to a public or [private registry](#snapshots-from-private-registries) and create the snapshot from that image, or [create a snapshot from a sandbox](#create-snapshot-from-sandbox).

1. Create a snapshot from an **`image`**
2. Set the snapshot's sandbox class to **`LINUX_VM`**

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

	sandboxClass := types.SandboxClassLinuxVM
	snapshot, logCh, _ := client.Snapshot.Create(ctx, &types.CreateSnapshotParams{
		Name:         "my-vm-snapshot",
		Image:        "ubuntu:22.04",
		SandboxClass: &sandboxClass,
	})
	for range logCh {
	}
	_ = snapshot
}
```

**Windows:**

Windows snapshots are used to create [Windows sandboxes](./sandboxes.md#vm-sandboxes). They cannot be created from a base image. They are produced only through the [snapshot from sandbox](#create-snapshot-from-sandbox) by starting from an existing Windows sandbox and capturing its current state as a snapshot.

## GPU snapshots

Create a GPU snapshot. GPU snapshots are used to create [GPU sandboxes](./sandboxes.md#gpu-sandboxes).

1. Go to [Daytona Snapshots ↗](https://app.daytona.io/dashboard/snapshots)
2. Click <Button>Create Snapshot</Button>
3. Enter the snapshot **`name`** and **`image`**
4. Select the **`Allocate GPU`** checkbox
5. Specify the **`GPU type`**(s):

    - **`NVIDIA H100`**
    - **`NVIDIA H200`**
    - **`NVIDIA RTX PRO 6000`**
    - **`NVIDIA RTX 4090`**
    - **`NVIDIA RTX 5090`**

6. Click <Button>Create</Button>

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
	snapshot, logCh, _ := client.Snapshot.Create(ctx, &types.CreateSnapshotParams{
		Name:  "my-gpu-snapshot",
		Image: "python:3.12",
		Resources: &types.Resources{
			CPU: 1,
			Memory: 1,
			Disk: 1,
			GPU: 1,
		},
	})
	for range logCh {
	}
	_ = snapshot
}
```

## Create snapshot from sandbox

Create a snapshot from a running or stopped sandbox.

**Container:**

Container sandboxes capture filesystem state only (**cold snapshot**):

| **Snapshot type** | **Include memory**    | **Snapshot contents** | **Required sandbox state** |
| ----------------- | --------------------- | --------------------- | -------------------------- |
| Cold              | **`false`** (default) | Filesystem only       | Stopped                    |

```go
err := sandbox.ExperimentalCreateSnapshot(ctx, "my-snapshot")
if err != nil {
    return err
}
```

**Linux VM:**

Linux VM sandboxes capture filesystem state only (**cold snapshot**) or filesystem and memory state (**hot snapshot**) through the `includeMemory` parameter:

| **Snapshot type** | **Include memory**    | **Snapshot contents** | **Required sandbox state** |
| ----------------- | --------------------- | --------------------- | -------------------------- |
| Cold              | **`false`** (default) | Filesystem only       | Stopped                    |
| Hot               | **`true`**            | Filesystem and memory | Started                    |

```go
// Cold snapshot (filesystem only, sandbox stopped)
err := sandbox.ExperimentalCreateSnapshot(ctx, "my-snapshot")
if err != nil {
    return err
}

// Hot snapshot (filesystem and memory, sandbox running)
err = sandbox.ExperimentalCreateSnapshotWithMemory(ctx, "my-vm-snapshot", 60*time.Second)
if err != nil {
    return err
}
```

**Windows:**

Windows sandboxes capture filesystem state only (**cold snapshot**) or filesystem and memory state (**hot snapshot**) through the `includeMemory` parameter:

| **Snapshot type** | **Include memory**    | **Snapshot contents** | **Required sandbox state** |
| ----------------- | --------------------- | --------------------- | -------------------------- |
| Cold              | **`false`** (default) | Filesystem only       | Stopped                    |
| Hot               | **`true`**            | Filesystem and memory | Started                    |

```go
// Cold snapshot (filesystem only, sandbox stopped)
err := sandbox.ExperimentalCreateSnapshot(ctx, "my-snapshot")
if err != nil {
    return err
}

// Hot snapshot (filesystem and memory, sandbox running)
err = sandbox.ExperimentalCreateSnapshotWithMemory(ctx, "my-vm-snapshot", 60*time.Second)
if err != nil {
    return err
}
```

<a id="using-images-from-private-registries"></a>
<a id="images-from-private-registries"></a>
<a id="from-private-registries"></a>
## Snapshots from private registries

Create a snapshot from images from private container registries.

1. Go to [Daytona Registries ↗](https://app.daytona.io/dashboard/registries)
2. Click <Button>Add Registry</Button> and select your provider:

    - [Docker Hub](#docker-hub)
    - [Google Artifact Registry](#google-artifact-registry)
    - [GitHub Container Registry](#github-container-registry)
    - [Amazon ECR](#amazon-elastic-container-registry)

3. Enter the required fields
4. Go to [Daytona Snapshots ↗](https://app.daytona.io/dashboard/snapshots)
5. Click <Button>Create Snapshot</Button>
6. Enter the snapshot **`name`** and the full **`image`** reference, including the registry host and repository (e.g. **`my-registry.com/<repo>/custom-alpine:3.21`**)

#### Docker Hub

Create a snapshot from Docker Hub images.

1. Go to [Daytona Registries ↗](https://app.daytona.io/dashboard/registries)
2. Click <Button>Add Registry</Button> and select the **Docker Hub** tab
3. Input the following fields:
   - **Username**: your Docker Hub username (the account with access to the image)
   - **Personal Access Token**: a [Docker Hub PAT](https://docs.docker.com/security/access-tokens/); not your account password
   - **Registry URL**: auto-filled with **`docker.io`** and not shown in the form
4. Create the snapshot using the full image reference

    **`docker.io/<username>/<image>:<tag>`**

#### Google Artifact Registry

Create a snapshot from images from Google Artifact Registry.

1. Go to [Daytona Registries ↗](https://app.daytona.io/dashboard/registries),
2. Click <Button>Add Registry</Button> and select the **Google** tab
2. Input the following fields:
   - **Registry URL**: the base URL for your region

      **`https://<region>-docker.pkg.dev`**
   - **Service Account JSON Key**: the contents of your service account key JSON file
   - **Google Cloud Project ID**: your GCP project ID
   - **Username**: auto-filled with **`_json_key`** (required by Google for service-account auth)
3. Create the snapshot using the full image reference

    **`<region>-docker.pkg.dev/<project>/<repo>/<image>:<tag>`**

<a id="github-container-registry-ghcr"></a>
#### GitHub Container Registry

Create a snapshot from images from GitHub Container Registry.

1. Go to [Daytona Registries ↗](https://app.daytona.io/dashboard/registries),
2. Click <Button>Add Registry</Button> and select the **GitHub** tab
2. Input the following fields:
   - **GitHub Username**: the account with access to the image
   - **Personal Access Token**: a [GitHub PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) with **`read:packages`** scope (and **`write:packages`** / **`delete:packages`** for pushing or deleting)
   - **Registry URL**: auto-filled with **`ghcr.io`** and not shown in the form
3. Create the snapshot using the full image reference

    **`ghcr.io/<owner>/<image>:<tag>`**

<a id="amazon-elastic-container-registry-ecr"></a>
<a id="amazon-elastic-container-registry"></a>
#### Amazon ECR

Create a snapshot from images from Amazon Elastic Container Registry.

Daytona pulls private ECR images via cross-account IAM role assumption. You create a role in your AWS account that trusts Daytona's broker principal, and Daytona assumes it on every pull to fetch a short-lived ECR token.

- **Daytona Broker ARN**

    The IAM principal Daytona uses to assume into your role. Self-hosted: substitute the IAM role your API pods assume (e.g. via IRSA).

    `arn:aws:iam::967657494466:role/DaytonaEcrCredentialBroker`
- **External ID**

    Your Daytona organization ID, visible in the dashboard URL (`/dashboard/<orgId>/...`) and on your organization settings page.

1. Create an IAM role in your AWS account

    - **Trust policy**

    ```json
    {
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": { "AWS": "arn:aws:iam::967657494466:role/DaytonaEcrCredentialBroker" },
        "Action": "sts:AssumeRole",
        "Condition": {
          "StringEquals": {
            "sts:ExternalId": "<YOUR_EXTERNAL_ID>"
          }
        }
      }]
    }
    ```

    - **Permissions policy (read-only on ECR)**

    ```json
    {
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Action": [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ],
        "Resource": "*"
      }]
    }
    ```

2. Go to [Daytona Registries ↗](https://app.daytona.io/dashboard/registries)
3. Click <Button>Add Registry</Button> and select the **Amazon ECR** tab
4. Input the following fields:
   - **Registry URL**: **`<account_id>.dkr.ecr.<region>.amazonaws.com`**
   - **Role ARN**: the role you created in step 1

   Password is not used for ECR. Daytona resolves credentials server-side by assuming the role you created in step 1, using your organization ID as the **`AssumeRole ExternalId`**.
5. Go to [Daytona Snapshots ↗](https://app.daytona.io/dashboard/snapshots)
6. Click <Button>Create Snapshot</Button>
7. Enter the snapshot **`name`** and the full **`image`** reference

    **`<account_id>.dkr.ecr.<region>.amazonaws.com/<repo>/<image>:<tag>`**
8. (Optional) Harden the trust policy

    Daytona sends a `daytona-<orgId>-pull` session name on every AssumeRole call. You can require it in your trust policy for CloudTrail audit visibility. Add inside `Condition`:

    ```json
    "StringLike": {
      "sts:RoleSessionName": "daytona-<YOUR_EXTERNAL_ID>-*"
    }
    ```

<a id="using-local-images"></a>
<a id="local-images"></a>
<a id="from-local-images"></a>
## Snapshots from local images

Create a snapshot from local images or from local Dockerfiles.

Daytona expects the local image to be built for AMD64 architecture. Therefore, the `--platform=linux/amd64` flag is required when building the Docker image if your machine is running on a different architecture.

1. Ensure the image and tag you want to use is available

```bash
docker images
```

2. Create a snapshot and push it to Daytona:

```bash
daytona snapshot push custom-alpine:3.21 --name alpine-minimal
```

Alternatively, use the `--dockerfile` flag under `create` to pass the path to the Dockerfile you want to use and Daytona will build the snapshot for you. The `COPY`/`ADD` commands will be automatically parsed and added to the context. To manually add files to the context, use the `--context` flag.

```bash
daytona snapshot create my-awesome-snapshot --dockerfile ./Dockerfile
```
> **Note:**
> Dockerfile builds are not supported for [VM snapshots](#vm-snapshots). For Linux VM snapshots, push the built image to a registry and create the snapshot from the image reference.

## Get snapshot

Get a snapshot by name.

```go
_, err := client.Snapshots.Get(ctx, "my-awesome-snapshot")
```

## List snapshots

List snapshots and view their details.

```go
page, limit := 2, 10
_, err := client.Snapshots.List(ctx, &page, &limit)
```

## Activate snapshots

Activate an inactive snapshot.

Snapshots automatically become inactive after 2 weeks of not being used.

1. Go to [Daytona Snapshots ↗](https://app.daytona.io/dashboard/snapshots)
2. Click the three dots at the end of the row for the snapshot you want to activate
3. Click <Button>Activate</Button>


## Deactivate snapshots

Deactivate a snapshot.

Deactivated snapshots are not available for new sandboxes. Deactivating a snapshot also pauses top-ups of its [warm pools](https://www.daytona.io/docs/en/warm-pools); the pool reports the reason in its `errorReason` field.

1. Go to [Daytona Snapshots ↗](https://app.daytona.io/dashboard/snapshots)
2. Click the three dots at the end of the row for the snapshot you want to deactivate
3. Click <Button>Deactivate</Button>

## Delete snapshots

Delete a snapshot.

Deleted snapshots cannot be recovered. Deleting a snapshot also deletes its [warm pools](https://www.daytona.io/docs/en/warm-pools) and destroys their unclaimed warm sandboxes.

1. Go to [Daytona Snapshots ↗](https://app.daytona.io/dashboard/snapshots)
2. Click the three dots at the end of the row for the snapshot you want to delete
3. Click <Button>Delete</Button>

```go
snapshot, err := client.Snapshots.Get(ctx, "my-awesome-snapshot")
err = client.Snapshots.Delete(ctx, snapshot)
```

## Snapshot lifecycle

A snapshot can have several different states. Each state reflects the snapshot's current status.

**Snapshot states**


| **State**    | **Description**                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Pending      | The snapshot creation has been requested.                                                               |
| Building     | The snapshot is being built.                                                                            |
| Pulling      | The snapshot image is being pulled from a registry.                                                     |
| Snapshotting | The snapshot is being created from a sandbox.                                                           |
| Active       | The snapshot is ready to use for creating sandboxes.                                                    |
| Inactive     | The snapshot is deactivated; must be explicitly <u>[**activated**](#activate-snapshots)</u> before use. |
| Error        | The snapshot creation failed.                                                                           |
| Build Failed | The snapshot build process failed.                                                                      |
| Removing     | The snapshot is being deleted.                                                                          |


##### State transitions

A snapshot can transition between states in response to various actions. The following table lists the initial state, target state, and trigger for the transition.

**State transitions**


| **Initial state** | **Target state** | **Trigger**                                                                                        |
| ----------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| Pending           | Building         | A declarative image build starts.                                                                  |
| Pending           | Pulling          | The snapshot image pull starts.                                                                    |
| Pending           | Error            | Snapshot processing fails.                                                                         |
| Pending           | Removing         | A delete is requested.                                                                             |
| Building          | Active           | The build finishes and the snapshot is ready.                                                      |
| Building          | Build Failed     | The image build is rejected.                                                                       |
| Building          | Error            | The build fails or times out.                                                                      |
| Building          | Removing         | A delete is requested.                                                                             |
| Pulling           | Active           | The image pull finishes and the snapshot is ready.                                                 |
| Pulling           | Error            | The image pull fails or times out.                                                                 |
| Pulling           | Removing         | A delete is requested.                                                                             |
| Snapshotting      | Active           | The snapshot from a sandbox finishes and is ready.                                                 |
| Snapshotting      | Error            | The snapshot from a sandbox fails or times out.                                                    |
| Snapshotting      | Removing         | A delete is requested.                                                                             |
| Active            | Inactive         | A deactivate is requested, the organization is suspended, or the deactivation timeout is exceeded. |
| Active            | Removing         | A delete is requested.                                                                             |
| Inactive          | Pending          | An activate is requested.                                                                          |
| Inactive          | Removing         | A delete is requested.                                                                             |
| Error             | Removing         | A delete is requested.                                                                             |
| Build Failed      | Removing         | A delete is requested.                                                                             |


## Run Docker in a sandbox

Sandboxes can run Docker containers inside them (**Docker-in-Docker**), enabling you to build, test, and deploy containerized applications.

Agents can interact with these services since they run within the same sandbox environment, providing better isolation and security compared to external service dependencies.

- Run databases (PostgreSQL, Redis, MySQL) and other services
- Build and test containerized applications
- Deploy microservices and their dependencies
- Create isolated development environments with full container orchestration
> **Note:**
> Docker-in-Docker sandboxes require additional resources due to the Docker daemon overhead. Consider allocating at least 2 vCPU and 4GiB of memory for optimal performance.

##### Create a Docker-in-Docker snapshot

Daytona provides an option to create a snapshot with Docker support using pre-built Docker-in-Docker images as a base or by manually installing Docker in a custom image.

###### Using pre-built images

The following base images are widely used for creating Docker-in-Docker snapshots or can be used as a base for a custom Dockerfile:

- **`docker:28.3.3-dind`**: official Docker-in-Docker image (Alpine-based, lightweight)
- **`docker:28.3.3-dind-rootless`**: rootless Docker-in-Docker for enhanced security
- **`docker:28.3.2-dind-alpine3.22`**: Docker-in-Docker image with Alpine 3.22

**Manual installation**

Alternatively, install Docker manually in a custom Dockerfile:

```dockerfile
FROM ubuntu:22.04
# Install Docker using the official install script
RUN curl -fsSL https://get.docker.com | VERSION=28.3.3 sh -
```

##### Run Docker Compose in a sandbox

Define and run multi-container applications. With Docker-in-Docker enabled in a Daytona sandbox, you can use Docker Compose to orchestrate services like databases, caches, and application containers.

1. Create a Docker-in-Docker snapshot with one of the [pre-built images](#using-pre-built-images)
2. Run Docker Compose services inside a sandbox

```go
package main

import (
	"context"
	"fmt"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	ctx := context.Background()

	// Initialize the Daytona client
	client, _ := daytona.NewDaytona(nil)

	// Create a sandbox from a Docker-in-Docker snapshot
	sandbox, _ := client.Create(ctx, &types.CreateSandboxFromSnapshotParams{
		Snapshot: daytona.Ptr("docker-dind"),
	}, nil)

	// Create a docker-compose.yml file
	composeContent := `
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
`
	sandbox.Fs.UploadFile(ctx, []byte(composeContent), "docker-compose.yml")

	// Start Docker Compose services
	result, _ := sandbox.Process.ExecuteCommand(ctx, "docker compose -p demo up -d", nil)
	fmt.Println(result.Result)

	// Check running services
	result, _ = sandbox.Process.ExecuteCommand(ctx, "docker compose -p demo ps", nil)
	fmt.Println(result.Result)

	// Clean up
	sandbox.Process.ExecuteCommand(ctx, "docker compose -p demo down", nil)
}
```

## Run Kubernetes in a sandbox

Sandboxes can run a Kubernetes cluster inside the sandbox. Kubernetes runs entirely inside the sandbox and is removed when the sandbox is deleted, keeping environments secure and reproducible.

1. Create a sandbox
2. Install and start a k3s cluster inside the sandbox

```go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	ctx := context.Background()

	// Initialize the Daytona client
	client, _ := daytona.NewClient()

	// Create the sandbox instance
	sandbox, _ := client.Create(ctx, types.SnapshotParams{})

	// Run the k3s installation script
	_, _ = sandbox.Process.ExecuteCommand(ctx, "curl -sfL https://get.k3s.io | sh -")

	// Run k3s
	sessionName := "k3s-server"
	_ = sandbox.Process.CreateSession(ctx, sessionName)
	_, _ = sandbox.Process.ExecuteSessionCommand(
		ctx, sessionName, "sudo /usr/local/bin/k3s server", true, false,
	)

	// Give time to k3s to fully start
	time.Sleep(30 * time.Second)

	// Get all pods
	pods, _ := sandbox.Process.ExecuteCommand(ctx, "sudo /usr/local/bin/kubectl get pod -A")
	fmt.Println(pods.Result)
}
```

## See Also
- [Python SDK - snapshots](../python-sdk/snapshots.md)
- [TypeScript SDK - snapshots](../typescript-sdk/snapshots.md)
- [Java SDK - snapshots](../java-sdk/snapshots.md)
