# Daytona (TypeScript SDK reference)

## Contents

- [Daytona](#daytona)
- [DaytonaV2Client](#daytonav2client)
- [idempotencyKeyForName](#idempotencykeyforname)
- [DaytonaV0Client](#daytonav0client)
- [DaytonaConfig](#daytonaconfig)
- [OtelApiLike](#otelapilike)
- [Resources](#resources)
- [SnapshotKind](#snapshotkind)
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
- [CpuTypeInfo](#cputypeinfo)
- [AuditActionList](#auditactionlist)
- [AuditActionGroup](#auditactiongroup)
- [ProjectApiKeyWithContext](#projectapikeywithcontext)
- [ProjectBudget](#projectbudget)
- [SnapshotDetail](#snapshotdetail)
- [ListSandboxesOptions](#listsandboxesoptions)
- [ListSandboxesQuery](#listsandboxesquery)
- [CreateMacosSandboxOptions](#createmacossandboxoptions)
- [OrganizationLimits](#organizationlimits)
- [GetLimitsOptions](#getlimitsoptions)
- [DEFAULT\_V2\_API\_URL](#defaultv2apiurl)
- [V0\_API\_URL](#v0apiurl)
- [DEFAULT\_V2\_API\_URL](#defaultv2apiurl)
- [NAME\_LABEL](#namelabel)
- [DISABLED](#disabled)

## Daytona

### Constructors

#### Constructor

```ts
new Daytona(config: DaytonaConfig = {}, internal: InternalOptions = {}): Daytona;
```

**Parameters**:

- `config` _DaytonaConfig = \{\}_
- `internal` _InternalOptions = \{\}_

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
- `volume` _VolumeService_
- `secret` _SecretService_
- `reservations` _ReservationsService_
- `macModels` _MacModelsService_ - The Mac model registry that `reservations.create({ model })` draws from.

### Methods

#### close()

```ts
close(): Promise<void>;
```

**Returns**:

- `Promise<void>`

#### create()

```ts
create(): Promise<Sandbox>;
```

Create a Linux sandbox from a registered image name or `img_…` id.

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
   options: CreateSandboxOptions & Omit<BuildImageOptions, 'region'> = {}): Promise<Sandbox>;
```

Build an anonymous image, wait for it, then create the sandbox from it.
`region` selects the region for BOTH legs: a Dockerfile-built image lives
in one region and can only boot there, so it is built where the
sandbox will run. `BuildImageOptions.region` is therefore not accepted
here — pass `region`.

**Parameters**:

- `builder` _ImageBuilder_
- `options` _CreateSandboxOptions & Omit\<BuildImageOptions, 'region'\> = \{\}_

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
reservation id targets that reservation at claim. With no reservation to use it fails
with `ConflictError` (`NO_ACTIVE_RESERVATION`, `NO_FREE_SLOT`,
`MAC_DISK_FULL`, `AUTO_RESERVE_LIMIT_REACHED`, `NO_MAC_AVAILABLE`).
`cpu` (cores), `memory` (GiB) and `disk` (GiB) size the sandbox; each omitted
axis uses half of the claiming Mac, rounded down, on a model that runs two sandboxes,
or all of it on a model that runs one. The first successful
claim fixes the size, which the sandbox reports from then on. `name`,
`idempotencyKey`, `waitSeconds` and `createTimeoutSeconds` behave as on
`create`. `networkPolicy` sets the outbound network policy as on
`create`; a sandbox with a policy runs only on a Mac that can
enforce it.

Creating macOS sandboxes must be enabled for the organization;
otherwise the API answers `403` `FEATURE_NOT_ENABLED`
(thrown as `FeatureNotEnabledError`).

Find regions and their regional API endpoints with `GET /regions`;
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
currentApiKey(): Promise<api.ProjectApiKeyWithContext>;
```

Describe the API key this client authenticates with: its name, masked
display parts, the project and organization it acts in, its permissions,
expiry and last use. The token itself is never returned.

**Returns**:

- `Promise<api.ProjectApiKeyWithContext>`

#### delete()

```ts
delete(sandbox: Sandbox | string): Promise<void>;
```

Request deletion. Image deletion may still return 409 afterward, even after a sandbox 404 or `destroyed` state.

**Parameters**:

- `sandbox` _Sandbox \| string_

**Returns**:

- `Promise<void>`

#### findByName()

```ts
findByName(name: string, options: { region?: string } = {}): Promise<Sandbox[]>;
```

Find the sandbox created with `{ name }`.

Uses the exact `labels.name` value every `create*({ name })` stamps. Names
are not unique, so this is an array: a get-or-create caller takes `[0]`
when it is non-empty and calls `create(image, { name })` otherwise — and
because that create derives the same key as the first one, a lost race
between two such callers still yields one sandbox. Sandboxes that are
`deleted` or `deleting` are left out. The lookup goes through sandbox
search, where a new sandbox appears shortly after its create, and a
deployment without search answers `SearchNotConfiguredError` (501).

`region` scopes the read the way it scopes a create; omit it or pass
`'local'` to use the default region.

**Parameters**:

- `name` _string_
- `options` _\{ region?: string \} = \{\}_

**Returns**:

- `Promise<Sandbox[]>`

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

Return the organization's limits and current usage. A null `limit` means
unlimited. With an API key the organization defaults to the key's own,
looked up once and cached; with `jwtToken` authentication pass
`organizationId`. The credential needs `read:limits`. Member counts
(`members`) are not included: they are served to signed-in members only.

**Parameters**:

- `options` _GetLimitsOptions = \{\}_

**Returns**:

- `Promise<OrganizationLimits>`

#### getNetworkPolicy()

```ts
getNetworkPolicy(sandbox: Sandbox | string): Promise<NetworkPolicyInfo>;
```

**Parameters**:

- `sandbox` _Sandbox \| string_

**Returns**:

- `Promise<NetworkPolicyInfo>`

#### getProjectBudget()

```ts
getProjectBudget(): Promise<ProjectBudget>;
```

Return the monthly spend budget of the API key's project. An unset budget
has nullable limit and period fields. The key needs `read:spending`.
Spend is calculated at list price, before credits, and lags usage by
several minutes. While the project is over its budget, creating or
starting a sandbox in it throws `ProjectBudgetExceededError`.

**Returns**:

- `Promise<ProjectBudget>`

#### getSandboxSecrets()

```ts
getSandboxSecrets(sandbox: Sandbox | string): Promise<SandboxSecretsInfo>;
```

Read a sandbox's attached secret names and apply state; see `Sandbox.getSecrets`.

**Parameters**:

- `sandbox` _Sandbox \| string_

**Returns**:

- `Promise<SandboxSecretsInfo>`

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

With only `cursor`/`limit` this is the read-your-writes path: one page of
`GET /sandboxes`, newest first. A sandbox you just created is in the result;
walk further pages with `iter` or the returned cursor.

Any other option — including `id`/`name` (sent as `idPrefix`/`namePrefix`),
`q`, `status`, `sandboxClass`, `region`, `labels`, the resource and timestamp
bounds, `sort`, `order` — switches the call to a single `GET /sandboxes/search`
request, the same surface as `search`, and fills `total` and
`totalRelation` on the result. That path is
**eventually consistent**: results may be briefly stale,
and search spans every region. The
cursor it returns is opaque, tied to the exact filter and
sort that produced it (reusing it with a different filter or sort is a
400), and paging is best-effort under concurrent mutation: a sandbox whose
sort field changes between pages can be seen twice or missed. If the API
reports search as unconfigured (501, `SearchNotConfiguredError` with
`code === 'SEARCH_NOT_CONFIGURED'`) or search is unavailable (503,
`SearchUnavailableError` with `code === 'SEARCH_UNAVAILABLE'`), drop
the search options to fall back to the `GET /sandboxes` path.

**Parameters**:

- `options` _ListSandboxesOptions = \{\}_

**Returns**:

- `Promise<ListResult<Sandbox>>`

#### listAuditActions()

```ts
listAuditActions(): Promise<api.AuditActionList>;
```

Return the actions the audit log can record for each target type.

**Returns**:

- `Promise<api.AuditActionList>`

#### pause()

```ts
pause(
   sandbox: Sandbox | string,
   options: { readonly timeout?: number } = {}): Promise<void>;
```

**Parameters**:

- `sandbox` _Sandbox \| string_
- `options` _\{ readonly timeout?: number \} = \{\}_

**Returns**:

- `Promise<void>`

#### replaceSandboxSecrets()

```ts
replaceSandboxSecrets(
   sandbox: Sandbox | string,
   secrets: readonly string[],
   options: { ifMatch: string }): Promise<SandboxSecretsInfo>;
```

Replace a sandbox's attached secret names; see `Sandbox.replaceSecrets`.

**Parameters**:

- `sandbox` _Sandbox \| string_
- `secrets` _readonly string\[\]_
- `options` _\{ ifMatch: string \}_

**Returns**:

- `Promise<SandboxSecretsInfo>`

#### resetNetworkPolicy()

```ts
resetNetworkPolicy(
   sandbox: Sandbox | string,
   options: { ifMatch: string }): Promise<NetworkPolicyInfo>;
```

**Parameters**:

- `sandbox` _Sandbox \| string_
- `options` _\{ ifMatch: string \}_

**Returns**:

- `Promise<NetworkPolicyInfo>`

#### resume()

```ts
resume(
   sandbox: Sandbox | string,
   options: { readonly timeout?: number } = {}): Promise<void>;
```

**Parameters**:

- `sandbox` _Sandbox \| string_
- `options` _\{ readonly timeout?: number \} = \{\}_

**Returns**:

- `Promise<void>`

#### search()

```ts
search(options: SearchSandboxesOptions = {}): Promise<SearchResult<Sandbox>>;
```

Search sandboxes across every region (`GET /sandboxes/search`).

Every option is optional and they combine as AND. `q` is free text over
name and image (or an exact id); `namePrefix`/`idPrefix` are the
server-side form of `list({ name })`/`list({ id })`; `status`, `sandboxClass`
and `region` accept a single value or a list (any-of; lifecycle states use
the API's wire names such as `running`); `labels` is a containment match; the
`min*`/`max*` bounds are inclusive, the `*StartAt` timestamp bounds are
inclusive and the `*EndAt` bounds are exclusive, timestamps as RFC 3339
strings or `Date` objects (a `Date` is serialized in UTC — a whole day is
`createdStartAt` that day and `createdEndAt` the next). `sort` defaults to `created_at` and
`order` to `desc`; `limit` is clamped to 1..200 by the server. Resolves to a
`SearchResult` whose `items` are the same `Sandbox` handles
`list` returns.

Consistency: search is **eventually consistent**. A create,
update or delete may not appear immediately, so a sandbox you just
created may not be in the result yet — use `get` or `list`
without search filters for read-your-writes. Results span every region.

Cursor: `nextCursor` is opaque and bound to the exact filter and sort that
produced it — presenting it with a different filter or sort is a 400, never
a silent reset. Paging is best-effort under concurrent mutation: a sandbox
whose sort field (`status`, `name`,
`memory_mib`, `updated_at`, ...) changes between two page fetches can appear on
both pages or on neither, and creates or deletes mid-walk shift later pages.

Errors: 400 (`BadRequestError`) for a malformed or mismatched cursor,
an unknown `status`/`sandboxClass`/`sort` value, a non-object `labels` or a `min`
above its `max`; 501 (`SearchNotConfiguredError` with
`code === 'SEARCH_NOT_CONFIGURED'`) when search is not configured;
503 (`SearchUnavailableError` with `code === 'SEARCH_UNAVAILABLE'`)
when search is unavailable. The error body is the unified envelope
`{ code, message, source, trace_id }` — the class is dispatched from
`(source, code)`. On 501/503 callers may fall
back to `list` without search options.

**Parameters**:

- `options` _SearchSandboxesOptions = \{\}_

**Returns**:

- `Promise<SearchResult<Sandbox>>`

#### start()

```ts
start(
   sandbox: Sandbox | string,
   options: { readonly timeout?: number } = {}): Promise<void>;
```

**Parameters**:

- `sandbox` _Sandbox \| string_
- `options` _\{ readonly timeout?: number \} = \{\}_

**Returns**:

- `Promise<void>`

#### stop()

```ts
stop(sandbox: Sandbox | string): Promise<void>;
```

**Parameters**:

- `sandbox` _Sandbox \| string_

**Returns**:

- `Promise<void>`

#### updateNetworkPolicy()

```ts
updateNetworkPolicy(
   sandbox: Sandbox | string,
   networkPolicy: NetworkPolicyInput,
   options: { ifMatch: string }): Promise<NetworkPolicyInfo>;
```

**Parameters**:

- `sandbox` _Sandbox \| string_
- `networkPolicy` _NetworkPolicyInput_
- `options` _\{ ifMatch: string \}_

**Returns**:

- `Promise<NetworkPolicyInfo>`

***

## idempotencyKeyForName

```ts
function idempotencyKeyForName(name: string): Promise<string>;
```

The idempotency key `create*({ name })` derives when none is given.

`'name:' + name` when that is a key the API accepts verbatim — printable
ASCII (`0x20`–`0x7E`), no surrounding whitespace (the API trims keys and
HTTP strips header padding, so a padded name would not round-trip), at most
256 characters in total — else `'name:sha256:' + hex(sha256(name))` over the
UTF-8 bytes. The `name:` namespace keeps a derived key from ever colliding
with a caller's explicit key of the same spelling. Deterministic and
identical in the Python SDK: use it to recover or inspect the key behind
a named create made with either SDK.

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
  /** v2 only. */
  readonly requestTimeout?: number
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
`requestTimeout`, `otelApi`, `connectionPoolMaxsize`, `sharedHub` and `events`
are v2-only.

**Properties**:

- `apiKey?` _string_
- `jwtToken?` _string_
- `organizationId?` _string_ - v0 only: scopes a JWT to an organization.
- `target?` _string_ - The v0 client's default region (`v2` takes a per-create `region`).
- `projectId?` _string_ - v2 only: scopes a JWT to a project.
- `requestTimeout?` _number_ - v2 only.
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

## SnapshotKind

```ts
type SnapshotKind = (typeof API_SNAPSHOT_KINDS)[number] | 'unknown'
```

***

## SnapshotRef

**Properties**:

- `id` _string_
- `name` _string \| null_

***

## CreateRequestBaseOptions

**Properties**:

- `name?` _string_
- `labels?` _Record\<string, string\>_
- `ports?` _PortMapping\[\]_
- `lifecyclePolicy?` _LifecyclePolicyOptions \| null_ - `null` is accepted and means "no policy", exactly like omitting the key —
  a JSON config round-trip produces it, and the Python SDK's `None` (the same
  argument in the same position) already reads that way.
- `cpuArch?` _CpuArch_
- `cpuType?` _string_
- `region?` _string_ - Region selector for this create request.
- `waitSeconds?` _number_
- `createTimeoutSeconds?` _number_
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
- `labels?` _Record\<string, string\>_
- `ports?` _PortMapping\[\]_
- `lifecyclePolicy?` _LifecyclePolicyOptions \| null_ - `null` is accepted and means "no policy", exactly like omitting the key —
  a JSON config round-trip produces it, and the Python SDK's `None` (the same
  argument in the same position) already reads that way.
- `cpuArch?` _CpuArch_
- `cpuType?` _string_
- `region?` _string_ - Region selector for this create request.
- `waitSeconds?` _number_
- `createTimeoutSeconds?` _number_
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
- `volumes?` _VolumeMount\[\]_
- `env?` _Record\<string, string\>_
- `envVars?` _Record\<string, string\>_
- `resources?` _Resources_
- `cpu?` _number_
- `memory?` _number_
- `disk?` _number_
- `secrets?` _string\[\]_
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
- `labels?` _Record\<string, string\>_
- `ports?` _PortMapping\[\]_
- `lifecyclePolicy?` _LifecyclePolicyOptions \| null_ - `null` is accepted and means "no policy", exactly like omitting the key —
  a JSON config round-trip produces it, and the Python SDK's `None` (the same
  argument in the same position) already reads that way.
- `cpuArch?` _CpuArch_
- `cpuType?` _string_
- `region?` _string_ - Region selector for this create request.
- `waitSeconds?` _number_
- `createTimeoutSeconds?` _number_
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
  Without one, a handle with a project API key mints and refreshes
  short-lived sandbox access tokens transparently.
- `autoDelete?` _boolean_ - Auto-delete when disposed with `await using`; defaults to false.

***

## ListResult

**Properties**:

- `items` _T\[\]_
- `nextCursor?` _string_
- `total?` _number_ - Only set for search results (`Daytona.list()` with a search filter).
- `totalRelation?` _SearchTotalRelation_ - `'eq'` when `total` is exact, `'gte'` when it is a lower bound; only set with `total`.
- `rawTotalRelation?` _string_

***

## NetworkPolicyInput

**Properties**:

- `blockAll?` _boolean \| null_
- `allowCidrs?` _string\[\]_
- `allowDomains?` _string\[\] \| null_

***

## NetworkPolicy

**Properties**:

- `version` _number_
- `blockAll` _boolean_
- `allowCidrs` _string\[\]_
- `allowDomains` _string\[\] \| null_

***

## NetworkPolicyInfo

**Properties**:

- `desired?` _NetworkPolicy_
- `desiredRevision` _number_
- `etag` _string_
- `httpStatus` _number_
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

## CpuTypeInfo

**Properties**:

- `id` _string_
- `name` _string_
- `cpuArch` _CpuArch_

***

## AuditActionList

```ts
type AuditActionList = api.AuditActionList
```

***

## AuditActionGroup

```ts
type AuditActionGroup = api.AuditActionGroup
```

***

## ProjectApiKeyWithContext

```ts
type ProjectApiKeyWithContext = api.ProjectApiKeyWithContext
```

***

## ProjectBudget

```ts
type ProjectBudget = api.ProjectBudget
```

***

## SnapshotDetail

```ts
type SnapshotDetail = api.Snapshot
```

`GET /snapshots/{id}` details.

***

## ListSandboxesOptions

Every `Daytona.list()` option. `cursor`/`limit` alone read `GET /sandboxes`;
`id`/`name` and any inherited search filter route the call to
`/sandboxes/search`.

**Properties**:

- `q?` _string_ - Free text over name and image; also an exact match when it is a sandbox id.
- `status?` _string \| readonly string\[\]_ - A single value or a list (any-of) over the API's lifecycle state names (`running`, `stopped`, ...).
- `sandboxClass?` _SandboxClass \| readonly SandboxClass\[\]_ - A single value or a list (any-of).
- `region?` _string \| readonly string\[\]_ - A single value or a list (any-of) over region slugs.
- `imageRef?` _string_
- `imageRefPrefix?` _string_
- `labels?` _Record\<string, string\>_ - Containment: every listed label must match.
- `spot?` _boolean_
- `forkedFrom?` _string_ - Sandboxes forked from this sandbox id.
- `minCores?` _number_ - Inclusive bounds on `cores_max` (the CPU limit), in cores (1 core = 2 vCPUs).
- `maxCores?` _number_
- `minMemoryMib?` _number_
- `maxMemoryMib?` _number_
- `minDiskMib?` _number_
- `maxDiskMib?` _number_
- `createdStartAt?` _SearchTimestamp_
- `createdEndAt?` _SearchTimestamp_
- `updatedStartAt?` _SearchTimestamp_
- `updatedEndAt?` _SearchTimestamp_
- `lastActivityStartAt?` _SearchTimestamp_
- `lastActivityEndAt?` _SearchTimestamp_
- `sort?` _SearchSort_ - Defaults to `created_at`.
- `order?` _SearchOrder_ - Defaults to `desc`.
- `cursor?` _string_
- `limit?` _number_
- `id?` _string_ - Prefix on the id.
- `name?` _string_ - Prefix on the name.

***

## ListSandboxesQuery

```ts
type ListSandboxesQuery = ListSandboxesOptions
```

***

## CreateMacosSandboxOptions

Options for a macOS create (`POST /sandboxes/macos`). `cpu`, `memory` and
`disk` size the sandbox; omitted values use the API defaults.
CPU selectors do not apply.

**Extends**: `Omit<CreateRequestBaseOptions, 'cpuArch' | 'cpuType'>`

**Properties**:

- `volumes?` _VolumeMount\[\]_ - Read-write disk volumes. Cannot be combined with `persistent: true`.
- `env?` _Record\<string, string\>_
- `envVars?` _Record\<string, string\>_
- `secrets?` _string\[\]_ - Project secret names to attach, as on `create`. Values are write-only and
  restricted to each secret's allowed domains. Needs `read:secrets` permission.
- `cpu?` _number_ - CPU cores, at least 4; sent as `cores`. Omitted uses the API default.
- `memory?` _number_ - Memory in GiB, at least 4; sent as memory_mib. memory * 1024 must be an integer. Omitted uses the API default.
- `disk?` _number_ - Disk in GiB, at least 80, including macOS; sent as disk_mib. disk * 1024 must be an integer. Omitted uses the API default.
- `persistent?` _boolean_ - Preserve the sandbox's disk when stopped. Start or resume to continue;
  delete to remove it. At reservation end, the disk is saved as an anonymous
  image that can be used to create another sandbox.
- `reservation?` _'new' \| (string & \{\})_ - Which Mac reservation the sandbox runs on. Omitted: any fitting reservation of the
  organization in the region; when none fits and the organization's
  auto-reserve setting allows it, the server buys a reservation. `'new'`: buy a
  reservation of the cheapest model that fits. Any other value is a reservation
  id as `reservations.list()` returns it.
  A reservation ID selects that reservation. Acceptance does not guarantee
  immediate capacity; the sandbox can wait for room or time out.
- `autoRenew?` _boolean_ - Only with `reservation: 'new'`: whether the bought reservation renews itself
  each period. The server defaults it to the organization's auto-reserve
  setting. Rejected before posting otherwise.
- `networkPolicy?` _NetworkPolicyInput \| null_ - Network policy, as on `create`, effective from the sandbox's first boot.
  Change it later with `sandbox.updateNetworkPolicy`.

***

## OrganizationLimits

```ts
type OrganizationLimits = api.OrganizationLimits
```

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

The default Daytona Cloud v2 API, used when neither `DAYTONA_V2_API_URL` nor
`DAYTONA_API_URL` is set. These variables can select a regional API endpoint.

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

## NAME\_LABEL

```ts
const NAME_LABEL = 'name'
```

The label every `create*({ name })` stamps with the name:
`labels == { name, … }`. `Daytona.findByName` reads it back.

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
