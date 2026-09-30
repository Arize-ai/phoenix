## Contents

- DaytonaA11yUnavailableError
- DaytonaAuthenticationError
- ~~DaytonaAuthorizationError~~
- DaytonaBadGatewayError
- DaytonaBadRequestError
- DaytonaCommandAlreadyCompletedError
- DaytonaConflictError
- DaytonaConnectionError
- DaytonaConnectionTimeoutError
- DaytonaError
- DaytonaFileAccessDeniedError
- DaytonaFileNotFoundError
- DaytonaFileReadFailedError
- DaytonaForbiddenError
- DaytonaGitAuthFailedError
- DaytonaGitBranchExistsError
- DaytonaGitBranchNotFoundError
- DaytonaGitDirtyWorktreeError
- DaytonaGitMergeConflictError
- DaytonaGitPushRejectedError
- DaytonaGitRemoteRejectedError
- DaytonaGitRepoNotFoundError
- DaytonaGitTransportFailedError
- DaytonaGoneError
- DaytonaInternalServerError
- DaytonaInvalidArgumentError
- DaytonaInvalidFilePathError
- DaytonaLspServerNotInitializedError
- DaytonaNotFoundError
- DaytonaProcessExecutionTimeoutError
- DaytonaProcessNotFoundError
- DaytonaRateLimitError
- DaytonaRecordingFfmpegNotFoundError
- DaytonaRecordingStillActiveError
- DaytonaServiceUnavailableError
- DaytonaSessionEndedError
- DaytonaTimeoutError
- DaytonaUnprocessableEntityError
- ~~DaytonaValidationError~~
- createAxiosDaytonaError()
- createDaytonaError()
- errorClassFromStatusCode()
- ResponseHeaders
- SOURCE\_API
- SOURCE\_DAEMON
- SOURCE\_PROXY




## DaytonaA11yUnavailableError

