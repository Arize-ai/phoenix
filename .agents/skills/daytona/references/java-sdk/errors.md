## Contents

- DaytonaException
- DaytonaA11yUnavailableException
- DaytonaAuthenticationException
- DaytonaBadGatewayException
- DaytonaBadRequestException
- DaytonaCommandAlreadyCompletedException
- DaytonaConflictException
- DaytonaConnectionException
- DaytonaConnectionTimeoutException
- DaytonaFileAccessDeniedException
- DaytonaFileNotFoundException
- DaytonaFileReadFailedException
- DaytonaForbiddenException
- DaytonaGitAuthFailedException
- DaytonaGitBranchExistsException
- DaytonaGitBranchNotFoundException
- DaytonaGitDirtyWorktreeException
- DaytonaGitMergeConflictException
- DaytonaGitPushRejectedException
- DaytonaGitRemoteRejectedException
- DaytonaGitRepoNotFoundException
- DaytonaGitTransportFailedException
- DaytonaGoneException
- DaytonaInternalServerException
- DaytonaInvalidFilePathException
- DaytonaLspServerNotInitializedException
- DaytonaNotFoundException
- DaytonaProcessExecutionTimeoutException
- DaytonaProcessNotFoundException
- DaytonaRateLimitException
- DaytonaRecordingFfmpegNotFoundException
- DaytonaRecordingStillActiveException
- DaytonaServerException
- DaytonaServiceUnavailableException
- DaytonaSessionEndedException
- DaytonaTimeoutException
- DaytonaUnprocessableEntityException
- DaytonaValidationException
- See Also



## DaytonaException

Base exception for all Daytona SDK errors.

Subclasses map to specific HTTP status codes and allow callers to catch
precise failure conditions without string-parsing error messages:
```java
try {
Sandbox sandbox = daytona.sandbox().get("nonexistent-id");
} catch (DaytonaNotFoundException e) {
// sandbox does not exist
} catch (DaytonaAuthenticationException e) {
// invalid API key
} catch (DaytonaException e) {
// other SDK error
}
```

**Properties**:

- `SOURCE_API` _String_ - Wire-format `source` values set by the translation layer when a
Daytona service stamps them on the wire envelope. A `null`
`source` means the response did not carry a structured envelope
(treat as opaque).
- `SOURCE_DAEMON` _String_ -
- `SOURCE_PROXY` _String_ -

### Constructors

#### new DaytonaException()
```java
public DaytonaException(String message)
```

Creates a generic Daytona exception.

**Parameters**:

- `message` _String_ - error description

#### new DaytonaException()
```java
public DaytonaException(String message, Throwable cause)
```

Creates a generic Daytona exception with a cause.

**Parameters**:

- `message` _String_ - error description
- `cause` _Throwable_ - root cause

#### new DaytonaException()
```java
public DaytonaException(int statusCode, String message)
```

Creates a Daytona exception with explicit HTTP status code.

**Parameters**:

- `statusCode` _int_ - HTTP status code
- `message` _String_ - error description

#### new DaytonaException()
```java
public DaytonaException(int statusCode, String message, Throwable cause)
```

Creates a Daytona exception with explicit HTTP status code and a cause.

**Parameters**:

- `statusCode` _int_ - HTTP status code
- `message` _String_ - error description
- `cause` _Throwable_ - root cause

#### new DaytonaException()
```java
public DaytonaException(int statusCode, String message, Map<String, String> headers)
```

Creates a Daytona exception with HTTP status code and headers.

**Parameters**:

- `statusCode` _int_ - HTTP status code
- `message` _String_ - error description
- `headers` _Map\<String, String\>_ - response headers

#### new DaytonaException()
```java
public DaytonaException(int statusCode, String message, Map<String, String> headers, String code, String source)
```

Creates a Daytona exception with HTTP status code, headers, error code, and source.

**Parameters**:

- `statusCode` _int_ - HTTP status code
- `message` _String_ - error description
- `headers` _Map\<String, String\>_ - response headers
- `code` _String_ - machine-readable error code
- `source` _String_ - component that originated the error

#### new DaytonaException()
```java
public DaytonaException(int statusCode, String message, String code, String source)
```

