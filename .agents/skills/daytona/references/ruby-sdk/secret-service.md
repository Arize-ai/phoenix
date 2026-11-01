
## SecretService

Service for managing organization-scoped Daytona Secrets. Can be used to list, get, create,
update and delete Secrets.

### Constructors

#### new SecretService()

```ruby
def initialize(secret_api, otel_state: nil)

```

Service for managing organization-scoped Daytona Secrets. Can be used to list, get, create,
update and delete Secrets.

A Secret stores a plaintext +value+ that is never returned by the API. When a Secret is
referenced while creating a Sandbox, the corresponding env var holds an opaque +placeholder+
that is resolved to the real value only for the Secret's allowed +hosts+.

**Parameters**:

- `secret_api` _DaytonaApiClient:SecretApi_ -
- `otel_state` _Daytona:OtelState, nil_ -

**Returns**:

- `SecretService` - a new instance of SecretService

### Methods

#### create()

```ruby
def create(name, value, description: nil, hosts: nil)

```

Create a new Secret.

**Parameters**:

- `name` _String_ - Name of the Secret. Must match +^[a-zA-Z_][a-zA-Z0-9_-]*$+ and be unique
within the organization (a duplicate name raises a 409 error).
- `value` _String_ - Plaintext value of the Secret. Write-only; never returned by the API.
- `description` _String, nil_ - Optional description of the Secret.
- `hosts` _Array\<String\>, nil_ - Allowed hosts this Secret may be sent to. Accepts exact
hostnames and +*.+ wildcards (no ports).

**Returns**:

- `Daytona:Secret`

#### delete()

```ruby
def delete(secret_id)

```

Delete a Secret.

**Parameters**:

- `secret_id` _String_ -

**Returns**:

- `void`

**Raises**:

- `DaytonaApiClient:ApiError` - If no Secret with the given ID exists (404).

#### get()

```ruby
def get(secret_id)

```

Get a Secret by ID.

**Parameters**:

- `secret_id` _String_ -

**Returns**:

- `Daytona:Secret`

**Raises**:

- `DaytonaApiClient:ApiError` - If no Secret with the given ID exists (404).

#### list()

```ruby
def list(cursor: nil, limit: nil, name: nil, sort: nil, order: nil)

```

List Secrets with cursor-based pagination.

**Parameters**:

- `cursor` _String, nil_ - Pagination cursor from a previous response.
- `limit` _Integer, nil_ - Number of results per page (1-200, defaults to 100).
- `name` _String, nil_ - Filter by partial name match.
- `sort` _String, nil_ - Field to sort by: +name+, +createdAt+ or +updatedAt+
(defaults to +createdAt+).
- `order` _String, nil_ - Direction to sort by: +asc+ or +desc+ (defaults to +desc+).

**Returns**:

- `Daytona:ListSecretsResponse`

**Raises**:

- `Daytona:Sdk:Error` -

**Examples:**

```ruby
daytona = Daytona::Daytona.new
cursor = nil
loop do
  page = daytona.secret.list(cursor:, limit: 100)
  puts "Fetched #{page.items.length} of #{page.total} secrets"
  page.items.each { |secret| puts "#{secret.name} (#{secret.id})" }
  cursor = page.next_cursor
  break if cursor.nil?
end

```

#### update()

```ruby
def update(secret_id, value: nil, description: nil, hosts: nil)

```

Update a Secret.

**Parameters**:

- `secret_id` _String_ -
- `value` _String, nil_ - New plaintext value. Write-only; never returned by the API.
- `description` _String, nil_ - New description of the Secret.
- `hosts` _Array\<String\>, nil_ - Allowed hosts this Secret may be sent to. Accepts exact
hostnames and +*.+ wildcards (no ports).

**Returns**:

- `Daytona:Secret`

**Raises**:

- `DaytonaApiClient:ApiError` - If no Secret with the given ID exists (404).

## See Also
- [Java SDK - secret-service](../java-sdk/secret-service.md)
