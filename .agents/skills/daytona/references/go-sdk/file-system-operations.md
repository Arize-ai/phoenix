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

```go
// List files in a directory
files, err := sandbox.FileSystem.ListFiles(ctx, "workspace")
if err != nil {
	log.Fatal(err)
}

for _, file := range files {
	fmt.Printf("Name: %s\n", file.Name)
	fmt.Printf("Is directory: %t\n", file.IsDirectory)
	fmt.Printf("Size: %d\n", file.Size)
	fmt.Printf("Modified: %s\n", file.ModifiedTime)
}
```

### Get directory or file information

Get directory or file information by providing the path to the directory or file.

```go
// Get file metadata
info, err := sandbox.FileSystem.GetFileInfo(ctx, "workspace/data/file.txt")
if err != nil {
	log.Fatal(err)
}
fmt.Printf("Size: %d bytes\n", info.Size)
fmt.Printf("Modified: %s\n", info.ModifiedTime)
fmt.Printf("Mode: %s\n", info.Mode)

// Check if path is a directory
info, err = sandbox.FileSystem.GetFileInfo(ctx, "workspace/data")
if err != nil {
	log.Fatal(err)
}
if info.IsDirectory {
	fmt.Println("Path is a directory")
}
```

### Create directories

Create a directory by providing the path and permissions to set on the directory.

```go
// Create with specific permissions
err := sandbox.FileSystem.CreateFolder(ctx, "workspace/new-dir",
	options.WithMode("755"),
)
if err != nil {
	log.Fatal(err)
}
```

### Upload files

Daytona provides methods to upload a single or multiple files in sandboxes.

#### Upload a single file

Upload a single file by providing the content to upload and the path to the file to upload it to.

```go
// Upload from a local file path
err := sandbox.FileSystem.UploadFile(ctx, "local_file.txt", "remote_file.txt")
if err != nil {
	log.Fatal(err)
}

// Or upload from byte content
content := []byte("Hello, World!")
err = sandbox.FileSystem.UploadFile(ctx, content, "hello.txt")
if err != nil {
	log.Fatal(err)
}
```

#### Upload multiple files

Upload multiple files by providing the content to upload and their destination paths.

```go
// Upload multiple files by calling UploadFile for each
filesToUpload := []struct {
	source      string
	destination string
}{
	{"file1.txt", "data/file1.txt"},
	{"file2.txt", "data/file2.txt"},
	{"settings.json", "config/settings.json"},
}

for _, f := range filesToUpload {
	err := sandbox.FileSystem.UploadFile(ctx, f.source, f.destination)
	if err != nil {
		log.Fatal(err)
	}
}
```

#### Stream uploads

For large files, use streaming upload methods to avoid loading the entire file into memory.

```go
f, err := os.Open("large_dataset.csv")
if err != nil {
	log.Fatal(err)
}
defer f.Close()

err = sandbox.FileSystem.UploadFileStream(ctx, f, "workspace/dataset.csv")
if err != nil {
	log.Fatal(err)
}
```

### Download files

Daytona provides methods to download files from sandboxes.

#### Download a single file

Download a single file by providing the path to the file to download.

```go
// Download and get contents in memory
content, err := sandbox.FileSystem.DownloadFile(ctx, "file1.txt", nil)
if err != nil {
	log.Fatal(err)
}
fmt.Println(string(content))

// Download and save to a local file
localPath := "local_file.txt"
content, err = sandbox.FileSystem.DownloadFile(ctx, "file1.txt", &localPath)
if err != nil {
	log.Fatal(err)
}
```

#### Download multiple files

Download multiple files by providing the paths to the files to download.

```go
// Download multiple files by calling DownloadFile for each
filesToDownload := []struct {
	remotePath string
	localPath  *string
}{
	{"data/file1.txt", nil},                           // Download to memory
	{"data/file2.txt", ptrString("local_file2.txt")},  // Download to local file
}

for _, f := range filesToDownload {
	content, err := sandbox.FileSystem.DownloadFile(ctx, f.remotePath, f.localPath)
	if err != nil {
		fmt.Printf("Error downloading %s: %v\n", f.remotePath, err)
		continue
	}
	if f.localPath == nil {
		fmt.Printf("Downloaded %s to memory (%d bytes)\n", f.remotePath, len(content))
	} else {
		fmt.Printf("Downloaded %s to %s\n", f.remotePath, *f.localPath)
	}
}
```

