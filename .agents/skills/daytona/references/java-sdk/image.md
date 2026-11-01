
## Image

Declarative image builder used to define Sandbox runtime environments.

Use factory methods such as `#base(String)` or `#debianSlim(String)` and chain
mutating methods to append Dockerfile instructions.

Local files and directories added with `#addLocalFile(String, String)` and
`#addLocalDir(String, String)` are uploaded to Daytona object storage as build contexts
when the image is used to create a snapshot or a Sandbox.

### Methods

#### base()
```java
public static Image base(String baseImage)
```

Creates an image definition from an existing base image.

**Parameters**:

- `baseImage` _String_ - base image reference (for example `python:3.12-slim-bookworm`)

**Returns**:

- `Image` - new `Image` initialized with a `FROM` instruction

#### debianSlim()
```java
public static Image debianSlim(String pythonVersion)
```

Creates a Python Debian slim image.

**Parameters**:

- `pythonVersion` _String_ - Python version to use; defaults to `3.11` when `null` or empty

**Returns**:

- `Image` - new `Image` using a Python slim base image

#### pipInstall()
```java
public Image pipInstall(String... packages)
```

Adds a `pip install` instruction for one or more packages.

**Parameters**:

- `packages` _String..._ - package names to install

**Returns**:

- `Image` - this `Image` for method chaining

#### runCommands()
```java
public Image runCommands(String... commands)
```

Adds one or more `RUN` instructions.

**Parameters**:

- `commands` _String..._ - shell commands to execute during image build

**Returns**:

- `Image` - this `Image` for method chaining

#### env()
```java
public Image env(Map<String, String> envVars)
```

Adds environment variables using `ENV` instructions.

**Parameters**:

- `envVars` _Map\<String, String\>_ - environment variables to set in the image

**Returns**:

- `Image` - this `Image` for method chaining

#### workdir()
```java
public Image workdir(String path)
```

Sets the default working directory using a `WORKDIR` instruction.

**Parameters**:

- `path` _String_ - working directory path

**Returns**:

- `Image` - this `Image` for method chaining

#### entrypoint()
```java
public Image entrypoint(String... commands)
```

Sets the container entrypoint.

**Parameters**:

- `commands` _String..._ - entrypoint command and arguments

**Returns**:

- `Image` - this `Image` for method chaining

#### cmd()
```java
public Image cmd(String... commands)
```

Sets the default container command.

**Parameters**:

- `commands` _String..._ - default command and arguments

**Returns**:

- `Image` - this `Image` for method chaining

#### addLocalFile()
```java
public Image addLocalFile(String localPath, String remotePath)
```

Adds a local file to the image.

The file is uploaded to Daytona object storage as part of the build context when the image
is used to create a snapshot or a Sandbox, and copied to `remotePath` with a
`COPY` instruction. If `remotePath` ends with `/`, the local file name is
appended to it. Symlinks in `localPath` are resolved before the file is recorded.
```java
Image image = Image.debianSlim("3.12")
.addLocalFile("requirements.txt", "/home/daytona/requirements.txt");
```

**Parameters**:

- `localPath` _String_ - path to the local file; a leading `~` is expanded to the user home
- `remotePath` _String_ - destination path inside the image

**Returns**:

- `Image` - this `Image` for method chaining

**Throws**:

- `DaytonaNotFoundException` - if `localPath` does not exist
- `IllegalArgumentException` - if `localPath` exists but is not a regular file

#### addLocalDir()
```java
public Image addLocalDir(String localPath, String remotePath)
```

Adds a local directory to the image.

The directory is uploaded to Daytona object storage as part of the build context when the
image is used to create a snapshot or a Sandbox, and copied to `remotePath` with a
`COPY` instruction. Symlinks in `localPath` itself are resolved; symlinks inside
the directory are preserved as symlinks in the build context.
```java
Image image = Image.debianSlim("3.12").addLocalDir("src", "/home/daytona/src");
```

**Parameters**:

- `localPath` _String_ - path to the local directory; a leading `~` is expanded to the user home
- `remotePath` _String_ - destination path inside the image

**Returns**:

- `Image` - this `Image` for method chaining

**Throws**:

- `DaytonaNotFoundException` - if `localPath` does not exist
- `IllegalArgumentException` - if `localPath` exists but is not a directory, or is a filesystem root

#### getDockerfile()
```java
public String getDockerfile()
```

Returns generated Dockerfile content.

**Returns**:

- `String` - Dockerfile text assembled by this builder

#### getContexts()
```java
public List<Context> getContexts()
```

Returns the local build contexts registered with `#addLocalFile(String, String)` and
`#addLocalDir(String, String)`, in insertion order.

**Returns**:

- `List\<Context\>` - unmodifiable list of build contexts

## See Also
- [TypeScript SDK - image](../typescript-sdk/image.md)
