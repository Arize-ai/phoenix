
## SandboxNode

A stable rank/id handle with its own toolbox route.

### Constructors

#### new SandboxNode()

```ruby
def initialize(parent, dto)

```

**Returns**:

- `SandboxNode` - a new instance of SandboxNode

### Methods

#### id()

```ruby
def id()

```

Returns the value of attribute id.

#### rank()

```ruby
def rank()

```

Returns the value of attribute rank.

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

#### cpu()

```ruby
def cpu()

```

**Returns**:

- `Integer`

#### gpu()

```ruby
def gpu()

```

**Returns**:

- `Integer`

#### memory()

```ruby
def memory()

```

**Returns**:

- `Integer` - Memory in GB

#### disk()

```ruby
def disk()

```

**Returns**:

- `Integer` - Disk in GB

#### state()

```ruby
def state()

```

**Returns**:

- `String`

#### incarnation()

```ruby
def incarnation()

```

**Returns**:

- `Integer`

#### failure()

```ruby
def failure()

```

**Returns**:

- `DaytonaApiClient:GangNodeFailure, nil`

#### fabric_address()

```ruby
def fabric_address()

```

**Returns**:

- `String, nil`

#### fabric_prefix_length()

```ruby
def fabric_prefix_length()

```

**Returns**:

- `Integer, nil`

#### fabric_healthy()

```ruby
def fabric_healthy()

```

**Returns**:

- `Boolean, nil`

#### fabric_unhealthy_since()

```ruby
def fabric_unhealthy_since()

```

**Returns**:

- `String, nil`

#### warnings()

```ruby
def warnings()

```

**Returns**:

- `Array\<String\>` - Advisory preflight and cleanup warnings

#### preview_url()

```ruby
def preview_url(port)

```

**Returns**:

- `DaytonaApiClient:PortPreviewUrl` - Preview for this member

#### create_ssh_access()

```ruby
def create_ssh_access(expires_in_minutes = nil)

```

**Returns**:

- `DaytonaApiClient:SshAccessDto` - SSH access for this member

#### revoke_ssh_access()

```ruby
def revoke_ssh_access(token)

```

**Returns**:

- `DaytonaApiClient:Sandbox` - Updated sandbox metadata

## See Also
- [TypeScript SDK - sandbox-node](../typescript-sdk/sandbox-node.md)
- [Java SDK - sandbox-node](../java-sdk/sandbox-node.md)