Creates a Daytona exception with HTTP status code, error code, and source.

**Parameters**:

- `statusCode` _int_ - HTTP status code
- `message` _String_ - error description
- `code` _String_ - machine-readable error code
- `source` _String_ - component that originated the error

#### new DaytonaException()
```java
public DaytonaException(int statusCode, String message, Throwable cause, String code, String source)
```

Creates a Daytona exception with HTTP status code, cause, error code, and source.

**Parameters**:

- `statusCode` _int_ - HTTP status code
- `message` _String_ - error description
- `cause` _Throwable_ - root cause
- `code` _String_ - machine-readable error code
- `source` _String_ - component that originated the error

### Methods

#### setPendingHeaders()
```java
public static void setPendingHeaders(Map<String, String> headers)
```

**Parameters**:

- `headers` _Map\<String, String\>_ -

#### clearPendingHeaders()
```java
public static void clearPendingHeaders()
```

#### getStatusCode()
```java
public int getStatusCode()
```

Returns the HTTP status code, or 0 if not applicable.

**Returns**:

- `int` -

#### getHeaders()
```java
public Map<String, String> getHeaders()
```

Returns the HTTP response headers, or an empty map if not available.

**Returns**:

- `Map\<String, String\>` -

#### getCode()
```java
public String getCode()
```

Returns the machine-readable error code, or null if not available.

**Returns**:

- `String` -

#### getSource()
```java
public String getSource()
```

Returns the originating service from the wire envelope. `null`
for SDK-side errors and for responses that don't carry the envelope.
Otherwise one of `#SOURCE_API`, `#SOURCE_DAEMON` or
`#SOURCE_PROXY`.

**Returns**:

- `String` -

## DaytonaA11yUnavailableException

The accessibility (AT-SPI) bus is not reachable.

Subclass of `DaytonaServiceUnavailableException`.

### Constructors

#### new DaytonaA11yUnavailableException()
```java
public DaytonaA11yUnavailableException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaA11yUnavailableException()
```java
public DaytonaA11yUnavailableException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaA11yUnavailableException()
```java
public DaytonaA11yUnavailableException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaA11yUnavailableException()
```java
public DaytonaA11yUnavailableException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaAuthenticationException

Raised when API credentials are missing or invalid (HTTP 401).
```java
try {
daytona.sandbox().create();
} catch (DaytonaAuthenticationException e) {
System.err.println("Invalid or missing API key");
}
```

**Properties**:

- `STATUS_CODE` _int_ - HTTP status code carried by every instance of this class.

### Constructors

#### new DaytonaAuthenticationException()
```java
public DaytonaAuthenticationException(String message)
```

Creates an authentication exception.

**Parameters**:

- `message` _String_ - error description from the API

#### new DaytonaAuthenticationException()
```java
public DaytonaAuthenticationException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ - error description from the API
- `cause` _Throwable_ - root cause

#### new DaytonaAuthenticationException()
```java
public DaytonaAuthenticationException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaAuthenticationException()
```java
public DaytonaAuthenticationException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaBadGatewayException

Raised for HTTP 502 — an upstream dependency rejected or dropped the request.

**Properties**:

- `STATUS_CODE` _int_ -

### Constructors

#### new DaytonaBadGatewayException()
```java
public DaytonaBadGatewayException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaBadGatewayException()
```java
public DaytonaBadGatewayException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaBadGatewayException()
```java
public DaytonaBadGatewayException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaBadGatewayException()
```java
public DaytonaBadGatewayException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaBadRequestException

Raised when the request is malformed or contains invalid parameters (HTTP 400).
```java
try {
daytona.sandbox().create(params);
} catch (DaytonaBadRequestException e) {
System.err.println("Invalid request parameters: " + e.getMessage());
}
```

**Properties**:

- `STATUS_CODE` _int_ - HTTP status code carried by every instance of this class.

### Constructors

#### new DaytonaBadRequestException()
```java
public DaytonaBadRequestException(String message)
```

Creates a bad-request exception.

**Parameters**:

- `message` _String_ - error description from the API

#### new DaytonaBadRequestException()
```java
public DaytonaBadRequestException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ - error description from the API
- `cause` _Throwable_ - root cause

