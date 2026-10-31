## Contents

- DaytonaError
- DaytonaNotFoundError
- DaytonaAuthenticationError
- DaytonaForbiddenError
- DaytonaRateLimitError
- DaytonaConflictError
- DaytonaBadRequestError
- DaytonaTimeoutError
- DaytonaConnectionError
- DaytonaConnectionTimeoutError
- DaytonaGoneError
- DaytonaUnprocessableEntityError
- DaytonaInternalServerError
- DaytonaBadGatewayError
- DaytonaServiceUnavailableError
- DaytonaGitAuthFailedError
- DaytonaGitRepoNotFoundError
- DaytonaGitBranchNotFoundError
- DaytonaGitBranchExistsError
- DaytonaGitPushRejectedError
- DaytonaGitDirtyWorktreeError
- DaytonaGitMergeConflictError
- DaytonaGitTransportFailedError
- DaytonaGitRemoteRejectedError
- DaytonaFileNotFoundError
- DaytonaFileAccessDeniedError
- DaytonaInvalidFilePathError
- DaytonaFileReadFailedError
- DaytonaLspServerNotInitializedError
- DaytonaProcessExecutionTimeoutError
- DaytonaProcessNotFoundError
- DaytonaSessionEndedError
- DaytonaCommandAlreadyCompletedError
- DaytonaA11yUnavailableError
- DaytonaRecordingStillActiveError
- DaytonaRecordingFfmpegNotFoundError



##### SOURCE\_API

```python
SOURCE_API = "DAYTONA_API"
```

Wire-format ``source`` identifier for errors originating from the Daytona
API. ``source = None`` means the response did not carry a structured
envelope (treat as opaque).

##### SOURCE\_DAEMON

```python
SOURCE_DAEMON = "DAYTONA_DAEMON"
```

Wire-format ``source`` identifier for errors originating from the sandbox
daemon (toolbox).

##### SOURCE\_PROXY

```python
SOURCE_PROXY = "DAYTONA_PROXY"
```

Wire-format ``source`` identifier for errors originating from the Daytona
proxy.

## DaytonaError

```python
class DaytonaError(Exception)
```

Base error for Daytona SDK.

**Example**:

```python
try:
    sandbox = daytona.get("missing-sandbox")
except DaytonaError as exc:
    print(exc.status_code)
    print(exc.code)
    print(exc.message)
```


**Attributes**:

- `message` _str_ - Error message
- `status_code` _int | None_ - HTTP status code (set only for errors translated
  from an HTTP response; ``None`` for client-side errors).
- `code` _str | None_ - Machine-readable error code from the server envelope
  (``None`` for client-side errors).
- `source` _str | None_ - Originating service. ``None`` when the response
  did not carry a structured envelope. Otherwise one of
  :data:`SOURCE_API`, :data:`SOURCE_DAEMON`, :data:`SOURCE_PROXY`.
- `headers` _dict[str, Any]_ - Response headers (empty for client-side errors).

#### DaytonaError.\_\_init\_\_

```python
def __init__(message: str,
             status_code: int | None = None,
             headers: Mapping[str, Any] | None = None,
             code: str | None = None,
             source: str | None = None)
```

Initialize Daytona error.

**Arguments**:

- `message` _str_ - Error message
- `status_code` _int | None_ - HTTP status code if the error came from a
  Daytona service response.
- `headers` _Mapping[str, Any] | None_ - Response headers if available
- `code` _str | None_ - Machine-readable error code from the wire envelope
- `source` _str | None_ - Originating service from the wire envelope.
  Left as ``None`` for SDK-side errors and for responses from
  services that don't emit the envelope.

#### DaytonaError.error\_code

```python
@property
def error_code() -> str | None
```

Deprecated alias of :attr:`code`, kept for backward compatibility.

## DaytonaNotFoundError

```python
class DaytonaNotFoundError(DaytonaError)
```

Error for when a resource is not found (HTTP 404).

**Example**:

```python
try:
    sandbox.fs.download_file("/workspace/missing.txt")
except DaytonaNotFoundError as exc:
    print(exc.status_code)
```

