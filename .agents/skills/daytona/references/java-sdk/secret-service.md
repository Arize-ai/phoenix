
## SecretService

Service for managing organization-scoped Daytona Secrets.

Secrets can be created, listed, retrieved, updated, and deleted, and referenced when creating a
Sandbox via the `secrets` field on the create-sandbox parameters. The plaintext `value`
is write-only and is never returned by the API; the Sandbox only ever sees the Secret's opaque
placeholder, and the real value is substituted at the network egress layer for the Secret's allowed
hosts.

### Methods

#### create()
```java
public Secret create(CreateSecretParams params)
```

Creates a new Secret.

**Parameters**:

- `params` _CreateSecretParams_ - creation parameters; `name` must match `^[a-zA-Z_][a-zA-Z0-9_-]*$` and be unique within the organization

**Returns**:

- `Secret` - created `Secret` (without the plaintext `value`)

**Throws**:

- `io.daytona.sdk.exception.DaytonaConflictException` - if a Secret with the same name already exists
- `io.daytona.sdk.exception.DaytonaException` - if creation fails

#### list()
```java
public ListSecretsResponse list()
```

Lists Secrets in the organization one page at a time, using default query parameters.
```java
try (Daytona daytona = new Daytona()) {
ListSecretsResponse page = daytona.secret().list();
System.out.printf("Fetched %d of %d secrets%n", page.getItems().size(), page.getTotal());
for (var secret : page.getItems()) {
System.out.println(secret.getName() + " (" + secret.getId() + ")");
}
}
```

**Returns**:

- `ListSecretsResponse` - page of Secrets; `nextCursor` is `null` when there are no more pages

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if the API request fails

#### list()
```java
public ListSecretsResponse list(ListSecretsQuery query)
```

Lists Secrets in the organization one page at a time. Pass the `nextCursor` from a
previous response as the query `cursor` to fetch the next page.
```java
try (Daytona daytona = new Daytona()) {
ListSecretsQuery query = new ListSecretsQuery();
query.setLimit(50);

while (true) {
ListSecretsResponse page = daytona.secret().list(query);
System.out.printf("Fetched %d of %d secrets%n", page.getItems().size(), page.getTotal());
for (var secret : page.getItems()) {
System.out.println(secret.getName() + " (" + secret.getId() + ")");
}
if (page.getNextCursor() == null) {
break;
}
query.setCursor(page.getNextCursor());
}
}
```

**Parameters**:

- `query` _ListSecretsQuery_ - optional filter, sort, and pagination parameters; may be `null`

**Returns**:

- `ListSecretsResponse` - page of Secrets; `nextCursor` is `null` when there are no more pages

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if the API request fails

#### get()
```java
public Secret get(String secretId)
```

Retrieves a Secret by ID.

**Parameters**:

- `secretId` _String_ - Secret identifier

**Returns**:

- `Secret` - matching `Secret`

**Throws**:

- `io.daytona.sdk.exception.DaytonaNotFoundException` - if no Secret with the given ID exists
- `io.daytona.sdk.exception.DaytonaException` - if the request fails

#### update()
```java
public Secret update(String secretId, UpdateSecretParams params)
```

Updates an existing Secret. Omitted (`null`) fields are left unchanged.

**Parameters**:

- `secretId` _String_ - Secret identifier
- `params` _UpdateSecretParams_ - fields to update

**Returns**:

- `Secret` - updated `Secret`

**Throws**:

- `io.daytona.sdk.exception.DaytonaNotFoundException` - if no Secret with the given ID exists
- `io.daytona.sdk.exception.DaytonaException` - if the request fails

#### delete()
```java
public void delete(String secretId)
```

Deletes a Secret by ID.

**Parameters**:

- `secretId` _String_ - Secret identifier

**Throws**:

- `io.daytona.sdk.exception.DaytonaNotFoundException` - if no Secret with the given ID exists
- `io.daytona.sdk.exception.DaytonaException` - if deletion fails