#### new DaytonaBadRequestException()
```java
public DaytonaBadRequestException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaBadRequestException()
```java
public DaytonaBadRequestException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaCommandAlreadyCompletedException

The shell command already finished.

Subclass of `DaytonaGoneException`.

### Constructors

#### new DaytonaCommandAlreadyCompletedException()
```java
public DaytonaCommandAlreadyCompletedException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaCommandAlreadyCompletedException()
```java
public DaytonaCommandAlreadyCompletedException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaCommandAlreadyCompletedException()
```java
public DaytonaCommandAlreadyCompletedException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaCommandAlreadyCompletedException()
```java
public DaytonaCommandAlreadyCompletedException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaConflictException

Raised when an operation conflicts with the current state (HTTP 409).

Common causes: creating a resource with a name that already exists,
or performing an operation incompatible with the resource's current state.
```java
try {
daytona.snapshot().create(params);
} catch (DaytonaConflictException e) {
System.err.println("A snapshot with this name already exists");
}
```

**Properties**:

- `STATUS_CODE` _int_ - HTTP status code carried by every instance of this class.

### Constructors

#### new DaytonaConflictException()
```java
public DaytonaConflictException(String message)
```

Creates a conflict exception.

**Parameters**:

- `message` _String_ - error description from the API

#### new DaytonaConflictException()
```java
public DaytonaConflictException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ - error description from the API
- `cause` _Throwable_ - root cause

#### new DaytonaConflictException()
```java
public DaytonaConflictException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaConflictException()
```java
public DaytonaConflictException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaConnectionException

Raised for network-level connection failures (no HTTP response received).

Raised when the SDK cannot reach the Daytona API due to network issues
such as DNS failure, connection refused, or TLS errors.
```java
try {
daytona.sandbox().create();
} catch (DaytonaConnectionException e) {
System.err.println("Cannot reach Daytona API: " + e.getMessage());
}
```

### Constructors

#### new DaytonaConnectionException()
```java
public DaytonaConnectionException(String message)
```

Creates a connection exception.

**Parameters**:

- `message` _String_ - connection failure description

#### new DaytonaConnectionException()
```java
public DaytonaConnectionException(String message, Throwable cause)
```

Creates a connection exception with a cause.

**Parameters**:

- `message` _String_ - connection failure description
- `cause` _Throwable_ - root cause

#### new DaytonaConnectionException()
```java
public DaytonaConnectionException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaConnectionException()
```java
public DaytonaConnectionException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaConnectionTimeoutException

Raised when the transport layer times out connecting to or reading from a
Daytona service. Subclass of `DaytonaConnectionException` so callers
can catch the broader "connection failed" category.

### Constructors

#### new DaytonaConnectionTimeoutException()
```java
public DaytonaConnectionTimeoutException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaConnectionTimeoutException()
```java
public DaytonaConnectionTimeoutException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaConnectionTimeoutException()
```java
public DaytonaConnectionTimeoutException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaConnectionTimeoutException()
```java
public DaytonaConnectionTimeoutException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaFileAccessDeniedException

Insufficient permissions for the filesystem operation.

Subclass of `DaytonaForbiddenException`.

### Constructors

#### new DaytonaFileAccessDeniedException()
```java
public DaytonaFileAccessDeniedException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaFileAccessDeniedException()
```java
public DaytonaFileAccessDeniedException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaFileAccessDeniedException()
```java
public DaytonaFileAccessDeniedException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaFileAccessDeniedException()
```java
public DaytonaFileAccessDeniedException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaFileNotFoundException

Filesystem entry was not found.

Subclass of `DaytonaNotFoundException`.

### Constructors

#### new DaytonaFileNotFoundException()
```java
public DaytonaFileNotFoundException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaFileNotFoundException()
```java
public DaytonaFileNotFoundException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaFileNotFoundException()
```java
public DaytonaFileNotFoundException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaFileNotFoundException()
```java
public DaytonaFileNotFoundException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaFileReadFailedException

Daemon could not read the requested file (code `FILE_READ_FAILED`, HTTP 500).

Subclass of `DaytonaInternalServerException`.

### Constructors

#### new DaytonaFileReadFailedException()
```java
public DaytonaFileReadFailedException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaFileReadFailedException()
```java
public DaytonaFileReadFailedException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaFileReadFailedException()
```java
public DaytonaFileReadFailedException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaFileReadFailedException()
```java
public DaytonaFileReadFailedException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaForbiddenException

Raised when the authenticated user lacks permission to perform an operation (HTTP 403).
```java
try {
daytona.sandbox().delete(sandboxId);
} catch (DaytonaForbiddenException e) {
System.err.println("Not authorized to delete this sandbox");
}
```

**Properties**:

- `STATUS_CODE` _int_ - HTTP status code carried by every instance of this class.

### Constructors

#### new DaytonaForbiddenException()
```java
public DaytonaForbiddenException(String message)
```

Creates a forbidden exception.

**Parameters**:

- `message` _String_ - error description from the API

#### new DaytonaForbiddenException()
```java
public DaytonaForbiddenException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ - error description from the API
- `cause` _Throwable_ - root cause