The accessibility service is unavailable (code `A11Y_UNAVAILABLE`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaServiceUnavailableError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaServiceUnavailableError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaServiceUnavailableError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaServiceUnavailableError.statusCode`


**Extends:**

- `DaytonaServiceUnavailableError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaServiceUnavailableError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaA11yUnavailableError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaA11yUnavailableError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaA11yUnavailableError`

##### Inherited from

`DaytonaServiceUnavailableError`.`constructor`
## DaytonaAuthenticationError

Authentication failed — missing or invalid credentials (HTTP 401).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaGitAuthFailedError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaAuthenticationError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaAuthenticationError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaAuthenticationError`

##### Inherited from

`DaytonaError`.`constructor`
## ~~DaytonaAuthorizationError~~

### Deprecated

**Properties**:

- ~~`code?`~~ _string_
    - _Inherited from_: `DaytonaForbiddenError.code`
- ~~`headers?`~~ _AxiosHeaders_
    - _Inherited from_: `DaytonaForbiddenError.headers`
- ~~`source?`~~ _string_
    - _Inherited from_: `DaytonaForbiddenError.source`
- ~~`statusCode?`~~ _number_
    - _Inherited from_: `DaytonaForbiddenError.statusCode`


Use DaytonaForbiddenError instead.

**Extends:**

- `DaytonaForbiddenError`

### Accessors

#### ~~errorCode~~

_Inherited from_: `DaytonaForbiddenError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaAuthorizationError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaAuthorizationError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaAuthorizationError`

##### Inherited from

`DaytonaForbiddenError`.`constructor`
## DaytonaBadGatewayError

An upstream gateway returned an invalid response (HTTP 502).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaGitTransportFailedError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaBadGatewayError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaBadGatewayError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaBadGatewayError`

##### Inherited from

`DaytonaError`.`constructor`
## DaytonaBadRequestError

The request was malformed or invalid (HTTP 400).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaValidationError`
- `DaytonaInvalidFilePathError`
- `DaytonaLspServerNotInitializedError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaBadRequestError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaBadRequestError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaBadRequestError`

##### Inherited from

`DaytonaError`.`constructor`
## DaytonaCommandAlreadyCompletedError

The session command already finished (code `COMMAND_ALREADY_COMPLETED`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaGoneError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaGoneError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaGoneError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaGoneError.statusCode`


**Extends:**

- `DaytonaGoneError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaGoneError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaCommandAlreadyCompletedError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaCommandAlreadyCompletedError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaCommandAlreadyCompletedError`

##### Inherited from

`DaytonaGoneError`.`constructor`
## DaytonaConflictError

The request conflicts with the current state of the resource (HTTP 409).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaGitBranchExistsError`
- `DaytonaGitPushRejectedError`
- `DaytonaGitDirtyWorktreeError`
- `DaytonaGitMergeConflictError`
- `DaytonaRecordingStillActiveError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaConflictError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaConflictError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaConflictError`

##### Inherited from

`DaytonaError`.`constructor`
## DaytonaConnectionError

Network connection failure (can't connect or mid-request drop).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaConnectionTimeoutError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaConnectionError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaConnectionError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaConnectionError`

##### Inherited from

`DaytonaError`.`constructor`
## DaytonaConnectionTimeoutError

Transport-layer timeout (connect / read). Subclass of DaytonaConnectionError.

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaConnectionError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaConnectionError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaConnectionError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaConnectionError.statusCode`


**Extends:**

- `DaytonaConnectionError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaConnectionError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaConnectionTimeoutError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaConnectionTimeoutError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaConnectionTimeoutError`

##### Inherited from

`DaytonaConnectionError`.`constructor`
## DaytonaError

Base error for Daytona SDK. `statusCode` and `code` are populated only
for errors translated from a server response. `source` is `undefined`
unless the caller (or the translation layer) sets it.

**Properties**:

- `code?` _string_
- `headers?` _AxiosHeaders_
- `source?` _string_
- `statusCode?` _number_


**Extends:**

- `Error`

### Extended by

- `DaytonaBadRequestError`
- `DaytonaAuthenticationError`
- `DaytonaForbiddenError`
- `DaytonaNotFoundError`
- `DaytonaTimeoutError`
- `DaytonaConflictError`
- `DaytonaGoneError`
- `DaytonaUnprocessableEntityError`
- `DaytonaRateLimitError`
- `DaytonaInternalServerError`
- `DaytonaBadGatewayError`
- `DaytonaServiceUnavailableError`
- `DaytonaConnectionError`

### Accessors

#### errorCode

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaError`

##### Overrides

```ts
Error.constructor
```
## DaytonaFileAccessDeniedError

Access to the sandbox file was denied (code `FILE_ACCESS_DENIED`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaForbiddenError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaForbiddenError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaForbiddenError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaForbiddenError.statusCode`


**Extends:**

- `DaytonaForbiddenError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaForbiddenError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaFileAccessDeniedError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaFileAccessDeniedError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaFileAccessDeniedError`

##### Inherited from

`DaytonaForbiddenError`.`constructor`
## DaytonaFileNotFoundError

The file does not exist in the sandbox (code `FILE_NOT_FOUND`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaNotFoundError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaNotFoundError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaNotFoundError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaNotFoundError.statusCode`


**Extends:**

- `DaytonaNotFoundError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaNotFoundError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaFileNotFoundError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaFileNotFoundError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaFileNotFoundError`

##### Inherited from

`DaytonaNotFoundError`.`constructor`
## DaytonaFileReadFailedError

The daemon could not read the sandbox file (code `FILE_READ_FAILED`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaInternalServerError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaInternalServerError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaInternalServerError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaInternalServerError.statusCode`


**Extends:**

- `DaytonaInternalServerError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaInternalServerError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaFileReadFailedError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaFileReadFailedError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaFileReadFailedError`

##### Inherited from

`DaytonaInternalServerError`.`constructor`
## DaytonaForbiddenError

The authenticated caller lacks permission for the operation (HTTP 403).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaAuthorizationError`
- `DaytonaFileAccessDeniedError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaForbiddenError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaForbiddenError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaForbiddenError`

##### Inherited from

`DaytonaError`.`constructor`
## DaytonaGitAuthFailedError

Git authentication against the remote failed (code `GIT_AUTH_FAILED`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaAuthenticationError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaAuthenticationError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaAuthenticationError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaAuthenticationError.statusCode`


**Extends:**

- `DaytonaAuthenticationError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaAuthenticationError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaGitAuthFailedError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaGitAuthFailedError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaGitAuthFailedError`

##### Inherited from

`DaytonaAuthenticationError`.`constructor`
## DaytonaGitBranchExistsError

The git branch already exists (code `GIT_BRANCH_EXISTS`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaConflictError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaConflictError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaConflictError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaConflictError.statusCode`


**Extends:**

- `DaytonaConflictError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaConflictError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaGitBranchExistsError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaGitBranchExistsError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaGitBranchExistsError`

##### Inherited from

`DaytonaConflictError`.`constructor`
## DaytonaGitBranchNotFoundError

The git branch does not exist (code `GIT_BRANCH_NOT_FOUND`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaNotFoundError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaNotFoundError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaNotFoundError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaNotFoundError.statusCode`


**Extends:**

- `DaytonaNotFoundError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaNotFoundError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaGitBranchNotFoundError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaGitBranchNotFoundError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaGitBranchNotFoundError`

##### Inherited from

`DaytonaNotFoundError`.`constructor`
## DaytonaGitDirtyWorktreeError

The operation requires a clean worktree (code `GIT_DIRTY_WORKTREE`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaConflictError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaConflictError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaConflictError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaConflictError.statusCode`


**Extends:**

- `DaytonaConflictError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaConflictError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaGitDirtyWorktreeError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaGitDirtyWorktreeError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaGitDirtyWorktreeError`

##### Inherited from

`DaytonaConflictError`.`constructor`
## DaytonaGitMergeConflictError

A git merge produced conflicts (code `GIT_MERGE_CONFLICT`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaConflictError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaConflictError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaConflictError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaConflictError.statusCode`


**Extends:**

- `DaytonaConflictError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaConflictError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaGitMergeConflictError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaGitMergeConflictError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaGitMergeConflictError`

##### Inherited from

`DaytonaConflictError`.`constructor`
## DaytonaGitPushRejectedError

The git push was rejected by the remote (code `GIT_PUSH_REJECTED`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaConflictError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaConflictError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaConflictError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaConflictError.statusCode`


**Extends:**

- `DaytonaConflictError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaConflictError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaGitPushRejectedError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaGitPushRejectedError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaGitPushRejectedError`

##### Inherited from

`DaytonaConflictError`.`constructor`
## DaytonaGitRemoteRejectedError

The git remote rejected the operation — hooks, branch protection or quota (code `GIT_REMOTE_REJECTED`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaUnprocessableEntityError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaUnprocessableEntityError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaUnprocessableEntityError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaUnprocessableEntityError.statusCode`


**Extends:**

- `DaytonaUnprocessableEntityError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaUnprocessableEntityError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaGitRemoteRejectedError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaGitRemoteRejectedError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaGitRemoteRejectedError`

##### Inherited from

`DaytonaUnprocessableEntityError`.`constructor`
## DaytonaGitRepoNotFoundError

The git remote repository was not found (code `GIT_REPO_NOT_FOUND`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaNotFoundError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaNotFoundError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaNotFoundError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaNotFoundError.statusCode`


**Extends:**

- `DaytonaNotFoundError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaNotFoundError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaGitRepoNotFoundError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaGitRepoNotFoundError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaGitRepoNotFoundError`

##### Inherited from

`DaytonaNotFoundError`.`constructor`
## DaytonaGitTransportFailedError

The git remote was unreachable — DNS, TLS, connection or timeout failure (code `GIT_TRANSPORT_FAILED`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaBadGatewayError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaBadGatewayError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaBadGatewayError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaBadGatewayError.statusCode`


**Extends:**

- `DaytonaBadGatewayError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaBadGatewayError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaGitTransportFailedError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaGitTransportFailedError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaGitTransportFailedError`

##### Inherited from

`DaytonaBadGatewayError`.`constructor`
## DaytonaGoneError

The resource existed but is permanently gone (HTTP 410).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaSessionEndedError`
- `DaytonaCommandAlreadyCompletedError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaGoneError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaGoneError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaGoneError`

##### Inherited from

`DaytonaError`.`constructor`
## DaytonaInternalServerError

A Daytona service failed unexpectedly (HTTP 500).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaFileReadFailedError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaInternalServerError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaInternalServerError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaInternalServerError`

##### Inherited from

`DaytonaError`.`constructor`
## DaytonaInvalidArgumentError

The SDK rejected the caller's arguments locally, before any request was
sent. `statusCode`, `code` and `source` are always `undefined` — no Daytona
service was contacted, so there is no HTTP status to report.

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaValidationError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaValidationError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaValidationError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaValidationError.statusCode`


Distinct from DaytonaBadRequestError (a service returned HTTP 400)
and DaytonaUnprocessableEntityError (a service returned HTTP 422).
This one always means: fix the arguments at the call site.

**Example:**

```ts
try {
  await sandbox.setAutoStopInterval(-1)
} catch (err) {
  if (err instanceof DaytonaInvalidArgumentError) {
    // never reached the API — the value itself is invalid
  }
}
```

**Extends:**

- `DaytonaValidationError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaValidationError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaInvalidArgumentError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaInvalidArgumentError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaInvalidArgumentError`

##### Inherited from

`DaytonaValidationError`.`constructor`
## DaytonaInvalidFilePathError

The supplied file path was rejected by the daemon (code `INVALID_FILE_PATH`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaBadRequestError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaBadRequestError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaBadRequestError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaBadRequestError.statusCode`


**Extends:**

- `DaytonaBadRequestError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaBadRequestError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaInvalidFilePathError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaInvalidFilePathError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaInvalidFilePathError`

##### Inherited from

`DaytonaBadRequestError`.`constructor`
## DaytonaLspServerNotInitializedError

The LSP server must be initialized first (code `LSP_SERVER_NOT_INITIALIZED`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaBadRequestError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaBadRequestError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaBadRequestError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaBadRequestError.statusCode`


**Extends:**

- `DaytonaBadRequestError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaBadRequestError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaLspServerNotInitializedError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaLspServerNotInitializedError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaLspServerNotInitializedError`

##### Inherited from

`DaytonaBadRequestError`.`constructor`
## DaytonaNotFoundError

The requested resource does not exist (HTTP 404).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaGitRepoNotFoundError`
- `DaytonaGitBranchNotFoundError`
- `DaytonaFileNotFoundError`
- `DaytonaProcessNotFoundError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaNotFoundError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaNotFoundError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaNotFoundError`

##### Inherited from

`DaytonaError`.`constructor`
## DaytonaProcessExecutionTimeoutError

Command execution exceeded its timeout (code `PROCESS_EXECUTION_TIMEOUT`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaTimeoutError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaTimeoutError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaTimeoutError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaTimeoutError.statusCode`


**Extends:**

- `DaytonaTimeoutError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaTimeoutError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaProcessExecutionTimeoutError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaProcessExecutionTimeoutError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaProcessExecutionTimeoutError`

##### Inherited from

`DaytonaTimeoutError`.`constructor`

### Methods

#### \[hasInstance\]()

```ts
static hasInstance: boolean;
```

**Parameters**:

- `value` _unknown_


**Returns**:

- `boolean`

##### Inherited from

`DaytonaTimeoutError`.[`[hasInstance]`](#hasinstance-1)
## DaytonaProcessNotFoundError

The sandbox process does not exist (code `PROCESS_NOT_FOUND`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaNotFoundError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaNotFoundError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaNotFoundError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaNotFoundError.statusCode`


**Extends:**

- `DaytonaNotFoundError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaNotFoundError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaProcessNotFoundError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaProcessNotFoundError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaProcessNotFoundError`

##### Inherited from

`DaytonaNotFoundError`.`constructor`
## DaytonaRateLimitError

The caller exceeded a rate limit (HTTP 429).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaRateLimitError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaRateLimitError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaRateLimitError`

##### Inherited from

`DaytonaError`.`constructor`
## DaytonaRecordingFfmpegNotFoundError

ffmpeg is not available for recording (code `RECORDING_FFMPEG_NOT_FOUND`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaServiceUnavailableError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaServiceUnavailableError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaServiceUnavailableError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaServiceUnavailableError.statusCode`


**Extends:**

- `DaytonaServiceUnavailableError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaServiceUnavailableError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaRecordingFfmpegNotFoundError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaRecordingFfmpegNotFoundError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaRecordingFfmpegNotFoundError`

##### Inherited from

`DaytonaServiceUnavailableError`.`constructor`
## DaytonaRecordingStillActiveError

A screen recording is still active (code `RECORDING_STILL_ACTIVE`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaConflictError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaConflictError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaConflictError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaConflictError.statusCode`


**Extends:**

- `DaytonaConflictError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaConflictError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaRecordingStillActiveError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaRecordingStillActiveError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaRecordingStillActiveError`

##### Inherited from

`DaytonaConflictError`.`constructor`
## DaytonaServiceUnavailableError

The service is temporarily unable to handle the request (HTTP 503).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaA11yUnavailableError`
- `DaytonaRecordingFfmpegNotFoundError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaServiceUnavailableError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaServiceUnavailableError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaServiceUnavailableError`

##### Inherited from

`DaytonaError`.`constructor`
## DaytonaSessionEndedError

The session has already ended (code `SESSION_ENDED`).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaGoneError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaGoneError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaGoneError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaGoneError.statusCode`


**Extends:**

- `DaytonaGoneError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaGoneError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaSessionEndedError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaSessionEndedError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaSessionEndedError`

##### Inherited from

`DaytonaGoneError`.`constructor`
## DaytonaTimeoutError

The operation timed out (HTTP 408, or 504 when a gateway timed out).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


Also matches DaytonaConnectionTimeoutError via `instanceof`, even
though that class sits under DaytonaConnectionError in the prototype
chain. Transport timeouts were raised as `DaytonaTimeoutError` before
`DaytonaConnectionTimeoutError` existed, so this keeps pre-existing
`catch (err) { if (err instanceof DaytonaTimeoutError) ... }` blocks working
— the same compatibility the Python SDK gets from inheriting both classes.

**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaProcessExecutionTimeoutError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaTimeoutError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaTimeoutError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaTimeoutError`

##### Inherited from

`DaytonaError`.`constructor`

### Methods

#### \[hasInstance\]()

```ts
static hasInstance: boolean;
```

**Parameters**:

- `value` _unknown_


**Returns**:

- `boolean`
## DaytonaUnprocessableEntityError

The request was well-formed but semantically invalid (HTTP 422).

**Properties**:

- `code?` _string_
    - _Inherited from_: `DaytonaError.code`
- `headers?` _AxiosHeaders_
    - _Inherited from_: `DaytonaError.headers`
- `source?` _string_
    - _Inherited from_: `DaytonaError.source`
- `statusCode?` _number_
    - _Inherited from_: `DaytonaError.statusCode`


**Extends:**

- `DaytonaError`

### Extended by

- `DaytonaGitRemoteRejectedError`

### Accessors

#### errorCode

_Inherited from_: `DaytonaError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaUnprocessableEntityError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaUnprocessableEntityError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaUnprocessableEntityError`

##### Inherited from

`DaytonaError`.`constructor`
## ~~DaytonaValidationError~~

Legacy umbrella for validation failures. Kept so existing
`catch (err) { if (err instanceof DaytonaValidationError) ... }` blocks keep
matching both server-returned HTTP 400s and locally rejected arguments.

**Properties**:

- ~~`code?`~~ _string_
    - _Inherited from_: `DaytonaBadRequestError.code`
- ~~`headers?`~~ _AxiosHeaders_
    - _Inherited from_: `DaytonaBadRequestError.headers`
- ~~`source?`~~ _string_
    - _Inherited from_: `DaytonaBadRequestError.source`
- ~~`statusCode?`~~ _number_
    - _Inherited from_: `DaytonaBadRequestError.statusCode`


### Deprecated

Do not throw or catch this directly in new code. Branch on the
precise class instead:
- DaytonaInvalidArgumentError — the SDK rejected your arguments
  locally, before any request was sent.
- DaytonaBadRequestError — a Daytona service returned HTTP 400.
- DaytonaUnprocessableEntityError — a Daytona service returned
  HTTP 422 (well-formed but semantically invalid).

**Extends:**

- `DaytonaBadRequestError`

### Extended by

- `DaytonaInvalidArgumentError`

### Accessors

#### ~~errorCode~~

_Inherited from_: `DaytonaBadRequestError.errorCode`

##### Get Signature

```ts
get errorCode(): string;
```

###### Deprecated

Use DaytonaError.code instead. Kept so existing
`err.errorCode` reads keep returning the machine-readable code.

**Returns**:

- `string` - the machine-readable error code, or `undefined` when the
    response did not carry one (same as DaytonaError.code)

### Constructors

#### Constructor

```ts
new DaytonaValidationError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaValidationError;
```

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaValidationError`

##### Inherited from

`DaytonaBadRequestError`.`constructor`
## createAxiosDaytonaError()

```ts
function createAxiosDaytonaError(error: AxiosError): DaytonaError;
```

Creates the appropriate Daytona error subclass from an Axios error. Maps
client-side timeouts to DaytonaConnectionTimeoutError, networking failures
(no response received) to DaytonaConnectionError, and HTTP responses to
the most specific subclass via `createDaytonaError`.

**Parameters**:

- `error` _AxiosError_


**Returns**:

- `DaytonaError`

***


## createDaytonaError()

```ts
function createDaytonaError(
   message: string,
   statusCode?: number,
   headers?: AxiosHeaders,
   code?: string,
   source?: string
): DaytonaError;
```

Creates the appropriate Daytona error subclass from structured error metadata.

Resolution order: (source, code) override -> HTTP status code -> DaytonaError.

**Parameters**:

- `message` _string_
- `statusCode?` _number_
- `headers?` _AxiosHeaders_
- `code?` _string_
- `source?` _string_


**Returns**:

- `DaytonaError`

***


## errorClassFromStatusCode()

```ts
function errorClassFromStatusCode(statusCode?: number): typeof DaytonaError;
```

Maps an HTTP status code to the corresponding Daytona error class.

**Parameters**:

- `statusCode?` _number_


### Returns

*typeof* `DaytonaError`

***


## ResponseHeaders

```ts
type ResponseHeaders = InstanceType<typeof AxiosHeaders>;
```

***


## SOURCE\_API

```ts
const SOURCE_API: "DAYTONA_API" = 'DAYTONA_API';
```

Wire-format `source` identifiers set by the translation layer when a
Daytona service stamps them on the wire envelope. `source = undefined`
means the response did not carry a structured envelope (treat as opaque).

***


## SOURCE\_DAEMON

```ts
const SOURCE_DAEMON: "DAYTONA_DAEMON" = 'DAYTONA_DAEMON';
```

***


## SOURCE\_PROXY

```ts
const SOURCE_PROXY: "DAYTONA_PROXY" = 'DAYTONA_PROXY';
```
