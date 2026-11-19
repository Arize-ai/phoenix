# Shared errors (TypeScript SDK reference)

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