#### new DaytonaForbiddenException()
```java
public DaytonaForbiddenException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaForbiddenException()
```java
public DaytonaForbiddenException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaGitAuthFailedException

Git authentication credentials were rejected by the remote.

Subclass of `DaytonaAuthenticationException`.

### Constructors

#### new DaytonaGitAuthFailedException()
```java
public DaytonaGitAuthFailedException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaGitAuthFailedException()
```java
public DaytonaGitAuthFailedException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaGitAuthFailedException()
```java
public DaytonaGitAuthFailedException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaGitAuthFailedException()
```java
public DaytonaGitAuthFailedException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaGitBranchExistsException

A git branch with this name already exists.

Subclass of `DaytonaConflictException`.

### Constructors

#### new DaytonaGitBranchExistsException()
```java
public DaytonaGitBranchExistsException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaGitBranchExistsException()
```java
public DaytonaGitBranchExistsException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaGitBranchExistsException()
```java
public DaytonaGitBranchExistsException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaGitBranchExistsException()
```java
public DaytonaGitBranchExistsException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaGitBranchNotFoundException

The requested git branch does not exist.

Subclass of `DaytonaNotFoundException`.

### Constructors

#### new DaytonaGitBranchNotFoundException()
```java
public DaytonaGitBranchNotFoundException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaGitBranchNotFoundException()
```java
public DaytonaGitBranchNotFoundException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaGitBranchNotFoundException()
```java
public DaytonaGitBranchNotFoundException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaGitBranchNotFoundException()
```java
public DaytonaGitBranchNotFoundException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaGitDirtyWorktreeException

Worktree has uncommitted changes.

Subclass of `DaytonaConflictException`.

### Constructors

#### new DaytonaGitDirtyWorktreeException()
```java
public DaytonaGitDirtyWorktreeException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaGitDirtyWorktreeException()
```java
public DaytonaGitDirtyWorktreeException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaGitDirtyWorktreeException()
```java
public DaytonaGitDirtyWorktreeException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaGitDirtyWorktreeException()
```java
public DaytonaGitDirtyWorktreeException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaGitMergeConflictException

Git merge has conflicts that need manual resolution.

Subclass of `DaytonaConflictException`.

### Constructors

#### new DaytonaGitMergeConflictException()
```java
public DaytonaGitMergeConflictException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaGitMergeConflictException()
```java
public DaytonaGitMergeConflictException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaGitMergeConflictException()
```java
public DaytonaGitMergeConflictException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaGitMergeConflictException()
```java
public DaytonaGitMergeConflictException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaGitPushRejectedException

Git push was rejected (non-fast-forward / stale ref).

Subclass of `DaytonaConflictException`.

### Constructors

#### new DaytonaGitPushRejectedException()
```java
public DaytonaGitPushRejectedException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaGitPushRejectedException()
```java
public DaytonaGitPushRejectedException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaGitPushRejectedException()
```java
public DaytonaGitPushRejectedException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaGitPushRejectedException()
```java
public DaytonaGitPushRejectedException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaGitRemoteRejectedException

The git remote rejected the operation (hooks, branch protection or quota).

Subclass of `DaytonaUnprocessableEntityException`.

### Constructors

