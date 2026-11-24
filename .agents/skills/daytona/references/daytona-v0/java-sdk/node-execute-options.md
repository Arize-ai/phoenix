
## NodeExecuteOptions

Execution options for all current nodes; callbacks receive rank and chunk separately.

### Methods

#### getTimeoutSeconds()
```java
public long getTimeoutSeconds()
```

Zero disables the execution limit. Setup and cleanup each have a ten-second request bound.

**Returns**:

- `long` -

#### setTimeoutSeconds()
```java
public void setTimeoutSeconds(long value)
```

**Parameters**:

- `value` _long_ -

#### getOnStdout()
```java
public BiConsumer<Integer, String> getOnStdout()
```

**Returns**:

- `BiConsumer\<Integer, String\>` -

#### setOnStdout()
```java
public void setOnStdout(BiConsumer<Integer, String> value)
```

**Parameters**:

- `value` _BiConsumer\<Integer, String\>_ -

#### getOnStderr()
```java
public BiConsumer<Integer, String> getOnStderr()
```

**Returns**:

- `BiConsumer\<Integer, String\>` -

#### setOnStderr()
```java
public void setOnStderr(BiConsumer<Integer, String> value)
```

**Parameters**:

- `value` _BiConsumer\<Integer, String\>_ -
