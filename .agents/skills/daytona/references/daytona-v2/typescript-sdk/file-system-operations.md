# File System Operations (TypeScript SDK)

Interact with the file system in your sandboxes.

File system operations are the actions that read and change files and directories in a sandbox. An application or an agent uses them to put inputs into a sandbox and take results out.

Daytona runs file system operations on the isolated filesystem of each sandbox, without shell commands inside the sandbox. Each operation acts on one sandbox, and every path it takes is an absolute path in the filesystem of that sandbox.

Use file system operations to upload inputs before code runs and download results after it. The SDKs provide them in the sandbox's file system module, and each one runs through the API.

## Contents

- [Use cases](#use-cases)
- [Directories](#directories)
- [List files and directories](#list-files-and-directories)
- [Get directory or file information](#get-directory-or-file-information)
- [Create directories](#create-directories)
- [Upload files](#upload-files)
- [Download files](#download-files)
- [Delete files](#delete-files)
- [File permissions](#file-permissions)
- [Search files by pattern](#search-files-by-pattern)
- [Find and replace text in files](#find-and-replace-text-in-files)
- [Move or rename directory or file](#move-or-rename-directory-or-file)
- [Watch for file changes](#watch-for-file-changes)
- [Presigned URLs](#presigned-urls)
- [Permissions](#permissions)

## Use cases

File system operations let an application move or inspect files in a sandbox without a shell.

- **Input files.** An application uploads source code, datasets, or configuration before code runs. Several files upload in one request, and a failed file does not stop the others. Missing parent directories are created, and an existing file at the destination is overwritten.

- **Results and artifacts.** Generated files, reports, and build outputs are downloaded after a run. Several files download in one request, and a missing or unreadable file does not stop the others. The SDK methods hold every downloaded file in memory before they return.

- **Agent file tools.** An agent lists, reads, searches, and edits files through the API as tools. The agent needs no shell commands inside the sandbox to do this.

- **Large transfers.** Large files stream between local disk and the sandbox without being held in the application's memory. Uploads have no request size limit, so free sandbox disk space bounds the upload size. A failed or cancelled SDK download leaves an existing destination file unchanged.

- **Direct transfers for other clients.** A presigned URL lets a browser or another service upload or download one file without an API key. A URL is valid for at most 7 days. Rotating the sandbox signing key revokes every outstanding URL within 30 seconds.

## Directories

A filesystem layout is the set of standard directories that an operating system and its programs use, each for one kind of file. Programs find their configuration, libraries, and temporary files by these paths, so the layout is the same on every system of one kind.

The filesystem of a Linux sandbox comes from its image, with the sandbox disk on top of it. Files that the image ships are read from the image, and files that the sandbox writes go to its disk, except in /run, which is in memory. The sandbox daemon adds its own directories to every image.

Keep work files in the home directory or the temporary directory, where the default user can write. Leave the directories of the daemon unchanged, because the toolbox depends on them. Other Linux images keep this layout and can add programs and a non-root user, while Windows and macOS sandboxes keep the layout of their own system.

```text
/
├── bin              # Link to /usr/bin
├── boot/
├── dev/             # Devices, with shared memory in /dev/shm
├── etc/             # System configuration, with users in /etc/passwd and groups in /etc/group
├── home/            # Empty, until a create request names a default user
├── lib              # Link to /usr/lib
├── lib64            # Link to /usr/lib64
├── media/
├── mnt/
├── opt/
│   └── rlp/         # Files of the sandbox daemon
├── proc/            # Processes, from the Linux kernel
├── root/            # Home and working directory of root, the default user
│   ├── .bashrc
│   └── .profile
├── run/             # Runtime files in memory, cleared when the sandbox boots
│   └── rlp/         # Runtime files of the sandbox daemon
├── sbin             # Link to /usr/sbin
├── srv/
├── sys/             # Kernel settings, from the Linux kernel
├── tmp/             # Temporary files that every user can write, on the sandbox disk
│   └── rlp-daemon/  # State of the sandbox daemon
├── usr/             # Programs and libraries of the operating system
│   └── local/
│       └── bin/     # Python, pip, Git, and daytona, the program of the sandbox daemon
└── var/             # Logs, caches, and package data
```

## List files and directories

List files and directories to see what a directory of a sandbox holds. A directory listing returns one entry per file or subdirectory, with its name, type, size, and modification time.

A listing in a sandbox covers one directory and, on request, the directories nested below it. Symbolic links appear as entries of their own, and the listing does not follow them.

Use a listing to find the files to read, download, or change next. To read the metadata of a single entry, [get directory or file information](#get-directory-or-file-information). A depth option lists nested entries up to 32 levels deep. A listing over 10,000 entries fails, so request a smaller depth for large directory trees.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.writeText('/home/daytona/workspace/hello.txt', 'hello')

// List files in a directory
const files = await sandbox.fs.list('/home/daytona/workspace')

files.items.forEach(file => {
  console.log(`Name: ${file.name}`)
  console.log(`Is directory: ${file.isDir}`)
  console.log(`Size: ${file.size}`)
  console.log(`Modified: ${file.modifiedAt ?? file.modTime}`)
})
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the directory to list.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace'` |
| `depth` | Sets how many directory levels to list.<br />**Default:** `1`<br />**Minimum:** `1`<br />**Maximum:** `32` |

> **Notes:**
>
> - **Prerequisites:** The directory must exist in the sandbox.
> - **Limits:** A listing holds at most 10,000 entries.

## Get directory or file information

Get directory or file information to read the metadata of one entry. File metadata describes a file or directory without its content: size, type, mode, owner, group, and modification time.

The information of a sandbox entry describes the entry at the path itself. For a symbolic link, the information describes the link rather than the target of the link.

Get the information of an entry before a step that depends on its type or permissions. To read a whole directory, [list files and directories](#list-files-and-directories). The file or directory must exist in the sandbox.

| **Field**               | **Format**                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Mode**                | Symbolic, such as `-rw-r--r--`, with `d` first for a directory and `L` for a link. |
| **Permissions**         | The four-digit octal form, such as `0644`.                                         |
| **Owner** and **group** | Numeric user and group IDs as strings, such as `1000`, not names.                  |

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.writeText('/home/daytona/workspace/data/file.txt', 'hello')

// Get file metadata
const info = await sandbox.fs.stat('/home/daytona/workspace/data/file.txt')
console.log(`Size: ${info.size} bytes`)
console.log(`Modified: ${info.modifiedAt ?? info.modTime}`)
console.log(`Mode: ${info.mode}`)
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the file or directory to describe.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace/data/file.txt'` |

> **Notes:**
>
> - **Prerequisites:** The file or directory must exist in the sandbox.

## Create directories

Create directories to give files a place in the sandbox before they are written. A directory is a file system entry that holds files and other directories, with an owner and a permission mode.

A new directory in a sandbox is created with every missing parent directory on its path, so a single request creates a whole path of directories.

Create a directory before a step that writes into it. Uploads create missing parent directories themselves, as [upload a single file](#upload-a-single-file) describes. A new directory gets octal mode 755 by default. Change the mode of a directory later with [file permissions](#file-permissions).

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

await sandbox.fs.mkdir('/home/daytona/workspace/new-dir')
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the directory to create.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace/new-dir'` |
| `mode` | Sets the permission mode of the new directory.<br />**Default:** `'0755'`<br />**Format:** an octal string<br />**Example:** `'750'` |

## Upload files

Upload files to copy data from a local computer into a sandbox. An upload writes bytes to a path in the destination file system, as a new file or over an existing one.

An uploaded file in a sandbox is an ordinary file on the disk of the sandbox, and code that runs in the sandbox reads it like any other file on that disk.

Upload [a single file](#upload-a-single-file), [several files](#upload-multiple-files) in one request, or [a large file](#upload-large-files) streamed from local disk. Every upload creates missing parent directories and overwrites an existing file at the destination.

### Upload a single file

Upload a single file to place one file at a path in the sandbox. The upload sends the whole content of the file in a single request to the sandbox.

A single-file upload in a sandbox writes one file at the destination path. If a file already exists at that path, the upload replaces that file with the new content.

Upload a single file when its content is already in memory. For many files, [upload multiple files](#upload-multiple-files), and for files too large to hold in memory, [upload large files](#upload-large-files). Any missing parent directories at the destination path are created, and an existing file at the destination path is overwritten.

```typescript
import { readFile } from 'node:fs/promises'
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

await sandbox.fs.writeBytes('/home/daytona/remote_file.txt', await readFile('local_file.txt'))
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the destination path in the sandbox.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/remote_file.txt'` |
| `data` | Sets the bytes to write.<br />**Required**<br />**Example:** `await readFile('local_file.txt')` |
| `atomic` | Writes through a temporary file in the destination directory, then renames it into place.<br />**Default:** `false` |

### Upload multiple files

Upload multiple files to write several files to the sandbox in one request. A batch upload sends each file as a separate part of the request, each with its own destination path.

A batch upload in a sandbox writes each file on its own, and a failed file does not stop the others.

Upload multiple files to load inputs before code runs. Missing parent directories are created, and existing files are overwritten. The result lists each file written with its byte count, and an error message for each failure. Check the errors in the result, because a failed file raises no error.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

const result = await sandbox.fs.writeMany({
  '/home/daytona/data/file1.txt': new TextEncoder().encode('Content of file 1'),
  '/home/daytona/data/file2.txt': new TextEncoder().encode('Content of file 2'),
})

// Partial success is reported in the result, not thrown
result.errors.forEach(error => console.error(`Error: ${error}`))
```

| **Parameter** | **Description** |
| --- | --- |
| `files` | Sets the files to write.<br />**Required**<br />**Format:** absolute sandbox paths mapped to bytes<br />**Example:** `{ '/home/daytona/data/file1.txt': new TextEncoder().encode('hello') }` |
| `atomic` | Writes through a temporary file in the destination directory, then renames it into place.<br />**Default:** `false` |

### Upload large files

Upload large files to send files from local disk that are too large to hold in memory. A streamed upload reads the file in chunks and sends each chunk as it is read.

A large upload in a sandbox is written to disk as it arrives, with no request size limit. Free disk space in the sandbox bounds the size of the upload.

Upload large files for datasets and other files that do not fit in memory. The SDK streams the file in chunks without holding it in memory, and reports progress as it sends. The CLI streams the file from disk over a [presigned URL](#presigned-urls) that it creates for the upload.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

await sandbox.fs.uploadFile('large_dataset.csv', '/home/daytona/workspace/dataset.csv', {
  onProgress: (sent, total) => console.log(`Uploaded ${sent} of ${total} bytes`),
})
```

| **Parameter** | **Description** |
| --- | --- |
| `localPath` | Sets the local file to upload.<br />**Required**<br />**Example:** `'large_dataset.csv'` |
| `remotePath` | Sets the destination path in the sandbox.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace/dataset.csv'` |
| `atomic` | Writes through a temporary file in the destination directory, then renames it into place.<br />**Default:** `false` |
| `onProgress` | Reports upload progress.<br />**Format:** a callback that takes the bytes sent so far and the total size in bytes<br />**Example:** `(sent, total) => console.log(sent, total)` |
| `signal` | Stops the upload when the signal is aborted.<br />**Format:** an AbortSignal<br />**Example:** `controller.signal` |

> **Notes:**
>
> - **Compatibility:** uploadFile() works in Node.js only.
> - **Effects:** Without atomic, a stopped upload leaves the bytes sent so far at the destination.

## Download files

Download files to copy data from a sandbox to a local computer. A download reads a file at a path in the sandbox and returns its bytes to the caller.

A download from a sandbox reads a file without changing it, so the file stays in the sandbox.

Download results and artifacts after code runs. Download [a single file](#download-a-single-file), [several files](#download-multiple-files) in one request, or [a large file](#download-large-files) streamed to a file on local disk.

### Download a single file

Download a single file to read its content. The download returns the whole file in one response.

A single-file download from a sandbox returns the bytes of one file as they are on its disk.

Download a single file when its content fits in memory. To read the content as a string, [download a text file](#download-a-text-file). For files too large for memory, [download large files](#download-large-files).

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.writeText('/home/daytona/file1.txt', 'Content of file 1')

const content = await sandbox.fs.readBytes('/home/daytona/file1.txt')
console.log(new TextDecoder().decode(content))
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the file to download.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/file1.txt'` |
| `maxResponseBytes` | Sets the largest response body the call accepts, in bytes.<br />**Default:** the cap of the client<br />**Value:** `0` for no limit<br />**Example:** `10485760` |

> **Notes:**
>
> - **Prerequisites:** The file must exist in the sandbox.

##### Download a text file

Download a text file to read its content as a string. Text is stored as bytes in a character encoding such as UTF-8, and decoding turns the bytes back into characters.

A text download from a sandbox reads one file and decodes its content as UTF-8.

Download a text file when code needs a string. The SDK downloads the file and decodes its content as UTF-8, so the file must be valid UTF-8. To keep the raw bytes, [download a single file](#download-a-single-file).

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.writeText('/home/daytona/file1.txt', 'Content of file 1')

const content = await sandbox.fs.readText('/home/daytona/file1.txt')
console.log(content)
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the file to download.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/file1.txt'` |
| `maxResponseBytes` | Sets the largest response body the call accepts, in bytes.<br />**Default:** the cap of the client<br />**Value:** `0` for no limit<br />**Example:** `10485760` |

> **Notes:**
>
> - **Prerequisites:** The file must exist in the sandbox. The file must be valid UTF-8.

### Download multiple files

Download multiple files to read several files from the sandbox in one request. A batch download returns all the files in one response, each with its path.

A batch download from a sandbox reads each file independently. A missing or unreadable file does not stop the others and is reported as an error for its path.

Download multiple files to collect results and artifacts after a run. Check the errors in the result, because a failed file does not raise an error. The SDK methods hold every downloaded file in memory before they return, so for files too large to hold in memory, [download large files](#download-large-files).

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.writeMany({
  '/home/daytona/data/file1.txt': new TextEncoder().encode('Content of file 1'),
  '/home/daytona/data/file2.txt': new TextEncoder().encode('Content of file 2'),
})

const result = await sandbox.fs.readMany(['/home/daytona/data/file1.txt', '/home/daytona/data/file2.txt'])

Object.entries(result.files).forEach(([path, content]) => {
  console.log(`Downloaded ${path} (${content.byteLength} bytes)`)
})

// Partial success is reported in the result, not thrown
result.errors.forEach(error => console.error(`Error downloading ${error.path}: ${error.message}`))
```

| **Parameter** | **Description** |
| --- | --- |
| `paths` | Sets the files to download.<br />**Required**<br />**Format:** a list of absolute paths<br />**Example:** `['/home/daytona/data/file1.txt']` |
| `maxResponseBytes` | Sets the largest response body the call accepts, in bytes.<br />**Default:** the cap of the client<br />**Value:** `0` for no limit<br />**Example:** `10485760` |

### Download large files

Download large files to save files from the sandbox to local disk without holding them in memory. A streamed download writes the file to disk in chunks as the data arrives.

A large download from a sandbox streams one file to local disk, and the file never sits whole in the memory of the application that downloads the file.

Download large files for datasets and other files that do not fit in memory. The SDK writes to a temporary file next to the destination and renames it into place only after the whole file arrives. A failed or cancelled download therefore leaves an existing destination file unchanged. The CLI writes the file to disk as the data arrives, over a [presigned URL](#presigned-urls) it creates for the transfer.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.writeText('/home/daytona/workspace/large-file.bin', 'hello')

await sandbox.fs.downloadFile('/home/daytona/workspace/large-file.bin', 'local_copy.bin', {
  onProgress: (received, total) => console.log(`Downloaded ${received} of ${total} bytes`),
})
```

| **Parameter** | **Description** |
| --- | --- |
| `remotePath` | Sets the file to download from the sandbox.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace/large-file.bin'` |
| `localPath` | Sets the local destination.<br />**Required**<br />**Example:** `'local_copy.bin'` |
| `onProgress` | Reports download progress.<br />**Format:** a callback that takes the bytes received so far and the total size in bytes, or undefined when the total is unknown<br />**Example:** `(received, total) => console.log(received, total)` |
| `signal` | Stops the download when the signal is aborted.<br />**Format:** an AbortSignal<br />**Example:** `controller.signal` |

> **Notes:**
>
> - **Prerequisites:** The parent directory of the local destination must exist.
> - **Compatibility:** downloadFile() works in Node.js only.
> - **Effects:** A replaced destination file keeps its permission bits.

## Delete files

Delete files to remove files and directories from the sandbox. A deleted entry is gone from the file system, and a deleted directory takes everything in it along.

A delete in a sandbox removes the entry at the path itself. A symbolic link is deleted as a link, and the file or directory that the link points to stays in place.

Delete a file or directory when the sandbox no longer needs it. A directory is deleted, with everything in it, only when the recursive option is set. Without it, deleting a directory fails.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.writeText('/home/daytona/workspace/file.txt', 'hello')

await sandbox.fs.remove('/home/daytona/workspace/file.txt')
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the file or directory to delete.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace/file.txt'` |
| `recursive` | Deletes a directory and everything in it.<br />**Default:** `false` |

> **Notes:**
>
> - **Prerequisites:** The file or directory must exist in the sandbox.

## File permissions

File permissions decide who can read, write, or run a file or directory. Each entry has an owner, a group, and a permission mode that sets the access of the owner, the group, and others.

File permissions in a sandbox refer to the users and groups of that sandbox, and the sandbox resolves a user or group name from its own user and group lists.

Change at least one of the mode, owner, and group of an entry. Symbolic links are followed, so a change on a link applies to its target. To read them, [get directory or file information](#get-directory-or-file-information).

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.writeText('/home/daytona/workspace/file.txt', 'hello')

await sandbox.fs.chmod('/home/daytona/workspace/file.txt', { mode: '644' })
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the file or directory to change.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace/file.txt'` |
| `group` | Sets the group.<br />**Format:** a numeric group ID or a group name<br />**Example:** `'1000'` |
| `mode` | Sets the permission mode.<br />**Format:** an octal string<br />**Example:** `'644'` |
| `owner` | Sets the owner.<br />**Format:** a numeric user ID or a user name<br />**Example:** `'1000'` |

> **Notes:**
>
> - **Prerequisites:** The file or directory must exist in the sandbox.

## Search files by pattern

Search files by pattern to find files by name. A name pattern matches file names with wildcards, where an asterisk matches any run of characters and a question mark matches one character.

A search in a sandbox walks the directory tree below its path, without following symbolic links, and matches the name of every entry. Directories with a matching name are returned too.

Search by name to find files of one type, such as every Python file in a project. To find text inside files, [find and replace text in files](#find-and-replace-text-in-files). Directories the sandbox cannot read are skipped without an error, and a search path that does not exist returns an empty result.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.writeText('/home/daytona/workspace/main.py', "print('hello')")

// Recursive; the pattern is matched against file names with * and ? wildcards
const result = await sandbox.fs.glob('/home/daytona/workspace', '*.py')
result.items.forEach(file => console.log(file))
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the directory to search.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace'` |
| `pattern` | Sets the file name pattern to match.<br />**Required**<br />**Format:** a file name pattern with asterisk and question mark wildcards<br />**Example:** `'*.py'` |

## Find and replace text in files

Find and replace text in files to locate text and change it. A text search reads files line by line and reports each line that contains the text, and a replace rewrites files with new text in its place.

A find or replace in a sandbox matches the text literally, not as a regular expression. A find reads only files that are valid UTF-8 text, and a replace rewrites each listed file in full.

Find text to see where it occurs, then replace it where needed. Find checks each file line by line and returns the file, the line number starting at 1, and the full line for every match. Files that are not valid UTF-8 text are skipped, and a path that does not exist returns no matches. Replace takes a list of files, not directories, and rewrites each file in full with every occurrence replaced.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.writeText('/home/daytona/workspace/src/app.py', 'text-of-interest')
await sandbox.fs.writeText('/home/daytona/workspace/file1.txt', 'old_text')
await sandbox.fs.writeText('/home/daytona/workspace/file2.txt', 'old_text')

// Search for text in files; the pattern is a literal substring, not a regular expression.
// If a directory is given, the search is recursive.
const results = await sandbox.fs.grep('/home/daytona/workspace/src', 'text-of-interest')
results.items.forEach(match => console.log(`${match.file}:${match.line}: ${match.content}`))

// Replace every occurrence of a literal substring in each listed file
const result = await sandbox.fs.replace(['/home/daytona/workspace/file1.txt', '/home/daytona/workspace/file2.txt'], 'old_text', 'new_text')

// Per-file failures are reported in the result, not thrown
result.items
  .filter(item => !item.success)
  .forEach(item => console.error(`Failed to update ${item.file}: ${item.error}`))
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the file or directory to search.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace/src'` |
| `pattern` | Sets the literal text to find or replace.<br />**Required**<br />**Example:** `'old_text'` |
| `files` | Sets the files to rewrite.<br />**Required**<br />**Format:** a list of absolute file paths<br />**Example:** `['/home/daytona/workspace/file1.txt']` |
| `newValue` | Sets the replacement text.<br />**Required**<br />**Example:** `'new_text'` |

## Move or rename directory or file

Move or rename a directory or file to change its path. A rename changes the name of an entry, and a move changes the directory that holds the entry.

A move in a sandbox never replaces or merges into an entry at the destination. Across filesystems, the sandbox copies the entry and removes the source only after the copy succeeds.

Move or rename an entry when a later step needs it at another path. The move creates missing parent directories. A move across filesystems keeps the owner and mode of each copied entry.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.writeText('/home/daytona/workspace/data/file.txt', 'hello')

// Missing parent directories are created; an existing destination is rejected with ConflictError
await sandbox.fs.move('/home/daytona/workspace/data/file.txt', '/home/daytona/workspace/archive/file.txt')
```

| **Parameter** | **Description** |
| --- | --- |
| `source` | Sets the file or directory to move.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace/data/file.txt'` |
| `destination` | Sets the new path.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace/archive/file.txt'` |

> **Notes:**
>
> - **Prerequisites:** The source file or directory must exist in the sandbox.
> - **Effects:** Missing parent directories of the destination are created.

## Watch for file changes

Watch for file changes to react to changes in a directory as they happen. A file watch is a stream of events, one for each change to an entry in the watched directory.

A watch on a sandbox directory reports changes from the moment it starts, and it does not replay earlier changes. Event paths are relative to the watched directory.

Watch a directory to react to files that sandbox code creates or changes. The watch streams create, write, remove, rename, and permission change events. A recursive watch also covers subdirectories, including ones created later. To block until it ends, [wait for the watch to end](#wait-for-the-watch-to-end).

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.mkdir('/home/daytona/workspace/src')

const handle = await sandbox.fs.watchDir('/home/daytona/workspace/src', (event) => {
  console.log(`${event.type}: ${event.name}`)
})

await sandbox.fs.writeText('/home/daytona/workspace/src/new.py', "print('hello')")

// Events arrive after the write returns; stop() drops events not yet delivered
await new Promise(resolve => setTimeout(resolve, 1000))
await handle.stop()
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the directory to watch.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace/src'` |
| `onEvent` | Receives each event.<br />**Required**<br />**Format:** a function or async function that takes one event<br />**Example:** `(event) => console.log(event.name)` |
| `onExit` | Runs once when the watch ends.<br />**Format:** a function or async function that takes the error that ended the watch, or no argument after stop() |
| `onOverflow` | Runs when the watch drops events.<br />**Format:** a function or async function without arguments |
| `recursive` | Watches subdirectories of the directory.<br />**Default:** `false` |

> **Notes:**
>
> - **Prerequisites:** The directory must exist in the sandbox.
> - **Limits:** A recursive watch covers at most 4096 directories.
> - **Clients:** An error thrown in onEvent or onOverflow ends the watch.

### Wait for the watch to end

Wait for the watch to end to keep a program running while events arrive. The wait blocks until the watch stops, and returns the error that ended it, if there is one.

A healthy watch on a sandbox directory does not end on its own. It ends when it is stopped, or when its stream ends because the sandbox stops or is deleted.

Wait for the watch to end in a program that does nothing else while it watches. Stop the watch from another thread or a timer to end the wait. After a stop, the wait returns no error.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()
await sandbox.fs.mkdir('/home/daytona/workspace/src')

const handle = await sandbox.fs.watchDir('/home/daytona/workspace/src', (event) => {
  console.log(`${event.type}: ${event.name}`)
})

// Nothing ends a healthy watch on its own: stop it from elsewhere,
// or the stream ends when the sandbox stops or is deleted
setTimeout(() => handle.stop(), 60_000)

// Resolves when the watch is stopped or the stream ends
const error = await handle.waitForExit()
if (error) console.error('Watch ended:', error.message)
```

## Presigned URLs

Presigned URLs are URLs that carry their own authorization as a signature and an expiry time. Any HTTP client that has the URL can use it until it expires, without other credentials.

A presigned URL of a sandbox downloads or uploads one file of that sandbox without an API key. Each URL is signed with the signing key of its sandbox, and a rotation of that key invalidates all the outstanding URLs that were signed with the old key.

Create a presigned URL to let a browser or another service transfer a file without an API key. A URL is valid for 1 hour by default and for at most 7 days. Rotate the signing key to revoke every outstanding URL. Old URLs can still work for up to 30 seconds after the rotation.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

// Download link, valid for 1 hour (default)
const downloadUrl = await sandbox.fs.presignedDownloadUrl('/home/daytona/workspace/report.pdf')

// Upload link, valid for 1 hour (default)
const uploadUrl = await sandbox.fs.presignedUploadUrl('/home/daytona/workspace/incoming/data.bin')

// Invalidate every outstanding presigned URL for this sandbox; old URLs can still work for up to 30 seconds
await sandbox.rotateSigningKey()
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the sandbox file that the URL downloads or uploads.<br />**Required**<br />**Format:** an absolute path<br />**Example:** `'/home/daytona/workspace/report.pdf'` |
| `expiresInSeconds` | Sets the lifetime of the URL in seconds.<br />**Default:** `3600`<br />**Minimum:** `1`<br />**Maximum:** `604800` |

> **Notes:**
>
> - **Compatibility:** Windows sandboxes cannot have presigned URLs.
> - **Lifetime:** The expiry is the current whole second plus the lifetime, so a URL can expire up to 1 second early.

## Permissions

File system access runs through the toolbox of a sandbox. Access is governed by one project permission, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

A [sandbox access token](./sandboxes.md#create-an-access-token) with the toolbox:fs operation grants the same access to a single sandbox, without an API key. The sandbox read permission alone does not grant toolbox access.

| **Permission**        | **Grants**                                           |
| --------------------- | ---------------------------------------------------- |
| **`write:sandboxes`** | List, read, upload, download, move, and delete files |
