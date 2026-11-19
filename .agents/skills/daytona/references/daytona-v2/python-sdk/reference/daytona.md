# Daytona (Python SDK reference)

## Contents

- [DaytonaConfig](#daytonaconfig)
- [Daytona](#daytona)
- [AsyncDaytona](#asyncdaytona)
- [DaytonaV2Client](#daytonav2client)
- [AsyncDaytonaV2Client](#asyncdaytonav2client)
- [AuditActionGroup](#auditactiongroup)
- [AuditActionList](#auditactionlist)
- [ProjectApiKeyWithContext](#projectapikeywithcontext)
- [ProjectBudget](#projectbudget)
- [LifecyclePolicyConfig](#lifecyclepolicyconfig)
- [ListResult](#listresult)
- [Resources](#resources)
- [NetworkPolicyInput](#networkpolicyinput)
- [NetworkPolicy](#networkpolicy)
- [NetworkPolicyInfo](#networkpolicyinfo)
- [SnapshotRef](#snapshotref)
- [ListSandboxesQuery](#listsandboxesquery)
- [OrganizationLimits](#organizationlimits)
- [V0\_API\_URL: `Final[str]`](#v0apiurl-finalstr)
- [DEFAULT\_V2\_API\_URL: `Final[str]`](#defaultv2apiurl-finalstr)
- [NAME\_LABEL: `Final`](#namelabel-final)
- [SnapshotDetail](#snapshotdetail)
- [SnapshotKind](#snapshotkind)
- [LifecycleAction](#lifecycleaction)
- [DISABLED: `int`](#disabled-int)

## DaytonaConfig

```python
@dataclass
class DaytonaConfig()
```

Configuration shared by every API version.

One credential serves both namespaces: `api_key` (`DAYTONA_API_KEY`)
or `jwt_token` (`DAYTONA_JWT_TOKEN`). A JWT is scoped by
`organization_id` for v0 and `project_id` for v2. Fields left unset
are read from the environment by each namespace.

There is no region or API URL field here. Pass `region=` to a v2 create;
`DAYTONA_V2_API_URL`, else `DAYTONA_API_URL`, selects the v2 API
endpoint and never reaches v0.

`target` is deprecated and applies to `.v0` only (the v0 client's
default region). Pass `target` to each v0 sandbox create
(`CreateSandboxFromSnapshotParams(target=...)`) or `region_id` to each
v0 snapshot create instead. Setting it still works and emits a
`DeprecationWarning`.
`request_timeout` (seconds), `connection_pool_maxsize` and
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

## DaytonaV2Client

```python
class DaytonaV2Client()
```

The v2 Daytona client.

#### DaytonaV2Client.images

```python
@property
def images() -> ImageService
```

#### DaytonaV2Client.snapshots

```python
@property
def snapshots() -> SnapshotService
```

#### DaytonaV2Client.volume

```python
@property
def volume() -> VolumeService
```

#### DaytonaV2Client.secret

```python
@property
def secret() -> SecretService
```

#### DaytonaV2Client.secrets

```python
@property
def secrets() -> SecretService
```

#### DaytonaV2Client.reservations

```python
@property
def reservations() -> ReservationService
```

#### DaytonaV2Client.mac\_models

```python
@property
def mac_models() -> MacModelService
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
           env: Optional[Dict[str, str]] = None,
           labels: Optional[Dict[str, str]] = None,
           resources: Optional[Resources] = None,
           cpu: Optional[float] = None,
           memory: Optional[int] = None,
           disk: Optional[int] = None,
           ports: Optional[Sequence[PortMapping]] = None,
           volumes: Optional[Sequence[VolumeMount]] = None,
           secrets: Optional[Sequence[str]] = None,
           spot: Optional[bool] = None,
           lifecycle_policy: Optional[LifecyclePolicyConfig] = None,
           network_policy: NetworkPolicyInput | None | _UnsetNetworkPolicy = _UNSET_NETWORK_POLICY,
           cpu_arch: Optional[str] = None,
           cpu_type: Optional[str] = None,
           region: Optional[str] = None,
           toolbox_url: Optional[str] = None,
           idempotency_key: Optional[str] = None,
           wait_seconds: int = 60,
           create_timeout_seconds: Optional[int] = None) -> Sandbox
```

Create from a registered image name or `img_…` id.

#### DaytonaV2Client.create\_from\_build

```python
def create_from_build(builder: ImageBuilder,
                      /,
                      *,
                      idle_expiry_seconds: Optional[int] = None,
                      network_policy: NetworkPolicyInput | None | _UnsetNetworkPolicy = _UNSET_NETWORK_POLICY,
                      **kwargs) -> Sandbox
```

Build an anonymous image first, then create the sandbox from it.

#### DaytonaV2Client.create\_from\_snapshot

```python
def create_from_snapshot(snapshot: str,
                         /,
                         *,
                         name: Optional[str] = None,
                         labels: Optional[Dict[str, str]] = None,
                         lifecycle_policy: Optional[LifecyclePolicyConfig] = None,
                         ports: Optional[Sequence[PortMapping]] = None,
                         region: Optional[str] = None,
                         toolbox_url: Optional[str] = None,
                         idempotency_key: Optional[str] = None,
                         wait_seconds: int = 60,
                         create_timeout_seconds: Optional[int] = None) -> Sandbox
```

Create a sandbox from a snapshot.

#### DaytonaV2Client.create\_macos

```python
def create_macos(image: str,
                 /,
                 *,
                 cpu: Optional[int] = None,
                 memory: Optional[float] = None,
                 disk: Optional[float] = None,
                 name: Optional[str] = None,
                 env: Optional[Dict[str, str]] = None,
                 labels: Optional[Dict[str, str]] = None,
                 secrets: Optional[Sequence[str]] = None,
                 ports: Optional[Sequence[PortMapping]] = None,
                 persistent: Optional[bool] = None,
                 lifecycle_policy: Optional[LifecyclePolicyConfig] = None,
                 volumes: Optional[Sequence[VolumeMount]] = None,
                 reservation: Optional[str] = None,
                 auto_renew: Optional[bool] = None,
                 region: Optional[str] = None,
                 toolbox_url: Optional[str] = None,
                 idempotency_key: Optional[str] = None,
                 wait_seconds: int = 60,
                 create_timeout_seconds: Optional[int] = None,
                 network_policy: NetworkPolicyInput | None | _UnsetNetworkPolicy = _UNSET_NETWORK_POLICY) -> Sandbox
```

Create a macOS sandbox on a reserved Mac from a macOS image name.

#### DaytonaV2Client.current\_api\_key

```python
def current_api_key() -> ProjectApiKeyWithContext
```

Describe the API key this client authenticates with.

#### DaytonaV2Client.delete

```python
def delete(sandbox: Union[Sandbox, str]) -> None
```

Request sandbox deletion.

#### DaytonaV2Client.find\_by\_name

```python
def find_by_name(name: str, /, *, region: Optional[str] = None) -> list[Sandbox]
```

Sandboxes created with `name=name`, newest first; `[]` when none.

#### DaytonaV2Client.get

```python
def get(sandbox_id: str, *, toolbox_url: Optional[str] = None) -> Sandbox
```

Fetch a sandbox by id.

#### DaytonaV2Client.get\_limits

```python
def get_limits(*, organization_id: Optional[str] = None) -> OrganizationLimits
```

Return the organization's limits and current usage.

#### DaytonaV2Client.get\_network\_policy

```python
def get_network_policy(sandbox: Union[Sandbox, str]) -> NetworkPolicyInfo
```

#### DaytonaV2Client.get\_project\_budget

```python
def get_project_budget() -> ProjectBudget
```

Return the monthly spend budget of the API key's project.

#### DaytonaV2Client.get\_sandbox\_secrets

```python
def get_sandbox_secrets(sandbox: Union[Sandbox, str]) -> SandboxSecretsInfo
```

Read a sandbox's attached secret names and apply state; see `Sandbox.get_secrets`.

#### DaytonaV2Client.iter

```python
def iter(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> Iterator[Sandbox]
```

#### DaytonaV2Client.list

```python
def list(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None,
         id: Optional[str] = None,
         name: Optional[str] = None,
         q: Optional[str] = None,
         status: Optional[Sequence[str]] = None,
         sandbox_class: Optional[Union[SandboxClass, Sequence[SandboxClass]]] = None,
         region: Optional[Sequence[str]] = None,
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
         order: Optional[SearchOrder] = None) -> ListResult[Sandbox]
```

List sandboxes as one page `{items, next_cursor}`.

#### DaytonaV2Client.list\_audit\_actions

```python
def list_audit_actions() -> AuditActionList
```

Return the actions the audit log can record for each target type.

#### DaytonaV2Client.pause

```python
def pause(sandbox: Union[Sandbox, str], *, timeout: float = 60) -> None
```

Pause a sandbox (accepts a Sandbox or its id); see `Sandbox.pause`.

#### DaytonaV2Client.replace\_sandbox\_secrets

```python
def replace_sandbox_secrets(sandbox: Union[Sandbox, str],
                            *,
                            secrets: Sequence[str],
                            if_match: str) -> SandboxSecretsInfo
```

Replace a sandbox's attached secret names; see `Sandbox.replace_secrets`.

#### DaytonaV2Client.reset\_network\_policy

```python
def reset_network_policy(sandbox: Union[Sandbox, str],
                         *,
                         if_match: str) -> NetworkPolicyInfo
```

#### DaytonaV2Client.resume

```python
def resume(sandbox: Union[Sandbox, str], *, timeout: float = 60) -> None
```

Resume a sandbox (accepts a Sandbox or its id).

#### DaytonaV2Client.search

```python
def search(*,
           q: Optional[str] = None,
           name_prefix: Optional[str] = None,
           id_prefix: Optional[str] = None,
           status: Optional[Sequence[str]] = None,
           sandbox_class: Optional[Union[SandboxClass, Sequence[SandboxClass]]] = None,
           region: Optional[Sequence[str]] = None,
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

Search sandboxes across every region (`GET /sandboxes/search`).

#### DaytonaV2Client.start

```python
def start(sandbox: Union[Sandbox, str], *, timeout: float = 60) -> None
```

Start a sandbox (accepts a Sandbox or its id).

#### DaytonaV2Client.stop

```python
def stop(sandbox: Union[Sandbox, str]) -> None
```

Stop a persistent macOS sandbox (accepts a Sandbox or its id).

#### DaytonaV2Client.update\_network\_policy

```python
def update_network_policy(sandbox: Union[Sandbox, str],
                          *,
                          network_policy: NetworkPolicyInput,
                          if_match: str) -> NetworkPolicyInfo
```

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
                 env: Optional[Dict[str, str]] = None,
                 labels: Optional[Dict[str, str]] = None,
                 resources: Optional[Resources] = None,
                 cpu: Optional[float] = None,
                 memory: Optional[int] = None,
                 disk: Optional[int] = None,
                 ports: Optional[Sequence[PortMapping]] = None,
                 volumes: Optional[Sequence[VolumeMount]] = None,
                 secrets: Optional[Sequence[str]] = None,
                 spot: Optional[bool] = None,
                 lifecycle_policy: Optional[LifecyclePolicyConfig] = None,
                 network_policy: NetworkPolicyInput | None | _UnsetNetworkPolicy = _UNSET_NETWORK_POLICY,
                 cpu_arch: Optional[str] = None,
                 cpu_type: Optional[str] = None,
                 region: Optional[str] = None,
                 toolbox_url: Optional[str] = None,
                 idempotency_key: Optional[str] = None,
                 wait_seconds: int = 60,
                 create_timeout_seconds: Optional[int] = None) -> AsyncSandbox
```

Create from a registered image name or `img_…` id.

Omitting `image` boots the platform default image, the Linux image
Daytona marks as default (`images.list(platform="true")` shows
it with `default=True`); the returned sandbox's `image` names the
image the server booted. When no default is configured the create
fails with `DEFAULT_IMAGE_NOT_CONFIGURED` (400). An empty or
whitespace-only `image` is still an error, raised before any request.

Fast path: the server holds this create briefly, so a sandbox that
reaches `running` within that hold returns in one round trip.
`wait_seconds` and `create_timeout_seconds` are budgets: the SDK long-polls any
remainder of `wait_seconds` client-side, and `create_timeout_seconds` is the server's
total budget for reaching `running` before deletion.

`name` is non-unique display metadata — and the handle of the
one-sandbox-per-end-user pattern: a named create stamps
`labels["name"] = name` (`find_by_name` reads it back) and,
unless `idempotency_key` is given, derives its idempotency key from
the name (`idempotency_key_for_name`). A repeated or retried
`create(image, name="example-user")` at one regional API endpoint is therefore a
get-or-create: the same sandbox comes back, not a second one or a 409
— until the first is deleted, which releases the key. The guarantee is
scoped to a regional API endpoint (creates of one end user that reach two
regional API endpoints make two sandboxes; pin them to one region), per class,
and exact: a same-name create with
different arguments is a 409 too, never a silent replay of the first
sandbox's parameters. An explicit `idempotency_key` always wins over
the derived one.

**Visible resources.** Burstable sandboxes start with the
burst ceiling (`resources.cpu_max` / `memory_max`, or the deployment
cap when omitted), so `nproc` and `/proc/meminfo` report that ceiling,
not the guaranteed `cpu`. Tools that size themselves from the CPU count
(`pytest -n auto`, `make -j$(nproc)`) start one worker per visible
CPU. Pass an explicit worker count when you need the guarantee instead of
the ceiling.

Creating Linux sandboxes requires Linux access enabled for the organization.
Otherwise a caller holding `write:sandboxes` gets
`403` `FEATURE_NOT_ENABLED` (raised as
`FeatureNotEnabledError`).

`toolbox_url` overrides the toolbox URL the API returns;
the SDK sends the new sandbox's toolbox credential there, so pass only
a URL you trust — never one read from stored or user-supplied data.

#### AsyncDaytonaV2Client.create\_from\_snapshot

```python
async def create_from_snapshot(snapshot: str,
                               /,
                               *,
                               name: Optional[str] = None,
                               labels: Optional[Dict[str, str]] = None,
                               lifecycle_policy: Optional[LifecyclePolicyConfig] = None,
                               ports: Optional[Sequence[PortMapping]] = None,
                               region: Optional[str] = None,
                               toolbox_url: Optional[str] = None,
                               idempotency_key: Optional[str] = None,
                               wait_seconds: int = 60,
                               create_timeout_seconds: Optional[int] = None) -> AsyncSandbox
```

Create a sandbox from a snapshot.

Creating Linux sandboxes requires Linux access enabled for the organization.
Otherwise a caller holding `write:sandboxes` gets
`403` `FEATURE_NOT_ENABLED` (raised as
`FeatureNotEnabledError`).

`toolbox_url` overrides the toolbox URL the API returns;
the SDK sends the new sandbox's toolbox credential there, so pass only
a URL you trust — never one read from stored or user-supplied data.

#### AsyncDaytonaV2Client.create\_macos

```python
async def create_macos(image: str,
                       /,
                       *,
                       cpu: Optional[int] = None,
                       memory: Optional[float] = None,
                       disk: Optional[float] = None,
                       name: Optional[str] = None,
                       env: Optional[Dict[str, str]] = None,
                       labels: Optional[Dict[str, str]] = None,
                       secrets: Optional[Sequence[str]] = None,
                       ports: Optional[Sequence[PortMapping]] = None,
                       persistent: Optional[bool] = None,
                       lifecycle_policy: Optional[LifecyclePolicyConfig] = None,
                       volumes: Optional[Sequence[VolumeMount]] = None,
                       reservation: Optional[str] = None,
                       auto_renew: Optional[bool] = None,
                       region: Optional[str] = None,
                       toolbox_url: Optional[str] = None,
                       idempotency_key: Optional[str] = None,
                       wait_seconds: int = 60,
                       create_timeout_seconds: Optional[int] = None,
                       network_policy: NetworkPolicyInput | None | _UnsetNetworkPolicy = _UNSET_NETWORK_POLICY) -> AsyncSandbox
```

Create a macOS sandbox on a reserved Mac from a macOS image name.

`cpu`: CPU cores, at least 4; sent as `cores`. A Mac core is one CPU of the Mac (Apple Silicon has no SMT). Omitted uses half of the claiming Mac's cores, rounded down, on a model that runs two sandboxes, or all of them on a model that runs one.

`memory`: Memory in GiB, at least 4; sent as memory_mib. memory * 1024 must be an integer. Omitted uses half of the claiming Mac's memory, rounded down, on a model that runs two sandboxes, or all of it on a model that runs one.

`disk`: Disk in GiB, at least 80; sent as disk_mib. The whole sandbox disk, macOS included. disk * 1024 must be an integer. Omitted uses half of the claiming Mac's sandbox disk room, rounded down to a whole GiB, on a model that runs two sandboxes, or all of it on a model that runs one.

The first successful claim fixes the size, which the sandbox reports
from then on.

`persistent`: Stop keeps the disk on the same Mac. Start and resume use that Mac. Delete erases the disk. At reservation end, the disk is saved as an anonymous image before the Mac is erased; a lost Mac saves it if it comes back within 7 days. If a Mac restarts before it is declared lost, a running persistent sandbox comes back stopped with its disk, a running ephemeral sandbox is lost, and stopped and paused sandboxes are unchanged. Create a sandbox from an image to continue on another Mac.

`volumes` attaches disk volumes read-write. A sandbox with volumes
cannot be persistent; bucket volumes and `read_only` are rejected
with `BadRequestError`.

`reservation` picks the Mac's reservation (`daytona.reservations`):
`None` uses any fitting reservation of the organization in the region (or
lets the organization's auto-reserve buy one), `"new"` buys a reservation of
the cheapest model that fits.
A reservation ID targets that reservation at claim. Acceptance does not reserve room; the sandbox can wait for room or time out.
`auto_renew` is allowed only with `reservation="new"`. With no reservation
to use it raises `ConflictError` (`NO_ACTIVE_RESERVATION`,
`NO_FREE_SLOT`, `MAC_DISK_FULL`, `AUTO_RESERVE_LIMIT_REACHED`,
`NO_MAC_AVAILABLE`). `name`, `idempotency_key`, `wait_seconds`
and `create_timeout_seconds` behave as on `create`.

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

`toolbox_url` overrides the toolbox URL the API returns;
the SDK sends the new sandbox's toolbox credential there, so pass only
a URL you trust — never one read from stored or user-supplied data.

Find regions and their regional API endpoints with `GET /regions`;
discover Mac models and prices with `mac_models.catalog(region="<region>")`.
To select a regional API endpoint, set `DAYTONA_V2_API_URL` before
creating the client. An API that does not serve the region answers
`ConflictError`; the SDK does not reroute.

#### AsyncDaytonaV2Client.create\_from\_build

```python
async def create_from_build(builder: ImageBuilder,
                            /,
                            *,
                            idle_expiry_seconds: Optional[int] = None,
                            network_policy: NetworkPolicyInput | None | _UnsetNetworkPolicy = _UNSET_NETWORK_POLICY,
                            **kwargs: object) -> AsyncSandbox
```

Build an anonymous image first, then create the sandbox from it.

Slow path: `POST /images` followed by `create(image.id, ...)`.
`idle_expiry_seconds` describes the anonymous image's idle window;
every other keyword goes to `create()`. Docker storage is included.
`region` applies to both the image build and the create: a
Dockerfile-built image can only boot in its own region, so it is built where
the sandbox will run. If the image build fails, this raises
`ImageBuildFailedError` and no sandbox exists.

#### AsyncDaytonaV2Client.get

```python
async def get(sandbox_id: str, *, toolbox_url: Optional[str] = None) -> AsyncSandbox
```

Fetch a sandbox by id.

`toolbox_url` overrides the toolbox URL the API returns.
The SDK
sends this sandbox's toolbox credential there (the API key, a project
token, or a minted sandbox token), so pass only a URL you trust —
never one read from stored or user-supplied data.

#### AsyncDaytonaV2Client.find\_by\_name

```python
async def find_by_name(name: str,
                       /,
                       *,
                       region: Optional[str] = None) -> list[AsyncSandbox]
```

Sandboxes created with `name=name`, newest first; `[]` when none.

Exact match on the `labels["name"]` every `create*(name=…)` stamps,
read through sandbox search. Names are not unique, so this is a list:
a get-or-create caller takes `[0]` when it is non-empty and calls
`create(..., name=name)` otherwise — and because that create derives
the same key as the first one, a lost race between two such callers
still yields one sandbox. A new sandbox becomes searchable shortly after
its create. Sandboxes that are `deleted` or `deleting` are left out.
A deployment without search raises `SearchNotConfiguredError`
(501).

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
async def current_api_key() -> ProjectApiKeyWithContext
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
               limit: Optional[int] = None,
               id: Optional[str] = None,
               name: Optional[str] = None,
               q: Optional[str] = None,
               status: Optional[Sequence[str]] = None,
               sandbox_class: Optional[Union[SandboxClass, Sequence[SandboxClass]]] = None,
               region: Optional[Sequence[str]] = None,
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
               order: Optional[SearchOrder] = None) -> ListResult[AsyncSandbox]
```

List sandboxes as one page `{items, next_cursor}`.

With only `cursor`/`limit` this is the read-your-writes path: one
page of `GET /sandboxes`, newest first. A sandbox you just created is in
the result; walk further pages with `iter()` or the returned cursor.
Use the returned cursor to request the next page.

Any other parameter — including `id` / `name` (sent as `id_prefix`
/ `name_prefix`), `q`, `status`, `sandbox_class`, `region`,
`labels`, the resource and timestamp bounds, `sort`, `order` —
switches the call to a single `GET /sandboxes/search` request, the same
surface as `search`, and fills `total`, `total_relation` and
search totals on the result. That path is **eventually consistent**: a
recent change may not appear immediately. Results span every region. The
cursor it returns is opaque and tied to the exact filter and sort that
produced it (reusing it with a different filter or sort is a 400), and
paging is best-effort under concurrent mutation. If the API has
search disabled (501, `SearchNotConfiguredError` with
`code == "SEARCH_NOT_CONFIGURED"`) or search is unavailable (503,
`SearchUnavailableError` with `code == "SEARCH_UNAVAILABLE"`),
drop the search parameters to fall back to the `GET /sandboxes` path.

#### AsyncDaytonaV2Client.search

```python
async def search(*,
                 q: Optional[str] = None,
                 name_prefix: Optional[str] = None,
                 id_prefix: Optional[str] = None,
                 status: Optional[Sequence[str]] = None,
                 sandbox_class: Optional[Union[SandboxClass, Sequence[SandboxClass]]] = None,
                 region: Optional[Sequence[str]] = None,
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

Search sandboxes across every region (`GET /sandboxes/search`).

Every parameter is optional and they combine as AND. `q` is free text
over name and image (or an exact id); `name_prefix`/`id_prefix` are
the server-side form of `list(name=...)`/`list(id=...)`; `status`,
`sandbox_class` and `region` accept a single value or a list (any-of;
lifecycle states use the API's wire names such as `running`); `labels` is a
containment match; the `min_*`/`max_*` bounds are inclusive,
`*_start_at` timestamp bounds are inclusive, and `*_end_at` bounds
are exclusive. Timestamps accept RFC 3339 strings or `datetime` objects
(naive values are taken as UTC). `sort` defaults to
`created_at` and `order` to `desc`; `limit` is clamped to
1..200 by the server. Returns a `SearchResult` whose `items` are
the same `AsyncSandbox` handles `list` returns.

Consistency: search is **eventually consistent**. Results may be briefly
stale after a create, update or delete, so a sandbox you
just created may not be in the result yet — use `get` or
`list` without search filters for read-your-writes. Results span
every region.

Cursor: `next_cursor` is opaque and bound to the exact filter and sort
that produced it — presenting it with a different filter or sort is a
400, never a silent reset. Paging is best-effort under concurrent
mutation: each page reflects current results, so a sandbox whose sort field
(`status`, `name`, `memory_mib`, `updated_at`, ...) changes between
two page fetches can appear on both pages or on neither, and creates or
deletes mid-walk shift later pages.

Errors: 400 (`BadRequestError`) for a malformed or mismatched
cursor, an unknown `status`/`sandbox_class`/`sort` value, a non-object
`labels` or a `min` above its `max`; 501
(`SearchNotConfiguredError` with
`code == "SEARCH_NOT_CONFIGURED"`) when the API has search
disabled; 503 (`SearchUnavailableError` with
`code == "SEARCH_UNAVAILABLE"`) when search is unavailable. The
server body is the unified `{code, message, source, trace_id}`
envelope. On 501/503 callers may fall back to `list` without search
parameters, which does not use search.

#### AsyncDaytonaV2Client.iter

```python
async def iter(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> AsyncIterator[AsyncSandbox]
```

#### AsyncDaytonaV2Client.start

```python
async def start(sandbox: Union[AsyncSandbox, str], *, timeout: float = 60) -> None
```

Start a sandbox (accepts a Sandbox or its id).

#### AsyncDaytonaV2Client.stop

```python
async def stop(sandbox: Union[AsyncSandbox, str]) -> None
```

Stop a persistent macOS sandbox (accepts a Sandbox or its id).

#### AsyncDaytonaV2Client.pause

```python
async def pause(sandbox: Union[AsyncSandbox, str], *, timeout: float = 60) -> None
```

Pause a sandbox (accepts a Sandbox or its id); see `Sandbox.pause`.

#### AsyncDaytonaV2Client.resume

```python
async def resume(sandbox: Union[AsyncSandbox, str], *, timeout: float = 60) -> None
```

Resume a sandbox (accepts a Sandbox or its id).

#### AsyncDaytonaV2Client.delete

```python
async def delete(sandbox: Union[AsyncSandbox, str]) -> None
```

Request sandbox deletion.

Image deletion may still return 409 after this call returns, even if the
sandbox reports `destroyed` or a subsequent read returns 404.

#### AsyncDaytonaV2Client.get\_network\_policy

```python
async def get_network_policy(sandbox: Union[AsyncSandbox, str]) -> NetworkPolicyInfo
```

#### AsyncDaytonaV2Client.update\_network\_policy

```python
async def update_network_policy(sandbox: Union[AsyncSandbox, str],
                                *,
                                network_policy: NetworkPolicyInput,
                                if_match: str) -> NetworkPolicyInfo
```

#### AsyncDaytonaV2Client.reset\_network\_policy

```python
async def reset_network_policy(sandbox: Union[AsyncSandbox, str],
                               *,
                               if_match: str) -> NetworkPolicyInfo
```

#### AsyncDaytonaV2Client.get\_sandbox\_secrets

```python
async def get_sandbox_secrets(sandbox: Union[AsyncSandbox, str]) -> SandboxSecretsInfo
```

Read a sandbox's attached secret names and apply state; see `AsyncSandbox.get_secrets`.

#### AsyncDaytonaV2Client.replace\_sandbox\_secrets

```python
async def replace_sandbox_secrets(sandbox: Union[AsyncSandbox, str],
                                  *,
                                  secrets: Sequence[str],
                                  if_match: str) -> SandboxSecretsInfo
```

Replace a sandbox's attached secret names; see `AsyncSandbox.replace_secrets`.

#### AsyncDaytonaV2Client.close

```python
async def close() -> None
```

Close HTTP resources.

## AuditActionGroup

```python
class AuditActionGroup(BaseModel)
```

Actions the audit log can record against one target type.

**Attributes**:

- `actions` _List\[StrictStr\] = Field(description='Actions that can appear against this target type, sorted alphabetically.')_
- `target_type` _StrictStr = Field(description='The resource type the actions apply to. It matches `target_type` on an audit log entry.')_
- `additional_properties` _Dict\[str, Any\] = \{\}_

##### model\_config

```python
model_config = ConfigDict(populate_by_name=True, validate_assignment=True, protected_namespaces=())
```

#### AuditActionGroup.to\_str

```python
def to_str() -> str
```

Returns the string representation of the model using alias

#### AuditActionGroup.to\_json

```python
def to_json() -> str
```

Returns the JSON representation of the model using alias

#### AuditActionGroup.from\_json

```python
@classmethod
def from_json(json_str: str) -> Optional[Self]
```

Create an instance of AuditActionGroup from a JSON string

#### AuditActionGroup.to\_dict

```python
def to_dict() -> Dict[str, Any]
```

Return the dictionary representation of the model using alias.

This has the following differences from calling pydantic's
`self.model_dump(by_alias=True)`:

* `None` is only added to the output dict for nullable fields that
  were set at model initialization. Other fields with value `None`
  are ignored.
* Fields in `self.additional_properties` are added to the output dict.

#### AuditActionGroup.from\_dict

```python
@classmethod
def from_dict(obj: Optional[Dict[str, Any]]) -> Optional[Self]
```

Create an instance of AuditActionGroup from a dict

## AuditActionList

```python
class AuditActionList(BaseModel)
```

The supported audit actions, grouped by target type.

**Attributes**:

- `targets` _List\[AuditActionGroup\] = Field(description='One entry per target type, sorted by target type.')_
- `additional_properties` _Dict\[str, Any\] = \{\}_

##### model\_config

```python
model_config = ConfigDict(populate_by_name=True, validate_assignment=True, protected_namespaces=())
```

#### AuditActionList.to\_str

```python
def to_str() -> str
```

Returns the string representation of the model using alias

#### AuditActionList.to\_json

```python
def to_json() -> str
```

Returns the JSON representation of the model using alias

#### AuditActionList.from\_json

```python
@classmethod
def from_json(json_str: str) -> Optional[Self]
```

Create an instance of AuditActionList from a JSON string

#### AuditActionList.to\_dict

```python
def to_dict() -> Dict[str, Any]
```

Return the dictionary representation of the model using alias.

This has the following differences from calling pydantic's
`self.model_dump(by_alias=True)`:

* `None` is only added to the output dict for nullable fields that
  were set at model initialization. Other fields with value `None`
  are ignored.
* Fields in `self.additional_properties` are added to the output dict.

#### AuditActionList.from\_dict

```python
@classmethod
def from_dict(obj: Optional[Dict[str, Any]]) -> Optional[Self]
```

Create an instance of AuditActionList from a dict

## ProjectApiKeyWithContext

```python
class ProjectApiKeyWithContext(BaseModel)
```

A project API key together with its tenant context.

**Attributes**:

- `created_at` _datetime = Field(description='When the API key was created.')_
- `created_by` _Optional\[StrictStr\] = Field(default=None, description='The user who created the API key, when visible.')_
- `expires_at` _Optional\[datetime\] = Field(default=None, description='When the API key expires, or null when it does not expire.')_
- `id` _StrictStr = Field(description='The API key ID.')_
- `imported_from` _Optional\[StrictStr\] = Field(default=None, description='`"v0"` when the key was created on Daytona v0 and imported by the v0 ↔ v2 key sync; `null` for a key created on this platform.')_
- `key_prefix` _Optional\[StrictStr\] = Field(default=None, description='The recognizable leading token characters, when available.')_
- `key_suffix` _Optional\[StrictStr\] = Field(default=None, description='The recognizable trailing token characters, when available.')_
- `last_used_at` _Optional\[datetime\] = Field(default=None, description='When the API key was last used, or null when unknown.')_
- `name` _StrictStr = Field(description='The API key name.')_
- `project_id` _StrictStr = Field(description='The project ID.')_
- `project_permissions` _List\[StrictStr\] = Field(description='The project permissions granted to the API key.')_
- `revoked_at` _Optional\[datetime\] = Field(default=None, description='When the API key was revoked, or null while active.')_
- `service_account_id` _Optional\[StrictStr\] = Field(default=None, description='The service account that owns the API key, when applicable.')_
- `service_account_name` _Optional\[StrictStr\] = Field(default=None, description='The service account name, when applicable and available.')_
- `sync_to_v0` _StrictBool = Field(description="Whether the v0 ↔ v2 key sync copies this key to Daytona v0 (for an organization that is kept in sync with Daytona v0). `true` for a live key a person minted in the organization's `default` project unless it was opted out by updating the API key, and always for a live key imported from Daytona v0. `false` for every key the sync never copies: keys in other projects, service-account keys, the dashboard's own key named `default`, and revoked or expired keys. A Daytona v0 copy can read every sandbox, snapshot and registry of the organization on Daytona v0, which has no read permissions.")_
- `sync_to_v1` _StrictBool = Field(description='Deprecated: use `sync_to_v0`, which carries the same value.')_
- `context` _ProjectApiKeyContext_
- `additional_properties` _Dict\[str, Any\] = \{\}_

##### model\_config

```python
model_config = ConfigDict(populate_by_name=True, validate_assignment=True, protected_namespaces=())
```

#### ProjectApiKeyWithContext.to\_str

```python
def to_str() -> str
```

Returns the string representation of the model using alias

#### ProjectApiKeyWithContext.to\_json

```python
def to_json() -> str
```

Returns the JSON representation of the model using alias

#### ProjectApiKeyWithContext.from\_json

```python
@classmethod
def from_json(json_str: str) -> Optional[Self]
```

Create an instance of ProjectApiKeyWithContext from a JSON string

#### ProjectApiKeyWithContext.to\_dict

```python
def to_dict() -> Dict[str, Any]
```

Return the dictionary representation of the model using alias.

This has the following differences from calling pydantic's
`self.model_dump(by_alias=True)`:

* `None` is only added to the output dict for nullable fields that
  were set at model initialization. Other fields with value `None`
  are ignored.
* Fields in `self.additional_properties` are added to the output dict.

#### ProjectApiKeyWithContext.from\_dict

```python
@classmethod
def from_dict(obj: Optional[Dict[str, Any]]) -> Optional[Self]
```

Create an instance of ProjectApiKeyWithContext from a dict

## ProjectBudget

```python
class ProjectBudget(BaseModel)
```

A project's monthly spend budget and its current state.

**Attributes**:

- `created_at` _Optional\[datetime\] = Field(description='When the budget was first set, or null when no budget is set.')_
- `evaluated_at` _Optional\[datetime\] = Field(default=None, description='When spend was last evaluated in the current period. `null` until the first evaluation in the period.')_
- `exceeded_at` _Optional\[datetime\] = Field(default=None, description='When the project reached its budget this period. `null` while the project is under its budget.')_
- `monthly_limit_cents` _Optional\[StrictInt\] = Field(description='The monthly budget, in US cents, or null when no budget is set.')_
- `period_start_date` _Optional\[date\] = Field(description='The first day of the current budget period (the calendar month in UTC), as `YYYY-MM-DD`.')_
- `spent_cents` _Optional\[StrictInt\] = Field(default=None, description='Month-to-date spend at list price, in US cents, from the last evaluation in the current period. `null` until the first evaluation in the period.')_
- `stop_at` _Optional\[datetime\] = Field(default=None, description='When the budget grace period ends: `exceeded_at` plus the grace period. Running sandboxes may then be stopped or deleted; macOS sandboxes on prepaid reservations keep running. Null when there is no active hold or the deadline falls on or after the next UTC month, when the hold expires.')_
- `updated_at` _Optional\[datetime\] = Field(description='When a member last set the budget, or null when no budget is set. Spend evaluations do not change it.')_
- `additional_properties` _Dict\[str, Any\] = \{\}_

##### model\_config

```python
model_config = ConfigDict(populate_by_name=True, validate_assignment=True, protected_namespaces=())
```

#### ProjectBudget.to\_str

```python
def to_str() -> str
```

Returns the string representation of the model using alias

#### ProjectBudget.to\_json

```python
def to_json() -> str
```

Returns the JSON representation of the model using alias

#### ProjectBudget.from\_json

```python
@classmethod
def from_json(json_str: str) -> Optional[Self]
```

Create an instance of ProjectBudget from a JSON string

#### ProjectBudget.to\_dict

```python
def to_dict() -> Dict[str, Any]
```

Return the dictionary representation of the model using alias.

This has the following differences from calling pydantic's
`self.model_dump(by_alias=True)`:

* `None` is only added to the output dict for nullable fields that
  were set at model initialization. Other fields with value `None`
  are ignored.
* Fields in `self.additional_properties` are added to the output dict.

#### ProjectBudget.from\_dict

```python
@classmethod
def from_dict(obj: Optional[Dict[str, Any]]) -> Optional[Self]
```

Create an instance of ProjectBudget from a dict

## LifecyclePolicyConfig

```python
class LifecyclePolicyConfig(TypedDict, total=False)
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
@dataclass(frozen=True)
class ListResult(Generic[T])
```

Cursor-paginated list result.

`total` and `total_relation` are only populated
when the result came from search (`Daytona.list()` with any
search filter); they are `None` on every other list surface.

**Attributes**:

- `items` _List\[T\]_
- `next_cursor` _Optional\[str\] = None_
- `total` _Optional\[int\] = None_
- `total_relation` _Optional\[SearchTotalRelation\] = None_
- `raw_total_relation` _Optional\[str\] = None_

## Resources

```python
@dataclass(frozen=True)
class Resources()
```

Sandbox resource request; CPU is cores (1 core = 2 vCPUs), memory and disk are GiB.

`cpu`/`memory`/`disk` are the request: what is reserved and billed as a
floor. `cpu_max`/`memory_max`/`disk_max` are the limits: the boot shape
and the ceiling, the system cap when omitted. Set each limit equal to its
request for a fixed shape. Requests below the platform minimums are raised
to them, so a fixed shape below a minimum is refused. `cpu_max` is a
multiple of 0.5 cores: the sandbox boots `cpu_max * 2` vCPUs.

**Attributes**:

- `cpu` _Optional\[float\] = None_
- `cpu_max` _Optional\[float\] = None_
- `memory` _Optional\[int\] = None_
- `memory_max` _Optional\[float\] = None_
- `disk` _Optional\[int\] = None_
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
@dataclass(frozen=True)
class NetworkPolicy()
```

**Attributes**:

- `version` _int_
- `block_all` _bool = False_
- `allow_cidrs` _List\[str\] = field(default_factory=list)_
- `allow_domains` _Optional\[List\[str\]\] = None_

## NetworkPolicyInfo

```python
@dataclass(frozen=True)
class NetworkPolicyInfo()
```

**Attributes**:

- `desired` _Optional\[NetworkPolicy\]_
- `desired_revision` _int_
- `etag` _str_
- `http_status` _int_
- `applied` _Optional\[NetworkPolicy\] = None_
- `applied_revision` _Optional\[int\] = None_
- `applied_start_id` _Optional\[str\] = None_
- `status` _Optional\[str\] = None_
- `error` _Optional\[str\] = None_

## SnapshotRef

```python
@dataclass(frozen=True, slots=True)
class SnapshotRef()
```

**Attributes**:

- `id` _str_
- `name` _Optional\[str\] = None_

## ListSandboxesQuery

```python
@dataclass(frozen=True)
class ListSandboxesQuery(SandboxSearchFilters)
```

Every `Daytona.list()` parameter.

`cursor`/`limit`/`id`/`name` remain the only positional parameters,
in that order. `cursor`/`limit` alone read `GET /sandboxes`; `id`/`name`
and any inherited (keyword-only) search filter route the call to
`/sandboxes/search`.

**Attributes**:

- `cursor` _Optional\[str\] = None_
- `limit` _Optional\[int\] = None_
- `id` _Optional\[str\] = None_
- `name` _Optional\[str\] = None_

## OrganizationLimits

```python
class OrganizationLimits(BaseModel)
```

OrganizationLimits

**Attributes**:

- `api_keys_per_organization` _UsageLimit_
- `api_keys_per_project` _UsageLimit_
- `image_builds` _ImageBuildLimits_
- `members` _Optional\[MemberLimits\] = None_
- `sandbox_resources` _Optional\[SandboxResourceLimits\] = None_
- `sandboxes` _SandboxLimits_
- `secrets_per_project` _UsageLimit_
- `storage` _StorageLimits_
- `additional_properties` _Dict\[str, Any\] = \{\}_

##### model\_config

```python
model_config = ConfigDict(populate_by_name=True, validate_assignment=True, protected_namespaces=())
```

#### OrganizationLimits.to\_str

```python
def to_str() -> str
```

Returns the string representation of the model using alias

#### OrganizationLimits.to\_json

```python
def to_json() -> str
```

Returns the JSON representation of the model using alias

#### OrganizationLimits.from\_json

```python
@classmethod
def from_json(json_str: str) -> Optional[Self]
```

Create an instance of OrganizationLimits from a JSON string

#### OrganizationLimits.to\_dict

```python
def to_dict() -> Dict[str, Any]
```

Return the dictionary representation of the model using alias.

This has the following differences from calling pydantic's
`self.model_dump(by_alias=True)`:

* `None` is only added to the output dict for nullable fields that
  were set at model initialization. Other fields with value `None`
  are ignored.
* Fields in `self.additional_properties` are added to the output dict.

#### OrganizationLimits.from\_dict

```python
@classmethod
def from_dict(obj: Optional[Dict[str, Any]]) -> Optional[Self]
```

Create an instance of OrganizationLimits from a dict

#### idempotency\_key\_for\_name

```python
def idempotency_key_for_name(name: str) -> str
```

The idempotency key `create*(name=name)` derives when none is given.

`"name:" + name` when that is a key the API accepts verbatim — printable
ASCII (`0x20`–`0x7E`), no surrounding whitespace (the API trims keys
and HTTP strips header padding, so a padded name would not round-trip),
at most 256 characters in total — else `"name:sha256:" + hex(sha256(name))`
over the UTF-8 bytes. The `name:` namespace keeps a derived key from ever
colliding with a caller's explicit key of the same spelling. Deterministic
and identical in the TypeScript SDK, so retries from either SDK use the
same key within a regional API endpoint: use it to recover or inspect the key
behind a named create.

## V0\_API\_URL: `Final[str]`

```python
V0_API_URL = 'https://app.daytona.io/api'
```

## DEFAULT\_V2\_API\_URL: `Final[str]`

```python
DEFAULT_V2_API_URL = 'https://api.daytona.com'
```

## NAME\_LABEL: `Final`

```python
NAME_LABEL = 'name'
```

## SnapshotDetail

```python
SnapshotDetail = _gen.api.Snapshot
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

Clears `LifecyclePolicyConfig.idle_expiry_seconds` — and only that field.

`idle_expiry_seconds` value space, identical at create and on
`daytona.v2.Sandbox.update_lifecycle_policy`: omitted = unchanged (update) /
disabled (create); `DISABLED` (-1) = clear the idle pair (`on_idle_timeout`
with it); `n > 0` = seconds, a value below 60 raised to 60 server-side and
read back raised; `0` and anything below -1 are rejected.

`timeout_seconds` does NOT accept it: the timeout cannot be disabled, so
`timeout_seconds` must be `>= 1` (`-1` and `0` are rejected).