#### Stream downloads

For large files, use streaming download methods to avoid loading the entire file into memory.

```go
stream, err := sandbox.FileSystem.DownloadFileStream(ctx, "workspace/large-file.bin")
if err != nil {
	log.Fatal(err)
}
defer stream.Close()

out, err := os.Create("local_copy.bin")
if err != nil {
	log.Fatal(err)
}
defer out.Close()

_, err = io.Copy(out, stream)
if err != nil {
	log.Fatal(err)
}
```

### Delete files

Delete a file or directory by providing the path to the file or directory to delete.

Pass `recursive: true` to delete a directory recursively.

```go
// Delete a file
err := sandbox.FileSystem.DeleteFile(ctx, "workspace/file.txt", false)
if err != nil {
	log.Fatal(err)
}

// Delete a directory recursively
err = sandbox.FileSystem.DeleteFile(ctx, "workspace/old_dir", true)
if err != nil {
	log.Fatal(err)
}
```

## Advanced operations

Daytona provides advanced file system operations such as file permissions, search by file name, content search and replace, and move files.

### File permissions

Set file permissions, ownership, and group for a file or directory by providing the path to the file or directory and the permissions to set.

```go
// Set file permissions
err := sandbox.FileSystem.SetFilePermissions(ctx, "workspace/file.txt",
	options.WithPermissionMode("644"),
)
if err != nil {
	log.Fatal(err)
}

// Set owner and group
err = sandbox.FileSystem.SetFilePermissions(ctx, "workspace/file.txt",
	options.WithOwner("daytona"),
	options.WithGroup("daytona"),
)
if err != nil {
	log.Fatal(err)
}

// Get file info to check permissions
fileInfo, err := sandbox.FileSystem.GetFileInfo(ctx, "workspace/file.txt")
if err != nil {
	log.Fatal(err)
}
fmt.Printf("Mode: %s\n", fileInfo.Mode)
```

### Search files by pattern

Search for files and directories by name using glob patterns (for example `*.py`). This is distinct from `find_files` / `findFiles`, which searches file contents.

```go
result, err := sandbox.FileSystem.SearchFiles(ctx, "workspace", "*.go")
if err != nil {
	log.Fatal(err)
}
files := result.(map[string]any)["files"].([]string)
for _, file := range files {
	fmt.Println(file)
}
```

### Find and replace text in files

Find and replace text in files by providing the path to the directory to search in and the pattern to search for.

```go
// Search for text in files
result, err := sandbox.FileSystem.FindFiles(ctx, "workspace/src", "text-of-interest")
if err != nil {
	log.Fatal(err)
}
matches := result.([]map[string]any)
for _, match := range matches {
	fmt.Printf("Absolute file path: %s\n", match["file"])
	fmt.Printf("Line number: %v\n", match["line"])
	fmt.Printf("Line content: %s\n\n", match["content"])
}

// Replace text in files
_, err = sandbox.FileSystem.ReplaceInFiles(ctx,
	[]string{"workspace/file1.txt", "workspace/file2.txt"},
	"old_text",
	"new_text",
)
if err != nil {
	log.Fatal(err)
}
```

### Move or rename directory or file

Move or rename a directory or file by providing the path to the file or directory (source) and the new path to the file or directory (destination).

```go
// Rename a file
err := sandbox.FileSystem.MoveFiles(ctx, "workspace/data/old_name.txt", "workspace/data/new_name.txt")
if err != nil {
	log.Fatal(err)
}

// Move a file to a different directory
err = sandbox.FileSystem.MoveFiles(ctx, "workspace/data/file.txt", "workspace/archive/file.txt")
if err != nil {
	log.Fatal(err)
}

// Move a directory
err = sandbox.FileSystem.MoveFiles(ctx, "workspace/old_dir", "workspace/new_dir")
if err != nil {
	log.Fatal(err)
}
```

## See Also
- [Python SDK - file-system-operations](../python-sdk/file-system-operations.md)
- [TypeScript SDK - file-system-operations](../typescript-sdk/file-system-operations.md)
- [Java SDK - file-system-operations](../java-sdk/file-system-operations.md)
