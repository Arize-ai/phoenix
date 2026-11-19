# Secret (Python SDK reference)

## Contents

- [SecretsService](#secretsservice)
- [AsyncSecretsService](#asyncsecretsservice)
- [Secret](#secret)

## SecretsService

```python
class SecretsService()
```

Project secret namespace.

Project-scoped secrets: named key/value pairs stored
encrypted in the project. Attach one or more to a sandbox at creation via
the `secrets` create parameter (a list of names). Attached secrets are
available to outbound HTTPS requests to their allowed domains, not plain
HTTP requests. Their values never enter the sandbox and are never returned
by the API (write-only).

#### SecretsService.\_\_init\_\_

```python
def __init__() -> None
```

#### SecretsService.delete

```python
def delete(name: str, /) -> None
```

Delete a secret.

#### SecretsService.get

```python
def get(name: str, /) -> Secret
```

Fetch one secret's metadata (never its value).

#### SecretsService.iter

```python
def iter(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> Iterator[Secret]
```

#### SecretsService.list

```python
def list(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> ListResult[Secret]
```

List secret metadata.

#### SecretsService.set

```python
def set(name: str,
        value: str,
        /,
        *,
        allowed_domains: Sequence[str],
        description: Optional[str] = None,
        if_not_exists: bool = False) -> Secret
```

Create or update a write-only secret.

`value` must not be empty. `allowed_domains`: The hosts where this
secret's value may be sent (exact or `*.` wildcard), or `["*"]` for
any verified host. `"*"` lets the value reach any HTTPS host,
including one a compromised sandbox controls. `description` omitted
(or `None`) keeps the stored description of an existing secret, read
first with `get` (one more request, not atomic with the write; an
error from it other than not-found fails the call; no read with
`if_not_exists=True`); `""` clears it.

## AsyncSecretsService

```python
class AsyncSecretsService()
```

Project secret namespace.

Project-scoped secrets: named key/value pairs stored
encrypted in the project. Attach one or more to a sandbox at creation via
the `secrets` create parameter (a list of names). Attached secrets are
available to outbound HTTPS requests to their allowed domains, not plain
HTTP requests. Their values never enter the sandbox and are never returned
by the API (write-only).

#### AsyncSecretsService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncSecretsService.list

```python
async def list(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> ListResult[Secret]
```

List secret metadata.

#### AsyncSecretsService.iter

```python
async def iter(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> AsyncIterator[Secret]
```

#### AsyncSecretsService.get

```python
async def get(name: str, /) -> Secret
```

Fetch one secret's metadata (never its value).

#### AsyncSecretsService.set

```python
async def set(name: str,
              value: str,
              /,
              *,
              allowed_domains: Sequence[str],
              description: Optional[str] = None,
              if_not_exists: bool = False) -> Secret
```

Create or update a write-only secret.

`value` must not be empty. `allowed_domains`: The hosts where this
secret's value may be sent (exact or `*.` wildcard), or `["*"]` for
any verified host. `"*"` lets the value reach any HTTPS host,
including one a compromised sandbox controls. `description` omitted
(or `None`) keeps the stored description of an existing secret, read
first with `get` (one more request, not atomic with the write; an
error from it other than not-found fails the call; no read with
`if_not_exists=True`); `""` clears it.

#### AsyncSecretsService.delete

```python
async def delete(name: str, /) -> None
```

Delete a secret.

## Secret

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class Secret()
```

A project secret's metadata; the value is write-only and never returned.

**Attributes**:

- `name` _str_
- `allowed_domains` _tuple\[str, ...\]_
- `created_at` _datetime_
- `updated_at` _datetime_
- `description` _Optional\[str\] = None_
