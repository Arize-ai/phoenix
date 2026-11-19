# Shared errors (TypeScript SDK reference)

## Contents

- [DaytonaError](#daytonaerror)
- [DaytonaBadRequestError](#daytonabadrequesterror)
- [DaytonaAuthenticationError](#daytonaauthenticationerror)
- [DaytonaForbiddenError](#daytonaforbiddenerror)
- [DaytonaNotFoundError](#daytonanotfounderror)
- [DaytonaTimeoutError](#daytonatimeouterror)
- [DaytonaConflictError](#daytonaconflicterror)
- [DaytonaGoneError](#daytonagoneerror)
- [DaytonaUnprocessableEntityError](#daytonaunprocessableentityerror)
- [DaytonaRateLimitError](#daytonaratelimiterror)
- [DaytonaInternalServerError](#daytonainternalservererror)
- [DaytonaServiceUnavailableError](#daytonaserviceunavailableerror)
- [DaytonaConnectionError](#daytonaconnectionerror)
- [DaytonaAuthorizationError](#daytonaauthorizationerror)
- [DaytonaValidationError](#daytonavalidationerror)

## DaytonaError

**Properties**:

- `statusCode?` _number_
- `code?` _string_
- `source?` _string_

### Constructors

#### Constructor

```ts
new DaytonaError(message = ''): DaytonaError;
```

**Parameters**:

- `message` _string = ''_

**Returns**:

- `DaytonaError`

### Methods

#### \[Symbol.hasInstance\]()

```ts
[Symbol.hasInstance](value: unknown): boolean;
```

**Parameters**:

- `value` _unknown_

**Returns**:

- `boolean`

***

## DaytonaBadRequestError

***

## DaytonaAuthenticationError

***

## DaytonaForbiddenError

***

## DaytonaNotFoundError

***

## DaytonaTimeoutError

***

## DaytonaConflictError

***

## DaytonaGoneError

***

## DaytonaUnprocessableEntityError

***

## DaytonaRateLimitError

***

## DaytonaInternalServerError

***

## DaytonaServiceUnavailableError

***

## DaytonaConnectionError

***

## DaytonaAuthorizationError

```ts
export { DaytonaForbiddenError as DaytonaAuthorizationError }
```

Alias of `DaytonaForbiddenError`.

***

## DaytonaValidationError

```ts
export { DaytonaBadRequestError as DaytonaValidationError }
```

Alias of `DaytonaBadRequestError`.
