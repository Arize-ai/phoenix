# Errors (TypeScript SDK reference)

## Contents

- [DaytonaError](#daytonaerror)
- [FeatureNotEnabledError](#featurenotenablederror)
- [ImageTooLargeError](#imagetoolargeerror)
- [BadRequestError](#badrequesterror)
- [BillingDisabledError](#billingdisablederror)
- [BillingUnreachableError](#billingunreachableerror)
- [BillingUnavailableError](#billingunavailableerror)
- [BillingNotProvisionedError](#billingnotprovisionederror)
- [BillingAccountConflictError](#billingaccountconflicterror)
- [ChargeNotFoundError](#chargenotfounderror)
- [ChargeNotSucceededError](#chargenotsucceedederror)
- [CouponAlreadyRedeemedError](#couponalreadyredeemederror)
- [CouponExpiredError](#couponexpirederror)
- [CouponLimitReachedError](#couponlimitreachederror)
- [CouponNotFoundError](#couponnotfounderror)
- [InvoiceNotFinalizedError](#invoicenotfinalizederror)
- [InvoiceNotFoundError](#invoicenotfounderror)
- [InvoiceNotPayableError](#invoicenotpayableerror)
- [AutomaticTopUpNotAvailableError](#automatictopupnotavailableerror)
- [PaymentMethodRequiredError](#paymentmethodrequirederror)
- [PlanChangePendingError](#planchangependingerror)
- [PlanManagedByOperatorError](#planmanagedbyoperatorerror)
- [PlanRequiresSalesError](#planrequiressaleserror)
- [PlanUnchangedError](#planunchangederror)
- [UnknownPlanError](#unknownplanerror)
- [BucketCreateFailedError](#bucketcreatefailederror)
- [BucketDeleteFailedError](#bucketdeletefailederror)
- [BucketNotEmptyError](#bucketnotemptyerror)
- [OriginImportOnlyError](#originimportonlyerror)
- [ReadOnlyUnsupportedError](#readonlyunsupportederror)
- [UnsupportedVolumeTypeError](#unsupportedvolumetypeerror)
- [AuthenticationError](#authenticationerror)
- [ForbiddenError](#forbiddenerror)
- [NotFoundError](#notfounderror)
- [RequestTimeoutError](#requesttimeouterror)
- [SandboxCreateConnectionError](#sandboxcreateconnectionerror)
- [SandboxCreateRequestTimeoutError](#sandboxcreaterequesttimeouterror)
- [SandboxTerminalStateError](#sandboxterminalstateerror)
- [DockerNotReadyError](#dockernotreadyerror)
- [DockerWaitTimeoutError](#dockerwaittimeouterror)
- [ConflictError](#conflicterror)
- [PreconditionFailedError](#preconditionfailederror)
- [GoneError](#goneerror)
- [PayloadTooLargeError](#payloadtoolargeerror)
- [UnsupportedMediaTypeError](#unsupportedmediatypeerror)
- [UnprocessableEntityError](#unprocessableentityerror)
- [MethodNotAllowedError](#methodnotallowederror)
- [ServiceUnavailableError](#serviceunavailableerror)
- [InternalServerError](#internalservererror)
- [RateLimitError](#ratelimiterror)
- [LimitExceededError](#limitexceedederror)
- [PreconditionRequiredError](#preconditionrequirederror)
- [ConnectionError](#connectionerror)
- [ClientClosedError](#clientclosederror)
- [ClientTimeoutError](#clienttimeouterror)
- [NotSupportedError](#notsupportederror)
- [ProcessNotFoundError](#processnotfounderror)
- [ProcessStartFailedError](#processstartfailederror)
- [ProcessTerminalError](#processterminalerror)
- [ProcessExecutionTimeoutError](#processexecutiontimeouterror)
- [ProcessKillIncompleteError](#processkillincompleteerror)
- [NameConflictError](#nameconflicterror)
- [NotSupportedForClassError](#notsupportedforclasserror)
- [OrgSuspendedError](#orgsuspendederror)
- [ProjectBudgetExceededError](#projectbudgetexceedederror)
- [OverloadedError](#overloadederror)
- [InvalidCursorError](#invalidcursorerror)
- [CursorExpiredError](#cursorexpirederror)
- [StdinClosedError](#stdinclosederror)
- [StdinUnavailableError](#stdinunavailableerror)
- [ProtectedProcessError](#protectedprocesserror)
- [UnsupportedOperationError](#unsupportedoperationerror)
- [SessionNotFoundError](#sessionnotfounderror)
- [SessionEndedError](#sessionendederror)
- [SearchNotConfiguredError](#searchnotconfigurederror)
- [SearchUnavailableError](#searchunavailableerror)
- [SecretAlreadyExistsError](#secretalreadyexistserror)
- [SnapshotTooLargeError](#snapshottoolargeerror)
- [SandboxNotRunningError](#sandboxnotrunningerror)
- [KernelUnavailableError](#kernelunavailableerror)
- [AddonUnavailableError](#addonunavailableerror)
- [FileNotFoundError](#filenotfounderror)
- [InvalidFilePathError](#invalidfilepatherror)
- [FileAccessDeniedError](#fileaccessdeniederror)
- [FileReadFailedError](#filereadfailederror)
- [AtomicUploadUnsupportedError](#atomicuploadunsupportederror)
- [GitAuthFailedError](#gitauthfailederror)
- [GitRepoNotFoundError](#gitreponotfounderror)
- [GitBranchNotFoundError](#gitbranchnotfounderror)
- [GitBranchExistsError](#gitbranchexistserror)
- [DesktopNotReadyError](#desktopnotreadyerror)
- [ImageNotFoundError](#imagenotfounderror)
- [ImageNotReadyError](#imagenotreadyerror)
- [ImageFormatOutdatedError](#imageformatoutdatederror)
- [ImageBuildFailedError](#imagebuildfailederror)
- [ImageClassMismatchError](#imageclassmismatcherror)
- [ImageNameTakenError](#imagenametakenerror)
- [ImageNameReservedError](#imagenamereservederror)
- [IdleOutOfRangeError](#idleoutofrangeerror)
- [CreateTtlOutOfRangeError](#createttloutofrangeerror)
- [SnapshotNotFoundError](#snapshotnotfounderror)
- [SnapshotNotReadyError](#snapshotnotreadyerror)
- [SnapshotClassMismatchError](#snapshotclassmismatcherror)
- [TransferCancelledError](#transfercancellederror)
- [BuildLogInterruptedError](#buildloginterruptederror)
- [ErrorOptions](#erroroptions)
- [ImageBuildFailedErrorOptions](#imagebuildfailederroroptions)
- [SandboxTerminalStateErrorOptions](#sandboxterminalstateerroroptions)

## DaytonaError

Base class of every v2 error.

`code` and `source` are open vocabularies: the server may send a code or
source this SDK release does not know yet. An unknown code keeps its exact
value on `code` and the error falls back to the class for its HTTP status
(`NotFoundError` for a 404, ...). `codes` (from `@daytona/sdk/v2`) lists the
codes this release knows.

**Properties**:

- `statusCode?` _number_
- `code?` _ErrorCode \| (string & \{\})_
- `source?` _string_
- `traceId?` _string_
- `retryAfterSeconds?` _number_
- `feature?` _string_
- `entitlement?` _string_
- `replacement?` _string_
- `firstAvailableCursor?` _string_
- `stated?` _string_
- `actual?` _string_
- `region?` _string_
- `limit?` _string_
- `current?` _number_
- `max?` _number_
- `maxBytes?` _number_
- `bytes?` _number_
- `requestId?` _string_
- `retryAfterMs?` _number_
- `cause?` _unknown_

### Constructors

#### Constructor

```ts
new DaytonaError(message: string, options?: ErrorOptions): DaytonaError;
```

**Parameters**:

- `message` _string_
- `options?` _ErrorOptions_

**Returns**:

- `DaytonaError`

### Methods

#### \[Symbol.hasInstance\]()

```ts
[Symbol.hasInstance](value: unknown): boolean;
```

Native prototype check, or a match against the same class of another
loaded copy of this module (ESM and CJS builds of `@daytona/sdk/v2` in one
process): see `registerV2ErrorClass`. User subclasses have no key and
keep the native check only.

**Parameters**:

- `value` _unknown_

**Returns**:

- `boolean`

***

## FeatureNotEnabledError

***

## ImageTooLargeError

`IMAGE_TOO_LARGE` (409): `maxBytes` is the limit, `bytes` the image's size.

***

## BadRequestError

***

## BillingDisabledError

***

## BillingUnreachableError

***

## BillingUnavailableError

***

## BillingNotProvisionedError

***

## BillingAccountConflictError

***

## ChargeNotFoundError

***

## ChargeNotSucceededError

***

## CouponAlreadyRedeemedError

***

## CouponExpiredError

***

## CouponLimitReachedError

***

## CouponNotFoundError

***

## InvoiceNotFinalizedError

***

## InvoiceNotFoundError

***

## InvoiceNotPayableError

***

## AutomaticTopUpNotAvailableError

***

## PaymentMethodRequiredError

***

## PlanChangePendingError

***

## PlanManagedByOperatorError

***

## PlanRequiresSalesError

***

## PlanUnchangedError

***

## UnknownPlanError

***

## BucketCreateFailedError

***

## BucketDeleteFailedError

***

## BucketNotEmptyError

***

## OriginImportOnlyError

***

## ReadOnlyUnsupportedError

***

## UnsupportedVolumeTypeError

***

## AuthenticationError

***

## ForbiddenError

***

## NotFoundError

***

## RequestTimeoutError

***

## SandboxCreateConnectionError

The connection failed while the `create()` request was in flight. Same
outcome as `SandboxCreateRequestTimeoutError`: the sandbox may or may
not exist; retry `create()` with the same `idempotencyKey` and create options,
in the same project and API endpoint.

**Properties**:

- `idempotencyKey` _string_

### Constructors

#### Constructor

```ts
new SandboxCreateConnectionError(
   idempotencyKey: string,
   detail: string): SandboxCreateConnectionError;
```

**Parameters**:

- `idempotencyKey` _string_
- `detail` _string_

**Returns**:

- `SandboxCreateConnectionError`

***

## SandboxCreateRequestTimeoutError

The `create()` request itself timed out before the server answered. The
server may still have created the sandbox. `idempotencyKey` is the key the
request was sent with. Retry with that key and identical create options, in
the same project and API endpoint, to recover the sandbox (or create
it if the first request never landed). Always reuse the original create options.

**Properties**:

- `idempotencyKey` _string_

### Constructors

#### Constructor

```ts
new SandboxCreateRequestTimeoutError(
   idempotencyKey: string): SandboxCreateRequestTimeoutError;
```

**Parameters**:

- `idempotencyKey` _string_

**Returns**:

- `SandboxCreateRequestTimeoutError`

***

## SandboxTerminalStateError

A lifecycle wait (`wait()`, `start()`, `stop()`, ...) saw the sandbox reach a terminal state first.
`state` is the observed public sandbox state (e.g. `'destroyed'`).

**Properties**:

- `state` _SandboxState_
- `rawState?` _string_
- `reason?` _string_ - The server's explanation of `state`, when it gave one (for example why a
  deletion did not finish); the message ends with it.

### Constructors

#### Constructor

```ts
new SandboxTerminalStateError(
   sandboxId: string,
   state: SandboxState,
   options?: SandboxTerminalStateErrorOptions): SandboxTerminalStateError;
```

**Parameters**:

- `sandboxId` _string_
- `state` _SandboxState_
- `options?` _SandboxTerminalStateErrorOptions_

**Returns**:

- `SandboxTerminalStateError`

***

## DockerNotReadyError

`sandbox.docker.waitUntilReady()` saw Docker Engine settle in a state that
will not become `ready` in this boot (`failed`, `not_present`, `disabled`,
`unmanaged`, `unsupported`). `status` is the observed Docker status; its
`reason` says why, and `processId` (when set) names the process whose logs
hold Docker's output. The sandbox itself stays usable.

**Properties**:

- `status` _DockerStatus_

### Constructors

#### Constructor

```ts
new DockerNotReadyError(status: DockerStatus): DockerNotReadyError;
```

**Parameters**:

- `status` _DockerStatus_

**Returns**:

- `DockerNotReadyError`

***

## DockerWaitTimeoutError

`sandbox.docker.waitUntilReady()` ran out of caller budget before Docker
Engine became `ready`. `status` is the last observed Docker status
(`starting`, or `deferred` while the boot has not started Docker yet), or
undefined when no status answer arrived before the deadline (for example a
stalled first request).

**Properties**:

- `status?` _DockerStatus_

### Constructors

#### Constructor

```ts
new DockerWaitTimeoutError(status?: DockerStatus): DockerWaitTimeoutError;
```

**Parameters**:

- `status?` _DockerStatus_

**Returns**:

- `DockerWaitTimeoutError`

***

## ConflictError

***

## PreconditionFailedError

***

## GoneError

***

## PayloadTooLargeError

***

## UnsupportedMediaTypeError

***

## UnprocessableEntityError

***

## MethodNotAllowedError

***

## ServiceUnavailableError

***

## InternalServerError

***

## RateLimitError

HTTP 429. `RATE_LIMITED` and `TOO_MANY_REQUESTS` throw this class itself
(read `code` to tell them apart); `LIMIT_EXCEEDED` and `OVERLOADED` throw its
subclasses.

***

## LimitExceededError

`LIMIT_EXCEEDED` (429): an organization limit is exhausted.
Subclasses `RateLimitError`, so `catch`/`instanceof RateLimitError` keeps
matching; `limit` is the limit's stable machine name (e.g. `max_concurrent_sandboxes`)
and `current`/`max` are the counts the refusal was computed from.
Fields are `undefined` when a body omits or malforms them.

### Constructors

#### Constructor

```ts
new LimitExceededError(message: string, options?: ErrorOptions): LimitExceededError;
```

`code` defaults to `LIMIT_EXCEEDED`.

**Parameters**:

- `message` _string_
- `options?` _ErrorOptions_

**Returns**:

- `LimitExceededError`

***

## PreconditionRequiredError

***

## ConnectionError

The API or the sandbox could not be reached (no HTTP response). `source`
defaults to `SDK`; there is no status or code.

### Constructors

#### Constructor

```ts
new ConnectionError(message: string, options?: ErrorOptions): ConnectionError;
```

**Parameters**:

- `message` _string_
- `options?` _ErrorOptions_

**Returns**:

- `ConnectionError`

***

## ClientClosedError

A new request on a closed client; no HTTP status applies.

### Constructors

#### Constructor

```ts
new ClientClosedError(
   message = 'Daytona client is closed',
   options?: ErrorOptions): ClientClosedError;
```

**Parameters**:

- `message` _string = 'Daytona client is closed'_
- `options?` _ErrorOptions_

**Returns**:

- `ClientClosedError`

***

## ClientTimeoutError

The client gave up waiting for a response: its request timeout or a call's
own deadline expired. Not the server's HTTP 408 (`RequestTimeoutError`).
Defaults: message `'operation timed out'`, `statusCode` 408, `code`
`REQUEST_TIMEOUT`, `source` `SDK` (the same in the Python SDK).

### Constructors

#### Constructor

```ts
new ClientTimeoutError(
   message = 'operation timed out',
   options?: ErrorOptions): ClientTimeoutError;
```

**Parameters**:

- `message` _string = 'operation timed out'_
- `options?` _ErrorOptions_

**Returns**:

- `ClientTimeoutError`

***

## NotSupportedError

***

## ProcessNotFoundError

***

## ProcessStartFailedError

***

## ProcessTerminalError

***

## ProcessExecutionTimeoutError

***

## ProcessKillIncompleteError

***

## NameConflictError

***

## NotSupportedForClassError

***

## OrgSuspendedError

***

## ProjectBudgetExceededError

PROJECT_BUDGET_EXCEEDED (402): the project reached its monthly budget. New
sandboxes cannot start in it until the budget is raised or removed, or the
next calendar month (UTC) begins.

***

## OverloadedError

***

## InvalidCursorError

***

## CursorExpiredError

***

## StdinClosedError

***

## StdinUnavailableError

***

## ProtectedProcessError

***

## UnsupportedOperationError

***

## SessionNotFoundError

***

## SessionEndedError

***

## SearchNotConfiguredError

***

## SearchUnavailableError

***

## SecretAlreadyExistsError

***

## SnapshotTooLargeError

`SNAPSHOT_TOO_LARGE` (409): `maxBytes` is the limit, `bytes` the snapshot's size.

***

## SandboxNotRunningError

`SANDBOX_NOT_RUNNING` (409, source `DAYTONA_PROXY`): a toolbox call (process,
files, git, …) or a preview URL request reached a sandbox that is not
running, such as a stopped one. Start the sandbox and retry. Not a
`NotFoundError`: the sandbox exists.

***

## KernelUnavailableError

***

## AddonUnavailableError

***

## FileNotFoundError

***

## InvalidFilePathError

***

## FileAccessDeniedError

***

## FileReadFailedError

***

## AtomicUploadUnsupportedError

***

## GitAuthFailedError

***

## GitRepoNotFoundError

***

## GitBranchNotFoundError

***

## GitBranchExistsError

***

## DesktopNotReadyError

***

## ImageNotFoundError

***

## ImageNotReadyError

***

## ImageFormatOutdatedError

`IMAGE_FORMAT_OUTDATED` (409): the image is stored in an older format than
the current one (`Image.formatOutdated`) and requires conversion.
Convert it with `POST /images/{id}/convert`, or create a Linux sandbox from
it, which converts it first.

***

## ImageBuildFailedError

`IMAGE_BUILD_FAILED` (409), or the SDK's own refusal when
`createFromBuild()`'s image build ends `failed`. `imageId` names the failed
image (so its build log can be fetched) when the SDK knows it; `buildError`
is the build's recorded error, when the image has one. It is separate from
`message`, which is always set.

**Properties**:

- `imageId?` _string_
- `buildError?` _string_

### Constructors

#### Constructor

```ts
new ImageBuildFailedError(
   message: string,
   options?: ImageBuildFailedErrorOptions): ImageBuildFailedError;
```

**Parameters**:

- `message` _string_
- `options?` _ImageBuildFailedErrorOptions_

**Returns**:

- `ImageBuildFailedError`

***

## ImageClassMismatchError

***

## ImageNameTakenError

***

## ImageNameReservedError

***

## IdleOutOfRangeError

`IDLE_OUT_OF_RANGE` (400): `max` is the server's ceiling.

***

## CreateTtlOutOfRangeError

`CREATE_TTL_OUT_OF_RANGE` (400): `max` is the server's ceiling.

***

## SnapshotNotFoundError

***

## SnapshotNotReadyError

***

## SnapshotClassMismatchError

***

## TransferCancelledError

A local file transfer was cancelled before completion. Defaults: message
`'file transfer cancelled'`, `statusCode` 499, `code` `REQUEST_CANCELLED`,
`source` `SDK`.

### Constructors

#### Constructor

```ts
new TransferCancelledError(
   message = 'file transfer cancelled',
   options?: ErrorOptions): TransferCancelledError;
```

**Parameters**:

- `message` _string = 'file transfer cancelled'_
- `options?` _ErrorOptions_

**Returns**:

- `TransferCancelledError`

***

## BuildLogInterruptedError

Observation failed; `cursor` is the last successfully delivered checkpoint.
`code` defaults to `BUILD_LOG_INTERRUPTED` and `source` to `SDK`.

**Properties**:

- `cursor?` _string_

### Constructors

#### Constructor

```ts
new BuildLogInterruptedError(
   message: string,
   options?: BuildLogInterruptedErrorOptions): BuildLogInterruptedError;
```

**Parameters**:

- `message` _string_
- `options?` _BuildLogInterruptedErrorOptions_

**Returns**:

- `BuildLogInterruptedError`

***

## ErrorOptions

What every error constructor accepts besides its message. Every field is
optional; an error built by the caller carries only what it is given.
`code` and `source` are open vocabularies (see `DaytonaError`).

**Properties**:

- `statusCode?` _number_
- `code?` _ErrorCode \| (string & \{\})_
- `source?` _string_
- `traceId?` _string_
- `retryAfterSeconds?` _number_ - `OVERLOADED` / `RATE_LIMITED`: how long to wait before retrying.
- `feature?` _string_ - `FEATURE_NOT_ENABLED`: the feature the organization lacks.
- `entitlement?` _string_ - `ENTITLEMENT_REQUIRED`: the entitlement the organization lacks.
- `replacement?` _string_ - `GONE`: what replaces the removed resource or route.
- `firstAvailableCursor?` _string_ - `CURSOR_EXPIRED`: the oldest cursor still available.
- `stated?` _string_ - `REGION_MISMATCH`: the region the request stated.
- `actual?` _string_ - `REGION_MISMATCH`: the region actually in effect.
- `region?` _string_ - `UNKNOWN_REGION`: the unrecognized region.
- `limit?` _string_ - `LIMIT_EXCEEDED`: machine name of the exhausted organization limit.
- `current?` _number_ - `LIMIT_EXCEEDED`: the organization's current count for that limit.
- `max?` _number_ - `LIMIT_EXCEEDED`, `IDLE_OUT_OF_RANGE`, `CREATE_TTL_OUT_OF_RANGE`: the maximum.
- `maxBytes?` _number_ - `IMAGE_TOO_LARGE` / `SNAPSHOT_TOO_LARGE`: the size limit in bytes.
- `bytes?` _number_ - `IMAGE_TOO_LARGE` / `SNAPSHOT_TOO_LARGE`: the artifact's size in bytes.
- `requestId?` _string_
- `retryAfterMs?` _number_
- `cause?` _unknown_ - The underlying failure, when there is one.

***

## ImageBuildFailedErrorOptions

`ImageBuildFailedError`'s options: the common ones plus the failed image.

**Properties**:

- `statusCode?` _number_
- `code?` _ErrorCode \| (string & \{\})_
- `source?` _string_
- `traceId?` _string_
- `retryAfterSeconds?` _number_ - `OVERLOADED` / `RATE_LIMITED`: how long to wait before retrying.
- `feature?` _string_ - `FEATURE_NOT_ENABLED`: the feature the organization lacks.
- `entitlement?` _string_ - `ENTITLEMENT_REQUIRED`: the entitlement the organization lacks.
- `replacement?` _string_ - `GONE`: what replaces the removed resource or route.
- `firstAvailableCursor?` _string_ - `CURSOR_EXPIRED`: the oldest cursor still available.
- `stated?` _string_ - `REGION_MISMATCH`: the region the request stated.
- `actual?` _string_ - `REGION_MISMATCH`: the region actually in effect.
- `region?` _string_ - `UNKNOWN_REGION`: the unrecognized region.
- `limit?` _string_ - `LIMIT_EXCEEDED`: machine name of the exhausted organization limit.
- `current?` _number_ - `LIMIT_EXCEEDED`: the organization's current count for that limit.
- `max?` _number_ - `LIMIT_EXCEEDED`, `IDLE_OUT_OF_RANGE`, `CREATE_TTL_OUT_OF_RANGE`: the maximum.
- `maxBytes?` _number_ - `IMAGE_TOO_LARGE` / `SNAPSHOT_TOO_LARGE`: the size limit in bytes.
- `bytes?` _number_ - `IMAGE_TOO_LARGE` / `SNAPSHOT_TOO_LARGE`: the artifact's size in bytes.
- `requestId?` _string_
- `retryAfterMs?` _number_
- `cause?` _unknown_ - The underlying failure, when there is one.
- `imageId?` _string_
- `buildError?` _string_

***

## SandboxTerminalStateErrorOptions

Options of `SandboxTerminalStateError` beyond its sandbox id and state.

**Properties**:

- `rawState?` _string_ - The state string the server sent, when it differs from the public `state`.
- `reason?` _string_ - The server's explanation of the state (for example why a deletion did not finish).
