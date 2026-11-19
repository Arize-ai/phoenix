
## Secret

Initialize secret from DTO

### Constructors

#### new Secret()

```ruby
def initialize(secret_dto)

```

Initialize secret from DTO

The plaintext value is write-only and is never returned by the API, so it is not exposed here.

**Parameters**:

- `secret_dto` _DaytonaApiClient:Secret_ -

**Returns**:

- `Secret` - a new instance of Secret

### Methods

#### id()

```ruby
def id()

```

**Returns**:

- `String`

#### name()

```ruby
def name()

```

**Returns**:

- `String`

#### description()

```ruby
def description()

```

**Returns**:

- `String, nil`

#### placeholder()

```ruby
def placeholder()

```

**Returns**:

- `String` - Opaque placeholder token injected as the env var value in Sandboxes. The
placeholder is resolved to the real plaintext value only for the secret's allowed hosts.

#### hosts()

```ruby
def hosts()

```

**Returns**:

- `Array\<String\>` - Allowed hosts this secret may be sent to. Accepts exact hostnames
and +*.+ wildcards (no ports).

#### created_at()

```ruby
def created_at()

```

**Returns**:

- `String`

#### updated_at()

```ruby
def updated_at()

```

**Returns**:

- `String`

## See Also
- [Python SDK - secret](../python-sdk/sync/secret.md)
- [TypeScript SDK - secret](../typescript-sdk/secret.md)
