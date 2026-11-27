# Errors (Python SDK reference)

## Contents

- [BuildLogInterruptedError](#buildloginterruptederror)
- [DaytonaError](#daytonaerror)
- [ClientClosedError](#clientclosederror)
- [BadRequestError](#badrequesterror)
- [AuthenticationError](#authenticationerror)
- [ForbiddenError](#forbiddenerror)
- [NotFoundError](#notfounderror)
- [RequestTimeoutError](#requesttimeouterror)
- [DockerWaitTimeoutError](#dockerwaittimeouterror)
- [ConflictError](#conflicterror)
- [DockerNotReadyError](#dockernotreadyerror)
- [SandboxTerminalStateError](#sandboxterminalstateerror)
- [PreconditionFailedError](#preconditionfailederror)
- [SecretAlreadyExistsError](#secretalreadyexistserror)
- [GoneError](#goneerror)
- [MethodNotAllowedError](#methodnotallowederror)
- [PayloadTooLargeError](#payloadtoolargeerror)
- [UnsupportedMediaTypeError](#unsupportedmediatypeerror)
- [UnprocessableEntityError](#unprocessableentityerror)
- [RateLimitError](#ratelimiterror)
- [LimitExceededError](#limitexceedederror)
- [ImageTooLargeError](#imagetoolargeerror)
- [SnapshotTooLargeError](#snapshottoolargeerror)
- [PreconditionRequiredError](#preconditionrequirederror)
- [ServiceUnavailableError](#serviceunavailableerror)
- [InternalServerError](#internalservererror)
- [NotSupportedError](#notsupportederror)
- [ConnectionError](#connectionerror)
- [ClientTimeoutError](#clienttimeouterror)
- [TransferCancelledError](#transfercancellederror)
- [SandboxCreateRequestTimeoutError](#sandboxcreaterequesttimeouterror)
- [SandboxCreateConnectionError](#sandboxcreateconnectionerror)
- [ProcessNotFoundError](#processnotfounderror)
- [ProcessStartFailedError](#processstartfailederror)
- [ProcessTerminalError](#processterminalerror)
- [ProcessExecutionTimeoutError](#processexecutiontimeouterror)
- [ProcessKillIncompleteError](#processkillincompleteerror)
- [NameConflictError](#nameconflicterror)
- [InvalidCursorError](#invalidcursorerror)
- [CursorExpiredError](#cursorexpirederror)
- [StdinClosedError](#stdinclosederror)
- [StdinUnavailableError](#stdinunavailableerror)
- [ProtectedProcessError](#protectedprocesserror)
- [UnsupportedOperationError](#unsupportedoperationerror)
- [SessionNotFoundError](#sessionnotfounderror)
- [SessionEndedError](#sessionendederror)
- [KernelUnavailableError](#kernelunavailableerror)
- [AddonUnavailableError](#addonunavailableerror)
- [FileNotFoundError](#filenotfounderror)
- [InvalidFilePathError](#invalidfilepatherror)
- [FileAccessDeniedError](#fileaccessdeniederror)
- [FileReadFailedError](#filereadfailederror)
- [GitAuthFailedError](#gitauthfailederror)
- [GitRepoNotFoundError](#gitreponotfounderror)
- [GitBranchNotFoundError](#gitbranchnotfounderror)
- [GitBranchExistsError](#gitbranchexistserror)
- [DesktopNotReadyError](#desktopnotreadyerror)
- [AtomicUploadUnsupportedError](#atomicuploadunsupportederror)
- [OrgSuspendedError](#orgsuspendederror)
- [ProjectBudgetExceededError](#projectbudgetexceedederror)
- [OverloadedError](#overloadederror)
- [NotSupportedForClassError](#notsupportedforclasserror)
- [FeatureNotEnabledError](#featurenotenablederror)
- [UnsupportedVolumeTypeError](#unsupportedvolumetypeerror)
- [BucketCreateFailedError](#bucketcreatefailederror)
- [BucketDeleteFailedError](#bucketdeletefailederror)
- [BucketNotEmptyError](#bucketnotemptyerror)
- [OriginImportOnlyError](#originimportonlyerror)
- [ReadOnlyUnsupportedError](#readonlyunsupportederror)
- [BillingDisabledError](#billingdisablederror)
- [BillingUnreachableError](#billingunreachableerror)
- [BillingUnavailableError](#billingunavailableerror)
- [BillingNotProvisionedError](#billingnotprovisionederror)
- [ChargeNotFoundError](#chargenotfounderror)
- [InvoiceNotFoundError](#invoicenotfounderror)
- [CouponNotFoundError](#couponnotfounderror)
- [CouponExpiredError](#couponexpirederror)
- [CouponLimitReachedError](#couponlimitreachederror)
- [CouponAlreadyRedeemedError](#couponalreadyredeemederror)
- [InvoiceNotFinalizedError](#invoicenotfinalizederror)
- [InvoiceNotPayableError](#invoicenotpayableerror)
- [ChargeNotSucceededError](#chargenotsucceedederror)
- [PlanUnchangedError](#planunchangederror)
- [PlanChangePendingError](#planchangependingerror)
- [PlanManagedByOperatorError](#planmanagedbyoperatorerror)
- [PaymentMethodRequiredError](#paymentmethodrequirederror)
- [BillingAccountConflictError](#billingaccountconflicterror)
- [UnknownPlanError](#unknownplanerror)
- [PlanRequiresSalesError](#planrequiressaleserror)
- [AutomaticTopUpNotAvailableError](#automatictopupnotavailableerror)
- [SearchNotConfiguredError](#searchnotconfigurederror)
- [SearchUnavailableError](#searchunavailableerror)
- [SandboxNotRunningError](#sandboxnotrunningerror)
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

## BuildLogInterruptedError

```python
class BuildLogInterruptedError(DaytonaError)
```

Observation failed; cursor is the last successfully delivered checkpoint.

A callback failure is never retried. Its cause may have partially applied
application effects; persist output and cursor together before resuming.

#### BuildLogInterruptedError.\_\_init\_\_

```python
def __init__(message: str,
             *,
             cursor: str | None = None,
             status_code: int | None = None,
             code: str | None = None,
             source: str | None = None,
             **fields: Unpack[_ErrorFields]) -> None
```

## DaytonaError

```python
class DaytonaError(_shared.DaytonaError)
```

Base class for all v2 SDK errors.

`code` and `source` are open vocabularies: the server may send a code
or source this SDK release does not know yet. An unknown code keeps its
exact value on `code` and the error falls back to the class for its HTTP
status (`NotFoundError` for a 404, ...). `daytona.v2.codes` lists the
codes this release knows.

Every keyword is optional; an error built by the caller carries only what
it is given. A subclass with defaults (`ClientTimeoutError`, ...) uses its
default for a keyword that is omitted or `None`, as the TypeScript SDK does
for `undefined`.

#### DaytonaError.\_\_init\_\_

```python
def __init__(message: str,
             *,
             status_code: Optional[int] = None,
             code: Optional[str] = None,
             source: Optional[str] = None,
             trace_id: Optional[str] = None,
             retry_after_seconds: Optional[int] = None,
             feature: Optional[str] = None,
             entitlement: Optional[str] = None,
             replacement: Optional[str] = None,
             first_available_cursor: Optional[str] = None,
             limit: Optional[str] = None,
             current: Optional[int] = None,
             max: Optional[int] = None,
             max_bytes: Optional[int] = None,
             bytes: Optional[int] = None,
             stated: Optional[str] = None,
             actual: Optional[str] = None,
             region: Optional[str] = None,
             request_id: Optional[str] = None,
             retry_after_ms: Optional[int] = None) -> None
```

## ClientClosedError

```python
class ClientClosedError(DaytonaError)
```

A request was started on a closed client; no HTTP status applies.

#### ClientClosedError.\_\_init\_\_

```python
def __init__(message: str = 'Daytona client is closed',
             *,
             status_code: Optional[int] = None,
             code: Optional[str] = None,
             source: Optional[str] = None,
             **fields: Unpack[_ErrorFields]) -> None
```

## BadRequestError

```python
class BadRequestError(DaytonaError, _shared.DaytonaBadRequestError)
```

HTTP 400.

## AuthenticationError

```python
class AuthenticationError(DaytonaError, _shared.DaytonaAuthenticationError)
```

HTTP 401.

## ForbiddenError

```python
class ForbiddenError(DaytonaError, _shared.DaytonaForbiddenError)
```

HTTP 403.

## NotFoundError

```python
class NotFoundError(DaytonaError, _shared.DaytonaNotFoundError)
```

HTTP 404.

## RequestTimeoutError

```python
class RequestTimeoutError(DaytonaError, _shared.DaytonaTimeoutError)
```

HTTP 408.

## DockerWaitTimeoutError

```python
class DockerWaitTimeoutError(RequestTimeoutError)
```

`sandbox.docker.wait_until_ready()` ran out of caller budget before Docker was `ready`.

`status` is the last observed Docker status (`starting`, or
`deferred` while the boot has not started Docker yet), or `None` when
no status answer arrived before the deadline (for example a stalled first
request).

#### DockerWaitTimeoutError.\_\_init\_\_

```python
def __init__(status: Optional[DockerStatus]) -> None
```

## ConflictError

```python
class ConflictError(DaytonaError, _shared.DaytonaConflictError)
```

HTTP 409.

## DockerNotReadyError

```python
class DockerNotReadyError(ConflictError)
```

`sandbox.docker.wait_until_ready()` saw Docker settle in a state that cannot become `ready`.

The terminal states are `failed`, `not_present`, `disabled`,
`unmanaged` and `unsupported`. `status` is the observed Docker
status; its `reason` says why, and `process_id` (when set) names the
process whose logs hold Docker's output. The sandbox itself stays usable.

#### DockerNotReadyError.\_\_init\_\_

```python
def __init__(status: DockerStatus) -> None
```

## SandboxTerminalStateError

```python
class SandboxTerminalStateError(ConflictError)
```

A lifecycle wait (`wait()`, `start()`, `stop()`, ...) saw the sandbox reach a terminal state first.

`state` is the observed public sandbox state (e.g. `"destroyed"`).
`reason` is the server's explanation of that state, when it gave one
(for example why a deletion did not finish); the message ends with it.

#### SandboxTerminalStateError.\_\_init\_\_

```python
def __init__(sandbox_id: str,
             state: SandboxState,
             *,
             raw_state: Optional[str] = None,
             reason: Optional[str] = None) -> None
```

## PreconditionFailedError

```python
class PreconditionFailedError(DaytonaError)
```

HTTP 412 — the `If-Match` revision no longer matches (network policy CAS).

## SecretAlreadyExistsError

```python
class SecretAlreadyExistsError(PreconditionFailedError)
```

A create-only secret write found an existing secret.

## GoneError

```python
class GoneError(DaytonaError, _shared.DaytonaGoneError)
```

HTTP 410.

## MethodNotAllowedError

```python
class MethodNotAllowedError(DaytonaError)
```

HTTP 405.

## PayloadTooLargeError

```python
class PayloadTooLargeError(DaytonaError)
```

HTTP 413.

## UnsupportedMediaTypeError

```python
class UnsupportedMediaTypeError(DaytonaError)
```

HTTP 415.

## UnprocessableEntityError

```python
class UnprocessableEntityError(DaytonaError, _shared.DaytonaUnprocessableEntityError)
```

HTTP 422.

## RateLimitError

```python
class RateLimitError(DaytonaError, _shared.DaytonaRateLimitError)
```

HTTP 429. `RATE_LIMITED` and `TOO_MANY_REQUESTS` raise this class
itself (read `code` to tell them apart); `LIMIT_EXCEEDED` and
`OVERLOADED` raise its subclasses.

## LimitExceededError

```python
class LimitExceededError(RateLimitError)
```

`LIMIT_EXCEEDED` (429): an organization limit is exhausted.

Subclasses `RateLimitError`, so `except RateLimitError` keeps matching;
`limit` is the limit's stable machine name (e.g. `max_concurrent_sandboxes`) and
`current`/`max` are the counts the refusal was computed from. Attributes are
`None` when a body omits or malforms them. `code` defaults to `"LIMIT_EXCEEDED"`.

#### LimitExceededError.\_\_init\_\_

```python
def __init__(message: str,
             *,
             status_code: Optional[int] = None,
             code: Optional[str] = None,
             source: Optional[str] = None,
             **fields: Unpack[_ErrorFields]) -> None
```

## ImageTooLargeError

```python
class ImageTooLargeError(ConflictError)
```

## SnapshotTooLargeError

```python
class SnapshotTooLargeError(ConflictError)
```

## PreconditionRequiredError

```python
class PreconditionRequiredError(DaytonaError)
```

## ServiceUnavailableError

```python
class ServiceUnavailableError(DaytonaError, _shared.DaytonaServiceUnavailableError)
```

HTTP 503.

## InternalServerError

```python
class InternalServerError(DaytonaError, _shared.DaytonaInternalServerError)
```

HTTP 5xx.

## NotSupportedError

```python
class NotSupportedError(InternalServerError)
```

## ConnectionError

```python
class ConnectionError(DaytonaError, _shared.DaytonaConnectionError)
```

The API or the sandbox could not be reached (no HTTP response).

`source` defaults to `"SDK"`; there is no status or code.

#### ConnectionError.\_\_init\_\_

```python
def __init__(message: str,
             *,
             status_code: Optional[int] = None,
             code: Optional[str] = None,
             source: Optional[str] = None,
             **fields: Unpack[_ErrorFields]) -> None
```

## ClientTimeoutError

```python
class ClientTimeoutError(DaytonaError, _shared.DaytonaTimeoutError)
```

The client gave up waiting for a response.

Its request timeout or a call's own deadline expired; not the server's
HTTP 408 (`RequestTimeoutError`). Defaults: message
`"operation timed out"`, `status_code=408`, `code="REQUEST_TIMEOUT"`,
`source="SDK"` (the same in the TypeScript SDK).

#### ClientTimeoutError.\_\_init\_\_

```python
def __init__(message: str = 'operation timed out',
             *,
             status_code: Optional[int] = None,
             code: Optional[str] = None,
             source: Optional[str] = None,
             **fields: Unpack[_ErrorFields]) -> None
```

## TransferCancelledError

```python
class TransferCancelledError(DaytonaError)
```

A local file transfer was cancelled before completion.

Defaults: message `"file transfer cancelled"`, `status_code=499`,
`code="REQUEST_CANCELLED"`, `source="SDK"`.

#### TransferCancelledError.\_\_init\_\_

```python
def __init__(message: str = 'file transfer cancelled',
             *,
             status_code: Optional[int] = None,
             code: Optional[str] = None,
             source: Optional[str] = None,
             **fields: Unpack[_ErrorFields]) -> None
```

## SandboxCreateRequestTimeoutError

```python
class SandboxCreateRequestTimeoutError(ClientTimeoutError)
```

The `create()` request itself timed out before the server answered.

The server may still have created the sandbox. `idempotency_key` is the
key the request was sent with. Retry with that key and the identical source
and create arguments, in the same project and API endpoint, to
recover the sandbox (or create it if the first request never landed).
Always retry with identical arguments: a changed request may be rejected
or return the originally created sandbox.

#### SandboxCreateRequestTimeoutError.\_\_init\_\_

```python
def __init__(idempotency_key: str) -> None
```

## SandboxCreateConnectionError

```python
class SandboxCreateConnectionError(ConnectionError)
```

The connection failed while the `create()` request was in flight.

Same outcome as `SandboxCreateRequestTimeoutError`: the sandbox may
or may not exist; retry `create()` with the same `idempotency_key`, source
and create arguments, in the same project and API endpoint.

#### SandboxCreateConnectionError.\_\_init\_\_

```python
def __init__(idempotency_key: str, detail: str) -> None
```

## ProcessNotFoundError

```python
class ProcessNotFoundError(NotFoundError)
```

PROCESS_NOT_FOUND.

## ProcessStartFailedError

```python
class ProcessStartFailedError(BadRequestError)
```

PROCESS_START_FAILED.

## ProcessTerminalError

```python
class ProcessTerminalError(ConflictError)
```

PROCESS_TERMINAL.

## ProcessExecutionTimeoutError

```python
class ProcessExecutionTimeoutError(RequestTimeoutError)
```

PROCESS_EXECUTION_TIMEOUT.

## ProcessKillIncompleteError

```python
class ProcessKillIncompleteError(RequestTimeoutError)
```

PROCESS_KILL_INCOMPLETE.

## NameConflictError

```python
class NameConflictError(ConflictError)
```

NAME_CONFLICT.

## InvalidCursorError

```python
class InvalidCursorError(BadRequestError)
```

INVALID_CURSOR.

## CursorExpiredError

```python
class CursorExpiredError(ConflictError)
```

CURSOR_EXPIRED.

## StdinClosedError

```python
class StdinClosedError(ConflictError)
```

STDIN_CLOSED.

## StdinUnavailableError

```python
class StdinUnavailableError(ConflictError)
```

STDIN_UNAVAILABLE.

## ProtectedProcessError

```python
class ProtectedProcessError(ForbiddenError)
```

PROTECTED_PROCESS.

## UnsupportedOperationError

```python
class UnsupportedOperationError(BadRequestError)
```

UNSUPPORTED_OPERATION.

## SessionNotFoundError

```python
class SessionNotFoundError(NotFoundError)
```

SESSION_NOT_FOUND.

## SessionEndedError

```python
class SessionEndedError(GoneError)
```

SESSION_ENDED.

## KernelUnavailableError

```python
class KernelUnavailableError(ServiceUnavailableError)
```

KERNEL_UNAVAILABLE.

## AddonUnavailableError

```python
class AddonUnavailableError(ServiceUnavailableError)
```

ADDON_UNAVAILABLE.

## FileNotFoundError

```python
class FileNotFoundError(NotFoundError)
```

FILE_NOT_FOUND.

## InvalidFilePathError

```python
class InvalidFilePathError(BadRequestError)
```

INVALID_FILE_PATH.

## FileAccessDeniedError

```python
class FileAccessDeniedError(ForbiddenError)
```

FILE_ACCESS_DENIED.

## FileReadFailedError

```python
class FileReadFailedError(InternalServerError)
```

FILE_READ_FAILED.

## GitAuthFailedError

```python
class GitAuthFailedError(AuthenticationError)
```

GIT_AUTH_FAILED.

## GitRepoNotFoundError

```python
class GitRepoNotFoundError(NotFoundError)
```

GIT_REPO_NOT_FOUND.

## GitBranchNotFoundError

```python
class GitBranchNotFoundError(NotFoundError)
```

GIT_BRANCH_NOT_FOUND.

## GitBranchExistsError

```python
class GitBranchExistsError(ConflictError)
```

GIT_BRANCH_EXISTS.

## DesktopNotReadyError

```python
class DesktopNotReadyError(ConflictError)
```

DESKTOP_NOT_READY.

## AtomicUploadUnsupportedError

```python
class AtomicUploadUnsupportedError(ConflictError)
```

ATOMIC_UPLOAD_UNSUPPORTED.

## OrgSuspendedError

```python
class OrgSuspendedError(DaytonaError)
```

## ProjectBudgetExceededError

```python
class ProjectBudgetExceededError(DaytonaError)
```

PROJECT_BUDGET_EXCEEDED (402): the project reached its monthly budget.

New sandboxes cannot start in the project until the budget is raised or
removed, or the next calendar month (UTC) begins.

## OverloadedError

```python
class OverloadedError(RateLimitError)
```

## NotSupportedForClassError

```python
class NotSupportedForClassError(ConflictError)
```

## FeatureNotEnabledError

```python
class FeatureNotEnabledError(ForbiddenError)
```

## UnsupportedVolumeTypeError

```python
class UnsupportedVolumeTypeError(BadRequestError)
```

## BucketCreateFailedError

```python
class BucketCreateFailedError(InternalServerError)
```

## BucketDeleteFailedError

```python
class BucketDeleteFailedError(InternalServerError)
```

## BucketNotEmptyError

```python
class BucketNotEmptyError(ConflictError)
```

## OriginImportOnlyError

```python
class OriginImportOnlyError(BadRequestError)
```

## ReadOnlyUnsupportedError

```python
class ReadOnlyUnsupportedError(BadRequestError)
```

## BillingDisabledError

```python
class BillingDisabledError(NotSupportedError)
```

## BillingUnreachableError

```python
class BillingUnreachableError(InternalServerError)
```

## BillingUnavailableError

```python
class BillingUnavailableError(ServiceUnavailableError)
```

## BillingNotProvisionedError

```python
class BillingNotProvisionedError(ConflictError)
```

## ChargeNotFoundError

```python
class ChargeNotFoundError(NotFoundError)
```

## InvoiceNotFoundError

```python
class InvoiceNotFoundError(NotFoundError)
```

## CouponNotFoundError

```python
class CouponNotFoundError(NotFoundError)
```

## CouponExpiredError

```python
class CouponExpiredError(ConflictError)
```

## CouponLimitReachedError

```python
class CouponLimitReachedError(ConflictError)
```

## CouponAlreadyRedeemedError

```python
class CouponAlreadyRedeemedError(ConflictError)
```

## InvoiceNotFinalizedError

```python
class InvoiceNotFinalizedError(ConflictError)
```

## InvoiceNotPayableError

```python
class InvoiceNotPayableError(ConflictError)
```

## ChargeNotSucceededError

```python
class ChargeNotSucceededError(ConflictError)
```

## PlanUnchangedError

```python
class PlanUnchangedError(ConflictError)
```

## PlanChangePendingError

```python
class PlanChangePendingError(ConflictError)
```

## PlanManagedByOperatorError

```python
class PlanManagedByOperatorError(ConflictError)
```

## PaymentMethodRequiredError

```python
class PaymentMethodRequiredError(ConflictError)
```

## BillingAccountConflictError

```python
class BillingAccountConflictError(ConflictError)
```

## UnknownPlanError

```python
class UnknownPlanError(BadRequestError)
```

## PlanRequiresSalesError

```python
class PlanRequiresSalesError(BadRequestError)
```

## AutomaticTopUpNotAvailableError

```python
class AutomaticTopUpNotAvailableError(ConflictError)
```

## SearchNotConfiguredError

```python
class SearchNotConfiguredError(NotSupportedError)
```

## SearchUnavailableError

```python
class SearchUnavailableError(ServiceUnavailableError)
```

## SandboxNotRunningError

```python
class SandboxNotRunningError(ConflictError)
```

`SANDBOX_NOT_RUNNING` (409, source `DAYTONA_PROXY`): a toolbox call
(process, files, git, …) or a preview URL request reached a sandbox that
is not running, such as a stopped one. Start the sandbox and retry. Not a
`NotFoundError`: the sandbox exists.

## ImageNotFoundError

```python
class ImageNotFoundError(NotFoundError)
```

## ImageNotReadyError

```python
class ImageNotReadyError(ConflictError)
```

## ImageFormatOutdatedError

```python
class ImageFormatOutdatedError(ConflictError)
```

`IMAGE_FORMAT_OUTDATED` (409): the image is stored in an older format
than the current one (`Image.format_outdated`) and this operation cannot
convert it. Convert it with `POST /images/{id}/convert`, or create a
Linux sandbox from it, which converts it first.

## ImageBuildFailedError

```python
class ImageBuildFailedError(ConflictError)
```

`IMAGE_BUILD_FAILED` (409), or the SDK-minted refusal when
`create_from_build()`'s image build ends `failed`. `image_id` names
the failed image (so its build log can be fetched) when the SDK knows it;
`build_error` is the build's recorded error, when the image has one. It is
separate from `message`, which is always set.

#### ImageBuildFailedError.\_\_init\_\_

```python
def __init__(message: str,
             *,
             status_code: Optional[int] = None,
             code: Optional[str] = None,
             source: Optional[str] = None,
             image_id: Optional[str] = None,
             build_error: Optional[str] = None,
             **fields: Unpack[_ErrorFields]) -> None
```

## ImageClassMismatchError

```python
class ImageClassMismatchError(ConflictError)
```

## ImageNameTakenError

```python
class ImageNameTakenError(ConflictError)
```

## ImageNameReservedError

```python
class ImageNameReservedError(BadRequestError)
```

## IdleOutOfRangeError

```python
class IdleOutOfRangeError(BadRequestError)
```

## CreateTtlOutOfRangeError

```python
class CreateTtlOutOfRangeError(BadRequestError)
```

## SnapshotNotFoundError

```python
class SnapshotNotFoundError(NotFoundError)
```

## SnapshotNotReadyError

```python
class SnapshotNotReadyError(ConflictError)
```

## SnapshotClassMismatchError

```python
class SnapshotClassMismatchError(ConflictError)
```
