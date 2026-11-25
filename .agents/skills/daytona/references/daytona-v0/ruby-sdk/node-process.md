
## NodeProcess

NodeProcess class for Daytona SDK.

### Constructors

#### new NodeProcess()

```ruby
def initialize(nodes)

```

**Returns**:

- `NodeProcess` - a new instance of NodeProcess

### Methods

#### exec()

```ruby
def exec(command:, timeout: 0, on_stdout: nil, on_stderr: nil)

```

Callbacks receive (rank, chunk). A positive timeout bounds each command;
private session cleanup has its own ten-second budget after expiration.

**Parameters**:

- `command` _String_ - Shell command to execute on each current member
- `timeout` _Numeric_ - Execution limit in seconds per rank. The default of zero disables the limit.
- `on_stdout` _Proc, nil_ - Callback receiving (rank, chunk)
- `on_stderr` _Proc, nil_ - Callback receiving (rank, chunk)

**Returns**:

- `Hash\<Integer, Daytona:ExecuteResponse\>` - Results keyed by rank

**Raises**:

- `Daytona:Sdk:NodeOperationError` - After all ranks finish, failures contains errors by rank and results contains successful responses.