## DaytonaAuthenticationError

```python
class DaytonaAuthenticationError(DaytonaError)
```

Error for when authentication fails (HTTP 401).

**Example**:

```python
try:
    for sandbox in daytona.list():
        print(sandbox.id)
except DaytonaAuthenticationError as exc:
    print(exc.status_code)
```

## DaytonaForbiddenError

```python
class DaytonaForbiddenError(DaytonaError)
```

Error for when the request is forbidden (HTTP 403).

**Example**:

```python
try:
    daytona.get("sandbox-without-access")
except DaytonaForbiddenError as exc:
    print(exc.message)
```

## DaytonaRateLimitError

```python
class DaytonaRateLimitError(DaytonaError)
```

Error for when rate limit is exceeded (HTTP 429).

**Example**:

```python
try:
    for sandbox in daytona.list():
        print(sandbox.id)
except DaytonaRateLimitError as exc:
    print(exc.code)
```

## DaytonaConflictError

```python
class DaytonaConflictError(DaytonaError)
```

Error for when a resource conflict occurs (HTTP 409).

**Example**:

```python
try:
    params = CreateSandboxFromSnapshotParams(name="existing-sandbox")
    daytona.create(params)
except DaytonaConflictError as exc:
    print(exc.code)
```

## DaytonaBadRequestError

```python
class DaytonaBadRequestError(DaytonaError)
```

Error for malformed requests (HTTP 400).

The deprecated ``DaytonaValidationError`` alias remains for older callers
that historically grouped both HTTP 400 and HTTP 422 validation failures
under one name. New code should catch ``DaytonaBadRequestError`` and
``DaytonaUnprocessableEntityError`` explicitly.

**Example**:

```python
try:
    Image.debian_slim("3.8")
except DaytonaBadRequestError as exc:
    print(exc.message)
```

## DaytonaTimeoutError

```python
class DaytonaTimeoutError(DaytonaError)
```

Error for when a timeout occurs.

**Example**:

```python
try:
    sandbox.wait_for_sandbox_start(timeout=1)
except DaytonaTimeoutError as exc:
    print(exc.message)
```

## DaytonaConnectionError

```python
class DaytonaConnectionError(DaytonaError)
```

