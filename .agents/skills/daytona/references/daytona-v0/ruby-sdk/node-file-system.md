
## NodeFileSystem

NodeFileSystem class for Daytona SDK.

### Constructors

#### new NodeFileSystem()

```ruby
def initialize(nodes)

```

**Returns**:

- `NodeFileSystem` - a new instance of NodeFileSystem

### Methods

#### upload_file()

```ruby
def upload_file(source, remote_path)

```

Copies an IO once to a temporary file so every rank receives the same bytes.

**Parameters**:

- `source` _String, IO_ - File contents, a local file path, or a readable IO.
- `remote_path` _String_ - Destination path on each node.

**Returns**:

- `void`

**Raises**:

- `Daytona:Sdk:NodeOperationError` - After all uploads finish, failures contains errors by rank
and results contains the ranks whose uploads succeeded.
