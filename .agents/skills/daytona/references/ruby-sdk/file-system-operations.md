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

```ruby
# List directory contents
files = sandbox.fs.list_files("workspace/data")

# Print files and their sizes
files.each do |file|
  puts "#{file.name}: #{file.size} bytes" unless file.is_dir
end

# List only directories
dirs = files.select(&:is_dir)
puts "Subdirectories: #{dirs.map(&:name).join(', ')}"
```

### Get directory or file information

Get directory or file information by providing the path to the directory or file.

```ruby
# Get file metadata
info = sandbox.fs.get_file_info("workspace/data/file.txt")
puts "Size: #{info.size} bytes"
puts "Modified: #{info.mod_time}"
puts "Mode: #{info.mode}"

# Check if path is a directory
info = sandbox.fs.get_file_info("workspace/data")
puts "Path is a directory" if info.is_dir
```

### Create directories

Create a directory by providing the path and permissions to set on the directory.

```ruby
# Create a directory with standard permissions
sandbox.fs.create_folder("workspace/data", "755")

# Create a private directory
sandbox.fs.create_folder("workspace/secrets", "700")
```

### Upload files

Daytona provides methods to upload a single or multiple files in sandboxes.

#### Upload a single file

Upload a single file by providing the content to upload and the path to the file to upload it to.

```ruby
# Upload a text file from string content
content = "Hello, World!"
sandbox.fs.upload_file(content, "tmp/hello.txt")

# Upload a local file
sandbox.fs.upload_file("local_file.txt", "tmp/file.txt")

# Upload binary data
data = { key: "value" }.to_json
sandbox.fs.upload_file(data, "tmp/config.json")
```

#### Upload multiple files

Upload multiple files by providing the content to upload and their destination paths.

```ruby
# Upload multiple files
files = [
  FileUpload.new("Content of file 1", "/tmp/file1.txt"),
  FileUpload.new("workspace/data/file2.txt", "/tmp/file2.txt"),
  FileUpload.new('{"key": "value"}', "/tmp/config.json")
]

sandbox.fs.upload_files(files)
```

#### Stream uploads

For large files, use streaming upload methods to avoid loading the entire file into memory.

```ruby
File.open("large_dataset.csv", "rb") do |f|
  sandbox.fs.upload_file_stream(f, "workspace/dataset.csv")
end
```

### Download files

Daytona provides methods to download files from sandboxes.

#### Download a single file

Download a single file by providing the path to the file to download.

```ruby
# Download and get file content
content = sandbox.fs.download_file("workspace/data/file.txt")
puts content

# Download and save a file locally
sandbox.fs.download_file("workspace/data/file.txt", "local_copy.txt")
size_mb = File.size("local_copy.txt") / 1024.0 / 1024.0
puts "Size of the downloaded file: #{size_mb} MB"
```

#### Download multiple files

Download multiple files by providing the paths to the files to download.

```ruby
# Download multiple files by calling download_file for each
files_to_download = [
  { remote: "data/file1.txt", local: nil },              # Download to memory
  { remote: "data/file2.txt", local: "local_file2.txt" } # Download to local file
]

files_to_download.each do |f|
  if f[:local]
    sandbox.fs.download_file(f[:remote], f[:local])
    puts "Downloaded #{f[:remote]} to #{f[:local]}"
  else
    content = sandbox.fs.download_file(f[:remote])
    puts "Downloaded #{f[:remote]} to memory (#{content.size} bytes)"
  end
end
```

#### Stream downloads

For large files, use streaming download methods to avoid loading the entire file into memory.

```ruby
File.open("local_copy.bin", "wb") do |f|
  sandbox.fs.download_file_stream("workspace/large-file.bin") { |chunk| f.write(chunk) }
end
```

### Delete files

Delete a file or directory by providing the path to the file or directory to delete.

Pass `recursive: true` to delete a directory recursively.

```ruby
# Delete a file
sandbox.fs.delete_file("workspace/data/old_file.txt")

# Delete a directory recursively
sandbox.fs.delete_file("workspace/old_dir", recursive: true)
```

## Advanced operations

Daytona provides advanced file system operations such as file permissions, search by file name, content search and replace, and move files.

### File permissions

Set file permissions, ownership, and group for a file or directory by providing the path to the file or directory and the permissions to set.

```ruby
# Make a file executable
sandbox.fs.set_file_permissions(
  path: "workspace/scripts/run.sh",
  mode: "755"  # rwxr-xr-x
)

# Change file owner
sandbox.fs.set_file_permissions(
  path: "workspace/data/file.txt",
  owner: "daytona",
  group: "daytona"
)
```

### Search files by pattern

Search for files and directories by name using glob patterns (for example `*.py`). This is distinct from `find_files` / `findFiles`, which searches file contents.

```ruby
result = sandbox.fs.search_files("workspace", "*.rb")
result.files.each { |file| puts file }
```

### Find and replace text in files

Find and replace text in files by providing the path to the directory to search in and the pattern to search for.

```ruby
# Search for TODOs in Ruby files
matches = sandbox.fs.find_files("workspace/src", "TODO:")
matches.each do |match|
  puts "#{match.file}:#{match.line}: #{match.content.strip}"
end

# Replace in specific files
results = sandbox.fs.replace_in_files(
  files: ["workspace/src/file1.rb", "workspace/src/file2.rb"],
  pattern: "old_function",
  new_value: "new_function"
)

# Print results
results.each do |result|
  if result.success
    puts "#{result.file}: #{result.success}"
  else
    puts "#{result.file}: #{result.error}"
  end
end
```

### Move or rename directory or file

Move or rename a directory or file by providing the path to the file or directory (source) and the new path to the file or directory (destination).

```ruby
# Rename a file
sandbox.fs.move_files(
  "workspace/data/old_name.txt",
  "workspace/data/new_name.txt"
)

# Move a file to a different directory
sandbox.fs.move_files(
  "workspace/data/file.txt",
  "workspace/archive/file.txt"
)

# Move a directory
sandbox.fs.move_files(
  "workspace/old_dir",
  "workspace/new_dir"
)
```

## See Also
- [Python SDK - file-system-operations](../python-sdk/file-system-operations.md)
- [TypeScript SDK - file-system-operations](../typescript-sdk/file-system-operations.md)
- [Java SDK - file-system-operations](../java-sdk/file-system-operations.md)
- [Go SDK - file-system-operations](../go-sdk/file-system-operations.md)
