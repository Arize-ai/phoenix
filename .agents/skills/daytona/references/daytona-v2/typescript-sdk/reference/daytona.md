# Daytona (TypeScript SDK reference)

## Contents

- [Daytona](#daytona)
- [DaytonaV2Client](#daytonav2client)
- [DaytonaV0Client](#daytonav0client)
- [DaytonaConfig](#daytonaconfig)
- [OtelApiLike](#otelapilike)
- [Resources](#resources)
- [JsonValue](#jsonvalue)
- [SnapshotKind](#snapshotkind)
- [SnapshotClass](#snapshotclass)
- [SnapshotRef](#snapshotref)
- [CreateRequestBaseOptions](#createrequestbaseoptions)
- [CreateSandboxOptions](#createsandboxoptions)
- [LifecycleAction](#lifecycleaction)
- [CreateSandboxFromSnapshotOptions](#createsandboxfromsnapshotoptions)
- [LifecyclePolicyOptions](#lifecyclepolicyoptions)
- [SandboxConnectOptions](#sandboxconnectoptions)
- [ListResult](#listresult)
- [NetworkPolicyInput](#networkpolicyinput)
- [NetworkPolicy](#networkpolicy)
- [NetworkPolicyInfo](#networkpolicyinfo)
- [CpuArch](#cpuarch)
- [AuditActionList](#auditactionlist)
- [AuditActionGroup](#auditactiongroup)
- [ProjectApiKey](#projectapikey)
- [ProjectApiKeyContext](#projectapikeycontext)
- [UsageLimit](#usagelimit)
- [SandboxLimits](#sandboxlimits)
- [ImageBuildLimits](#imagebuildlimits)
- [StorageLimits](#storagelimits)
- [SandboxResourceLimits](#sandboxresourcelimits)
- [MemberLimits](#memberlimits)
- [ProjectBudget](#projectbudget)
- [OrganizationLimits](#organizationlimits)
- [ListSandboxesOptions](#listsandboxesoptions)
- [LifecycleWaitOptions](#lifecyclewaitoptions)
- [CreateFromBuildOptions](#createfrombuildoptions)
- [FindByNameOptions](#findbynameoptions)
- [CreateMacosSandboxOptions](#createmacossandboxoptions)
- [GetLimitsOptions](#getlimitsoptions)
- [DEFAULT\_V2\_API\_URL](#defaultv2apiurl)
- [V0\_API\_URL](#v0apiurl)
- [DEFAULT\_V2\_API\_URL](#defaultv2apiurl)
- [DISABLED](#disabled)

## Daytona

### Constructors

#### Constructor

```ts
new Daytona(config?: DaytonaConfig): Daytona;
```

**Parameters**:

- `config?` _DaytonaConfig_

**Returns**:

- `Daytona`

### Methods

#### \[Symbol.asyncDispose\]()

```ts
[Symbol.asyncDispose](): Promise<void>;
```

`await using daytona = new Daytona()` calls `close()` at the end of the scope.

**Returns**:

- `Promise<void>`

#### close()

```ts
close(): Promise<void>;
```

Close the namespace clients built so far: the v2 client (its sandbox-state
events socket) and the v0 client (its event socket and, with `otelEnabled`,
its OpenTelemetry SDK, through v0's `[Symbol.asyncDispose]()`). Optional for
short scripts — neither keeps a Node process alive — but long-running
processes should call it. Idempotent; a later `root.v0` / `root.v2` builds
a fresh client. Both are closed even if one fails; the first error is
re-thrown (Python parity).
Stored v2 clients and their handles throw `ClientClosedError` on new requests.

**Returns**:

- `Promise<void>`

#### v0

```ts
get v0(): DaytonaV0Client;
```

The v0 namespace: the v0 SDK's own `Daytona` client (the 0.x SDK bundled at
a pinned release), the same instance on every access. Built on first access,
which loads the v0 SDK synchronously in Node (about 100 ms, once per
process); Node code that only uses `v2` never loads it. Browser builds
bundle the v0 SDK statically into apps that import the root and evaluate
it when the root loads, so `daytona.v0` works there too. A failed
load is not cached: the next access retries.

**Returns**:

- `DaytonaV0Client`

#### v2

```ts
get v2(): DaytonaV2Client;
```

**Returns**:

- `DaytonaV2Client`

***

## DaytonaV2Client

**Properties**:

- `images` _ImagesService_
- `snapshots` _SnapshotsService_
- `volumes` _VolumesService_
- `secrets` _SecretsService_
- `reservations` _ReservationsService_
- `macModels` _MacModelsService_ - The Mac model registry that `reservations.create({ model })` draws from.

### Methods

#### close()

```ts
close(): Promise<void>;
```

Close this client. New requests on stored clients and their handles throw
`ClientClosedError`; closing the root lets `root.v2` build a fresh client.

**Returns**:

- `Promise<void>`

#### create()

```ts
create(): Promise<Sandbox>;
```

Create a Linux sandbox from a registered image name or `img_…` id.
Repeating the same `name` and request is a permanent get-or-create operation.

Omitting the image (`create()` or `create(options)`) boots the platform
default image, the Linux image Daytona marks as default
(`images.list({ platform: 'true' })` shows it with `default: true`). When
no default is configured the create fails with
`DEFAULT_IMAGE_NOT_CONFIGURED` (400). An empty or whitespace-only image is
still an error, thrown before any request.

When Linux sandboxes are not enabled for the organization, the API answers
`403` `FEATURE_NOT_ENABLED` (thrown as `FeatureNotEnabledError`).

**Returns**:

- `Promise<Sandbox>`

#### create()

```ts
create(image: string | undefined, options?: CreateSandboxOptions): Promise<Sandbox>;
```

**Parameters**:

- `image` _string \| undefined_
- `options?` _CreateSandboxOptions_

**Returns**:

- `Promise<Sandbox>`

#### create()

```ts
create(options: CreateSandboxOptions): Promise<Sandbox>;
```

**Parameters**:

- `options` _CreateSandboxOptions_

**Returns**:

- `Promise<Sandbox>`

#### createFromBuild()

```ts
createFromBuild(
   builder: ImageBuilder,
   options: CreateFromBuildOptions = {}): Promise<Sandbox>;
```

Build an anonymous image, wait for it, then create the sandbox from it.
`region` selects the region for BOTH legs: a Dockerfile-built image lives
in one region and can only boot there, so it is built where the
sandbox will run. `buildTimeoutSeconds` bounds the image build separately;
the sandbox create always receives the caller's full `waitSeconds`.
Local files are archived and uploaded before submission. Each part upload
fails once no bytes move for the client's request timeout (0: never); each
completion attempt uses the greater of that timeout and 600 seconds (0: no
bound). No total deadline bounds the upload.

**Parameters**:

- `builder` _ImageBuilder_
- `options` _CreateFromBuildOptions = \{\}_

**Returns**:

- `Promise<Sandbox>`

#### createFromSnapshot()

```ts
createFromSnapshot(
   snapshot: string,
   options: CreateSandboxFromSnapshotOptions = {}): Promise<Sandbox>;
```

Create a sandbox from a snapshot.

When Linux sandboxes are not enabled for the organization, the API answers
`403` `FEATURE_NOT_ENABLED` (thrown as `FeatureNotEnabledError`).

**Parameters**:

- `snapshot` _string_
- `options` _CreateSandboxFromSnapshotOptions = \{\}_

**Returns**:

- `Promise<Sandbox>`

#### createMacos()

```ts
createMacos(image: string, options: CreateMacosSandboxOptions = {}): Promise<Sandbox>;
```

Create a macOS sandbox (`POST /sandboxes/macos`) on a Mac the organization
has reserved (`daytona.reservations`), from a macOS image name.
`reservation` picks the Mac reservation: omitted uses any fitting reservation of the
organization in the region (or lets the organization's auto-reserve buy
one), `'new'` buys a reservation of the cheapest model that fits, and a
reservation id uses only that reservation. With no reservation to use it fails
with `ConflictError` (`NO_ACTIVE_RESERVATION`, `NO_FREE_SLOT`,
`MAC_DISK_FULL`, `AUTO_RESERVE_LIMIT_REACHED`, `NO_MAC_AVAILABLE`).
A reservation it buys (`reservation: 'new'` or auto-reserve) throws `LimitExceededError` (a `RateLimitError`) with `limit === 'max_mac_reservations'` when the organization holds its Mac reservation limit.
 `resources.cpu` (cores), `resources.memory` (GiB) and `resources.disk` (GiB)
 size the sandbox; each omitted
axis uses the Mac model's default size (`defaultSize` in `macModels.list()`);
a create from a captured image that omits `disk` gets the image's disk size, and a smaller
`disk` is refused. The size is fixed at creation, and the sandbox reports
it once a Mac takes the sandbox. `name`,
`idempotencyKey`, `waitSeconds` and `createTimeoutSeconds` behave as on
`create`. `networkPolicy` sets the outbound network policy as on
`create`; a sandbox with a policy runs only on a Mac that can
enforce it.

Creating macOS sandboxes must be enabled for the organization;
otherwise the API answers `403` `FEATURE_NOT_ENABLED`
(thrown as `FeatureNotEnabledError`).

Find regions and their regional API endpoints with `daytona region list` (the CLI);
discover Mac models and prices with `macModels.catalog({ region: '<region>' })`.
To select a regional API endpoint, set `DAYTONA_V2_API_URL` before creating
the client. An API that does not serve the region answers `ConflictError`;
the SDK does not reroute.

**Parameters**:

- `image` _string_
- `options` _CreateMacosSandboxOptions = \{\}_

**Returns**:

- `Promise<Sandbox>`

#### currentApiKey()

```ts
currentApiKey(): Promise<ProjectApiKey>;
```

Describe the API key this client authenticates with: its name, masked
display parts, the project and organization it acts in, its permissions,
expiry and last use. The token itself is never returned.

**Returns**:

- `Promise<ProjectApiKey>`

#### delete()

```ts
delete(sandbox: Sandbox | string, options: LifecycleWaitOptions = {}): Promise<void>;
```

Delete and wait for completion. Image deletion may still return 409 afterward.

**Parameters**:

- `sandbox` _Sandbox \| string_
- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

#### findByName()

```ts
findByName(name: string, options: FindByNameOptions = {}): Promise<readonly Sandbox[]>;
```

Find every live sandbox created with `{ name }`, across all matching pages.

Uses the exact `labels.name` value every `create*({ name })` stamps. Names
are not unique, so this is an array: a get-or-create caller takes `[0]`
when it is non-empty and calls `create(image, { name })` otherwise — and
because that create derives the same key as the first one, a lost race
between two such callers still yields one sandbox. Sandboxes that are
`deleted` or `deleting` are left out. The lookup goes through sandbox
search, where a new sandbox appears shortly after its create, and a
deployment without search answers `SearchNotConfiguredError` (501).

This all-matches lookup is the exception to the one-page list rule.
`region` scopes the read the way it scopes a create; omit it or pass
`'local'` to use the default region.

**Parameters**:

- `name` _string_
- `options` _FindByNameOptions = \{\}_

**Returns**:

- `Promise<readonly Sandbox[]>`

#### get()

```ts
get(id: string, options: SandboxConnectOptions = {}): Promise<Sandbox>;
```

Fetch a sandbox by id.

**Parameters**:

- `id` _string_
- `options` _SandboxConnectOptions = \{\}_

**Returns**:

- `Promise<Sandbox>`

#### getLimits()

```ts
getLimits(options: GetLimitsOptions = {}): Promise<OrganizationLimits>;
```

Return the organization's limits and current usage. An undefined `limit` means
unlimited. With an API key the organization defaults to the key's own,
looked up once and cached; with `jwtToken` authentication pass
`organizationId`. The credential needs `read:limits`. Member counts
(`members`) are not included: they are served to signed-in members only.

**Parameters**:

- `options` _GetLimitsOptions = \{\}_

**Returns**:

- `Promise<OrganizationLimits>`

#### getProjectBudget()

```ts
getProjectBudget(): Promise<ProjectBudget>;
```

Return the monthly spend budget of the API key's project. An unset budget
has undefined limit and period fields. The key needs `read:spending`.
Spend is calculated at list price, before credits, and lags usage by
several minutes. While the project is over its budget, creating or
starting a sandbox in it throws `ProjectBudgetExceededError`.

**Returns**:

- `Promise<ProjectBudget>`

#### iter()

```ts
iter(options: ListSandboxesOptions = {}): AsyncIterable<Sandbox>;
```

**Parameters**:

- `options` _ListSandboxesOptions = \{\}_

**Returns**:

- `AsyncIterable<Sandbox>`

#### list()

```ts
list(options: ListSandboxesOptions = {}): Promise<ListResult<Sandbox>>;
```

List sandboxes as one page `{ items, nextCursor }`.

`cursor` and `limit` are the only options. One page, newest first, read
from `GET /sandboxes/search` (every region) and, on a deployment without
search, from `GET /sandboxes`. Where search serves the list it is
eventually consistent: a sandbox you just created may be missing until
the index catches up (`get` reads it at once). Walk further pages with
`iter` or the returned cursor.

Use `search` for filters, prefixes, resource bounds, and sorting.

**Parameters**:

- `options` _ListSandboxesOptions = \{\}_

**Returns**:

- `Promise<ListResult<Sandbox>>`

#### listAuditActions()

```ts
listAuditActions(): Promise<AuditActionList>;
```

Return the actions the audit log can record for each target type.

**Returns**:

- `Promise<AuditActionList>`

#### pause()

```ts
pause(sandbox: Sandbox | string, options: LifecycleWaitOptions = {}): Promise<void>;
```

**Parameters**:

- `sandbox` _Sandbox \| string_
- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

#### resume()

```ts
resume(sandbox: Sandbox | string, options: LifecycleWaitOptions = {}): Promise<void>;
```

**Parameters**:

- `sandbox` _Sandbox \| string_
- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

#### search()

```ts
search(options: SearchSandboxesOptions = {}): Promise<SearchResult<Sandbox>>;
```

Search sandboxes across every region (`GET /sandboxes/search`).

Every option is optional and they combine as AND. `q` is free text over
name and image (or an exact id); `namePrefix`/`idPrefix` select prefixes.
`states`, `sandboxClass`, and `region` accept a single value or a list
(any-of); a `region` that contains other regions (a geo group, or `earth`)
matches every region inside it. States use public names such as `started`; `creating` matches
pending or assigned sandboxes, and `error` matches failed or lost sandboxes.
`unknown` is not searchable. `labels` is a containment match; the
`min*`/`max*` bounds are inclusive, the `*StartAt` timestamp bounds are
inclusive and the `*EndAt` bounds are exclusive, timestamps as RFC 3339
timestamps without a leap second (year 0001-9999, a real calendar date) or
`Date` objects in those years (a `Date` is serialized in UTC — a whole day is
`createdStartAt` that day and `createdEndAt` the next). `sort` defaults to `created_at` and
`order` to `desc`; `limit` must be an integer from 1 to 200, else
`BadRequestError` before any request. Resolves to a
`SearchResult` whose `items` are the same `Sandbox` handles
`list` returns.

Consistency: search is **eventually consistent**. A create,
update or delete may not appear immediately, so a sandbox you just
created may not be in the result yet — use `get` for
read-your-writes. Results span every region.

Cursor: `nextCursor` is opaque and bound to the exact filter and sort that
produced it — presenting it with a different filter or sort is a 400, never
a silent reset. Paging is best-effort under concurrent mutation: a sandbox
whose sort field (`name`,
`memory_mib`, `updated_at`, ...) changes between two page fetches can appear on
both pages or on neither, and creates or deletes mid-walk shift later pages.

Errors: 400 (`BadRequestError`) for a malformed or mismatched cursor,
an unknown `states`/`sandboxClass`/`sort` value or region, a non-object `labels` or one
with an empty key, or a `min` above its `max`; 501 (`SearchNotConfiguredError` with
`code === 'SEARCH_NOT_CONFIGURED'`) when search is not configured;
503 (`SearchUnavailableError` with `code === 'SEARCH_UNAVAILABLE'`)
when search is unavailable. The error body is the unified envelope
`{ code, message, source, trace_id }` — the class is dispatched from
`(source, code)`. On 501 callers may fall back to `list`, which
reads the plain list route on a deployment without search — without
search options: `list()` takes only `cursor` and `limit`, so the fallback
returns every sandbox unfiltered.

**Parameters**:

- `options` _SearchSandboxesOptions = \{\}_

**Returns**:

- `Promise<SearchResult<Sandbox>>`

#### start()

```ts
start(sandbox: Sandbox | string, options: LifecycleWaitOptions = {}): Promise<void>;
```

**Parameters**:

- `sandbox` _Sandbox \| string_
- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

#### stop()

```ts
stop(sandbox: Sandbox | string, options: LifecycleWaitOptions = {}): Promise<void>;
```

**Parameters**:

- `sandbox` _Sandbox \| string_
- `options` _LifecycleWaitOptions = \{\}_

**Returns**:

- `Promise<void>`

***

## DaytonaV0Client

```ts
type DaytonaV0Client = InstanceType<V0ModuleTypes['RootOnlyClientV0']>
```

The v0 SDK's own `Daytona` instance type: what `daytona.v0` returns. The
bundle exports the class under the private `RootOnlyClientV0`, read only here
because SDK 2.x builds a v0 client only through the root.

***

## DaytonaConfig

```ts
type DaytonaConfig = {
  readonly apiKey?: string
  readonly jwtToken?: string
  /** v0 only: scopes a JWT to an organization. */
  readonly organizationId?: string
  /**
   * The v0 client's default region (`v2` takes a per-create `region`).
   * @deprecated Applies only to the v0 namespace. Pass `target` per v0 sandbox
   * create (`d.v0.create({ target })`) or `regionId` per v0 snapshot create
   * instead. Setting it still works and emits a runtime deprecation warning.
   */
  readonly target?: string
  /** v2 only: scopes a JWT to a project. */
  readonly projectId?: string
  /**
   * v2 only: the total time one ordinary request may take, in seconds
   * (default 60; `0`, or a value above 2,147,483.647 (about 24.8 days), means
   * no limit). Waits and long polls use their own budget,
   * streams are bounded only until their response headers arrive, and file
   * transfers have no total bound but fail once no bytes move for this long
   * (with `0`, transfers are not bounded at all).
   */
  readonly requestTimeoutSeconds?: number
  /**
   * v2 only: the cap on a response body the SDK holds in memory whole, in
   * bytes (an integer up to `Number.MAX_SAFE_INTEGER`; `undefined` or `null` keep the 1 GiB default, `0` means no limit, and any other value (negative, fractional, boolean, string, too large) is a `BadRequestError`). See the v2
   * `DaytonaConfig.maxResponseBytes`.
   */
  readonly maxResponseBytes?: number | null
  /** Both namespaces. */
  readonly otelEnabled?: boolean
  /** v2 only. */
  readonly otelApi?: OtelApiLike
  /** v2 only (v0 at the pinned release has no pool-size setting). */
  readonly connectionPoolMaxsize?: number
  /** v2 only: share the sandbox-state events hub with matching clients (default `true`). */
  readonly sharedHub?: boolean
  /** v2 only: sandbox-state events hub settings (`SandboxEventsConfig` from `@daytona/sdk/v2`). */
  readonly events?: SandboxEventsConfig
}
```

Configuration shared by both namespaces. Routing per field (also
`ROOT_CONFIG_ROUTING`): `apiKey`, `jwtToken`, `otelEnabled` reach v0 and v2;
`organizationId` and the deprecated `target` are v0-only; `projectId`,
`requestTimeoutSeconds`, `maxResponseBytes`, `otelApi`,
`connectionPoolMaxsize`, `sharedHub` and `events` are v2-only.

`new Daytona(config)` copies the fields: changing the object afterwards has
no effect on the client. An unknown field is a `BadRequestError`, and a
renamed one names its replacement (`requestTimeout` → `requestTimeoutSeconds`).
There is no API URL field: `DAYTONA_V2_API_URL` (a regional endpoint or a test environment)
selects the v2 endpoint; `DAYTONA_API_URL` belongs to the 0.x SDK: SDK 2.x
never routes with it and only warns once when it names a non-Cloud URL.

**Properties**:

- `apiKey?` _string_
- `jwtToken?` _string_
- `organizationId?` _string_ - v0 only: scopes a JWT to an organization.
- `target?` _string_ - The v0 client's default region (`v2` takes a per-create `region`).
- `projectId?` _string_ - v2 only: scopes a JWT to a project.
- `requestTimeoutSeconds?` _number_ - v2 only: the total time one ordinary request may take, in seconds
  (default 60; `0`, or a value above 2,147,483.647 (about 24.8 days), means
  no limit). Waits and long polls use their own budget,
  streams are bounded only until their response headers arrive, and file
  transfers have no total bound but fail once no bytes move for this long
  (with `0`, transfers are not bounded at all).
- `maxResponseBytes?` _number \| null_ - v2 only: the cap on a response body the SDK holds in memory whole, in
  bytes (an integer up to `Number.MAX_SAFE_INTEGER`; `undefined` or `null` keep the 1 GiB default, `0` means no limit, and any other value (negative, fractional, boolean, string, too large) is a `BadRequestError`). See the v2
  `DaytonaConfig.maxResponseBytes`.
- `otelEnabled?` _boolean_ - Both namespaces.
- `otelApi?` _OtelApiLike_ - v2 only.
- `connectionPoolMaxsize?` _number_ - v2 only (v0 at the pinned release has no pool-size setting).
- `sharedHub?` _boolean_ - v2 only: share the sandbox-state events hub with matching clients (default `true`).
- `events?` _SandboxEventsConfig_ - v2 only: sandbox-state events hub settings (`SandboxEventsConfig` from `@daytona/sdk/v2`).

***

## OtelApiLike

Structural subset of `@opentelemetry/api` the SDK uses. Pass your app's
`import * as otel from '@opentelemetry/api'` as `otelApi` to skip the SDK's
own module resolution (required in bundled browser apps).

**Properties**:

- `trace` _\{ getTracer(name: string, version: string): OtelTracerLike; setSpan(context: OtelContextLike, span: OtelSpanLike): OtelContextLike \}_
- `context` _\{ active(): OtelContextLike \}_
- `propagation` _\{ inject(context: OtelContextLike, carrier: OtelCarrier): void \}_
- `SpanKind` _\{ readonly CLIENT: number \}_
- `SpanStatusCode` _\{ readonly OK: number; readonly ERROR: number \}_

***

## Resources

Sandbox resources; CPU is cores (1 core = 2 vCPUs), memory and disk are GiB.
`cpu`/`memory`/`disk` are the request: what is reserved and
billed as a floor. `cpuMax`/`memoryMax`/`diskMax` are the limits: the boot
shape and the ceiling, the system cap when omitted. Set each limit equal to
its request for a fixed shape. Requests below the platform minimums are
raised to them, so a fixed shape below a minimum is refused.

**Properties**:

- `cpu?` _number_ - CPU request in cores (1 core = 2 vCPUs), fractional allowed.
- `cpuMax?` _number_ - CPU limit in cores, a multiple of 0.5: the sandbox boots `cpuMax * 2` vCPUs.
- `memory?` _number_ - Memory in GiB.
- `memoryMax?` _number_ - Memory limit in GiB.
- `disk?` _number_ - Scratch disk in GiB.
- `diskMax?` _number_ - Scratch disk limit in GiB.

***

## JsonValue

```ts
type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue }
```

***

## SnapshotKind

```ts
type SnapshotKind = (typeof API_SNAPSHOT_KINDS)[number] | 'unknown'
```

***

## SnapshotClass

```ts
type SnapshotClass = 'linux' | 'unknown'
```

***

## SnapshotRef

**Properties**:

- `id` _string_
- `name?` _string_

***

## CreateRequestBaseOptions

**Properties**:

- `name?` _string_
- `labels?` _Readonly\<Record\<string, string\>\>_
- `ports?` _readonly PortMapping\[\]_
- `lifecyclePolicy?` _LifecyclePolicyOptions \| null_ - `null` is accepted and means "no policy", exactly like omitting the key —
  a JSON config round-trip produces it, and the Python SDK's `None` (the same
  argument in the same position) already reads that way.
- `region?` _string_ - Region selector for this create request.
- `waitSeconds?` _number_
- `createTimeoutSeconds?` _number_
- `autoDelete?` _boolean_ - Delete on disposal only when explicitly enabled; default false.
- `idempotencyKey?` _string_ - Identifies this create to the server: a second `create()` with the same
  key and request (in the same project and API endpoint) returns the
  sandbox the first one made instead
  of a new one, so a create whose response was lost can be retried safely.
  Reusing a key with changed parameters can return `ConflictError`.
  Reuse the same parameters when retrying and use a fresh key for a
  different sandbox. A retried create returns
  no fresh access token; the project API key manages the sandbox as usual.
  When omitted the SDK mints a random key per call and reports it on
  `SandboxCreateRequestTimeoutError` / `SandboxCreateConnectionError`
  if the request itself fails before the server answers. The key is sent
  verbatim; the server rejects a blank key, a key longer than 256 characters,
  or one with characters outside printable ASCII with `400 BAD_REQUEST` (it
  travels as an HTTP header).

***

## CreateSandboxOptions

Options for `Daytona.create`.

**Visible resources.** Burstable sandboxes expose the burst
ceiling (`resources.cpuMax` / `memoryMax`, or the deployment cap when
omitted), so `nproc` and `/proc/meminfo` report that ceiling, not the
guaranteed `cpu`. Tools that size themselves from the CPU count
(`pytest -n auto`, `make -j$(nproc)`) start one worker per visible CPU.
Pass an explicit worker count when you need the guarantee instead of the
ceiling.

**Properties**:

- `name?` _string_
- `labels?` _Readonly\<Record\<string, string\>\>_
- `ports?` _readonly PortMapping\[\]_
- `lifecyclePolicy?` _LifecyclePolicyOptions \| null_ - `null` is accepted and means "no policy", exactly like omitting the key —
  a JSON config round-trip produces it, and the Python SDK's `None` (the same
  argument in the same position) already reads that way.
- `region?` _string_ - Region selector for this create request.
- `waitSeconds?` _number_
- `createTimeoutSeconds?` _number_
- `autoDelete?` _boolean_ - Delete on disposal only when explicitly enabled; default false.
- `idempotencyKey?` _string_ - Identifies this create to the server: a second `create()` with the same
  key and request (in the same project and API endpoint) returns the
  sandbox the first one made instead
  of a new one, so a create whose response was lost can be retried safely.
  Reusing a key with changed parameters can return `ConflictError`.
  Reuse the same parameters when retrying and use a fresh key for a
  different sandbox. A retried create returns
  no fresh access token; the project API key manages the sandbox as usual.
  When omitted the SDK mints a random key per call and reports it on
  `SandboxCreateRequestTimeoutError` / `SandboxCreateConnectionError`
  if the request itself fails before the server answers. The key is sent
  verbatim; the server rejects a blank key, a key longer than 256 characters,
  or one with characters outside printable ASCII with `400 BAD_REQUEST` (it
  travels as an HTTP header).
- `volumes?` _readonly VolumeMount\[\]_
- `env?` _Readonly\<Record\<string, string\>\>_
- `resources?` _Resources_
- `cpuArch?` _CpuArch_
- `cpuType?` _string_
- `secrets?` _readonly string\[\]_
- `spot?` _boolean_
- `user?` _string_
- `networkPolicy?` _NetworkPolicyInput \| null_

***

## LifecycleAction

```ts
type LifecycleAction = 'stop' | 'pause' | 'delete'
```

The action a lifecycle trigger fires: `onTimeout` / `onIdleTimeout`.

`delete` is available for every sandbox; `stop` requires a persistent macOS
sandbox. Pause a macOS sandbox with its explicit `pause()` operation.

***

## CreateSandboxFromSnapshotOptions

**Properties**:

- `name?` _string_
- `labels?` _Readonly\<Record\<string, string\>\>_
- `ports?` _readonly PortMapping\[\]_
- `lifecyclePolicy?` _LifecyclePolicyOptions \| null_ - `null` is accepted and means "no policy", exactly like omitting the key —
  a JSON config round-trip produces it, and the Python SDK's `None` (the same
  argument in the same position) already reads that way.
- `region?` _string_ - Region selector for this create request.
- `waitSeconds?` _number_
- `createTimeoutSeconds?` _number_
- `autoDelete?` _boolean_ - Delete on disposal only when explicitly enabled; default false.
- `idempotencyKey?` _string_ - Identifies this create to the server: a second `create()` with the same
  key and request (in the same project and API endpoint) returns the
  sandbox the first one made instead
  of a new one, so a create whose response was lost can be retried safely.
  Reusing a key with changed parameters can return `ConflictError`.
  Reuse the same parameters when retrying and use a fresh key for a
  different sandbox. A retried create returns
  no fresh access token; the project API key manages the sandbox as usual.
  When omitted the SDK mints a random key per call and reports it on
  `SandboxCreateRequestTimeoutError` / `SandboxCreateConnectionError`
  if the request itself fails before the server answers. The key is sent
  verbatim; the server rejects a blank key, a key longer than 256 characters,
  or one with characters outside printable ASCII with `400 BAD_REQUEST` (it
  travels as an HTTP header).

***

## LifecyclePolicyOptions

Per-sandbox lifecycle policy: a wall-clock timeout and an idle timeout, each
paired with the action it fires.

`timeoutSeconds` (`>= 1`, never disabled) fires `onTimeout` after that many seconds
after create, after an `updateLifecyclePolicy()` that supplies it, and again after
every accepted transition to running (start or resume) — the full budget
re-arms each time. Omitted `onTimeout` uses the server's default for the
sandbox class and persistence.

`idleExpirySeconds` is opt-in and fires `onIdleTimeout` after that many seconds
without activity; `DISABLED` clears it. `onIdleTimeout` has no default —
arming `idleExpirySeconds` from nothing requires it.

At Linux create, each field you omit is inherited first from the project's
lifecycle defaults (set in the dashboard's project settings), then — for
`timeoutSeconds` only — from the platform default timeout when enabled.
macOS uses platform defaults, not project lifecycle defaults.
An action follows its own interval: a
`timeoutSeconds` you pass without `onTimeout` gets the class default, not the
project's action. Pass `DISABLED` as `idleExpirySeconds` to opt out of an
inherited idle timeout. Project defaults apply to new sandboxes only;
`updateLifecyclePolicy()` never consults them.

Rejected before posting when inapplicable to the sandbox class: see
`LifecycleAction` for the supported actions.

**Properties**:

- `timeoutSeconds?` _number_
- `onTimeout?` _LifecycleAction_
- `idleExpirySeconds?` _number_
- `onIdleTimeout?` _LifecycleAction_

***

## SandboxConnectOptions

**Properties**:

- `toolboxUrl?` _string_ - Toolbox URL already scoped to this sandbox.
  The SDK sends this sandbox's toolbox credential there (the API key, a
  project token, or a minted sandbox token), so pass only a URL you trust —
  never one read from stored or user-supplied data. Omit it to use the URL
  the API returns.
- `accessToken?` _string_ - Token override for this sandbox's toolbox requests. A caller-supplied token is
  used verbatim and never silently replaced: its expiry surfaces as a 401.
  Without one, a handle with an API key or a JWT client's project token mints and refreshes
  short-lived sandbox access tokens transparently.
- `autoDelete?` _boolean_ - Auto-delete when disposed with `await using`; defaults to false.

***

## ListResult

**Properties**:

- `items` _readonly T\[\]_
- `nextCursor?` _string_

***

## NetworkPolicyInput

**Properties**:

- `blockAll?` _boolean \| null_
- `allowCidrs?` _readonly string\[\]_
- `allowDomains?` _readonly string\[\] \| null_

***

## NetworkPolicy

**Properties**:

- `version` _number_
- `blockAll` _boolean_
- `allowCidrs` _readonly string\[\]_
- `allowDomains?` _readonly string\[\]_

***

## NetworkPolicyInfo

**Properties**:

- `desired?` _NetworkPolicy_
- `desiredRevision` _number_
- `etag` _string_
- `applied?` _NetworkPolicy_
- `appliedRevision?` _number_
- `appliedStartId?` _string_
- `status?` _string_
- `error?` _string_

***

## CpuArch

```ts
type CpuArch = 'amd64' | 'arm64'
```

***

## AuditActionList

**Properties**:

- `targets` _readonly AuditActionGroup\[\]_

***

## AuditActionGroup

**Properties**:

- `targetType` _string_
- `actions` _readonly string\[\]_

***

## ProjectApiKey

**Properties**:

- `id` _string_
- `name` _string_
- `projectId` _string_
- `projectPermissions` _readonly string\[\]_
- `createdAt` _string_
- `createdBy?` _string_
- `expiresAt?` _string_
- `lastUsedAt?` _string_
- `revokedAt?` _string_
- `keyPrefix?` _string_
- `keySuffix?` _string_
- `serviceAccountId?` _string_
- `serviceAccountName?` _string_
- `context` _ProjectApiKeyContext_

***

## ProjectApiKeyContext

**Properties**:

- `orgId` _string_
- `orgName` _string_
- `projectName` _string_

***

## UsageLimit

**Properties**:

- `limit?` _number_
- `usage` _number_

***

## SandboxLimits

**Properties**:

- `concurrent` _UsageLimit_
- `total` _UsageLimit_

***

## ImageBuildLimits

**Properties**:

- `concurrent` _UsageLimit_

***

## StorageLimits

**Properties**:

- `volumes` _UsageLimit_
- `images` _UsageLimit_
- `snapshots` _UsageLimit_

***

## SandboxResourceLimits

**Properties**:

- `maxCores` _number_
- `maxMemoryMib` _number_

***

## MemberLimits

**Properties**:

- `limit?` _number_
- `usage` _number_
- `pendingInvitations` _number_

***

## ProjectBudget

**Properties**:

- `monthlyLimitCents?` _number_
- `periodStartDate?` _string_
- `spentCents?` _number_
- `createdAt?` _string_
- `updatedAt?` _string_
- `evaluatedAt?` _string_
- `exceededAt?` _string_
- `stopAt?` _string_

***

## OrganizationLimits

**Properties**:

- `sandboxes` _SandboxLimits_
- `imageBuilds` _ImageBuildLimits_
- `storage` _StorageLimits_
- `secretsPerProject` _UsageLimit_
- `apiKeysPerProject` _UsageLimit_
- `apiKeysPerOrganization` _UsageLimit_
- `sandboxResources?` _SandboxResourceLimits_
- `macReservations?` _UsageLimit_ - Mac reservations the organization holds: pending, active or ending. Renewals do not count again.
- `members?` _MemberLimits_

***

## ListSandboxesOptions

One page of `Daytona.list()`; filtering belongs to `search()`.

**Properties**:

- `cursor?` _string_
- `limit?` _number_

***

## LifecycleWaitOptions

**Properties**:

- `timeoutSeconds?` _number_ - Wait budget in seconds; default 60; `0`, or a value above about 24.8 days, waits without a deadline.

***

## CreateFromBuildOptions

**Properties**:

- `name?` _string_
- `labels?` _Readonly\<Record\<string, string\>\>_
- `ports?` _readonly PortMapping\[\]_
- `lifecyclePolicy?` _LifecyclePolicyOptions \| null_ - `null` is accepted and means "no policy", exactly like omitting the key —
  a JSON config round-trip produces it, and the Python SDK's `None` (the same
  argument in the same position) already reads that way.
- `region?` _string_ - Region selector for this create request.
- `waitSeconds?` _number_
- `createTimeoutSeconds?` _number_
- `autoDelete?` _boolean_ - Delete on disposal only when explicitly enabled; default false.
- `idempotencyKey?` _string_ - Identifies this create to the server: a second `create()` with the same
  key and request (in the same project and API endpoint) returns the
  sandbox the first one made instead
  of a new one, so a create whose response was lost can be retried safely.
  Reusing a key with changed parameters can return `ConflictError`.
  Reuse the same parameters when retrying and use a fresh key for a
  different sandbox. A retried create returns
  no fresh access token; the project API key manages the sandbox as usual.
  When omitted the SDK mints a random key per call and reports it on
  `SandboxCreateRequestTimeoutError` / `SandboxCreateConnectionError`
  if the request itself fails before the server answers. The key is sent
  verbatim; the server rejects a blank key, a key longer than 256 characters,
  or one with characters outside printable ASCII with `400 BAD_REQUEST` (it
  travels as an HTTP header).
- `volumes?` _readonly VolumeMount\[\]_
- `env?` _Readonly\<Record\<string, string\>\>_
- `resources?` _Resources_
- `cpuArch?` _CpuArch_
- `cpuType?` _string_
- `secrets?` _readonly string\[\]_
- `spot?` _boolean_
- `user?` _string_
- `networkPolicy?` _NetworkPolicyInput \| null_
- `idleExpirySeconds?` _number_
- `buildTimeoutSeconds?` _number_ - Image build budget in seconds; omitted, `0` or a value above about 24.8 days waits without a deadline.

***

## FindByNameOptions

**Properties**:

- `region?` _string_

***

## CreateMacosSandboxOptions

Options for a macOS create. `resources` sizes the sandbox; omitted axes use
the API defaults.
CPU selectors do not apply.

**Properties**:

- `name?` _string_
- `labels?` _Readonly\<Record\<string, string\>\>_
- `ports?` _readonly PortMapping\[\]_
- `lifecyclePolicy?` _LifecyclePolicyOptions \| null_ - `null` is accepted and means "no policy", exactly like omitting the key —
  a JSON config round-trip produces it, and the Python SDK's `None` (the same
  argument in the same position) already reads that way.
- `region?` _string_ - Region selector for this create request.
- `waitSeconds?` _number_
- `createTimeoutSeconds?` _number_
- `autoDelete?` _boolean_ - Delete on disposal only when explicitly enabled; default false.
- `idempotencyKey?` _string_ - Identifies this create to the server: a second `create()` with the same
  key and request (in the same project and API endpoint) returns the
  sandbox the first one made instead
  of a new one, so a create whose response was lost can be retried safely.
  Reusing a key with changed parameters can return `ConflictError`.
  Reuse the same parameters when retrying and use a fresh key for a
  different sandbox. A retried create returns
  no fresh access token; the project API key manages the sandbox as usual.
  When omitted the SDK mints a random key per call and reports it on
  `SandboxCreateRequestTimeoutError` / `SandboxCreateConnectionError`
  if the request itself fails before the server answers. The key is sent
  verbatim; the server rejects a blank key, a key longer than 256 characters,
  or one with characters outside printable ASCII with `400 BAD_REQUEST` (it
  travels as an HTTP header).
- `volumes?` _readonly VolumeMount\[\]_ - Read-write disk volumes. Cannot be combined with `persistent: true`.
- `env?` _Readonly\<Record\<string, string\>\>_
- `secrets?` _readonly string\[\]_ - Project secret names to attach, as on `create`. Values are write-only and
  restricted to each secret's allowed domains. Needs `read:secrets` permission.
- `resources?` _MacosResources_ - Physical cores and GiB; omitted axes use the platform defaults.
- `persistent?` _boolean_ - Keep the sandbox's disk and machine across stop and start, and its memory
  across pause and resume. A start can run on any Mac of the organization;
  after a start on a different Mac, iCloud asks the user to sign in again.
  Delete erases the disk. A reservation end or a Mac failure stops a
  persistent sandbox that has started and never deletes it; a Mac failure
  can lose its most recent writes.
- `reservation?` _'new' \| (string & \{\})_ - Which Mac reservation the sandbox runs on. Omitted: any fitting reservation of the
  organization in the region; when none fits and the organization's
  auto-reserve setting allows it, the server buys a reservation. `'new'`: buy a
  reservation of the cheapest model that fits. Any other value is a reservation
  id as `reservations.list()` returns it.
  A reservation ID uses only that reservation. An accepted create can wait
  for space on a Mac until `createTimeoutSeconds`.
- `autoRenew?` _boolean_ - Only with `reservation: 'new'`: whether the bought reservation renews itself
  each period. The server defaults it to the organization's auto-reserve
  setting. Rejected before posting otherwise.
- `networkPolicy?` _NetworkPolicyInput \| null_ - Network policy, as on `create`, effective from the sandbox's first boot.
  Change it later with `sandbox.updateNetworkPolicy`.

***

## GetLimitsOptions

Options for `Daytona.getLimits`.

**Properties**:

- `organizationId?` _string_ - The organization to read. Defaults to the API key's organization;
  required when the client authenticates with `jwtToken`.

***

## DEFAULT\_V2\_API\_URL

```ts
const DEFAULT_V2_API_URL = 'https://api.daytona.com'
```

The default Daytona Cloud v2 API, used unless `DAYTONA_V2_API_URL` (a
regional endpoint or a test environment) selects another one. `DAYTONA_API_URL` belongs to
the 0.x SDK; SDK 2.x ignores it for routing (the root warns on custom values).

***

## V0\_API\_URL

```ts
const V0_API_URL = 'https://app.daytona.io/api'
```

***

## DEFAULT\_V2\_API\_URL

```ts
export { DEFAULT_V2_API_URL as DEFAULT_V2_API_URL }
```

Alias of `DEFAULT_V2_API_URL`.

***

## DISABLED

```ts
const DISABLED = -1
```

Clears `LifecyclePolicyOptions.idleExpirySeconds` — and ONLY that field.

`idleExpirySeconds` value space, identical at create and on
`sandbox.updateLifecyclePolicy()`: omitted = unchanged / disabled (create);
`DISABLED` (-1) = clear the idle pair (`onIdleTimeout` with it);
`n > 0` = whole seconds, sent verbatim on the wire; a value
below 60 raised to 60 server-side and read back
raised; `0` and anything below -1 are rejected.

`timeoutSeconds` does NOT accept it: the timeout cannot be disabled, so
`timeoutSeconds` must be `>= 1` (`-1` and `0` are rejected).
