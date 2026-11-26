# Daytona API: images

Build and manage images.

## Contents

- [Create a build-context upload](#create-a-build-context-upload)
- [Complete a build-context upload](#complete-a-build-context-upload)
- [List images](#list-images)
- [Create an image](#create-an-image)
- [Search images](#search-images)
- [Get an image](#get-an-image)
- [Update an image](#update-an-image)
- [Delete an image](#delete-an-image)
- [Get an image's build logs URL](#get-an-images-build-logs-url)
- [Change an image format](#change-an-image-format)
- [Create an image from a sandbox](#create-an-image-from-a-sandbox)

## Create a build-context upload

`POST /build-contexts`

Starts a direct upload of a build-context tar of up to 1 GiB. When the project already holds a verified upload of the same archive in the region, the response is that upload with `state` `ready` and no parts. Otherwise `PUT` each part's bytes to its URL, then call `POST /build-contexts/{id}/complete`.

**Auth:** `api_key` (`write:images`), `platform_token` (`write:images`)

### Request Body

`application/json`: [CreateBuildContextUploadRequest](./schemas.md#createbuildcontextuploadrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bytes` | integer (int64) | Yes | The size of the build-context tar in bytes, at most 1 GiB. |
| `dockerfile` | string \| null | No | Path of the Dockerfile within the context. Defaults to `Dockerfile`. |
| `region_id` | string \| null | No | The region the image will be built in. When omitted, the project's default region is used, then the organization's, then the platform's default region. A build can use the upload only in this region. |
| `sha256` | string | Yes | The SHA-256 of the build-context tar, as 64 lowercase hex characters. |
| `tree_hash` | string \| null | No | The canonical tree hash of the build context, as 64 lowercase hex characters. Optional: when set, the upload is refused unless the stored archive hashes to it. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The verified upload of the same archive | [BuildContextUpload](./schemas.md#buildcontextupload) (`application/json`) |
| 201 | The created upload and its part URLs | [BuildContextUpload](./schemas.md#buildcontextupload) (`application/json`) |
| 400 | The request body or target region is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Build contexts are not available in the region (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Complete a build-context upload

`POST /build-contexts/{id}/complete`

Assembles the uploaded parts and verifies the stored archive: its size and SHA-256 must match the declared ones, it must be a well-formed tar, and its Dockerfile must pass the build admission checks. An archive that fails verification is deleted and the upload fails with a `400`. Repeating the request on a `ready` upload returns it unchanged.

**Auth:** `api_key` (`write:images`), `platform_token` (`write:images`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string (uuid) | Yes | The upload ID |

### Request Body

`application/json`: [CompleteBuildContextUploadRequest](./schemas.md#completebuildcontextuploadrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `region_id` | string | Yes | The region the upload was created in, as `POST /build-contexts` returned it. Required: a multi-region deployment routes the request to that region's servers by it. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The verified upload | [BuildContextUpload](./schemas.md#buildcontextupload) (`application/json`) |
| 400 | The uploaded archive failed verification, the region is missing or names another region, or the request is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Upload not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | A part has not been uploaded yet, or the upload failed or expired (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | The upload could not be verified now; retry (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## List images

`GET /images`

Images are returned newest first.

**Auth:** `api_key` (`read:images`), `platform_token` (`read:images`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |
| `name` | query | string | No | Match this exact image name. |
| `sandbox_id` | query | string | No | Return images captured from this sandbox ID. |
| `anonymous` | query | boolean | No | Return anonymous images when true and named images when false. Defaults to false. |
| `platform` | query | [ImagePlatformFilter](./schemas.md#imageplatformfilter) | No | Which images to list. Defaults to `false`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of images | [ImagePage](./schemas.md#imagepage) (`application/json`) |
| 400 | The cursor or filter is invalid (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 410 | This deployment serves image lists from search; use the search route named in the error's replacement field (`GONE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create an image

`POST /images`

**Auth:** `api_key` (`write:images`), `platform_token` (`write:images`)

### Request Body

Build request. `application/json` carries a registry or named source, an inline Dockerfile, or the `context_upload_id` of a build context uploaded with `POST /build-contexts`; `multipart/form-data` carries a build context of up to 64 MiB, with the fields `name`, optional `dockerfile` (a path within the context), `region_id`, `cpu_arch`, and the file field `context` (a build-context tar).

`application/json`: [CreateImageRequest](./schemas.md#createimagerequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `context_upload_id` | string (uuid) \| null | No | A `ready` build-context upload from `POST /build-contexts` to build: the Dockerfile at the upload's `dockerfile` path, with the uploaded archive as its context. The image must be created in the upload's region. Mutually exclusive with `source` and `dockerfile`. |
| `cpu_arch` | string \| null | No | The CPU architecture: `amd64` or `arm64`. Omit it to use the region default. |
| `dockerfile` | string \| null | No | An inline, self-contained Dockerfile body to build. Local files cannot be used with `COPY` or `ADD`; use `multipart/form-data` to upload a build context. Mutually exclusive with `source`. |
| `idle_expiry_seconds` | integer (int64) \| null | No | The idle-retention window in seconds for an anonymous image: the image is deleted once this long has passed without a sandbox being created from it, and every create from the image restarts the clock. Allowed only without `name`; a named image is permanent, and `idle_expiry_seconds` with `name` is a `400`. Omitted or `-1` uses the maximum, 7 days by default; `1` up to that maximum sets the window. Reusing an anonymous image only extends its retention. Promote it to keep it. `0`, values below `-1`, and values above the maximum answer `400 IDLE_OUT_OF_RANGE`, whose body carries `max`. |
| `name` | string \| null | No | The project-unique image name. Omit it to create an anonymous image. |
| `region_id` | string \| null | No | The region to create the image in. When omitted, the project's default region is used, then the organization's, then the platform's default region. |
| `source` | null \| [PublicImageSource](./schemas.md#publicimagesource) | No | A registry image or an existing project image. Mutually exclusive with `dockerfile`; exactly one source is required. |

`multipart/form-data`: [CreateImageMultipartRequest](./schemas.md#createimagemultipartrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `context` | string (binary) | Yes | The build-context tar, at most 64 MiB. Upload a larger context, up to 1 GiB, with `POST /build-contexts` and build it with `context_upload_id`. |
| `cpu_arch` | string \| null | No | The CPU architecture: `amd64` or `arm64`. Omit it to use the region default. |
| `dockerfile` | string \| null | No | Path of the Dockerfile within the context. Defaults to `Dockerfile`. |
| `idle_expiry_seconds` | integer (int64) \| null | No | The idle retention window in seconds for an anonymous image. Omitted or -1 uses the server maximum. Reuse only extends retention; promote to keep it. |
| `name` | string \| null | No | The project-unique image name. Omit it to create an anonymous image. |
| `region_id` | string \| null | No | The region to create the image in. When omitted, the project's default region is used, then the organization's, then the platform's default region. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: a new image build, an identical named import replay (same image id and current pending/building/ready status, no new job), or a failed identical named import retry (same image id, reset to pending with a new job after build admission) | [AsyncOperation](./schemas.md#asyncoperation) (`application/json`) |
| 400 | The request body or target region is invalid (`BAD_REQUEST`), or the image name starts with a resource id prefix (`IMAGE_NAME_RESERVED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Source image not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The image name is taken by different content or import parameters (`IMAGE_NAME_TAKEN`); an identical failed named import may be retried without deleting it. The source image or build-context upload is not ready (`CONFLICT`), or the same image is already built and exceeds the organization's image size limit (`IMAGE_TOO_LARGE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Build contexts are not available in the region, or are at capacity; retry (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Search images

`GET /images/search`

Searches the project's images using the supplied filters. Results may be briefly stale after a change.

**Auth:** `api_key` (`read:images`), `platform_token` (`read:images`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `q` | query | string | No | Free text over the image name. A value that is an image ID matches that image exactly. |
| `name` | query | string | No | Match this exact image name. |
| `name_prefix` | query | string | No | `name` starts with this string (case-sensitive). |
| `status` | query | array of [ImageStatus](./schemas.md#imagestatus) | No | Comma-separated build statuses. An unrecognized value answers 400. |
| `class` | query | array of [ImageSearchClass](./schemas.md#imagesearchclass) | No | Comma-separated sandbox classes the image supports. |
| `origin` | query | array of [ImageOrigin](./schemas.md#imageorigin) | No | Comma-separated origins: how the image was created. |
| `region_ids` | query | string | No | Comma-separated home region IDs. A broader region (a geo group, or `earth`) matches every region inside it. An unknown region answers 400. Defaults to every region. |
| `sandbox_id` | query | string | No | Images captured from this sandbox ID. |
| `anonymous` | query | boolean | No | Return anonymous images when true and named images when false. Defaults to false. |
| `platform` | query | [ImagePlatformFilter](./schemas.md#imageplatformfilter) | No | Which images to return: the project's own (`false`, the default), the platform's (`true`), or both (`any`). Deprecated platform images are never returned. |
| `created_start_at` | query | string (date-time) | No | Inclusive lower bound on creation time. |
| `created_end_at` | query | string (date-time) | No | Exclusive upper bound on creation time. |
| `updated_start_at` | query | string (date-time) | No | Inclusive lower bound on last-modified time. |
| `updated_end_at` | query | string (date-time) | No | Exclusive upper bound on last-modified time. |
| `sort` | query | [ImageSearchSort](./schemas.md#imagesearchsort) | No | Sort field. Defaults to `created_at`; ties break on the ID. |
| `order` | query | [SortOrder](./schemas.md#sortorder) | No | Sort order. Defaults to `desc`. |
| `limit` | query | integer (int64) | No | Maximum number of items to return, 1–200 (default 100) |
| `cursor` | query | string | No | Opaque continuation token returned as `next_cursor` by a previous request |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The page of matching images | [ImageSearchPage](./schemas.md#imagesearchpage) (`application/json`) |
| 400 | A filter, timestamp, ID, or cursor is invalid (`BAD_REQUEST`). The query string is longer than 12,288 bytes (`BAD_REQUEST`). The limit or cursor is invalid (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 501 | Search is not enabled (`SEARCH_NOT_CONFIGURED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Search is temporarily unavailable (`SEARCH_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get an image

`GET /images/{id}`

Optionally waits for the image to reach a requested status.

**Auth:** `api_key` (`read:images`), `platform_token` (`read:images`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `wait` | query | string | No | Block until the resource reaches this status or a terminal status. Omit to return immediately. |
| `timeout_ms` | query | integer (int64) | No | Maximum time to block, in milliseconds. Default 30000, maximum 60000. |
| `id_only` | query | boolean | No | Resolve the path value strictly as an ID, without a name fallback. |
| `id` | path | string | Yes | The image ID or name |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The image | [Image](./schemas.md#image) (`application/json`) |
| 400 | The value matches both an image ID and a different image's name (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Image not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Update an image

`PATCH /images/{id}`

Naming an anonymous image makes it permanent. Named images cannot be renamed.

**Auth:** `api_key` (`write:images`), `platform_token` (`write:images`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The image ID or name |
| `id_only` | query | boolean | No | Resolve the path value strictly as an ID, without a name fallback. |

### Request Body

`application/json`: [UpdateImageRequest](./schemas.md#updateimagerequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The permanent image name. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The image | [Image](./schemas.md#image) (`application/json`) |
| 400 | The value matches both an image ID and a different image's name (`BAD_REQUEST`), or the requested name is reserved (`IMAGE_NAME_RESERVED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Image not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The image name already exists (`IMAGE_NAME_TAKEN`). The image already has a name and cannot be renamed (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Delete an image

`DELETE /images/{id}`

Deletion is refused while a sandbox or snapshot depends on the image.

**Auth:** `api_key` (`delete:images`), `platform_token` (`delete:images`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The image ID or name |
| `id_only` | query | boolean | No | Resolve the path value strictly as an ID, without a name fallback. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Image deleted |  |
| 400 | The value matches both an image ID and a different image's name (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Image not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | Another resource still depends on the image (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Get an image's build logs URL

`GET /images/{id}/build-logs-url`

**Auth:** `api_key` (`read:images`), `platform_token` (`read:images`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The image ID or name |
| `id_only` | query | boolean | No | Resolve the path value strictly as an ID, without a name fallback. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The image build logs URL | [BuildLogsUrl](./schemas.md#buildlogsurl) (`application/json`) |
| 400 | The value matches both an image ID and a different image's name (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Image not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 503 | Build logs are temporarily unavailable (`SERVICE_UNAVAILABLE`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Change an image format

`POST /images/{id}/convert`

Converts the image to the format the platform currently boots. Repeating the request is safe and returns the in-progress conversion.

**Auth:** `api_key` (`write:images`), `platform_token` (`write:images`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The image ID or name |
| `id_only` | query | boolean | No | Resolve the path value strictly as an ID, without a name fallback. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the image conversion | [ImageConversion](./schemas.md#imageconversion) (`application/json`) |
| 400 | The value matches both an image ID and a different image's name (`BAD_REQUEST`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Image not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The image has no source that can be converted (`CONFLICT`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---

## Create an image from a sandbox

`POST /sandboxes/{sandbox_id}/images`

Captures the sandbox disk as an image. A persistent, stopped macOS sandbox produces an image usable by a later macOS create. To capture memory, create a snapshot instead.

**Auth:** `api_key` (`write:images`, `write:sandboxes`), `platform_token` (`write:images`, `write:sandboxes`)

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `sandbox_id` | path | string | Yes | The sandbox ID |

### Request Body

`application/json`: [CreateSandboxImageRequest](./schemas.md#createsandboximagerequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idle_expiry_seconds` | integer (int64) \| null | No | The idle-retention window in seconds for an anonymous image: the image is deleted once this long has passed without a sandbox being created from it, and every create from the image restarts the clock. Allowed only without `name`; a named image is permanent, and `idle_expiry_seconds` with `name` is a `400`. The same rule as `POST /images`: omitted or `-1` uses the maximum, 7 days by default; `1` up to that maximum sets the window; `0`, values below `-1`, and values above the maximum answer `400 IDLE_OUT_OF_RANGE`, whose body carries `max`. Promote the image (`PATCH /images/{id}`) to keep it. |
| `name` | string \| null | No | The project-unique image name, or `null` for an anonymous image. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 202 | Accepted: the sandbox image capture | [AsyncOperation](./schemas.md#asyncoperation) (`application/json`) |
| 400 | The image name or retention settings are invalid (`BAD_REQUEST`), the idle window is out of range (`IDLE_OUT_OF_RANGE`), or the image name starts with a resource id prefix (`IMAGE_NAME_RESERVED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 401 | Missing or invalid authentication (`UNAUTHORIZED`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 403 | The caller does not have access to this operation (`FORBIDDEN`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 404 | Sandbox not found | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 409 | The sandbox class does not support image capture (`NOT_SUPPORTED_FOR_CLASS`). The sandbox is not running (`CONFLICT`), or the image name already exists (`IMAGE_NAME_TAKEN`). A macOS sandbox is not persistent or not stopped (`CONFLICT`). The sandbox's disk is not ready yet; retry the capture later (`DISK_NOT_READY`). The macOS image is larger than the organization's image size limit (`IMAGE_TOO_LARGE`). | [ErrorBody](./schemas.md#errorbody) (`application/json`) |
| 429 | The request was rate limited, the service is overloaded, or a limit was reached (`RATE_LIMITED`, `OVERLOADED`, `LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) | [ErrorBody](./schemas.md#errorbody) (`application/json`) |

---
