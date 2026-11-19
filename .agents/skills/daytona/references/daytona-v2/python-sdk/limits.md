# Limits (Python SDK)

Overview of sandbox resource limits, organization limits, and API rate limits.

Limits come in three kinds: [sandbox limits](#sandbox-limits), which cap the resources that a single sandbox can reserve, [organization limits](#organization-limits), which cap how many sandboxes, image builds, volumes, images, snapshots, members, secrets, and API keys an organization can hold, and [rate limits](#rate-limits), which cap how many API requests a project can make within a time window. For information about spending and wallet management in an organization, see [billing](../platform/billing.md).

## Contents

- [Sandbox limits](#sandbox-limits)
- [Organization limits](#organization-limits)
- [Rate limits](#rate-limits)
- [Best practices](#best-practices)
- [Permissions](#permissions)

## Sandbox limits

Sandbox limits cap the CPU, memory, and disk a single sandbox can reserve. The limits apply per sandbox, not as a shared pool across the organization.

| **Resource** | **Unit** | **Default** | **Minimum**                       | **Maximum**  |
| ------------ | -------- | ----------- | --------------------------------- | ------------ |
| CPU          | Cores    | `0.5`   | **`0.125`** (when set explicitly) | **`16`**     |
| Memory       | MiB      | `1024`  | **`512`** (when set explicitly)   | **`32768`**  |
| Disk         | MiB      | `512`   | **`10240`** (when set explicitly) | **`262144`** |

A create request that reserves more than the maximum on any axis is rejected with a 400 error that names the exceeded cap. Requests below the minimum are raised to the minimum. The minimums apply once a create sets any of CPU, memory, or disk; a create that sets none keeps the defaults. A request raised above a limit set in the same create is rejected with a 400 error. Guaranteed CPU is also raised to at least one core per 8 GiB of guaranteed memory. A sandbox may additionally set per-sandbox limits on cores (a multiple of 0.5, between 0.5 and 16), memory in MiB (between 256 and 32768), and disk in MiB (between 512 and 262144), which can only lower the boot shape below the platform maximum. See [sandbox resources](./sandboxes.md#resources).

The organization's [plan](../platform/billing.md#get-the-plan) can cap Linux sandbox cores and memory below the platform maximum:

| **Plan**   | **Cores**    | **Memory (MiB)** |
| ---------- | ------------ | ---------------- |
| Starter    | **`4`**      | **`16384`**      |
| Team       | **`8`**      | **`32768`**      |
| Enterprise | **`64`**     | **`262144`**     |

The Enterprise caps are above the platform maximum, so the platform maximum applies. The plan caps apply to both the guarantee and the per-sandbox limits. A request above a plan cap is rejected with a 400 error that names the plan limit, and an omitted per-sandbox limit defaults to the plan cap. The plan response reports the core and memory caps of the organization.

## Organization limits

Organization limits cap the number of sandboxes, image builds, volumes, images, snapshots, and members across every project in an organization, and the number of secrets and API keys. Each limit is a ceiling, not a reservation: reaching it refuses new work, but nothing is set aside. A request that would exceed a limit is rejected with a 429 error with the code LIMIT_EXCEEDED that names the limit, the current count, and the maximum.

| **Limit**                 | **What it counts**                                                                                                         | **Checked on**                                | **Name in errors**      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------- |
| `sandboxes.concurrent`    | Sandboxes that hold or are about to hold compute: queued, pending, assigned, booting, running, pausing, stopping, or deleting | Create, fork, snapshot restore, start, resume | `max_concurrent_vms`    |
| `sandboxes.total`         | Concurrent sandboxes plus stopped and paused sandboxes. Deleted, failed, and lost sandboxes do not count                   | Create, fork, snapshot restore                | `max_total_vms`         |
| `image_builds.concurrent` | Image builds that are pending or building                                                                                  | Image build                                   | `max_concurrent_builds` |
| `storage.volumes`         | Volumes. Deleted volumes do not count                                                                                      | Volume create                                 | `max_volumes`           |
| `storage.images`          | Captured, built, and imported images. Failed images do not count                                                           | Image build, capture, and import              | `max_images`            |
| `storage.snapshots`       | Snapshots. Failed snapshots do not count                                                                                   | Snapshot create                               | `max_snapshots`         |
| `members`                 | Organization members. A pending invitation holds a member slot until it is accepted or declined                            | Member invitation                             | `max_members`           |
| `secrets_per_project`     | Secrets in one project. The response reports the highest count in any project                                              | Secret create                                 | `secrets_per_project`   |
| `api_keys_per_project`    | Live API keys in one project. Revoked and expired keys do not count. The response reports the highest count in any project | Project API key create                        | `api_keys_per_project`  |
| `api_keys_per_organization` | Live organization API keys. Revoked and expired keys do not count                                                        | Organization API key create                   | `api_keys_per_organization` |

### Get organization limits

Daytona provides methods to get the effective limits of an organization and the current usage counted against each one. When no limit applies, the cap is null. An API key reads the limits of its own organization, and its response leaves out the member counts.

```python
from daytona import Daytona

daytona = Daytona()
limits = daytona.v2.get_limits()
print(limits.sandboxes.concurrent.usage, limits.sandboxes.concurrent.limit)
```

| **Parameter** | **Description** |
| --- | --- |
| `organization_id` | Sets the organization to read.<br />**Default:** the organization of the API key, or none with JWT authentication<br />**Format:** an organization ID |

> **Notes:**
>
> - A request with an API key reads the organization of the key and leaves out the member counts.

## Rate limits

Rate limits control how many API requests you can make within a fixed 60 second window. Requests authenticated with an [API key](./api-keys.md) are counted per project: every API key in a project draws on the same budget, so adding keys does not raise the limit.

Requests are counted per organization with an [organization API key](./api-keys.md#organization-api-keys), per user from the Daytona Dashboard, and per sandbox with a sandbox-scoped token.

Daytona also blocks a client IP address for a window after repeated requests with invalid credentials. Requests that carry a valid API key are not affected by this block.

### Rate limit headers

When Daytona enforces the request rate limit, every authenticated response includes rate limit headers. A response without these headers was not counted against the request rate limit. The header names carry an authenticated suffix, which identifies the rate limit bucket:

| **Header**                             | **Description**                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `X-RateLimit-Limit-authenticated`      | Maximum number of requests allowed in the time window                        |
| `X-RateLimit-Remaining-authenticated`  | Number of requests remaining in the current window                           |
| `X-RateLimit-Reset-authenticated`      | Time in seconds until the rate limit window resets                           |
| `Retry-After`                          | Time in seconds to wait before retrying. Sent on `429` responses except `LIMIT_EXCEEDED`, and on some `503` responses |

### Rate limit errors

Daytona returns HTTP 429 Too Many Requests for the following conditions, identified by the code field in the response body. Use it, not the presence of headers, to decide how to react.

| **`code`**       | **Cause**                                                                                                                                          | **Retry**                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `RATE_LIMITED`   | The request rate limit for the project, organization, user, or sandbox was exceeded                                                                | Wait for the seconds in `Retry-After`, then retry                                             |
| `RATE_LIMITED`   | Too many requests with invalid credentials from the same IP address; the message is `too many failed authentication attempts`                  | Fix the credentials; the block lifts after the seconds in `Retry-After`                       |
| `OVERLOADED`     | The sandbox creation queue or the organization's admission queue is at capacity (returned by sandbox create, fork, start, resume, and image build) | Wait for the seconds in `Retry-After`, then retry                                             |
| `LIMIT_EXCEEDED` | An [organization limit](#organization-limits) is reached                                                                                           | Free capacity under the named limit, for example stop or delete sandboxes, wait for builds to finish, or delete volumes, images, or snapshots; the response carries no `Retry-After` |
| `TOO_MANY_REQUESTS` | A generic `429` with no more specific code                                                                                                  | Wait for the seconds in `Retry-After` when present, then retry                                |

The error response is a JSON object with the following properties:

| **Property**           | **Description**                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **`code`**             | The error code.                                                                                                               |
| **`message`**          | The error message.                                                                                                            |
| **`source`**           | The component that produced the error, `DAYTONA_API`.                                                                         |
| **`retry_after_seconds`** | Seconds to wait before retrying, also sent as the `Retry-After` header. Present on `RATE_LIMITED` and `OVERLOADED` responses. |
| **`limit`**            | On `LIMIT_EXCEEDED` responses, the limit hit, such as `max_concurrent_vms`.                                                   |
| **`current`**          | The organization's current count for `limit`. Present on `LIMIT_EXCEEDED` responses.                                          |
| **`max`**              | The organization's value for `limit`. Present on `LIMIT_EXCEEDED` responses.                                                  |
| **`trace_id`**         | The request trace ID.                                                                                                         |

```json
{
  "code": "RATE_LIMITED",
  "message": "request rate limit exceeded; retry after the indicated delay",
  "source": "DAYTONA_API",
  "retry_after_seconds": 42,
  "trace_id": "0af7651916cd43dd8448eb211c80319c"
}
```

The [Python](./README.md) and [TypeScript](../typescript-sdk/README.md) SDKs raise or throw a rate limit error for every 429 response, including the overloaded condition. A response for an exceeded limit raises a subclass of the rate limit error that also exposes the limit, the current usage, and the maximum. All SDK errors expose the HTTP status code, the error code, and the message:

```python
from daytona import Daytona
from daytona.v2 import LimitExceededError, RateLimitError

daytona = Daytona()

try:
    daytona.v2.create()
except LimitExceededError as e:
    print(e.limit, e.current, e.max)
except RateLimitError as e:
    print(e.status_code, e.code, e.message)
```

> **Notes:**
>
> - The SDK does not retry a rate limited request.
> - Wait for the seconds in retry_after_seconds before retrying a rate limited or overloaded request.

## Best practices

Best practices keep a client within its limits and help it recover when a request is refused.

- **Wait before retrying a 429 response.** Wait for the number of seconds in the `Retry-After` header, or in the `retry_after_seconds` field of the body, before retrying. If a retry is rejected again, back off exponentially (1s, 2s, 4s, 8s, and so on) instead of retrying at a fixed interval.

- **Monitor rate limit headers.** The [rate limit headers](#rate-limit-headers) `X-RateLimit-Remaining-authenticated` and `X-RateLimit-Reset-authenticated` track the budget left in the window. Throttle the client before it reaches the limit, and do not treat a response without these headers as an error.

- **Distinguish `RATE_LIMITED` from `OVERLOADED`.** A `RATE_LIMITED` response means the project, organization, user, or sandbox sent too many requests; slow down the caller. An `OVERLOADED` response means the sandbox creation queue or the organization's admission queue is full; retry after the delay without reducing your request rate elsewhere.

- **Do not retry `LIMIT_EXCEEDED` on a timer.** The request succeeds only after the count for the named `limit` drops below `max`. Stopping or deleting sandboxes frees concurrent slots once the sandbox leaves the stopping or deleting state; only deleting sandboxes frees `max_total_vms` slots. Build slots free when image builds finish, and deleting a volume, an image, or a snapshot frees the slot that each one holds.

- **Cache API responses.** Cache responses that change infrequently, such as [sandbox lists](./sandboxes.md#list-sandboxes), [available regions](./regions.md), and [snapshot information](./snapshots.md), to avoid unnecessary requests.

- **Avoid tight polling loops.** Poll for state changes at an interval within the remaining budget, and monitor your logs for `429` errors to catch rate limiting before it affects users.

## Permissions

Organization limits can be read with a project API key or by a signed-in member.

Every role includes the organization read permission. The rate limit example creates sandboxes, so it also requires the permission to write sandboxes.

| **Permission**          | **Grants**                                     |
| ----------------------- | ---------------------------------------------- |
| **`read:limits`**       | Get organization limits with a project API key |
| **`read:organization`** | Get organization limits when signed in         |
