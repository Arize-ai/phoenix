## Contents

- SecretService
- CreateSecretParams
- ListSecretsQuery
- ListSecretsResponse
- UpdateSecretParams
- Secret
- See Also




## SecretService

Service for managing organization-scoped Daytona Secrets.

This service provides methods to create, list, get, update, and delete Secrets. Secrets can be
mounted into Sandboxes as environment variables by referencing them via the `secrets` field on
the create-sandbox parameters. The Sandbox only ever sees the Secret's opaque placeholder; the
real value is substituted at the network egress layer for the Secret's allowed hosts.

### Constructors

#### Constructor

```ts
new SecretService(secretApi: SecretApi): SecretService;
```

**Parameters**:

- `secretApi` _SecretApi_


**Returns**:

- `SecretService`

### Methods

#### create()

```ts
create(params: CreateSecretParams): Promise<Secret>;
```

Creates a new Secret.

**Parameters**:

- `params` _CreateSecretParams_ - Parameters for the new Secret


**Returns**:

- `Promise<Secret>` - The newly created Secret (without the plaintext `value`)

**Throws**:

If a Secret with the same name already exists in the organization

**Example:**

```ts
const daytona = new Daytona();
const secret = await daytona.secret.create({
  name: "anthropic-prod",
  value: "sk-ant-...",
  hosts: ["api.anthropic.com"],
});
console.log(`Created secret ${secret.name} with placeholder ${secret.placeholder}`);
```

#### delete()

```ts
delete(secretId: string): Promise<void>;
```

Deletes a Secret.

**Parameters**:

- `secretId` _string_ - ID of the Secret to delete


**Returns**:

- `Promise<void>`

**Throws**:

If the Secret does not exist

**Example:**

```ts
const daytona = new Daytona();
await daytona.secret.delete("secret-id");
console.log("Secret deleted successfully");
```

#### get()

```ts
get(secretId: string): Promise<Secret>;
```

Gets a Secret by its ID.

**Parameters**:

- `secretId` _string_ - ID of the Secret to retrieve


**Returns**:

- `Promise<Secret>` - The requested Secret

**Throws**:

If the Secret does not exist

**Example:**

```ts
const daytona = new Daytona();
const secret = await daytona.secret.get("secret-id");
console.log(`Secret ${secret.name} can be used on ${secret.hosts.join(', ')}`);
```

#### list()

```ts
list(query?: ListSecretsQuery): Promise<ListSecretsResponse>;
```

Lists Secrets in the organization with cursor-based pagination.

**Parameters**:

- `query?` _ListSecretsQuery_ - Optional filters, sorting, pagination cursor, and per-page size


**Returns**:

- `Promise<ListSecretsResponse>` - A page of Secrets together with the total count and the
    cursor for the next page

**Example:**

```ts
const daytona = new Daytona();
let cursor: string | undefined = undefined;
do {
  const { items, total, nextCursor } = await daytona.secret.list({ cursor, limit: 50 });
  console.log(`Fetched ${items.length} of ${total} secrets`);
  items.forEach(secret => console.log(`${secret.name} (${secret.id})`));
  cursor = nextCursor ?? undefined;
} while (cursor);
```

#### update()

```ts
update(secretId: string, params: UpdateSecretParams): Promise<Secret>;
```

Updates an existing Secret. Omitted fields are left unchanged.

**Parameters**:

- `secretId` _string_ - ID of the Secret to update
- `params` _UpdateSecretParams_ - Fields to update


**Returns**:

- `Promise<Secret>` - The updated Secret

**Throws**:

If the Secret does not exist

**Example:**

```ts
const daytona = new Daytona();
const secret = await daytona.secret.update("secret-id", {
  value: "sk-ant-new-value",
  hosts: ["api.anthropic.com", "*.anthropic.com"],
});
```

***


## CreateSecretParams

Parameters for creating a new Secret.

**Properties**:

- `description?` _string_ - Optional description of the Secret
- `hosts?` _string\[\]_ - Hosts the Secret value may be sent to. Each entry is a hostname
    (`api.example.com`) or a `*.` wildcard (`*.example.com`); ports are not supported. Omit to leave
    the Secret unrestricted.
- `name` _string_ - Name of the Secret. Must match `^[a-zA-Z_][a-zA-Z0-9_-]*$` and be
    unique within the organization.
- `value` _string_ - The plaintext Secret value. Stored encrypted and never returned by the API.
## ListSecretsQuery

Query parameters for listing Secrets with pagination.

**Properties**:

- `cursor?` _string_ - Pagination cursor from a previous response. Omit to fetch the first page.
- `limit?` _number_ - Number of results per page (1-200). Defaults to 100.
- `name?` _string_ - Filters the results to Secrets whose name partially matches the value
- `order?` _ListSecretsPaginatedOrderEnum_ - Direction to sort by. Defaults to `desc`.
- `sort?` _ListSecretsPaginatedSortEnum_ - Field to sort by. Defaults to `createdAt`.
## ListSecretsResponse

Represents a paginated list of Daytona Secrets.

**Properties**:

- `items` _Secret\[\]_ - List of Secrets in the current page.
- `nextCursor` _string_ - Cursor for the next page of results. `null` when there are no more pages.
    - _Inherited from_: `ListSecretsResponseDto.nextCursor`
- `total` _number_ - Total number of Secrets matching the filters.

    - _Inherited from_: `ListSecretsResponseDto.total`


**Extends:**

- `Omit`\<`ListSecretsResponseDto`, `"items"`\>
## UpdateSecretParams

Parameters for updating an existing Secret. Omitted fields are left unchanged.

**Properties**:

- `description?` _string_ - Optional description of the Secret
- `hosts?` _string\[\]_ - Hosts the Secret value may be sent to. Same constraints as
    CreateSecretParams.hosts.
- `value?` _string_ - Replaces the stored Secret value when present
## Secret

```ts
type Secret = SecretModel & {
  __brand: "Secret";
};
```

Represents an organization-scoped Secret.

The plaintext `value` is write-only and is never returned by the API. When a Secret is
referenced from a Sandbox, the injected environment variable holds the opaque
Secret.placeholder token, not the real value. The real value is substituted
transparently on outbound requests to the Secret's allowed Secret.hosts.

### Type Declaration

#### \_\_brand

```ts
__brand: "Secret";
```

## See Also
- [Python SDK - secret](../python-sdk/sync/secret.md)
