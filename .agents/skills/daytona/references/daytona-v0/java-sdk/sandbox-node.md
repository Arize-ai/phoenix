
## SandboxNode

A physical member with stable identity and independent process/filesystem routing.

### Methods

#### getWarnings()
```java
public List<String> getWarnings()
```

**Returns**:

- `List\<String\>` -

#### getRank()
```java
public int getRank()
```

**Returns**:

- `int` -

#### getId()
```java
public String getId()
```

**Returns**:

- `String` -

#### getCpu()
```java
public int getCpu()
```

**Returns**:

- `int` -

#### getGpu()
```java
public int getGpu()
```

**Returns**:

- `int` -

#### getMemory()
```java
public int getMemory()
```

**Returns**:

- `int` -

#### getDisk()
```java
public int getDisk()
```

**Returns**:

- `int` -

#### getState()
```java
public String getState()
```

**Returns**:

- `String` -

#### getIncarnation()
```java
public int getIncarnation()
```

**Returns**:

- `int` -

#### getFailure()
```java
public GangNodeFailure getFailure()
```

**Returns**:

- `GangNodeFailure` -

#### getFabricAddress()
```java
public String getFabricAddress()
```

**Returns**:

- `String` -

#### getFabricPrefixLength()
```java
public Integer getFabricPrefixLength()
```

**Returns**:

- `Integer` -

#### getFabricHealthy()
```java
public Boolean getFabricHealthy()
```

**Returns**:

- `Boolean` -

#### getFabricUnhealthySince()
```java
public String getFabricUnhealthySince()
```

**Returns**:

- `String` -

#### getProcess()
```java
public Process getProcess()
```

**Returns**:

- `Process` -

#### getFs()
```java
public FileSystem getFs()
```

**Returns**:

- `FileSystem` -

#### getPreviewLink()
```java
public PortPreviewUrl getPreviewLink(int port)
```

**Parameters**:

- `port` _int_ -

**Returns**:

- `PortPreviewUrl` -

#### createSshAccess()
```java
public SshAccessDto createSshAccess(Integer expiresInMinutes)
```

**Parameters**:

- `expiresInMinutes` _Integer_ -

**Returns**:

- `SshAccessDto` -

#### createSshAccess()
```java
public SshAccessDto createSshAccess()
```

**Returns**:

- `SshAccessDto` -

#### revokeSshAccess()
```java
public void revokeSshAccess(String token)
```

**Parameters**:

- `token` _String_ -

## See Also
- [TypeScript SDK - sandbox-node](../typescript-sdk/sandbox-node.md)
