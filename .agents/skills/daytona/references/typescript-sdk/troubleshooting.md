## Contents

- Sandbox lifecycle
- Account
- Runtime and access
- Error handling
- See Also




Building on Daytona means creating sandboxes, moving them through their lifecycle, and running code and services inside them. Those operations share a common surface: Daytona Dashboard, SDKs, CLI, and API, all backed by the sandbox model, organization, and resources.

When something does not behave as expected, the returned error and the sandbox record identify the cause. From there you retry the call, adjust the request, recover the sandbox, or create a new one. Account and organization issues often look like missing resources or permission failures before any sandbox call runs.

## Sandbox lifecycle

A sandbox moves from create through start and into later size and placement changes. Create selects a [sandbox class](./sandboxes.md) and reserves resources from the regional pool. [Provisioning](#provisioning) then decides how that create is fulfilled: snapshot builds, [warm pools](./warm-pools.md), [region](./regions.md) availability, and [resize](./sandboxes.md#resize-sandboxes).

### Create and start

Create and start allocate a sandbox from a snapshot or image and bring it to a running state. The request selects a [sandbox class](./sandboxes.md) and reserves **vCPU**, **memory**, and **disk** from the organization's regional pool. Each class has its own create rules and quota.

**Container:**

**Symptom:** Creating a container sandbox fails with `400` / `DaytonaBadRequestError`. The message typically reports that the total CPU, memory, or disk limit is exceeded for the region.

**Cause:** Container sandboxes draw from the organization's compute and storage pool in that region. Stopped container sandboxes free CPU and memory, but they still occupy disk quota until they are [archived](./sandboxes.md#archive-sandboxes) or deleted. A full disk quota can therefore block create even when CPU and memory look available.

**Solution:**

1. Check current usage in [Limits ↗](https://app.daytona.io/dashboard/limits)
2. Stop sandboxes you are not using to free CPU and memory
3. [Archive](./sandboxes.md#archive-sandboxes) or delete stopped container sandboxes to free disk quota
4. Upgrade your [tier](../platform/limits.md#tiers) if the pool itself is too small

See [create sandboxes](./sandboxes.md#create-sandboxes) and [disk quota](../platform/limits.md#disk-quota).

**Linux VM:**

**Symptom:** Creating a Linux VM sandbox fails with `400` / `DaytonaBadRequestError`, or a create from a declarative image does not yield a Linux VM sandbox.

**Cause:** Linux VM sandboxes can only be created from existing [VM snapshots](./snapshots.md#vm-snapshots) such as `daytona-vm-small`, or a custom snapshot with sandbox class `LINUX_VM`. The declarative builder applies to [container sandboxes](./sandboxes.md#create-sandboxes) only. Quotas are tracked per sandbox class and region, so unused container capacity does not free Linux VM capacity.

**Solution:**

1. Create from a Linux VM snapshot such as **`daytona-vm-small`**, **`daytona-vm-medium`**, or **`daytona-vm-large`**
2. Confirm regional quota for the Linux VM class in [Limits ↗](https://app.daytona.io/dashboard/limits)
3. If the region is unavailable for the class, pick another region or contact [support@daytona.io](mailto:support@daytona.io)

See [VM sandboxes](./sandboxes.md#vm-sandboxes) and [VM snapshots](./snapshots.md#vm-snapshots).

**Windows:**

**Symptom:** Creating a Windows sandbox fails with `400` / `DaytonaBadRequestError`, or a create from a declarative image does not yield a Windows sandbox.

**Cause:** Windows sandboxes can only be created from existing [VM snapshots](./snapshots.md#vm-snapshots) such as `windows-small`, or a custom snapshot with sandbox class `WINDOWS`. The declarative builder applies to [container sandboxes](./sandboxes.md#create-sandboxes) only. Quotas are tracked per sandbox class and region, so unused container capacity does not free Windows capacity.

**Solution:**

1. Create from a Windows snapshot such as **`windows-small`**, **`windows-medium`**, or **`windows-large`**
2. Confirm regional quota for the Windows class in [Limits ↗](https://app.daytona.io/dashboard/limits)
3. If the region is unavailable for the class, pick another region or contact [support@daytona.io](mailto:support@daytona.io)

See [VM sandboxes](./sandboxes.md#vm-sandboxes) and [VM snapshots](./snapshots.md#vm-snapshots).

**GPU:**

**Symptom:** Creating a GPU sandbox fails with `400` / `DaytonaBadRequestError`. The message typically reports that the total GPU limit is exceeded, sometimes with `Maximum allowed: 0`. A GPU sandbox may also stay in the `Pending Build` state instead of starting. Inside a started GPU sandbox, CUDA may also fail with device-unavailable errors such as error `999`.

**Cause:** GPU sandboxes on shared regions run in the [earth region](./regions.md#earth-region): Daytona selects the shared region and ignores the requested target, and error messages report `earth` as the region. The organization either has no GPU quota in the earth region, or existing and pending GPU sandboxes already use the available quota. A GPU sandbox in `Pending Build` is waiting for GPU capacity of the requested type to become available. A started sandbox can also land on a GPU that is not healthy for CUDA workloads.

**Solution:**

1. Confirm your organization has GPU quota under the earth region in [Limits ↗](https://app.daytona.io/dashboard/limits)
2. Check [GPU capacity](./sandboxes.md#gpu-capacity) for the requested type. Fall back to another GPU type or create a [spot GPU sandbox](./sandboxes.md#spot-gpu-sandboxes) if capacity is available
3. Try again later if pending GPU usage is consuming the pool
4. If CUDA fails inside a started sandbox, delete it and create a new GPU sandbox
5. For a specific region or repeated device faults, contact [support@daytona.io](mailto:support@daytona.io)

See [GPU sandboxes](./sandboxes.md#gpu-sandboxes) and [regions](./regions.md).

### Provisioning

Provisioning covers how a create is fulfilled after the sandbox class is chosen: [warm pools](./warm-pools.md), [snapshot](./snapshots.md) builds, [region](./regions.md) availability, and [resize](./sandboxes.md#resize-sandboxes) of reserved resources.

**Warm pools:**

**Symptom:** A warm pool exists for the snapshot, but create still takes a cold-start path. The new sandbox works, yet it does not come from the pool and start time is higher than expected. Separately, `GET` or `POST` `/api/warm-pools` may return `404`.

**Cause:** Warm claim is exact. The create request must match the pool on snapshot, region, the snapshot's default CPU, memory, and disk, the default OS user (`daytona`), and must not set custom environment variables, volumes, or secrets. Any mismatch skips the pool. The warm pools API is also gated: when warm pools are not enabled for the organization, those endpoints return `404` even though they appear in the docs.

**Solution:** Align the create request with the pool, or accept a cold create when you need custom env, volumes, secrets, or resources. If the API returns `404`, use the Dashboard **Warm Pool** controls when available, or contact [support@daytona.io](mailto:support@daytona.io) to enable warm pools for your organization. See [warm pools](./warm-pools.md).

**Resize:**

**Symptom:** Updating sandbox resources with `resize` fails, or the sandbox stays on the previous CPU, memory, or disk allocation.

**Cause:** Resize rules depend on whether the sandbox is running. While started, you can only increase CPU and memory. Decreasing CPU or memory, or increasing disk, requires the sandbox to be stopped first. Disk can only grow, and GPU allocation cannot be changed after create.

**Solution:** Stop the sandbox, resize within [organization limits](../platform/limits.md), then start. See [resize sandboxes](./sandboxes.md#resize-sandboxes).

**Build:**

**Symptom:** Create or start stays in a pending state for a long time, then the sandbox moves to `error`, or a snapshot build never finishes. `errorReason` may mention a start or build deadline.

**Cause:** Snapshot builds and sandbox starts have time bounds. A long image export, a failed base image pull, or a start that does not complete leaves the sandbox or snapshot in an error state. A failed snapshot can also block later creates that reuse the same image or snapshot name.

**Solution:**

1. Read **`sandbox.errorReason`** and **`sandbox.recoverable`**
2. If **`recoverable`** is **`true`**, call **`sandbox.recover()`**
3. If the snapshot is in an error state, delete or rebuild it, then create again from a healthy snapshot
4. If creates keep failing for the same image or snapshot after a prior failure, contact [support@daytona.io](mailto:support@daytona.io)

See [recover sandboxes](./sandboxes.md#recover-sandboxes) and [snapshots](./snapshots.md).

**Region:**

**Symptom:** Create fails with a message such as `Selected snapshot is not available in any region you can use`, or `Snapshot ... is not available in region ...`. Linux VM or Windows creates stay unavailable after a tier upgrade that should unlock them.

**Cause:** Snapshots are published per region, and each sandbox class needs regional capacity for that class. A snapshot that exists in the organization may still be missing from the target region, or the organization may not yet have quota for `LINUX_VM` / `WINDOWS` in that region after a tier change.

**Solution:**

1. Confirm the snapshot and class are available in the target region in [Snapshots ↗](https://app.daytona.io/dashboard/snapshots) and [Limits ↗](https://app.daytona.io/dashboard/limits)
2. Create with a region where the snapshot is active, or wait for the snapshot to finish publishing to that region
3. After a tier upgrade for VM access, confirm Linux VM or Windows quota appears for the region; if it does not, contact [support@daytona.io](mailto:support@daytona.io)

See [regions](./regions.md) and [VM sandboxes](./sandboxes.md#vm-sandboxes).

## Account

Account issues sit outside the sandbox lifecycle. They come from which [organization](../platform/organizations.md) you are working in, and from whether your membership and assignments allow the action. Quotas, API keys, and sandboxes are scoped per organization. For API key and HTTP auth failures, see [authentication](#authentication).

### Organization

**Symptom:** Sandboxes, snapshots, API keys, or limits you expect are missing in the Dashboard or API. Creates succeed, but the new sandbox appears under a different organization than your team uses. Quotas look empty or unexpectedly low compared with another organization.

**Cause:** Every user has a personal organization, and may also belong to one or more collaborative organizations. Each organization has its own sandboxes, API keys, and resource quotas. The Dashboard shows only the organization selected in the sidebar. An API key is bound to the organization that issued it, so a key from your personal organization cannot list or manage resources in a collaborative organization.

**Solution:**

1. In [Daytona Dashboard ↗](https://app.daytona.io/dashboard/), open the organization dropdown at the top-left of the sidebar and select the organization you intend to use
2. Confirm the sandbox, key, or limit under that organization
3. For SDKs, CLI, or API calls, use an [API key](../platform/api-keys.md) created in that same organization

See [organizations](../platform/organizations.md) and [personal vs collaborative](../platform/organizations.md#personal-vs-collaborative).

### Membership

**Symptom:** You are signed in and the correct organization is selected, but create, delete, or admin actions fail with `403` / `DaytonaForbiddenError`, or the Dashboard keeps resources read-only. A teammate invited you, yet you still cannot create sandboxes in that organization.

**Cause:** Collaborative organizations use roles and [assignments](../platform/organizations.md#role-assignments). Owners have full access. Members need assignments such as **Developer** to create sandboxes; **Viewer** alone grants no create or delete permissions, though every member can still run processes and read and write files in the organization's sandboxes. An invitation also does nothing until it is accepted, and access to that organization's quotas requires a new API key issued after you join.

**Solution:**

1. Open [Invitations ↗](https://app.daytona.io/dashboard/user/invitations) and accept any pending invitation for the organization
2. Ask an organization owner to grant the assignments you need (for example **Developer** to create sandboxes)
3. After joining, create an [API key](../platform/api-keys.md) in that organization and use it for SDK, CLI, and API calls

See [members](../platform/organizations.md#members), [invitations](../platform/organizations.md#invitations), and [authentication](#authentication).

## Runtime and access

Once a sandbox is started, it keeps a lifecycle state, accepts inbound and outbound traffic, and runs processes. Failures here show up in the sandbox record, preview or VNC sessions, network calls, process APIs, and rate-limit responses.

### State

State covers whether a started sandbox stays usable: [recovery](./sandboxes.md#recover-sandboxes) from error, [automated lifecycle](./sandboxes.md#automated-lifecycle-management) stops and deletes, and operations that depend on the [sandbox class](./sandboxes.md).

**Recovery:**

**Symptom:** The sandbox is no longer usable and reports `state` as `error`. Calls that expect a started sandbox fail, and `errorReason` describes what went wrong during start or restore, such as a timeout while creating, starting, or pulling a snapshot.

**Cause:** The sandbox failed to reach a healthy started state. Some of these failures are recoverable: Daytona can restore the sandbox from its last successful backup. Others are not, and the sandbox must be replaced.

**Solution:**

1. Read **`sandbox.errorReason`** and **`sandbox.recoverable`**
2. If **`recoverable`** is **`true`**, call **`sandbox.recover()`** and wait until the sandbox is started
3. If it is not recoverable, delete the sandbox and create a new one from a [snapshot](./snapshots.md)

See [recover sandboxes](./sandboxes.md#recover-sandboxes).

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

for await (const sandbox of daytona.list({ isRecoverable: true })) {
  await sandbox.recover()
}
```

**Inactivity:**

**Symptom:** A long-running process inside the sandbox is interrupted because the sandbox itself stops or pauses. From outside, the sandbox moves to `stopped` or `paused` even though work was still in progress.

**Cause:** [Auto-stop](./sandboxes.md#auto-stop-interval) or [auto-pause](./sandboxes.md#auto-pause-interval) treats the sandbox as idle when there is no qualifying activity. Processes that only run inside the sandbox do not count. Activity that resets the timer includes toolbox requests, preview traffic, SSH sessions, and lifecycle state changes.

**Solution:**

- Set **`auto_stop_interval=0`** (and **`auto_pause_interval=0`** on VM sandboxes) for jobs that must run without external interaction
- Or call **`sandbox.refresh_activity()`** from your orchestrator on a schedule while the job runs

See [automated lifecycle management](./sandboxes.md#automated-lifecycle-management).

**Deletion:**

**Symptom:** A sandbox ID that worked earlier can no longer be fetched. `get` or list does not return it, and the SDK may raise `DaytonaNotFoundError`.

**Cause:** The sandbox reached a lifetime bound and was removed. That happens when it was created as [ephemeral](./sandboxes.md#ephemeral-sandboxes) and then stopped, when [auto-delete](./sandboxes.md#auto-delete-interval) elapsed after it stayed stopped, or when [wall-clock TTL](./sandboxes.md#wall-clock-ttl) (`ttl_minutes`) expired in any state.

**Solution:** Check the create parameters and any later `set_ttl` / `set_auto_delete_interval` calls. Persist results to a [volume](./volumes.md) or [snapshot](./snapshots.md) before the sandbox is destroyed.

**Class capabilities:**

**Symptom:** Pause, fork, or a snapshot that includes memory fails, often with `422` / `DaytonaUnprocessableEntityError`, even though the sandbox is running.

**Cause:** Those operations are available only on [VM sandboxes](./sandboxes.md#vm-sandboxes) (Linux VM or Windows). Container and GPU sandboxes preserve the filesystem across stop and start, but they do not support pause, fork, or hot snapshots.

**Solution:** Create from a VM snapshot such as `daytona-vm-small`, or use stop/start and a [cold snapshot](./snapshots.md#create-snapshot-from-sandbox) for filesystem-only capture.

### Access

Access covers reaching services inside a started sandbox and driving work through it: [preview](./preview.md), [VNC](./vnc-access.md), [network](./network-limits.md) policy, [process](./process-code-execution.md) execution, and [rate limits](../platform/limits.md#rate-limits).

**Preview:**

**Symptom:** A browser or HTTP client cannot reach a service through the sandbox preview URL. The response is `401` or `403` even though the sandbox is started and the port is listening.

**Cause:** Preview authentication depends on the URL type, and the two token kinds are not interchangeable. A standard preview URL expects the token in the `x-daytona-preview-token` header, and that token is reset when the sandbox restarts. A signed preview URL embeds the token in the URL itself; it cannot be sent as a header, and it stops working when it expires or when signing keys are rotated.

**Solution:** Use the matching auth method for the URL type. Refresh standard tokens after restart. Check signed URL expiry. See [preview](./preview.md).

**VNC:**

**Symptom:** The Dashboard shows **VNC not available**, Computer Use start fails, or the VNC session returns `503` and does not connect. The issue can appear on Linux and Windows sandboxes.

**Cause:** VNC and Computer Use need the desktop stack in the sandbox image. Custom images without the [required packages](./vnc-access.md#required-packages) report that Computer Use is not available. The sandbox must also be started. Intermittent `503` or failed sessions usually clear after restarting Computer Use or recreating the sandbox.

**Solution:**

1. Confirm the sandbox is started
2. Use a default image, or install the packages listed in [VNC access](./vnc-access.md#required-packages)
3. Call **`sandbox.computer_use.start()`**, or open **VNC** again from the Dashboard
4. If the session still fails, stop and start the sandbox, or delete it and create a new one

See [VNC access](./vnc-access.md) and [Computer Use](./computer-use-guide.md).

**Network:**

**Symptom:** Package installs, `curl`, model downloads, or other outbound requests from inside the sandbox fail. Errors often look like `ECONNRESET`, `connection reset by peer`, or a hang while connecting to sites such as package registries and object storage. Separately, create or `update_network_settings` may return `400` / `DaytonaBadRequestError` when network options conflict.

**Cause:** Outbound access is controlled at both the organization and sandbox level. On Tier 1 and Tier 2, organization network restrictions always apply and sandbox-level allow lists cannot override them, so allowlisting domains on the sandbox alone does not open blocked destinations. On Tier 3 and Tier 4, a sandbox-level allow list or `network_block_all` is strict: [essential services](./network-limits.md#essential-services) are not auto-allowed and must be listed explicitly if you need them. At the sandbox level, `network_block_all`, a CIDR allow list, and a domain allow list are mutually exclusive: only one mode may be set, and combining them returns `400`.

**Solution:**

1. Check your [tier](../platform/limits.md#tiers) and [network limits](./network-limits.md)
2. On Tier 1 or Tier 2, use destinations listed in [essential services](./network-limits.md#essential-services), or [upgrade](../platform/limits.md#tiers) to Tier 3 or higher to configure sandbox-level network access
3. On Tier 3 or higher, set exactly one sandbox network mode that includes the destinations you need

```typescript
// Pick one mode only
await sandbox.updateNetworkSettings({ networkBlockAll: true })
// or
await sandbox.updateNetworkSettings({ networkAllowList: '208.80.154.232/32' })
// or
await sandbox.updateNetworkSettings({ domainAllowList: 'example.com,*.daytona.io' })
```

See [isolation](./isolation.md#network-isolation) and [create sandboxes with network restrictions](./network-limits.md#create-sandboxes-with-network-restrictions).

**Processes:**

**Symptom:** Running a command or session operation fails with `DaytonaProcessExecutionTimeoutError` (`PROCESS_EXECUTION_TIMEOUT`), `DaytonaSessionEndedError` (`SESSION_ENDED`), or `DaytonaCommandAlreadyCompletedError` (`COMMAND_ALREADY_COMPLETED`).

**Cause:** Process APIs enforce their own deadlines and session lifecycle. A timeout error means the command ran longer than the timeout passed to `exec` or `code_run`. A 410 session or command error means the shell session already ended, or the command already finished and cannot be waited on again.

**Solution:** Raise the timeout, or run long jobs asynchronously in a [session](./process-code-execution.md#session-operations) with `run_async=True` and poll for completion. For ended sessions or completed commands, create a new session and read the prior exit code or logs instead of re-executing.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.get('my-sandbox')

// Short interactive command
await sandbox.process.executeCommand('make test', undefined, undefined, 120)

// Long job: do not block the caller
await sandbox.process.createSession('build')
await sandbox.process.executeSessionCommand('build', {
  command: 'make build',
  runAsync: true,
})
```

**Rate limits:**

**Symptom:** Create, lifecycle, or other API calls start failing with `DaytonaRateLimitError`, HTTP `429`, or `ThrottlerException: Too Many Requests`, often when many sandboxes are created concurrently.

**Cause:** The organization exceeded a rate limit window for general API requests, sandbox creation, or sandbox lifecycle operations. Sandbox creation has its own per-minute cap by [tier](../platform/limits.md#rate-limits). Bursting above that cap, for example creating hundreds of sandboxes in one minute, returns `429` until the window resets.

**Solution:** Read `Retry-After-{throttler}` from the error headers, wait, then retry with backoff. Pace concurrent creates to stay under the sandbox-create limit, or contact [support@daytona.io](mailto:support@daytona.io) for a higher quota. See [rate limit retry](#rate-limit-retry) and [rate limit errors](../platform/limits.md#rate-limit-errors).

## Error handling

The Daytona SDKs raise subclasses of `DaytonaError` for API, daemon, proxy, and transport failures. Catch the precise class or catch `DaytonaError` for a general handler.

```typescript
import {
  Daytona,
  DaytonaError,
  DaytonaNotFoundError,
  DaytonaRateLimitError,
} from '@daytona/sdk'

const daytona = new Daytona()

try {
  const sandbox = await daytona.get('missing-sandbox')
} catch (error) {
  if (error instanceof DaytonaNotFoundError) {
    console.log(error.statusCode, error.message)
  } else if (error instanceof DaytonaRateLimitError) {
    console.log(error.headers?.get('retry-after-sandbox-create'))
  } else if (error instanceof DaytonaError) {
    console.log(error.statusCode, error.code, error.source, error.message)
  } else {
    throw error
  }
}
```

### Authentication

**Symptom:** API calls return `401` / `DaytonaAuthenticationError` or `403` / `DaytonaForbiddenError`, sometimes with a message about an invalid authentication context, even when an API key looks valid.

**Cause:** The key is missing, revoked, scoped to a different organization, or lacks the permission required for the operation. SDKs and the API bind requests to an organization; using a key from one org while targeting another, or omitting required organization context, produces auth failures. Dashboard sign-in issues (SSO, email alias requirements) are separate from API key auth.

**Solution:**

1. Create or rotate a key in [API Keys ↗](https://app.daytona.io/dashboard/keys) for the organization you intend to use
2. Set **`DAYTONA_API_KEY`** (or the SDK config equivalent) to that key
3. Confirm the key has the [permissions](../platform/api-keys.md#permissions--scopes) required for the call
4. For wrong-organization or membership issues in the Dashboard, see [account](#account)
5. For SSO or account sign-in problems in the Dashboard, contact [support@daytona.io](mailto:support@daytona.io)

See [API keys](../platform/api-keys.md) and [organizations](../platform/organizations.md).

### Error attributes

| **Attribute**     | **Description**                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| **`message`**     | Human-readable description. Varies per response; do not match on exact text.                                         |
| **`status_code`** | HTTP status when the error came from a Daytona service. `None` / unset for pure client-side failures.                |
| **`code`**        | Machine-readable code from the response envelope when present (for example `FILE_NOT_FOUND`).                        |
| **`source`**      | Originating service: `DAYTONA_API`, `DAYTONA_DAEMON`, or `DAYTONA_PROXY`. Unset when the response has no envelope. |
| **`headers`**     | Response headers (includes rate-limit headers on 429). Empty for client-side errors.                                 |

### HTTP status codes

| **Status** | **SDK class**                        | **When it is raised**                                      | **Typical response**                                      |
| ---------- | ------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------- |
| **`400`**  | **`DaytonaBadRequestError`**         | Malformed or invalid request                               | Fix parameters; do not retry as-is                        |
| **`401`**  | **`DaytonaAuthenticationError`**     | Missing or invalid credentials                             | Refresh API key / auth; do not retry with the same key    |
| **`403`**  | **`DaytonaForbiddenError`**          | Authenticated caller lacks permission                      | Check API key scopes and organization membership          |
| **`404`**  | **`DaytonaNotFoundError`**           | Resource does not exist                                    | Create or look up a different ID; do not retry            |
| **`408`**  | **`DaytonaTimeoutError`**            | Request timed out                                          | Retry idempotent reads; decide whether to recover/create  |
| **`409`**  | **`DaytonaConflictError`**           | Conflicts with current resource state                      | Refresh state, then decide                                |
| **`410`**  | **`DaytonaGoneError`**               | Resource existed but is permanently gone                   | Do not retry the same operation; recreate if needed       |
| **`422`**  | **`DaytonaUnprocessableEntityError`**| Well-formed request that is semantically invalid           | Fix parameters; do not retry as-is                        |
| **`429`**  | **`DaytonaRateLimitError`**          | Organization rate limit exceeded                           | Wait **`Retry-After-{throttler}`**, then retry with backoff   |
| **`500`**  | **`DaytonaInternalServerError`**     | Unexpected server failure                                  | Retry with backoff; escalate if persistent                |
| **`502`**  | **`DaytonaBadGatewayError`**         | Upstream dependency rejected or dropped the request        | Retry with backoff                                        |
| **`503`**  | **`DaytonaServiceUnavailableError`** | Service temporarily refusing traffic                       | Retry with backoff                                        |
| **`504`**  | **`DaytonaTimeoutError`**            | Gateway timed out                                          | Retry idempotent reads; decide whether to recover/create  |

### Daemon error codes

| **Code**                         | **SDK class**                              | **HTTP class**                   | **Meaning**                                              |
| -------------------------------- | ------------------------------------------ | -------------------------------- | -------------------------------------------------------- |
| **`GIT_AUTH_FAILED`**            | **`DaytonaGitAuthFailedError`**            | Authentication (`401`)           | Git credentials rejected by the remote                   |
| **`GIT_REPO_NOT_FOUND`**         | **`DaytonaGitRepoNotFoundError`**          | Not found (`404`)                | Git repository does not exist                            |
| **`GIT_BRANCH_NOT_FOUND`**       | **`DaytonaGitBranchNotFoundError`**        | Not found (`404`)                | Git branch does not exist                                |
| **`GIT_BRANCH_EXISTS`**          | **`DaytonaGitBranchExistsError`**          | Conflict (`409`)                 | Branch name already exists                               |
| **`GIT_PUSH_REJECTED`**          | **`DaytonaGitPushRejectedError`**          | Conflict (`409`)                 | Push rejected (non-fast-forward / stale ref)             |
| **`GIT_DIRTY_WORKTREE`**         | **`DaytonaGitDirtyWorktreeError`**         | Conflict (`409`)                 | Worktree has uncommitted changes                         |
| **`GIT_MERGE_CONFLICT`**         | **`DaytonaGitMergeConflictError`**         | Conflict (`409`)                 | Merge conflicts need resolution                          |
| **`FILE_NOT_FOUND`**             | **`DaytonaFileNotFoundError`**             | Not found (`404`)                | Filesystem entry not found                               |
| **`FILE_ACCESS_DENIED`**         | **`DaytonaFileAccessDeniedError`**         | Forbidden (`403`)                | Insufficient filesystem permissions                      |
| **`INVALID_FILE_PATH`**          | **`DaytonaInvalidFilePathError`**          | Bad request (`400`)              | Invalid filesystem path (TypeScript SDK)                 |
| **`FILE_READ_FAILED`**           | **`DaytonaFileReadFailedError`**           | Internal server (`500`)          | Filesystem read failed (TypeScript SDK)                  |
| **`LSP_SERVER_NOT_INITIALIZED`** | **`DaytonaLspServerNotInitializedError`**  | Bad request (`400`)              | LSP server must be started first                         |
| **`PROCESS_EXECUTION_TIMEOUT`**  | **`DaytonaProcessExecutionTimeoutError`**  | Timeout                          | Process exceeded its execution timeout                   |
| **`PROCESS_NOT_FOUND`**          | **`DaytonaProcessNotFoundError`**          | Not found (`404`)                | Process is not running                                   |
| **`SESSION_ENDED`**              | **`DaytonaSessionEndedError`**             | Gone (`410`)                     | Shell session has ended                                  |
| **`COMMAND_ALREADY_COMPLETED`**  | **`DaytonaCommandAlreadyCompletedError`**  | Gone (`410`)                     | Shell command already finished                           |
| **`A11Y_UNAVAILABLE`**           | **`DaytonaA11yUnavailableError`**          | Service unavailable (`503`)      | Accessibility (AT-SPI) bus not reachable                 |
| **`RECORDING_STILL_ACTIVE`**     | **`DaytonaRecordingStillActiveError`**     | Conflict (`409`)                 | Recording still running; stop it first                   |
| **`RECORDING_FFMPEG_NOT_FOUND`** | **`DaytonaRecordingFfmpegNotFoundError`**  | Service unavailable (`503`)      | `ffmpeg` not installed; required for recording           |

> **Full reference**: [Python SDK errors](../python-sdk/errors.md), [TypeScript SDK errors](./errors.md), [Go SDK errors](../go-sdk/errors.md).

### Client-side errors

| **SDK class**                         | **When it is raised**                                              | **Typical response**                         |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| **`DaytonaConnectionError`**          | Cannot connect or the connection drops mid-request                 | Retry with backoff                           |
| **`DaytonaConnectionTimeoutError`**   | Transport connect/read timeout                                     | Retry with backoff; raise client timeout     |
| **`DaytonaInvalidArgumentError`**     | SDK rejected arguments locally before sending a request (TypeScript) | Fix arguments; do not retry as-is          |
| **`DaytonaTimeoutError`**             | Client wait deadline on lifecycle helpers (for example `start`)    | Raise timeout or recover/recreate            |

### Rate limit retry

```typescript
import { Daytona, DaytonaRateLimitError } from '@daytona/sdk'

const daytona = new Daytona()

async function createWithRetry(maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await daytona.create()
    } catch (error) {
      if (!(error instanceof DaytonaRateLimitError) || attempt === maxRetries - 1) {
        throw error
      }
      const retryAfter = error.headers?.get('retry-after-sandbox-create')
      const delay = retryAfter
        ? parseInt(String(retryAfter)) * 1000
        : Math.pow(2, attempt) * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
```

### SDK timeouts

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.get('my-sandbox')

// Wait up to 40 seconds for recover to reach started
if (sandbox.recoverable) {
  await sandbox.recover(40)
}

// Wait up to 60 seconds for start
await sandbox.start(60)
```

## See Also
- [Python SDK - troubleshooting](../python-sdk/troubleshooting.md)
