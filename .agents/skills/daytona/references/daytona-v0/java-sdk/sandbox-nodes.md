## Contents

- SandboxNodes
- SandboxNodes.NodeProcess
- SandboxNodes.NodeFileSystem



## SandboxNodes

Read-only, live rank-ordered members, including the head at index zero.

### Methods

#### get()
```java
public SandboxNode get(int rank)
```

**Parameters**:

- `rank` _int_ -

**Returns**:

- `SandboxNode` -

#### size()
```java
public int size()
```

**Returns**:

- `int` -

#### getProcess()
```java
public NodeProcess getProcess()
```

**Returns**:

- `NodeProcess` -

#### getFs()
```java
public NodeFileSystem getFs()
```

**Returns**:

- `NodeFileSystem` -

#### add()
```java
public GangMembershipOperation add(List<NodeResources> nodes)
```

Append rank-ordered nodes and wait up to 600 seconds. An accepted operation continues after a timeout.

**Parameters**:

- `nodes` _List\<NodeResources\>_ -

**Returns**:

- `GangMembershipOperation` -

#### add()
```java
public GangMembershipOperation add(List<NodeResources> nodes, long timeoutSeconds)
```

Wait up to timeoutSeconds for the membership change. Zero disables the wait limit. An accepted operation continues after a timeout.

**Parameters**:

- `nodes` _List\<NodeResources\>_ -
- `timeoutSeconds` _long_ -

**Returns**:

- `GangMembershipOperation` -

#### release()
```java
public GangMembershipOperation release(int count)
```

Release the highest ranks and wait up to 600 seconds. An accepted operation continues after a timeout.

**Parameters**:

- `count` _int_ -

**Returns**:

- `GangMembershipOperation` -

#### release()
```java
public GangMembershipOperation release(int count, long timeoutSeconds)
```

Wait up to timeoutSeconds for the membership change. Zero disables the wait limit. An accepted operation continues after a timeout.

**Parameters**:

- `count` _int_ -
- `timeoutSeconds` _long_ -

**Returns**:

- `GangMembershipOperation` -

#### replace()
```java
public GangMembershipOperation replace(int rank)
```

Replace a degraded rank and wait up to 600 seconds. An accepted operation continues after a timeout.

**Parameters**:

- `rank` _int_ -

**Returns**:

- `GangMembershipOperation` -

#### replace()
```java
public GangMembershipOperation replace(int rank, long timeoutSeconds)
```

Wait up to timeoutSeconds for the membership change. Zero disables the wait limit. An accepted operation continues after a timeout.

**Parameters**:

- `rank` _int_ -
- `timeoutSeconds` _long_ -

**Returns**:

- `GangMembershipOperation` -

## SandboxNodes.NodeProcess

Parallel process execution over a membership snapshot.

### Methods

#### executeCommand()
```java
public Map<Integer, ExecuteResponse> executeCommand(String command)
```

Run the command on every rank.

**Parameters**:

- `command` _String_ -

**Returns**:

- `Map\<Integer, ExecuteResponse\>` -

**Throws**:

- `DaytonaNodeOperationException` - if any rank fails. Inspect getFailures() for errors and getResults() for successful commands.

#### executeCommand()
```java
public Map<Integer, ExecuteResponse> executeCommand(String command, NodeExecuteOptions options)
```

Run the command on every rank.

**Parameters**:

- `command` _String_ -
- `options` _NodeExecuteOptions_ -

**Returns**:

- `Map\<Integer, ExecuteResponse\>` -

**Throws**:

- `DaytonaNodeOperationException` - if any rank fails. Inspect getFailures() for errors and getResults() for successful commands.

## SandboxNodes.NodeFileSystem

Upload the same bytes to each node; successful uploads are not rolled back.

### Methods

#### uploadFile()
```java
public void uploadFile(byte[] content, String destination)
```

Upload the file to every rank.

**Parameters**:

- `content` _byte[]_ -
- `destination` _String_ -

**Throws**:

- `DaytonaNodeOperationException` - if any rank fails. Inspect getFailures() for failed ranks. Successful uploads are retained.

#### uploadFile()
```java
public void uploadFile(Path source, String destination)
```

Upload the file to every rank.

**Parameters**:

- `source` _Path_ -
- `destination` _String_ -

**Throws**:

- `DaytonaNodeOperationException` - if any rank fails. Inspect getFailures() for failed ranks. Successful uploads are retained.
