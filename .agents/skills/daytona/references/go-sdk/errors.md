

# errors


## Contents

- Index
- Constants
- Variables
- func ConvertAPIError
- func ConvertToolboxError
- type DaytonaAuthenticationError
- type DaytonaConflictError
- type DaytonaError
- type DaytonaForbiddenError
- type DaytonaNotFoundError
- type DaytonaRateLimitError
- type DaytonaServerError
- type DaytonaTimeoutError
- type DaytonaValidationError
- See Also

```go
import "github.com/daytona/clients/sdk-go/pkg/errors"
```

Package errors defines the typed error model used by the Daytona Go SDK.

Every error returned by the SDK is a \`\*DaytonaError\` carrying a human\-readable message, the HTTP \`StatusCode\` \(when applicable\), an optional machine\-readable \`Code\` / \`Source\` pair, and the response \`Headers\`. There are no per\-status struct types — a single concrete type keeps the surface small and unambiguous.

Branching is done with \`errors.Is\` against the package\-level sentinels:

```
if errors.Is(err, sdkerrors.ErrNotFound) {
    // any HTTP 404 from any source
}
if errors.Is(err, sdkerrors.ErrGitAuthFailed) {
    // precisely DAYTONA_DAEMON / GIT_AUTH_FAILED
}
if errors.Is(err, sdkerrors.ErrAuthentication) {
    // the same git-auth error ALSO matches the broader 401 sentinel,
    // mirroring the inheritance hierarchy of the other Daytona SDKs.
}
```

Reading metadata off an error is done with \`errors.As\`:

```
var de *sdkerrors.DaytonaError
if errors.As(err, &de) {
    log.Printf("status=%d code=%s source=%s", de.StatusCode, de.Code, de.Source)
}
```

## Index

- [Constants](https://www.daytona.io/docs/en<#constants>)
- [Variables](https://www.daytona.io/docs/en<#variables>)
- [func ConvertAPIError\(err error, httpResp \*http.Response\) error](https://www.daytona.io/docs/en<#ConvertAPIError>)
- [func ConvertToolboxError\(err error, httpResp \*http.Response\) error](https://www.daytona.io/docs/en<#ConvertToolboxError>)
- [type DaytonaAuthenticationError](https://www.daytona.io/docs/en<#DaytonaAuthenticationError>)
  - [func NewDaytonaAuthenticationError\(message string, headers http.Header\) \*DaytonaAuthenticationError](https://www.daytona.io/docs/en<#NewDaytonaAuthenticationError>)
  - [func \(e \*DaytonaAuthenticationError\) Unwrap\(\) error](https://www.daytona.io/docs/en<#DaytonaAuthenticationError.Unwrap>)
- [type DaytonaConflictError](https://www.daytona.io/docs/en<#DaytonaConflictError>)
  - [func NewDaytonaConflictError\(message string, headers http.Header\) \*DaytonaConflictError](https://www.daytona.io/docs/en<#NewDaytonaConflictError>)
  - [func \(e \*DaytonaConflictError\) Unwrap\(\) error](https://www.daytona.io/docs/en<#DaytonaConflictError.Unwrap>)
- [type DaytonaError](https://www.daytona.io/docs/en<#DaytonaError>)
  - [func NewDaytonaConnectionError\(message string\) \*DaytonaError](https://www.daytona.io/docs/en<#NewDaytonaConnectionError>)
  - [func NewDaytonaError\(message string, statusCode int, headers http.Header\) \*DaytonaError](https://www.daytona.io/docs/en<#NewDaytonaError>)
  - [func NewDaytonaErrorFromBody\(body \[\]byte, statusCode int, headers http.Header\) \*DaytonaError](<#NewDaytonaErrorFromBody>)
  - [func NewDaytonaTimeoutError\(message string\) \*DaytonaError](https://www.daytona.io/docs/en<#NewDaytonaTimeoutError>)
  - [func NewDaytonaValidationError\(message string, headers http.Header\) \*DaytonaError](https://www.daytona.io/docs/en<#NewDaytonaValidationError>)
  - [func \(e \*DaytonaError\) As\(target any\) bool](https://www.daytona.io/docs/en<#DaytonaError.As>)
  - [func \(e \*DaytonaError\) Error\(\) string](https://www.daytona.io/docs/en<#DaytonaError.Error>)
  - [func \(e \*DaytonaError\) Is\(target error\) bool](https://www.daytona.io/docs/en<#DaytonaError.Is>)
- [type DaytonaForbiddenError](https://www.daytona.io/docs/en<#DaytonaForbiddenError>)
  - [func NewDaytonaForbiddenError\(message string, headers http.Header\) \*DaytonaForbiddenError](https://www.daytona.io/docs/en<#NewDaytonaForbiddenError>)
  - [func \(e \*DaytonaForbiddenError\) Unwrap\(\) error](https://www.daytona.io/docs/en<#DaytonaForbiddenError.Unwrap>)
- [type DaytonaNotFoundError](https://www.daytona.io/docs/en<#DaytonaNotFoundError>)
  - [func NewDaytonaNotFoundError\(message string, headers http.Header\) \*DaytonaNotFoundError](https://www.daytona.io/docs/en<#NewDaytonaNotFoundError>)
  - [func \(e \*DaytonaNotFoundError\) Unwrap\(\) error](https://www.daytona.io/docs/en<#DaytonaNotFoundError.Unwrap>)
- [type DaytonaRateLimitError](https://www.daytona.io/docs/en<#DaytonaRateLimitError>)
  - [func NewDaytonaRateLimitError\(message string, headers http.Header\) \*DaytonaRateLimitError](https://www.daytona.io/docs/en<#NewDaytonaRateLimitError>)
  - [func \(e \*DaytonaRateLimitError\) Unwrap\(\) error](https://www.daytona.io/docs/en<#DaytonaRateLimitError.Unwrap>)
- [type DaytonaServerError](https://www.daytona.io/docs/en<#DaytonaServerError>)
  - [func NewDaytonaServerError\(message string, statusCode int, headers http.Header\) \*DaytonaServerError](https://www.daytona.io/docs/en<#NewDaytonaServerError>)
  - [func \(e \*DaytonaServerError\) Unwrap\(\) error](https://www.daytona.io/docs/en<#DaytonaServerError.Unwrap>)
- [type DaytonaTimeoutError](https://www.daytona.io/docs/en<#DaytonaTimeoutError>)
  - [func \(e \*DaytonaTimeoutError\) Unwrap\(\) error](https://www.daytona.io/docs/en<#DaytonaTimeoutError.Unwrap>)
- [type DaytonaValidationError](https://www.daytona.io/docs/en<#DaytonaValidationError>)
  - [func \(e \*DaytonaValidationError\) Unwrap\(\) error](https://www.daytona.io/docs/en<#DaytonaValidationError.Unwrap>)


## Constants

<a name="SourceAPI"></a>

```go
const (
    SourceAPI    = "DAYTONA_API"
    SourceDaemon = "DAYTONA_DAEMON"
    SourceProxy  = "DAYTONA_PROXY"
)
```

## Variables

<a name="ErrBadRequest"></a>

```go
var (
    // HTTP status-class sentinels. Names follow HTTP terminology.
    ErrBadRequest          = &DaytonaError{StatusCode: http.StatusBadRequest}
    ErrAuthentication      = &DaytonaError{StatusCode: http.StatusUnauthorized}
    ErrForbidden           = &DaytonaError{StatusCode: http.StatusForbidden}
    ErrNotFound            = &DaytonaError{StatusCode: http.StatusNotFound}
    ErrTimeout             = &DaytonaError{StatusCode: http.StatusRequestTimeout}
    ErrConflict            = &DaytonaError{StatusCode: http.StatusConflict}
    ErrGone                = &DaytonaError{StatusCode: http.StatusGone}
    ErrUnprocessableEntity = &DaytonaError{StatusCode: http.StatusUnprocessableEntity}
    ErrRateLimit           = &DaytonaError{StatusCode: http.StatusTooManyRequests}
    ErrInternalServer      = &DaytonaError{StatusCode: http.StatusInternalServerError}
    ErrBadGateway          = &DaytonaError{StatusCode: http.StatusBadGateway}
    ErrServiceUnavailable  = &DaytonaError{StatusCode: http.StatusServiceUnavailable}
    ErrGatewayTimeout      = &DaytonaError{StatusCode: http.StatusGatewayTimeout}

    // Deprecated: use ErrBadRequest. Kept so existing callers do not break.
    ErrValidation = ErrBadRequest
    // Deprecated: use ErrForbidden. Kept so existing callers do not break.
    ErrAuthorization = ErrForbidden

    // Daemon: git.
    ErrGitAuthFailed     = &DaytonaError{Source: SourceDaemon, Code: "GIT_AUTH_FAILED"}
    ErrGitRepoNotFound   = &DaytonaError{Source: SourceDaemon, Code: "GIT_REPO_NOT_FOUND"}
    ErrGitBranchNotFound = &DaytonaError{Source: SourceDaemon, Code: "GIT_BRANCH_NOT_FOUND"}
    ErrGitBranchExists   = &DaytonaError{Source: SourceDaemon, Code: "GIT_BRANCH_EXISTS"}
    ErrGitPushRejected   = &DaytonaError{Source: SourceDaemon, Code: "GIT_PUSH_REJECTED"}
    ErrGitDirtyWorktree  = &DaytonaError{Source: SourceDaemon, Code: "GIT_DIRTY_WORKTREE"}
    ErrGitMergeConflict  = &DaytonaError{Source: SourceDaemon, Code: "GIT_MERGE_CONFLICT"}
    // ErrGitTransportFailed matches network-level git failures: DNS, TLS,
    // connection, timeout.
    ErrGitTransportFailed = &DaytonaError{Source: SourceDaemon, Code: "GIT_TRANSPORT_FAILED"}
    // ErrGitRemoteRejected matches server-side rejections: pre-receive/update
    // hooks, branch protection, size/quota limits.
    ErrGitRemoteRejected = &DaytonaError{Source: SourceDaemon, Code: "GIT_REMOTE_REJECTED"}

    // Daemon: filesystem.
    ErrFileNotFound     = &DaytonaError{Source: SourceDaemon, Code: "FILE_NOT_FOUND"}
    ErrFileAccessDenied = &DaytonaError{Source: SourceDaemon, Code: "FILE_ACCESS_DENIED"}
    // ErrInvalidFilePath matches DAYTONA_DAEMON / INVALID_FILE_PATH (HTTP 400).
    ErrInvalidFilePath = &DaytonaError{Source: SourceDaemon, Code: "INVALID_FILE_PATH"}
    // ErrFileReadFailed matches DAYTONA_DAEMON / FILE_READ_FAILED (HTTP 500).
    ErrFileReadFailed = &DaytonaError{Source: SourceDaemon, Code: "FILE_READ_FAILED"}

    // Daemon: LSP.
    ErrLspServerNotInitialized = &DaytonaError{Source: SourceDaemon, Code: "LSP_SERVER_NOT_INITIALIZED"}

    // Daemon: process / session.
    ErrProcessExecutionTimeout = &DaytonaError{Source: SourceDaemon, Code: "PROCESS_EXECUTION_TIMEOUT"}
    ErrProcessNotFound         = &DaytonaError{Source: SourceDaemon, Code: "PROCESS_NOT_FOUND"}
    ErrSessionEnded            = &DaytonaError{Source: SourceDaemon, Code: "SESSION_ENDED"}
    ErrCommandAlreadyCompleted = &DaytonaError{Source: SourceDaemon, Code: "COMMAND_ALREADY_COMPLETED"}

    // Daemon: computer-use.
    ErrA11yUnavailable         = &DaytonaError{Source: SourceDaemon, Code: "A11Y_UNAVAILABLE"}
    ErrRecordingStillActive    = &DaytonaError{Source: SourceDaemon, Code: "RECORDING_STILL_ACTIVE"}
    ErrRecordingFfmpegNotFound = &DaytonaError{Source: SourceDaemon, Code: "RECORDING_FFMPEG_NOT_FOUND"}
)
```

<a name="ConvertAPIError"></a>
## func ConvertAPIError

```go
func ConvertAPIError(err error, httpResp *http.Response) error
```

ConvertAPIError converts an error returned by the generated api\-client\-go \(and an optional \`\*http.Response\`\) into a \`\*DaytonaError\`.

<a name="ConvertToolboxError"></a>
## func ConvertToolboxError

```go
func ConvertToolboxError(err error, httpResp *http.Response) error
```

ConvertToolboxError converts an error returned by the generated toolbox\-api\-client\-go into a \`\*DaytonaError\`.

<a name="DaytonaAuthenticationError"></a>
## type DaytonaAuthenticationError

Deprecated: match with \`errors.Is\(err, ErrAuthentication\)\` instead.

```go
type DaytonaAuthenticationError struct{ *DaytonaError }
```

<a name="NewDaytonaAuthenticationError"></a>
### func NewDaytonaAuthenticationError

```go
func NewDaytonaAuthenticationError(message string, headers http.Header) *DaytonaAuthenticationError
```

Deprecated: use NewDaytonaError\(message, http.StatusUnauthorized, headers\).

<a name="DaytonaAuthenticationError.Unwrap"></a>
### func \(\*DaytonaAuthenticationError\) Unwrap

```go
func (e *DaytonaAuthenticationError) Unwrap() error
```


<a name="DaytonaConflictError"></a>
## type DaytonaConflictError

Deprecated: match with \`errors.Is\(err, ErrConflict\)\` instead.

```go
type DaytonaConflictError struct{ *DaytonaError }
```

<a name="NewDaytonaConflictError"></a>
### func NewDaytonaConflictError

```go
func NewDaytonaConflictError(message string, headers http.Header) *DaytonaConflictError
```

Deprecated: use NewDaytonaError\(message, http.StatusConflict, headers\).

<a name="DaytonaConflictError.Unwrap"></a>
### func \(\*DaytonaConflictError\) Unwrap

```go
func (e *DaytonaConflictError) Unwrap() error
```


<a name="DaytonaError"></a>
## type DaytonaError

DaytonaError is the single error type returned by the SDK. Use \`errors.As\(err, &target \*DaytonaError\)\` to read its fields and \`errors.Is\(err, sentinel\)\` to branch on the kind.

```go
type DaytonaError struct {
    Message    string
    StatusCode int
    Code       string
    Source     string
    Headers    http.Header
}
```

<a name="NewDaytonaConnectionError"></a>
### func NewDaytonaConnectionError

```go
func NewDaytonaConnectionError(message string) *DaytonaError
```

NewDaytonaConnectionError is a convenience constructor for transport\-level failures with no HTTP response \(DNS, dial, TLS, mid\-request drop\).

<a name="NewDaytonaError"></a>
### func NewDaytonaError

```go
func NewDaytonaError(message string, statusCode int, headers http.Header) *DaytonaError
```

NewDaytonaError builds a DaytonaError with the given message, status code and headers. \`Source\` is left empty for SDK\-internal errors unless the translation layer populates it from a server\-side envelope. Most callers should use this directly; the sentinels below are for branching with \`errors.Is\`, not for constructing errors.

<a name="NewDaytonaErrorFromBody"></a>
### func NewDaytonaErrorFromBody

```go
func NewDaytonaErrorFromBody(body []byte, statusCode int, headers http.Header) *DaytonaError
```

NewDaytonaErrorFromBody parses a JSON response body and builds a DaytonaError. When the body carries its own \`statusCode\` field that overrides the caller\-supplied one \(server\-side envelopes are authoritative\).

<a name="NewDaytonaTimeoutError"></a>
### func NewDaytonaTimeoutError

```go
func NewDaytonaTimeoutError(message string) *DaytonaError
```

NewDaytonaTimeoutError is a convenience constructor for client\-side timeouts. Equivalent to \`NewDaytonaError\(message, http.StatusRequestTimeout, nil\)\`.

<a name="NewDaytonaValidationError"></a>
### func NewDaytonaValidationError

```go
func NewDaytonaValidationError(message string, headers http.Header) *DaytonaError
```

Deprecated: use NewDaytonaError\(message, http.StatusBadRequest, headers\).

<a name="DaytonaError.As"></a>
### func \(\*DaytonaError\) As

```go
func (e *DaytonaError) As(target any) bool
```

As lets \`errors.As\` populate the deprecated typed errors with their original status\-code semantics, even though the SDK only produces \*DaytonaError. Runs only after the stdlib's direct assignability check, so \`errors.As\(err, &de\)\` with a \*DaytonaError target is unaffected.

<a name="DaytonaError.Error"></a>
### func \(\*DaytonaError\) Error

```go
func (e *DaytonaError) Error() string
```


<a name="DaytonaError.Is"></a>
### func \(\*DaytonaError\) Is

```go
func (e *DaytonaError) Is(target error) bool
```

Is implements the \`errors.Is\` contract. A target matches when it is one of the package\-level sentinels and either:

- the target carries a non\-empty \`Code\`, in which case BOTH \`Source\` and \`Code\` must match exactly \(domain\-code sentinel\), or
- the target carries a non\-zero \`StatusCode\`, in which case the receiver's \`StatusCode\` must match \(status\-class sentinel\).

Because the SDK always stamps the HTTP status alongside the domain code, \`errors.Is\(err, ErrGitAuthFailed\)\` and \`errors.Is\(err, ErrAuthentication\)\` both match the same underlying error — mirroring the inheritance hierarchy used by the Python/TypeScript/Java SDKs.

<a name="DaytonaForbiddenError"></a>
## type DaytonaForbiddenError

Deprecated: match with \`errors.Is\(err, ErrForbidden\)\` instead.

```go
type DaytonaForbiddenError struct{ *DaytonaError }
```

<a name="NewDaytonaForbiddenError"></a>
### func NewDaytonaForbiddenError

```go
func NewDaytonaForbiddenError(message string, headers http.Header) *DaytonaForbiddenError
```

Deprecated: use NewDaytonaError\(message, http.StatusForbidden, headers\).

<a name="DaytonaForbiddenError.Unwrap"></a>
### func \(\*DaytonaForbiddenError\) Unwrap

```go
func (e *DaytonaForbiddenError) Unwrap() error
```


<a name="DaytonaNotFoundError"></a>
## type DaytonaNotFoundError

Deprecated: match with \`errors.Is\(err, ErrNotFound\)\` instead.

```go
type DaytonaNotFoundError struct{ *DaytonaError }
```

<a name="NewDaytonaNotFoundError"></a>
### func NewDaytonaNotFoundError

```go
func NewDaytonaNotFoundError(message string, headers http.Header) *DaytonaNotFoundError
```

Deprecated: use NewDaytonaError\(message, http.StatusNotFound, headers\).

<a name="DaytonaNotFoundError.Unwrap"></a>
### func \(\*DaytonaNotFoundError\) Unwrap

```go
func (e *DaytonaNotFoundError) Unwrap() error
```


<a name="DaytonaRateLimitError"></a>
## type DaytonaRateLimitError

Deprecated: match with \`errors.Is\(err, ErrRateLimit\)\` instead.

```go
type DaytonaRateLimitError struct{ *DaytonaError }
```

<a name="NewDaytonaRateLimitError"></a>
### func NewDaytonaRateLimitError

```go
func NewDaytonaRateLimitError(message string, headers http.Header) *DaytonaRateLimitError
```

Deprecated: use NewDaytonaError\(message, http.StatusTooManyRequests, headers\).

<a name="DaytonaRateLimitError.Unwrap"></a>
### func \(\*DaytonaRateLimitError\) Unwrap

```go
func (e *DaytonaRateLimitError) Unwrap() error
```


<a name="DaytonaServerError"></a>
## type DaytonaServerError

Deprecated: match with \`errors.Is\(err, ErrInternalServer\)\` or compare StatusCode \>= 500 on \*DaytonaError instead.

```go
type DaytonaServerError struct{ *DaytonaError }
```

<a name="NewDaytonaServerError"></a>
### func NewDaytonaServerError

```go
func NewDaytonaServerError(message string, statusCode int, headers http.Header) *DaytonaServerError
```

Deprecated: use NewDaytonaError\(message, statusCode, headers\).

<a name="DaytonaServerError.Unwrap"></a>
### func \(\*DaytonaServerError\) Unwrap

```go
func (e *DaytonaServerError) Unwrap() error
```


<a name="DaytonaTimeoutError"></a>
## type DaytonaTimeoutError

Deprecated: match with \`errors.Is\(err, ErrTimeout\)\` or \`errors.Is\(err, ErrGatewayTimeout\)\` instead.

```go
type DaytonaTimeoutError struct{ *DaytonaError }
```

<a name="DaytonaTimeoutError.Unwrap"></a>
### func \(\*DaytonaTimeoutError\) Unwrap

```go
func (e *DaytonaTimeoutError) Unwrap() error
```


<a name="DaytonaValidationError"></a>
## type DaytonaValidationError

Deprecated: match with \`errors.Is\(err, ErrBadRequest\)\` instead.

```go
type DaytonaValidationError struct{ *DaytonaError }
```

<a name="DaytonaValidationError.Unwrap"></a>
### func \(\*DaytonaValidationError\) Unwrap

```go
func (e *DaytonaValidationError) Unwrap() error
```

## See Also
- [TypeScript SDK - errors](../typescript-sdk/errors.md)
- [Java SDK - errors](../java-sdk/errors.md)
