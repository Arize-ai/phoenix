
## NodeResources

CPU cores, memory GiB and disk GiB for one appended node.

### Constructors

#### new NodeResources()
```java
public NodeResources(int cpu, int memory, int disk)
```

**Parameters**:

- `cpu` _int_ - positive number of CPU cores
- `memory` _int_ - positive memory size in GiB
- `disk` _int_ - positive disk size in GiB

**Throws**:

- `io.daytona.sdk.exception.DaytonaException` - if any value is less than one

### Methods

#### getCpu()
```java
public int getCpu()
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
