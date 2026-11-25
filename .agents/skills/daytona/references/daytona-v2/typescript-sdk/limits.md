# Limits (TypeScript SDK)

Overview of sandbox resource limits, organization limits, and API rate limits.

Limits come in three kinds. [Sandbox limits](#sandbox-limits) cap the size of a single sandbox and how long it can run, and [organization limits](#organization-limits) cap what an organization has at once. [Rate limits](#rate-limits) cap how many API requests a project can make within a time window.

## Contents

- [Sandbox limits](#sandbox-limits)
- [Organization limits](#organization-limits)
- [Rate limits](#rate-limits)
- [Best practices](#best-practices)
- [Permissions](#permissions)

## Sandbox limits

Sandbox limits cap the size of a single sandbox and how long it can run. They depend on the [plan](../platform/billing.md#get-the-plan): a sandbox without set limits can use up to the limits of its plan, and a request above them is rejected. The default and minimum size of a sandbox are listed under [resources](./sandboxes.md#resources).

|  | **Starter** | **Team** | **Enterprise** |
| --- | --- | --- | --- |
| **Cores** | 64 | 64 | Custom |
| **Memory** | 128 GiB | 128 GiB | Custom |
| **Ephemeral disk** | 512 GiB | 1 TiB | 3 TiB |
| **GPU cards** | 1 | 8 | 8 |
| **Session length** | 24 hours | 48 hours | Custom |

## Organization limits

Organization limits cap how many members an organization has and how many sandboxes, GPUs, Windows core licenses, and Mac reservations it uses at once. They depend on the [plan](../platform/billing.md#get-the-plan), and a request above a limit is rejected.

|  | **Starter** | **Team** | **Enterprise** |
| --- | --- | --- | --- |
| **Members** | Up to 3 | Unlimited | Unlimited |
| **Concurrent sandboxes** | 100 | 5,000 | Custom |
| **CPU cores** | Unlimited | Unlimited | Unlimited |
| **GPU cards** | 7 | 50 | Custom |
| **Windows core licenses** | 10 | 50 | Custom |
| **Mac reservations** | 10 | 50 | Custom |
| **Secrets** | Unlimited | Unlimited | Unlimited |
| **Snapshots** | Unlimited | Unlimited | Unlimited |

### Get organization limits

Daytona provides methods to get the effective limits of an organization and the current usage counted against each one. When no limit applies, the cap is null. An API key reads the limits of its own organization, and its response leaves out the member counts.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const limits = await daytona.v2.getLimits()
console.log(limits.sandboxes.concurrent.usage, limits.sandboxes.concurrent.limit)
```

| **Parameter** | **Description** |
| --- | --- |
| `organizationId` | Sets the organization to read.<br />**Default:** the organization of the API key, or none with JWT authentication<br />**Format:** an organization ID |

> **Notes:**
>
> - **Results:** A request with an API key reads the organization of the key and leaves out the member counts.

## Rate limits

Rate limits control how many API requests you can make within a fixed 60 second window. Requests authenticated with an [API key](./api-keys.md) are counted per project: every API key in a project draws on the same budget, so adding keys does not raise the limit.

Other credentials have budgets of their own. Requests with an [organization API key](./api-keys.md#organization-api-keys) are counted per organization, shared by every key in it, and requests with a sandbox-scoped token per sandbox. Dashboard requests that manage organizations, projects, members, and keys are counted per signed-in user, and dashboard requests on project resources per project.

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

**Response:**

```json
{
  "code": "RATE_LIMITED",
  "message": "request rate limit exceeded; retry after the indicated delay",
  "source": "DAYTONA_API",
  "retry_after_seconds": 42,
  "trace_id": "0af7651916cd43dd8448eb211c80319c"
}
```

The [Python](../python-sdk/README.md) and [TypeScript](./README.md) SDKs raise or throw a rate limit error for every 429 response, including the overloaded condition. A response for an exceeded limit raises a subclass of the rate limit error that also exposes the limit, the current usage, and the maximum. All SDK errors expose the HTTP status code, the error code, and the message:

```typescript
import { Daytona } from '@daytona/sdk'
import { LimitExceededError, RateLimitError } from '@daytona/sdk/v2'

const daytona = new Daytona()

try {
  await daytona.v2.create()
} catch (error) {
  if (error instanceof LimitExceededError) {
    console.log(error.limit, error.current, error.max)
  } else if (error instanceof RateLimitError) {
    console.log(error.statusCode, error.code, error.message)
  }
}
```

> **Notes:**
>
> - **Recovery:** The SDK does not retry a rate limited request. Wait for the seconds in retryAfterSeconds before retrying a rate limited or overloaded request.

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
