## Contents

- Resources
- Sandbox limits
- Disk quota
- Rate limits
- Tiers
- Limits
- Best practices
- See Also




[Daytona Limits ↗](https://app.daytona.io/dashboard/limits) provide an overview of your organization's [resources](#resources), [sandbox limits](#sandbox-limits), and [rate limits](#rate-limits). Daytona uses a [tier-based](#tiers) system where organizations are placed into tiers based on verification status, with each tier providing access to a specific compute pool and rate limits. For information on spending and wallet management, see [billing](./billing.md).

## Resources

Resources are shared across all running sandboxes. The number of sandboxes you can run at once depends on their individual usage. Organizations are automatically placed into a tier based on verification status and have access to a compute pool consisting of:

- **Compute**: the total CPU cores available
- **Memory**: the total RAM available
- **Storage**: the total disk space available

## Sandbox limits

Sandbox limits provides an overview of resource limits per sandbox.

- **Compute**: the maximum number of vCPUs per sandbox
- **Memory**: the maximum amount of memory per sandbox in GiB
- **Storage**: the maximum amount of storage per sandbox in GiB

Sandboxes count against these limits based on their [lifecycle state](../python-sdk/sandboxes.md#sandbox-lifecycle): stopped, paused, archived, and deleted sandboxes free reserved CPU and memory, while disk quota depends on the sandbox type and state.

## Disk quota

Disk quota and [sandbox billing](./billing.md#sandbox-billing) are separate: a sandbox can be billed for reserved disk without counting against your organization's storage limit. The table below details which states occupy disk quota for [container sandboxes](../python-sdk/sandboxes.md#create-sandboxes) and [VM sandboxes](../python-sdk/sandboxes.md#vm-sandboxes).

| **State** | **Container Sandbox** | **VM Sandbox <br /> (Linux VM and Windows)** | **Description**                                                                                                                                                                                                                                                                                                                           |
| --------- | --------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stopped   | ✓                     | ✗                                            | Stopped container sandboxes occupy disk quota until archived. Stopped VM sandboxes free the quota: their state is offloaded to a storage layer, which keeps resume fast while releasing quota.                                                                                                                                            |
| Paused    | ✗                     | ✗                                            | Paused VM sandboxes free the disk quota. Supported for <u>[**VM sandboxes**](../python-sdk/sandboxes.md#vm-sandboxes)</u> only.                                                                                                                                                                                                                   |
| Archived  | ✗                     | ✗                                            | <u>[**Archiving**](../python-sdk/sandboxes.md#archive-sandboxes)</u> moves the container filesystem to object storage, frees the quota, and stops billing. Supported for <u>[**container sandboxes**](../python-sdk/sandboxes.md#create-sandboxes)</u> only. VM sandboxes have no archive state because stopping or pausing them already frees the quota. |

## Rate limits

Rate limits control how many API requests you can make within a specific time window. These limits are applied based on your tier, authentication status, and the type of operation you're performing. Rate limits for general authenticated requests are tracked per organization.

| **Tier**   | **General Requests <br />(per min)** | **Sandbox Creation <br />(per min)** | **Sandbox Lifecycle <br />(per min)** |
| ---------- | ------------------------------------ | ------------------------------------ | ------------------------------------- |
| Tier 1     | 10,000                               | 300                                  | 10,000                                |
| Tier 2     | 20,000                               | 400                                  | 20,000                                |
| Tier 3     | 40,000                               | 500                                  | 40,000                                |
| Tier 4     | 50,000                               | 600                                  | 50,000                                |
| Enterprise | Custom                               | Custom                               | Custom                                |

### Rate limit headers

Daytona includes rate limit information in API response headers. Header names include a suffix based on which rate limit is triggered (e.g., `-anonymous`, `-authenticated`, `-sandbox-create`, `-sandbox-lifecycle`):

| Header Pattern                          | Description                                                               |
| --------------------------------------- | ------------------------------------------------------------------------- |
| **`X-RateLimit-Limit-{throttler}`**     | Maximum number of requests allowed in the time window                     |
| **`X-RateLimit-Remaining-{throttler}`** | Number of requests remaining in the current window                        |
| **`X-RateLimit-Reset-{throttler}`**     | Time in seconds until the rate limit window resets                        |
| **`Retry-After-{throttler}`**           | Time in seconds to wait before retrying (included when limit is exceeded) |

### Rate limit errors

Daytona [Python](../python-sdk/README.md), [TypeScript](../typescript-sdk/README.md), [Ruby](../ruby-sdk/README.md) and [Go](../go-sdk/README.md) SDKs raise or throw a `DaytonaRateLimitError` exception (Python) or error (TypeScript, Ruby and Go) when you exceed a rate limit.

The rate limit error response is a JSON object with the following properties:

- **`statusCode`**: the HTTP status code of the error
- **`message`**: the error message
- **`error`**: the error type

```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded",
  "error": "Too Many Requests"
}
```

All errors include [**`headers`**](#rate-limit-headers) and status code properties, allowing access to rate limit headers directly from the error object. Headers support case-insensitive access:

**TypeScript:**

```typescript
try {
  await daytona.create()
} catch (error) {
  if (error instanceof DaytonaRateLimitError) {
    console.log(error.headers?.get('x-ratelimit-remaining-sandbox-create'))
    console.log(error.headers?.get('X-RateLimit-Remaining-Sandbox-Create')) // also works
  }
}
```

**Python:**

```python
try:
  daytona.create(snapshot="my-snapshot")
except DaytonaRateLimitError as e:
  print(e.headers['x-ratelimit-remaining-sandbox-create'])
  print(e.headers['X-RateLimit-Remaining-Sandbox-Create'])  # also works
```

**Ruby:**

```ruby
begin
  daytona.create
rescue Daytona::Sdk::Error => e
  puts "Error: #{e.message}"
end
```

**Go:**

```go
sandbox, err := daytona.Create(ctx, nil)
if err != nil {
  var rateLimitErr *errors.DaytonaRateLimitError
  if errors.As(err, &rateLimitErr) {
    fmt.Println(rateLimitErr.Headers.Get("x-ratelimit-remaining-sandbox-create"))
    fmt.Println(rateLimitErr.Headers.Get("X-RateLimit-Remaining-Sandbox-Create")) // also works
  }
}
```

## Tiers

Limits are applied to your organization's default region. To unlock higher limits, complete the following verification steps in the [Daytona Dashboard ↗](https://app.daytona.io/dashboard/limits):

| **Tier** | **Resources (vCPU / RAM / Storage)** | **Access Requirements**                                 |
| -------- | ------------------------------------ | ------------------------------------------------------- |
| Tier 1   | 10 / 10GiB / 30GiB                   | Email verified                                          |
| Tier 2   | 100 / 200GiB / 300GiB                | Credit card linked, $25 top-up                          |
| Tier 3   | 250 / 500GiB / 2000GiB               | $500 top-up                                             |
| Tier 4   | 500 / 1000GiB / 5000GiB              | $2000 top-up every 30 days                              |
| Custom   | Custom                               | Contact [support@daytona.io](mailto:support@daytona.io) |
> **Note: Tier-based network restrictions**
> [Network limits](../python-sdk/network-limits.md) are automatically applied based on your organization's billing tier.

## Limits

Limits provide an overview of tiers and their corresponding resource and rate limits.

| **Tier**       | **Compute (vCPU)** | **Memory (GiB)** | **Storage (GiB)** | **API Requests (minutes)** | **Sandbox Creation (minutes)** | **Sandbox Lifecycle (minutes)** |
| -------------- | ------------------ | ---------------- | ----------------- | -------------------------- | ------------------------------ | ------------------------------- |
| **1**          | 10                 | 20               | 30                | 10,000                     | 300                            | 10,000                          |
| **2**          | 100                | 200              | 300               | 20,000                     | 400                            | 20,000                          |
| **3**          | 250                | 500              | 2,000             | 40,000                     | 500                            | 40,000                          |
| **4**          | 500                | 1,000            | 5,000             | 50,000                     | 600                            | 50,000                          |
| **Enterprise** | Custom             | Custom           | Custom            | Custom                     | Custom                         | Custom                          |

## Best practices

To work effectively within rate limits, always handle `429` errors gracefully with proper retry logic. When you receive a rate limit error, implement exponential backoff and wait progressively longer between retries (1s, 2s, 4s, 8s, etc.) to avoid overwhelming the API.

**Monitor [rate limit headers](#rate-limit-headers)** (e.g., `X-RateLimit-Remaining-{throttler}`, `X-RateLimit-Reset-{throttler}`) to track your consumption and implement proactive throttling before hitting limits. These headers are available on all error objects via the `headers` property.

**Cache API responses** that don't frequently change, such as [sandbox lists](../python-sdk/sandboxes.md#list-sandboxes) (when relatively static), [available regions](../python-sdk/regions.md), and [snapshot information](../python-sdk/snapshots.md). This reduces unnecessary API calls and helps you stay well within your limits.

**Batch and optimize operations** by creating multiple sandboxes in parallel (within rate limits) rather than sequentially. Consider reusing existing sandboxes when possible instead of creating new ones for every task.

**Efficiently manage sandbox lifecycle** to reduce API calls. [Archive sandboxes](../python-sdk/sandboxes.md#archive-sandboxes) instead of deleting and recreating them, stop sandboxes when not in use rather than deleting them, and leverage [auto-stop intervals](../python-sdk/sandboxes.md#auto-stop-interval) to automatically manage running sandboxes without manual intervention.

**Implement request queuing** to prevent bursts that exceed limits, and use [webhooks](./webhooks.md) instead of polling for state changes to avoid unnecessary API calls. Set up monitoring and alerts for `429` errors in your application logs so you can proactively address rate limiting issues before they impact your users.

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
