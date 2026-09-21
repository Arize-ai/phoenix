## Contents

- Secret
- SecretService
- ListSecretsResponse
- CreateSecretParams
- UpdateSecretParams


> For the async version, see [async/secret.md](../async/secret.md)


## Secret

```python
class Secret(SecretDto)
```

Represents an organization-scoped Daytona Secret.

The plaintext ``value`` is write-only and is never returned by the API. When a Secret is
referenced from a Sandbox, the injected environment variable holds the opaque ``placeholder``
token, not the real value. The real value is substituted transparently on outbound requests
to the Secret's allowed ``hosts``.

**Attributes**:

- `id` _str_ - Unique identifier for the Secret.
- `name` _str_ - Name of the Secret (unique within the organization).
- `description` _str | None_ - Optional description of the Secret.
- `placeholder` _str_ - Opaque token injected as the env var value in Sandboxes.
- `hosts` _list[str]_ - Hosts the Secret value may be sent to (may be empty).
- `created_at` _datetime_ - Date and time when the Secret was created.
- `updated_at` _datetime_ - Date and time when the Secret was last updated.

## SecretService

```python
class SecretService()
```

Service for managing organization-scoped Daytona Secrets.

Can be used to create, list, get, update and delete Secrets. Secrets can be mounted into
Sandboxes as environment variables by referencing them via the ``secrets`` field on the
create-sandbox parameters. The Sandbox only ever sees the Secret's opaque placeholder; the
real value is substituted at the network egress layer for the Secret's allowed hosts.

#### SecretService.list

```python
@with_instrumentation()
def list(cursor: str | None = None,
         limit: int | None = None,
         name: str | None = None,
         sort: str | None = None,
         order: str | None = None) -> ListSecretsResponse
```

List Secrets in the organization using cursor-based pagination.

**Arguments**:

- `cursor` _str | None_ - Pagination cursor from a previous response. Omit to start
  from the first page.
- `limit` _int | None_ - Number of results per page (1-200). Defaults to 100.
- `name` _str | None_ - Filter by partial name match.
- `sort` _str | None_ - Field to sort by (``name``, ``createdAt`` or ``updatedAt``).
  Defaults to ``createdAt``.
- `order` _str | None_ - Direction to sort by (``asc`` or ``desc``). Defaults to ``desc``.


**Returns**:

- `ListSecretsResponse` - The current page of Secrets, the total number of Secrets
  matching the filters and the cursor for the next page (``None`` when there
  are no more pages).


**Example**:

```python
daytona = Daytona()
cursor = None
while True:
    page = daytona.secret.list(cursor=cursor, limit=50)
    print(f"Fetched {len(page.items)} of {page.total} secrets")
    for secret in page.items:
        print(f"{secret.name} ({secret.id})")
    if page.next_cursor is None:
        break
    cursor = page.next_cursor
```

#### SecretService.get

```python
@with_instrumentation()
def get(secret_id: str) -> Secret
```

Get a Secret by its ID.

**Arguments**:

- `secret_id` _str_ - ID of the Secret to retrieve.


**Returns**:

- `Secret` - The requested Secret.


**Raises**:

- `NotFoundException` - If the Secret does not exist.


**Example**:

```python
daytona = Daytona()
secret = daytona.secret.get("secret-id")
print(f"{secret.name} can be used on {', '.join(secret.hosts)}")
```

#### SecretService.create

```python
@with_instrumentation()
def create(params: CreateSecretParams) -> Secret
```

Create a new Secret.

**Arguments**:

- `params` _CreateSecretParams_ - Parameters for the new Secret.


**Returns**:

- `Secret` - The newly created Secret (without the plaintext ``value``).


**Raises**:

- `ApiException` - If a Secret with the same name already exists in the organization (409).


**Example**:

```python
daytona = Daytona()
secret = daytona.secret.create(
    CreateSecretParams(
        name="anthropic-prod",
        value="sk-ant-...",
        hosts=["api.anthropic.com"],
    )
)
print(f"Created secret {secret.name} with placeholder {secret.placeholder}")
```

#### SecretService.update

```python
@with_instrumentation()
def update(secret_id: str, params: UpdateSecretParams) -> Secret
```

Update an existing Secret. Omitted fields are left unchanged.

**Arguments**:

- `secret_id` _str_ - ID of the Secret to update.
- `params` _UpdateSecretParams_ - Fields to update.


**Returns**:

- `Secret` - The updated Secret.


**Raises**:

- `NotFoundException` - If the Secret does not exist.


**Example**:

```python
daytona = Daytona()
secret = daytona.secret.update(
    "secret-id",
    UpdateSecretParams(
        value="sk-ant-new-value",
        hosts=["api.anthropic.com", "*.anthropic.com"],
    ),
)
```

#### SecretService.delete

```python
@with_instrumentation()
def delete(secret_id: str) -> None
```

Delete a Secret.

**Arguments**:

- `secret_id` _str_ - ID of the Secret to delete.


**Raises**:

- `NotFoundException` - If the Secret does not exist.


**Example**:

```python
daytona = Daytona()
daytona.secret.delete("secret-id")
print("Secret deleted")
```

## ListSecretsResponse

```python
class ListSecretsResponse(ListSecretsResponseDto)
```

Represents a paginated list of Daytona Secrets.

**Attributes**:

- `items` _list[Secret]_ - List of Secret instances in the current page.
- `total` _int_ - Total number of Secrets matching the filters.
- `next_cursor` _str | None_ - Cursor for the next page of results, or ``None``
  when there are no more pages.

## CreateSecretParams

```python
class CreateSecretParams(BaseModel)
```

Parameters for creating a new Secret.

**Attributes**:

- `name` _str_ - Name of the Secret. Must match ``^[a-zA-Z_][a-zA-Z0-9_-]*$`` and be unique
  within the organization.
- `value` _str_ - The plaintext Secret value. Stored encrypted and never returned by the API.
- `description` _str | None_ - Optional description of the Secret.
- `hosts` _list[str] | None_ - Hosts the Secret value may be sent to. Each entry is a hostname
  (``api.example.com``) or a ``*.`` wildcard (``*.example.com``); ports are not supported.
  Omit to leave the Secret unrestricted.

## UpdateSecretParams

```python
class UpdateSecretParams(BaseModel)
```

Parameters for updating an existing Secret. Omitted fields are left unchanged.

**Attributes**:

- `value` _str | None_ - Replaces the stored Secret value when present.
- `description` _str | None_ - Optional description of the Secret.
- `hosts` _list[str] | None_ - Hosts the Secret value may be sent to. Same constraints as
  :class:`CreateSecretParams.hosts`.
