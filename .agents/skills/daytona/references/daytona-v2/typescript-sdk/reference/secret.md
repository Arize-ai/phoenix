# Secret (TypeScript SDK reference)

## Contents

- [SecretsService](#secretsservice)
- [ListSecretsOptions](#listsecretsoptions)
- [Secret](#secret)
- [SetSecretOptions](#setsecretoptions)

## SecretsService

Service for managing project-scoped secrets.

### Constructors

#### Constructor

```ts
new SecretsService(token: Internal, init: never): SecretsService;
```

Built by the SDK: get it from the client or a sandbox.

**Parameters**:

- `token` _Internal_
- `init` _never_

**Returns**:

- `SecretsService`

### Methods

#### delete()

```ts
delete(name: string): Promise<void>;
```

**Parameters**:

- `name` _string_

**Returns**:

- `Promise<void>`

#### get()

```ts
get(name: string): Promise<Secret>;
```

Gets one secret's metadata (never its value).

**Parameters**:

- `name` _string_

**Returns**:

- `Promise<Secret>`

#### iter()

```ts
iter(options: ListSecretsOptions = {}): AsyncIterable<Secret>;
```

**Parameters**:

- `options` _ListSecretsOptions = \{\}_

**Returns**:

- `AsyncIterable<Secret>`

#### list()

```ts
list(options: ListSecretsOptions = {}): Promise<ListResult<Secret>>;
```

Lists secret metadata for the project (never values).

**Parameters**:

- `options` _ListSecretsOptions = \{\}_

**Returns**:

- `Promise<ListResult<Secret>>`

#### set()

```ts
set(name: string, value: string, options: SetSecretOptions): Promise<Secret>;
```

Creates or updates a secret's value + metadata. The value must not be empty.

**Parameters**:

- `name` _string_
- `value` _string_
- `options` _SetSecretOptions_

**Returns**:

- `Promise<Secret>`

***

## ListSecretsOptions

**Properties**:

- `cursor?` _string_
- `limit?` _number_

***

## Secret

Secret metadata (never the value).

**Properties**:

- `name` _string_
- `allowedDomains` _readonly string\[\]_
- `description?` _string_
- `createdAt` _string_
- `updatedAt` _string_

***

## SetSecretOptions

Options for creating/updating a secret.

**Properties**:

- `allowedDomains` _readonly string\[\]_ - The hosts where this secret's value may be sent (exact or `*.` wildcard),
  or `["*"]` for any verified host. `"*"` lets the value reach any HTTPS
  host, including one a compromised sandbox controls.
- `description?` _string_ - Omitted (or `null`) keeps the stored description of an existing secret,
  read first with `get()` (one more request, not atomic with the write; an
  error from it other than not-found fails the call; no read with
  `ifNotExists`); `''` clears it.
- `ifNotExists?` _boolean_
