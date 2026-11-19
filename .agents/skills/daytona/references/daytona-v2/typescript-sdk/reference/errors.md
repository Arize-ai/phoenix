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
- [AuthorizationError](#authorizationerror)
- [NotFoundError](#notfounderror)
- [RequestTimeoutError](#requesttimeouterror)
- [SandboxCreateConnectionError](#sandboxcreateconnectionerror)
- [SandboxCreateRequestTimeoutError](#sandboxcreaterequesttimeouterror)
- [SandboxCreateTimeoutError](#sandboxcreatetimeouterror)
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
- [TimeoutError](#timeouterror)
- [NotSupportedError](#notsupportederror)
- [ProcessNotFoundError](#processnotfounderror)
- [ProcessStartFailedError](#processstartfailederror)
- [ProcessTerminalError](#processterminalerror)
- [ProcessExecutionTimeoutError](#processexecutiontimeouterror)
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
- [RateLimitedError](#ratelimitederror)
- [UnsupportedOperationError](#unsupportedoperationerror)
- [SessionNotFoundError](#sessionnotfounderror)
- [SessionEndedError](#sessionendederror)
- [SearchNotConfiguredError](#searchnotconfigurederror)
- [SearchUnavailableError](#searchunavailableerror)
- [SecretAlreadyExistsError](#secretalreadyexistserror)
- [SnapshotTooLargeError](#snapshottoolargeerror)
- [SandboxNotRunningError](#sandboxnotrunningerror)
- [KernelUnavailableError](#kernelunavailableerror)
- [LspNotStartedError](#lspnotstartederror)
- [LspServerUnavailableError](#lspserverunavailableerror)
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
- [isKnownErrorCode](#isknownerrorcode)
- [ApiErrorCode](#apierrorcode)
- [DaemonErrorCode](#daemonerrorcode)
- [GenericErrorCode](#genericerrorcode)
- [ProxyErrorCode](#proxyerrorcode)
- [RouterErrorCode](#routererrorcode)
- [ErrorCode](#errorcode)
- [API\_ERROR\_CODES](#apierrorcodes)
- [DAEMON\_ERROR\_CODES](#daemonerrorcodes)
- [GENERIC\_ERROR\_CODES](#genericerrorcodes)
- [PROXY\_ERROR\_CODES](#proxyerrorcodes)
- [ROUTER\_ERROR\_CODES](#routererrorcodes)
- [CODE\_STATUS](#codestatus)
- [API\_CODE\_EXTRAS](#apicodeextras)
- [DAEMON\_CODE\_EXTRAS](#daemoncodeextras)
- [PROXY\_CODE\_EXTRAS](#proxycodeextras)
- [ROUTER\_CODE\_EXTRAS](#routercodeextras)
- [DaytonaNotFoundError](#daytonanotfounderror)
- [DaytonaAuthenticationError](#daytonaauthenticationerror)
- [DaytonaAuthorizationError](#daytonaauthorizationerror)
- [DaytonaConflictError](#daytonaconflicterror)
- [DaytonaValidationError](#daytonavalidationerror)
- [DaytonaRateLimitError](#daytonaratelimiterror)
- [DaytonaTimeoutError](#daytonatimeouterror)
- [DaytonaConnectionError](#daytonaconnectionerror)
- [DaytonaNotSupportedError](#daytonanotsupportederror)

## DaytonaError

**Properties**:

- `statusCode?` _number_
- `code?` _ErrorCode \| string_
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
- `errorCode?` _string_
- `requestId?` _string_
- `retryAfterMs?` _number_

### Constructors

#### Constructor

```ts
new DaytonaError(
   message: string,
   statusCode?: number,
   code?: string,
   source?: string,
   envelope?: ErrorEnvelope): DaytonaError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `code?` _string_
- `source?` _string_
- `envelope?` _ErrorEnvelope_

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

## AuthorizationError

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

## SandboxCreateTimeoutError

`create()` ran out of caller budget while the sandbox was still starting.
The sandbox was created and is left running; `sandboxId` lets the caller
pick it up (`daytona.get(sandboxId)`) or delete it.

**Properties**:

- `sandboxId` _string_

### Constructors

#### Constructor

```ts
new SandboxCreateTimeoutError(sandboxId: string): SandboxCreateTimeoutError;
```

**Parameters**:

- `sandboxId` _string_

**Returns**:

- `SandboxCreateTimeoutError`

***

## SandboxTerminalStateError

`waitForState()` saw the sandbox reach a terminal state before any target.
`state` is the observed public sandbox state (e.g. `'destroyed'`).

**Properties**:

- `state` _SandboxState_
- `rawState?` _string_

### Constructors

#### Constructor

```ts
new SandboxTerminalStateError(
   sandboxId: string,
   state: SandboxState,
   rawState?: string): SandboxTerminalStateError;
```

**Parameters**:

- `sandboxId` _string_
- `state` _SandboxState_
- `rawState?` _string_

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
new DockerWaitTimeoutError(status: DockerStatus | undefined): DockerWaitTimeoutError;
```

**Parameters**:

- `status` _DockerStatus \| undefined_

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

***

## LimitExceededError

`LIMIT_EXCEEDED` (429): an organization limit is exhausted.
Subclasses `RateLimitError`, so `catch`/`instanceof RateLimitError` keeps
matching; `limit` is the limit's stable machine name (e.g. `max_concurrent_sandboxes`)
and `current`/`max` are the counts the refusal was computed from.
Fields are `undefined` when a body omits or malforms them.

**Properties**:

- `limit?` _string_
- `current?` _number_
- `max?` _number_

### Constructors

#### Constructor

```ts
new LimitExceededError(
   message: string,
   statusCode?: number,
   code?: string,
   source?: string,
   envelope?: ErrorEnvelope): LimitExceededError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `code?` _string_
- `source?` _string_
- `envelope?` _ErrorEnvelope_

**Returns**:

- `LimitExceededError`

***

## PreconditionRequiredError

***

## ConnectionError

***

## TimeoutError

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

## RateLimitedError

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

***

## SandboxNotRunningError

***

## KernelUnavailableError

***

## LspNotStartedError

***

## LspServerUnavailableError

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

**Properties**:

- `imageId?` _string_
- `buildError` _string_

### Constructors

#### Constructor

```ts
new ImageBuildFailedError(
   message: string,
   statusCode?: number,
   code?: string,
   source?: string,
   envelope?: ErrorEnvelope,
   imageId?: string): ImageBuildFailedError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `code?` _string_
- `source?` _string_
- `envelope?` _ErrorEnvelope_
- `imageId?` _string_

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

***

## CreateTtlOutOfRangeError

***

## SnapshotNotFoundError

***

## SnapshotNotReadyError

***

## SnapshotClassMismatchError

***

## TransferCancelledError

### Constructors

#### Constructor

```ts
new TransferCancelledError(message = 'file transfer cancelled'): TransferCancelledError;
```

**Parameters**:

- `message` _string = 'file transfer cancelled'_

**Returns**:

- `TransferCancelledError`

***

## BuildLogInterruptedError

Last successfully delivered checkpoint. Callback failures never auto-retry.

**Properties**:

- `cause?` _unknown_

### Constructors

#### Constructor

```ts
new BuildLogInterruptedError(
   message: string,
   cursor?: string,
   code = 'BUILD_LOG_INTERRUPTED',
   statusCode?: number): BuildLogInterruptedError;
```

**Parameters**:

- `message` _string_
- `cursor?` _string_
- `code` _string = 'BUILD_LOG_INTERRUPTED'_
- `statusCode?` _number_

**Returns**:

- `BuildLogInterruptedError`

***

## isKnownErrorCode

```ts
function isKnownErrorCode(code: string | undefined): code is ErrorCode;
```

***

## ApiErrorCode

```ts
type ApiErrorCode = (typeof API_ERROR_CODES)[number]
```

***

## DaemonErrorCode

```ts
type DaemonErrorCode = (typeof DAEMON_ERROR_CODES)[number]
```

***

## GenericErrorCode

```ts
type GenericErrorCode = (typeof GENERIC_ERROR_CODES)[number]
```

***

## ProxyErrorCode

```ts
type ProxyErrorCode = (typeof PROXY_ERROR_CODES)[number]
```

***

## RouterErrorCode

```ts
type RouterErrorCode = (typeof ROUTER_ERROR_CODES)[number]
```

***

## ErrorCode

```ts
type ErrorCode = DaemonErrorCode | ApiErrorCode | ProxyErrorCode | RouterErrorCode | GenericErrorCode
```

***

## API\_ERROR\_CODES

```ts
const API_ERROR_CODES = [
  'BILLING_DISABLED',
  'BILLING_UNREACHABLE',
  'BILLING_UNAVAILABLE',
  'BILLING_NOT_PROVISIONED',
  'CHARGE_NOT_FOUND',
  'INVOICE_NOT_FOUND',
  'COUPON_NOT_FOUND',
  'COUPON_EXPIRED',
  'COUPON_LIMIT_REACHED',
  'COUPON_ALREADY_REDEEMED',
  'INVOICE_NOT_FINALIZED',
  'INVOICE_NOT_PAYABLE',
  'CHARGE_NOT_SUCCEEDED',
  'PLAN_UNCHANGED',
  'PLAN_CHANGE_PENDING',
  'PLAN_MANAGED_BY_OPERATOR',
  'PAYMENT_METHOD_REQUIRED',
  'BILLING_ACCOUNT_CONFLICT',
  'UNKNOWN_PLAN',
  'PLAN_REQUIRES_SALES',
  'AUTOMATIC_TOP_UP_NOT_AVAILABLE',
  'BUCKET_CREATE_FAILED',
  'BUCKET_DELETE_FAILED',
  'BUCKET_NOT_EMPTY',
  'ORIGIN_IMPORT_ONLY',
  'READ_ONLY_UNSUPPORTED',
  'UNSUPPORTED_VOLUME_TYPE',
  'CREATE_BODY_TOO_LARGE',
  'REGION_UNAVAILABLE',
  'ECR_ACCOUNT_MISMATCH',
  'ECR_CREDENTIALS_INVALID',
  'ECR_OWNERSHIP_UNVERIFIABLE',
  'EMAIL_ACCESS_DENIED',
  'ENTITLEMENT_REQUIRED',
  'FEATURE_NOT_ENABLED',
  'INVALID_FOR_SOURCE',
  'LIMIT_EXCEEDED',
  'USAGE_UNAVAILABLE',
  'BAD_RANGE',
  'BAD_RESOLUTION',
  'BILLING_FORBIDDEN',
  'BILLING_ERROR',
  'IF_MATCH_REQUIRED',
  'SECRETS_TRANSITION_IN_PROGRESS',
  'STALE_SECRETS_REVISION',
  'MANAGEMENT_PLANE_ELSEWHERE',
  'NETWORK_POLICY_DOMAINS_REQUIRE_BLOCK_ALL',
  'NETWORK_POLICY_TRANSITION_IN_PROGRESS',
  'STALE_NETWORK_POLICY_REVISION',
  'NOT_SUPPORTED_FOR_CLASS',
  'IMAGE_NOT_FOUND',
  'IMAGE_NOT_READY',
  'IMAGE_BUILD_FAILED',
  'DEFAULT_IMAGE_NOT_CONFIGURED',
  'IMAGE_FORMAT_OUTDATED',
  'IMAGE_CLASS_MISMATCH',
  'IMAGE_NAME_TAKEN',
  'IMAGE_NAME_RESERVED',
  'IMAGE_TOO_LARGE',
  'IDLE_OUT_OF_RANGE',
  'CREATE_TTL_OUT_OF_RANGE',
  'SNAPSHOT_NOT_FOUND',
  'SNAPSHOT_NOT_READY',
  'SNAPSHOT_CLASS_MISMATCH',
  'SNAPSHOT_IN_PROGRESS',
  'SNAPSHOT_TOO_LARGE',
  'IMPORTED_KEY_ALWAYS_SYNCED',
  'KEY_SYNC_NOT_APPLICABLE',
  'ORG_SUSPENDED',
  'OVERLOADED',
  'PLACEMENT_UNAVAILABLE',
  'PROJECT_BUDGET_EXCEEDED',
  'RATE_LIMITED',
  'SEARCH_NOT_CONFIGURED',
  'SEARCH_UNAVAILABLE',
  'SIGNUP_NOT_INVITED',
  'SOURCE_AMBIGUOUS',
  'SECRET_ALREADY_EXISTS',
  'USER_SUSPENDED',
  'WORKLOAD_PLANE_ELSEWHERE',
  'NO_ACTIVE_RESERVATION',
  'NO_FREE_SLOT',
  'RESERVATION_NOT_FOUND',
  'NO_MAC_AVAILABLE',
  'MAC_DISK_FULL',
  'AUTO_RESERVE_LIMIT_REACHED',
  'IDEMPOTENCY_KEY_REUSED',
  'INSUFFICIENT_BALANCE',
  'CHARGE_FAILED',
  'V0_BRIDGE_UNAVAILABLE',
  'V0_SANDBOX_NOT_FOUND',
  'V0_SANDBOX_NOT_IMPORTABLE',
  'V0_BACKUP_REGISTRY_UNCONFIGURED',
  'V0_MIGRATION_DEFAULT_PROJECT_ONLY',
] as const
```

***

## DAEMON\_ERROR\_CODES

```ts
const DAEMON_ERROR_CODES = [
  'PROCESS_NOT_FOUND',
  'PROCESS_START_FAILED',
  'PROCESS_TERMINAL',
  'PROCESS_EXECUTION_TIMEOUT',
  'NAME_CONFLICT',
  'INVALID_CURSOR',
  'CURSOR_EXPIRED',
  'STDIN_CLOSED',
  'STDIN_UNAVAILABLE',
  'PROTECTED_PROCESS',
  'UNSUPPORTED_OPERATION',
  'SESSION_NOT_FOUND',
  'SESSION_ENDED',
  'KERNEL_UNAVAILABLE',
  'LSP_SERVER_UNAVAILABLE',
  'LSP_NOT_STARTED',
  'ADDON_UNAVAILABLE',
  'FILE_NOT_FOUND',
  'INVALID_FILE_PATH',
  'FILE_ACCESS_DENIED',
  'FILE_READ_FAILED',
  'ATOMIC_UPLOAD_UNSUPPORTED',
  'GIT_AUTH_FAILED',
  'GIT_REPO_NOT_FOUND',
  'GIT_BRANCH_NOT_FOUND',
  'GIT_BRANCH_EXISTS',
  'DESKTOP_NOT_READY',
] as const
```

***

## GENERIC\_ERROR\_CODES

```ts
const GENERIC_ERROR_CODES = [
  'BAD_GATEWAY',
  'BAD_REQUEST',
  'CONFLICT',
  'FORBIDDEN',
  'GATEWAY_TIMEOUT',
  'GONE',
  'INTERNAL_SERVER_ERROR',
  'METHOD_NOT_ALLOWED',
  'NOT_FOUND',
  'NOT_IMPLEMENTED',
  'PAYMENT_REQUIRED',
  'PAYLOAD_TOO_LARGE',
  'REQUEST_TIMEOUT',
  'SERVICE_UNAVAILABLE',
  'TOO_MANY_REQUESTS',
  'UNAUTHORIZED',
  'UNPROCESSABLE_ENTITY',
  'UNSUPPORTED_MEDIA_TYPE',
] as const
```

***

## PROXY\_ERROR\_CODES

```ts
const PROXY_ERROR_CODES = [
  'SANDBOX_NOT_RUNNING',
] as const
```

***

## ROUTER\_ERROR\_CODES

```ts
const ROUTER_ERROR_CODES = [
  'REGION_MISMATCH',
  'UNKNOWN_REGION',
  'REGION_REQUIRED',
  'IDEMPOTENCY_KEY_REQUIRED',
  'CREATE_BODY_TOO_LARGE',
  'PLACEMENT_UNAVAILABLE',
] as const
```

***

## CODE\_STATUS

```ts
const CODE_STATUS: Record<ErrorCode, number> = {
  PROCESS_NOT_FOUND: 404,
  PROCESS_START_FAILED: 400,
  PROCESS_TERMINAL: 409,
  PROCESS_EXECUTION_TIMEOUT: 408,
  NAME_CONFLICT: 409,
  INVALID_CURSOR: 400,
  CURSOR_EXPIRED: 409,
  STDIN_CLOSED: 409,
  STDIN_UNAVAILABLE: 409,
  PROTECTED_PROCESS: 403,
  UNSUPPORTED_OPERATION: 400,
  SESSION_NOT_FOUND: 404,
  SESSION_ENDED: 410,
  KERNEL_UNAVAILABLE: 503,
  LSP_SERVER_UNAVAILABLE: 503,
  LSP_NOT_STARTED: 409,
  ADDON_UNAVAILABLE: 503,
  FILE_NOT_FOUND: 404,
  INVALID_FILE_PATH: 400,
  FILE_ACCESS_DENIED: 403,
  FILE_READ_FAILED: 500,
  ATOMIC_UPLOAD_UNSUPPORTED: 409,
  GIT_AUTH_FAILED: 401,
  GIT_REPO_NOT_FOUND: 404,
  GIT_BRANCH_NOT_FOUND: 404,
  GIT_BRANCH_EXISTS: 409,
  DESKTOP_NOT_READY: 409,
  BILLING_DISABLED: 501,
  BILLING_UNREACHABLE: 502,
  BILLING_UNAVAILABLE: 503,
  BILLING_NOT_PROVISIONED: 409,
  CHARGE_NOT_FOUND: 404,
  INVOICE_NOT_FOUND: 404,
  COUPON_NOT_FOUND: 404,
  COUPON_EXPIRED: 409,
  COUPON_LIMIT_REACHED: 409,
  COUPON_ALREADY_REDEEMED: 409,
  INVOICE_NOT_FINALIZED: 409,
  INVOICE_NOT_PAYABLE: 409,
  CHARGE_NOT_SUCCEEDED: 409,
  PLAN_UNCHANGED: 409,
  PLAN_CHANGE_PENDING: 409,
  PLAN_MANAGED_BY_OPERATOR: 409,
  PAYMENT_METHOD_REQUIRED: 409,
  BILLING_ACCOUNT_CONFLICT: 409,
  UNKNOWN_PLAN: 400,
  PLAN_REQUIRES_SALES: 400,
  AUTOMATIC_TOP_UP_NOT_AVAILABLE: 409,
  BUCKET_CREATE_FAILED: 502,
  BUCKET_DELETE_FAILED: 502,
  BUCKET_NOT_EMPTY: 409,
  ORIGIN_IMPORT_ONLY: 400,
  READ_ONLY_UNSUPPORTED: 400,
  UNSUPPORTED_VOLUME_TYPE: 400,
  CREATE_BODY_TOO_LARGE: 413,
  REGION_UNAVAILABLE: 409,
  ECR_ACCOUNT_MISMATCH: 400,
  ECR_CREDENTIALS_INVALID: 400,
  ECR_OWNERSHIP_UNVERIFIABLE: 502,
  EMAIL_ACCESS_DENIED: 403,
  ENTITLEMENT_REQUIRED: 403,
  FEATURE_NOT_ENABLED: 403,
  INVALID_FOR_SOURCE: 400,
  LIMIT_EXCEEDED: 429,
  USAGE_UNAVAILABLE: 503,
  BAD_RANGE: 400,
  BAD_RESOLUTION: 400,
  BILLING_FORBIDDEN: 502,
  BILLING_ERROR: 502,
  IF_MATCH_REQUIRED: 428,
  SECRETS_TRANSITION_IN_PROGRESS: 409,
  STALE_SECRETS_REVISION: 412,
  MANAGEMENT_PLANE_ELSEWHERE: 501,
  NETWORK_POLICY_DOMAINS_REQUIRE_BLOCK_ALL: 400,
  NETWORK_POLICY_TRANSITION_IN_PROGRESS: 409,
  STALE_NETWORK_POLICY_REVISION: 412,
  NOT_SUPPORTED_FOR_CLASS: 409,
  IMAGE_NOT_FOUND: 404,
  IMAGE_NOT_READY: 409,
  IMAGE_BUILD_FAILED: 409,
  DEFAULT_IMAGE_NOT_CONFIGURED: 400,
  IMAGE_FORMAT_OUTDATED: 409,
  IMAGE_CLASS_MISMATCH: 409,
  IMAGE_NAME_TAKEN: 409,
  IMAGE_NAME_RESERVED: 400,
  IMAGE_TOO_LARGE: 409,
  IDLE_OUT_OF_RANGE: 400,
  CREATE_TTL_OUT_OF_RANGE: 400,
  SNAPSHOT_NOT_FOUND: 404,
  SNAPSHOT_NOT_READY: 409,
  SNAPSHOT_CLASS_MISMATCH: 409,
  SNAPSHOT_IN_PROGRESS: 409,
  SNAPSHOT_TOO_LARGE: 409,
  IMPORTED_KEY_ALWAYS_SYNCED: 409,
  KEY_SYNC_NOT_APPLICABLE: 409,
  ORG_SUSPENDED: 402,
  OVERLOADED: 429,
  PLACEMENT_UNAVAILABLE: 503,
  PROJECT_BUDGET_EXCEEDED: 402,
  RATE_LIMITED: 429,
  SEARCH_NOT_CONFIGURED: 501,
  SEARCH_UNAVAILABLE: 503,
  SIGNUP_NOT_INVITED: 403,
  SOURCE_AMBIGUOUS: 409,
  SECRET_ALREADY_EXISTS: 412,
  USER_SUSPENDED: 403,
  WORKLOAD_PLANE_ELSEWHERE: 501,
  NO_ACTIVE_RESERVATION: 409,
  NO_FREE_SLOT: 409,
  RESERVATION_NOT_FOUND: 404,
  NO_MAC_AVAILABLE: 409,
  MAC_DISK_FULL: 409,
  AUTO_RESERVE_LIMIT_REACHED: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  INSUFFICIENT_BALANCE: 402,
  CHARGE_FAILED: 402,
  V0_BRIDGE_UNAVAILABLE: 503,
  V0_SANDBOX_NOT_FOUND: 404,
  V0_SANDBOX_NOT_IMPORTABLE: 409,
  V0_BACKUP_REGISTRY_UNCONFIGURED: 503,
  V0_MIGRATION_DEFAULT_PROJECT_ONLY: 403,
  SANDBOX_NOT_RUNNING: 409,
  REGION_MISMATCH: 400,
  UNKNOWN_REGION: 400,
  REGION_REQUIRED: 400,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  BAD_GATEWAY: 502,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  FORBIDDEN: 403,
  GATEWAY_TIMEOUT: 504,
  GONE: 410,
  INTERNAL_SERVER_ERROR: 500,
  METHOD_NOT_ALLOWED: 405,
  NOT_FOUND: 404,
  NOT_IMPLEMENTED: 501,
  PAYMENT_REQUIRED: 402,
  PAYLOAD_TOO_LARGE: 413,
  REQUEST_TIMEOUT: 408,
  SERVICE_UNAVAILABLE: 503,
  TOO_MANY_REQUESTS: 429,
  UNAUTHORIZED: 401,
  UNPROCESSABLE_ENTITY: 422,
  UNSUPPORTED_MEDIA_TYPE: 415,
}
```

***

## API\_CODE\_EXTRAS

```ts
const API_CODE_EXTRAS: Partial<Record<ErrorCode, readonly string[]>> = {
  ENTITLEMENT_REQUIRED: ['entitlement'],
  FEATURE_NOT_ENABLED: ['feature'],
  GONE: ['replacement'],
  LIMIT_EXCEEDED: ['limit', 'current', 'max'],
  IMAGE_TOO_LARGE: ['max_bytes', 'bytes'],
  SNAPSHOT_TOO_LARGE: ['max_bytes', 'bytes'],
  IDLE_OUT_OF_RANGE: ['max'],
  CREATE_TTL_OUT_OF_RANGE: ['max'],
  OVERLOADED: ['retry_after_seconds'],
  RATE_LIMITED: ['retry_after_seconds'],
}
```

The optional top-level envelope fields a code may carry beyond
`{code, message, source, trace_id}` — the per-code `extras` arrays the
contract artifacts publish. Extras are documented per SOURCE (the api's
`GONE` carries `replacement`; the toolbox's carries nothing), so there is
one map per source; an unlisted code carries none.

***

## DAEMON\_CODE\_EXTRAS

```ts
const DAEMON_CODE_EXTRAS: Partial<Record<ErrorCode, readonly string[]>> = {
  CURSOR_EXPIRED: ['firstAvailableCursor'],
}
```

***

## PROXY\_CODE\_EXTRAS

```ts
const PROXY_CODE_EXTRAS: Partial<Record<ErrorCode, readonly string[]>> = {}
```

***

## ROUTER\_CODE\_EXTRAS

```ts
const ROUTER_CODE_EXTRAS: Partial<Record<ErrorCode, readonly string[]>> = {
  REGION_MISMATCH: ['stated', 'actual'],
  UNKNOWN_REGION: ['region'],
}
```

***

## DaytonaNotFoundError

```ts
const DaytonaNotFoundError = NotFoundError
```

***

## DaytonaAuthenticationError

```ts
const DaytonaAuthenticationError = AuthenticationError
```

***

## DaytonaAuthorizationError

```ts
const DaytonaAuthorizationError = AuthorizationError
```

***

## DaytonaConflictError

```ts
const DaytonaConflictError = ConflictError
```

***

## DaytonaValidationError

```ts
const DaytonaValidationError = BadRequestError
```

***

## DaytonaRateLimitError

```ts
const DaytonaRateLimitError = RateLimitError
```

***

## DaytonaTimeoutError

```ts
const DaytonaTimeoutError = TimeoutError
```

***

## DaytonaConnectionError

```ts
const DaytonaConnectionError = ConnectionError
```

***

## DaytonaNotSupportedError

```ts
const DaytonaNotSupportedError = NotSupportedError
```
