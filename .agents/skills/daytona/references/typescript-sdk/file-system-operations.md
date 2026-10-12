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

```typescript
// List files in a directory
const files = await sandbox.fs.listFiles('workspace')

files.forEach(file => {
  console.log(`Name: ${file.name}`)
  console.log(`Is directory: ${file.isDir}`)
  console.log(`Size: ${file.size}`)
  console.log(`Modified: ${file.modTime}`)
})
```

### Get directory or file information

Get directory or file information by providing the path to the directory or file.

```typescript
// Get file details
const info = await sandbox.fs.getFileDetails('app/config.json')
console.log(`Size: ${info.size}, Modified: ${info.modifiedAt ?? info.modTime}`)
```

### Create directories

Create a directory by providing the path and permissions to set on the directory.

```typescript
// Create with specific permissions
await sandbox.fs.createFolder('workspace/new-dir', '755')
```

### Upload files

Daytona provides methods to upload a single or multiple files in sandboxes.

#### Upload a single file

Upload a single file by providing the content to upload and the path to the file to upload it to.

```typescript
// Upload a single file
const fileContent = Buffer.from('Hello, World!')
await sandbox.fs.uploadFile(fileContent, 'data.txt')
```

#### Upload multiple files

Upload multiple files by providing the content to upload and their destination paths.

```typescript
// Upload multiple files at once
const files = [
  {
    source: Buffer.from('Content of file 1'),
    destination: 'data/file1.txt',
  },
  {
    source: Buffer.from('Content of file 2'),
    destination: 'data/file2.txt',
  },
  {
    source: Buffer.from('{"key": "value"}'),
    destination: 'config/settings.json',
  },
]

await sandbox.fs.uploadFiles(files)
```

#### Stream uploads

For large files, use streaming upload methods to avoid loading the entire file into memory.

```typescript
import { createReadStream } from 'node:fs'

await sandbox.fs.uploadFileStream(
  createReadStream('large_dataset.csv'),
  'workspace/dataset.csv'
)
```

### Download files

Daytona provides methods to download files from sandboxes.

#### Download a single file

Download a single file by providing the path to the file to download.

```typescript
import { DaytonaNotFoundError } from '@daytona/sdk'

try {
  const downloadedFile = await sandbox.fs.downloadFile('file1.txt')
  console.log('File content:', downloadedFile.toString())
} catch (error) {
  if (error instanceof DaytonaNotFoundError) {
    console.error(`Missing file: ${error.message}`)
  } else {
    throw error
  }
}
```

#### Download multiple files

Download multiple files by providing the paths to the files to download.

```typescript
// Download multiple files at once
const files = [
  { source: 'data/file1.txt' }, // No destination - download to memory
  { source: 'data/file2.txt', destination: 'local_file2.txt' }, // Download to local file
]

const results = await sandbox.fs.downloadFiles(files)

results.forEach(result => {
  if (result.error) {
    console.error(`Error downloading ${result.source}: ${result.error}`)
    if (result.errorDetails) {
      console.error(
        `  status=${result.errorDetails.statusCode} code=${result.errorDetails.errorCode}`
      )
    }
  } else if (result.result) {
    console.log(`Downloaded ${result.source} to ${result.result}`)
  }
})
```

#### Stream downloads

For large files, use streaming download methods to avoid loading the entire file into memory.

```typescript
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

const stream = await sandbox.fs.downloadFileStream('workspace/large-file.bin')
await pipeline(stream, createWriteStream('local_copy.bin'))
```

### Delete files

Delete a file or directory by providing the path to the file or directory to delete.

Pass `recursive: true` to delete a directory recursively.

```typescript
await sandbox.fs.deleteFile('workspace/file.txt')

// Delete a directory recursively
await sandbox.fs.deleteFile('workspace/old_dir', true)
```

## Advanced operations

Daytona provides advanced file system operations such as file permissions, search by file name, content search and replace, and move files.

### File permissions

Set file permissions, ownership, and group for a file or directory by providing the path to the file or directory and the permissions to set.

```typescript
// Set file permissions
await sandbox.fs.setFilePermissions('workspace/file.txt', { mode: '644' })

// Get file permissions
const fileInfo = await sandbox.fs.getFileDetails('workspace/file.txt')
console.log(`Permissions: ${fileInfo.permissions}`)
```

### Search files by pattern

Search for files and directories by name using glob patterns (for example `*.py`). This is distinct from `find_files` / `findFiles`, which searches file contents.

```typescript
const result = await sandbox.fs.searchFiles('workspace', '*.ts')
result.files.forEach(file => console.log(file))
```

### Find and replace text in files

Find and replace text in files by providing the path to the directory to search in and the pattern to search for.

```typescript
// Search for text in files; if a folder is specified, the search is recursive
const results = await sandbox.fs.findFiles('workspace/src', 'text-of-interest')
results.forEach(match => {
  console.log('Absolute file path:', match.file)
  console.log('Line number:', match.line)
  console.log('Line content:', match.content)
})

// Replace text in files
await sandbox.fs.replaceInFiles(
    ["workspace/file1.txt", "workspace/file2.txt"],
    "old_text",
    "new_text"
)
```

### Move or rename directory or file

Move or rename a directory or file by providing the path to the file or directory (source) and the new path to the file or directory (destination).

```typescript
// Move a file to a new location
await sandbox.fs.moveFiles('app/temp/data.json', 'app/data/data.json')
```

## See Also
- [Python SDK - file-system-operations](../python-sdk/file-system-operations.md)
