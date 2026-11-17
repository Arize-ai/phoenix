# Secret (TypeScript SDK reference)

## Contents

- [SecretService](#secretservice)
- [ListSecretsOptions](#listsecretsoptions)
- [Secret](#secret)
- [SetSecretOptions](#setsecretoptions)

## SecretService

Service for managing project-scoped secrets.

### Constructors

#### Constructor

```ts
new SecretService(api: AxiosInstance): SecretService;
```

**Parameters**:

- `api` _AxiosInstance_

**Returns**:

- `SecretService`

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

Creates or updates a secret's value + metadata.

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

```ts
type Secret = api.Secret
```

Secret metadata (never the value).

***

## SetSecretOptions

Options for creating/updating a secret.

**Properties**:

- `allowedDomains` _string\[\]_ - The hosts where this secret's value may be sent (exact or `*.` wildcard),
  or `["*"]` for any verified host. `"*"` lets the value reach any HTTPS
  host, including one a compromised sandbox controls.
- `description?` _string_
- `ifNotExists?` _boolean_
