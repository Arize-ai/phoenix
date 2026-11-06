## Contents

- Basic operations
- Advanced operations
- See Also




File system operations are available through the `fs` module of a sandbox. Each sandbox has its own isolated filesystem, and operations run through the Daytona API, so your application manages files in a sandbox directly, without executing shell commands inside it.

The `fs` module covers listing directories, reading file metadata, creating directories, uploading and downloading files, setting permissions, searching file contents, and moving, renaming, or deleting files. Uploads and downloads can stream to and from local paths, so large files transfer without being loaded into memory.

## Basic operations

Daytona provides methods to interact with the file system in sandboxes. You can perform various operations like listing files, creating directories, reading and writing files, and more.

File operations assume you are operating in the sandbox user's home directory (e.g. `workspace` implies `/home/[username]/workspace`). Use a leading `/` when providing absolute paths.

### List files and directories

List files and directories in a sandbox by providing the path to the directory.

```java
import io.daytona.sdk.model.FileInfo;
import java.util.List;

List<FileInfo> files = sandbox.fs.listFiles("workspace");
for (FileInfo file : files) {
    System.out.println("Name: " + file.getName());
    System.out.println("Is directory: " + file.getIsDir());
    System.out.println("Size: " + file.getSize());
    System.out.println("Modified: " + file.getModTime());
}
```

### Get directory or file information

Get directory or file information by providing the path to the directory or file.

```java
import io.daytona.sdk.model.FileInfo;

FileInfo info = sandbox.fs.getFileDetails("workspace/data/file.txt");
System.out.println("Size: " + info.getSize() + " bytes");
System.out.println("Modified: " + info.getModTime());
System.out.println("Mode: " + info.getMode());

info = sandbox.fs.getFileDetails("workspace/data");
if (Boolean.TRUE.equals(info.getIsDir())) {
    System.out.println("Path is a directory");
}
```

### Create directories

Create a directory by providing the path and permissions to set on the directory.

```java
sandbox.fs.createFolder("workspace/new-dir", "755");
```

### Upload files

Daytona provides methods to upload a single or multiple files in sandboxes.

#### Upload a single file

Upload a single file by providing the content to upload and the path to the file to upload it to.

```java
import java.nio.charset.StandardCharsets;

byte[] fileContent = "Hello, World!".getBytes(StandardCharsets.UTF_8);
sandbox.fs.uploadFile(fileContent, "data.txt");
```

#### Upload multiple files

Upload multiple files by providing the content to upload and their destination paths.

```java
import java.nio.charset.StandardCharsets;

sandbox.fs.uploadFile("Hello, World!".getBytes(StandardCharsets.UTF_8), "data/file1.txt");
sandbox.fs.uploadFile("More content".getBytes(StandardCharsets.UTF_8), "data/file2.txt");
```

#### Stream uploads

For large files, use streaming upload methods to avoid loading the entire file into memory.

```java
import java.io.FileInputStream;
import java.nio.file.Path;

try (var in = new FileInputStream(Path.of("large_dataset.csv").toFile())) {
    sandbox.fs.uploadFileStream(in, "workspace/dataset.csv");
}
```

### Download files

Daytona provides methods to download files from sandboxes.

#### Download a single file

Download a single file by providing the path to the file to download.

```java
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

byte[] content = sandbox.fs.downloadFile("file1.txt");
System.out.println(new String(content, StandardCharsets.UTF_8));

Files.write(Path.of("local_file.txt"), content);
```

#### Download multiple files

Download multiple files by providing the paths to the files to download.


#### Stream downloads

For large files, use streaming download methods to avoid loading the entire file into memory.

```java
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.file.Path;

try (InputStream in = sandbox.fs.downloadFileStream("workspace/large-file.bin");
     var out = new FileOutputStream(Path.of("local_copy.bin").toFile())) {
    in.transferTo(out);
}
```

### Delete files

Delete a file or directory by providing the path to the file or directory to delete.

Pass `recursive: true` to delete a directory recursively.

```java
sandbox.fs.deleteFile("workspace/file.txt");
```

## Advanced operations

Daytona provides advanced file system operations such as file permissions, search by file name, content search and replace, and move files.

### File permissions

Set file permissions, ownership, and group for a file or directory by providing the path to the file or directory and the permissions to set.


### Search files by pattern

Search for files and directories by name using glob patterns (for example `*.py`). This is distinct from `find_files` / `findFiles`, which searches file contents.

```java
import java.util.List;
import java.util.Map;

Map<String, Object> result = sandbox.fs.searchFiles("workspace", "*.java");
@SuppressWarnings("unchecked")
List<String> files = (List<String>) result.get("files");
for (String file : files) {
    System.out.println(file);
}
```

### Find and replace text in files

Find and replace text in files by providing the path to the directory to search in and the pattern to search for.

```java
import java.util.Arrays;
import java.util.List;
import java.util.Map;

List<Map<String, Object>> results = sandbox.fs.findFiles("workspace/src", "text-of-interest");
for (Map<String, Object> match : results) {
    System.out.println("Absolute file path: " + match.get("file"));
    System.out.println("Line number: " + match.get("line"));
    System.out.println("Line content: " + match.get("content"));
    System.out.println();
}

sandbox.fs.replaceInFiles(
    Arrays.asList("workspace/file1.txt", "workspace/file2.txt"),
    "old_text",
    "new_text"
);
```

### Move or rename directory or file

Move or rename a directory or file by providing the path to the file or directory (source) and the new path to the file or directory (destination).

```java
sandbox.fs.moveFiles("workspace/data/old_name.txt", "workspace/data/new_name.txt");

sandbox.fs.moveFiles("workspace/data/file.txt", "workspace/archive/file.txt");

sandbox.fs.moveFiles("workspace/old_dir", "workspace/new_dir");
```

## See Also
- [Python SDK - file-system-operations](../python-sdk/file-system-operations.md)
- [TypeScript SDK - file-system-operations](../typescript-sdk/file-system-operations.md)