#### new DaytonaGitRemoteRejectedException()
```java
public DaytonaGitRemoteRejectedException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaGitRemoteRejectedException()
```java
public DaytonaGitRemoteRejectedException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaGitRemoteRejectedException()
```java
public DaytonaGitRemoteRejectedException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaGitRemoteRejectedException()
```java
public DaytonaGitRemoteRejectedException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaGitRepoNotFoundException

The requested git repository does not exist.

Subclass of `DaytonaNotFoundException`.

### Constructors

#### new DaytonaGitRepoNotFoundException()
```java
public DaytonaGitRepoNotFoundException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaGitRepoNotFoundException()
```java
public DaytonaGitRepoNotFoundException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaGitRepoNotFoundException()
```java
public DaytonaGitRepoNotFoundException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaGitRepoNotFoundException()
```java
public DaytonaGitRepoNotFoundException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaGitTransportFailedException

The git remote was unreachable (DNS, TLS, connection or timeout failure).

Subclass of `DaytonaBadGatewayException`.

### Constructors

#### new DaytonaGitTransportFailedException()
```java
public DaytonaGitTransportFailedException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaGitTransportFailedException()
```java
public DaytonaGitTransportFailedException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaGitTransportFailedException()
```java
public DaytonaGitTransportFailedException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaGitTransportFailedException()
```java
public DaytonaGitTransportFailedException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaGoneException

Raised for HTTP 410 — the target resource is permanently gone.

**Properties**:

- `STATUS_CODE` _int_ -

### Constructors

#### new DaytonaGoneException()
```java
public DaytonaGoneException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaGoneException()
```java
public DaytonaGoneException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaGoneException()
```java
public DaytonaGoneException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaGoneException()
```java
public DaytonaGoneException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaInternalServerException

Raised for HTTP 500 — server-side bug or unhandled condition.

**Properties**:

- `STATUS_CODE` _int_ -

### Constructors

#### new DaytonaInternalServerException()
```java
public DaytonaInternalServerException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaInternalServerException()
```java
public DaytonaInternalServerException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaInternalServerException()
```java
public DaytonaInternalServerException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaInternalServerException()
```java
public DaytonaInternalServerException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaInvalidFilePathException

Supplied file path was rejected by the daemon (code `INVALID_FILE_PATH`, HTTP 400).

Subclass of `DaytonaBadRequestException`.

### Constructors

#### new DaytonaInvalidFilePathException()
```java
public DaytonaInvalidFilePathException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaInvalidFilePathException()
```java
public DaytonaInvalidFilePathException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaInvalidFilePathException()
```java
public DaytonaInvalidFilePathException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaInvalidFilePathException()
```java
public DaytonaInvalidFilePathException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaLspServerNotInitializedException

LSP server must be started via /lsp/start first.

Subclass of `DaytonaBadRequestException`.

### Constructors

#### new DaytonaLspServerNotInitializedException()
```java
public DaytonaLspServerNotInitializedException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaLspServerNotInitializedException()
```java
public DaytonaLspServerNotInitializedException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaLspServerNotInitializedException()
```java
public DaytonaLspServerNotInitializedException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaLspServerNotInitializedException()
```java
public DaytonaLspServerNotInitializedException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaNotFoundException

Raised when a requested resource does not exist (HTTP 404).

**Properties**:

- `STATUS_CODE` _int_ - HTTP status code carried by every instance of this class.

### Constructors

#### new DaytonaNotFoundException()
```java
public DaytonaNotFoundException(String message)
```

Creates a not-found exception.

**Parameters**:

- `message` _String_ - error description from the API