Error for when a network connection fails (can't connect or mid-request drop).

## DaytonaConnectionTimeoutError

```python
class DaytonaConnectionTimeoutError(DaytonaConnectionError,
                                    DaytonaTimeoutError)
```

Error for when the transport layer times out connecting or reading from a Daytona service.

## DaytonaGoneError

```python
class DaytonaGoneError(DaytonaError)
```

Error for HTTP 410 — the target resource is permanently gone.

## DaytonaUnprocessableEntityError

```python
class DaytonaUnprocessableEntityError(DaytonaError)
```

Error for HTTP 422 — request is well-formed but semantically invalid.

## DaytonaInternalServerError

```python
class DaytonaInternalServerError(DaytonaError)
```

Error for HTTP 500 — server-side bug or unhandled condition.

## DaytonaBadGatewayError

```python
class DaytonaBadGatewayError(DaytonaError)
```

Error for HTTP 502 — an upstream dependency rejected or dropped the request.

## DaytonaServiceUnavailableError

```python
class DaytonaServiceUnavailableError(DaytonaError)
```

Error for HTTP 503 — the service is temporarily refusing traffic.

## DaytonaGitAuthFailedError

```python
class DaytonaGitAuthFailedError(DaytonaAuthenticationError)
```

Git auth credentials were rejected by the remote.

## DaytonaGitRepoNotFoundError

```python
class DaytonaGitRepoNotFoundError(DaytonaNotFoundError)
```

The requested git repository does not exist.

## DaytonaGitBranchNotFoundError

```python
class DaytonaGitBranchNotFoundError(DaytonaNotFoundError)
```

The requested git branch does not exist.

## DaytonaGitBranchExistsError

```python
class DaytonaGitBranchExistsError(DaytonaConflictError)
```

A git branch with this name already exists.

## DaytonaGitPushRejectedError

```python
class DaytonaGitPushRejectedError(DaytonaConflictError)
```

Git push was rejected (non-fast-forward / stale ref).

## DaytonaGitDirtyWorktreeError

```python
class DaytonaGitDirtyWorktreeError(DaytonaConflictError)
```

Worktree has uncommitted changes.

## DaytonaGitMergeConflictError

```python
class DaytonaGitMergeConflictError(DaytonaConflictError)
```

Git merge has conflicts that need manual resolution.

## DaytonaGitTransportFailedError

```python
class DaytonaGitTransportFailedError(DaytonaBadGatewayError)
```

The git remote was unreachable (DNS, TLS, connection or timeout failure).

## DaytonaGitRemoteRejectedError

```python
class DaytonaGitRemoteRejectedError(DaytonaUnprocessableEntityError)
```

The git remote rejected the operation (hooks, branch protection or quota).

## DaytonaFileNotFoundError

```python
class DaytonaFileNotFoundError(DaytonaNotFoundError)
```

Filesystem entry was not found.

## DaytonaFileAccessDeniedError

```python
class DaytonaFileAccessDeniedError(DaytonaForbiddenError)
```

Insufficient permissions for the filesystem operation.

## DaytonaInvalidFilePathError

```python
class DaytonaInvalidFilePathError(DaytonaBadRequestError)
```

The daemon rejected the supplied file path (code ``INVALID_FILE_PATH``).

## DaytonaFileReadFailedError

```python
class DaytonaFileReadFailedError(DaytonaInternalServerError)
```

The daemon could not read the sandbox file (code ``FILE_READ_FAILED``).

## DaytonaLspServerNotInitializedError

```python
class DaytonaLspServerNotInitializedError(DaytonaBadRequestError)
```

LSP server must be started via /lsp/start first.

## DaytonaProcessExecutionTimeoutError

```python
class DaytonaProcessExecutionTimeoutError(DaytonaTimeoutError)
```

A process exceeded its configured execution timeout.

## DaytonaProcessNotFoundError

```python
class DaytonaProcessNotFoundError(DaytonaNotFoundError)
```

The requested process is not running.

## DaytonaSessionEndedError

```python
class DaytonaSessionEndedError(DaytonaGoneError)
```

The shell session has ended.

## DaytonaCommandAlreadyCompletedError

```python
class DaytonaCommandAlreadyCompletedError(DaytonaGoneError)
```

The shell command already finished.

## DaytonaA11yUnavailableError

```python
class DaytonaA11yUnavailableError(DaytonaServiceUnavailableError)
```

The accessibility (AT-SPI) bus is not reachable.

## DaytonaRecordingStillActiveError

```python
class DaytonaRecordingStillActiveError(DaytonaConflictError)
```

The recording is still running; stop it first.

## DaytonaRecordingFfmpegNotFoundError

```python
class DaytonaRecordingFfmpegNotFoundError(DaytonaServiceUnavailableError)
```

ffmpeg binary is not installed; required for recording.

#### error\_class\_from\_status\_code

```python
def error_class_from_status_code(
        status_code: int | None) -> type[DaytonaError]
```

Map an HTTP status code to the corresponding DaytonaError subclass.

#### create\_daytona\_error

```python
def create_daytona_error(message: str,
                         status_code: int | None = None,
                         headers: Mapping[str, Any] | None = None,
                         code: str | None = None,
                         source: str | None = None) -> DaytonaError
```

Create the appropriate DaytonaError subclass from structured error metadata.

Resolution order: ``(source, code)`` exact match → HTTP status code → base
:class:`DaytonaError`.

##### DaytonaAuthorizationError

```python
DaytonaAuthorizationError = DaytonaForbiddenError
```

Deprecated alias for :class:`DaytonaForbiddenError`. Kept so existing
``except DaytonaAuthorizationError`` blocks continue to work.

##### DaytonaValidationError

```python
DaytonaValidationError = DaytonaBadRequestError
```

Deprecated alias for :class:`DaytonaBadRequestError`. Kept so existing
``except DaytonaValidationError`` blocks continue to work.
