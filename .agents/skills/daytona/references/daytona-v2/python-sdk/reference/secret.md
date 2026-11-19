# Secret (Python SDK reference)

## Contents

- [SecretService](#secretservice)
- [AsyncSecretService](#asyncsecretservice)
- [Secret](#secret)

## SecretService

```python
class SecretService()
```

Project secret namespace.

#### SecretService.\_\_init\_\_

```python
def __init__(impl: AsyncSecretService, bridge: SyncBridge) -> None
```

#### SecretService.delete

```python
def delete(name: str) -> None
```

Delete a secret.

#### SecretService.get

```python
def get(name: str) -> Secret
```

Fetch one secret's metadata (never its value).

#### SecretService.iter

```python
def iter(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> Iterator[Secret]
```

#### SecretService.list

```python
def list(*,
         cursor: Optional[str] = None,
         limit: Optional[int] = None) -> ListResult[Secret]
```

List secret metadata.

#### SecretService.set

```python
def set(name: str,
        value: str,
        *,
        allowed_domains: Sequence[str],
        description: Optional[str] = None,
        if_not_exists: bool = False) -> Secret
```

Create or update a write-only secret.

## AsyncSecretService

```python
class AsyncSecretService()
```

Project secret namespace.

Project-scoped secrets: named key/value pairs stored
encrypted in the project. Attach one or more to a sandbox at creation via
the `secrets` create parameter (a list of names). Attached secrets are
available to outbound HTTPS requests to their allowed domains, not plain
HTTP requests. Their values never enter the sandbox and are never returned
by the API (write-only).

#### AsyncSecretService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncSecretService.list

```python
async def list(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> ListResult[Secret]
```

List secret metadata.

#### AsyncSecretService.iter

```python
async def iter(*,
               cursor: Optional[str] = None,
               limit: Optional[int] = None) -> AsyncIterator[Secret]
```

#### AsyncSecretService.get

```python
async def get(name: str) -> Secret
```

Fetch one secret's metadata (never its value).

#### AsyncSecretService.set

```python
async def set(name: str,
              value: str,
              *,
              allowed_domains: Sequence[str],
              description: Optional[str] = None,
              if_not_exists: bool = False) -> Secret
```

Create or update a write-only secret.

`allowed_domains`: The hosts where this secret's value may be sent
(exact or `*.` wildcard), or `["*"]` for any verified host.
`"*"` lets the value reach any HTTPS host, including one a
compromised sandbox controls.

#### AsyncSecretService.delete

```python
async def delete(name: str) -> None
```

Delete a secret.

## Secret

```python
class Secret(BaseModel)
```

Secret metadata. The value is write-only.

**Attributes**:

- `allowed_domains` _List\[StrictStr\] = Field(description='The hosts the secret\\'s value may be sent to. `["*"]` means any host the platform has verified; an empty list means the secret is sent nowhere.')_
- `created_at` _datetime = Field(description='When the secret was created.')_
- `description` _Optional\[StrictStr\] = Field(default=None, description='The user-facing description, or null when absent.')_
- `name` _StrictStr = Field(description='The secret name.')_
- `updated_at` _datetime = Field(description='When the secret was last updated.')_
- `additional_properties` _Dict\[str, Any\] = \{\}_

##### model\_config

```python
model_config = ConfigDict(populate_by_name=True, validate_assignment=True, protected_namespaces=())
```

#### Secret.to\_str

```python
def to_str() -> str
```

Returns the string representation of the model using alias

#### Secret.to\_json

```python
def to_json() -> str
```

Returns the JSON representation of the model using alias

#### Secret.from\_json

```python
@classmethod
def from_json(json_str: str) -> Optional[Self]
```

Create an instance of Secret from a JSON string

#### Secret.to\_dict

```python
def to_dict() -> Dict[str, Any]
```

Return the dictionary representation of the model using alias.

This has the following differences from calling pydantic's
`self.model_dump(by_alias=True)`:

* `None` is only added to the output dict for nullable fields that
  were set at model initialization. Other fields with value `None`
  are ignored.
* Fields in `self.additional_properties` are added to the output dict.

#### Secret.from\_dict

```python
@classmethod
def from_dict(obj: Optional[Dict[str, Any]]) -> Optional[Self]
```

Create an instance of Secret from a dict
