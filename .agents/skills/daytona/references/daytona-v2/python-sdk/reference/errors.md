# Errors (Python SDK reference)

## Contents

- [BuildLogInterruptedError](#buildloginterruptederror)
- [DaytonaError](#daytonaerror)
- [BadRequestError](#badrequesterror)
- [UnauthorizedError](#unauthorizederror)
- [ForbiddenError](#forbiddenerror)
- [NotFoundError](#notfounderror)
- [RequestTimeoutError](#requesttimeouterror)
- [SandboxCreateTimeoutError](#sandboxcreatetimeouterror)
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
- [LspServerUnavailableError](#lspserverunavailableerror)
- [LspNotStartedError](#lspnotstartederror)
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
- [RateLimitedError](#ratelimitederror)
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
- [DaytonaValidationError](#daytonavalidationerror)
- [DaytonaAuthenticationError](#daytonaauthenticationerror)
- [DaytonaAuthorizationError](#daytonaauthorizationerror)
- [DaytonaNotFoundError](#daytonanotfounderror)
- [DaytonaConflictError](#daytonaconflicterror)
- [DaytonaRateLimitError](#daytonaratelimiterror)
- [DaytonaTimeoutError](#daytonatimeouterror)
- [DaytonaConnectionError](#daytonaconnectionerror)
- [DaytonaNotSupportedError](#daytonanotsupportederror)

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
             code: str = 'BUILD_LOG_INTERRUPTED',
             status_code: int | None = None) -> None
```

## DaytonaError

```python
class DaytonaError(_shared.DaytonaError)
```

Base class for all SDK errors.

#### DaytonaError.\_\_init\_\_

```python
def __init__(message: str,
             *,
             status_code: Optional[int] = None,
             code: Optional[str] = None,
             source: Optional[str] = None,
             details: Optional[ErrorDetails] = None) -> None
```

## BadRequestError

```python
class BadRequestError(DaytonaError, _shared.DaytonaBadRequestError)
```

HTTP 400.

## UnauthorizedError

```python
class UnauthorizedError(DaytonaError, _shared.DaytonaAuthenticationError)
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

## SandboxCreateTimeoutError

```python
class SandboxCreateTimeoutError(RequestTimeoutError)
```

`create()` ran out of caller budget while the sandbox was still starting.

The sandbox was created and is left running; `sandbox_id` lets the
caller pick it up (`d.v2.get(sandbox_id)`) or delete it.

#### SandboxCreateTimeoutError.\_\_init\_\_

```python
def __init__(sandbox_id: str) -> None
```

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

`wait_for_state()` saw the sandbox reach a terminal state before any target.

`state` is the observed public sandbox state (e.g. `"destroyed"`).

#### SandboxTerminalStateError.\_\_init\_\_

```python
def __init__(sandbox_id: str,
             state: SandboxState,
             *,
             raw_state: Optional[str] = None) -> None
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

HTTP 429.

## LimitExceededError

```python
class LimitExceededError(RateLimitError)
```

`LIMIT_EXCEEDED` (429): an organization limit is exhausted.

Subclasses `RateLimitError`, so `except RateLimitError` keeps matching;
`limit` is the limit's stable machine name (e.g. `max_concurrent_sandboxes`) and
`current`/`max` are the counts the refusal was computed from. Attributes are
`None` when a body omits or malforms them.

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

Network connection failure.

## ClientTimeoutError

```python
class ClientTimeoutError(DaytonaError, _shared.DaytonaTimeoutError)
```

Client-side transport timeout.

## TransferCancelledError

```python
class TransferCancelledError(DaytonaError)
```

A local file transfer was cancelled before completion.

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

## LspServerUnavailableError

```python
class LspServerUnavailableError(ServiceUnavailableError)
```

LSP_SERVER_UNAVAILABLE.

## LspNotStartedError

```python
class LspNotStartedError(ConflictError)
```

LSP_NOT_STARTED.

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
class GitAuthFailedError(UnauthorizedError)
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

## RateLimitedError

```python
class RateLimitedError(RateLimitError)
```

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
`build_error` is the build's recorded error, when any.

#### ImageBuildFailedError.\_\_init\_\_

```python
def __init__(message: str,
             *,
             status_code: Optional[int] = None,
             code: Optional[str] = None,
             source: Optional[str] = None,
             details: Optional[ErrorDetails] = None,
             image_id: Optional[str] = None,
             build_error: Optional[str] = None) -> None
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

## DaytonaValidationError

```python
DaytonaValidationError = BadRequestError
```

## DaytonaAuthenticationError

```python
DaytonaAuthenticationError = UnauthorizedError
```

## DaytonaAuthorizationError

```python
DaytonaAuthorizationError = ForbiddenError
```

## DaytonaNotFoundError

```python
DaytonaNotFoundError = NotFoundError
```

## DaytonaConflictError

```python
DaytonaConflictError = ConflictError
```

## DaytonaRateLimitError

```python
DaytonaRateLimitError = RateLimitError
```

## DaytonaTimeoutError

```python
DaytonaTimeoutError = ClientTimeoutError
```

## DaytonaConnectionError

```python
DaytonaConnectionError = ConnectionError
```

## DaytonaNotSupportedError

```python
DaytonaNotSupportedError = NotSupportedError
```
