# Daytona (Python SDK reference)

## Contents

- [DaytonaConfig](#daytonaconfig)
- [Daytona](#daytona)
- [AsyncDaytona](#asyncdaytona)
- [DaytonaV2Client](#daytonav2client)
- [AsyncDaytonaV2Client](#asyncdaytonav2client)
- [LifecyclePolicyOptions](#lifecyclepolicyoptions)
- [ListResult](#listresult)
- [Resources](#resources)
- [NetworkPolicyInput](#networkpolicyinput)
- [NetworkPolicy](#networkpolicy)
- [NetworkPolicyInfo](#networkpolicyinfo)
- [SnapshotRef](#snapshotref)
- [ProjectBudget](#projectbudget)
- [AuditActionGroup](#auditactiongroup)
- [AuditActionList](#auditactionlist)
- [RegistryImageSource](#registryimagesource)
- [NamedImageSource](#namedimagesource)
- [ManifestImageSource](#manifestimagesource)
- [ListSandboxesOptions](#listsandboxesoptions)
- [MacosResources](#macosresources)
- [OrganizationLimits](#organizationlimits)
- [ProjectApiKey](#projectapikey)
- [UsageLimit](#usagelimit)
- [MemberLimits](#memberlimits)
- [V0\_API\_URL: `Final[str]`](#v0apiurl-finalstr)
- [DEFAULT\_V2\_API\_URL: `Final[str]`](#defaultv2apiurl-finalstr)
- [JsonValue](#jsonvalue)
- [CpuArch](#cpuarch)
- [SnapshotClass](#snapshotclass)
- [SnapshotKind](#snapshotkind)
- [LifecycleAction](#lifecycleaction)
- [DISABLED: `int`](#disabled-int)

## DaytonaConfig

```python
@dataclass(kw_only=True)
class DaytonaConfig()
```

Configuration shared by every API version.

One credential serves both namespaces: `api_key` (`DAYTONA_API_KEY`)
or `jwt_token` (`DAYTONA_JWT_TOKEN`). A JWT is scoped by
`organization_id` for v0 and `project_id` for v2. Fields left unset
are read from the environment by each namespace.

There is no region or API URL field here. Pass `region=` to a v2 create.
`DAYTONA_V2_API_URL` (a regional endpoint or a test environment) selects the v2 API
endpoint and never reaches v0; `DAYTONA_API_URL` belongs to the 0.x SDK
and SDK 2.x ignores it for routing (a custom value warns once per process).

`Daytona(config)` / `AsyncDaytona(config)` copy the fields when the
client is built: changing the object afterwards has no effect on it.

`target` is deprecated and applies to `.v0` only (the v0 client's
default region). Pass `target` to each v0 sandbox create
(`CreateSandboxFromSnapshotParams(target=...)`) or `region_id` to each
v0 snapshot create instead. Setting it still works and emits a
`DeprecationWarning`.
`request_timeout` (seconds; default 60; `0`, or a value above
2,147,483.647 (about 24.8 days), means no limit) is the total
time one ordinary v2 request may take; waits and streams are not cut by
it, and file transfers are bounded by it only while idle (no bytes moving
for that long; with `0`, not at all). `max_response_bytes` (an integer up to 2**53 - 1; `None` keeps the 1 GiB default, `0` means no limit, and any other value (negative, fractional, boolean, string, too large) is a `BadRequestError`)
caps every v2 response body the SDK holds in memory whole; the in-memory
file reads take it per call too. `request_timeout`, `connection_pool_maxsize` and
`otel_enabled` tune the v2 client's HTTP transport;
`connection_pool_maxsize` and `otel_enabled` reach v0 too.
`shared_hub` and `events` (`daytona.v2.SandboxEventsConfig`) configure
the v2 client's sandbox-state events hub; v0 has no such hub.

**Attributes**:

- `api_key` _Optional\[str\] = field(default=None, repr=False)_
- `jwt_token` _Optional\[str\] = field(default=None, kw_only=True, repr=False)_
- `organization_id` _Optional\[str\] = field(default=None, kw_only=True)_
- `project_id` _Optional\[str\] = field(default=None, kw_only=True)_
- `target` _Optional\[str\] = field(default=None, kw_only=True)_
- `request_timeout` _Optional\[float\] = field(default=None, kw_only=True)_
- `max_response_bytes` _Optional\[int\] = field(default=None, kw_only=True)_
- `connection_pool_maxsize` _Optional\[int\] = field(default=None, kw_only=True)_
- `otel_enabled` _Optional\[bool\] = field(default=None, kw_only=True)_
- `shared_hub` _bool = field(default=True, kw_only=True)_
- `events` _Optional\[SandboxEventsConfig\] = field(default=None, kw_only=True)_

## Daytona

```python
class Daytona(_Root)
```

The synchronous client: `Daytona().v0` and `Daytona().v2`.

Every operation goes through a version namespace; the root itself only
holds the shared configuration. `with Daytona() as d:` (or `close()`)
closes whichever namespace clients were built.

#### Daytona.\_\_init\_\_

```python
def __init__(config: Optional[DaytonaConfig] = None) -> None
```

#### Daytona.v2

```python
@property
def v2() -> _DaytonaV2
```

The v2 client (v2's synchronous client), built on first access.

Owned by the root: close the root, not this client (a closed v2 client
stays cached and its calls fail).

#### Daytona.v0

```python
@property
def v0() -> _DaytonaV0
```

The v0 client (the bundled 0.x `Daytona`), built on first access.

Needs the `v0-sdk` extra (`pip install "daytona[v0-sdk]"`); raises
`ImportError` naming it otherwise.

#### Daytona.close

```python
def close() -> None
```

Close the namespace clients built so far. Idempotent.

Closes the v2 client and the v0 client. The bundled 0.x sync
`Daytona` has no `close()`, so the root releases its event socket
(and tracer provider) directly.
Stored v2 clients and their handles raise `ClientClosedError` on new
requests. Accessing `root.v2` again builds a fresh working client.

## AsyncDaytona

```python
class AsyncDaytona(_Root)
```

The asynchronous client: `AsyncDaytona().v0` and `AsyncDaytona().v2`.

Same shape as `Daytona`; the namespace clients are the async ones.
`async with AsyncDaytona() as d:` (or `await close()`) closes whichever
namespace clients were built.

#### AsyncDaytona.\_\_init\_\_

```python
def __init__(config: Optional[DaytonaConfig] = None) -> None
```

#### AsyncDaytona.v2

```python
@property
def v2() -> _AsyncDaytonaV2
```

The v2 client (v2's asynchronous client), built on first access.

Owned by the root: close the root, not this client (a closed v2 client
stays cached and its calls fail).

#### AsyncDaytona.v0

```python
@property
def v0() -> _AsyncDaytonaV0
```

The v0 client (the bundled 0.x `AsyncDaytona`), built on first access.

Needs the `v0-sdk` extra (`pip install "daytona[v0-sdk]"`); raises
`ImportError` naming it otherwise.

#### AsyncDaytona.close

```python
async def close() -> None
```

Close the namespace clients built so far. Idempotent.

Stored v2 clients and their handles raise `ClientClosedError` on new
requests. Accessing `root.v2` again builds a fresh working client.

## DaytonaV2Client

```python
class DaytonaV2Client()
```

The v2 Daytona client.

#### DaytonaV2Client.images

```python
@property
def images() -> ImagesService
```

#### DaytonaV2Client.snapshots

```python
@property
def snapshots() -> SnapshotsService
```

#### DaytonaV2Client.volumes

```python
@property
def volumes() -> VolumesService
```

#### DaytonaV2Client.secrets

```python
@property
def secrets() -> SecretsService
```

#### DaytonaV2Client.reservations

```python
@property
def reservations() -> ReservationsService
```

#### DaytonaV2Client.mac\_models

```python
@property
def mac_models() -> MacModelsService
```

#### DaytonaV2Client.close

```python
def close() -> None
```

Close HTTP resources, then stop the bridge loop. Idempotent; safe from any thread.

#### DaytonaV2Client.create

```python
def create(image: Optional[str] = None,
           /,
           *,
           name: Optional[str] = None,
           env: Optional[Mapping[str, str]] = None,
           labels: Optional[Mapping[str, str]] = None,
           resources: Optional[Resources] = None,
           ports: Optional[Sequence[PortMapping]] = None,
           volumes: Optional[Sequence[VolumeMount]] = None,
           secrets: Optional[Sequence[str]] = None,
           spot: Optional[bool] = None,
           user: Optional[str] = None,
           lifecycle_policy: Optional[LifecyclePolicyOptions] = None,
           network_policy: Optional[NetworkPolicyInput] = _UNSET_NETWORK_POLICY,
           cpu_arch: Optional[str] = None,
           cpu_type: Optional[str] = None,
           region: Optional[str] = None,
           idempotency_key: Optional[str] = None,
           wait_seconds: int = 60,
           create_timeout_seconds: Optional[int] = None) -> Sandbox
```

Create a Linux sandbox from a registered image name or `img_…` id.

Omitting `image` boots the platform default image, the Linux image
Daytona marks as default (`images.list(platform="true")` shows
it with `default=True`); the returned sandbox's `image` names the
image the server booted. When no default is configured the create
fails with `DEFAULT_IMAGE_NOT_CONFIGURED` (400). An empty or
whitespace-only `image` is still an error, raised before any request.
Snapshots and image builds have their own methods:
`create_from_snapshot`, `create_from_build`.

**Waiting.** The server holds this create briefly, so a sandbox that
reaches `started` within that hold returns in one round trip; the SDK
waits for any remainder of `wait_seconds` (whole seconds, default 60;
`0` returns as soon as the API accepts the create).
`create_timeout_seconds` is the server's own budget for reaching
`started` before it deletes the sandbox. `create()` never raises
because of how its wait ended: when the budget runs out, or the sandbox
reaches `error`, it returns the handle — check `sandbox.state`. It
raises when the request itself fails (validation, authentication,
limits, `SandboxCreateRequestTimeoutError`,
`SandboxCreateConnectionError`).

**Names.** `name` is non-unique display metadata and the handle of the
one-sandbox-per-end-user pattern: a named create stamps
`labels["name"] = name` (`find_by_name` reads it back) and,
unless `idempotency_key` is given, derives its idempotency key from
the name. A repeated or retried `create(image, name="example-user")`
at one regional API endpoint is therefore a get-or-create: the same
sandbox comes back, not a second one — until the first is deleted,
which releases the key. This is permanent behaviour of `name=`. The
guarantee is scoped to a regional API endpoint (creates of one end user
that reach two regional API endpoints make two sandboxes; pin them to
one region), per class, and exact: a same-name create with different
arguments is a 409, never a silent replay of the first sandbox's
parameters. An explicit `idempotency_key` always wins.

**Visible resources.** `resources` sizes the sandbox (cores and GiB;
see `Resources`). Burstable sandboxes start with the burst
ceiling (`resources.cpu_max` / `memory_max`, or the deployment cap
when omitted), so `nproc` and `/proc/meminfo` report that ceiling,
not the guaranteed `cpu`. Tools that size themselves from the CPU
count (`pytest -n auto`, `make -j$(nproc)`) start one worker per
visible CPU. Pass an explicit worker count when you need the guarantee
instead of the ceiling.

`network_policy` sets the sandbox's egress policy from its first boot
(`None` sends an explicit "no policy"); change it later with
`Sandbox.update_network_policy`.

Creating Linux sandboxes requires Linux access enabled for the organization.
Otherwise a caller holding `write:sandboxes` gets
`403` `FEATURE_NOT_ENABLED` (raised as
`FeatureNotEnabledError`).

#### DaytonaV2Client.create\_from\_build

```python
def create_from_build(builder: ImageBuilder,
                      /,
                      *,
                      name: Optional[str] = None,
                      env: Optional[Mapping[str, str]] = None,
                      labels: Optional[Mapping[str, str]] = None,
                      resources: Optional[Resources] = None,
                      ports: Optional[Sequence[PortMapping]] = None,
                      volumes: Optional[Sequence[VolumeMount]] = None,
                      secrets: Optional[Sequence[str]] = None,
                      spot: Optional[bool] = None,
                      user: Optional[str] = None,
                      lifecycle_policy: Optional[LifecyclePolicyOptions] = None,
                      network_policy: Optional[NetworkPolicyInput] = _UNSET_NETWORK_POLICY,
                      cpu_arch: Optional[str] = None,
                      cpu_type: Optional[str] = None,
                      region: Optional[str] = None,
                      idempotency_key: Optional[str] = None,
                      wait_seconds: int = 60,
                      create_timeout_seconds: Optional[int] = None,
                      idle_expiry_seconds: Optional[int] = None,
                      build_timeout: Optional[float] = None) -> Sandbox
```

Build an anonymous image from `builder`, wait for it, then create the sandbox from it.

For a builder with local files, submission first reads and uploads a
deterministic build context. Each upload part fails once no bytes
move for the client's request timeout (`0`: never); each completion
attempt uses the greater of that timeout and 600 seconds (`0`: no
bound). No total deadline bounds the upload.
It then sends the build request, bounded by the client's request
timeout. The build itself is always awaited, bounded by
`build_timeout` (seconds; `None`, `0` or a value above about
24.8 days = no deadline). A failed
build (image status `failed` or `error`) raises
`ImageBuildFailedError` and a build that outlasts
`build_timeout` raises `RequestTimeoutError`; in both cases
no sandbox exists. Then the sandbox is created exactly as by
`create` with the same keywords — `wait_seconds` is the create's
own wait, and the create never raises because of how that wait ended.

`idle_expiry_seconds` is the anonymous image's idle-retention window
(see `images.build`). `region` and `cpu_arch` apply to both the
build and the create: a Dockerfile-built image boots only in its own
region, so it is built where the sandbox will run.

#### DaytonaV2Client.create\_from\_snapshot

```python
def create_from_snapshot(snapshot: str,
                         /,
                         *,
                         name: Optional[str] = None,
                         labels: Optional[Mapping[str, str]] = None,
                         lifecycle_policy: Optional[LifecyclePolicyOptions] = None,
                         ports: Optional[Sequence[PortMapping]] = None,
                         region: Optional[str] = None,
                         idempotency_key: Optional[str] = None,
                         wait_seconds: int = 60,
                         create_timeout_seconds: Optional[int] = None) -> Sandbox
```

Create a Linux sandbox that resumes a memory snapshot (name or `snap_…` id).

The sandbox continues from the snapshot's memory and disk, so its size,
environment and attachments are the snapshot's own. `name`,
`idempotency_key`, `wait_seconds` and `create_timeout_seconds`
behave as on `create`, and like `create` this never raises
because of how its wait ended.

Creating Linux sandboxes requires Linux access enabled for the organization.
Otherwise a caller holding `write:sandboxes` gets
`403` `FEATURE_NOT_ENABLED` (raised as
`FeatureNotEnabledError`).

#### DaytonaV2Client.create\_macos

```python
def create_macos(image: str,
                 /,
                 *,
                 resources: Optional[MacosResources] = None,
                 name: Optional[str] = None,
                 env: Optional[Mapping[str, str]] = None,
                 labels: Optional[Mapping[str, str]] = None,
                 secrets: Optional[Sequence[str]] = None,
                 ports: Optional[Sequence[PortMapping]] = None,
                 persistent: Optional[bool] = None,
                 lifecycle_policy: Optional[LifecyclePolicyOptions] = None,
                 volumes: Optional[Sequence[VolumeMount]] = None,
                 reservation: Optional[str] = None,
                 auto_renew: Optional[bool] = None,
                 region: Optional[str] = None,
                 idempotency_key: Optional[str] = None,
                 wait_seconds: int = 60,
                 create_timeout_seconds: Optional[int] = None,
                 network_policy: Optional[NetworkPolicyInput] = _UNSET_NETWORK_POLICY) -> Sandbox
```

Create a macOS sandbox on a reserved Mac from a macOS image name.

`resources` sizes the sandbox (`MacosResources`: physical CPU
cores, at least 4; memory in GiB, at least 4; disk in GiB, at least 80,
macOS included; memory and disk must convert to whole MiB). Each
omitted value uses the Mac model's default size (`default_size` in
`mac_models.list()`); a create from a captured image that omits `disk` gets the
image's disk size, and a smaller `disk` is refused. The size is fixed
at creation, and the sandbox reports it once a Mac takes the sandbox.

`persistent` keeps the sandbox's disk and machine across stop and start, and its memory across pause and resume. A start can run on any Mac of the organization; after a start on a different Mac, iCloud asks the user to sign in again. Delete erases the disk. A reservation end or a Mac failure stops a persistent sandbox that has started and never deletes it; a Mac failure can lose its most recent writes. An ephemeral sandbox ends with its reservation, or with its Mac when that Mac fails.

`volumes` attaches disk volumes read-write. A sandbox with volumes
cannot be persistent; bucket volumes and `read_only` are rejected
with `BadRequestError`.

`reservation` picks the Mac's reservation (`daytona.reservations`):
`None` uses any fitting reservation of the organization in the region (or
lets the organization's auto-reserve buy one), `"new"` buys a reservation of
the cheapest model that fits.
A reservation ID uses only that reservation. An accepted create can wait for space on a Mac until `create_timeout_seconds`.
`auto_renew` is allowed only with `reservation="new"`. With no reservation
to use it raises `ConflictError` (`NO_ACTIVE_RESERVATION`,
`NO_FREE_SLOT`, `MAC_DISK_FULL`, `AUTO_RESERVE_LIMIT_REACHED`,
`NO_MAC_AVAILABLE`). `name`, `idempotency_key`, `wait_seconds`
and `create_timeout_seconds` behave as on `create`, and like
`create` this never raises because of how its wait ended.
A reservation it buys (`reservation="new"` or auto-reserve) raises
`LimitExceededError` (a `RateLimitError`) with
`limit == "max_mac_reservations"` when the organization holds its Mac reservation limit.

Creating macOS sandboxes requires macOS access enabled for the organization;
otherwise the API answers `403`
`FEATURE_NOT_ENABLED` (raised as `FeatureNotEnabledError`).

`secrets` attaches project secrets by name, as on `create`.
Their values are available to HTTPS requests to the secret's allowed
domains without entering the sandbox. Attaching needs `read:secrets`.

`network_policy` sets the sandbox's egress policy, as on
`create`: it applies from the sandbox's first boot. If the policy
cannot be enforced, the API answers `503`. Change it later with
`Sandbox.update_network_policy`.

Find regions and their regional API endpoints with `daytona region list` (the CLI);
discover Mac models and prices with `mac_models.catalog(region="<region>")`.
To select a regional API endpoint, set `DAYTONA_V2_API_URL` before
creating the client. An API that does not serve the region answers
`ConflictError`; the SDK does not reroute.

#### DaytonaV2Client.current\_api\_key

```python
def current_api_key() -> ProjectApiKey
```

Describe the API key this client authenticates with.

Returns its name, masked display parts, the project and organization it
acts in, its permissions, expiry and last use. The token itself is
never returned.

#### DaytonaV2Client.delete

```python
def delete(sandbox: Union[Sandbox, str], /, *, timeout: float = 60) -> None
```

Delete a sandbox by handle or id and wait until it is destroyed; see `Sandbox.delete`.

#### DaytonaV2Client.find\_by\_name

```python
def find_by_name(name: str, /, *, region: Optional[str] = None) -> tuple[Sandbox, ...]
```

Sandboxes created with `name=name`, newest first; `()` when none.

Exact match on the `labels["name"]` every `create*(name=…)` stamps,
read through sandbox search. Names are not unique, so this is a tuple —
every match, read page by page: the one list method that is not a
single page. A get-or-create caller takes `[0]` when it is non-empty
and calls `create(..., name=name)` otherwise — and because that create
derives the same key as the first one, a lost race between two such
callers still yields one sandbox. A new sandbox becomes searchable
shortly after its create. Sandboxes that are `destroyed` or
`destroying` are left out. A deployment without search raises
`SearchNotConfiguredError` (501).

`region` scopes the read the way it scopes a create: it is sent as
the same `x-daytona-region` selector `create*()` sends, and
`"local"` (or omitting it) means the default region — so the
lookup uses the same regional API endpoint as the named create.

#### DaytonaV2Client.get

```python
def get(sandbox_id: str,
        /,
        *,
        toolbox_url: Optional[str] = None,
        access_token: Optional[str] = None) -> Sandbox
```

Fetch a sandbox by id.

`toolbox_url` overrides the toolbox URL the API returns.
The SDK
sends this sandbox's toolbox credential there (the API key, a project
token, or a minted sandbox token), so pass only a URL you trust —
never one read from stored or user-supplied data.

`access_token` is a sandbox access token the handle sends to sandbox
services instead of minting its own; the handle never replaces it.

Both are checked before any request: `toolbox_url` must be a
non-blank string, and `access_token` (sent as a bearer credential)
non-empty printable ASCII with no surrounding whitespace, never
stripped; `None` omits either.

#### DaytonaV2Client.get\_limits

```python
def get_limits(*, organization_id: Optional[str] = None) -> OrganizationLimits
```

Return the organization's limits and current usage.

A null `limit` means unlimited. With an API key the organization
defaults to the key's own, looked up once and cached; with
`jwt_token` authentication pass `organization_id`. The credential
needs the `read:limits` permission. Member counts (`members`) are
not included: they are served to signed-in members only.

#### DaytonaV2Client.get\_project\_budget

```python
def get_project_budget() -> ProjectBudget
```

Return the monthly spend budget of the API key's project.

An unset budget is returned with nullable limit and period fields. The key needs the
`read:spending` permission. Spend is calculated at list price, before
credits, and lags usage by several minutes. While the project is over
its budget, creating or starting a sandbox in it raises
`ProjectBudgetExceededError`.

#### DaytonaV2Client.iter

```python
def iter(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> Iterator[Sandbox]
```

Every sandbox, walking `list` page by page (`limit` is the page size).

#### DaytonaV2Client.list

```python
def list(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> ListResult[Sandbox]
```

List sandboxes as one page `{items, next_cursor}`, newest first.

Reads `GET /sandboxes/search` (every region) and, on a deployment
without search, `GET /sandboxes`. Where search serves the list it is
eventually consistent: a sandbox you just created may be missing until
the index catches up (`get` reads it at once). Walk further pages with
`iter` or the returned cursor. Filtering is `search`'s job.

#### DaytonaV2Client.list\_audit\_actions

```python
def list_audit_actions() -> AuditActionList
```

Return the actions the audit log can record for each target type.

#### DaytonaV2Client.pause

```python
def pause(sandbox: Union[Sandbox, str], /, *, timeout: float = 60) -> None
```

Pause a sandbox by handle or id; see `Sandbox.pause`.

#### DaytonaV2Client.resume

```python
def resume(sandbox: Union[Sandbox, str], /, *, timeout: float = 60) -> None
```

Resume a sandbox by handle or id; see `Sandbox.resume`.

#### DaytonaV2Client.search

```python
def search(*,
           q: Optional[str] = None,
           name_prefix: Optional[str] = None,
           id_prefix: Optional[str] = None,
           states: Optional[Union[SearchSandboxState, Sequence[SearchSandboxState]]] = None,
           sandbox_class: Optional[Union[SandboxClass, Sequence[SandboxClass]]] = None,
           region: Optional[Union[str, Sequence[str]]] = None,
           image_ref: Optional[str] = None,
           image_ref_prefix: Optional[str] = None,
           labels: Optional[Mapping[str, str]] = None,
           spot: Optional[bool] = None,
           forked_from: Optional[str] = None,
           min_cores: Optional[float] = None,
           max_cores: Optional[float] = None,
           min_memory_mib: Optional[int] = None,
           max_memory_mib: Optional[int] = None,
           min_disk_mib: Optional[int] = None,
           max_disk_mib: Optional[int] = None,
           created_start_at: Optional[SearchTimestamp] = None,
           created_end_at: Optional[SearchTimestamp] = None,
           updated_start_at: Optional[SearchTimestamp] = None,
           updated_end_at: Optional[SearchTimestamp] = None,
           last_activity_start_at: Optional[SearchTimestamp] = None,
           last_activity_end_at: Optional[SearchTimestamp] = None,
           sort: Optional[SearchSort] = None,
           order: Optional[SearchOrder] = None,
           limit: Optional[int] = None,
           cursor: Optional[str] = None) -> SearchResult[Sandbox]
```

Search sandboxes across every region (`GET /sandboxes/search`), one page.

Every parameter is optional and they combine as AND. `q` is free text
over name and image (or an exact id); `name_prefix`/`id_prefix` match
the start of the name or id; `states`, `sandbox_class` and
`region` accept a single value or a list (any-of). A `region` that
contains other regions (a geo group, or `earth`) matches every
region inside it. `states` are the
SDK's sandbox states (`started`, `stopped`, `error`, ...), each
sent as the API status names it covers; `"unknown"` is refused.
`labels` is a containment match; the `min_*`/`max_*` bounds are
inclusive, `*_start_at` timestamp bounds are inclusive, and
`*_end_at` bounds are exclusive. Timestamps accept RFC 3339 timestamps
without a leap second (year 0001-9999, a real calendar date) or
`datetime` objects (naive values are taken as UTC). `sort` defaults
to `created_at` and `order` to `desc`; `limit` must be an
integer from 1 to 200, else `BadRequestError` before any
request. Returns a `SearchResult` whose `items`
are the same `Sandbox` handles `list` returns.

Consistency: search is **eventually consistent**. Results may be briefly
stale after a create, update or delete, so a sandbox you
just created may not be in the result yet — use `get` for
read-your-writes. Results span every region.

Cursor: `next_cursor` is opaque and bound to the exact filter and sort
that produced it — presenting it with a different filter or sort is a
400, never a silent reset. Paging is best-effort under concurrent
mutation: each page reflects current results, so a sandbox whose sort field
(`status`, `name`, `memory_mib`, `updated_at`, ...) changes between
two page fetches can appear on both pages or on neither, and creates or
deletes mid-walk shift later pages.

Errors: 400 (`BadRequestError`) for a malformed or mismatched
cursor, an unknown `sandbox_class`/`sort` value or region, a
non-object `labels` or one with an empty key, or a `min` above its
`max`; 501
(`SearchNotConfiguredError` with
`code == "SEARCH_NOT_CONFIGURED"`) when the API has search
disabled; 503 (`SearchUnavailableError` with
`code == "SEARCH_UNAVAILABLE"`) when search is unavailable. On 501
callers may fall back to `list`, which reads the plain list
route on a deployment without search.

#### DaytonaV2Client.start

```python
def start(sandbox: Union[Sandbox, str], /, *, timeout: float = 60) -> None
```

Start a sandbox by handle or id; see `Sandbox.start`.

#### DaytonaV2Client.stop

```python
def stop(sandbox: Union[Sandbox, str], /, *, timeout: float = 60) -> None
```

Stop a sandbox by handle or id and wait until it is stopped; see `Sandbox.stop`.

## AsyncDaytonaV2Client

```python
class AsyncDaytonaV2Client()
```

The v2 Daytona client.

#### AsyncDaytonaV2Client.create

```python
async def create(image: Optional[str] = None,
                 /,
                 *,
                 name: Optional[str] = None,
                 env: Optional[Mapping[str, str]] = None,
                 labels: Optional[Mapping[str, str]] = None,
                 resources: Optional[Resources] = None,
                 ports: Optional[Sequence[PortMapping]] = None,
                 volumes: Optional[Sequence[VolumeMount]] = None,
                 secrets: Optional[Sequence[str]] = None,
                 spot: Optional[bool] = None,
                 user: Optional[str] = None,
                 lifecycle_policy: Optional[LifecyclePolicyOptions] = None,
                 network_policy: Optional[NetworkPolicyInput] = _UNSET_NETWORK_POLICY,
                 cpu_arch: Optional[str] = None,
                 cpu_type: Optional[str] = None,
                 region: Optional[str] = None,
                 idempotency_key: Optional[str] = None,
                 wait_seconds: int = 60,
                 create_timeout_seconds: Optional[int] = None) -> AsyncSandbox
```

Create a Linux sandbox from a registered image name or `img_…` id.

Omitting `image` boots the platform default image, the Linux image
Daytona marks as default (`images.list(platform="true")` shows
it with `default=True`); the returned sandbox's `image` names the
image the server booted. When no default is configured the create
fails with `DEFAULT_IMAGE_NOT_CONFIGURED` (400). An empty or
whitespace-only `image` is still an error, raised before any request.
Snapshots and image builds have their own methods:
`create_from_snapshot`, `create_from_build`.

**Waiting.** The server holds this create briefly, so a sandbox that
reaches `started` within that hold returns in one round trip; the SDK
waits for any remainder of `wait_seconds` (whole seconds, default 60;
`0` returns as soon as the API accepts the create).
`create_timeout_seconds` is the server's own budget for reaching
`started` before it deletes the sandbox. `create()` never raises
because of how its wait ended: when the budget runs out, or the sandbox
reaches `error`, it returns the handle — check `sandbox.state`. It
raises when the request itself fails (validation, authentication,
limits, `SandboxCreateRequestTimeoutError`,
`SandboxCreateConnectionError`).

**Names.** `name` is non-unique display metadata and the handle of the
one-sandbox-per-end-user pattern: a named create stamps
`labels["name"] = name` (`find_by_name` reads it back) and,
unless `idempotency_key` is given, derives its idempotency key from
the name. A repeated or retried `create(image, name="example-user")`
at one regional API endpoint is therefore a get-or-create: the same
sandbox comes back, not a second one — until the first is deleted,
which releases the key. This is permanent behaviour of `name=`. The
guarantee is scoped to a regional API endpoint (creates of one end user
that reach two regional API endpoints make two sandboxes; pin them to
one region), per class, and exact: a same-name create with different
arguments is a 409, never a silent replay of the first sandbox's
parameters. An explicit `idempotency_key` always wins.

**Visible resources.** `resources` sizes the sandbox (cores and GiB;
see `Resources`). Burstable sandboxes start with the burst
ceiling (`resources.cpu_max` / `memory_max`, or the deployment cap
when omitted), so `nproc` and `/proc/meminfo` report that ceiling,
not the guaranteed `cpu`. Tools that size themselves from the CPU
count (`pytest -n auto`, `make -j$(nproc)`) start one worker per
visible CPU. Pass an explicit worker count when you need the guarantee
instead of the ceiling.

`network_policy` sets the sandbox's egress policy from its first boot
(`None` sends an explicit "no policy"); change it later with
`AsyncSandbox.update_network_policy`.

Creating Linux sandboxes requires Linux access enabled for the organization.
Otherwise a caller holding `write:sandboxes` gets
`403` `FEATURE_NOT_ENABLED` (raised as
`FeatureNotEnabledError`).

#### AsyncDaytonaV2Client.create\_from\_snapshot

```python
async def create_from_snapshot(snapshot: str,
                               /,
                               *,
                               name: Optional[str] = None,
                               labels: Optional[Mapping[str, str]] = None,
                               lifecycle_policy: Optional[LifecyclePolicyOptions] = None,
                               ports: Optional[Sequence[PortMapping]] = None,
                               region: Optional[str] = None,
                               idempotency_key: Optional[str] = None,
                               wait_seconds: int = 60,
                               create_timeout_seconds: Optional[int] = None) -> AsyncSandbox
```

Create a Linux sandbox that resumes a memory snapshot (name or `snap_…` id).

The sandbox continues from the snapshot's memory and disk, so its size,
environment and attachments are the snapshot's own. `name`,
`idempotency_key`, `wait_seconds` and `create_timeout_seconds`
behave as on `create`, and like `create` this never raises
because of how its wait ended.

Creating Linux sandboxes requires Linux access enabled for the organization.
Otherwise a caller holding `write:sandboxes` gets
`403` `FEATURE_NOT_ENABLED` (raised as
`FeatureNotEnabledError`).

#### AsyncDaytonaV2Client.create\_macos

```python
async def create_macos(image: str,
                       /,
                       *,
                       resources: Optional[MacosResources] = None,
                       name: Optional[str] = None,
                       env: Optional[Mapping[str, str]] = None,
                       labels: Optional[Mapping[str, str]] = None,
                       secrets: Optional[Sequence[str]] = None,
                       ports: Optional[Sequence[PortMapping]] = None,
                       persistent: Optional[bool] = None,
                       lifecycle_policy: Optional[LifecyclePolicyOptions] = None,
                       volumes: Optional[Sequence[VolumeMount]] = None,
                       reservation: Optional[str] = None,
                       auto_renew: Optional[bool] = None,
                       region: Optional[str] = None,
                       idempotency_key: Optional[str] = None,
                       wait_seconds: int = 60,
                       create_timeout_seconds: Optional[int] = None,
                       network_policy: Optional[NetworkPolicyInput] = _UNSET_NETWORK_POLICY) -> AsyncSandbox
```

Create a macOS sandbox on a reserved Mac from a macOS image name.

`resources` sizes the sandbox (`MacosResources`: physical CPU
cores, at least 4; memory in GiB, at least 4; disk in GiB, at least 80,
macOS included; memory and disk must convert to whole MiB). Each
omitted value uses the Mac model's default size (`default_size` in
`mac_models.list()`); a create from a captured image that omits `disk` gets the
image's disk size, and a smaller `disk` is refused. The size is fixed
at creation, and the sandbox reports it once a Mac takes the sandbox.

`persistent` keeps the sandbox's disk and machine across stop and start, and its memory across pause and resume. A start can run on any Mac of the organization; after a start on a different Mac, iCloud asks the user to sign in again. Delete erases the disk. A reservation end or a Mac failure stops a persistent sandbox that has started and never deletes it; a Mac failure can lose its most recent writes. An ephemeral sandbox ends with its reservation, or with its Mac when that Mac fails.

`volumes` attaches disk volumes read-write. A sandbox with volumes
cannot be persistent; bucket volumes and `read_only` are rejected
with `BadRequestError`.

`reservation` picks the Mac's reservation (`daytona.reservations`):
`None` uses any fitting reservation of the organization in the region (or
lets the organization's auto-reserve buy one), `"new"` buys a reservation of
the cheapest model that fits.
A reservation ID uses only that reservation. An accepted create can wait for space on a Mac until `create_timeout_seconds`.
`auto_renew` is allowed only with `reservation="new"`. With no reservation
to use it raises `ConflictError` (`NO_ACTIVE_RESERVATION`,
`NO_FREE_SLOT`, `MAC_DISK_FULL`, `AUTO_RESERVE_LIMIT_REACHED`,
`NO_MAC_AVAILABLE`). `name`, `idempotency_key`, `wait_seconds`
and `create_timeout_seconds` behave as on `create`, and like
`create` this never raises because of how its wait ended.
A reservation it buys (`reservation="new"` or auto-reserve) raises
`LimitExceededError` (a `RateLimitError`) with
`limit == "max_mac_reservations"` when the organization holds its Mac reservation limit.

Creating macOS sandboxes requires macOS access enabled for the organization;
otherwise the API answers `403`
`FEATURE_NOT_ENABLED` (raised as `FeatureNotEnabledError`).

`secrets` attaches project secrets by name, as on `create`.
Their values are available to HTTPS requests to the secret's allowed
domains without entering the sandbox. Attaching needs `read:secrets`.

`network_policy` sets the sandbox's egress policy, as on
`create`: it applies from the sandbox's first boot. If the policy
cannot be enforced, the API answers `503`. Change it later with
`AsyncSandbox.update_network_policy`.

Find regions and their regional API endpoints with `daytona region list` (the CLI);
discover Mac models and prices with `mac_models.catalog(region="<region>")`.
To select a regional API endpoint, set `DAYTONA_V2_API_URL` before
creating the client. An API that does not serve the region answers
`ConflictError`; the SDK does not reroute.

#### AsyncDaytonaV2Client.create\_from\_build

```python
async def create_from_build(builder: ImageBuilder,
                            /,
                            *,
                            name: Optional[str] = None,
                            env: Optional[Mapping[str, str]] = None,
                            labels: Optional[Mapping[str, str]] = None,
                            resources: Optional[Resources] = None,
                            ports: Optional[Sequence[PortMapping]] = None,
                            volumes: Optional[Sequence[VolumeMount]] = None,
                            secrets: Optional[Sequence[str]] = None,
                            spot: Optional[bool] = None,
                            user: Optional[str] = None,
                            lifecycle_policy: Optional[LifecyclePolicyOptions] = None,
                            network_policy: Optional[NetworkPolicyInput] = _UNSET_NETWORK_POLICY,
                            cpu_arch: Optional[str] = None,
                            cpu_type: Optional[str] = None,
                            region: Optional[str] = None,
                            idempotency_key: Optional[str] = None,
                            wait_seconds: int = 60,
                            create_timeout_seconds: Optional[int] = None,
                            idle_expiry_seconds: Optional[int] = None,
                            build_timeout: Optional[float] = None) -> AsyncSandbox
```

Build an anonymous image from `builder`, wait for it, then create the sandbox from it.

For a builder with local files, submission first reads and uploads a
deterministic build context. Each upload part fails once no bytes
move for the client's request timeout (`0`: never); each completion
attempt uses the greater of that timeout and 600 seconds (`0`: no
bound). No total deadline bounds the upload.
It then sends the build request, bounded by the client's request
timeout. The build itself is always awaited, bounded by
`build_timeout` (seconds; `None`, `0` or a value above about
24.8 days = no deadline). A failed
build (image status `failed` or `error`) raises
`ImageBuildFailedError` and a build that outlasts
`build_timeout` raises `RequestTimeoutError`; in both cases
no sandbox exists. Then the sandbox is created exactly as by
`create` with the same keywords — `wait_seconds` is the create's
own wait, and the create never raises because of how that wait ended.

`idle_expiry_seconds` is the anonymous image's idle-retention window
(see `images.build`). `region` and `cpu_arch` apply to both the
build and the create: a Dockerfile-built image boots only in its own
region, so it is built where the sandbox will run.

#### AsyncDaytonaV2Client.get

```python
async def get(sandbox_id: str,
              /,
              *,
              toolbox_url: Optional[str] = None,
              access_token: Optional[str] = None) -> AsyncSandbox
```

Fetch a sandbox by id.

`toolbox_url` overrides the toolbox URL the API returns.
The SDK
sends this sandbox's toolbox credential there (the API key, a project
token, or a minted sandbox token), so pass only a URL you trust —
never one read from stored or user-supplied data.

`access_token` is a sandbox access token the handle sends to sandbox
services instead of minting its own; the handle never replaces it.

Both are checked before any request: `toolbox_url` must be a
non-blank string, and `access_token` (sent as a bearer credential)
non-empty printable ASCII with no surrounding whitespace, never
stripped; `None` omits either.

#### AsyncDaytonaV2Client.find\_by\_name

```python
async def find_by_name(name: str,
                       /,
                       *,
                       region: Optional[str] = None) -> tuple[AsyncSandbox, ...]
```

Sandboxes created with `name=name`, newest first; `()` when none.

Exact match on the `labels["name"]` every `create*(name=…)` stamps,
read through sandbox search. Names are not unique, so this is a tuple —
every match, read page by page: the one list method that is not a
single page. A get-or-create caller takes `[0]` when it is non-empty
and calls `create(..., name=name)` otherwise — and because that create
derives the same key as the first one, a lost race between two such
callers still yields one sandbox. A new sandbox becomes searchable
shortly after its create. Sandboxes that are `destroyed` or
`destroying` are left out. A deployment without search raises
`SearchNotConfiguredError` (501).

`region` scopes the read the way it scopes a create: it is sent as
the same `x-daytona-region` selector `create*()` sends, and
`"local"` (or omitting it) means the default region — so the
lookup uses the same regional API endpoint as the named create.

#### AsyncDaytonaV2Client.list\_audit\_actions

```python
async def list_audit_actions() -> AuditActionList
```

Return the actions the audit log can record for each target type.

#### AsyncDaytonaV2Client.current\_api\_key

```python
async def current_api_key() -> ProjectApiKey
```

Describe the API key this client authenticates with.

Returns its name, masked display parts, the project and organization it
acts in, its permissions, expiry and last use. The token itself is
never returned.

#### AsyncDaytonaV2Client.get\_project\_budget

```python
async def get_project_budget() -> ProjectBudget
```

Return the monthly spend budget of the API key's project.

An unset budget is returned with nullable limit and period fields. The key needs the
`read:spending` permission. Spend is calculated at list price, before
credits, and lags usage by several minutes. While the project is over
its budget, creating or starting a sandbox in it raises
`ProjectBudgetExceededError`.

#### AsyncDaytonaV2Client.get\_limits

```python
async def get_limits(*, organization_id: Optional[str] = None) -> OrganizationLimits
```

Return the organization's limits and current usage.

A null `limit` means unlimited. With an API key the organization
defaults to the key's own, looked up once and cached; with
`jwt_token` authentication pass `organization_id`. The credential
needs the `read:limits` permission. Member counts (`members`) are
not included: they are served to signed-in members only.

#### AsyncDaytonaV2Client.list

```python
async def list(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> ListResult[AsyncSandbox]
```

List sandboxes as one page `{items, next_cursor}`, newest first.

Reads `GET /sandboxes/search` (every region) and, on a deployment
without search, `GET /sandboxes`. Where search serves the list it is
eventually consistent: a sandbox you just created may be missing until
the index catches up (`get` reads it at once). Walk further pages with
`iter` or the returned cursor. Filtering is `search`'s job.

#### AsyncDaytonaV2Client.search

```python
async def search(*,
                 q: Optional[str] = None,
                 name_prefix: Optional[str] = None,
                 id_prefix: Optional[str] = None,
                 states: Optional[Union[SearchSandboxState, Sequence[SearchSandboxState]]] = None,
                 sandbox_class: Optional[Union[SandboxClass, Sequence[SandboxClass]]] = None,
                 region: Optional[Union[str, Sequence[str]]] = None,
                 image_ref: Optional[str] = None,
                 image_ref_prefix: Optional[str] = None,
                 labels: Optional[Mapping[str, str]] = None,
                 spot: Optional[bool] = None,
                 forked_from: Optional[str] = None,
                 min_cores: Optional[float] = None,
                 max_cores: Optional[float] = None,
                 min_memory_mib: Optional[int] = None,
                 max_memory_mib: Optional[int] = None,
                 min_disk_mib: Optional[int] = None,
                 max_disk_mib: Optional[int] = None,
                 created_start_at: Optional[SearchTimestamp] = None,
                 created_end_at: Optional[SearchTimestamp] = None,
                 updated_start_at: Optional[SearchTimestamp] = None,
                 updated_end_at: Optional[SearchTimestamp] = None,
                 last_activity_start_at: Optional[SearchTimestamp] = None,
                 last_activity_end_at: Optional[SearchTimestamp] = None,
                 sort: Optional[SearchSort] = None,
                 order: Optional[SearchOrder] = None,
                 limit: Optional[int] = None,
                 cursor: Optional[str] = None) -> SearchResult[AsyncSandbox]
```

Search sandboxes across every region (`GET /sandboxes/search`), one page.

Every parameter is optional and they combine as AND. `q` is free text
over name and image (or an exact id); `name_prefix`/`id_prefix` match
the start of the name or id; `states`, `sandbox_class` and
`region` accept a single value or a list (any-of). A `region` that
contains other regions (a geo group, or `earth`) matches every
region inside it. `states` are the
SDK's sandbox states (`started`, `stopped`, `error`, ...), each
sent as the API status names it covers; `"unknown"` is refused.
`labels` is a containment match; the `min_*`/`max_*` bounds are
inclusive, `*_start_at` timestamp bounds are inclusive, and
`*_end_at` bounds are exclusive. Timestamps accept RFC 3339 timestamps
without a leap second (year 0001-9999, a real calendar date) or
`datetime` objects (naive values are taken as UTC). `sort` defaults
to `created_at` and `order` to `desc`; `limit` must be an
integer from 1 to 200, else `BadRequestError` before any
request. Returns a `SearchResult` whose `items`
are the same `AsyncSandbox` handles `list` returns.

Consistency: search is **eventually consistent**. Results may be briefly
stale after a create, update or delete, so a sandbox you
just created may not be in the result yet — use `get` for
read-your-writes. Results span every region.

Cursor: `next_cursor` is opaque and bound to the exact filter and sort
that produced it — presenting it with a different filter or sort is a
400, never a silent reset. Paging is best-effort under concurrent
mutation: each page reflects current results, so a sandbox whose sort field
(`status`, `name`, `memory_mib`, `updated_at`, ...) changes between
two page fetches can appear on both pages or on neither, and creates or
deletes mid-walk shift later pages.

Errors: 400 (`BadRequestError`) for a malformed or mismatched
cursor, an unknown `sandbox_class`/`sort` value or region, a
non-object `labels` or one with an empty key, or a `min` above its
`max`; 501
(`SearchNotConfiguredError` with
`code == "SEARCH_NOT_CONFIGURED"`) when the API has search
disabled; 503 (`SearchUnavailableError` with
`code == "SEARCH_UNAVAILABLE"`) when search is unavailable. On 501
callers may fall back to `list`, which reads the plain list
route on a deployment without search.

#### AsyncDaytonaV2Client.iter

```python
async def iter(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> AsyncIterator[AsyncSandbox]
```

Every sandbox, walking `list` page by page (`limit` is the page size).

#### AsyncDaytonaV2Client.start

```python
async def start(sandbox: Union[AsyncSandbox, str], /, *, timeout: float = 60) -> None
```

Start a sandbox by handle or id; see `AsyncSandbox.start`.

#### AsyncDaytonaV2Client.stop

```python
async def stop(sandbox: Union[AsyncSandbox, str], /, *, timeout: float = 60) -> None
```

Stop a sandbox by handle or id and wait until it is stopped; see `AsyncSandbox.stop`.

#### AsyncDaytonaV2Client.pause

```python
async def pause(sandbox: Union[AsyncSandbox, str], /, *, timeout: float = 60) -> None
```

Pause a sandbox by handle or id; see `AsyncSandbox.pause`.

#### AsyncDaytonaV2Client.resume

```python
async def resume(sandbox: Union[AsyncSandbox, str], /, *, timeout: float = 60) -> None
```

Resume a sandbox by handle or id; see `AsyncSandbox.resume`.

#### AsyncDaytonaV2Client.delete

```python
async def delete(sandbox: Union[AsyncSandbox, str], /, *, timeout: float = 60) -> None
```

Delete a sandbox by handle or id and wait until it is destroyed; see `AsyncSandbox.delete`.

#### AsyncDaytonaV2Client.close

```python
async def close() -> None
```

Close HTTP resources; new requests on this client or its handles raise
`ClientClosedError`. Close the root to let later `root.v2` access
build a fresh client.

## LifecyclePolicyOptions

```python
class LifecyclePolicyOptions(TypedDict, total=False)
```

Per-sandbox lifecycle policy: a wall-clock timeout and an idle timeout,
each paired with the action it fires.

`timeout_seconds` (`>= 1`, never disabled) fires `on_timeout` that many
seconds after create, after a `daytona.v2.Sandbox.update_lifecycle_policy` that
supplies it, and again after every accepted transition to running (start,
resume) — the full budget re-arms each time. Omitted `on_timeout`
resolves to the server's class default.

`idle_expiry_seconds` is opt-in and fires `on_idle_timeout` after that many
seconds without activity; `DISABLED` clears it. `on_idle_timeout` has
no default — arming `idle_expiry_seconds` from nothing requires it.

At Linux create, each field you omit is inherited from the project's
lifecycle defaults (set in the dashboard's project settings), then — for
`timeout_seconds` only — from the platform default timeout when enabled.
macOS creates use platform defaults, not project defaults.
An action follows its own interval: a
`timeout_seconds` you pass without `on_timeout` gets the class default, not
the project's action. Pass `DISABLED` as `idle_expiry_seconds` to opt
out of an inherited idle timeout. Project defaults apply to new sandboxes
only; `daytona.v2.Sandbox.update_lifecycle_policy` never consults them.

Settings unavailable for the sandbox's class and persistence are rejected before
sending the request. Linux supports `delete`; persistent macOS sandboxes
also support `stop`. Pause macOS explicitly with `daytona.v2.Sandbox.pause`.

**Attributes**:

- `timeout_seconds` _int_
- `on_timeout` _LifecycleAction_
- `idle_expiry_seconds` _int_
- `on_idle_timeout` _LifecycleAction_

## ListResult

```python
@dataclass(frozen=True, init=False)
class ListResult(Generic[T])
```

One page of a cursor-paginated list: `items` and the `next_cursor`
to pass for the next page (`None` on the last one). Immutable: `items`
is a tuple (any iterable passed in is copied into one). Keyword-only, and
not iterable: `.items` is the one way to the entries, as in TypeScript.

**Attributes**:

- `items` _Tuple\[T, ...\]_
- `next_cursor` _Optional\[str\] = None_

#### ListResult.\_\_init\_\_

```python
def __init__(*, items: Iterable[T], next_cursor: Optional[str] = None) -> None
```

## Resources

```python
@dataclass(frozen=True, kw_only=True)
class Resources()
```

Linux sandbox resources; CPU is cores (1 core = 2 vCPUs), memory and disk are GiB.

`cpu`/`memory`/`disk` are the request: what is reserved and billed as a
floor. `cpu_max`/`memory_max`/`disk_max` are the limits: the boot shape
and the ceiling, the system cap when omitted. Set each limit equal to its
request for a fixed shape. Requests below the platform minimums are raised
to them, so a fixed shape below a minimum is refused. `cpu_max` is a
multiple of 0.5 cores: the sandbox boots `cpu_max * 2` vCPUs. A memory or
disk value must convert to a whole number of MiB (`value * 1024`);
anything else raises `BadRequestError`.

**Attributes**:

- `cpu` _Optional\[float\] = None_
- `cpu_max` _Optional\[float\] = None_
- `memory` _Optional\[float\] = None_
- `memory_max` _Optional\[float\] = None_
- `disk` _Optional\[float\] = None_
- `disk_max` _Optional\[float\] = None_

## NetworkPolicyInput

```python
class NetworkPolicyInput(TypedDict, total=False)
```

**Attributes**:

- `block_all` _bool \| None_
- `allow_cidrs` _Sequence\[str\]_
- `allow_domains` _Optional\[Sequence\[str\]\]_

## NetworkPolicy

```python
@dataclass(frozen=True, kw_only=True)
class NetworkPolicy()
```

**Attributes**:

- `version` _int_
- `block_all` _bool = False_
- `allow_cidrs` _tuple\[str, ...\] = ()_
- `allow_domains` _Optional\[tuple\[str, ...\]\] = None_

## NetworkPolicyInfo

```python
@dataclass(frozen=True, kw_only=True)
class NetworkPolicyInfo()
```

**Attributes**:

- `desired` _Optional\[NetworkPolicy\]_
- `desired_revision` _int_
- `etag` _str_
- `applied` _Optional\[NetworkPolicy\] = None_
- `applied_revision` _Optional\[int\] = None_
- `applied_start_id` _Optional\[str\] = None_
- `status` _Optional\[str\] = None_
- `error` _Optional\[str\] = None_

## SnapshotRef

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class SnapshotRef()
```

**Attributes**:

- `id` _str_
- `name` _Optional\[str\] = None_

## ProjectBudget

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ProjectBudget()
```

The monthly spend budget of a project, in US cents at list price.

`monthly_limit_cents` is `None` when no budget is set. `spent_cents`
and `evaluated_at` are `None` until the first evaluation of the period;
`exceeded_at` is set once the project reaches its budget and `stop_at`
is when its grace period ends.

**Attributes**:

- `period_start_date` _Optional\[date\] = None_
- `monthly_limit_cents` _Optional\[int\] = None_
- `spent_cents` _Optional\[int\] = None_
- `created_at` _Optional\[datetime\] = None_
- `updated_at` _Optional\[datetime\] = None_
- `evaluated_at` _Optional\[datetime\] = None_
- `exceeded_at` _Optional\[datetime\] = None_
- `stop_at` _Optional\[datetime\] = None_

## AuditActionGroup

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class AuditActionGroup()
```

The actions the audit log can record against one target type.

**Attributes**:

- `target_type` _str_
- `actions` _tuple\[str, ...\]_

## AuditActionList

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class AuditActionList()
```

**Attributes**:

- `targets` _tuple\[AuditActionGroup, ...\]_

## RegistryImageSource

```python
@dataclass(frozen=True, kw_only=True, slots=True)
class RegistryImageSource()
```

An image imported from a registry reference.

**Attributes**:

- `ref` _str_
- `type` _Literal\['registry'\] = 'registry'_

## NamedImageSource

```python
@dataclass(frozen=True, kw_only=True, slots=True)
class NamedImageSource()
```

An image that names another image.

**Attributes**:

- `name` _str_
- `type` _Literal\['named'\] = 'named'_

## ManifestImageSource

```python
@dataclass(frozen=True, kw_only=True, slots=True)
class ManifestImageSource()
```

An image described by a named manifest.

**Attributes**:

- `name` _str_
- `type` _Literal\['manifest'\] = 'manifest'_

## ListSandboxesOptions

```python
@dataclass(frozen=True, kw_only=True)
class ListSandboxesOptions()
```

Every `Daytona.list()` / `iter()` parameter: one page of sandboxes.

**Attributes**:

- `cursor` _Optional\[str\] = None_
- `limit` _Optional\[int\] = None_

## MacosResources

```python
@dataclass(frozen=True, kw_only=True)
class MacosResources()
```

macOS sandbox size; each omitted value uses the Mac model's default size.

`cpu` is physical Mac CPU cores (Apple Silicon has no SMT), at least 4.
`memory` is GiB, at least 4; `disk` is GiB, at least 80, macOS included.
Memory and disk must convert to a whole number of MiB (`value * 1024`).
Omitted values use the model's `default_size` (`mac_models.list()`); a
create from a captured image that omits `disk` gets the image's disk size. The size is fixed
at creation.

**Attributes**:

- `cpu` _Optional\[int\] = None_
- `memory` _Optional\[float\] = None_
- `disk` _Optional\[float\] = None_

## OrganizationLimits

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class OrganizationLimits()
```

An organization's limits and current usage (`get_limits()`).

**Attributes**:

- `sandboxes` _SandboxLimits_
- `image_builds` _ImageBuildLimits_
- `storage` _StorageLimits_
- `secrets_per_project` _UsageLimit_
- `api_keys_per_project` _UsageLimit_
- `api_keys_per_organization` _UsageLimit_
- `sandbox_resources` _Optional\[SandboxResourceLimits\] = None_
- `mac_reservations` _Optional\[UsageLimit\] = None_
- `members` _Optional\[MemberLimits\] = None_

## ProjectApiKey

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ProjectApiKey()
```

An API key's metadata (`current_api_key()`); the token itself is never returned.

**Attributes**:

- `id` _str_
- `name` _str_
- `project_id` _str_
- `project_permissions` _tuple\[str, ...\]_
- `created_at` _datetime_
- `context` _ProjectApiKeyContext_
- `created_by` _Optional\[str\] = None_
- `expires_at` _Optional\[datetime\] = None_
- `last_used_at` _Optional\[datetime\] = None_
- `revoked_at` _Optional\[datetime\] = None_
- `key_prefix` _Optional\[str\] = None_
- `key_suffix` _Optional\[str\] = None_
- `service_account_id` _Optional\[str\] = None_
- `service_account_name` _Optional\[str\] = None_

## UsageLimit

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class UsageLimit()
```

A limit and the usage counted against it; `limit` `None` means unlimited.

**Attributes**:

- `limit` _Optional\[int\]_
- `usage` _int_

## MemberLimits

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class MemberLimits()
```

**Attributes**:

- `limit` _Optional\[int\]_
- `usage` _int_
- `pending_invitations` _int_

## V0\_API\_URL: `Final[str]`

```python
V0_API_URL = 'https://app.daytona.io/api'
```

## DEFAULT\_V2\_API\_URL: `Final[str]`

```python
DEFAULT_V2_API_URL = 'https://api.daytona.com'
```

## JsonValue

```python
JsonValue = Union[JsonScalar, Sequence['JsonValue'], Mapping[str, 'JsonValue']]
```

## CpuArch

```python
CpuArch = Literal['amd64', 'arm64']
```

## SnapshotClass

```python
SnapshotClass = Literal['linux', 'unknown']
```

## SnapshotKind

```python
SnapshotKind = Literal['full', 'unknown']
```

## LifecycleAction

```python
LifecycleAction = Literal['stop', 'pause', 'delete']
```

The action a lifecycle trigger fires: `on_timeout` / `on_idle_timeout`.

Available actions depend on the sandbox's class and persistence; unsupported settings
are rejected before sending the request.

## DISABLED: `int`

```python
DISABLED = -1
```

Clears `LifecyclePolicyOptions.idle_expiry_seconds` — and only that field.

`idle_expiry_seconds` value space, identical at create and on
`daytona.v2.Sandbox.update_lifecycle_policy`: omitted = unchanged (update) /
disabled (create); `DISABLED` (-1) = clear the idle pair (`on_idle_timeout`
with it); `n > 0` = seconds, a value below 60 raised to 60 server-side and
read back raised; `0` and anything below -1 are rejected.

`timeout_seconds` does NOT accept it: the timeout cannot be disabled, so
`timeout_seconds` must be `>= 1` (`-1` and `0` are rejected).
