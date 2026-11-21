# Registries (Python SDK)

Store credentials for private container registries and pull private images into sandboxes.

Registries are container registries that store the images sandboxes boot from, under a name and a tag. A private registry serves its images only to clients with valid credentials, so a team keeps its images private and still boots sandboxes from them.

Daytona stores a registry credential as the access a project holds to one private registry host: a username and a password or token that belong to the project, not to a person. The secret part is write-only, encrypted at rest and never shown again once stored. Without a credential for a host, the project can pull only the public images of that host.

Use registry credentials to boot sandboxes from private images. Once a credential is stored, [pull the image](./images.md#pull-images) to register it. The credential for the host in an image reference authenticates the import and later pulls of the image for Linux and GPU sandboxes. The base image of a Dockerfile build is pulled with the credential stored for its host.

| **Concept**             | **Description**                                                                  |
| ----------------------- | -------------------------------------------------------------------------------- |
| **Registry**            | A service that stores container images under a name and a tag.                   |
| **Private registry**    | A registry that serves its images only to clients with valid credentials.        |
| **Registry credential** | The information that authenticates a client to a registry.                       |
| **Host**                | The network address of a registry, with an optional port.                        |
| **Kind**                | The authentication method of a registry credential.                              |
| **Public pull**         | A pull without credentials, which reaches only public images.                    |
| **Rotation**            | The replacement of a credential with a new one.                                  |

## Contents

- [Use cases](#use-cases)
- [Container registries](#container-registries)
- [Use private registry images](#use-private-registry-images)
- [Operations](#operations)
- [Permissions](#permissions)

## Use cases

Registry credentials are used when the images that sandboxes boot from are not public.

- **Private application images.** Images that a CI pipeline builds and pushes to a private registry are imported and boot in sandboxes. The import authenticates with the credential stored for the host in the image reference. No opt-in is needed on individual requests.

- **Images in a cloud provider's registry.** Images stored in Amazon ECR or Google Artifact Registry are pulled with that provider's access keys, such as an AWS access key or a service account JSON key. For Amazon ECR, Daytona checks the keys with AWS STS when you store them. It refuses keys that AWS rejects or that belong to another account.

- **Self-hosted registries.** Any registry that accepts HTTP Basic authentication works with a `basic` credential for its host. The host is a bare `host[:port]`, with no scheme or path. Without a stored credential, the project can pull only public images from the host.

- **Credential rotation.** A leaked or expired token is replaced in place, and the next pull uses the new one with no change to images or sandboxes. To rotate, store a credential for the same host again with the new password or token. The API replaces the whole credential on each request, so an omitted kind resets to `basic`.

- **Team access without shared tokens.** A credential is stored once per host for the whole project, and its token is encrypted and never returned. Team members import private images without holding the token. Reads return only the host, kind, username, description, creation time, and last update time.

## Container registries

A container registry stores images and serves them to clients that pull them by reference. A private registry asks for a username and a password or token before it serves an image.

A registry credential belongs to one registry host in the project, and every import of an image from that host authenticates with it. Its password or token is write-only: it is encrypted at rest, and reads show the host, username, and other details of the credential, never the secret.

Store a credential for each private registry host that images come from, from the dashboard or programmatically. Storing one for a host that already has a credential replaces it. The sections below list the host, kind, and other values for each provider.

1. Go to [Daytona Registries ↗](https://app.daytona.com/dashboard/registries)
2. Click **Add Registry**
3. Enter the registry host, as `host[:port]`, in **Host**
4. Select the registry kind in **Kind**: **Basic (username + password)**, **GitHub Container Registry**, **Google Container Registry**, **Amazon ECR (access keys)**, or **Amazon ECR (IAM role)**
5. Enter the registry username in **Username**
6. Enter the registry password or token in **Password / Token**
7. Enter an optional description in **Description**
8. Click **Add**

**CLI:**

```bash
printf %s 'YOUR_REGISTRY_PASSWORD' | daytona registry set YOUR_REGISTRY_HOST \
  --username YOUR_REGISTRY_USERNAME \
  --password-stdin
```

| **Flag** | **Description** |
| --- | --- |
| `<host>` | Sets the registry host.<br />**Required**<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `ghcr.io` |
| `--description` | Sets the description.<br />**Default:** the stored description<br />**Value:** an empty string for no description<br />**Example:** `'CI pull credential'` |
| `--kind` | Sets the authentication kind.<br />**Default:** `basic`, or the stored kind<br />**Value:** `basic`, `ghcr`, `gcr`, `ecr`, or `ecr_role`<br />**Example:** `ghcr` |
| `--password` | Sets the password or token on the command line.<br />**Rules:** exactly one of --password-stdin or --password, except for the ecr_role kind, which takes no password |
| `--password-stdin` | Reads the password or token from standard input.<br />**Rules:** exactly one of --password-stdin or --password, except for the ecr_role kind, which takes no password |
| `--username` | Sets the registry username.<br />**Default:** the stored username<br />**Rules:** required for a new credential<br />**Rules:** the IAM role ARN for the ecr_role kind |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.

**API:**

```bash
curl 'https://api.daytona.com/registries/YOUR_REGISTRY_HOST' \
  --request PUT \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "username": "YOUR_REGISTRY_USERNAME",
  "password": "YOUR_REGISTRY_PASSWORD"
}'
```

| **Field** | **Description** |
| --- | --- |
| `username` | Sets the registry username, or the IAM role ARN for the ecr_role kind.<br />**Required** |
| `description` | Sets the description.<br />**Default:** no description<br />**Example:** `"CI pull credential"` |
| `host` | Sets the registry host.<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `ghcr.io` |
| `kind` | Sets the authentication kind.<br />**Default:** `basic`<br />**Value:** `basic`, `ghcr`, `gcr`, `ecr`, or `ecr_role`<br />**Example:** `"ghcr"` |
| `password` | Sets the password or token.<br />**Minimum:** 1 byte<br />**Maximum:** 64 KiB |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token. For the ecr_role kind, the trust policy of the role must allow the AWS principal of Daytona, and the policy must use the organization ID as the external ID. For the ecr_role kind, the permission policy of the role must allow ecr:GetAuthorizationToken, or ecr-public:GetAuthorizationToken and sts:GetServiceBearerToken for public.ecr.aws.
> - **Compatibility:** Every kind except ecr_role requires a password.
> - **Effects:** The request replaces the whole credential.

| **Field**         | **Description**                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `host`        | Bare `host[:port]`, no scheme or path. One credential per host.                                                                                       |
| `kind`        | `basic` (default), `ghcr`, `gcr`, `ecr`, or `ecr_role`. `ghcr` requires `ghcr.io`; `gcr` requires a `gcr.io`, `*.gcr.io`, or `*-docker.pkg.dev` host; `ecr` requires an `*.dkr.ecr.<region>.amazonaws.com` host; `ecr_role` requires an `*.dkr.ecr.<region>.amazonaws.com` or `public.ecr.aws` host. |
| `username`    | Registry username.                                    |
| `password`    | Password or token, at most 64 KiB. Write-only: encrypted at rest and never returned. |
| `description` | Optional free-form note.                                                                                                                               |

### Docker Hub

Docker Hub is the registry that an image reference without a registry host points to. It serves public images to any client, and private images only to clients that sign in.

A Docker Hub credential covers every host name of Docker Hub, and image references without a registry host use it. It holds a Docker Hub username and a token. Without a stored credential, the project can pull only public images from Docker Hub.

Store a credential for Docker Hub to import private Docker Hub images into the project. Set it under docker.io from the CLI or the API, with the Docker Hub username, a token as the password, and the default `basic` kind. The credential is stored under `index.docker.io`. The hosts `docker.io`, `registry-1.docker.io`, and `registry.hub.docker.com` share the credential, as do image references without a registry host, such as `python:3.12`.

**CLI:**

```bash
printf %s 'YOUR_DOCKERHUB_TOKEN' | daytona registry set docker.io \
  --username YOUR_DOCKERHUB_USERNAME \
  --password-stdin
```

| **Flag** | **Description** |
| --- | --- |
| `<host>` | Sets the registry host.<br />**Required**<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `docker.io` |
| `--password-stdin` | Reads the password or token from standard input.<br />**Rules:** exactly one of --password-stdin or --password |
| `--username` | Sets the registry username.<br />**Default:** the stored username |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.

**API:**

```bash
curl 'https://api.daytona.com/registries/docker.io' \
  --request PUT \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "username": "YOUR_DOCKERHUB_USERNAME",
  "password": "YOUR_DOCKERHUB_TOKEN"
}'
```

| **Field** | **Description** |
| --- | --- |
| `username` | Sets the registry username.<br />**Required** |
| `host` | Sets the registry host.<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `docker.io` |
| `password` | Sets the password or token.<br />**Minimum:** 1 byte<br />**Maximum:** 64 KiB |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.
> - **Effects:** The request replaces the whole credential.

### Google Artifact Registry

Google Artifact Registry is the container registry of Google. It serves private images to clients that present the JSON key of a Google service account.

A Google Artifact Registry credential is accepted only for a host of Google's registries, and each host holds its own credential. It holds a service account JSON key under a fixed username.

Store a credential for Google Artifact Registry to import private images. In the dashboard, choose the **Google Container Registry** kind. The JSON key of the service account is the password.

**CLI:**

```bash
# The password is the service account JSON key
daytona registry set us-docker.pkg.dev \
  --kind gcr \
  --username _json_key \
  --password-stdin < service-account-key.json
```

| **Flag** | **Description** |
| --- | --- |
| `<host>` | Sets the registry host.<br />**Required**<br />**Format:** a bare host with an optional port, without scheme or path<br />**Rules:** a `gcr.io`, `*.gcr.io`, or `*-docker.pkg.dev` host with the kind `gcr`<br />**Example:** `us-docker.pkg.dev` |
| `--kind` | Sets the authentication kind.<br />**Default:** `basic`, or the stored kind<br />**Value:** `basic`, `ghcr`, `gcr`, `ecr`, or `ecr_role`<br />**Example:** `gcr` |
| `--password-stdin` | Reads the password or token from standard input.<br />**Rules:** exactly one of --password-stdin or --password |
| `--username` | Sets the registry username.<br />**Default:** the stored username<br />**Value:** `_json_key` |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.

**API:**

```bash
curl 'https://api.daytona.com/registries/us-docker.pkg.dev' \
  --request PUT \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "kind": "gcr",
  "username": "_json_key",
  "password": "YOUR_SERVICE_ACCOUNT_JSON_KEY"
}'
```

| **Field** | **Description** |
| --- | --- |
| `username` | Sets the registry username.<br />**Required**<br />**Value:** `_json_key` |
| `host` | Sets the registry host.<br />**Format:** a bare host with an optional port, without scheme or path<br />**Rules:** a `gcr.io`, `*.gcr.io`, or `*-docker.pkg.dev` host with the kind `gcr`<br />**Example:** `us-docker.pkg.dev` |
| `kind` | Sets the authentication kind.<br />**Default:** `basic`<br />**Value:** `basic`, `ghcr`, `gcr`, `ecr`, or `ecr_role`<br />**Example:** `"gcr"` |
| `password` | Sets the password or token.<br />**Minimum:** 1 byte<br />**Maximum:** 64 KiB |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.
> - **Effects:** The request replaces the whole credential.

### GitHub Container Registry

GitHub Container Registry is the container registry of GitHub, at the host ghcr.io. It serves private images only to clients that sign in with a GitHub account.

A GitHub Container Registry credential is accepted only for the registry host of GitHub, and one credential serves the whole project. It holds a GitHub username and a GitHub personal access token as the password. Images that a CI pipeline pushes there then import with it.

Store a GitHub Container Registry credential once to import private images. To replace a leaked or expired token, store a credential for ghcr.io again. In the dashboard, choose the **GitHub Container Registry** kind. The credential uses the `ghcr` kind, which requires the host `ghcr.io`.

**CLI:**

```bash
printf %s 'YOUR_GITHUB_PAT' | daytona registry set ghcr.io \
  --kind ghcr \
  --username YOUR_GITHUB_USERNAME \
  --password-stdin
```

| **Flag** | **Description** |
| --- | --- |
| `<host>` | Sets the registry host.<br />**Required**<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `ghcr.io` |
| `--kind` | Sets the authentication kind.<br />**Default:** `basic`, or the stored kind<br />**Value:** `basic`, `ghcr`, `gcr`, `ecr`, or `ecr_role`<br />**Example:** `ghcr` |
| `--password-stdin` | Reads the password or token from standard input.<br />**Rules:** exactly one of --password-stdin or --password |
| `--username` | Sets the registry username.<br />**Default:** the stored username |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.

**API:**

```bash
curl 'https://api.daytona.com/registries/ghcr.io' \
  --request PUT \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "kind": "ghcr",
  "username": "YOUR_GITHUB_USERNAME",
  "password": "YOUR_GITHUB_PAT"
}'
```

| **Field** | **Description** |
| --- | --- |
| `username` | Sets the registry username.<br />**Required** |
| `host` | Sets the registry host.<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `ghcr.io` |
| `kind` | Sets the authentication kind.<br />**Default:** `basic`<br />**Value:** `basic`, `ghcr`, `gcr`, `ecr`, or `ecr_role`<br />**Example:** `"ghcr"` |
| `password` | Sets the password or token.<br />**Minimum:** 1 byte<br />**Maximum:** 64 KiB |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.
> - **Effects:** The request replaces the whole credential.

### Amazon ECR

Amazon ECR is the container registry of Amazon Web Services (AWS). Each AWS account has a private registry in each region, and AWS also runs a public registry.

An Amazon ECR credential covers the private registry of one AWS account in one region. It holds an AWS access key ID and its secret access key. A credential can name an IAM role instead and hold no password, and only that form also reaches the public Amazon ECR registry.

Store a credential for Amazon ECR to import its private images. The `ecr` kind takes the AWS access key ID as the username and the secret access key as the password. AWS STS checks the keys when they are stored and refuses keys that AWS rejects or that belong to an AWS account other than the host's. A failed check leaves any existing credential for the host unchanged.

**CLI:**

```bash
printf %s 'YOUR_AWS_SECRET_ACCESS_KEY' | daytona registry set AWS_ACCOUNT_ID.dkr.ecr.AWS_REGION.amazonaws.com \
  --kind ecr \
  --username YOUR_AWS_ACCESS_KEY_ID \
  --password-stdin
```

| **Flag** | **Description** |
| --- | --- |
| `<host>` | Sets the registry host.<br />**Required**<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `123456789012.dkr.ecr.us-east-1.amazonaws.com` |
| `--kind` | Sets the authentication kind.<br />**Default:** `basic`, or the stored kind<br />**Value:** `basic`, `ghcr`, `gcr`, `ecr`, or `ecr_role`<br />**Example:** `ecr` |
| `--password-stdin` | Reads the password or token from standard input.<br />**Rules:** exactly one of --password-stdin or --password |
| `--username` | Sets the registry username.<br />**Default:** the stored username |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.

**API:**

```bash
curl 'https://api.daytona.com/registries/AWS_ACCOUNT_ID.dkr.ecr.AWS_REGION.amazonaws.com' \
  --request PUT \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "kind": "ecr",
  "username": "YOUR_AWS_ACCESS_KEY_ID",
  "password": "YOUR_AWS_SECRET_ACCESS_KEY"
}'
```

| **Field** | **Description** |
| --- | --- |
| `username` | Sets the registry username.<br />**Required** |
| `host` | Sets the registry host.<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `123456789012.dkr.ecr.us-east-1.amazonaws.com` |
| `kind` | Sets the authentication kind.<br />**Default:** `basic`<br />**Value:** `basic`, `ghcr`, `gcr`, `ecr`, or `ecr_role`<br />**Example:** `"ecr"` |
| `password` | Sets the password or token.<br />**Minimum:** 1 byte<br />**Maximum:** 64 KiB |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.
> - **Effects:** The request replaces the whole credential.

## Use private registry images

Use a private registry image to boot sandboxes from an image that its registry serves only with credentials. A private image is pulled like a public one, with the registry credential sent along with the request, and without valid credentials the registry refuses the pull.

A sandbox never reads a private registry itself. The import into the project authenticates with the credential stored for the host in the image reference, and sandboxes boot from the registered [image](./images.md) that the import has produced inside the project.

Store the credential for the host as in [container registries](#container-registries), import the private image, then create sandboxes from it by name. A Linux or GPU sandbox create takes the registered image name or ID, which must be ready first. Windows and macOS sandboxes ignore stored credentials.

```python
from daytona import Daytona

daytona = Daytona()

# The pull authenticates with the credential stored for ghcr.io and waits until
# the image is ready; a failed import raises ImageBuildFailedError
image = daytona.v2.images.pull("ghcr.io/acme/private-runtime:latest", name="private-runtime")

sandbox = daytona.v2.create("private-runtime")
```

| **Parameter** | **Description** |
| --- | --- |
| `image` | Sets the registry reference to pull.<br />**Required**<br />**Format:** an OCI image reference<br />**Example:** `"ghcr.io/acme/private-runtime:latest"` |
| `name` | Sets the image name.<br />**Format:** 1 to 128 letters, digits, periods, underscores, and hyphens, not starting with a period or a reserved prefix: sbx_, vol_, fn_, img_, snap_, snap-, build-, refs, by-digest, prj-, or glb-, and not the names cache or search<br />**Example:** `"private-runtime"` |

## Operations

Operations on registry credentials act on the credentials already stored in a project. They show which registry hosts the project can authenticate against and remove access it no longer needs.

A registry credential is identified by its host, and a project holds at most one per host. Its username is readable, but its password or token is encrypted at rest and never returned. Without a credential, the project can pull only public images from the host.

Use the operations below to list the credentials of a project, get one by its host, and delete one when the project no longer imports private images from that host. To change a credential, store a new one for the same host, which replaces the old one.

### List registries

List registries to see which registry hosts have a stored credential in a project. A paginated list returns a large collection in pages, and each page continues where the previous one ended.

A list returns the registry credentials of a project one page at a time. Each entry shows the stored details of one credential, but never the password or token, which is encrypted at rest.

Use a list to check which hosts have a credential before you [pull a private image](./images.md#pull-images). Each entry shows the host, kind, username, description, creation time, and last update time. The CLI `--all` flag lists every page, and the API `cursor` field continues a previous page. A page holds 100 credentials by default and can hold at most 200.

**CLI:**

```bash
daytona registry list
```

| **Flag** | **Description** |
| --- | --- |
| `--all` | Lists every page. |
| `--limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.

**API:**

```bash
curl 'https://api.daytona.com/registries' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.

### Get a registry

Get a registry credential to read the stored values for one registry host. A get reads one resource by its identifier and changes nothing on the server.

A get names the credential by its registry host and returns its stored details. The password or token is write-only: it is encrypted at rest and never returned by a get.

Use a get to check a credential's kind and username after you store it. To change a value, store one for the host again to replace it. The host is bare, with an optional port and no scheme or path. A get returns the host, kind, username, description, creation time, and last update time.

**CLI:**

```bash
daytona registry get ghcr.io
```

| **Flag** | **Description** |
| --- | --- |
| `<host>` | Sets the registry host.<br />**Required**<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `ghcr.io` |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.

**API:**

```bash
curl 'https://api.daytona.com/registries/ghcr.io' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `host` | Sets the registry host.<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `ghcr.io` |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.

### Delete a registry

Delete a registry credential to stop imports from authenticating against its registry host. Deletion removes a resource permanently, together with the data stored only in it.

A registry credential is the only credential for its host in the project, so after a delete, later pulls from that host can reach only the images that the host serves publicly.

Delete a credential when the project no longer imports private images from its host. To replace a leaked or expired token, store a new credential instead. The [audit logs](./audit-logs.md) record credential deletes.

**CLI:**

```bash
daytona registry delete ghcr.io
```

| **Flag** | **Description** |
| --- | --- |
| `<host>` | Sets the registry host.<br />**Required**<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `ghcr.io` |
| `-y`, `--yes` | Skips the confirmation prompt. |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.

**API:**

```bash
curl 'https://api.daytona.com/registries/ghcr.io' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

| **Field** | **Description** |
| --- | --- |
| `host` | Sets the registry host.<br />**Format:** a bare host with an optional port, without scheme or path<br />**Example:** `ghcr.io` |

> **Notes:**
>
> - **Prerequisites:** The request requires a project API key or the access token from [exchanging a token](./api-keys.md#exchange-a-token) for the project, not a signed-in user token.

## Permissions

Registry credentials are scoped to a project. Three permissions govern access to them, which you can grant to an [organization role](./organizations.md#roles) or to an [API key](./api-keys.md).

Pulling a private image and creating a sandbox from it also require the permissions to write images and sandboxes. The [audit logs](./audit-logs.md) record credential stores, updates, and deletes.

| **Permission**          | **Grants**                            |
| ----------------------- | ------------------------------------- |
| **`read:registries`**   | List and get registry credentials     |
| **`write:registries`**  | Store and update registry credentials |
| **`delete:registries`** | Delete registry credentials           |