#### new DaytonaNotFoundException()
```java
public DaytonaNotFoundException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ - error description from the API
- `cause` _Throwable_ - root cause

#### new DaytonaNotFoundException()
```java
public DaytonaNotFoundException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaNotFoundException()
```java
public DaytonaNotFoundException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaProcessExecutionTimeoutException

A process exceeded its configured execution timeout.

Subclass of `DaytonaTimeoutException`.

### Constructors

#### new DaytonaProcessExecutionTimeoutException()
```java
public DaytonaProcessExecutionTimeoutException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaProcessExecutionTimeoutException()
```java
public DaytonaProcessExecutionTimeoutException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaProcessExecutionTimeoutException()
```java
public DaytonaProcessExecutionTimeoutException(int statusCode, String message, String code, String source)
```

**Parameters**:

- `statusCode` _int_ -
- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaProcessExecutionTimeoutException()
```java
public DaytonaProcessExecutionTimeoutException(int statusCode, String message, Throwable cause, String code, String source)
```

**Parameters**:

- `statusCode` _int_ -
- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaProcessExecutionTimeoutException()
```java
public DaytonaProcessExecutionTimeoutException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaProcessExecutionTimeoutException()
```java
public DaytonaProcessExecutionTimeoutException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaProcessNotFoundException

The requested process is not running.

Subclass of `DaytonaNotFoundException`.

### Constructors

#### new DaytonaProcessNotFoundException()
```java
public DaytonaProcessNotFoundException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaProcessNotFoundException()
```java
public DaytonaProcessNotFoundException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaProcessNotFoundException()
```java
public DaytonaProcessNotFoundException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaProcessNotFoundException()
```java
public DaytonaProcessNotFoundException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaRateLimitException

Raised when API rate limits are exceeded (HTTP 429).

**Properties**:

- `STATUS_CODE` _int_ - HTTP status code carried by every instance of this class.

### Constructors

#### new DaytonaRateLimitException()
```java
public DaytonaRateLimitException(String message)
```

Creates a rate-limit exception.

**Parameters**:

- `message` _String_ - error description from the API

#### new DaytonaRateLimitException()
```java
public DaytonaRateLimitException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ - error description from the API
- `cause` _Throwable_ - root cause

#### new DaytonaRateLimitException()
```java
public DaytonaRateLimitException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaRateLimitException()
```java
public DaytonaRateLimitException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaRecordingFfmpegNotFoundException

ffmpeg binary is not installed; required for recording.

Subclass of `DaytonaServiceUnavailableException`.

### Constructors

#### new DaytonaRecordingFfmpegNotFoundException()
```java
public DaytonaRecordingFfmpegNotFoundException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaRecordingFfmpegNotFoundException()
```java
public DaytonaRecordingFfmpegNotFoundException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaRecordingFfmpegNotFoundException()
```java
public DaytonaRecordingFfmpegNotFoundException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaRecordingFfmpegNotFoundException()
```java
public DaytonaRecordingFfmpegNotFoundException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaRecordingStillActiveException

The recording is still running; stop it first.

Subclass of `DaytonaConflictException`.

### Constructors

#### new DaytonaRecordingStillActiveException()
```java
public DaytonaRecordingStillActiveException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaRecordingStillActiveException()
```java
public DaytonaRecordingStillActiveException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaRecordingStillActiveException()
```java
public DaytonaRecordingStillActiveException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaRecordingStillActiveException()
```java
public DaytonaRecordingStillActiveException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaServerException

Raised for unexpected server-side failures (HTTP 5xx).

These are typically transient and safe to retry with exponential backoff.
```java
try {
daytona.sandbox().create();
} catch (DaytonaServerException e) {
System.err.println("Server error (status " + e.getStatusCode() + "), retry later");
}
```

### Constructors

#### new DaytonaServerException()
```java
public DaytonaServerException(int statusCode, String message)
```

Creates a server exception.

**Parameters**:

- `statusCode` _int_ - HTTP status code (typically 5xx)
- `message` _String_ - error description from the API

#### new DaytonaServerException()
```java
public DaytonaServerException(int statusCode, String message, Throwable cause)
```

**Parameters**:

- `statusCode` _int_ - HTTP status code (typically 5xx)
- `message` _String_ - error description from the API
- `cause` _Throwable_ - root cause

#### new DaytonaServerException()
```java
public DaytonaServerException(int statusCode, String message, String code, String source)
```

**Parameters**:

- `statusCode` _int_ -
- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaServerException()
```java
public DaytonaServerException(int statusCode, String message, Throwable cause, String code, String source)
```

**Parameters**:

- `statusCode` _int_ -
- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaServiceUnavailableException

Raised for HTTP 503 — the service is temporarily refusing traffic.

**Properties**:

- `STATUS_CODE` _int_ -

### Constructors

