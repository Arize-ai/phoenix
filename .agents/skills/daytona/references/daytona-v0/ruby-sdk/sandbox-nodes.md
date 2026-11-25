
## SandboxNodes

Rank-ordered nodes, including rank zero. Membership helpers wait by default;
timing out ends the SDK wait and does not cancel a submitted operation.

### Constructors

#### new SandboxNodes()

```ruby
def initialize(parent)

```

**Returns**:

- `SandboxNodes` - a new instance of SandboxNodes

### Methods

#### process()

```ruby
def process()

```

Returns the value of attribute process.

#### fs()

```ruby
def fs()

```

Returns the value of attribute fs.

#### each()

```ruby
def each()

```

**Returns**:

- `Enumerator, Array\<Daytona:SandboxNode\>`

#### []()

```ruby
def [](https://www.daytona.io/docs/enrank)

```

**Parameters**:

- `rank` _Integer_ - Index within this Sandbox response; a direct worker lookup has one member

**Returns**:

- `Daytona:SandboxNode, nil`

#### size()

```ruby
def size()

```

**Returns**:

- `Integer` - Current membership size

#### length()

```ruby
def length()

```

**Returns**:

- `Integer` - Current membership size

#### to_a()

```ruby
def to_a()

```

**Returns**:

- `Array\<Daytona:SandboxNode\>` - Snapshot of current membership

#### add()

```ruby
def add(nodes:, timeout: 600)

```

**Parameters**:

- `nodes` _Array\<Daytona:NodeResources\>_ - Resources in appended rank order
- `timeout` _Numeric_ - Overall wait budget in seconds; zero disables it

**Returns**:

- `DaytonaApiClient:GangMembershipOperation`

#### release()

```ruby
def release(count: 1, timeout: 600)

```

**Parameters**:

- `count` _Integer_ - Number of highest ranks to release
- `timeout` _Numeric_ - Overall wait budget in seconds. Zero disables the limit.

**Returns**:

- `DaytonaApiClient:GangMembershipOperation`

**Raises**:

- `Sdk:Error` -

#### replace()

```ruby
def replace(rank:, timeout: 600)

```

**Parameters**:

- `rank` _Integer_ - Failed logical rank to replace
- `timeout` _Numeric_ - Overall wait budget in seconds. Zero disables the limit.

**Returns**:

- `DaytonaApiClient:GangMembershipOperation`

**Raises**:

- `Sdk:Error` -

## See Also
- [Java SDK - sandbox-nodes](../java-sdk/sandbox-nodes.md)