#### new DaytonaServiceUnavailableException()
```java
public DaytonaServiceUnavailableException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaServiceUnavailableException()
```java
public DaytonaServiceUnavailableException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaServiceUnavailableException()
```java
public DaytonaServiceUnavailableException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaServiceUnavailableException()
```java
public DaytonaServiceUnavailableException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaSessionEndedException

The shell session has ended.

Subclass of `DaytonaGoneException`.

### Constructors

#### new DaytonaSessionEndedException()
```java
public DaytonaSessionEndedException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaSessionEndedException()
```java
public DaytonaSessionEndedException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaSessionEndedException()
```java
public DaytonaSessionEndedException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaSessionEndedException()
```java
public DaytonaSessionEndedException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaTimeoutException

Raised when an SDK operation times out.

Client-side transport timeouts default to HTTP 408, but mapped HTTP 504
(or any server-supplied timeout status) is preserved when available.

**Properties**:

- `STATUS_CODE` _int_ -

### Constructors

#### new DaytonaTimeoutException()
```java
public DaytonaTimeoutException(String message, Throwable cause)
```

Creates a timeout exception with a cause.

**Parameters**:

- `message` _String_ - timeout description
- `cause` _Throwable_ - root cause

#### new DaytonaTimeoutException()
```java
public DaytonaTimeoutException(String message)
```

Creates a timeout exception.

**Parameters**:

- `message` _String_ - timeout description

#### new DaytonaTimeoutException()
```java
public DaytonaTimeoutException(int statusCode, String message, String code, String source)
```

**Parameters**:

- `statusCode` _int_ -
- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaTimeoutException()
```java
public DaytonaTimeoutException(int statusCode, String message, Throwable cause, String code, String source)
```

**Parameters**:

- `statusCode` _int_ -
- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaTimeoutException()
```java
public DaytonaTimeoutException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaTimeoutException()
```java
public DaytonaTimeoutException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaUnprocessableEntityException

Raised for HTTP 422 — the request is well-formed but semantically invalid
(e.g. unsupported resource class, invalid configuration values).
```java
try {
daytona.sandbox().create(params);
} catch (DaytonaUnprocessableEntityException e) {
System.err.println("Unprocessable entity: " + e.getMessage());
}
```

**Properties**:

- `STATUS_CODE` _int_ - HTTP status code carried by every instance of this class.

### Constructors

#### new DaytonaUnprocessableEntityException()
```java
public DaytonaUnprocessableEntityException(String message)
```

**Parameters**:

- `message` _String_ -

#### new DaytonaUnprocessableEntityException()
```java
public DaytonaUnprocessableEntityException(String message, Throwable cause)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -

#### new DaytonaUnprocessableEntityException()
```java
public DaytonaUnprocessableEntityException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaUnprocessableEntityException()
```java
public DaytonaUnprocessableEntityException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## DaytonaValidationException

Raised for semantic validation failures (HTTP 422).

The mapper throws this subclass for 422 responses so that pre-existing
`catch (DaytonaValidationException e)` blocks keep matching, while
`catch (DaytonaUnprocessableEntityException e)` also matches via the
parent class.

Exists for backward compatibility only. Deleting this class (and
switching the 422 case in `ExceptionMapper` back to the parent) is
the whole removal.

**Deprecated**: Use `DaytonaUnprocessableEntityException` instead.

### Constructors

#### new DaytonaValidationException()
```java
public DaytonaValidationException(String message)
```

Creates a validation exception.

**Parameters**:

- `message` _String_ - error description

#### new DaytonaValidationException()
```java
public DaytonaValidationException(String message, Throwable cause)
```

Creates a validation exception with a cause.

**Parameters**:

- `message` _String_ - error description
- `cause` _Throwable_ - root cause

#### new DaytonaValidationException()
```java
public DaytonaValidationException(String message, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `code` _String_ -
- `source` _String_ -

#### new DaytonaValidationException()
```java
public DaytonaValidationException(String message, Throwable cause, String code, String source)
```

**Parameters**:

- `message` _String_ -
- `cause` _Throwable_ -
- `code` _String_ -
- `source` _String_ -

## See Also
- [TypeScript SDK - errors](../typescript-sdk/errors.md)
